import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLog } from '../types';
import { ShieldCheck, Search, Filter, History, User, Activity, Clock, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'audit_logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    log.details.toLowerCase().includes(search.toLowerCase())
  );

  const getEntityIcon = (type: AuditLog['entityType']) => {
    switch (type) {
      case 'customer': return <User className="w-4 h-4" />;
      case 'machine': return <Activity className="w-4 h-4" />;
      case 'intervention': return <Activity className="w-4 h-4" />;
      case 'work_order': return <FileText className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Compliance & Veiligheid</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tight">Audit Logs</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Overzicht van alle kritieke acties binnen het systeem.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Zoek in logs (actie, gebruiker, details)..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={fetchLogs}
          className="p-4 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Tijdstip</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Gebruiker</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Actie</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Entiteit</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map((log) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={log.id} 
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">
                          {format(new Date(log.timestamp), 'dd MMM HH:mm', { locale: nl })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-black text-slate-900 italic tracking-tight">{log.userEmail}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-black text-blue-600 uppercase tracking-tighter">{log.action}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          {getEntityIcon(log.entityType)}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{log.entityType}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-medium text-slate-500 truncate max-w-xs italic">{log.details}</p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLogs.length === 0 && (
            <div className="p-20 text-center">
              <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-bold italic">Geen logs gevonden die voldoen aan de zoekcriteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
