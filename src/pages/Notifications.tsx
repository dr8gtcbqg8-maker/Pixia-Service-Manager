import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SmartAlert, AlertStatus, AlertPriority } from '../types';
import { 
  Bell, CheckCircle, Eye, Trash2, Package, Wrench, 
  ShieldAlert, Activity, AlertTriangle, ChevronRight,
  Filter, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const Notifications: React.FC = () => {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'smart_alerts'), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartAlert)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'smart_alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (id: string, status: AlertStatus) => {
    try {
      await updateDoc(doc(db, 'smart_alerts', id), {
        status,
        updatedAt: new Date().toISOString()
      });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `smart_alerts/${id}`);
    }
  };

  const getPriorityColor = (priority: AlertPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-rose-500 text-white';
      case 'high': return 'bg-amber-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-slate-400 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stock': return <Package className="w-5 h-5" />;
      case 'maintenance': return <Wrench className="w-5 h-5" />;
      case 'warranty': return <ShieldAlert className="w-5 h-5" />;
      case 'failure': return <AlertTriangle className="w-5 h-5" />;
      case 'inactivity': return <Activity className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getStatusLabel = (status: AlertStatus) => {
    switch (status) {
      case 'open': return 'Open';
      case 'seen': return 'Gezien';
      case 'resolved': return 'Opgelost';
      case 'dismissed': return 'Genegeerd';
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const matchesFilter = filter === 'all' || a.status === filter;
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                          a.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const navigateToRelated = (alert: SmartAlert) => {
    if (!alert.relatedId) return;
    switch (alert.type) {
      case 'stock': navigate('/inventory'); break;
      case 'maintenance': navigate('/machines'); break;
      case 'warranty': navigate('/machines'); break;
      case 'failure': navigate('/interventions'); break;
      case 'inactivity': navigate('/customers'); break;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic flex items-center gap-4">
            Notificaties
            <Bell className="w-8 h-8 text-blue-600" />
          </h1>
          <p className="text-slate-500 font-medium italic text-sm mt-1">Slimme alerts en systeem waarschuwingen</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Zoeken..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all w-64"
              />
           </div>
           <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner">
             {(['all', 'open', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    filter === f 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {f === 'all' ? 'Alle' : getStatusLabel(f as AlertStatus)}
                </button>
             ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "bg-white border rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group",
                alert.status === 'open' ? "border-slate-200" : "border-slate-100 opacity-60"
              )}
            >
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6">
                <div className={cn(
                  "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                  getPriorityColor(alert.priority)
                )}>
                  {getTypeIcon(alert.type)}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-900 leading-tight truncate">{alert.title}</h3>
                    <span className={cn(
                      "text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shrink-0",
                      alert.status === 'open' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-400 border-slate-100"
                    )}>
                      {getStatusLabel(alert.status)}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">{alert.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                    <span>{format(new Date(alert.createdAt), 'dd MMM yyyy HH:mm', { locale: nl })}</span>
                    {alert.relatedId && (
                      <button 
                        onClick={() => navigateToRelated(alert)}
                        className="text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Details <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50 md:self-center justify-end">
                  {alert.status === 'open' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'seen')}
                        className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-md rounded-xl transition-all"
                        title="Markeren als gezien"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                        className="p-3 bg-slate-50 text-slate-400 hover:text-green-600 hover:bg-white hover:shadow-md rounded-xl transition-all"
                        title="Markeren als opgelost"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {alert.status !== 'open' && alert.status !== 'resolved' && (
                     <button
                        onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                        className="p-3 bg-slate-50 text-slate-400 hover:text-green-600 hover:bg-white hover:shadow-md rounded-xl transition-all"
                        title="Markeren als opgelost"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus(alert.id, 'dismissed')}
                    className="p-3 bg-white text-slate-300 hover:text-rose-500 hover:shadow-md rounded-xl transition-all"
                    title="Verwijderen"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredAlerts.length === 0 && !loading && (
          <div className="bg-slate-50 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                <Bell className="w-10 h-10" />
             </div>
             <h3 className="text-xl font-black text-slate-900 mb-2">Geen meldingen gevonden</h3>
             <p className="text-slate-400 font-medium">Alles ziet er goed uit! Geen alerts die actie vereisen.</p>
          </div>
        )}

        {loading && (
           <div className="flex items-center justify-center p-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
