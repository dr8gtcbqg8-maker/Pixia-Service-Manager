import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, addDoc, orderBy, updateDoc, doc, deleteDoc, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem, InventoryMutation, MutationType } from '../types';
import { 
  Plus, Search, Package, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  Edit3, Trash2, Filter, X, History, MoreVertical, CheckCircle2, 
  Tag, MapPin, Truck, ChevronRight, Hash, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { logAction } from '../lib/audit';
import ConfirmDialog from '../components/ConfirmDialog';
import { format } from 'date-fns';

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [mutations, setMutations] = useState<InventoryMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterLowStock, setFilterLowStock] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    partNumber: '',
    supplier: '',
    stockCount: 0,
    minStock: 5,
    location: '',
    purchasePrice: 0,
    sellingPrice: 0,
    notes: '',
    status: 'active' as 'active' | 'inactive'
  });

  const [mutationData, setMutationData] = useState({
    type: 'increase' as MutationType,
    quantity: 0,
    reason: ''
  });

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))).filter(Boolean), [items]);
  const suppliers = useMemo(() => Array.from(new Set(items.map(i => i.supplier))).filter(Boolean), [items]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const inventoryItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(inventoryItems);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchMutations = async (itemId: string) => {
    try {
      const q = query(
        collection(db, 'inventory_mutations'), 
        where('itemId', '==', itemId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setMutations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryMutation)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory_mutations');
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedItem(null);
    setFormData({
      name: '', category: '', partNumber: '', supplier: '', 
      stockCount: 0, minStock: 5, location: '', 
      purchasePrice: 0, sellingPrice: 0, notes: '', status: 'active'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      partNumber: item.partNumber,
      supplier: item.supplier,
      stockCount: item.stockCount,
      minStock: item.minStock,
      location: item.location,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      notes: item.notes,
      status: item.status
    });
    setIsAddModalOpen(true);
  };

  const handleOpenDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    fetchMutations(item.id);
    setIsDetailsModalOpen(true);
  };

  const handleOpenMutationModal = (item: InventoryItem, type: MutationType) => {
    setSelectedItem(item);
    setMutationData({ type, quantity: 0, reason: '' });
    setIsMutationModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      if (selectedItem) {
        await updateDoc(doc(db, 'inventory', selectedItem.id), data);
        await logAction('Voorraadartikel aangepast', 'inventory', selectedItem.id, `Naam: ${data.name}`);
      } else {
        const docRef = await addDoc(collection(db, 'inventory'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        await logAction('Voorraadartikel aangemaakt', 'inventory', docRef.id, `Naam: ${data.name} (Start: ${data.stockCount})`);
      }
      setIsAddModalOpen(false);
      fetchInventory();
    } catch (err) {
      handleFirestoreError(err, selectedItem ? OperationType.UPDATE : OperationType.CREATE, `inventory/${selectedItem?.id || 'new'}`);
    }
  };

  const handleSaveMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      let newCount = selectedItem.stockCount;
      if (mutationData.type === 'increase') newCount += mutationData.quantity;
      else if (mutationData.type === 'decrease' || mutationData.type === 'intervention') newCount -= mutationData.quantity;
      else if (mutationData.type === 'correction') newCount = mutationData.quantity;

      // Update item
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        stockCount: newCount,
        updatedAt: new Date().toISOString()
      });

      // Save mutation
      const mutRef = await addDoc(collection(db, 'inventory_mutations'), {
        itemId: selectedItem.id,
        type: mutationData.type,
        quantity: mutationData.type === 'correction' ? (newCount - selectedItem.stockCount) : mutationData.quantity,
        reason: mutationData.reason,
        timestamp: new Date().toISOString()
      });

      await logAction('Voorraad aangepast', 'inventory', selectedItem.id, `Type: ${mutationData.type}, Aantal: ${mutationData.quantity}, Nieuw totaal: ${newCount}`);

      setIsMutationModalOpen(false);
      fetchInventory();
      if (isDetailsModalOpen) fetchMutations(selectedItem.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${selectedItem.id}/mutation`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'inventory', deleteConfirm.id));
      await logAction('Voorraadartikel verwijderd', 'inventory', deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
      fetchInventory();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${deleteConfirm.id}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.partNumber.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSupplier = filterSupplier === 'all' || item.supplier === filterSupplier;
    const matchesStatus = item.status === filterStatus;
    const matchesLowStock = !filterLowStock || item.stockCount <= item.minStock;
    
    return matchesSearch && matchesCategory && matchesSupplier && matchesStatus && matchesLowStock;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Voorraadbeheer</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Beheer onderdelen en verbruiksartikelen.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-100 flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nieuw Artikel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Zoek op naam of artikelnummer..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 scrollbar-hide overflow-x-auto md:col-span-2">
            <select 
                className="px-4 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
            >
                <option value="all">Alle Categorieën</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select 
                className="px-4 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
            >
                <option value="all">Alle Leveranciers</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
                className="px-4 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
            >
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
            </select>
            <button 
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap shadow-sm ${
                    filterLowStock 
                    ? 'bg-red-50 border-red-200 text-red-600 ring-2 ring-red-100' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
            >
                Lage Voorraad
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => {
            const isLowStock = item.stockCount <= item.minStock;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={item.id}
                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all p-8 relative overflow-hidden group flex flex-col"
              >
                {isLowStock && (
                  <div className="absolute top-0 right-0 p-4">
                    <div className="bg-red-50 text-red-600 p-2 rounded-xl border border-red-100 animate-pulse">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div className="mb-6 flex items-start justify-between">
                   <div className={`p-4 rounded-2xl border shadow-sm ${isLowStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      <Package className="w-6 h-6" />
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                      {isLowStock && <span className="text-[9px] font-black text-red-600 uppercase mt-1">Hulp Nodig</span>}
                      <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">{item.partNumber}</span>
                   </div>
                </div>

                <div className="flex-1">
                   <h3 className="text-base font-black text-slate-900 line-clamp-1 mb-2">{item.name}</h3>
                   <p className="text-[10px] text-slate-500 font-medium mb-6 flex items-center gap-1.5 uppercase tracking-widest">
                      <Truck className="w-3 link-3 text-blue-500" />
                      {item.supplier || 'Geen leverancier'}
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-6 border-y border-slate-50">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Voorraad</p>
                        <p className={`text-sm font-black ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>{item.stockCount} st.</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prijs</p>
                        <p className="text-sm font-black text-slate-900">€ {item.sellingPrice.toFixed(2)}</p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                   <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenMutationModal(item, 'increase')}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600 rounded-xl transition-all"
                        title="Verhogen"
                      >
                         <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenMutationModal(item, 'decrease')}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                        title="Verlagen"
                      >
                         <ArrowDownRight className="w-4 h-4" />
                      </button>
                   </div>
                   <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                        title="Bewerken"
                      >
                         <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenDetails(item)}
                        className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-100 active:scale-95 transition-all"
                        title="Details"
                      >
                         <ChevronRight className="w-4 h-4" />
                      </button>
                   </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Artikel Verwijderen"
        message="Weet u zeker dat u dit artikel wilt verwijderen uit de voorraad? Deze actie kan niet ongedaan worden gemaakt."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

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
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 overflow-y-auto max-h-[95vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {selectedItem ? 'Artikel Bewerken' : 'Nieuw Artikel'}
                </h2>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Artikelnaam *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Artikelnummer</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.partNumber}
                    onChange={(e) => setFormData({...formData, partNumber: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Categorie</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Leverancier</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Locatie</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Voorraad</label>
                  <input 
                    disabled={!!selectedItem}
                    type="number" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({...formData, stockCount: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Minimale Voorraad</label>
                  <input 
                    type="number" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Inkoopprijs (€)</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Verkoopprijs (€)</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Status</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="active">Actief</option>
                    <option value="inactive">Inactief</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Opmerkingen</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                <div className="mt-8 md:col-span-2 flex items-center gap-4 pt-6 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-100 active:scale-[0.98]"
                  >
                    Gegevens Opslaan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mutation Modal */}
      <AnimatePresence>
        {isMutationModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMutationModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl p-10"
            >
              <h2 className="text-xl font-black text-slate-900 mb-8 tracking-tight capitalize">
                Voorraad {mutationData.type === 'correction' ? 'Corrigeren' : mutationData.type} — {selectedItem?.name}
              </h2>
              <form onSubmit={handleSaveMutation} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                    {mutationData.type === 'correction' ? 'Nieuwe Voorraad' : 'Aantal'}
                  </label>
                  <input 
                    required 
                    type="number" 
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-2xl text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={mutationData.quantity}
                    onChange={(e) => setMutationData({...mutationData, quantity: parseInt(e.target.value) || 0})}
                  />
                  {mutationData.type !== 'correction' && (
                    <p className="text-[10px] text-slate-400 font-bold text-center mt-2 italic shadow-sm">
                        Huidig: {selectedItem?.stockCount} → Nieuw: {
                            mutationData.type === 'increase' 
                            ? (selectedItem?.stockCount || 0) + mutationData.quantity 
                            : (selectedItem?.stockCount || 0) - mutationData.quantity
                        }
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reden / Notitie</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Bijv. Inventaris weging, Levering..."
                    value={mutationData.reason}
                    onChange={(e) => setMutationData({...mutationData, reason: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsMutationModalOpen(false)}
                    className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    className={`flex-[2] py-4 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-xl transition-all active:scale-95 ${
                        mutationData.type === 'increase' ? 'bg-green-600 shadow-green-100' : 
                        mutationData.type === 'decrease' ? 'bg-red-600 shadow-red-100' : 
                        'bg-slate-900 shadow-slate-100'
                    }`}
                  >
                    Bevestigen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedItem && (
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
              className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl p-10 overflow-y-auto max-h-[95vh]"
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-6">
                   <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border shadow-sm ${selectedItem.stockCount <= selectedItem.minStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      <Package className="w-8 h-8" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedItem.name}</h2>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedItem.partNumber}</span>
                   </div>
                </div>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 bg-slate-50 rounded-3xl space-y-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Leverancier</span>
                         <p className="text-xs font-black text-slate-900">{selectedItem.supplier || 'N/A'}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl space-y-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Locatie</span>
                         <p className="text-xs font-black text-slate-900">{selectedItem.location || 'N/A'}</p>
                      </div>
                   </div>

                   <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200">
                      <div className="flex items-center justify-between mb-6">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Huidige Voorraad</span>
                            <h4 className={`text-3xl font-black ${selectedItem.stockCount <= selectedItem.minStock ? 'text-red-400' : 'text-white'}`}>
                                {selectedItem.stockCount} <span className="text-sm">stuks</span>
                            </h4>
                         </div>
                         <div className="text-right space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Minimum</span>
                            <p className="text-base font-black italic">{selectedItem.minStock} stuks</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verkoop</span>
                            <p className="text-xl font-black italic">€ {selectedItem.sellingPrice.toFixed(2)}</p>
                         </div>
                         <div className="space-y-1 text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inkoop</span>
                            <p className="text-xl font-black italic">€ {selectedItem.purchasePrice.toFixed(2)}</p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sneltoetsen</h4>
                      <div className="grid grid-cols-3 gap-3">
                         <button 
                            onClick={() => handleOpenMutationModal(selectedItem, 'increase')}
                            className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:border-green-200 hover:bg-green-50/30 transition-all font-black"
                         >
                            <Plus className="w-4 h-4 text-green-600" />
                            <span className="text-[9px] uppercase tracking-widest">Verhogen</span>
                         </button>
                         <button 
                            onClick={() => handleOpenMutationModal(selectedItem, 'decrease')}
                            className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:border-red-200 hover:bg-red-50/30 transition-all font-black"
                         >
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                            <span className="text-[9px] uppercase tracking-widest">Verlagen</span>
                         </button>
                         <button 
                            onClick={() => handleOpenMutationModal(selectedItem, 'correction')}
                            className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:border-blue-200 hover:bg-blue-50/30 transition-all font-black"
                         >
                            <Edit3 className="w-4 h-4 text-blue-600" />
                            <span className="text-[9px] uppercase tracking-widest">Correctie</span>
                         </button>
                      </div>
                   </div>

                   {selectedItem.notes && (
                      <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-3xl">
                         <h5 className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Opmerkingen</h5>
                         <p className="text-xs text-amber-900/70 font-medium italic">{selectedItem.notes}</p>
                      </div>
                   )}
                </div>

                <div className="flex flex-col h-full bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-8">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-2">
                         <History className="w-4 h-4 text-blue-600" />
                         Mutatie Historie
                      </h3>
                      <button 
                         className="p-2 text-slate-400 hover:text-slate-900"
                         title="Vernieuwen"
                         onClick={() => fetchMutations(selectedItem.id)}
                      >
                         <ArrowUpRight className="w-4 h-4 rotate-45" />
                      </button>
                   </div>
                   
                   <div className="flex-1 space-y-3 min-h-[300px]">
                      {mutations.length > 0 ? (
                        mutations.map(m => (
                          <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all flex items-center justify-between group">
                             <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                    m.type === 'increase' ? 'bg-green-50 text-green-600 border-green-100' : 
                                    m.type === 'decrease' || m.type === 'intervention' ? 'bg-red-50 text-red-600 border-red-100' : 
                                    'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>
                                   {m.type === 'increase' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                </div>
                                <div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-900 capitalize italic">{m.type}</span>
                                      <span className="text-[8px] font-black text-slate-400">{format(new Date(m.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                                   </div>
                                   <p className="text-[9px] text-slate-500 font-medium line-clamp-1 truncate max-w-[200px]">{m.reason || 'Geen reden'}</p>
                                   <div className="flex flex-wrap gap-2 mt-1">
                                     {m.technicianName && (
                                       <span className="text-[8px] font-black uppercase tracking-tighter text-blue-500">Door: {m.technicianName}</span>
                                     )}
                                     {m.interventionId && (
                                       <span className="text-[8px] font-black uppercase tracking-tighter text-indigo-400">Interventie: #{m.interventionId.slice(-5)}</span>
                                     )}
                                   </div>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className={`text-xs font-black ${m.type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                                   {m.type === 'increase' ? '+' : ''}{m.quantity}
                                </span>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
                           <History className="w-10 h-10 mb-4" />
                           <p className="text-xs font-black uppercase tracking-widest">Geen mutaties</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              <div className="mt-12 flex justify-between items-center group">
                 <button 
                    onClick={() => { setDeleteConfirm({ isOpen: true, id: selectedItem.id }); setIsDetailsModalOpen(false); }}
                    className="flex items-center gap-2 text-slate-300 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                    <Trash2 className="w-4 h-4" />
                    Artikel Verwijderen
                 </button>
                 <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-10 py-5 bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-200 transition-all font-sans"
                >
                  Venster Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
