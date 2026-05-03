import { 
  collection, query, where, getDocs, addDoc, updateDoc, doc, 
  Timestamp, serverTimestamp, getDoc, limit, orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { SmartAlert, InventoryItem, Machine, Intervention, Customer } from '../types';
import { subMonths, parseISO, isBefore, isAfter, differenceInDays } from 'date-fns';

export async function checkAndGenerateAlerts(context?: { 
  inventory?: InventoryItem[], 
  machines?: Machine[], 
  interventions?: Intervention[],
  customers?: Customer[]
}) {
  const now = new Date();
  
  // 1. Check Low Stock
  const inventoryItems = context?.inventory || (await getDocs(collection(db, 'inventory'))).docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
  
  for (const item of inventoryItems) {
    if (item.status === 'active' && item.stockCount <= (item.minStock || 0)) {
       await triggerAlert({
         title: 'Lage Voorraad',
         description: `${item.name} is bijna op (${item.stockCount} st.)`,
         priority: item.stockCount === 0 ? 'urgent' : 'high',
         type: 'stock',
         relatedId: item.id
       });
    }
  }

  // 2. Check Machines (Warranty & Maintenance)
  const machines = context?.machines || (await getDocs(collection(db, 'machines'))).docs.map(d => ({ id: d.id, ...d.data() } as Machine));
  
  for (const machine of machines) {
    if (machine.warrantyEndDate) {
      try {
        const warrantyDate = parseISO(machine.warrantyEndDate);
        const daysLeft = differenceInDays(warrantyDate, now);
        
        if (daysLeft >= 0 && daysLeft <= 30) {
          await triggerAlert({
            title: 'Garantie Verloopt Bijna',
            description: `Garantie voor ${machine.brand} ${machine.model} verloopt over ${daysLeft} dagen.`,
            priority: daysLeft <= 7 ? 'high' : 'normal',
            type: 'warranty',
            relatedId: machine.id
          });
        }
      } catch (e) { /* invalid date */ }
    }

    if (machine.nextMaintenanceDate) {
      try {
        const maintenanceDate = parseISO(machine.nextMaintenanceDate);
        if (isBefore(maintenanceDate, now)) {
          await triggerAlert({
            title: 'Onderhoud Verstreken',
            description: `Onderhoud voor ${machine.brand} ${machine.model} was gepland op ${machine.nextMaintenanceDate}.`,
            priority: 'high',
            type: 'maintenance',
            relatedId: machine.id
          });
        }
      } catch (e) { /* invalid date */ }
    }
  }

  // 3. Frequent Failures
  const repairs = context?.interventions?.filter(i => i.type === 'fault') || 
                  (await getDocs(query(collection(db, 'interventions'), where('type', '==', 'fault')))).docs.map(d => d.data() as Intervention);
  
  const thirtyDaysAgo = subMonths(now, 1).toISOString();
  const machineRepairs: Record<string, number> = {};
  
  repairs.filter(r => r.date >= thirtyDaysAgo).forEach(r => {
    if (r.machineId) machineRepairs[r.machineId] = (machineRepairs[r.machineId] || 0) + 1;
  });

  for (const [mId, count] of Object.entries(machineRepairs)) {
    if (count >= 3) {
      const m = machines.find(m => m.id === mId);
      await triggerAlert({
        title: 'Frequente Storingen',
        description: `${m?.brand || 'Machine'} (${m?.serialNumber || 'SN Unknown'}) heeft ${count} reparaties in 30 dagen.`,
        priority: 'urgent',
        type: 'failure',
        relatedId: mId
      });
    }
  }
}

async function triggerAlert(baseAlert: Partial<SmartAlert>) {
  // Check if an open alert for this already exists
  const existingQuery = query(
    collection(db, 'smart_alerts'),
    where('relatedId', '==', baseAlert.relatedId),
    where('type', '==', baseAlert.type),
    where('status', '==', 'open')
  );
  
  const snap = await getDocs(existingQuery);
  
  if (snap.empty) {
    // Also check if we created one recently (last 7 days) even if resolved, to avoid spam
    // For this demo, just 'open' check is enough.
    
    await addDoc(collection(db, 'smart_alerts'), {
      ...baseAlert,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}
