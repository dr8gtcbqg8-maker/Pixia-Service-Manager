import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { UserProfile, UserRole, UserStatus } from '../types';
import { 
  UserPlus, Search, Edit2, Trash2, Shield, 
  Mail, Phone, Calendar, Clock, MoreVertical,
  CheckCircle2, XCircle, Send, Key, UserMinus, UserCheck,
  ChevronRight, ArrowRight, Notebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logAction } from '../lib/utils';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
  onSave: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user, onSave }) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>(
    user || {
      displayName: '',
      email: '',
      phone: '',
      role: 'technician' as UserRole,
      status: 'invited' as UserStatus,
      internalNotes: ''
    }
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(user);
    } else {
      setFormData({
        displayName: '',
        email: '',
        phone: '',
        role: 'technician',
        status: 'invited',
        internalNotes: ''
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (user) {
        // Update
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        await logAction('Gebruiker gewijzigd', 'users', 'user', `Gebruiker ${formData.email} aangepast`, user.uid);
      } else {
        // Invite/Create
        // Since we don't have server-side auth creation here, we use a random ID or the email as ID for the profile doc
        // In a real app, you'd use a cloud function to create the auth user
        const tempId = `temp-${Date.now()}`;
        const userRef = doc(db, 'users', tempId);
        const newProfile: UserProfile = {
          uid: tempId,
          email: formData.email!,
          displayName: formData.displayName,
          phone: formData.phone,
          role: formData.role || 'technician',
          status: 'invited',
          internalNotes: formData.internalNotes,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        await logAction('Gebruiker uitgenodigd', 'users', 'user', `Nieuwe gebruiker ${formData.email} uitgenodigd als ${formData.role}`, tempId);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving user:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-slate-900 italic tracking-tight">
                {user ? 'Gebruiker Bewerken' : 'Gebruiker Uitnodigen'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">Beheer toegangsrechten en profielgegevens.</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <XCircle className="w-6 h-6 text-slate-300" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Volledige Naam</label>
              <input 
                required
                type="text" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Adres</label>
              <input 
                required
                type="email" 
                readOnly={!!user}
                className={`w-full px-6 py-4 border border-slate-200 rounded-2xl font-bold text-sm outline-none transition-all ${user ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:ring-4 focus:ring-blue-100'}`}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rol</label>
                <select 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <option value="admin">Hoofdgebruiker / Admin</option>
                  <option value="technician">Technicus</option>
                  <option value="planner">Planner</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                <select 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as UserStatus })}
                >
                  <option value="active">Actief</option>
                  <option value="inactive">Inactief / Gedeactiveerd</option>
                  <option value="invited">Uitgenodigd</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefoonnummer</label>
              <input 
                type="tel" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Interne Notitie</label>
              <textarea 
                rows={2}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                value={formData.internalNotes}
                onChange={e => setFormData({ ...formData, internalNotes: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50"
            >
              {isSaving ? 'Bezig...' : user ? 'Wijzigingen Opslaan' : 'Uitnodiging Versturen'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | undefined>();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeactivate = async (user: UserProfile) => {
    if (!window.confirm(`Weet u zeker dat u ${user.displayName} wilt deactiveren?`)) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: 'inactive',
        updatedAt: new Date().toISOString()
      });
      await logAction('Gebruiker gedeactiveerd', 'users', 'user', `Toegang voor ${user.email} ingetrokken`, user.uid);
      fetchUsers();
    } catch (err) {
      console.error('Error deactivating user:', err);
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (!window.confirm(`WAARSCHUWING: Weet u zeker dat u ${user.displayName} definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await logAction('Gebruiker verwijderd', 'users', 'user', `Account ${user.email} definitief verwijderd`, user.uid);
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: UserStatus) => {
    switch(status) {
      case 'active':
        return <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest border border-green-100 flex items-center gap-1.5"><UserCheck className="w-3 h-3" /> Actief</span>;
      case 'inactive':
        return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest border border-slate-200 flex items-center gap-1.5"><UserMinus className="w-3 h-3" /> Inactief</span>;
      case 'invited':
        return <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-1.5"><Send className="w-3 h-3" /> Uitgenodigd</span>;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch(role) {
      case 'admin': return 'Admin';
      case 'technician': return 'Technicus';
      case 'planner': return 'Planner';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Zoek gebruikers op naam of email..."
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setSelectedUser(undefined);
            setIsModalOpen(true);
          }}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Nieuwe Gebruiker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-50 rounded-[2rem] animate-pulse"></div>
          ))
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
               <UserMinus className="w-8 h-8" />
            </div>
            <div>
               <p className="text-slate-900 font-bold">Geen gebruikers gevonden</p>
               <p className="text-slate-500 text-xs">Pas uw zoekfilter aan of voeg een nieuwe gebruiker toe.</p>
            </div>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.uid} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                <button 
                  onClick={() => {
                    setSelectedUser(user);
                    setIsModalOpen(true);
                  }}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  title="Bewerken"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {user.status === 'active' && (
                  <button 
                    onClick={() => handleDeactivate(user)}
                    className="p-2 bg-slate-100 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                    title="Deactiveren"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(user)}
                  className="p-2 bg-slate-100 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                  title="Verwijderen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-black text-slate-400 border-2 border-white shadow-sm shrink-0 uppercase">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 pr-12">
                  <h3 className="font-bold text-slate-900 truncate tracking-tight">{user.displayName || 'Gebruiker'}</h3>
                  <p className="text-xs text-slate-400 truncate font-medium">{user.email}</p>
                  <div className="mt-2 text-[10px] font-black uppercase text-blue-600 tracking-widest inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-lg">
                    <Shield className="w-3 h-3" />
                    {getRoleLabel(user.role)}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between">
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
                      {getStatusBadge(user.status)}
                   </div>
                   <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Laatste Login</span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1 justify-end italic">
                        <Clock className="w-3 h-3" />
                         {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('nl-NL') : 'Nooit'}
                      </span>
                   </div>
                </div>

                <div className="space-y-3">
                   {user.phone && (
                     <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{user.phone}</span>
                     </div>
                   )}
                   <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Lid sinds {new Date(user.createdAt).toLocaleDateString('nl-NL')}</span>
                   </div>
                </div>

                {user.internalNotes && (
                   <div className="p-3 bg-slate-50 rounded-xl border-l-2 border-slate-300">
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 mb-1">
                        <Notebook className="w-3 h-3" /> Notitie
                      </div>
                      <p className="text-[10px] text-slate-600 italic line-clamp-2 leading-relaxed">{user.internalNotes}</p>
                   </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <UserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onSave={fetchUsers}
      />
    </div>
  );
};

export default UserManager;
