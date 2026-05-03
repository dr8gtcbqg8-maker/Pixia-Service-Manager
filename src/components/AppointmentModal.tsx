import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, Customer, Machine, Reminder, Intervention } from '../types';
import { 
  X, Calendar, Clock, MapPin, AlignLeft, 
  User, Printer, AlertCircle, CheckCircle2,
  Trash2, Mail, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialData: {
    date?: string;
    reminderId?: string;
    interventionId?: string;
    customerId?: string;
    machineId?: string;
  };
  onSave: () => void;
  customers: Customer[];
  machines: Machine[];
  reminders: Reminder[];
  interventions: Intervention[];
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen, onClose, appointment, initialData, onSave,
  customers, machines, reminders, interventions
}) => {
  const [formData, setFormData] = useState<Partial<Appointment>>({
    title: '',
    customerId: '',
    machineId: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    type: 'general',
    priority: 'normal',
    location: '',
    description: '',
    internalNotes: '',
    status: 'planned',
    reminderId: '',
    interventionId: ''
  });

  useEffect(() => {
    if (appointment) {
      setFormData(appointment);
    } else {
      setFormData({
        title: '',
        customerId: initialData.customerId || '',
        machineId: initialData.machineId || '',
        date: initialData.date || new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        type: 'general',
        priority: 'normal',
        location: '',
        description: '',
        internalNotes: '',
        status: 'planned',
        reminderId: initialData.reminderId || '',
        interventionId: initialData.interventionId || ''
      });
    }
  }, [appointment, initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (appointment) {
        await updateDoc(doc(db, 'appointments', appointment.id), data);
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      onSave();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appointments');
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    if (confirm('Wilt u deze afspraak definitief verwijderen?')) {
      try {
        await deleteDoc(doc(db, 'appointments', appointment.id));
        onSave();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `appointments/${appointment.id}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-[2rem] md:rounded-[3.5rem] shadow-2xl overflow-y-auto"
        >
          <div className="p-6 md:p-10">
            <div className="flex items-center justify-between mb-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">
                  {appointment ? 'Afspraak Aanpassen' : 'Nieuwe Afspraak'}
                </h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Inplannen in de centrale agenda</p>
              </div>
              <div className="flex items-center gap-2">
                {appointment && (
                  <button onClick={handleDelete} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Onderwerp / Titel</label>
                  <input 
                    type="text"
                    required
                    placeholder="Bijv. Jaarlijks onderhoud bij Klant X"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Type Activiteit</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="general">Algemene Afspraak</option>
                    <option value="maintenance">Periodiek Onderhoud</option>
                    <option value="fault">Storing / Reparatie</option>
                    <option value="installation">Installatie</option>
                    <option value="follow-up">Follow-up / Controle</option>
                    <option value="warranty">Garantiebepaling</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Prioriteit</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  >
                    <option value="low">Laag</option>
                    <option value="normal">Normaal</option>
                    <option value="high">Hoog</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Klant</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value, machineId: '' })}
                  >
                    <option value="">Selecteer klant...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Machine (optioneel)</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    value={formData.machineId}
                    onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                  >
                    <option value="">Geen specifieke machine</option>
                    {machines.filter(m => m.customerId === formData.customerId).map(m => (
                      <option key={m.id} value={m.id}>{m.brand} {m.model} ({m.serialNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Datum</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date"
                      required
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Starttijd</label>
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="time"
                        required
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Eindtijd</label>
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="time"
                        required
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Status</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="planned">Ingepland</option>
                      <option value="confirmed">Bevestigd door klant</option>
                      <option value="on-route">Onderweg</option>
                      <option value="in-progress">In uitvoering / Bezig</option>
                      <option value="waiting-parts">Wacht op onderdelen</option>
                      <option value="waiting">Wachtend op klant</option>
                      <option value="completed">Afgerond</option>
                      <option value="cancelled">Geannuleerd</option>
                    </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Locatie</label>
                  <div className="relative">
                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Adres of werkplaats"
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Omschrijving / Details</label>
                  <textarea 
                    rows={3}
                    placeholder="Bijkomende details over de afspraak..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Interne Notities (niet zichtbaar voor klant)</label>
                  <textarea 
                    rows={2}
                    placeholder="Interne instructies, pincodes, etc..."
                    className="w-full px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-[2rem] font-bold text-sm focus:ring-4 focus:ring-amber-100 outline-none transition-all resize-none italic"
                    value={formData.internalNotes}
                    onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-6 animate-in slide-in-from-bottom-2 duration-700">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 rounded-[2rem] transition-all"
                >
                  Annuleren
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-3"
                >
                  <Calendar className="w-5 h-5" />
                  {appointment ? 'Afspraak Bijwerken' : 'Afspraak Bevestigen'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AppointmentModal;
