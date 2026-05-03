import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, User, Shield, Bell, Database, Globe, Save, Mail, Smartphone, Download, Trash2, ShieldCheck, CheckCircle2, XCircle, Image as ImageIcon, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmailTemplateManager from '../components/EmailTemplateManager';
import UserManager from '../components/UserManager';
import AuditLogs from './AuditLogs';
import OutlookIntegration from '../components/OutlookIntegration';
import { 
  BusinessSettings, AppSettings, NotificationSettings, SecuritySettings, AuditLog,
  OutlookConnection
} from '../types';
import { logAction, handleFirestoreError, OperationType } from '../lib/utils';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Profile State
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Business State
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    name: '', address: '', phone: '', email: '', website: '', kvk: '', btw: '', defaultEmailSender: '', defaultWorkOrderTerms: ''
  });

  // App State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    language: 'nl', dateFormat: 'dd-MM-yyyy', timezone: 'Europe/Amsterdam', 
    maintenanceIntervalDefault: 12, warrantyWarningDays: 30, stockWarningThreshold: 5,
    workOrderPrefix: 'WO-', interventionPrefix: 'INT-'
  });

  // Notification State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    remindersEnabled: true, emailNotifications: true, dashboardAlerts: true,
    maintenanceReminderDays: 14, warrantyReminderDays: 30, stockAlertsEnabled: true
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const businessDoc = await getDoc(doc(db, 'settings', 'business'));
        if (businessDoc.exists()) setBusinessSettings(businessDoc.data() as BusinessSettings);

        const appDoc = await getDoc(doc(db, 'settings', 'app'));
        if (appDoc.exists()) setAppSettings(appDoc.data() as AppSettings);

        const notifDoc = await getDoc(doc(db, 'settings', 'notifications'));
        if (notifDoc.exists()) setNotificationSettings(notifDoc.data() as NotificationSettings);
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, [activeTab]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        displayName,
        phone,
        updatedAt: new Date().toISOString()
      });
      await logAction('Profiel bijgewerkt', 'settings', 'user', `Profielgegevens aangepast door ${user.email}`, user.uid);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusiness = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'business'), businessSettings);
      await logAction('Bedrijfsinstellingen aangepast', 'settings', 'settings', 'Bedrijfsgegevens bijgewerkt');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveApp = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), appSettings);
      await logAction('App instellingen aangepast', 'settings', 'settings', 'Applicatie parameters bijgewerkt');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'notifications'), notificationSettings);
      await logAction('Meldingen aangepast', 'settings', 'settings', 'Notificatie voorkeuren bijgewerkt');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Mijn Profiel', icon: User },
    { id: 'users', name: 'Gebruikersbeheer', icon: Shield, adminOnly: true },
    { id: 'business', name: 'Bedrijf', icon: Save, adminOnly: true },
    { id: 'app', name: 'App Configuratie', icon: Globe, adminOnly: true },
    { id: 'email', name: 'Communicatie', icon: Mail, adminOnly: true },
    { id: 'outlook', name: 'Outlook Integratie', icon: Globe, adminOnly: true },
    { id: 'notifications', name: 'Notificaties', icon: Bell },
    { id: 'security', name: 'Veiligheid', icon: ShieldCheck },
    { id: 'audit', name: 'Audit Log', icon: Database, adminOnly: true },
    { id: 'system', name: 'Systeem', icon: Smartphone, adminOnly: true },
  ].filter(tab => !tab.adminOnly || profile?.role === 'admin');

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Beheer & Configuratie</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tight">Instellingen</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Personaliseer uw account en automatische communicatie.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-72 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 ring-2 ring-blue-500/20' 
                : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 bg-slate-50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
              {tab.name}
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 space-y-10"
              >
                <div className="flex items-center gap-8 pb-10 border-b border-slate-100">
                  <div className="w-28 h-28 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-slate-400 border-4 border-white shadow-2xl ring-1 ring-slate-100 uppercase">
                    {profile?.displayName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 italic tracking-tight">{profile?.displayName || 'Gebruiker'}</h2>
                    <p className="text-slate-500 text-sm font-medium">{user?.email}</p>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                      <Shield className="w-3.5 h-3.5" />
                      {profile?.role === 'admin' ? 'Hoofdgebruiker' : profile?.role === 'customer' ? 'Klantgebruiker' : 'Technicus'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Volledige Naam</label>
                    <div className="relative">
                      <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300 font-bold text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Telefoonnummer</label>
                    <div className="relative">
                      <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+31 6 12345678"
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300 font-bold text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email Adres</label>
                    <div className="relative">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        readOnly
                        defaultValue={user?.email || ''}
                        className="w-full pl-14 pr-6 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none text-slate-400 font-bold text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Account Rol</label>
                    <div className="relative">
                      <Shield className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        readOnly
                        value={profile?.role === 'admin' ? 'Hoofdgebruiker' : profile?.role === 'planner' ? 'Planner' : profile?.role === 'technician' ? 'Technicus' : 'Viewer'}
                        className="w-full pl-14 pr-6 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none text-slate-400 font-bold text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-10 border-t border-slate-50">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      saveStatus === 'success' ? 'bg-green-600 text-white' :
                      saveStatus === 'error' ? 'bg-rose-600 text-white' :
                      'bg-slate-900 text-white hover:bg-blue-600'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Bezig...' : saveStatus === 'success' ? 'Opgeslagen!' : saveStatus === 'error' ? 'Fout bij opslaan' : 'Profiel Bijwerken'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10"
              >
                <div className="mb-10">
                   <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Gebruikersbeheer</h2>
                   <p className="text-sm text-slate-500 font-medium">Beheer wie toegang heeft tot de applicatie en wijs rollen toe.</p>
                </div>
                <UserManager />
              </motion.div>
            )}

            {activeTab === 'business' && (
              <motion.div
                key="business"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 space-y-10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 italic tracking-tight">Bedrijfsgegevens</h2>
                    <p className="text-sm text-slate-500 font-medium">Deze gegevens worden gebruikt op werkbonnen en communicatie.</p>
                  </div>
                  <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                     <Save className="w-8 h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bedrijfslogo</label>
                    <div className="flex items-start gap-6">
                      <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group">
                        {businessSettings.logoUrl ? (
                          <>
                            <img src={businessSettings.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => setBusinessSettings({...businessSettings, logoUrl: ''})}
                                className="p-2 bg-rose-600 text-white rounded-full hover:scale-110 transition-transform"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-slate-400">
                            <ImageIcon className="w-8 h-8 mb-2" />
                            <span className="text-[8px] font-black uppercase tracking-tighter">Geen Logo</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm">
                          Upload een logo voor gebruik op werkbonnen en in e-mails. Gebruik bij voorkeur een transparante PNG van minimaal 400x400 pixels.
                        </p>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm">
                            <Upload className="w-3.5 h-3.5" />
                            Logo Selecteren
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setBusinessSettings({...businessSettings, logoUrl: reader.result as string});
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          {businessSettings.logoUrl && (
                            <button 
                              onClick={() => setBusinessSettings({...businessSettings, logoUrl: ''})}
                              className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Verwijderen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bedrijfsnaam</label>
                    <input 
                      type="text" 
                      value={businessSettings.name}
                      onChange={e => setBusinessSettings({...businessSettings, name: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail Adres (Algemeen)</label>
                    <input 
                      type="email" 
                      value={businessSettings.email}
                      onChange={e => setBusinessSettings({...businessSettings, email: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bezoekadres</label>
                    <input 
                      type="text" 
                      value={businessSettings.address}
                      onChange={e => setBusinessSettings({...businessSettings, address: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefoonnummer</label>
                    <input 
                      type="tel" 
                      value={businessSettings.phone}
                      onChange={e => setBusinessSettings({...businessSettings, phone: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Website</label>
                    <input 
                      type="url" 
                      value={businessSettings.website}
                      onChange={e => setBusinessSettings({...businessSettings, website: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">KvK Nummer</label>
                    <input 
                      type="text" 
                      value={businessSettings.kvk}
                      onChange={e => setBusinessSettings({...businessSettings, kvk: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">BTW Nummer</label>
                    <input 
                      type="text" 
                      value={businessSettings.btw}
                      onChange={e => setBusinessSettings({...businessSettings, btw: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-10 border-t border-slate-50">
                  <button 
                    onClick={handleSaveBusiness}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Bedrijfsgegevens Opslaan
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'app' && (
              <motion.div
                key="app"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 space-y-10"
              >
                <div>
                   <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">App Configuratie</h2>
                   <p className="text-sm text-slate-500 font-medium">Standaardwaarden en gedrag van de applicatie.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Standaard Taal</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                      value={appSettings.language}
                      onChange={e => setAppSettings({...appSettings, language: e.target.value as any})}
                    >
                       <option value="nl">Nederlands</option>
                       <option value="en">English</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tijdzone</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                      value={appSettings.timezone}
                      onChange={e => setAppSettings({...appSettings, timezone: e.target.value})}
                    >
                       <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                       <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Onderhoudsinterval (maanden)</label>
                    <input 
                      type="number" 
                      value={appSettings.maintenanceIntervalDefault}
                      onChange={e => setAppSettings({...appSettings, maintenanceIntervalDefault: parseInt(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Garantie Waarschuwing (dagen vooraf)</label>
                    <input 
                      type="number" 
                      value={appSettings.warrantyWarningDays}
                      onChange={e => setAppSettings({...appSettings, warrantyWarningDays: parseInt(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prefix Werkbonnen</label>
                    <input 
                      type="text" 
                      value={appSettings.workOrderPrefix}
                      onChange={e => setAppSettings({...appSettings, workOrderPrefix: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prefix Interventies</label>
                    <input 
                      type="text" 
                      value={appSettings.interventionPrefix}
                      onChange={e => setAppSettings({...appSettings, interventionPrefix: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-10 border-t border-slate-50">
                  <button 
                    onClick={handleSaveApp}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Configuratie Opslaan
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10"
              >
                <div className="flex items-center justify-between mb-10">
                   <div>
                    <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Communicatie & Templates</h2>
                    <p className="text-sm text-slate-500 font-medium">Beheer de automatische berichten die naar klanten worden verstuurd.</p>
                   </div>
                   <button 
                      onClick={() => navigate('/email-log')}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100"
                    >
                      <Mail className="w-4 h-4" />
                      Bekijk E-mail Log
                    </button>
                </div>
                <EmailTemplateManager />
              </motion.div>
            )}

            {activeTab === 'outlook' && (
              <motion.div
                key="outlook"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10"
              >
                <div className="mb-10">
                   <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Microsoft 365 / Outlook Koppeling</h2>
                   <p className="text-sm text-slate-500 font-medium">Synchroniseer uw agenda en verhoog de betrouwbaarheid van uw e-mails.</p>
                </div>
                <OutlookIntegration />
              </motion.div>
            )}

            {activeTab === 'notifications' && (
               <motion.div
                 key="notifications"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="p-10 space-y-10"
               >
                 <div>
                    <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Notificatie Voorkeuren</h2>
                    <p className="text-sm text-slate-500 font-medium">Beheer hoe en wanneer u meldingen wilt ontvangen.</p>
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                          <p className="text-sm font-black text-slate-900">Push Meldingen</p>
                          <p className="text-xs text-slate-500 font-medium">Dashboard alerts voor dringende zaken.</p>
                       </div>
                       <button 
                         onClick={() => setNotificationSettings({...notificationSettings, dashboardAlerts: !notificationSettings.dashboardAlerts})}
                         className={`w-14 h-8 rounded-full transition-all relative ${notificationSettings.dashboardAlerts ? 'bg-blue-600' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${notificationSettings.dashboardAlerts ? 'left-7' : 'left-1'}`}></div>
                       </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                          <p className="text-sm font-black text-slate-900">E-mail Notificaties</p>
                          <p className="text-xs text-slate-500 font-medium">Ontvang kopieën van belangrijke meldingen per mail.</p>
                       </div>
                       <button 
                         onClick={() => setNotificationSettings({...notificationSettings, emailNotifications: !notificationSettings.emailNotifications})}
                         className={`w-14 h-8 rounded-full transition-all relative ${notificationSettings.emailNotifications ? 'bg-blue-600' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${notificationSettings.emailNotifications ? 'left-7' : 'left-1'}`}></div>
                       </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                          <p className="text-sm font-black text-slate-900">Voorraadwaarschuwingen</p>
                          <p className="text-xs text-slate-500 font-medium">Melding wanneer onderdelen onder het minimum komen.</p>
                       </div>
                       <button 
                         onClick={() => setNotificationSettings({...notificationSettings, stockAlertsEnabled: !notificationSettings.stockAlertsEnabled})}
                         className={`w-14 h-8 rounded-full transition-all relative ${notificationSettings.stockAlertsEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${notificationSettings.stockAlertsEnabled ? 'left-7' : 'left-1'}`}></div>
                       </button>
                    </div>
                 </div>

                 <div className="flex justify-end pt-10 border-t border-slate-50">
                    <button 
                      onClick={handleSaveNotifications}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Voorkeuren Opslaan
                    </button>
                 </div>
               </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-1"
              >
                <AuditLogs />
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 space-y-8"
              >
                <div className="mb-6">
                   <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Veiligheid & Beveiliging</h2>
                   <p className="text-sm text-slate-500 font-medium">Configureer toegangsbeleid en veiligheidsinstellingen.</p>
                </div>

                <div className="space-y-6">
                   <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl space-y-6">
                      <div>
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Wachtwoordbeleid</h4>
                         <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center gap-3">
                               <CheckCircle2 className="w-4 h-4 text-green-500" />
                               <span className="text-xs font-bold text-slate-700">Minimaal 8 karakters</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <CheckCircle2 className="w-4 h-4 text-green-500" />
                               <span className="text-xs font-bold text-slate-700">Cijfers en letters verplicht</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <XCircle className="w-4 h-4 text-slate-300" />
                               <span className="text-xs font-bold text-slate-400">Speciale tekens (Optioneel)</span>
                            </div>
                         </div>
                      </div>

                      <div>
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Sessiebeheer</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sessieduur (uren)</label>
                               <input type="number" defaultValue={24} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Automatische uitlogtijd (min)</label>
                               <input type="number" defaultValue={60} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                            </div>
                         </div>
                      </div>
                   </div>

                   <button className="w-full p-6 bg-slate-900 text-white rounded-[2rem] flex items-center justify-between group">
                      <div className="text-left">
                         <p className="text-sm font-black italic">Tweestapsverificatie (2FA)</p>
                         <p className="text-[10px] text-slate-400 font-medium">Extra beveiligingslaag voor alle beheeraccounts.</p>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-all">
                         <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                   </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'system' && (
               <motion.div
                 key="system"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="p-10 space-y-8"
               >
                 <div>
                    <h2 className="text-xl font-black text-slate-900 italic mb-2 tracking-tight">Systeembeheer</h2>
                    <p className="text-sm text-slate-500 font-medium">Technische status en systeemacties.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] space-y-4">
                       <div className="flex items-center gap-3 text-blue-400">
                          <Database className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Database Status</span>
                       </div>
                       <p className="text-3xl font-black italic tracking-tight text-green-400">Gezond</p>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          Alle collecties zijn bereikbaar. Laatste back-up: Vandaag om 03:00.
                       </p>
                    </div>

                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] space-y-4">
                       <div className="flex items-center gap-3 text-slate-400">
                          <Download className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Data Export</span>
                       </div>
                       <p className="text-sm font-black text-slate-900">Back-up downloaden</p>
                       <button className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                          JSON Export (.zip)
                       </button>
                    </div>
                 </div>

                 <div className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Versie Informatie</p>
                       <p className="text-2xl font-black text-slate-900 italic">v2.4.1 <span className="text-sm font-bold text-blue-600 not-italic ml-2 uppercase tracking-widest">Stable</span></p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-bold text-slate-500">Omgeving</p>
                       <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Productie</p>
                    </div>
                 </div>
               </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Settings;
