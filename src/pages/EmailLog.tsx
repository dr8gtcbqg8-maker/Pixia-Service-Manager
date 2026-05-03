import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EmailLog, Customer } from '../types';
import { 
  Mail, Search, Filter, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, ChevronRight, User, Eye, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const EmailLogPage: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const logsSnap = await getDocs(query(collection(db, 'email_logs'), orderBy('timestamp', 'desc'), limit(100)));
      const customersSnap = await getDocs(collection(db, 'customers'));
      
      setLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog)));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    } catch (err) {
      console.error('Error fetching email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (id?: string) => {
    return customers.find(c => c.id === id)?.name || 'Onbekende klant';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-50 text-green-700 border-green-100';
      case 'failed': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5" />;
      default: return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Mail className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Communicatie Archief</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tight">E-mail Log</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Historie van alle e-mailverzendingen aan klanten en technici.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Zoeken op ontvanger of onderwerp..."
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {['all', 'sent', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                statusFilter === status 
                  ? "bg-slate-900 text-white border-slate-900 shadow-xl" 
                  : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
              )}
            >
              {status === 'all' ? 'Alles' : status === 'sent' ? 'Verzonden' : 'Mislukt'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-20 flex justify-center">
            <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer overflow-hidden relative"
            >
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className={cn(
                  "p-4 rounded-2xl shrink-0 border flex items-center justify-center",
                  getStatusStyle(log.status)
                )}>
                  <Mail className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-black text-slate-900 truncate tracking-tight">{log.subject}</h3>
                    <div className={cn(
                      "px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                      getStatusStyle(log.status)
                    )}>
                      {getStatusIcon(log.status)}
                      {log.status === 'sent' ? 'Verzonden' : 'Mislukt'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {log.recipient}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm', { locale: nl })}
                    </div>
                    {log.customerId && (
                       <div className="flex items-center gap-1.5 text-blue-600">
                         <ChevronRight className="w-3.5 h-3.5" />
                         {getCustomerName(log.customerId)}
                       </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 self-end md:self-center">
                   <button 
                     onClick={() => navigate(`/interventions/${log.interventionId}`)}
                     disabled={!log.interventionId}
                     className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-md rounded-xl transition-all disabled:opacity-0"
                   >
                     <Eye className="w-5 h-5" />
                   </button>
                </div>
              </div>

              {log.status === 'failed' && log.error && (
                <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{log.error}</p>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="p-20 text-center bg-white rounded-[3rem] border border-slate-100 italic text-slate-400 font-medium">
            Geen e-mail logs gevonden.
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailLogPage;
