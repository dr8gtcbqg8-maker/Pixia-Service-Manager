import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, limit, addDoc, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WorkOrder, Customer, Machine, Intervention, WorkOrderStatus, InterventionType } from '../types';
import { 
  ClipboardList, Search, Filter, Download, ExternalLink, Calendar, 
  User, CheckCircle2, Clock, Plus, X, Printer, MapPin, 
  Hash, Wrench, AlertCircle, FileText, ChevronRight, PenTool
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { logAction } from '../lib/audit';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import SignaturePad from '../components/SignaturePad';
import DocumentSection from '../components/DocumentSection';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const WorkOrders: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signingEntity, setSigningEntity] = useState<'client' | 'technician' | null>(null);

  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    orderNumber: `WB-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    customerId: '',
    machineId: '',
    interventionId: '',
    technicianName: '',
    type: 'maintenance' as InterventionType,
    workDescription: '',
    partsUsed: [] as { itemId?: string; name: string; quantity: number; unitPrice?: number }[],
    hoursWorked: 0,
    travelTime: 0,
    notes: '',
    clientName: '',
    status: 'draft' as WorkOrderStatus
  });

  const STANDARD_TASKS = [
    'Periodiek onderhoud uitgevoerd volgens protocol.',
    'Storing onderzocht en verholpen.',
    'Slijtageonderdelen preventief vervangen.',
    'Machine gereinigd en gekalibreerd.',
    'Software en firmware gecontroleerd op updates.',
    'Testafdrukken gemaakt en gecontroleerd op kwaliteit.'
  ];

  const COMMON_PARTS = [
    { name: 'Filter Set A', price: 45.00 },
    { name: 'Smeermiddel (500ml)', price: 12.50 },
    { name: 'Aandrijfriem XL', price: 34.00 },
    { name: 'Sensormodule V2', price: 89.00 },
    { name: 'Reinigingskit', price: 19.95 }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woSnap, cSnap, mSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'machines')),
        getDocs(collection(db, 'inventory'))
      ]);
      setWorkOrders(woSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder)));
      setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setMachines(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Machine)));
      setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'work_orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Check for interventionId in URL
    const params = new URLSearchParams(window.location.search);
    const intId = params.get('interventionId');
    if (intId) {
      loadInterventionData(intId);
    }
  }, []);

  const loadInterventionData = async (id: string) => {
    try {
      const docSnap = await getDoc(doc(db, 'interventions', id));
      if (docSnap.exists()) {
        const int = docSnap.data() as Intervention;
        setFormData(prev => ({
          ...prev,
          customerId: int.customerId,
          machineId: int.machineId,
          interventionId: id,
          technicianName: int.technicianName || '',
          type: int.type,
          workDescription: int.workPerformed || (int.problemDescription ? `STORINGSMELDING: ${int.problemDescription}\n\nUITGEVOERD:\n` : ''),
          partsUsed: int.partsUsed || [],
          hoursWorked: int.hoursWorked || (int.startedAt ? Number(((new Date().getTime() - new Date(int.startedAt).getTime()) / (1000 * 60 * 60)).toFixed(1)) : 0),
          travelTime: int.travelTime || 0,
          status: 'in-progress'
        }));
        setIsModalOpen(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `interventions/${id}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (selectedOrder) {
        await updateDoc(doc(db, 'work_orders', selectedOrder.id), data);
        await logAction('Werkbon aangepast', 'work_order', selectedOrder.id, `Status: ${data.status}`);
      } else {
        const docRef = await addDoc(collection(db, 'work_orders'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        await logAction('Werkbon aangemaakt', 'work_order', docRef.id, `Nummer: ${data.orderNumber}`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, selectedOrder ? OperationType.UPDATE : OperationType.CREATE, 'work_orders');
    }
  };

  const handleSignatureSave = async (signatureData: string) => {
    if (!signingEntity || !selectedOrder) return;

    try {
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (signingEntity === 'client') {
        updateData.clientSignature = signatureData;
        updateData.signedAt = new Date().toISOString();
        updateData.status = 'completed';
        
        // Stock subtraction logic for work order completion
        if (!selectedOrder.stockProcessed && selectedOrder.partsUsed && selectedOrder.partsUsed.length > 0) {
            // Check if linked intervention hasn't already processed stock
            let alreadyProcessed = false;
            if (selectedOrder.interventionId) {
                const intDoc = await getDoc(doc(db, 'interventions', selectedOrder.interventionId));
                if (intDoc.exists() && intDoc.data().stockProcessed) {
                    alreadyProcessed = true;
                }
            }

            if (!alreadyProcessed) {
                for (const part of selectedOrder.partsUsed) {
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
                            interventionId: selectedOrder.interventionId || 'none',
                            reason: `Gebruikt via werkbon ${selectedOrder.orderNumber}`,
                            technicianName: selectedOrder.technicianName,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                updateData.stockProcessed = true;
                
                // Also mark intervention as processed if linked
                if (selectedOrder.interventionId) {
                    await updateDoc(doc(db, 'interventions', selectedOrder.interventionId), {
                        stockProcessed: true
                    });
                }
            }
        }
      } else {
        updateData.technicianSignature = signatureData;
      }

      await updateDoc(doc(db, 'work_orders', selectedOrder.id), updateData);
      
      if (signingEntity === 'client') {
        await logAction('Werkbon ondertekend', 'work_order', selectedOrder.id, `Door: ${selectedOrder.clientName}`);
      } else {
        await logAction('Werkbon getekend door technicus', 'work_order', selectedOrder.id);
      }
      
      setIsSigning(false);
      setSigningEntity(null);
      fetchData();
      
      // Refresh selected order to show signature
      const newSnap = await getDoc(doc(db, 'work_orders', selectedOrder.id));
      if (newSnap.exists()) {
        setSelectedOrder({ id: newSnap.id, ...newSnap.data() } as WorkOrder);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_orders/${selectedOrder.id}`);
    }
  };

  const exportToPDF = async () => {
    if (!pdfTemplateRef.current) return;
    
    try {
      const canvas = await html2canvas(pdfTemplateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Werkbon_${selectedOrder?.orderNumber || 'WB'}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Er is een fout opgetreden bij het genereren van de PDF.');
    }
  };

  const getCustomer = (id: string) => customers.find(c => c.id === id);
  const getMachine = (id: string) => machines.find(m => m.id === id);

  const filteredOrders = workOrders.filter(o => 
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    getCustomer(o.customerId)?.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status: WorkOrderStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-100';
      case 'awaiting-signature': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'in-progress': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'draft': return 'bg-slate-50 text-slate-500 border-slate-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusLabelText = (status: WorkOrderStatus) => {
    switch (status) {
      case 'completed': return 'Afgerond';
      case 'awaiting-signature': return 'Wacht op handtekening';
      case 'in-progress': return 'Bezig';
      case 'draft': return 'Concept';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Werkbonnen</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Beheer en ondertekening van werkrapportages</p>
        </div>
        <button 
          onClick={() => {
            setSelectedOrder(null);
            setFormData({
              orderNumber: `WB-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
              date: format(new Date(), 'yyyy-MM-dd'),
              customerId: '',
              machineId: '',
              interventionId: '',
              technicianName: '',
              type: 'maintenance',
              workDescription: '',
              partsUsed: [],
              hoursWorked: 0,
              travelTime: 0,
              notes: '',
              clientName: '',
              status: 'draft'
            });
            setIsModalOpen(true);
          }}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-100 flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nieuwe Werkbon
        </button>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Zoek op bonnummer of klant..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map(order => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={order.id}
              onClick={() => {
                setSelectedOrder(order);
                setFormData({
                    orderNumber: order.orderNumber,
                    date: order.date,
                    customerId: order.customerId,
                    machineId: order.machineId,
                    interventionId: order.interventionId || '',
                    technicianName: order.technicianName,
                    type: order.type,
                    workDescription: order.workDescription,
                    partsUsed: order.partsUsed || [],
                    hoursWorked: order.hoursWorked,
                    travelTime: order.travelTime,
                    notes: order.notes || '',
                    clientName: order.clientName || '',
                    status: order.status
                });
                setIsModalOpen(true);
              }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all p-8 group cursor-pointer overflow-hidden relative"
            >
               <div className="flex items-start justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${getStatusStyle(order.status)} border shadow-sm`}>
                       <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase mb-0.5">{order.orderNumber}</p>
                        <h3 className="text-base font-black text-slate-900 line-clamp-1">{getCustomer(order.customerId)?.name || 'Onbekend'}</h3>
                    </div>
                 </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Printer className="w-4 h-4 text-blue-600" />
                    <span className="truncate">{getMachine(order.machineId)?.model || 'Machine'}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 py-4 border-t border-slate-50">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Datum</p>
                        <p className="text-xs font-bold text-slate-700">{format(new Date(order.date), 'dd/MM/yyyy')}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uren</p>
                        <p className="text-xs font-bold text-slate-700">{order.hoursWorked}u</p>
                     </div>
                     <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</p>
                        <p className="text-xs font-bold text-slate-700 capitalize">{order.type}</p>
                     </div>
                  </div>
               </div>

               <div className="mt-6 flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${order.status === 'completed' ? 'bg-green-500' : order.status === 'in-progress' ? 'bg-blue-500' : 'bg-amber-400'}`} />
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">{getStatusLabelText(order.status)}</span>
                  </div>
                  <div className="w-10 h-10 bg-slate-50 group-hover:bg-blue-600 text-slate-400 group-hover:text-white rounded-xl flex items-center justify-center transition-all">
                     <ChevronRight className="w-5 h-5" />
                  </div>
               </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-24 rounded-3xl border border-slate-200 text-center">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">Geen werkbonnen gevonden.</p>
        </div>
      )}

      {/* Modal for Details / Sign / Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl p-10 overflow-y-auto max-h-[95vh]"
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            {formData.orderNumber}
                        </h2>
                        <select 
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border outline-none ${getStatusStyle(formData.status)}`}
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as WorkOrderStatus})}
                        >
                          <option value="draft">Concept</option>
                          <option value="in-progress">Bezig</option>
                          <option value="awaiting-signature">Wacht op handtekening</option>
                          <option value="completed">Afgerond</option>
                        </select>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      Klant: {getCustomer(formData.customerId)?.name || 'Niet geselecteerd'}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {selectedOrder && (
                       <button 
                        onClick={exportToPDF}
                        className="p-3 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all"
                        title="Export PDF"
                       >
                         <Download className="w-5 h-5" />
                       </button>
                    )}
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <form onSubmit={handleSave} className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Klant</label>
                        <select 
                            required
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.customerId}
                            onChange={(e) => setFormData({...formData, customerId: e.target.value, machineId: ''})}
                        >
                            <option value="">Klant...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Machine</label>
                        <select 
                            required
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.machineId}
                            onChange={(e) => setFormData({...formData, machineId: e.target.value})}
                        >
                             <option value="">{formData.customerId ? 'Selecteer Machine...' : 'Kies eerst een klant'}</option>
                             {machines.filter(m => m.customerId === formData.customerId).map(m => (
                               <option key={m.id} value={m.id}>{m.model} ({m.serialNumber})</option>
                             ))}
                        </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Datum</label>
                        <input 
                            type="date"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Technicus</label>
                        <input 
                            type="text"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.technicianName}
                            onChange={(e) => setFormData({...formData, technicianName: e.target.value})}
                        />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Omschrijving Werkzaamheden</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {STANDARD_TASKS.map((task, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData(prev => ({ 
                              ...prev, 
                              workDescription: prev.workDescription ? `${prev.workDescription}\n- ${task}` : `- ${task}` 
                            }))}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-blue-100 transition-all border border-blue-100"
                          >
                            + {task.split(' ')[0]}...
                          </button>
                        ))}
                      </div>
                      <textarea 
                        rows={4}
                        placeholder="Voer hier de uitgevoerde werkzaamheden in..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[120px]"
                        value={formData.workDescription}
                        onChange={(e) => setFormData({...formData, workDescription: e.target.value})}
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Gewerkte Uren</label>
                        <input 
                            type="number" step="0.25"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.hoursWorked}
                            onChange={(e) => setFormData({...formData, hoursWorked: parseFloat(e.target.value)})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reistijd (min)</label>
                        <input 
                            type="number"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.travelTime}
                            onChange={(e) => setFormData({...formData, travelTime: parseInt(e.target.value)})}
                        />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Naam Ondertekenaar / Contactpersoon</label>
                      <input 
                        type="text"
                        placeholder="Naam van de klant"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.clientName}
                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                      />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Gebruikte Onderdelen</label>
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Snel Toevoegen uit Voorraad:</span>
                        <div className="flex items-center gap-2">
                          <select 
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            onChange={(e) => {
                              const item = inventory.find(i => i.id === e.target.value);
                              if (item) {
                                const existing = formData.partsUsed.find(p => p.itemId === item.id);
                                if (existing) {
                                  setFormData({
                                    ...formData,
                                    partsUsed: formData.partsUsed.map(p => p.itemId === item.id ? { ...p, quantity: p.quantity + 1 } : p)
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    partsUsed: [...formData.partsUsed, { 
                                      itemId: item.id, 
                                      name: item.name, 
                                      quantity: 1, 
                                      unitPrice: item.sellingPrice 
                                    }]
                                  });
                                }
                              }
                              e.target.value = '';
                            }}
                          >
                            <option value="">Kies onderdeel...</option>
                            {inventory.filter(i => i.status === 'active').map(i => (
                              <option key={i.id} value={i.id}>{i.name} (€{i.sellingPrice?.toFixed(2)})</option>
                            ))}
                          </select>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {formData.partsUsed.map((part, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="flex-1 text-xs font-bold text-slate-700">{part.name}</span>
                          <div className="flex items-center gap-2">
                             <button 
                               type="button"
                               onClick={() => {
                                 const newParts = [...formData.partsUsed];
                                 if (newParts[idx].quantity > 1) {
                                   newParts[idx].quantity -= 1;
                                   setFormData({...formData, partsUsed: newParts});
                                 } else {
                                   setFormData({...formData, partsUsed: newParts.filter((_, i) => i !== idx)});
                                 }
                               }}
                               className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500"
                             >
                               -
                             </button>
                             <span className="w-8 text-center text-xs font-black">{part.quantity}</span>
                             <button 
                               type="button"
                               onClick={() => {
                                 const newParts = [...formData.partsUsed];
                                 newParts[idx].quantity += 1;
                                 setFormData({...formData, partsUsed: newParts});
                               }}
                               className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500"
                             >
                               +
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                     <button 
                        type="submit"
                        className="flex-1 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                     >
                        {selectedOrder ? 'Gegevens Bijwerken' : 'Werkbon Concept Opslaan'}
                     </button>
                  </div>
                </form>

                {/* Signatures & Preview */}
                <div className="space-y-8 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 h-full">
                  <div className="flex items-center justify-between">
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-blue-600" />
                        Ondertekening
                     </h3>
                     {selectedOrder && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${getStatusStyle(selectedOrder.status)}`}>
                            {selectedOrder.status}
                        </span>
                     )}
                  </div>

                  <div className="space-y-6">
                    {/* Client Signature */}
                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                      {selectedOrder?.clientSignature ? (
                        <div className="space-y-3">
                           <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Handtekening Klant</label>
                              <span className="text-[9px] font-bold text-slate-400 italic">Getekend op: {format(new Date(selectedOrder.signedAt || ''), 'dd/MM/yyyy HH:mm')}</span>
                           </div>
                           <img src={selectedOrder.clientSignature} alt="Client Signature" className="max-w-full h-24 object-contain mx-auto" />
                           <p className="text-center text-xs font-black text-slate-900 mt-2">{selectedOrder.clientName}</p>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                           <p className="text-xs font-bold text-slate-500 mb-4 truncate">Klant: {formData.clientName || getCustomer(formData.customerId)?.name || 'Onbekend'}</p>
                           {selectedOrder && (
                              <button 
                               type="button"
                               onClick={() => { setIsSigning(true); setSigningEntity('client'); }}
                               className="w-full py-4 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <PenTool className="w-5 h-5" /> Nu Laten Tekenen
                              </button>
                           )}
                        </div>
                      )}
                    </div>

                    {/* Technician Signature */}
                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                      {selectedOrder?.technicianSignature ? (
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Handtekening Technicus</label>
                           <img src={selectedOrder.technicianSignature} alt="Technician Signature" className="max-w-full h-20 object-contain mx-auto" />
                           <p className="text-center text-xs font-black text-slate-900 mt-2">{selectedOrder.technicianName}</p>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                           <p className="text-xs font-bold text-slate-500 mb-4">Eigen handtekening</p>
                           {selectedOrder && (
                              <button 
                               type="button"
                               onClick={() => { setIsSigning(true); setSigningEntity('technician'); }}
                               className="w-full py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-slate-100 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <PenTool className="w-5 h-5" /> Zelf Tekenen
                              </button>
                           )}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedOrder && (
                    <div className="pt-6 border-t border-slate-100 space-y-6">
                       <DocumentSection 
                         workOrderId={selectedOrder.id} 
                         customerId={formData.customerId}
                         machineId={formData.machineId}
                       />
                       <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
                        * Na ondertekening door de klant krijgt de werkbon de status 'Afgerond' en is deze juridisch bindend als werkrapportage.
                       </p>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Preview Hidden (used for Export) */}
              <div className="hidden">
                 <div ref={pdfTemplateRef} className="w-[210mm] p-20 font-sans" style={{ minHeight: '297mm', color: '#0f172a', backgroundColor: '#ffffff' }}>
                    <div className="flex justify-between items-start pb-12 mb-12" style={{ borderBottom: '4px solid #0f172a' }}>
                       <div>
                          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Service Werkbon</h1>
                          <p className="text-xl font-bold mb-1" style={{ color: '#2563eb' }}>{formData.orderNumber}</p>
                          <p className="font-medium" style={{ color: '#64748b' }}>Datum: {formData.date}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-2xl font-black italic">PRINTERS <span style={{ color: '#2563eb' }}>PLUS</span></p>
                          <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>Industrieweg 12, 1234 AB, Stad<br/>Tel: 010 - 123 456 78</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-20 mb-12">
                       <div className="p-8 rounded-3xl border" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                          <h3 className="text-xs font-black uppercase tracking-widest mb-4 italic" style={{ color: '#94a3b8' }}>Klantgegevens</h3>
                          <p className="text-lg font-black">{getCustomer(formData.customerId)?.name}</p>
                          <p style={{ color: '#475569' }}>{getCustomer(formData.customerId)?.address}</p>
                          <p className="italic mt-2" style={{ color: '#475569' }}>{getCustomer(formData.customerId)?.email}</p>
                       </div>
                       <div className="p-8 rounded-3xl border" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                          <h3 className="text-xs font-black uppercase tracking-widest mb-4 italic" style={{ color: '#94a3b8' }}>Machinegegevens</h3>
                          <p className="text-lg font-black">{getMachine(formData.machineId)?.brand} {getMachine(formData.machineId)?.model}</p>
                          <p style={{ color: '#475569' }}>S/N: {getMachine(formData.machineId)?.serialNumber}</p>
                          <p className="font-bold mt-2" style={{ color: '#2563eb' }}>Type: {formData.type}</p>
                       </div>
                    </div>

                    <div className="mb-12">
                       <h3 className="text-xs font-black uppercase tracking-widest mb-4 italic" style={{ color: '#94a3b8' }}>Werkzaamheden</h3>
                       <div className="p-8 border rounded-3xl min-h-[150px]" style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}>
                          <p className="whitespace-pre-wrap leading-relaxed">{formData.workDescription}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8 mb-12">
                       <div className="p-6 border rounded-2xl" style={{ borderColor: '#f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                          <p className="text-[10px] font-black uppercase mb-1" style={{ color: '#94a3b8' }}>Technicus</p>
                          <p className="font-bold">{formData.technicianName}</p>
                       </div>
                       <div className="p-6 border rounded-2xl" style={{ borderColor: '#f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                          <p className="text-[10px] font-black uppercase mb-1 tracking-widest" style={{ color: '#94a3b8' }}>Gewerkte Uren</p>
                          <p className="font-bold">{formData.hoursWorked} uur</p>
                       </div>
                       <div className="p-6 border rounded-2xl" style={{ borderColor: '#f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                          <p className="text-[10px] font-black uppercase mb-1 tracking-widest" style={{ color: '#94a3b8' }}>Reistijd</p>
                          <p className="font-bold">{formData.travelTime} min</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-20 mt-20">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>Handtekening Technicus</p>
                          {selectedOrder?.technicianSignature && (
                             <img src={selectedOrder.technicianSignature} className="max-h-24 object-contain" />
                          )}
                          <p className="text-sm font-bold pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>{formData.technicianName}</p>
                       </div>
                       <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>Handtekening Klant</p>
                          {selectedOrder?.clientSignature && (
                             <img src={selectedOrder.clientSignature} className="max-h-24 object-contain" />
                          )}
                          <p className="text-sm font-bold pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>{formData.clientName || getCustomer(formData.customerId)?.name}</p>
                          {selectedOrder?.signedAt && (
                             <p className="text-[10px]" style={{ color: '#94a3b8' }}>Getekend op {format(new Date(selectedOrder.signedAt), 'dd MMMM yyyy HH:mm', { locale: nl })}</p>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {isSigning && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest italic">
                  Digitale Handtekening
                </h2>
                <button 
                  onClick={() => setIsSigning(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6 flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                 <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                   U ondertekent als <strong>{signingEntity === 'client' ? 'Klant' : 'Technicus'}</strong>. Plaats uw handtekening in het onderstaande veld.
                 </p>
              </div>

              <SignaturePad 
                title={signingEntity === 'client' ? "Handtekening Klant" : "Handtekening Technicus"}
                onSave={handleSignatureSave}
              />
              
              <button 
                 onClick={() => setIsSigning(false)}
                 className="w-full mt-4 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all"
              >
                Annuleren
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkOrders;
