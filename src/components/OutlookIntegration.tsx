import React, { useEffect, useState } from 'react';
import { OutlookConnection } from '../types';
import { outlookService } from '../lib/outlookService';
import { 
  CheckCircle2, XCircle, RefreshCw, Unlink, Link2, 
  Calendar, Mail, ShieldCheck, Activity, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const OutlookIntegration: React.FC = () => {
  const [connection, setConnection] = useState<OutlookConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchConnection = async () => {
    setIsLoading(true);
    try {
      const conn = await outlookService.getConnection();
      setConnection(conn);
    } catch (err) {
      console.error('Error fetching connection:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    const url = outlookService.getAuthUrl();
    // In a real app, window.open(url) then listen for callback
    // For this prototype, we simulate connection after 2 seconds
    setIsSyncing(true);
    setTimeout(async () => {
      try {
        const conn = await outlookService.connect('MOCK_CODE');
        setConnection(conn as OutlookConnection);
      } catch (err) {
        console.error('Mock connection failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 2000);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!confirm('Weet u zeker dat u de Outlook koppeling wilt verbreken?')) return;
    
    setIsSyncing(true);
    try {
      await outlookService.disconnect(connection.id);
      setConnection({ ...connection, status: 'disconnected' });
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Koppeling controleren...</p>
      </div>
    );
  }

  const isConnected = connection && connection.status === 'connected';

  return (
    <div className="space-y-8">
      {/* Status Card */}
      <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
              {isConnected ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
              </div>
              <h3 className="text-3xl font-black italic tracking-tight">
                {isConnected ? 'Gekoppeld' : 'Niet Gekoppeld'}
              </h3>
              {isConnected && (
                <p className="text-slate-400 text-sm font-medium mt-1">{connection.account}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {!isConnected ? (
              <button 
                onClick={handleConnect}
                disabled={isSyncing}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                {isSyncing ? 'Bezig...' : 'Koppel Outlook'}
              </button>
            ) : (
              <>
                <button 
                  onClick={handleConnect}
                  disabled={isSyncing}
                  className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Opnieuw Verbinden
                </button>
                <button 
                  onClick={handleDisconnect}
                  className="px-6 py-4 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                >
                  <Unlink className="w-4 h-4" />
                  Verbreken
                </button>
              </>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Laatste Sync</p>
                <p className="text-sm font-bold">{connection.lastSync ? format(new Date(connection.lastSync), 'dd MMM HH:mm', { locale: nl }) : 'Niet gesynchroniseerd'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Machtigingen</p>
                <p className="text-sm font-bold">Agenda, E-mail, Profiel</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Synchronisatie</p>
                <p className="text-sm font-bold">Automatisch aan</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Agenda Synchronisatie</h4>
          </div>
          <div className="space-y-4">
            {[
              { id: 'ints', label: 'Interventies & Afspraken', enabled: true },
              { id: 'maint', label: 'Onderhoudsplanning', enabled: true },
              { id: 'remind', label: 'Belangrijke Herinneringen', enabled: false },
              { id: 'tasks', label: 'Follow-ups Werkbonnen', enabled: true },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                <button 
                  className={`w-10 h-6 rounded-full transition-all relative ${item.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  disabled={!isConnected}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.enabled ? 'left-5' : 'left-1'}`}></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">E-mail Automatisering</h4>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Met de Outlook-koppeling kan het systeem automatisch e-mails versturen namens uw eigen zakelijke account. Dit verhoogt de betrouwbaarheid en zorgt dat verzonden mails ook in uw 'Verzonden items' verschijnen.
          </p>
          <div className="p-6 bg-white rounded-2xl border border-slate-100">
            <h5 className="text-[10px] font-black uppercase text-slate-400 mb-2">Integratie Voordelen</h5>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Geen 'via system' vermelding
              </li>
              <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Eigen e-mail handtekening
              </li>
              <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Directe replies terugontvangen
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutlookIntegration;
