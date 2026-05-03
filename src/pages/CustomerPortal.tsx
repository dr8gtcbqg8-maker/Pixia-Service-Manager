import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Customer, Machine, Intervention, WorkOrder, AppDocument, Appointment 
} from '../types';
import { 
  Briefcase, Printer, Wrench, FileText, Calendar, 
  ExternalLink, Clock, CheckCircle2, AlertCircle, Info,
  Search, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const CustomerPortal: React.FC = () => {
  const { profile } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.customerId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const custId = profile.customerId;
        
        // Fetch specific data for this customer
        const [custSnap, machSnap, intSnap, woSnap, appSnap] = await Promise.all([
          getDocs(query(collection(db, 'customers'), where('id', '==', custId))),
          getDocs(query(collection(db, 'machines'), where('customerId', '==', custId))),
          getDocs(query(collection(db, 'interventions'), where('customerId', '==', custId), orderBy('date', 'desc'), limit(5))),
          getDocs(query(collection(db, 'work_orders'), where('customerId', '==', custId), orderBy('date', 'desc'), limit(5))),
          getDocs(query(collection(db, 'appointments'), where('customerId', '==', custId), orderBy('date', 'asc')))
        ]);

        if (!custSnap.empty) setCustomer({ id: custSnap.docs[0].id, ...custSnap.docs[0].data() } as Customer);
        setMachines(machSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
        setInterventions(intSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));
        setWorkOrders(woSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder)));
        setAppointments(appSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      } catch (err) {
        console.error("Error fetching customer portal data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  if (!profile || profile.role !== 'customer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tight">Klantportaal Toegang</h1>
          <p className="text-slate-500 max-w-sm mx-auto">Deze pagina is alleen toegankelijk voor accounts met de rol 'customer'. Beheerder? Wissel van rol in de instellingen.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl -mb-40 -mr-40"></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{customer?.name || 'Klantportaal'}</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tight">Welkom terug, {profile.displayName || 'Klant'}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Bekijk hier uw machinepark, afspraken en documentatie.</p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Feed: Machines & Interventions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Machines Section */}
          <section className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 italic tracking-tight">Mijn Machinepark</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{machines.length} Geregistreerde units</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {machines.map(m => (
                 <div key={m.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:border-blue-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.status}
                      </span>
                      <Printer className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 mb-1">{m.brand} {m.model}</h3>
                    <p className="text-xs text-slate-500 font-medium mb-4">S/N: {m.serialNumber}</p>
                    
                    <div className="pt-4 border-t border-slate-200/50 flex items-center justify-between">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Volgend onderhoud</div>
                      <div className="text-[10px] font-bold text-slate-900">{m.nextMaintenanceDate ? format(new Date(m.nextMaintenanceDate), 'dd MMM yyyy') : 'N.v.t.'}</div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* Interventions History */}
          <section className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 italic tracking-tight">Service Historie</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recente interventies & reparaties</p>
              </div>
            </div>

            <div className="space-y-3">
              {interventions.map(i => (
                <div key={i.id} className="flex items-center gap-6 p-5 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                   <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all shadow-sm">
                     <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{format(new Date(i.date), 'MMM')}</span>
                     <span className="text-lg font-black italic leading-none">{format(new Date(i.date), 'dd')}</span>
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${i.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                        <h4 className="text-sm font-black text-slate-900 capitalize">{i.type}</h4>
                     </div>
                     <p className="text-xs text-slate-500 font-medium line-clamp-1">{i.problemDescription || i.workPerformed || 'Geen omschrijving beschikbaar'}</p>
                   </div>
                   <div className="text-right">
                      <button className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-50">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar: Appointments & Documents */}
        <div className="space-y-8">
          
          {/* Upcoming Appointments */}
          <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-xl">
             <div className="flex items-center gap-3 mb-8">
               <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl">
                 <Calendar className="w-5 h-5" />
               </div>
               <h3 className="text-lg font-black italic tracking-tight">Gepland Onderhoud</h3>
             </div>

             <div className="space-y-4">
                {appointments.filter(a => a.status === 'planned').map(a => (
                  <div key={a.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{format(new Date(a.date), 'EEEE dd MMMM', { locale: nl })}</span>
                       <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                         <Clock className="w-3 h-3" />
                         {a.startTime}
                       </div>
                    </div>
                    <p className="text-xs font-bold leading-relaxed">{a.title}</p>
                  </div>
                ))}
                {appointments.filter(a => a.status === 'planned').length === 0 && (
                  <p className="text-xs text-slate-500 font-medium italic p-4 text-center">Geen afspraken gepland.</p>
                )}
             </div>
          </section>

          {/* Documents Quick Access */}
          <section className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
               <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                 <FileText className="w-5 h-5" />
               </div>
               <h3 className="text-lg font-black text-slate-900 italic tracking-tight">Documentatie</h3>
            </div>

            <div className="space-y-3">
               {workOrders.map(wo => (
                 <div key={wo.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-amber-50/50 hover:border-amber-100 transition-all">
                    <div className="flex items-center gap-3">
                       <FileText className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                       <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-slate-900">Werkbon #{wo.orderNumber}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{format(new Date(wo.date), 'dd-MM-yyyy')}</p>
                       </div>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-amber-600 transition-colors">
                       <Search className="w-4 h-4" />
                    </button>
                 </div>
               ))}
            </div>
            
            <button className="w-full mt-6 py-4 border border-dashed border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
               Bekijk Alle Documenten
            </button>
          </section>

        </div>
      </div>
      
      {/* Support Box */}
      <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="space-y-3 relative">
          <h2 className="text-2xl font-black italic tracking-tight">Hulp nodig van een technicus?</h2>
          <p className="text-blue-100 text-sm font-medium">Heeft u een storing of vraag over uw machine? Mail ons direct of bel onze servicedesk.</p>
        </div>
        <div className="flex gap-4 relative">
           <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-xl">
             Bel Support
           </button>
           <button className="px-8 py-4 bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-800 shadow-xl">
             Stuur E-mail
           </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerPortal;
