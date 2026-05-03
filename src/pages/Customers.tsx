import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Intervention, WorkOrder } from '../types';
import { Plus, Search, MapPin, Phone, Mail, Edit3, Trash2, ExternalLink, User, Printer, Wrench, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { logAction } from '../lib/audit';
import ConfirmDialog from '../components/ConfirmDialog';
import DocumentSection from '../components/DocumentSection';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    billingAddress: '',
    status: 'active' as Customer['status'],
    notes: '',
    internalNotes: '',
    locations: [] as string[]
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedCustomer(null);
    setNewCustomer({ 
      name: '', 
      contactPerson: '', 
      email: '', 
      phone: '', 
      address: '', 
      billingAddress: '',
      status: 'active',
      notes: '',
      internalNotes: '',
      locations: []
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setNewCustomer({
      name: customer.name,
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      billingAddress: customer.billingAddress || '',
      status: customer.status,
      notes: customer.notes || '',
      internalNotes: customer.internalNotes || '',
      locations: customer.locations || []
    });
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        const docRef = doc(db, 'customers', selectedCustomer.id);
        await updateDoc(docRef, { ...newCustomer, updatedAt: new Date().toISOString() });
        await logAction('Klant aangepast', 'customer', selectedCustomer.id, `Naam: ${newCustomer.name}`);
      } else {
        const docRef = await addDoc(collection(db, 'customers'), {
          ...newCustomer,
          createdAt: new Date().toISOString(),
        });
        await logAction('Klant aangemaakt', 'customer', docRef.id, `Naam: ${newCustomer.name}`);
      }
      setIsAddModalOpen(false);
      setNewCustomer({ 
        name: '', 
        contactPerson: '', 
        email: '', 
        phone: '', 
        address: '', 
        billingAddress: '',
        status: 'active',
        notes: '',
        internalNotes: '',
        locations: []
      });
      fetchCustomers();
    } catch (err) {
      handleFirestoreError(err, selectedCustomer ? OperationType.UPDATE : OperationType.CREATE, `customers/${selectedCustomer?.id || 'new'}`);
    }
  };

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('gegevens');
  const [customerMachines, setCustomerMachines] = useState<any[]>([]);
  const [customerInterventions, setCustomerInterventions] = useState<Intervention[]>([]);
  const [customerWorkOrders, setCustomerWorkOrders] = useState<WorkOrder[]>([]);

  const handleOpenDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedTab('gegevens');
    try {
      // Fetch machines for this customer
      const mq = query(collection(db, 'machines'), where('customerId', '==', customer.id));
      const mSnap = await getDocs(mq);
      setCustomerMachines(mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch interventions for this customer
      const iq = query(collection(db, 'interventions'), where('customerId', '==', customer.id), orderBy('date', 'desc'));
      const iSnap = await getDocs(iq);
      setCustomerInterventions(iSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));

      // Fetch work orders
      const wq = query(collection(db, 'work_orders'), where('customerId', '==', customer.id), orderBy('createdAt', 'desc'));
      const wSnap = await getDocs(wq);
      setCustomerWorkOrders(wSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'related-data');
    }
    setIsDetailsModalOpen(true);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'customers', deleteConfirm.id));
      await logAction('Klant verwijderd', 'customer', deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
      fetchCustomers();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customers/${deleteConfirm.id}`);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.contactPerson?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase()) ||
    c.locations?.some(loc => loc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Klantenbeheer</h1>
          <p className="text-sm text-slate-500 mt-1">Beheer uw relaties en machineparken.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Nieuwe Klant</span>
        </button>
      </div>

      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input 
          type="text" 
          placeholder="Zoek klant op naam of contactpersoon..." 
          className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={customer.id}
              className="card p-6 flex flex-col group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">
                  {customer.name.charAt(0)}
                </div>
                <div className="flex space-x-1">
                  <button 
                    onClick={() => handleOpenEditModal(customer)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Bewerken"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(customer.id, e)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-1">{customer.name}</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">{customer.contactPerson || 'Geen contactpersoon'}</p>

              <div className="space-y-3 pt-6 border-t border-slate-50 mt-auto">
                {customer.phone && (
                  <div className="flex items-center space-x-3 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center space-x-3 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center space-x-3 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  customer.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                  customer.status === 'inactive' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                  customer.status === 'lead' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                  'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  {customer.status}
                </span>
                <button 
                  onClick={() => handleOpenDetails(customer)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  Dossier
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Klant Verwijderen"
        message="LET OP: Weet u zeker dat u deze klant wilt verwijderen? Hiermee worden ook alle historische gegevens, machines en interventierapporten van deze klant onbereikbaar of verwijderd uit de context. Deze actie is definitief."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      {/* Add Modal Placeholder */}
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
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6 font-sans">
                {selectedCustomer ? 'Klant Aanpassen' : 'Nieuwe Klant Toevoegen'}
              </h2>
              <form onSubmit={handleSaveCustomer} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basis Informatie</h3>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bedrijfsnaam *</label>
                      <input 
                        required 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm" 
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Contactpersoon</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm" 
                        value={newCustomer.contactPerson}
                        onChange={(e) => setNewCustomer({...newCustomer, contactPerson: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Telefoon</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm" 
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                        <select 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                          value={newCustomer.status}
                          onChange={(e) => setNewCustomer({...newCustomer, status: e.target.value as Customer['status']})}
                        >
                          <option value="active">Actief</option>
                          <option value="inactive">Inactief</option>
                          <option value="lead">Lead</option>
                          <option value="prospect">Prospect</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm" 
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adressen</h3>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bezoekadres</label>
                      <textarea 
                        rows={2}
                        placeholder="Straat en nummer, Postcode, Stad"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm resize-none" 
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Factuuradres</label>
                      <textarea 
                        rows={2}
                        placeholder="Zelfde als bezoekadres indien leeg"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm resize-none" 
                        value={newCustomer.billingAddress}
                        onChange={(e) => setNewCustomer({...newCustomer, billingAddress: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Extra Locaties (één per regel)</label>
                      <textarea 
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm resize-none" 
                        value={newCustomer.locations.join('\n')}
                        onChange={(e) => setNewCustomer({...newCustomer, locations: e.target.value.split('\n').filter(l => l.trim() !== '')})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-sans">Notities</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Algemene Notities</label>
                      <textarea 
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm resize-none" 
                        value={newCustomer.notes}
                        onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 text-red-600">Interne Opmerkingen</label>
                      <textarea 
                        rows={3}
                        className="w-full px-4 py-2 bg-red-50/30 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-medium text-sm resize-none" 
                        value={newCustomer.internalNotes}
                        onChange={(e) => setNewCustomer({...newCustomer, internalNotes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
                  >
                    {selectedCustomer ? 'Wijzigingen Opslaan' : 'Klant Aanmaken'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedCustomer && (
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
              className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-200 uppercase">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{selectedCustomer.name}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Klantdossier #{selectedCustomer.id.slice(0, 6)}</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Fixed sidebar for quick stats/status */}
                <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-6 space-y-6 hidden md:block">
                  <div className="space-y-4">
                    <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Klantstatus</h3>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      selectedCustomer.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                      selectedCustomer.status === 'inactive' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {selectedCustomer.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Contact</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                         <User className="w-3.5 h-3.5 text-slate-400" />
                         <span>{selectedCustomer.contactPerson || 'Geen contact'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                         <Phone className="w-3.5 h-3.5 text-slate-400" />
                         <span>{selectedCustomer.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                         <Mail className="w-3.5 h-3.5 text-slate-400" />
                         <span className="truncate">{selectedCustomer.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Asset Overzicht</h3>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-500">Machines</span>
                          <span className="text-xs font-black text-slate-900">{customerMachines.length}</span>
                       </div>
                       <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-500">Open Interv.</span>
                          <span className="text-xs font-black text-slate-900">{customerInterventions.filter(i => i.status !== 'completed' && i.status !== 'cancelled').length}</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 px-6 bg-white shrink-0 overflow-x-auto scrollbar-hide">
                    {['gegevens', 'machines', 'interventies', 'werkbonnen', 'documenten'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                          selectedTab === tab 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                    <AnimatePresence mode="wait">
                      {selectedTab === 'gegevens' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-8"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bezoekadres</h4>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-700 leading-relaxed min-h-[60px]">
                                  {selectedCustomer.address || <span className="text-slate-400 font-normal italic">Geen adres opgegeven</span>}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Factuuradres</h4>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-700 leading-relaxed min-h-[60px]">
                                  {selectedCustomer.billingAddress || selectedCustomer.address || <span className="text-slate-400 font-normal italic">Zelfde als bezoekadres</span>}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Extra Locaties</h4>
                                <div className="space-y-2">
                                  {selectedCustomer.locations && selectedCustomer.locations.length > 0 ? (
                                    selectedCustomer.locations.map((loc, i) => (
                                      <div key={i} className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-lg text-[11px] font-bold text-slate-700 shadow-sm">
                                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                        {loc}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-400 italic">Geen extra locaties gevonden.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
                            <div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Algemene Notities</h4>
                               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap min-h-[100px]">
                                 {selectedCustomer.notes || 'Geen notities.'}
                               </div>
                            </div>
                            <div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-3">Interne Opmerkingen</h4>
                               <div className="p-4 bg-red-50/30 rounded-xl border border-red-100 text-xs font-medium text-red-700 leading-relaxed whitespace-pre-wrap min-h-[100px]">
                                 {selectedCustomer.internalNotes || 'Geen interne opmerkingen.'}
                               </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {selectedTab === 'machines' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Geïnstalleerde Machines</h4>
                            <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Download Overzicht</button>
                          </div>
                          {customerMachines.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {customerMachines.map(m => (
                        <div key={m.id} className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-200 transition-all group">
                          <div className="flex items-start justify-between mb-4">
                             <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                               <Printer className="w-5 h-5" />
                             </div>
                             <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                               m.status === 'active' ? 'bg-green-50 text-green-700' : 
                               m.status === 'faulty' ? 'bg-red-50 text-red-700' :
                               'bg-amber-50 text-amber-700'
                             }`}>
                               {m.status}
                             </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 mb-1">{m.brand} {m.model}</p>
                          <div className="space-y-1.5 mt-2">
                             <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span>Serienummer:</span>
                                <span className="text-slate-700 font-mono">{m.serialNumber}</span>
                             </div>
                             <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span>Locatie:</span>
                                <span className="text-slate-700 truncate max-w-[120px]">{m.location || 'N/A'}</span>
                             </div>
                             <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span>Garantie t/m:</span>
                                <span className="text-slate-700">{m.warrantyEndDate || 'N/A'}</span>
                             </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
                             <button 
                               onClick={() => {
                                 // Navigate to machines page with this machine selected or similar
                                 // For now just a visual hint
                               }}
                               className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
                             >
                               Details &rarr;
                             </button>
                          </div>
                        </div>
                      ))}
                            </div>
                          ) : (
                            <div className="p-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center">
                               <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                  <Printer className="w-6 h-6" />
                               </div>
                               <p className="text-sm font-bold text-slate-900 mb-1">Geen machines gevonden</p>
                               <p className="text-xs text-slate-500 max-w-xs">Er zijn nog geen machines gekoppeld aan dit klantendossier.</p>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {selectedTab === 'interventies' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interventie Historiek</h4>
                            <button 
                              onClick={() => window.location.href = `/interventions?customer=${selectedCustomer.id}`}
                              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                            >
                              Nieuwe Interventie
                            </button>
                          </div>
                          {customerInterventions.length > 0 ? (
                            <div className="space-y-3">
                              {customerInterventions.map(int => (
                                <div key={int.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all flex items-start gap-4 group">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                    int.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : 
                                    int.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                    'bg-amber-50 text-amber-600 border-amber-100'
                                  }`}>
                                    <Wrench className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{int.date}</span>
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                        int.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                        int.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        'bg-amber-100 text-amber-800'
                                      }`}>{int.status}</span>
                                    </div>
                                    <h5 className="text-xs font-black text-slate-900 mb-1 capitalize">
                                      {int.type} — {customerMachines.find(m => m.id === int.machineId)?.model || 'Onbekende Machine'}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed truncate">{int.problemDescription}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center">
                               <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                  <Wrench className="w-6 h-6" />
                               </div>
                               <p className="text-sm font-bold text-slate-900 mb-1">Geen interventies gevonden</p>
                               <p className="text-xs text-slate-500 max-w-xs">Er zijn nog geen interventies geregistreerd voor deze klant.</p>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {selectedTab === 'werkbonnen' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Werkbonnen</h4>
                            <p className="text-[10px] font-black text-slate-400 italic">Totaal: {customerWorkOrders.length}</p>
                          </div>
                          {customerWorkOrders.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {customerWorkOrders.map(wo => (
                                <div 
                                  key={wo.id} 
                                  onClick={() => window.location.href = `/work-orders?search=${wo.orderNumber}`}
                                  className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-blue-200 transition-all flex items-center gap-4 group cursor-pointer"
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
                                      {customerMachines.find(m => m.id === wo.machineId)?.model || 'Machine'}
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
                            <div className="p-12 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                               <FileText className="w-8 h-8 text-slate-200 mb-4" />
                               <p className="text-sm font-bold text-slate-900 mb-1">Geen werkbonnen</p>
                               <p className="text-xs text-slate-500">Er zijn nog geen werkbonnen aangemaakt voor deze klant.</p>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {selectedTab === 'documenten' && (
                         <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                         >
                            <DocumentSection customerId={selectedCustomer.id} />
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-900 flex justify-end gap-3">
                <button 
                  onClick={() => handleOpenEditModal(selectedCustomer)}
                  className="px-6 py-2 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Klant Bewerken
                </button>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-6 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
