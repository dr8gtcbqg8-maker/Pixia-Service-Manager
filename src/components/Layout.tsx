import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Printer, 
  Wrench, 
  Package, 
  Bell, 
  Menu, 
  X,
  LogOut,
  Settings,
  Plus,
  ClipboardList,
  FileText,
  Calendar,
  Briefcase,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BusinessSettings } from '../types';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'technician'] },
  { name: 'Vandaag', icon: Clock, path: '/vandaag', roles: ['technician', 'admin'] },
  // { name: 'Klantportaal', icon: Briefcase, path: '/customer-portal', roles: ['customer'] },
  { name: 'Agenda', icon: Calendar, path: '/calendar', roles: ['admin', 'technician'] },
  { name: 'Klanten', icon: Users, path: '/customers', roles: ['admin', 'technician'] },
  { name: 'Machines', icon: Printer, path: '/machines', roles: ['admin', 'technician'] },
  { name: 'Audit Logs', icon: ShieldCheck, path: '/audit-logs', roles: ['admin'] },
  { name: 'Interventies', icon: Wrench, path: '/interventions', roles: ['admin', 'technician'] },
  { name: 'Werkbonnen', icon: ClipboardList, path: '/work-orders', roles: ['admin', 'technician'] },
  { name: 'Notificaties', icon: Bell, path: '/notifications', roles: ['admin', 'technician'] },
  { name: 'Voorraad', icon: Package, path: '/inventory', roles: ['admin', 'technician'] },
  { name: 'Reminders', icon: Bell, path: '/reminders', roles: ['admin', 'technician'] },
  { name: 'Instellingen', icon: Settings, path: '/settings', roles: ['admin', 'technician', 'customer'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const location = useLocation();
  const { user, profile, logout } = useAuth();

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'business'));
        if (docSnap.exists()) {
          setBusinessSettings(docSnap.data() as BusinessSettings);
        }
      } catch (err) {
        console.error('Error fetching business settings for layout:', err);
      }
    };
    fetchBusiness();
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="shrink-0">
                {businessSettings?.logoUrl ? (
                  <img src={businessSettings.logoUrl} alt="Company Logo" className="w-10 h-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:scale-110 transition-transform">
                    <Printer className="text-white w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-sm tracking-tight text-white truncate leading-none uppercase">
                  {businessSettings?.name || 'Pixia Manager'}
                </span>
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1">
                  Service Platform
                </span>
              </div>
            </Link>
            <button onClick={toggleSidebar} className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems
              .filter(item => !item.roles || item.roles.includes(profile?.role || 'technician'))
              .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium",
                    isActive 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-white" : "text-slate-500"
                  )} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 mt-auto border-t border-slate-800">
            <div className="flex items-center space-x-3 px-1 mb-4">
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">
                {profile?.displayName?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate">
                  {profile?.displayName || user?.displayName || 'Jan de Vries'}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {profile?.role === 'admin' ? 'Hoofdgebruiker' : profile?.role === 'customer' ? 'Klant' : 'Technicus'}
                </span>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center space-x-3 px-3 py-2 text-slate-400 hover:bg-red-900/30 hover:text-red-400 rounded-md transition-colors text-xs font-bold uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              <span>Uitloggen</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <button onClick={toggleSidebar} className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-64 xl:w-96 hidden md:block">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Menu className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                placeholder="Zoek op klant of serienummer..." 
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <Link 
              to="/interventions"
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nieuwe Interventie</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-[1400px] mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};
