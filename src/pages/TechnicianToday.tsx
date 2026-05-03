import React, { useState, useEffect } from 'react';
import { 
  collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc, addDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  Calendar, Clock, MapPin, Phone, Navigation, Play, 
  ChevronRight, AlertCircle, Printer, FileText, Plus,
  Hammer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Customer, Machine, Intervention, Appointment, WorkOrder, Reminder,
  InterventionStatus
} from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { logAction } from '../lib/audit';
import { useNavigate } from 'react-router-dom';

const TechnicianToday: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custSnap, machSnap] = await Promise.all([
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'machines'))
        ]);
        setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
        setMachines(machSnap.docs.map(d => ({ id: d.id, ...d.data() } as Machine)));
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();

    // Today's Date String
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Real-time listeners for dynamic data
    const unsubInterventions = onSnapshot(
      query(collection(db, 'interventions'), where('date', '==', todayStr)),
      (snap) => {
        setInterventions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Intervention)));
        setIsLoading(false);
      }
    );

    const unsubAppointments = onSnapshot(
      query(collection(db, 'appointments'), where('date', '==', todayStr)),
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      }
    );

    const unsubWorkOrders = onSnapshot(
      query(collection(db, 'workOrders'), where('status', 'in', ['draft', 'ready-to-sign'])),
      (snap) => {
        setWorkOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder)));
      }
    );

    const unsubReminders = onSnapshot(
      query(collection(db, 'reminders'), where('status', '==', 'open'), where('priority', '==', 'urgent')),
      (snap) => {
        setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
      }
    );

    return () => {
      unsubInterventions();
      unsubAppointments();
      unsubWorkOrders();
      unsubReminders();
    };
  }, []);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Onbekend';
  const getCustomerAddress = (id: string) => customers.find(c => c.id === id)?.address || '';
  const getCustomerPhone = (id: string) => customers.find(c => c.id === id)?.phone || '';
  const getMachineInfo = (id: string) => {
    const m = machines.find(mac => mac.id === id);
    return m ? `${m.brand} ${m.model}` : 'Geen machine';
  };

  const handleUpdateStatus = async (task: any, status: InterventionStatus) => {
    try {
      const data: any = { 
        status, 
        updatedAt: new Date().toISOString() 
      };
      
      if (status === 'in-progress' && !task.startedAt) {
        data.startedAt = new Date().toISOString();
      }

      // Add stock processing if completing from this screen
      if (status === 'completed' && !task.stockProcessed && task.partsUsed?.length > 0) {
        for (const part of task.partsUsed) {
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
                interventionId: task.id,
                reason: `Afgerond via Vandaag scherm: Gebruikt voor ${getCustomerName(task.customerId)}`,
                technicianName: task.technicianName || 'Onbekend',
                timestamp: new Date().toISOString()
             });
          }
        }
        data.stockProcessed = true;
      }

      await updateDoc(doc(db, 'interventions', task.id), data);
      await logAction('Status gewijzigd (Vandaag)', 'intervention', task.id, `Status naar: ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `interventions/${task.id}`);
    }
  };

  const getStatusLabelText = (status: string) => {
    switch (status) {
      case 'completed': return 'Afgerond';
      case 'in-progress': return 'Bezig';
      case 'on-route': return 'Onderweg';
      case 'planned': return 'Gepland';
      case 'waiting-parts': return 'Wacht op onderdelen';
      default: return 'Gepland';
    }
  };

  const todayTasks = [
    ...interventions.map(i => ({ ...i, taskType: 'intervention', taskTime: i.time || '00:00' })),
    ...appointments.filter(a => !a.interventionId).map(a => ({ ...a, taskType: 'appointment', taskTime: a.startTime || '00:00' })),
  ].sort((a, b) => a.taskTime.localeCompare(b.taskTime));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vandaag</h1>
          <p className="text-xs font-black text-blue-600 uppercase tracking-widest mt-1">
            {format(new Date(), 'EEEE d MMMM', { locale: nl })}
          </p>
        </div>
        <button 
          onClick={() => navigate('/interventions?new=true')}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Urgent Alerts */}
      {reminders.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">Urgent ({reminders.length})</p>
          {reminders.map(r => (
            <motion.div 
              key={r.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 hover:bg-red-100 transition-colors cursor-pointer"
              onClick={() => navigate('/reminders')}
            >
              <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-red-900 truncate">{r.title}</p>
                <p className="text-xs font-bold text-red-600">{getCustomerName(r.customerId || '')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-red-300" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Main List */}
      <div className="space-y-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Planning</p>
        
        {todayTasks.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Geen taken voor vandaag</p>
          </div>
        ) : (
          todayTasks.map((task: any) => (
            <motion.div 
              key={task.id}
              layout
              className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm space-y-4 group active:bg-slate-50 transition-colors cursor-pointer"
              onClick={() => task.taskType === 'intervention' ? navigate(`/interventions?id=${task.id}`) : null}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                       {task.taskTime}
                     </span>
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${
                       task.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                       task.status === 'in-progress' ? 'bg-blue-600 text-white border-blue-600' :
                       task.status === 'on-route' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                       'bg-slate-50 text-slate-500 border-slate-100'
                     }`}>
                       {getStatusLabelText(task.status || 'planned')}
                     </span>
                   </div>
                   <h3 className="text-lg font-black text-slate-900 leading-tight">
                     {getCustomerName(task.customerId)}
                   </h3>
                   <div className="flex items-center gap-1.5 text-slate-500">
                     <Hammer className="w-3.5 h-3.5" />
                     <span className="text-xs font-bold leading-none">{getMachineInfo(task.machineId)}</span>
                   </div>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${task.status === 'in-progress' ? 'bg-blue-600' : 'bg-slate-100'}`}>
                  <Clock className={`w-6 h-6 ${task.status === 'in-progress' ? 'text-white' : 'text-slate-400'}`} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-3 rounded-2xl">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold truncate">{getCustomerAddress(task.customerId)}</span>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                {task.taskType === 'intervention' && task.status === 'planned' ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(task, 'on-route');
                    }}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                  >
                    <Navigation className="w-4 h-4" /> Onderweg
                  </button>
                ) : task.taskType === 'intervention' && task.status === 'on-route' ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(task, 'in-progress');
                    }}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" /> Starten
                  </button>
                ) : task.taskType === 'intervention' && task.status === 'in-progress' ? (
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/interventions?id=${task.id}`);
                    }}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" /> Afronden
                  </button>
                ) : (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (task.taskType === 'intervention') {
                        navigate(`/interventions?id=${task.id}`);
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Details
                  </button>
                )}
                
                <div className="flex gap-2">
                  <a 
                    href={`tel:${getCustomerPhone(task.customerId)}`} 
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 flex items-center justify-center py-4 rounded-2xl active:scale-95 transition-all ${getCustomerPhone(task.customerId) ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300 pointer-events-none'}`}
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getCustomerAddress(task.customerId))}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 flex items-center justify-center py-4 rounded-2xl active:scale-95 transition-all ${getCustomerAddress(task.customerId) ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-300 pointer-events-none'}`}
                  >
                    <Navigation className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Open Work Orders */}
      {workOrders.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Open Werkbonnen ({workOrders.length})</p>
          <div className="grid grid-cols-1 gap-3">
            {workOrders.map(wo => (
              <div 
                key={wo.id}
                onClick={() => navigate('/work-orders')}
                className="p-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between group active:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{getCustomerName(wo.customerId)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{wo.status}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianToday;
