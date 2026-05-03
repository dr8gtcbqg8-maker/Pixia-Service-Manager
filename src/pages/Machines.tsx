import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Machine, Customer, MachineStatus, MaintenanceInterval, MachineType, ReminderPriority, ReminderType, Intervention, InterventionStatus, InterventionType, WorkOrder } from '../types';
import { 
  Plus, Search, Printer, Tag, Hash, Calendar, MoreVertical, MapPin, 
  Settings, Edit3, Trash2, Wrench, User, Filter, X, 
  History, FileText, Camera, Bell, Info, ShieldCheck, CreditCard, ChevronRight,
  QrCode, Share2, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DocumentSection from '../components/DocumentSection';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, calculateNextMaintenanceDate } from '../lib/utils';
import { logAction } from '../lib/audit';
import ConfirmDialog from '../components/ConfirmDialog';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const Machines: React.FC = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInstallDate, setFilterInstallDate] = useState('');
  const [filterWarrantyDate, setFilterWarrantyDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedTab, setSelectedTab] = useState('dossier');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  
  // Reminder Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<{ machineId: string; customerId: string } | null>(null);
  const [newReminderData, setNewReminderData] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    priority: 'normal' as ReminderPriority,
    type: 'maintenance' as ReminderType
  });

  const [newMachine, setNewMachine] = useState({
    customerId: '',
    type: 'printer' as MachineType,
    brand: '',
    model: '',
    serialNumber: '',
    saleDate: '',
    installDate: '',
    warrantyPeriodMonths: 12,
    warrantyEndDate: '',
    hasServiceContract: false,
    maintenanceInterval: 'annual' as MaintenanceInterval,
    firstMaintenanceMonths: 6,
    autoScheduleEnabled: true,
    lastMaintenanceDate: '',
    nextMaintenanceDate: '',
    location: '',
    status: 'active' as MachineStatus,
    notes: '',
    internalNotes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mSnap, cSnap] = await Promise.all([
        getDocs(query(collection(db, 'machines'), orderBy('brand', 'asc'))),
        getDocs(collection(db, 'customers'))
      ]);
      setMachines(mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
      setCustomers(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'machines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isAddModalOpen) {
      const nextDate = calculateNextMaintenanceDate({
        installDate: newMachine.installDate,
        lastMaintenanceDate: newMachine.lastMaintenanceDate,
        maintenanceInterval: newMachine.maintenanceInterval,
        firstMaintenanceMonths: newMachine.firstMaintenanceMonths
      });
      if (nextDate && nextDate !== newMachine.nextMaintenanceDate) {
        setNewMachine(prev => ({ ...prev, nextMaintenanceDate: nextDate }));
      }
    }
  }, [newMachine.installDate, newMachine.lastMaintenanceDate, newMachine.maintenanceInterval, newMachine.firstMaintenanceMonths, isAddModalOpen]);

  const handleOpenAddModal = () => {
    setSelectedMachine(null);
    setNewMachine({
      customerId: '',
      type: 'printer',
      brand: '',
      model: '',
      serialNumber: '',
      saleDate: '',
      installDate: '',
      warrantyPeriodMonths: 12,
      warrantyEndDate: '',
      hasServiceContract: false,
      maintenanceInterval: 'annual',
      firstMaintenanceMonths: 6,
      autoScheduleEnabled: true,
      lastMaintenanceDate: '',
      nextMaintenanceDate: '',
      location: '',
      status: 'active',
      notes: '',
      internalNotes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (machine: Machine) => {
    setSelectedMachine(machine);
    setNewMachine({
      customerId: machine.customerId,
      type: machine.type || 'printer',
      brand: machine.brand,
      model: machine.model,
      serialNumber: machine.serialNumber,
      saleDate: machine.saleDate || '',
      installDate: machine.installDate || '',
      warrantyPeriodMonths: machine.warrantyPeriodMonths || 12,
      warrantyEndDate: machine.warrantyEndDate || '',
      hasServiceContract: machine.hasServiceContract,
      maintenanceInterval: machine.maintenanceInterval,
      firstMaintenanceMonths: machine.firstMaintenanceMonths || 6,
      autoScheduleEnabled: machine.autoScheduleEnabled !== undefined ? machine.autoScheduleEnabled : true,
      lastMaintenanceDate: machine.lastMaintenanceDate || '',
      nextMaintenanceDate: machine.nextMaintenanceDate || '',
      location: machine.location || '',
      status: machine.status,
      notes: machine.notes || '',
      internalNotes: machine.internalNotes || ''
    });
    setIsAddModalOpen(true);
  };

  const [machineInterventions, setMachineInterventions] = useState<Intervention[]>([]);
  const [machineWorkOrders, setMachineWorkOrders] = useState<WorkOrder[]>([]);

  const handleOpenDetails = async (machine: Machine) => {
    setSelectedMachine(machine);
    setSelectedTab('dossier');
    try {
      const q = query(collection(db, 'interventions'), where('machineId', '==', machine.id), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setMachineInterventions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));

      const wq = query(collection(db, 'work_orders'), where('machineId', '==', machine.id), orderBy('createdAt', 'desc'));
      const wSnap = await getDocs(wq);
      setMachineWorkOrders(wSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'related-data');
    }
    setIsDetailsModalOpen(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let machineId = selectedMachine?.id;
      
      const machineData = {
        ...newMachine,
        updatedAt: new Date().toISOString()
      };

      if (selectedMachine) {
        const docRef = doc(db, 'machines', selectedMachine.id);
        await updateDoc(docRef, machineData);
        await logAction('Machine aangepast', 'machine', selectedMachine.id, `Model: ${machineData.brand} ${machineData.model}`);
      } else {
        const docRef = await addDoc(collection(db, 'machines'), {
          ...machineData,
          createdAt: new Date().toISOString(),
        });
        machineId = docRef.id;
        await logAction('Machine aangemaakt', 'machine', machineId, `Model: ${machineData.brand} ${machineData.model}`);
      }

      // Automatically plan preventive maintenance reminder if autoScheduleEnabled is true and nextMaintenanceDate changed
      if (newMachine.autoScheduleEnabled && newMachine.nextMaintenanceDate) {
        const dateChanged = !selectedMachine || newMachine.nextMaintenanceDate !== selectedMachine.nextMaintenanceDate;
        
        if (dateChanged) {
          // Check for existing open reminders for this machine of type maintenance
          const reminderQuery = query(
            collection(db, 'reminders'), 
            where('machineId', '==', machineId),
            where('type', '==', 'maintenance'),
            where('status', '==', 'open')
          );
          const rSnap = await getDocs(reminderQuery);
          
          if (rSnap.empty) {
            // Create new reminder
            await addDoc(collection(db, 'reminders'), {
              title: `Autom. Onderhoud: ${newMachine.brand} ${newMachine.model}`,
              description: `Gepland periodiek onderhoud voor machine met serienummer ${newMachine.serialNumber}`,
              customerId: newMachine.customerId,
              machineId: machineId,
              dueDate: newMachine.nextMaintenanceDate,
              priority: 'normal',
              status: 'open',
              type: 'maintenance',
              createdAt: new Date().toISOString()
            });
          } else {
            // Update the existing open reminder
            const existingReminderId = rSnap.docs[0].id;
            await updateDoc(doc(db, 'reminders', existingReminderId), {
              dueDate: newMachine.nextMaintenanceDate,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, selectedMachine ? OperationType.UPDATE : OperationType.CREATE, `machines/${selectedMachine?.id || 'new'}`);
    }
  };

  const handleOpenReminderModal = (machine: Machine) => {
    setReminderTarget({ machineId: machine.id, customerId: machine.customerId });
    setNewReminderData({
      title: `Onderhoud ${machine.brand} ${machine.model}`,
      description: `Ingepland onderhoud voor machine ${machine.serialNumber}`,
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      priority: 'normal',
      type: 'maintenance'
    });
    setIsReminderModalOpen(true);
  };

  const handleSaveManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTarget) return;

    try {
      await addDoc(collection(db, 'reminders'), {
        ...newReminderData,
        machineId: reminderTarget.machineId,
        customerId: reminderTarget.customerId,
        status: 'open',
        createdAt: new Date().toISOString()
      });
      setIsReminderModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reminders');
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'machines', deleteConfirm.id));
      await logAction('Machine verwijderd', 'machine', deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `machines/${deleteConfirm.id}`);
    }
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Onbekende klant';

  const filteredMachines = machines.filter(m => {
    const matchesSearch = 
      m.brand.toLowerCase().includes(search.toLowerCase()) || 
      m.model.toLowerCase().includes(search.toLowerCase()) || 
      m.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      getCustomerName(m.customerId).toLowerCase().includes(search.toLowerCase());
    
    const matchesCustomer = !filterCustomer || m.customerId === filterCustomer;
    const matchesType = !filterType || m.type === filterType;
    const matchesStatus = !filterStatus || m.status === filterStatus;
    const matchesInstallDate = !filterInstallDate || m.installDate === filterInstallDate;
    const matchesWarrantyDate = !filterWarrantyDate || m.warrantyEndDate === filterWarrantyDate;

    return matchesSearch && matchesCustomer && matchesType && matchesStatus && matchesInstallDate && matchesWarrantyDate;
  });

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-100';
      case 'maintenance-needed': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'faulty': return 'bg-red-50 text-red-700 border-red-100';
      case 'out-of-service': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'replaced': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Machinepark</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Beheer en monitor uw vloot van printers en laminatoren</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nieuwe Machine
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
         <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Zoek op merk, model, serienummer of klant..." 
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border text-sm font-bold transition-all ${
                showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filterCustomer || filterType || filterStatus) && (
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-black">!</span>
              )}
            </button>
         </div>

         <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Klant</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterCustomer}
                      onChange={(e) => setFilterCustomer(e.target.value)}
                    >
                      <option value="">Alle Klanten</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <option value="">Alle Types</option>
                      <option value="printer">Printer</option>
                      <option value="laminator">Laminator</option>
                      <option value="other">Anders</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="">Alle Status</option>
                      <option value="active">Actief</option>
                      <option value="maintenance-needed">Onderhoud nodig</option>
                      <option value="faulty">Storing</option>
                      <option value="out-of-service">Buiten gebruik</option>
                      <option value="replaced">Vervangen</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Instal. Datum</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterInstallDate}
                      onChange={(e) => setFilterInstallDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Garantie Eind</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterWarrantyDate}
                      onChange={(e) => setFilterWarrantyDate(e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
         </AnimatePresence>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : filteredMachines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMachines.map((machine) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={machine.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group overflow-hidden"
            >
              <div className="p-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">#{machine.id.slice(0, 6)}</span>
                 <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenEditModal(machine)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(machine.id, e)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>

              <div className="p-8">
                <div className="flex items-start gap-6 mb-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                    <Printer className="w-8 h-8" />
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border mb-2 ${getStatusColor(machine.status)}`}>
                      {machine.status}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {machine.brand}
                      <span className="block text-slate-500 font-medium text-sm">{machine.model}</span>
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Klant</span>
                     <span className="text-xs font-black text-blue-600">{getCustomerName(machine.customerId)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                       <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Serienummer</span>
                       <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{machine.serialNumber}</span>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                       <span className="block text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Volgend Onderhoud
                       </span>
                       <span className="text-sm font-black text-amber-700">{machine.nextMaintenanceDate || 'Niet gepland'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-8">
                  <button 
                    onClick={() => handleOpenDetails(machine)}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-700 transition-all shadow-xl shadow-slate-100 hover:shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
                  >
                    Dossier
                    <Plus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/interventions?machine=${machine.id}&customer=${machine.customerId}`;
                    }}
                    className="p-3 bg-blue-600 text-white border border-blue-500 rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                    title="Nieuwe Interventie"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleOpenReminderModal(machine)}
                    className="p-3 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                    title="Plan taak"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-24 rounded-3xl border border-slate-200 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
            <Printer className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Geen machines gevonden</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Pas uw zoekopdracht of filters aan, of voeg een nieuwe machine toe.</p>
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
              className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-black text-slate-900 mb-8 border-b border-slate-100 pb-6">
                {selectedMachine ? 'Machine Bewerken' : 'Nieuwe Machine Registreren'}
              </h2>
              <form onSubmit={handleSaveMachine} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Klant *</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newMachine.customerId}
                        onChange={(e) => setNewMachine({...newMachine, customerId: e.target.value})}
                      >
                        <option value="">Selecteer een klant...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type *</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={newMachine.type}
                          onChange={(e) => setNewMachine({...newMachine, type: e.target.value as MachineType})}
                        >
                          <option value="printer">Printer</option>
                          <option value="laminator">Laminator</option>
                          <option value="other">Overig</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={newMachine.status}
                          onChange={(e) => setNewMachine({...newMachine, status: e.target.value as MachineStatus})}
                        >
                          <option value="active">Actief</option>
                          <option value="maintenance-needed">Onderhoud nodig</option>
                          <option value="faulty">Storing</option>
                          <option value="out-of-service">Buiten gebruik</option>
                          <option value="replaced">Vervangen</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Merk *</label>
                        <input 
                          required 
                          type="text" 
                          placeholder="bijv. HP, Roland"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.brand}
                          onChange={(e) => setNewMachine({...newMachine, brand: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Model *</label>
                        <input 
                          required 
                          type="text" 
                          placeholder="bijv. Latex 360"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.model}
                          onChange={(e) => setNewMachine({...newMachine, model: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Serienummer *</label>
                      <input 
                        required 
                        type="text" 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                        value={newMachine.serialNumber}
                        onChange={(e) => setNewMachine({...newMachine, serialNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verkoopdatum</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.saleDate}
                          onChange={(e) => setNewMachine({...newMachine, saleDate: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Installatiedatum</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.installDate}
                          onChange={(e) => setNewMachine({...newMachine, installDate: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Garantie (mnd)</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.warrantyPeriodMonths}
                          onChange={(e) => setNewMachine({...newMachine, warrantyPeriodMonths: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Einddatum Garantie</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={newMachine.warrantyEndDate}
                          onChange={(e) => setNewMachine({...newMachine, warrantyEndDate: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                             <input 
                               type="checkbox" 
                               id="contract"
                               className="w-6 h-6 text-blue-600 border-slate-300 rounded-lg outline-none focus:ring-0"
                               checked={newMachine.hasServiceContract}
                               onChange={(e) => setNewMachine({...newMachine, hasServiceContract: e.target.checked})}
                             />
                             <label htmlFor="contract" className="text-xs font-black text-blue-700 uppercase tracking-widest cursor-pointer select-none">Servicecontract</label>
                          </div>
                          <div className="flex items-center gap-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                             <input 
                               type="checkbox" 
                               id="autoSchedule"
                               className="w-6 h-6 text-amber-600 border-slate-300 rounded-lg outline-none focus:ring-0"
                               checked={newMachine.autoScheduleEnabled}
                               onChange={(e) => setNewMachine({...newMachine, autoScheduleEnabled: e.target.checked})}
                             />
                             <label htmlFor="autoSchedule" className="text-xs font-black text-amber-700 uppercase tracking-widest cursor-pointer select-none">Autom. Planning</label>
                          </div>
                       </div>
 
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            Onderhouds Interval
                          </label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newMachine.maintenanceInterval}
                            onChange={(e) => setNewMachine({...newMachine, maintenanceInterval: e.target.value as MaintenanceInterval})}
                          >
                            <option value="annual">Jaarlijks</option>
                            <option value="half-yearly">Halfjaarlijks (2x)</option>
                            <option value="quarterly">Kwartaal (4x)</option>
                            <option value="monthly">Maandelijks</option>
                            <option value="manual">Handmatig</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">1e Interval (mnd)</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={newMachine.firstMaintenanceMonths}
                            onChange={(e) => setNewMachine({...newMachine, firstMaintenanceMonths: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Laatste Beurt</label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={newMachine.lastMaintenanceDate}
                            onChange={(e) => setNewMachine({...newMachine, lastMaintenanceDate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center justify-between">
                              <span>Volgend Onderhoud</span>
                              {newMachine.autoScheduleEnabled && (
                                <span className="text-[8px] text-blue-500 animate-pulse">AUTOCALC</span>
                              )}
                           </label>
                           <input 
                             type="date" 
                             className={`w-full px-4 py-3 border rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${newMachine.autoScheduleEnabled ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200'}`}
                             value={newMachine.nextMaintenanceDate}
                             onChange={(e) => setNewMachine({...newMachine, nextMaintenanceDate: e.target.value})}
                           />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Specifieke Locatie bij Klant</label>
                        <div className="relative">
                           <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input 
                            type="text" 
                            placeholder="bijv. Productiehal 1, 2e verdieping"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={newMachine.location}
                            onChange={(e) => setNewMachine({...newMachine, location: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Klantnotities (Zichtbaar voor klant)</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                          value={newMachine.notes}
                          onChange={(e) => setNewMachine({...newMachine, notes: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Interne Notities (Alleen voor personeel)</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                          value={newMachine.internalNotes}
                          onChange={(e) => setNewMachine({...newMachine, internalNotes: e.target.value})}
                        />
                      </div>
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
                    {selectedMachine ? 'Wijzigingen Opslaan' : 'Machine Toevoegen'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Machine Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedMachine && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsDetailsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
                    <Printer className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">
                      {selectedMachine.brand} {selectedMachine.model}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SN: {selectedMachine.serialNumber}</span>
                       <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(selectedMachine.status)}`}>
                         {selectedMachine.status}
                       </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-900 hover:bg-white p-3 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Fixed Info Column */}
                <div className="w-80 bg-slate-50/50 border-r border-slate-100 p-8 space-y-8 hidden lg:block overflow-y-auto">
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Eigenaar</h3>
                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                         <p className="text-sm font-black text-blue-600 leading-tight mb-2">{getCustomerName(selectedMachine.customerId)}</p>
                         <div className="flex items-start gap-2 text-[10px] text-slate-400 font-bold leading-relaxed italic">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            {selectedMachine.location || 'Geen specifieke locatie.'}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Garantie Status</h3>
                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                         <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-xs font-black text-slate-900 italic">Eindigt op:</p>
                            <p className="text-[11px] font-bold text-slate-500">{selectedMachine.warrantyEndDate || 'Geen datum gezet'}</p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Onderhoudsplan</h3>
                      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                         <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400">Interval</span>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{selectedMachine.maintenanceInterval}</span>
                         </div>
                         <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400">Contract</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${selectedMachine.hasServiceContract ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                               {selectedMachine.hasServiceContract ? 'Actief' : 'Geen'}
                            </span>
                         </div>
                         <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Volgende check:</div>
                         <p className="text-sm font-black text-slate-900 font-mono">{selectedMachine.nextMaintenanceDate || 'N/A'}</p>
                      </div>
                   </div>
                </div>

                {/* Main Content Area with Tabs */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="px-8 border-b border-slate-100 bg-white flex items-center gap-8 overflow-x-auto scrollbar-hide shrink-0">
                     {[
                       { id: 'dossier', label: 'Dossier', icon: Info },
                       { id: 'historie', label: 'Historie', icon: History },
                       { id: 'werkbonnen', label: 'Werkbonnen', icon: FileText },
                       { id: 'media', label: 'Media & Docs', icon: Camera },
                       { id: 'reminders', label: 'Besluiten', icon: Bell },
                     ].map((tab) => (
                       <button
                         key={tab.id}
                         onClick={() => setSelectedTab(tab.id)}
                         className={`py-6 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                           selectedTab === tab.id 
                           ? 'border-blue-600 text-blue-600' 
                           : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                         }`}
                       >
                         <tab.icon className="w-3.5 h-3.5" />
                         {tab.label}
                       </button>
                     ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 bg-white">
                     <AnimatePresence mode="wait">
                        {selectedTab === 'dossier' && (
                           <motion.div
                             key="dossier" 
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: -10 }}
                             className="space-y-10"
                           >
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                  <div className="space-y-10">
                                     <div className="space-y-6">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verkoop informatie</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                           <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verkoopdatum</span>
                                              <span className="text-xs font-black text-slate-900">{selectedMachine.saleDate || 'Onbekend'}</span>
                                           </div>
                                           <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Installatiedatum</span>
                                              <span className="text-xs font-black text-slate-900">{selectedMachine.installDate || 'Onbekend'}</span>
                                           </div>
                                        </div>
                                     </div>

                                     <div className="space-y-6">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">QR Code Toegang</h4>
                                        <div className="p-8 bg-white border-4 border-slate-900 rounded-[3rem] flex flex-col items-center justify-center gap-6 shadow-2xl relative overflow-hidden group">
                                           <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                                           <div className="p-4 bg-slate-50 rounded-3xl group-hover:scale-105 transition-transform duration-500">
                                              <QRCodeSVG 
                                                id="machine-qr"
                                                value={`${window.location.origin}/machines?id=${selectedMachine.id}`} 
                                                size={160}
                                                level="H"
                                                includeMargin={true}
                                              />
                                           </div>
                                           <div className="text-center">
                                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{selectedMachine.brand} {selectedMachine.model}</p>
                                              <p className="text-[8px] font-bold text-slate-400 mt-1">{selectedMachine.serialNumber}</p>
                                           </div>
                                           <div className="flex items-center gap-2 w-full mt-2">
                                              <button 
                                                onClick={() => {
                                                  const svg = document.getElementById('machine-qr');
                                                  if (svg) {
                                                    const svgData = new XMLSerializer().serializeToString(svg);
                                                    const canvas = document.createElement("canvas");
                                                    const ctx = canvas.getContext("2d");
                                                    const img = new Image();
                                                    img.onload = () => {
                                                      canvas.width = img.width;
                                                      canvas.height = img.height;
                                                      ctx?.drawImage(img, 0, 0);
                                                      const pngFile = canvas.toDataURL("image/png");
                                                      const downloadLink = document.createElement("a");
                                                      downloadLink.download = `QR_${selectedMachine.serialNumber}.png`;
                                                      downloadLink.href = pngFile;
                                                      downloadLink.click();
                                                    };
                                                    img.src = "data:image/svg+xml;base64," + btoa(svgData);
                                                  }
                                                }}
                                                className="flex-1 py-3 bg-slate-50 text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                                              >
                                                 <Download className="w-3.5 h-3.5" />
                                                 Download
                                              </button>
                                              <button 
                                                onClick={() => {
                                                  const printWindow = window.open('', '_blank');
                                                  const svg = document.getElementById('machine-qr');
                                                  if (printWindow && svg) {
                                                    printWindow.document.write('<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">');
                                                    printWindow.document.write(`<h1>${selectedMachine.brand} ${selectedMachine.model}</h1>`);
                                                    printWindow.document.write(`<h2>SN: ${selectedMachine.serialNumber}</h2>`);
                                                    printWindow.document.write(svg.outerHTML);
                                                    printWindow.document.write('</body></html>');
                                                    printWindow.document.close();
                                                    printWindow.print();
                                                  }
                                                }}
                                                className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                                              >
                                                 <Printer className="w-3.5 h-3.5" />
                                                 Print
                                              </button>
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="space-y-6">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notities & Details</h4>
                                     <div className="space-y-4">
                                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl min-h-[80px]">
                                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 italic">Klantnotities</p>
                                           <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                              {selectedMachine.notes || 'Geen klantnotities.'}
                                           </p>
                                        </div>
                                        {selectedMachine.internalNotes && (
                                           <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-3xl min-h-[80px]">
                                              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2 italic">Interne Notities</p>
                                              <p className="text-xs font-medium text-amber-900 leading-relaxed italic">
                                                 {selectedMachine.internalNotes}
                                              </p>
                                           </div>
                                        )}
                                     </div>
                                  </div>
                               </div>

                              <div className="space-y-6">
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Systeem Status</h4>
                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-1 flex flex-col items-center text-center">
                                       <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-1">
                                          <ShieldCheck className="w-4 h-4" />
                                       </div>
                                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gezondheid</span>
                                       <span className="text-[10px] font-black text-slate-900 uppercase">{selectedMachine.status === 'active' ? 'Optimaal' : 'Check'}</span>
                                    </div>
                                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-1 flex flex-col items-center text-center">
                                       <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                                          <CreditCard className="w-4 h-4" />
                                       </div>
                                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contract</span>
                                       <span className="text-[10px] font-black text-slate-900 uppercase">{selectedMachine.hasServiceContract ? 'Gevuld' : 'nvt'}</span>
                                    </div>
                                    {/* Additional mini stats */}
                                 </div>
                              </div>
                           </motion.div>
                        )}

                        {selectedTab === 'historie' && (
                           <motion.div
                             key="historie"
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: -10 }}
                             className="space-y-6"
                           >
                              <div className="flex items-center justify-between mb-6">
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interventie Historie</h4>
                                 <button 
                                  onClick={() => {
                                    window.location.href = `/interventions?machine=${selectedMachine.id}`;
                                  }}
                                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Nieuw Rapport</button>
                              </div>
                              
                              {machineInterventions.length > 0 ? (
                                 <div className="space-y-4">
                                   {machineInterventions.map(int => (
                                     <div key={int.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl flex flex-col gap-4 hover:bg-white transition-all shadow-sm group relative overflow-hidden">
                                        <div className="flex items-start gap-6">
                                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                             int.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : 
                                             int.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                             'bg-amber-50 text-amber-600 border-amber-100'
                                           }`}>
                                              <Wrench className="w-5 h-5" />
                                           </div>
                                           <div className="flex-1">
                                              <div className="flex items-center justify-between mb-1">
                                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{int.date}</span>
                                                 <div className="flex items-center gap-2">
                                                    {machineWorkOrders.some(wo => wo.interventionId === int.id) && (
                                                       <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">Werkbon</span>
                                                    )}
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                                      int.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                                      int.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                      'bg-amber-100 text-amber-800'
                                                    }`}>{int.status}</span>
                                                 </div>
                                              </div>
                                              <h5 className="text-sm font-black text-slate-900 mb-1 capitalize">{int.type}</h5>
                                              <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2group-hover:line-clamp-none">{int.problemDescription}</p>
                                           </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                                           <div className="space-y-1">
                                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Technicus</span>
                                              <span className="text-[10px] font-bold text-slate-700">{int.technicianName || 'N/A'}</span>
                                           </div>
                                           <div className="space-y-1">
                                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Uren / KM</span>
                                              <span className="text-[10px] font-bold text-slate-700">{int.hoursWorked}u / {int.travelTime}km</span>
                                           </div>
                                           {int.nextMaintenanceDate && (
                                             <div className="space-y-1">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Volgende Onderhoud</span>
                                                <span className="text-[10px] font-bold text-blue-600">{int.nextMaintenanceDate}</span>
                                             </div>
                                           )}
                                           <div className="space-y-1">
                                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Prioriteit</span>
                                              <span className="text-[10px] font-bold text-slate-700 capitalize">{int.priority || 'Normaal'}</span>
                                           </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 mt-2 flex items-center justify-between">
                                           <p className="text-[10px] text-slate-500 font-medium italic">
                                              <span className="font-black uppercase tracking-widest text-slate-400 mr-2">Werkzaamheden:</span>
                                              {int.workPerformed || 'Geen details opgegeven.'}
                                           </p>
                                           {machineWorkOrders.find(wo => wo.interventionId === int.id) ? (
                                              <button 
                                                onClick={() => window.location.href = `/work-orders?search=${machineWorkOrders.find(wo => wo.interventionId === int.id)?.orderNumber}`}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                                              >
                                                 Bekijk Werkbon
                                              </button>
                                           ) : (
                                              <button 
                                                onClick={() => window.location.href = `/work-orders?interventionId=${int.id}`}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                                              >
                                                 Maak Werkbon
                                              </button>
                                           )}
                                        </div>
                                     </div>
                                   ))}
                                 </div>
                              ) : (
                                <div className="p-16 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 font-black">?</div>
                                   <p className="text-sm font-black text-slate-900 mb-1">Geen historie gevonden</p>
                                   <p className="text-xs text-slate-500 font-medium">Er zijn nog geen geregistreerde activiteiten voor deze machine.</p>
                                </div>
                              )}
                           </motion.div>
                        )}

                        {selectedTab === 'media' && (
                           <motion.div
                             key="media"
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, x: -20 }}
                             className="space-y-8"
                           >
                              <DocumentSection machineId={selectedMachine.id} />
                           </motion.div>
                        )}

                        {selectedTab === 'werkbonnen' && (
                           <motion.div
                              key="werkbonnen"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6"
                           >
                               <div className="flex items-center justify-between mb-4">
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Werkbonnen Historie</h4>
                               </div>
                               {machineWorkOrders.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {machineWorkOrders.map(wo => (
                                     <div 
                                       key={wo.id} 
                                       onClick={() => window.location.href = `/work-orders?search=${wo.orderNumber}`}
                                       className="p-5 bg-slate-50 border border-slate-100 rounded-3xl shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group cursor-pointer"
                                     >
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                         wo.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                       }`}>
                                         <FileText className="w-5 h-5" />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                         <div className="flex items-center justify-between mb-1">
                                           <span className="text-[9px] font-black text-slate-400 font-mono tracking-widest">{wo.orderNumber}</span>
                                           <span className="text-[9px] font-bold text-slate-400">{wo.date}</span>
                                         </div>
                                         <h5 className="text-xs font-black text-slate-900 truncate">
                                           {wo.type}
                                         </h5>
                                         <div className="flex items-center gap-1.5 mt-1">
                                           <div className={`w-1.5 h-1.5 rounded-full ${wo.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{wo.status}</span>
                                         </div>
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               ) : (
                                 <div className="p-16 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                   <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                   <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Geen werkbonnen</p>
                                   <p className="text-[10px] text-slate-500 font-medium italic">Er zijn nog geen werkbonnen voor deze machine.</p>
                                 </div>
                               )}
                           </motion.div>
                        )}

                        {selectedTab === 'reminders' && (
                           <motion.div
                              key="reminders"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6"
                           >
                              <div className="flex items-center justify-between mb-4">
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Besluiten & Herinneringen</h4>
                                 <button 
                                   onClick={() => handleOpenReminderModal(selectedMachine)}
                                   className="text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Nieuwe Taak</button>
                              </div>
                              
                              <div className="p-16 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                 <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                 <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Geen actieve taken</p>
                                 <p className="text-[10px] text-slate-500 font-medium italic">Alle geplande acties voor dit toestel verschijnen hier.</p>
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-4 text-white text-[10px] font-black uppercase tracking-widest opacity-50 ml-4 hidden sm:flex">
                    <User className="w-3.5 h-3.5" />
                    Bewerkt door: Systeem
                 </div>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => handleOpenEditModal(selectedMachine)}
                      className="px-8 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition-all"
                    >
                      Bewerken
                    </button>
                    <button 
                      onClick={() => setIsDetailsModalOpen(false)}
                      className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                    >
                      Sluiten
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Machine Verwijderen"
        message="Weet u zeker dat u deze machine permanent wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      {/* Manual Reminder Modal */}
      <AnimatePresence>
        {isReminderModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsReminderModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-100 pb-6 flex items-center gap-3">
                <Bell className="w-6 h-6 text-blue-600" />
                Taak / Herinnering Inplannen
              </h2>
              <form onSubmit={handleSaveManualReminder} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Titel *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newReminderData.title}
                    onChange={(e) => setNewReminderData({...newReminderData, title: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Omschrijving</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                    value={newReminderData.description}
                    onChange={(e) => setNewReminderData({...newReminderData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Datum</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={newReminderData.dueDate}
                      onChange={(e) => setNewReminderData({...newReminderData, dueDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prioriteit</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newReminderData.priority}
                      onChange={(e) => setNewReminderData({...newReminderData, priority: e.target.value as ReminderPriority})}
                    >
                      <option value="low">Laag</option>
                      <option value="normal">Normaal</option>
                      <option value="high">Hoog</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newReminderData.type}
                    onChange={(e) => setNewReminderData({...newReminderData, type: e.target.value as ReminderType})}
                  >
                    <option value="maintenance">Onderhoud</option>
                    <option value="call">Klant bellen</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="other">Overig</option>
                  </select>
                </div>

                <div className="flex items-center gap-4 pt-4 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsReminderModalOpen(false)}
                    className="flex-1 py-4 text-slate-600 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    Inplannen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Machines;
