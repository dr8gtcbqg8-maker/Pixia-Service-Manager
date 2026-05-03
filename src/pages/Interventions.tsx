import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, deleteDoc, doc, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Intervention, Customer, Machine, InterventionStatus, InterventionType, ReminderPriority, InventoryItem } from '../types';
import { 
  Calendar, Search, Filter, Plus, X, Edit3, Trash2, 
  Wrench, User, Printer, Clock, AlertCircle, CheckCircle2, 
  ChevronRight, MapPin, MoreVertical, Briefcase, History,
  FileText, ClipboardList, Package, Minus, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, calculateNextMaintenanceDate } from '../lib/utils';
import { logAction } from '../lib/audit';
import { emailService } from '../lib/emailService';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';
import DocumentSection from '../components/DocumentSection';
import AppointmentModal from '../components/AppointmentModal';

const Interventions: React.FC = () => {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [appointmentInitialData, setAppointmentInitialData] = useState<any>({});
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    customerId: '',
    machineId: '',
    technicianName: '',
    type: 'maintenance' as InterventionType,
    status: 'planned' as InterventionStatus,
    priority: 'normal' as ReminderPriority,
    problemDescription: '',
    workPerformed: '',
    hoursWorked: 0,
    travelTime: 0,
    followUpAction: '',
    nextMaintenanceDate: '',
    internalNotes: '',
    customerNotes: '',
    partsUsed: [] as { itemId?: string; quantity: number; name: string; unitPrice?: number }[]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [iSnap, cSnap, mSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'interventions'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'machines')),
        getDocs(collection(db, 'inventory'))
      ]);
      setInterventions(iSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));
      setCustomers(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setMachines(mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
      setInventory(invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'interventions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Handle URL parameters for pre-filling new intervention
    const params = new URLSearchParams(window.location.search);
    const machineId = params.get('machine');
    const customerId = params.get('customer');
    const interventionId = params.get('id');
    const shouldOpenNew = params.get('new') === 'true';

    if (machineId || customerId || shouldOpenNew) {
      setFormData(prev => ({
        ...prev,
        machineId: machineId || prev.machineId,
        customerId: customerId || prev.customerId
      }));
      setIsAddModalOpen(true);
    } else if (interventionId) {
      // Find and open existing intervention
      const searchAndOpen = async () => {
        const docRef = doc(db, 'interventions', interventionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const interv = { id: docSnap.id, ...docSnap.data() } as Intervention;
          handleOpenEditModal(interv);
        }
      };
      searchAndOpen();
    }
  }, []);

  const handleOpenAddModal = () => {
    setSelectedIntervention(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      customerId: '',
      machineId: '',
      technicianName: '',
      type: 'maintenance',
      status: 'planned',
      priority: 'normal',
      problemDescription: '',
      workPerformed: '',
      hoursWorked: 0,
      travelTime: 0,
      followUpAction: '',
      nextMaintenanceDate: '',
      internalNotes: '',
      customerNotes: '',
      partsUsed: []
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (intervention: Intervention) => {
    setSelectedIntervention(intervention);
    setFormData({
      date: intervention.date,
      time: intervention.time || '',
      customerId: intervention.customerId,
      machineId: intervention.machineId,
      technicianName: intervention.technicianName || '',
      type: intervention.type,
      status: intervention.status,
      priority: intervention.priority,
      problemDescription: intervention.problemDescription || '',
      workPerformed: intervention.workPerformed || '',
      hoursWorked: intervention.hoursWorked || 0,
      travelTime: intervention.travelTime || 0,
      followUpAction: intervention.followUpAction || '',
      nextMaintenanceDate: intervention.nextMaintenanceDate || '',
      internalNotes: intervention.internalNotes || '',
      customerNotes: intervention.customerNotes || '',
      partsUsed: intervention.partsUsed || []
    });
    setIsAddModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      let interventionId = selectedIntervention?.id;

      if (selectedIntervention) {
        if (formData.status !== selectedIntervention.status) {
          await logAction('Status gewijzigd', 'intervention', selectedIntervention.id, `Van ${getStatusLabel(selectedIntervention.status)} naar ${getStatusLabel(formData.status)}`);
          
          if (selectedIntervention.status === 'completed' && formData.status !== 'completed' && selectedIntervention.stockProcessed) {
            for (const part of selectedIntervention.partsUsed || []) {
              if (!part.itemId) continue;
              const itemRef = doc(db, 'inventory', part.itemId);
              const itemDoc = await getDoc(itemRef);
              if (itemDoc.exists()) {
                const currentStock = itemDoc.data().stockCount || 0;
                await updateDoc(itemRef, {
                  stockCount: currentStock + part.quantity,
                  updatedAt: new Date().toISOString()
                });
                
                await addDoc(collection(db, 'inventory_mutations'), {
                  itemId: part.itemId,
                  type: 'correction',
                  quantity: part.quantity,
                  interventionId: selectedIntervention.id,
                  reason: `Correctie: Interventie status gewijzigd van afgerond naar ${getStatusLabel(formData.status)}`,
                  technicianName: formData.technicianName,
                  timestamp: new Date().toISOString()
                });
              }
            }
            data.stockProcessed = false;
          }
        }
        await updateDoc(doc(db, 'interventions', selectedIntervention.id), data);
        await logAction('Interventie aangepast', 'intervention', selectedIntervention.id, `Status: ${data.status}`);
      } else {
        const docRef = await addDoc(collection(db, 'interventions'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        interventionId = docRef.id;
        await logAction('Interventie aangemaakt', 'intervention', interventionId, `Target: ${getMachineSimpleInfo(data.machineId)}`);
      }

      if (formData.status === 'completed' && (!selectedIntervention || !selectedIntervention.stockProcessed)) {
          if (interventionId) {
            await logAction('Interventie afgerond', 'intervention', interventionId, `Klant: ${getCustomerName(formData.customerId)}`);
          }
          for (const part of formData.partsUsed) {
             if (!part.itemId) continue;
             const itemRef = doc(db, 'inventory', part.itemId);
             const itemDoc = await getDoc(itemRef);
             if (itemDoc.exists()) {
                const itemData = itemDoc.data();
                const currentStock = itemData.stockCount || 0;
                await updateDoc(itemRef, {
                   stockCount: currentStock - part.quantity,
                   updatedAt: new Date().toISOString()
                });

                await addDoc(collection(db, 'inventory_mutations'), {
                   itemId: part.itemId,
                   type: 'intervention',
                   quantity: part.quantity,
                   interventionId: interventionId,
                   reason: `Gebruikt bij interventie voor ${getCustomerName(formData.customerId)} (ID: ${interventionId})`,
                   technicianName: formData.technicianName,
                   timestamp: new Date().toISOString()
                });
             }
          }

          if (interventionId) {
             await updateDoc(doc(db, 'interventions', interventionId), {
                stockProcessed: true
             });
          }

          if (formData.nextMaintenanceDate || formData.type === 'maintenance') {
              const machineRef = doc(db, 'machines', formData.machineId);
              const machineSnap = await getDoc(machineRef);
              const machineData = machineSnap.exists() ? machineSnap.data() as Machine : null;

              const updates: any = {
                status: 'active'
              };

              if (formData.type === 'maintenance') {
                updates.lastMaintenanceDate = formData.date;
                
                if (machineData?.autoScheduleEnabled && !formData.nextMaintenanceDate) {
                  const calculatedNext = calculateNextMaintenanceDate({
                    lastMaintenanceDate: formData.date,
                    maintenanceInterval: machineData.maintenanceInterval,
                    firstMaintenanceMonths: machineData.firstMaintenanceMonths
                  });
                  if (calculatedNext) {
                    updates.nextMaintenanceDate = calculatedNext;
                  }
                }
              }

              if (formData.nextMaintenanceDate) {
                updates.nextMaintenanceDate = formData.nextMaintenanceDate;
              }

              await updateDoc(machineRef, updates);

              if (updates.nextMaintenanceDate) {
                await addDoc(collection(db, 'reminders'), {
                  title: `Volgend onderhoud: ${getMachineSimpleInfo(formData.machineId)}`,
                  description: `Automatisch aangemaakt na interventie op ${formData.date}`,
                  customerId: formData.customerId,
                  machineId: formData.machineId,
                  dueDate: updates.nextMaintenanceDate,
                  priority: 'normal',
                  status: 'open',
                  type: 'maintenance',
                  createdAt: new Date().toISOString()
                });
              }
           }
           
           if (formData.followUpAction) {
              await addDoc(collection(db, 'reminders'), {
                title: `Follow-up: ${formData.followUpAction}`,
                description: `Gemaakt nav interventie bij ${getCustomerName(formData.customerId)}`,
                customerId: formData.customerId,
                machineId: formData.machineId,
                dueDate: format(new Date(), 'yyyy-MM-dd'),
                priority: 'high',
                status: 'open',
                type: 'follow-up',
                createdAt: new Date().toISOString()
              });
           }
      }

      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, selectedIntervention ? OperationType.UPDATE : OperationType.CREATE, 'interventions');
    }
  };

  const handleSendConfirmation = async () => {
    if (!selectedIntervention) return;
    setIsSendingEmail(true);
    try {
      const customer = customers.find(c => c.id === selectedIntervention.customerId);
      const machine = machines.find(m => m.id === selectedIntervention.machineId);
      
      if (!customer?.email) {
        alert('Klant heeft geen e-mailadres ingesteld.');
        return;
      }

      await emailService.triggerAutomation('appointment_confirmation', {
        customer,
        machine,
        intervention: selectedIntervention,
        appointment: {
          date: selectedIntervention.date,
          startTime: selectedIntervention.time,
          location: customer.address
        }
      });
      
      alert('Bevestigingsmail is verzonden naar ' + customer.email);
    } catch (err) {
      console.error('Email sending failed:', err);
      alert('Fout bij het verzenden van de e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'interventions', deleteConfirm.id));
      await logAction('Interventie verwijderd', 'intervention', deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `interventions/${deleteConfirm.id}`);
    }
  };

  const handleQuickStatusChange = async (intervention: Intervention, newStatus: InterventionStatus) => {
    try {
      if (intervention.status === newStatus) return;
      
      const data: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === 'in-progress' && !intervention.startedAt ? { startedAt: new Date().toISOString() } : {})
      };

      // Stock Reversal if moved AWAY from completed
      if (intervention.status === 'completed' && newStatus !== 'completed' && intervention.stockProcessed) {
        for (const part of intervention.partsUsed || []) {
          if (!part.itemId) continue;
          const itemRef = doc(db, 'inventory', part.itemId);
          const itemDoc = await getDoc(itemRef);
          if (itemDoc.exists()) {
            const currentStock = itemDoc.data().stockCount || 0;
            await updateDoc(itemRef, {
              stockCount: currentStock + part.quantity,
              updatedAt: new Date().toISOString()
            });
            
            await addDoc(collection(db, 'inventory_mutations'), {
              itemId: part.itemId,
              type: 'correction',
              quantity: part.quantity,
              interventionId: intervention.id,
              reason: `Snelwaarde: Status gewijzigd van afgerond naar ${getStatusLabel(newStatus)}`,
              technicianName: intervention.technicianName,
              timestamp: new Date().toISOString()
            });
          }
        }
        data.stockProcessed = false;
      }

      await updateDoc(doc(db, 'interventions', intervention.id), data);
      await logAction('Status gewijzigd (Snel)', 'intervention', intervention.id, `Van ${getStatusLabel(intervention.status)} naar ${getStatusLabel(newStatus)}`);
      
      // If completed via quick action, handle stock if not already processed
      if (newStatus === 'completed' && !intervention.stockProcessed && intervention.partsUsed && intervention.partsUsed.length > 0) {
        for (const part of intervention.partsUsed) {
          if (!part.itemId) continue;
          const itemRef = doc(db, 'inventory', part.itemId);
          const itemDoc = await getDoc(itemRef);
          if (itemDoc.exists()) {
             const currentStock = itemDoc.data().stockCount || 0;
             await updateDoc(itemRef, {
                stockCount: currentStock - part.quantity,
                updatedAt: new Date().toISOString()
             });

             await addDoc(collection(db, 'inventory_mutations'), {
                itemId: part.itemId,
                type: 'intervention',
                quantity: part.quantity,
                interventionId: intervention.id,
                reason: `Snel afgerond: Gebruikt bij interventie voor ${getCustomerName(intervention.customerId)}`,
                technicianName: intervention.technicianName,
                timestamp: new Date().toISOString()
             });
          }
        }
        await updateDoc(doc(db, 'interventions', intervention.id), { stockProcessed: true });
      }

      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `interventions/${intervention.id}`);
    }
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Onbekend';
  const getMachineSimpleInfo = (id: string) => {
    const m = machines.find(mac => mac.id === id);
    return m ? `${m.brand} ${m.model}` : 'Machine';
  };
  const getMachineInfo = (id: string) => {
    const m = machines.find(mac => mac.id === id);
    return m ? `${m.brand} ${m.model} (${m.serialNumber})` : 'Onbekende machine';
  };

  const filteredInterventions = interventions.filter(i => {
    const matchesSearch = 
      getCustomerName(i.customerId).toLowerCase().includes(search.toLowerCase()) ||
      getMachineInfo(i.machineId).toLowerCase().includes(search.toLowerCase()) ||
      (i.problemDescription || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesCustomer = !filterCustomer || i.customerId === filterCustomer;
    const matchesMachine = !filterMachine || i.machineId === filterMachine;
    const matchesType = !filterType || i.type === filterType;
    const matchesStatus = !filterStatus || i.status === filterStatus;
    const matchesPriority = !filterPriority || i.priority === filterPriority;
    const matchesDate = !filterDate || i.date === filterDate;

    return matchesSearch && matchesCustomer && matchesMachine && matchesType && matchesStatus && matchesPriority && matchesDate;
  });

  const getStatusStyle = (status: InterventionStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-100';
      case 'in-progress': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'on-route': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'waiting-parts': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'planned': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'cancelled': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'to-be-scheduled': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusLabel = (status: InterventionStatus) => {
    switch (status) {
      case 'completed': return 'Afgerond';
      case 'in-progress': return 'Bezig';
      case 'on-route': return 'Onderweg';
      case 'waiting-parts': return 'Wacht op onderdelen';
      case 'planned': return 'Gepland';
      case 'cancelled': return 'Geannuleerd';
      case 'to-be-scheduled': return 'Nog te plannen';
      default: return status;
    }
  };

  const getPriorityStyle = (priority: ReminderPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-100';
      case 'high': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'low': return 'text-slate-500 bg-slate-50 border-slate-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Interventies & Onderhoud</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Registratie van service en reparaties</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nieuwe Interventie
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Zoek in interventies..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-[3]">
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterCustomer}
               onChange={(e) => setFilterCustomer(e.target.value)}
             >
               <option value="">Alle Klanten</option>
               {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value)}
             >
               <option value="">Alle Types</option>
               <option value="maintenance">Onderhoud</option>
               <option value="fault">Storing</option>
               <option value="installation">Installatie</option>
               <option value="inspection">Inspectie</option>
               <option value="warranty">Garantie</option>
               <option value="training">Training</option>
             </select>
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterStatus}
               onChange={(e) => setFilterStatus(e.target.value)}
             >
               <option value="">Alle Status</option>
               <option value="to-be-scheduled">Nog te plannen</option>
               <option value="planned">Gepland</option>
               <option value="on-route">Onderweg</option>
               <option value="in-progress">Bezig</option>
               <option value="waiting-parts">Wacht op onderdelen</option>
               <option value="completed">Afgerond</option>
               <option value="cancelled">Geannuleerd</option>
             </select>
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterPriority}
               onChange={(e) => setFilterPriority(e.target.value)}
             >
               <option value="">Prioriteit</option>
               <option value="urgent">Urgent</option>
               <option value="high">Hoog</option>
               <option value="normal">Normaal</option>
               <option value="low">Laag</option>
             </select>
             <input 
                type="date"
                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : filteredInterventions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredInterventions.map((i) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={i.id}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all p-8 group cursor-pointer"
              onClick={() => handleOpenEditModal(i)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${getStatusStyle(i.status)} border shadow-sm`}>
                     <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${getPriorityStyle(i.priority)}`}>
                         {i.priority}
                       </span>
                       <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase">{i.type}</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 line-clamp-1">{getCustomerName(i.customerId)}</h3>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Printer className="w-4 h-4 text-blue-600" />
                    <span className="truncate">{getMachineInfo(i.machineId)}</span>
                 </div>
                 
                 {i.problemDescription && (
                    <div className="relative">
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 italic pl-4 border-l-2 border-slate-200">
                         {i.problemDescription}
                      </p>
                    </div>
                 )}

                 {i.partsUsed && i.partsUsed.length > 0 && (
                   <div className="flex flex-wrap gap-1 mt-2">
                     {i.partsUsed.map((p, idx) => (
                       <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[9px] font-black text-blue-600 rounded-md border border-blue-100">
                         <Package className="w-2.5 h-2.5" />
                         {p.quantity}x {p.name}
                       </span>
                     ))}
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Datum</p>
                       <p className="text-xs font-bold text-slate-700">{format(new Date(i.date), 'dd MMM yyyy', { locale: nl })}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Technicus</p>
                       <p className="text-xs font-bold text-slate-700">{i.technicianName || 'N/A'}</p>
                    </div>
                 </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 pt-6 border-t border-slate-50">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Clock className="w-4 h-4 text-slate-400" />
                      <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-lg border ${getStatusStyle(i.status)}`}>
                         {getStatusLabel(i.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => { 
                           e.stopPropagation(); 
                           setAppointmentInitialData({
                             date: i.date,
                             interventionId: i.id,
                             customerId: i.customerId,
                             machineId: i.machineId,
                             title: `Interventie: ${getCustomerName(i.customerId)}`
                           });
                           setIsAppointmentModalOpen(true);
                         }}
                         className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                         title="Plan Afspraak"
                       >
                          <Calendar className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => { 
                           e.stopPropagation(); 
                           window.location.href = `/work-orders?interventionId=${i.id}`;
                         }}
                         className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                         title="Maak werkbon"
                       >
                          <FileText className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: i.id }); }}
                         className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>

                 {i.status !== 'completed' && i.status !== 'cancelled' && (
                   <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                     {(['planned', 'on-route', 'in-progress', 'waiting-parts', 'completed'] as InterventionStatus[]).map((status) => (
                       <button
                         key={status}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleQuickStatusChange(i, status);
                         }}
                         className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                           i.status === status 
                             ? 'bg-slate-900 text-white border-slate-900 scale-105' 
                             : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                         }`}
                       >
                         {getStatusLabel(status)}
                       </button>
                     ))}
                   </div>
                 )}
                 
                 <div className="w-full bg-slate-900 group-hover:bg-blue-600 text-white rounded-xl py-2 flex items-center justify-center transition-all">
                    <span className="text-[10px] font-black uppercase tracking-widest mr-2">Details Bekijken</span>
                    <ChevronRight className="w-4 h-4" />
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-24 rounded-3xl border border-slate-200 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
            <History className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Geen interventies gevonden</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Start met het registreren van werkzaamheden of pas de filters aan.</p>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-10 overflow-y-auto max-h-[95vh] focus:outline-none"
            >
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-4 italic">
                  <span className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                    <ClipboardList className="w-6 h-6" />
                  </span>
                  {selectedIntervention ? 'Interventie Aanpassen' : 'Nieuwe Interventie'}
                </h2>
                <div className="flex items-center gap-2">
                  {selectedIntervention && (
                    <>
                      <button 
                        type="button"
                        onClick={handleSendConfirmation}
                        disabled={isSendingEmail}
                        className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-indigo-600 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                        title="Verstuur Bevestiging"
                      >
                        <Mail className={`w-5 h-5 ${isSendingEmail ? 'animate-pulse' : ''}`} />
                        Mail Bevestiging
                      </button>
                      <button 
                        type="button"
                        onClick={() => window.print()}
                        className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-blue-600 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                        title="Afdrukken / PDF"
                      >
                        <Printer className="w-5 h-5" />
                        Print
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-10">
                {formData.status === 'waiting-parts' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-6 bg-orange-50 border border-orange-200 rounded-[1.5rem] text-orange-800"
                  >
                    <AlertCircle className="w-8 h-8 text-orange-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest">Wacht op onderdelen</p>
                      <p className="text-xs font-medium opacity-80">Zorg dat de benodigde onderdelen zijn besteld en vermeld de vervolgactie onderaan.</p>
                    </div>
                  </motion.div>
                )}

                {formData.status === 'completed' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-6 bg-green-50 border border-green-200 rounded-[1.5rem] text-green-800"
                  >
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest">Interventie Afgerond</p>
                        <p className="text-xs font-medium opacity-80">Zorg dat de klant de werkbon tekent.</p>
                      </div>
                    </div>
                    {selectedIntervention && (
                      <button 
                        type="button"
                        onClick={() => window.location.href = `/work-orders?interventionId=${selectedIntervention.id}`}
                        className="w-full md:w-auto bg-green-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-all text-center"
                      >
                        Maak Werkbon
                      </button>
                    )}
                  </motion.div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Klant *</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={formData.customerId}
                      onChange={(e) => setFormData({...formData, customerId: e.target.value, machineId: ''})}
                    >
                      <option value="">Selecteer klant...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Datum *</label>
                      <input 
                        required type="date" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tijd</label>
                      <input 
                        type="time" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Machine *</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={formData.machineId}
                      onChange={(e) => setFormData({...formData, machineId: e.target.value})}
                    >
                      <option value="">{formData.customerId ? 'Selecteer machine...' : 'Kies eerst een klant'}</option>
                      {machines.filter(m => m.customerId === formData.customerId).map(m => (
                        <option key={m.id} value={m.id}>{m.brand} {m.model} ({m.serialNumber})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Technicus</label>
                    <input 
                      type="text" 
                      placeholder="Naam technicus"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                      value={formData.technicianName}
                      onChange={(e) => setFormData({...formData, technicianName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Type *</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as InterventionType})}
                    >
                      <option value="maintenance">Onderhoud</option>
                      <option value="fault">Storing</option>
                      <option value="installation">Installatie</option>
                      <option value="inspection">Inspectie</option>
                      <option value="warranty">Garantie</option>
                      <option value="training">Training</option>
                      <option value="other">Overig</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Prioriteit</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as ReminderPriority})}
                    >
                      <option value="low">Laag</option>
                      <option value="normal">Normaal</option>
                      <option value="high">Hoog</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Onderdelen & Verbruiksartikelen</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase mr-1">Snel Toevoegen:</span>
                        <select 
                          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none hover:border-blue-300 transition-all cursor-pointer"
                          onChange={(e) => {
                            const item = inventory.find(i => i.id === e.target.value);
                            if (item) {
                              if (!formData.partsUsed.find(p => p.itemId === item.id)) {
                                setFormData({
                                  ...formData,
                                  partsUsed: [...formData.partsUsed, { 
                                    itemId: item.id, 
                                    quantity: 1, 
                                    name: item.name,
                                    unitPrice: item.sellingPrice
                                  }]
                                });
                              }
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">Kies onderdeel...</option>
                          {inventory.filter(i => i.status === 'active').map(i => {
                            const isLowStock = i.stockCount <= (i.minStock || 0);
                            return (
                              <option key={i.id} value={i.id} className={isLowStock ? 'text-red-500 font-bold' : ''}>
                                {i.name} (€{i.sellingPrice?.toFixed(2)}) - {isLowStock ? '⚠️ LAGE VOORRAAD: ' : 'Voorraad: '}{i.stockCount}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formData.partsUsed.map((part, idx) => (
                        <div key={part.itemId} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl group">
                          <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">{part.name}</p>
                            <div className="flex items-center gap-3">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                 Voorraad: {inventory.find(i => i.id === part.itemId)?.stockCount || 0}
                              </p>
                              {part.unitPrice !== undefined && (
                                <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">
                                  €{part.unitPrice.toFixed(2)} / st.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                            <button 
                              type="button"
                              onClick={() => {
                                const newParts = [...formData.partsUsed];
                                if (newParts[idx].quantity > 1) {
                                  newParts[idx].quantity -= 1;
                                  setFormData({ ...formData, partsUsed: newParts });
                                }
                              }}
                              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="w-10 text-center text-sm font-black">{part.quantity}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const newParts = [...formData.partsUsed];
                                newParts[idx].quantity += 1;
                                setFormData({ ...formData, partsUsed: newParts });
                              }}
                              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                partsUsed: formData.partsUsed.filter((_, i) => i !== idx)
                              });
                            }}
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all ml-1"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {formData.partsUsed.length === 0 && (
                        <div className="md:col-span-2 py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center opacity-40">
                           <Package className="w-6 h-6 mb-2" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Geen onderdelen gekoppeld</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Problem & Solution */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Omschrijving probleem</label>
                      <textarea 
                        rows={4}
                        placeholder="Wat was de klacht of reden voor het bezoek?"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all shadow-sm" 
                        value={formData.problemDescription}
                        onChange={(e) => setFormData({...formData, problemDescription: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Uitgevoerde Werkzaamheden</label>
                      <textarea 
                        rows={4}
                        placeholder="Beschrijf de acties die zijn ondernomen..."
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all shadow-sm" 
                        value={formData.workPerformed}
                        onChange={(e) => setFormData({...formData, workPerformed: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Time Tracking */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Gewerkte Uren</label>
                    <div className="relative">
                       <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                        type="number" step="0.25"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                        value={formData.hoursWorked}
                        onChange={(e) => setFormData({...formData, hoursWorked: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reistijd (minuten)</label>
                    <input 
                      type="number" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                      value={formData.travelTime}
                      onChange={(e) => setFormData({...formData, travelTime: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Status</label>
                    <select 
                      className={`w-full px-6 py-4 border rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm ${getStatusStyle(formData.status)}`}
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as InterventionStatus})}
                    >
                      <option value="to-be-scheduled">Nog te plannen</option>
                      <option value="planned">Gepland</option>
                      <option value="on-route">Onderweg</option>
                      <option value="in-progress">Bezig</option>
                      <option value="waiting-parts">Wacht op onderdelen</option>
                      <option value="completed">Afgerond</option>
                      <option value="cancelled">Geannuleerd</option>
                    </select>
                  </div>

                  {/* Planning & Follow up */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100 shadow-sm">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 ml-1">Vervolgactie</label>
                      <input 
                        type="text" 
                        placeholder="Moet er nog iets gebeuren? (bijv. onderdeel nabestellen)"
                        className="w-full px-6 py-4 bg-white border border-blue-100 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-400 outline-none transition-all shadow-sm" 
                        value={formData.followUpAction}
                        onChange={(e) => setFormData({...formData, followUpAction: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 ml-1">Volgende Onderhoudsdatum</label>
                      <input 
                        type="date" 
                        className="w-full px-6 py-4 bg-white border border-blue-100 rounded-[1.25rem] font-bold text-sm focus:ring-2 focus:ring-blue-400 outline-none transition-all shadow-sm" 
                        value={formData.nextMaintenanceDate}
                        onChange={(e) => setFormData({...formData, nextMaintenanceDate: e.target.value})}
                      />
                    </div>
                    <p className="md:col-span-2 text-[9px] text-blue-400 font-bold italic ml-1">
                      Tip: Na afronding worden deze deadlines automatisch toegevoegd aan de herinneringen.
                    </p>
                  </div>

                  {selectedIntervention && (
                    <div className="md:col-span-3 pt-6 border-t border-slate-100">
                      <DocumentSection 
                        interventionId={selectedIntervention.id} 
                        customerId={formData.customerId}
                        machineId={formData.machineId}
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Interne Opmerkingen</label>
                      <textarea 
                        rows={3}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all shadow-sm" 
                        value={formData.internalNotes}
                        onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Klantopmerkingen (op werkbon)</label>
                      <textarea 
                        rows={3}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all shadow-sm" 
                        value={formData.customerNotes}
                        onChange={(e) => setFormData({...formData, customerNotes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-10 border-t border-slate-50 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-50 rounded-[1.25rem] transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.3em] rounded-[1.25rem] shadow-[0_20px_50px_rgba(37,99,235,0.2)] hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    {selectedIntervention ? 'Wijzigingen Opslaan' : 'Interventie Registreren'}
                  </button>
                  {selectedIntervention && (
                    <button 
                      type="button"
                      onClick={() => window.location.href = `/work-orders?interventionId=${selectedIntervention.id}`}
                      className="flex-1 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.3em] rounded-[1.25rem] hover:bg-blue-600 transition-all shadow-xl shadow-slate-100"
                    >
                      Werkbon
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Interventie Verwijderen"
        message="Weet u zeker dat u deze interventie wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      <AppointmentModal 
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        appointment={null}
        initialData={appointmentInitialData}
        onSave={() => {
          setIsAppointmentModalOpen(false);
          fetchData();
        }}
        customers={customers}
        machines={machines}
        reminders={[]}
        interventions={interventions}
      />
    </div>
  );
};

export default Interventions;
