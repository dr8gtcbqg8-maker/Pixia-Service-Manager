import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Reminder, Customer, Machine, ReminderPriority, ReminderType } from '../types';
import { 
  Bell, Search, Filter, Calendar, AlertCircle, CheckCircle2, Trash2, 
  Clock, Printer, User, Plus, X, Edit3, 
  ChevronRight, Phone, Wrench, ShieldAlert, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';
import AppointmentModal from '../components/AppointmentModal';

const Reminders: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentInitialData, setAppointmentInitialData] = useState<any>({});
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    customerId: '',
    machineId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    priority: 'normal' as ReminderPriority,
    status: 'open' as Reminder['status'],
    type: 'other' as ReminderType,
    internalNotes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rSnap, cSnap, mSnap] = await Promise.all([
        getDocs(query(collection(db, 'reminders'), orderBy('dueDate', 'asc'))),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'machines'))
      ]);
      setReminders(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
      setCustomers(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setMachines(mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedReminder(null);
    setNewReminder({
      title: '',
      description: '',
      customerId: '',
      machineId: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      priority: 'normal',
      status: 'open',
      type: 'other',
      internalNotes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setNewReminder({
      title: reminder.title,
      description: reminder.description,
      customerId: reminder.customerId || '',
      machineId: reminder.machineId || '',
      dueDate: reminder.dueDate,
      priority: reminder.priority,
      status: reminder.status,
      type: reminder.type,
      internalNotes: reminder.internalNotes || ''
    });
    setIsAddModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const reminderData = {
        ...newReminder,
        updatedAt: new Date().toISOString()
      };

      if (selectedReminder) {
        await updateDoc(doc(db, 'reminders', selectedReminder.id), reminderData);
      } else {
        await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          createdAt: new Date().toISOString()
        });
      }
      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, selectedReminder ? OperationType.UPDATE : OperationType.CREATE, 'reminders');
    }
  };

  const handleQuickStatusUpdate = async (id: string, status: Reminder['status']) => {
    try {
      await updateDoc(doc(db, 'reminders', id), { status, updatedAt: new Date().toISOString() });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reminders/${id}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'reminders', deleteConfirm.id));
      setDeleteConfirm({ isOpen: false, id: null });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reminders/${deleteConfirm.id}`);
    }
  };

  const getCustomerName = (id?: string) => customers.find(c => c.id === id)?.name || 'Geen klant';
  const getMachineInfo = (id?: string) => {
    const m = machines.find(mac => mac.id === id);
    return m ? `${m.brand} ${m.model}` : 'Geen machine';
  };

  const filteredReminders = reminders.filter(r => {
    const matchesSearch = 
      (r.title || '').toLowerCase().includes(search.toLowerCase()) || 
      (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
      getCustomerName(r.customerId).toLowerCase().includes(search.toLowerCase());
    
    const matchesType = !filterType || r.type === filterType;
    const matchesStatus = !filterStatus || r.status === filterStatus;
    const matchesPriority = !filterPriority || r.priority === filterPriority;

    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority: ReminderPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-amber-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-slate-400 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getTypeIcon = (type: ReminderType) => {
    switch (type) {
      case 'maintenance': return <Wrench className="w-4 h-4" />;
      case 'warranty': return <ShieldAlert className="w-4 h-4" />;
      case 'contract': return <ShieldAlert className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'follow-up': return <ChevronRight className="w-4 h-4" />;
      case 'stock': return <Package className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Meldingen & Herinneringen</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Beheer service deadlines en vervolgacties</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nieuwe Herinnering
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 md:flex-[2]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Zoek in herinneringen..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 md:flex-[3]">
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value)}
             >
               <option value="">Alle Types</option>
               <option value="maintenance">Onderhoud</option>
               <option value="warranty">Garantie</option>
               <option value="call">Bellen</option>
               <option value="follow-up">Follow-up</option>
               <option value="stock">Voorraad</option>
             </select>
             <select 
               className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
               value={filterStatus}
               onChange={(e) => setFilterStatus(e.target.value)}
             >
               <option value="">Alle Status</option>
               <option value="open">Open</option>
               <option value="planned">Gepland</option>
               <option value="executed">Voltooid</option>
               <option value="ignored">Genegeerd</option>
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
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : filteredReminders.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredReminders.map((reminder) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={reminder.id}
                className={`bg-white rounded-3xl border ${reminder.status === 'executed' ? 'opacity-60 bg-slate-50 border-slate-100' : 'border-slate-200'} shadow-sm hover:shadow-lg transition-all p-6 group`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${getPriorityColor(reminder.priority)} shadow-lg`}>
                       {getTypeIcon(reminder.type)}
                    </div>
                    <div>
                       <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase">{reminder.type}</span>
                       <h3 className={`text-sm font-black line-clamp-1 ${reminder.status === 'executed' ? 'line-through text-slate-500' : 'text-slate-900'}`}>{reminder.title}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenEditModal(reminder)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <Edit3 className="w-4 h-4" />
                     </button>
                     <button onClick={() => setDeleteConfirm({ isOpen: true, id: reminder.id })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium line-clamp-2 min-h-[32px] mb-6">
                  {reminder.description}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate">{getCustomerName(reminder.customerId)}</span>
                  </div>
                  {reminder.machineId && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <Printer className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate">{getMachineInfo(reminder.machineId)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${new Date(reminder.dueDate) < new Date() && reminder.status === 'open' ? 'text-red-500' : ''}`}>
                      {reminder.dueDate}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {reminder.status === 'open' && (
                      <button 
                        onClick={() => {
                          setAppointmentInitialData({
                            date: reminder.dueDate,
                            reminderId: reminder.id,
                            customerId: reminder.customerId,
                            machineId: reminder.machineId,
                            title: reminder.title
                          });
                          setIsAppointmentModalOpen(true);
                        }}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm shadow-blue-100"
                        title="Plan Afspraak"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    )}
                    {reminder.status === 'open' && (
                      <button 
                        onClick={() => handleQuickStatusUpdate(reminder.id, 'executed')}
                        className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm shadow-green-100"
                        title="Voltooien"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {reminder.status === 'executed' && (
                      <button 
                         onClick={() => handleQuickStatusUpdate(reminder.id, 'open')}
                         className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                         title="Heropenen"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white p-24 rounded-3xl border border-slate-200 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
            <Bell className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Geen herinneringen gevonden</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Pas uw filters aan of plan een nieuwe taak in.</p>
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
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-100 pb-6 flex items-center gap-3">
                <Bell className="w-6 h-6 text-blue-600" />
                {selectedReminder ? 'Herinnering Bewerken' : 'Nieuwe Herinnering'}
              </h2>
              <form onSubmit={handleSaveReminder} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Titel *</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="bijv. Klant bellen voor afspraak"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({...newReminder, title: e.target.value})}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Omschrijving</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({...newReminder, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Klant</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminder.customerId}
                      onChange={(e) => setNewReminder({...newReminder, customerId: e.target.value})}
                    >
                      <option value="">Koppel aan klant...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Machine</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminder.machineId}
                      onChange={(e) => setNewReminder({...newReminder, machineId: e.target.value})}
                    >
                      <option value="">Koppel aan machine...</option>
                      {machines.filter(m => !newReminder.customerId || m.customerId === newReminder.customerId).map(m => (
                        <option key={m.id} value={m.id}>{m.brand} {m.model} ({m.serialNumber})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Datum</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={newReminder.dueDate}
                      onChange={(e) => setNewReminder({...newReminder, dueDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prioriteit</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminder.priority}
                      onChange={(e) => setNewReminder({...newReminder, priority: e.target.value as ReminderPriority})}
                    >
                      <option value="low">Laag</option>
                      <option value="normal">Normaal</option>
                      <option value="high">Hoog</option>
                      <option value="urgent">Urgent / Nu</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type Herinnering</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminder.type}
                      onChange={(e) => setNewReminder({...newReminder, type: e.target.value as ReminderType})}
                    >
                      <option value="maintenance">Onderhoud</option>
                      <option value="warranty">Garantie</option>
                      <option value="contract">Onderhoudscontract</option>
                      <option value="call">Afspraak / Tel.</option>
                      <option value="follow-up">Follow-up</option>
                      <option value="stock">Voorraad</option>
                      <option value="other">Overig</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminder.status}
                      onChange={(e) => setNewReminder({...newReminder, status: e.target.value as Reminder['status']})}
                    >
                      <option value="open">Open</option>
                      <option value="planned">Ingepland</option>
                      <option value="executed">Voltooid</option>
                      <option value="ignored">Genegeerd</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-8 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 text-slate-600 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    {selectedReminder ? 'Opslaan' : 'Toevoegen'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Herinnering Verwijderen"
        message="Weet u zeker dat u deze herinnering wilt verwijderen?"
        onConfirm={confirmDelete}
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
        reminders={reminders}
        interventions={[]}
      />
    </div>
  );
};

export default Reminders;
