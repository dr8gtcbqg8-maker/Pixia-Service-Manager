import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, orderBy, limit, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Machine, Reminder, Intervention, Customer, InventoryItem, SmartAlert, EmailLog, OutlookConnection } from '../types';
import { 
  Users, Printer, Wrench, Clock, AlertCircle, ChevronRight, 
  Calendar, ShieldAlert, UserPlus, Package, ClipboardList, Bell,
  TrendingUp, PieChart as PieChartIcon, Activity,
  ArrowUpRight, ArrowDownRight, Eye, Globe, Mail
} from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { checkAndGenerateAlerts } from '../lib/alertService';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, startOfYear, endOfYear, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

type Period = 'week' | 'month' | 'year';

const Dashboard: React.FC = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [allInterventions, setAllInterventions] = useState<Intervention[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [outlookConnection, setOutlookConnection] = useState<OutlookConnection | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedMachineType, setSelectedMachineType] = useState<string>('all');
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Trigger smart alert generation
        await checkAndGenerateAlerts();

        const fetchCollection = async (path: string, queryConstraints: any[] = []) => {
          try {
            const q = queryConstraints.length > 0 
              ? query(collection(db, path), ...queryConstraints)
              : collection(db, path);
            const snap = await getDocs(q);
            return snap.docs;
          } catch (err) {
            console.warn(`Error fetching ${path}:`, err);
            return [];
          }
        };

        // Trigger smart alert generation with prefetched context to save reads
        const [mDocs, rDocs, iDocs, cDocs, invDocs, allIDocs, alertDocs, logDocs, outlookDocs] = await Promise.all([
          fetchCollection('machines'),
          fetchCollection('reminders', [where('status', '==', 'open'), orderBy('dueDate', 'asc'), limit(20)]),
          fetchCollection('interventions', [where('status', '!=', 'completed'), orderBy('date', 'asc'), limit(10)]),
          fetchCollection('customers', [orderBy('createdAt', 'desc')]),
          fetchCollection('inventory'),
          fetchCollection('interventions', [orderBy('date', 'desc')]),
          fetchCollection('smart_alerts', [where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(5)]),
          fetchCollection('email_logs', [orderBy('timestamp', 'desc'), limit(10)]),
          fetchCollection('outlook_connections', [where('status', '==', 'connected'), limit(1)])
        ]);

        const fetchedMachines = mDocs.map(doc => ({ id: doc.id, ...doc.data() } as Machine));
        const fetchedInventory = invDocs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        const fetchedInterventions = allIDocs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention));
        const fetchedCustomers = cDocs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));

        setMachines(fetchedMachines);
        setReminders(rDocs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
        setInterventions(iDocs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));
        setCustomers(fetchedCustomers);
        setInventory(fetchedInventory);
        setAllInterventions(fetchedInterventions);
        setAlerts(alertDocs.map(doc => ({ id: doc.id, ...doc.data() } as SmartAlert)));
        setEmailLogs(logDocs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog)));
        setOutlookConnection(outlookDocs.length > 0 ? { id: outlookDocs[0].id, ...outlookDocs[0].data() } as OutlookConnection : null);

        // Run alert checks in background with already fetched data
        checkAndGenerateAlerts({
          machines: fetchedMachines,
          inventory: fetchedInventory,
          interventions: fetchedInterventions,
          customers: fetchedCustomers
        });
      } catch (err) {
        console.error('General dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCustomer = (id: string) => customers.find(c => c.id === id);
  const getMachine = (id: string) => machines.find(m => m.id === id);

  const machineTypes = useMemo(() => {
    const types = new Set(machines.map(m => m.type));
    return Array.from(types);
  }, [machines]);

  // Combined Filters
  const filteredInterventions = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;

    if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (period === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      start = startOfYear(now);
      end = endOfYear(now);
    }

    return allInterventions.filter(i => {
      // Period filter
      let inPeriod = false;
      try {
        const date = parseISO(i.date);
        inPeriod = isWithinInterval(date, { start, end });
      } catch {
        inPeriod = false;
      }
      if (!inPeriod) return false;

      // Customer filter
      if (selectedCustomerId !== 'all' && i.customerId !== selectedCustomerId) return false;

      // Machine Type filter
      if (selectedMachineType !== 'all') {
        const m = getMachine(i.machineId);
        if (!m || m.type !== selectedMachineType) return false;
      }

      return true;
    });
  }, [allInterventions, period, selectedCustomerId, selectedMachineType, machines]);

  // Aggregations
  const statsOverview = useMemo(() => {
    const closed = filteredInterventions.filter(i => i.status === 'completed').length;
    const maintenance = filteredInterventions.filter(i => i.type === 'maintenance').length;
    const repairs = filteredInterventions.filter(i => i.type === 'fault').length;
    
    return {
      total: filteredInterventions.length,
      closed,
      maintenance,
      repairs
    };
  }, [filteredInterventions]);

  const trendsData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthLabel = format(date, 'MMM');
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const count = allInterventions.filter(inv => {
        try {
          const d = parseISO(inv.date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      }).length;

      return { name: monthLabel, count };
    });
    return last6Months;
  }, [allInterventions]);

  const typeData = [
    { name: 'Onderhoud', value: statsOverview.maintenance, color: '#3b82f6' },
    { name: 'Reparatie', value: statsOverview.repairs, color: '#f59e0b' },
    { name: 'Installatie', value: filteredInterventions.filter(i => i.type === 'installation').length, color: '#10b981' }
  ].filter(d => d.value > 0);

  const statusData = useMemo(() => [
    { name: 'Open', value: filteredInterventions.filter(i => i.status === 'to-be-scheduled' || i.status === 'planned').length, color: '#94a3b8' },
    { name: 'Onderweg', value: filteredInterventions.filter(i => i.status === 'on-route').length, color: '#6366f1' },
    { name: 'Bezig', value: filteredInterventions.filter(i => i.status === 'in-progress').length, color: '#3b82f6' },
    { name: 'Wacht op onderdelen', value: filteredInterventions.filter(i => i.status === 'waiting-parts').length, color: '#f59e0b' },
    { name: 'Afgerond', value: filteredInterventions.filter(i => i.status === 'completed').length, color: '#10b981' }
  ].filter(d => d.value > 0), [filteredInterventions]);

  const topFaultyMachines = useMemo(() => {
    const machineCounts: Record<string, number> = {};
    allInterventions.filter(i => i.type === 'fault').forEach(i => {
      if (i.machineId) {
        machineCounts[i.machineId] = (machineCounts[i.machineId] || 0) + 1;
      }
    });

    return Object.entries(machineCounts)
      .map(([id, count]) => ({ machine: getMachine(id), count }))
      .filter(item => item.machine)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allInterventions, machines]);

  const topCustomers = useMemo(() => {
    const customerCounts: Record<string, number> = {};
    allInterventions.forEach(i => {
      customerCounts[i.customerId] = (customerCounts[i.customerId] || 0) + 1;
    });

    return Object.entries(customerCounts)
      .map(([id, count]) => ({ customer: getCustomer(id), count }))
      .filter(item => item.customer)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allInterventions, customers]);

  const lowStockItems = inventory.filter(item => item.stockCount <= item.minStock && item.status === 'active');
  
  const getAlertPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-rose-500 bg-rose-50';
      case 'high': return 'text-amber-500 bg-amber-50';
      case 'normal': return 'text-blue-500 bg-blue-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const handleDismissAlert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'smart_alerts', id), {
        status: 'seen',
        updatedAt: new Date().toISOString()
      });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const expiringWarrantyCount = machines.filter(m => {
    if (!m.warrantyEndDate) return false;
    try {
      const end = parseISO(m.warrantyEndDate);
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 30;
    } catch {
      return false;
    }
  }).length;

  const upcomingMaintenance = machines
    .filter(m => {
      if (!m.nextMaintenanceDate) return false;
      try {
        const next = parseISO(m.nextMaintenanceDate);
        const now = new Date();
        const diffTime = next.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 14;
      } catch {
        return false;
      }
    })
    .sort((a, b) => (a.nextMaintenanceDate || '').localeCompare(b.nextMaintenanceDate || ''));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const periodLabels = {
    week: 'Deze Week',
    month: 'Deze Maand',
    year: 'Dit Jaar'
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header with Filters */}
      <div className="flex flex-col lg:items-start gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight italic flex items-center gap-4">
              Dashboard
              <Activity className="w-8 h-8 text-blue-600" />
            </h1>
            <p className="text-slate-500 font-medium italic text-sm mt-1">Real-time overzicht en business intelligence</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner overflow-x-auto whitespace-nowrap">
              {(['week', 'month', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    period === p 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <button 
              onClick={() => navigate('/calendar')}
              className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Agenda
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4 w-full bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
           <div className="flex-1 min-w-[200px]">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Klant Filter</label>
             <select 
               value={selectedCustomerId}
               onChange={(e) => setSelectedCustomerId(e.target.value)}
               className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
             >
                <option value="all">Alle Klanten</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
             </select>
           </div>
           <div className="flex-1 min-w-[200px]">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Machine Type</label>
             <select 
               value={selectedMachineType}
               onChange={(e) => setSelectedMachineType(e.target.value)}
               className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
             >
                <option value="all">Alle Typen</option>
                {machineTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
             </select>
           </div>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Interventies', value: statsOverview.total, icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12%', up: true },
          { label: 'Afgerond', value: statsOverview.closed, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50', trend: '85%', up: true },
          { label: 'Lage Voorraad', value: lowStockItems.length, icon: Package, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'Kritiek!', up: false },
          { label: 'Open Taken', value: reminders.length, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Nu', up: true },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-100 transition-all group overflow-hidden relative"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.trend && (
                  <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg ${stat.up ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>
                    {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                )}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <section className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Interventie Trends (6 mnd)
            </h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendsData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            Type Verdeling
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase">Success Rate</span>
                <span className="text-sm font-black text-green-600">92%</span>
             </div>
             <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[92%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
             </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions Integration */}
          <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              Automatisering & Koppelingen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div 
                 onClick={() => navigate('/settings?tab=outlook')}
                 className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] text-white flex items-center justify-between cursor-pointer group shadow-xl"
               >
                  <div className="flex items-center gap-4">
                     <div className={cn(
                       "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                       outlookConnection ? "bg-blue-600 shadow-lg shadow-blue-900/50" : "bg-slate-800"
                     )}>
                        <Globe className={cn("w-6 h-6", outlookConnection ? "text-white" : "text-slate-500")} />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Outlook Status</p>
                        <p className="text-sm font-black italic">{outlookConnection ? 'Verbonden' : 'Niet Gekoppeld'}</p>
                     </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
               </div>

               <div 
                 onClick={() => navigate('/email-log')}
                 className="p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-between cursor-pointer group hover:border-indigo-100 hover:shadow-lg transition-all"
               >
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                        <Mail className="w-6 h-6 text-indigo-600" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">E-mail Activiteit</p>
                        <p className="text-sm font-black italic">
                          {emailLogs.filter(l => l.status === 'sent').length} verzonden
                          {emailLogs.filter(l => l.status === 'failed').length > 0 && 
                            <span className="text-rose-500 ml-2">({emailLogs.filter(l => l.status === 'failed').length} fouten)</span>
                          }
                        </p>
                     </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
               </div>
            </div>
          </section>

          {/* Quick Actions Integration */}
          <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              Snelkoppelingen
            </h3>
            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 md:grid md:grid-cols-6 md:pb-0 md:mx-0 md:px-0 gap-4 no-scrollbar">
              {[
                { label: 'Klant', icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50', path: '/customers' },
                { label: 'Machine', icon: Printer, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/machines' },
                { label: 'Service', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50', path: '/interventions' },
                { label: 'Werkbon', icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50', path: '/work-orders' },
                { label: 'Taken', icon: Bell, color: 'text-rose-600', bg: 'bg-rose-50', path: '/reminders' },
                { label: 'Stock', icon: Package, color: 'text-slate-600', bg: 'bg-slate-50', path: '/inventory' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-3 p-5 min-w-[100px] rounded-[2rem] border border-slate-50 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-100 transition-all group cursor-pointer bg-slate-50/10"
                >
                  <div className={`p-4 ${action.bg} ${action.color} rounded-2xl group-hover:scale-110 transition-transform shadow-sm`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">{action.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Faulty Machines & Top Customers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Storingsgevoelig
                  </h3>
               </div>
               <div className="p-2">
                  {topFaultyMachines.map(({ machine, count }, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                       <span className="text-xl font-black text-slate-200 w-6 italic">#{idx + 1}</span>
                       <div className="flex-1">
                          <p className="text-sm font-black text-slate-900">{machine?.brand} {machine?.model}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{machine?.serialNumber}</p>
                       </div>
                       <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black">
                         {count}x Storing
                       </div>
                    </div>
                  ))}
                  {topFaultyMachines.length === 0 && (
                    <div className="p-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Geen data beschikbaar</div>
                  )}
               </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Top Klanten
                  </h3>
               </div>
               <div className="p-2">
                  {topCustomers.map(({ customer, count }, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                       <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-black text-slate-400">
                          {customer?.name.charAt(0)}
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-black text-slate-900 line-clamp-1">{customer?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{customer?.email}</p>
                       </div>
                       <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">
                         {count}x Visit
                       </div>
                    </div>
                  ))}
                  {topCustomers.length === 0 && (
                    <div className="p-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Geen data beschikbaar</div>
                  )}
               </div>
            </section>
          </div>

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Open Interventies
              </h2>
              <button onClick={() => navigate('/interventions')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline cursor-pointer">
                Lijst &rarr;
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {interventions.length > 0 ? (
                interventions.map((i) => (
                  <div key={i.id} onClick={() => navigate('/interventions')} className="p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                         <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{customers.find(c => c.id === i.customerId)?.name || 'Onbekend'}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{i.date} • {i.type}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 text-sm italic font-medium">Alle klussen zijn klaar!</div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-8">
          <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Bell className="w-5 h-5 text-blue-600" />
                  Slimme Meldingen
                </h3>
                <button 
                  onClick={() => navigate('/notifications')}
                  className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Alle {alerts.length > 0 && `(${alerts.length})`}
                </button>
             </div>
             <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.slice(0, 3).map(alert => (
                    <motion.div
                      key={alert.id}
                      whileHover={{ x: 4 }}
                      onClick={() => handleDismissAlert(alert.id)}
                      className="p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl cursor-pointer transition-all flex items-start gap-4 group/alert"
                    >
                       <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse", getAlertPriorityColor(alert.priority))}></div>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate leading-none mb-1">{alert.title}</p>
                          <p className="text-[10px] font-medium text-slate-500 line-clamp-1">{alert.description}</p>
                       </div>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDismissAlert(alert.id);
                         }}
                         className="opacity-0 group-hover/alert:opacity-100 p-1 text-slate-300 hover:text-blue-600 transition-all"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-300 font-bold italic text-[10px] uppercase tracking-widest">
                    Geen actieve meldingen
                  </div>
                )}
             </div>
          </section>

          <section className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
             <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-2 text-rose-400 border-b border-white/10 pb-4">
                   <ShieldAlert className="w-6 h-6" />
                   <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Business Alerts</h2>
                </div>
                
                <div className="space-y-5">
                   {lowStockItems.length > 0 && (
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        onClick={() => navigate('/inventory')}
                        className="bg-rose-500/20 backdrop-blur-md rounded-3xl p-5 border border-rose-500/30 ring-1 ring-rose-500/50 cursor-pointer"
                      >
                         <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-1">Kritieke Voorraad</p>
                         <p className="text-3xl font-black italic text-white leading-none">{lowStockItems.length} Artikelen</p>
                         <div className="mt-4 space-y-2">
                            {lowStockItems.slice(0, 3).map(item => (
                               <div key={item.id} className="text-[9px] font-bold text-rose-100 flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                  <span>{item.name}</span>
                                  <span className="bg-rose-500 px-2 py-0.5 rounded text-white font-mono">{item.stockCount} st.</span>
                               </div>
                            ))}
                         </div>
                      </motion.div>
                   )}

                   <div 
                    onClick={() => navigate('/machines')}
                    className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                   >
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Garantie verlopen (30d)</p>
                      <p className="text-2xl font-black italic">{expiringWarrantyCount} Machines</p>
                   </div>
                   
                   <div 
                    onClick={() => navigate('/machines')}
                    className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                   >
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Defect gemeld</p>
                      <p className="text-2xl font-black italic text-rose-400">{machines.filter(m => m.status === 'faulty').length} Machines</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                   <p className="text-[10px] text-white/40 font-bold italic">Rapportage gegenereerd op {format(new Date(), 'HH:mm')}</p>
                </div>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-600/10 rounded-full blur-[60px] pointer-events-none"></div>
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
             <div className="p-6 bg-amber-50/50 border-b border-amber-100">
                <h3 className="text-[10px] font-black text-amber-900 uppercase tracking-[0.2em] flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-amber-600" />
                   Komend Onderhoud
                </h3>
             </div>
             <div className="divide-y divide-slate-50">
                {upcomingMaintenance.length > 0 ? (
                  upcomingMaintenance.slice(0, 5).map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => navigate('/machines')}
                      className="p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                       <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black text-slate-900 truncate">{m.brand} {m.model}</p>
                          <span className="text-[8px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-lg">Gepland</span>
                       </div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.nextMaintenanceDate}</p>
                       <p className="text-[9px] text-slate-500 font-medium truncate mt-1 italic">{getCustomer(m.customerId)?.name}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Geen onderhoud gepland</div>
                )}
             </div>
          </section>

          <section className="bg-indigo-600 text-white rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
             <div className="relative z-10">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-70">Systeem Status</h3>
                <div className="flex items-center gap-4 mb-6">
                   <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <TrendingUp className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-2xl font-black tracking-tighter">98.5%</p>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Gemiddelde Uptime</p>
                   </div>
                </div>
                <button 
                  onClick={() => navigate('/machines')}
                  className="w-full bg-white text-indigo-600 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg active:scale-95"
                >
                  Machinepark Beheer
                </button>
             </div>
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                <Printer className="w-32 h-32" />
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
