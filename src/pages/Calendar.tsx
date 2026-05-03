import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Appointment, Customer, Machine, Intervention, Reminder, 
  InterventionStatus, ReminderPriority, InventoryItem,
  AppointmentType, AppointmentPriority
} from '../types';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Clock, MapPin, User, Printer, AlertCircle, CheckCircle2, 
  X, Mail, Bell, Wrench, ShieldAlert, History, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, addDays, 
  startOfWeek, endOfWeek, parseISO, isToday
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/utils';
import AppointmentModal from '../components/AppointmentModal';

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    priority: 'all',
    customerId: 'all',
    search: ''
  });

  const [initialData, setInitialData] = useState<{
    date?: string;
    reminderId?: string;
    interventionId?: string;
    customerId?: string;
    machineId?: string;
  }>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appSnap, intSnap, machSnap, remSnap, custSnap, invSnap] = await Promise.all([
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'interventions')),
        getDocs(collection(db, 'machines')),
        getDocs(collection(db, 'reminders')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'inventory'))
      ]);

      setAppointments(appSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setInterventions(intSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Intervention)));
      setMachines(machSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
      setReminders(remSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
      setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setInventory(invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'calendar_data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Unified Event Mapper
  const getAllEvents = () => {
    const events: any[] = [];

    // 1. Explicit Appointments
    appointments.forEach(app => {
      events.push({
        ...app,
        sourceType: 'appointment',
        start: parseISO(`${app.date}T${app.startTime || '00:00'}`),
        end: parseISO(`${app.date}T${app.endTime || '23:59'}`),
      });
    });

    // 2. Interventions (not already linked to appointments)
    interventions.forEach(int => {
      const linkedApp = appointments.find(a => a.interventionId === int.id);
      if (!linkedApp) {
        events.push({
          id: int.id,
          title: `Interventie: ${int.type}`,
          customerId: int.customerId,
          machineId: int.machineId,
          date: int.date,
          startTime: '09:00',
          endTime: '10:00',
          type: int.type as AppointmentType,
          priority: int.priority || 'normal',
          status: int.status === 'completed' ? 'completed' : int.status === 'planned' ? 'planned' : 'waiting',
          description: int.problemDescription,
          interventionId: int.id,
          sourceType: 'intervention',
          start: parseISO(`${int.date}T09:00`),
          end: parseISO(`${int.date}T10:00`),
        });
      }
    });

    // 3. Reminders (not already linked to appointments)
    reminders.forEach(rem => {
      const linkedApp = appointments.find(a => a.reminderId === rem.id);
      if (!linkedApp) {
        events.push({
          id: rem.id,
          title: `Herinnering: ${rem.title}`,
          customerId: rem.customerId,
          machineId: rem.machineId,
          date: rem.dueDate,
          startTime: '08:00',
          endTime: '08:30',
          type: 'follow-up', // Default for reminders
          priority: rem.priority,
          status: rem.status === 'executed' ? 'completed' : 'planned',
          description: rem.description,
          reminderId: rem.id,
          sourceType: 'reminder',
          start: parseISO(`${rem.dueDate}T08:00`),
          end: parseISO(`${rem.dueDate}T08:30`),
        });
      }
    });

    // 4. Warranties & Next Maintenance (as milestones)
    machines.forEach(m => {
      if (m.nextMaintenanceDate) {
        events.push({
          id: `maint-${m.id}`,
          title: `Onderhoud: ${m.brand} ${m.model}`,
          customerId: m.customerId,
          machineId: m.id,
          date: m.nextMaintenanceDate,
          startTime: '10:00',
          endTime: '11:00',
          type: 'maintenance',
          priority: 'high',
          status: 'planned',
          description: `Periodiek onderhoud voor machine ${m.serialNumber}`,
          sourceType: 'machine_milestone',
          start: parseISO(`${m.nextMaintenanceDate}T10:00`),
          end: parseISO(`${m.nextMaintenanceDate}T11:00`),
        });
      }
      if (m.warrantyEndDate) {
        events.push({
          id: `warranty-${m.id}`,
          title: `Garantie Verloopt: ${m.brand} ${m.model}`,
          customerId: m.customerId,
          machineId: m.id,
          date: m.warrantyEndDate,
          startTime: '09:00',
          endTime: '09:30',
          type: 'warranty',
          priority: 'urgent',
          status: 'waiting',
          description: `Einde garantieperiode voor machine ${m.serialNumber}`,
          sourceType: 'machine_milestone',
          start: parseISO(`${m.warrantyEndDate}T09:00`),
          end: parseISO(`${m.warrantyEndDate}T09:30`),
        });
      }
    });

    // 5. Stock Alerts
    inventory.forEach(item => {
      if (item.stockCount <= item.minStock && item.status === 'active') {
        events.push({
          id: `stock-${item.id}`,
          title: `Lage Voorraad: ${item.name}`,
          date: format(new Date(), 'yyyy-MM-dd'), // Today as milestone
          startTime: '08:00',
          endTime: '09:00',
          type: 'stock',
          priority: 'high',
          status: 'waiting',
          description: `Voorraad van ${item.name} is ${item.stockCount}, minimum is ${item.minStock}.`,
          sourceType: 'stock_alert',
          start: parseISO(`${format(new Date(), 'yyyy-MM-dd')}T08:00`),
          end: parseISO(`${format(new Date(), 'yyyy-MM-dd')}T09:00`),
        });
      }
    });

    // Filters
    return events.filter(e => {
      if (filters.type !== 'all' && e.type !== filters.type) return false;
      if (filters.status !== 'all' && e.status !== filters.status) return false;
      if (filters.priority !== 'all' && e.priority !== filters.priority) return false;
      if (filters.customerId !== 'all' && e.customerId !== filters.customerId) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          e.title.toLowerCase().includes(search) ||
          e.description?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  };

  const filteredEvents = getAllEvents();

  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayEvents = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return filteredEvents.filter(e => e.date === dayStr);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setDetailPanelOpen(true);
  };

  const getEventStyle = (type: AppointmentType) => {
    switch (type) {
      case 'maintenance': return 'bg-blue-50 border-blue-100 text-blue-700';
      case 'fault': return 'bg-rose-50 border-rose-100 text-rose-700';
      case 'installation': return 'bg-indigo-50 border-indigo-100 text-indigo-700';
      case 'follow-up': return 'bg-amber-50 border-amber-100 text-amber-700';
      case 'warranty': return 'bg-purple-50 border-purple-100 text-purple-700';
      case 'contract': return 'bg-emerald-50 border-emerald-100 text-emerald-700';
      case 'stock': return 'bg-orange-50 border-orange-100 text-orange-700';
      default: return 'bg-slate-50 border-slate-100 text-slate-700';
    }
  };

  const getEventIcon = (type: AppointmentType) => {
    switch (type) {
      case 'maintenance': return History;
      case 'fault': return AlertCircle;
      case 'installation': return Wrench;
      case 'follow-up': return Bell;
      case 'warranty': return ShieldAlert;
      case 'contract': return CheckCircle2;
      case 'stock': return Plus;
      default: return CalendarIcon;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-400">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Planning & Agenda</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tight">Service Kalender</h1>
            <p className="text-slate-400 text-sm font-medium">Beheer alle werkzaamheden en afspraken.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="bg-white/10 p-1.5 rounded-2xl flex items-center gap-1">
                {(['month', 'week', 'day', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      viewMode === mode ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {mode === 'month' ? 'Maand' : mode === 'week' ? 'Week' : mode === 'day' ? 'Dag' : 'Lijst'}
                  </button>
                ))}
             </div>
             <button 
              onClick={() => {
                setSelectedAppointment(null);
                setInitialData({});
                setIsModalOpen(true);
              }}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all shadow-xl active:scale-95 flex items-center gap-2"
             >
                <Plus className="w-4 h-4" />
                Nieuwe Afspraak
             </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <input 
            type="text"
            placeholder="Zoeken op titel..."
            className="w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select 
          className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">Alle Types</option>
          <option value="maintenance">Onderhoud</option>
          <option value="fault">Storing</option>
          <option value="installation">Installatie</option>
          <option value="follow-up">Follow-up</option>
          <option value="warranty">Garantie</option>
        </select>
        <select 
          className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="all">Alle Statussen</option>
          <option value="planned">Gepland</option>
          <option value="in-progress">Bezig</option>
          <option value="completed">Afgerond</option>
          <option value="waiting">Wacht op klant</option>
        </select>
      </div>

      {/* Calendar Content */}
      <div className="bg-white border border-slate-100 rounded-[3.5rem] shadow-sm overflow-hidden">
        {/* Navigation Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-900 capitalize italic tracking-tight">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: nl }) : 
             viewMode === 'week' ? `Week ${format(currentDate, 'w')}, ${format(currentDate, 'yyyy')}` :
             format(currentDate, 'd MMMM yyyy', { locale: nl })}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={prev} className="p-3 hover:bg-white rounded-2xl text-slate-400 border border-transparent hover:border-slate-200 transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
            >
              Vandaag
            </button>
            <button onClick={next} className="p-3 hover:bg-white rounded-2xl text-slate-400 border border-transparent hover:border-slate-200 transition-all">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Views */}
        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 border-b border-slate-100">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100">
              {calendarDays.map((day) => {
                const dayEvents = getDayEvents(day);
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`min-h-[160px] p-2 border-r border-b border-slate-50 last:border-r-0 relative group transition-all hover:bg-slate-50/50 ${!isSameMonth(day, currentDate) ? 'bg-slate-50/20 opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2 p-1">
                      <span className={`text-xs font-black p-1.5 rounded-lg w-8 h-8 flex items-center justify-center ${isToday(day) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayEvents.map(event => {
                        const Icon = getEventIcon(event.type);
                        return (
                          <button 
                            key={event.id} 
                            onClick={() => handleEventClick(event)}
                            className={`w-full text-left p-1.5 border rounded-lg text-[9px] font-bold truncate transition-all flex items-center gap-1 ${getEventStyle(event.type)}`}
                          >
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            {event.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <div className="flex flex-col">
            <div className="grid grid-cols-8 border-b border-slate-100">
              <div className="p-4 border-r border-slate-50 overflow-hidden"></div>
              {eachDayOfInterval({ 
                start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
                end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
              }).map(day => (
                <div key={day.toISOString()} className="p-4 text-center border-r border-slate-50 last:border-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(day, 'eee', { locale: nl })}</p>
                  <p className={`text-sm font-black mt-1 ${isToday(day) ? 'text-blue-600' : 'text-slate-900'}`}>{format(day, 'd MMM')}</p>
                </div>
              ))}
            </div>
            <div className="max-h-[800px] overflow-y-auto">
              <div className="grid grid-cols-8">
                <div className="border-r border-slate-50 bg-slate-50/30">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-20 border-b border-slate-100 p-2 text-right">
                       <span className="text-[10px] font-black text-slate-300">{i}:00</span>
                    </div>
                  ))}
                </div>
                {eachDayOfInterval({ 
                  start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
                  end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
                }).map(day => (
                  <div key={day.toISOString()} className="relative border-r border-slate-50 last:border-0 bg-white min-h-[1920px]">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="h-20 border-b border-slate-100"></div>
                    ))}
                    {getDayEvents(day).map(event => {
                      const startHour = event.start.getHours();
                      const startMinutes = event.start.getMinutes();
                      const endHour = event.end.getHours();
                      const endMinutes = event.end.getMinutes();
                      const top = (startHour * 80) + (startMinutes * (80/60));
                      const height = Math.max(40, ((endHour * 80) + (endMinutes * (80/60))) - top);
                      const Icon = getEventIcon(event.type);

                      return (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`absolute left-1 right-1 p-2 border rounded-xl text-[9px] font-black shadow-sm overflow-hidden flex flex-col gap-1 transition-all hover:shadow-lg hover:z-10 ${getEventStyle(event.type)}`}
                          style={{ top, height }}
                        >
                          <div className="flex items-center gap-1">
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{event.title}</span>
                          </div>
                          <span className="opacity-60">{format(event.start, 'HH:mm')}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'day' && (
          <div className="flex flex-col">
            <div className="max-h-[800px] overflow-y-auto">
              <div className="grid grid-cols-[100px_1fr]">
                <div className="border-r border-slate-50 bg-slate-50/30">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-24 border-b border-slate-100 p-4 text-right">
                       <span className="text-xs font-black text-slate-300 italic">{i}:00</span>
                    </div>
                  ))}
                </div>
                <div className="relative bg-white min-h-[2304px]">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-24 border-b border-slate-100"></div>
                  ))}
                  {getDayEvents(currentDate).map(event => {
                    const startHour = event.start.getHours();
                    const startMinutes = event.start.getMinutes();
                    const endHour = event.end.getHours();
                    const endMinutes = event.end.getMinutes();
                    const top = (startHour * 96) + (startMinutes * (96/60));
                    const height = Math.max(60, ((endHour * 96) + (endMinutes * (96/60))) - top);
                    const Icon = getEventIcon(event.type);

                    return (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className={`absolute left-4 right-4 p-4 border rounded-2xl text-xs font-black shadow-md overflow-hidden flex flex-col gap-1 transition-all hover:shadow-xl hover:z-10 ${getEventStyle(event.type)}`}
                        style={{ top, height }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate text-base">{event.title}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 opacity-70">
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                           <span className="flex items-center gap-1 uppercase tracking-widest text-[10px]"><MapPin className="w-3 h-3" /> {event.location || 'Geen locatie'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="divide-y divide-slate-50">
            {filteredEvents.length === 0 ? (
              <div className="p-20 text-center text-slate-400 font-medium">Geen items gevonden voor deze selectie.</div>
            ) : (
              filteredEvents
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .map(event => {
                  const Icon = getEventIcon(event.type);
                  const customer = customers.find(c => c.id === event.customerId);
                  return (
                    <div 
                      key={event.id} 
                      onClick={() => handleEventClick(event)}
                      className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[60px]">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(event.start, 'MMM')}</p>
                           <p className="text-2xl font-black italic text-slate-900">{format(event.start, 'd')}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${getEventStyle(event.type)}`}>
                           <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{event.title}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <Clock className="w-3 h-3" />
                              {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                            </span>
                            {customer && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                <User className="w-3 h-3" />
                                {customer.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        initialData={initialData}
        onSave={() => {
          fetchData();
          setIsModalOpen(false);
        }}
        customers={customers}
        machines={machines}
        reminders={reminders}
        interventions={interventions}
      />

      <DetailSidePanel 
        isOpen={detailPanelOpen}
        onClose={() => setDetailPanelOpen(false)}
        event={selectedEvent}
        onEdit={() => {
          if (selectedEvent.sourceType === 'appointment') {
            setSelectedAppointment(selectedEvent);
            setIsModalOpen(true);
            setDetailPanelOpen(false);
          }
        }}
        onRefresh={fetchData}
        customers={customers}
        machines={machines}
      />
    </div>
  );
};

// --- Helper Component: DetailSidePanel ---
const DetailSidePanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onEdit: () => void;
  onRefresh: () => void;
  customers: Customer[];
  machines: Machine[];
}> = ({ isOpen, onClose, event, onEdit, onRefresh, customers, machines }) => {
  if (!event) return null;

  const customer = customers.find(c => c.id === event.customerId);
  const machine = machines.find(m => m.id === event.machineId);
  const navigate = useNavigate();

  const handleStatusChange = async (newStatus: any) => {
    try {
      const collectionName = event.sourceType === 'reminder' ? 'reminders' : 
                            event.sourceType === 'intervention' ? 'interventions' : 
                            'appointments';
      const docRef = doc(db, collectionName, event.id);
      await updateDoc(docRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      onRefresh();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'status_update');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white z-[120] shadow-2xl overflow-y-auto"
          >
            <div className="p-8">
               <div className="flex items-center justify-between mb-8">
                  <div className="bg-slate-100 p-2 rounded-xl text-slate-500">
                    {event.sourceType === 'appointment' ? <CalendarIcon className="w-5 h-5" /> : 
                     event.sourceType === 'intervention' ? <Wrench className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
               </div>

               <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                         event.priority === 'urgent' ? 'bg-red-500 text-white' :
                         event.priority === 'high' ? 'bg-orange-500 text-white' :
                         'bg-blue-500 text-white'
                       }`}>
                          {event.priority}
                       </span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.type}</span>
                    </div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 leading-tight">{event.title}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Datum</p>
                       <p className="font-bold text-slate-900">{format(event.start, 'd MMMM yyyy', { locale: nl })}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tijd</p>
                       <p className="font-bold text-slate-900">{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</p>
                    </div>
                  </div>

                  {customer && (
                    <div className="space-y-4">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Klant & Locatie</h3>
                       <div className="flex items-start gap-4 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl">
                          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">{customer.name}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location || customer.address || 'Geen locatie opgegeven'}
                            </p>
                          </div>
                          <button 
                            onClick={() => navigate('/customers')}
                            className="p-3 bg-white border border-slate-200 rounded-xl text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                            title="Klant openen"
                          >
                             <ChevronRight className="w-5 h-5" />
                          </button>
                       </div>
                    </div>
                  )}

                  {machine && (
                    <div className="space-y-4">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Betrokken Machine</h3>
                       <div className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl text-white">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                            <Printer className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold italic">{machine.brand} {machine.model}</p>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">SN: {machine.serialNumber}</p>
                          </div>
                          <button 
                            onClick={() => navigate('/machines')}
                            className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
                            title="Machine openen"
                          >
                             <ChevronRight className="w-5 h-5" />
                          </button>
                       </div>
                    </div>
                  )}

                  <div className="space-y-4">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status & Acties</h3>
                     <div className="flex flex-wrap gap-2">
                        {['planned', 'in-progress', 'completed', 'waiting'].map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              event.status === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Omschrijving</h3>
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                        {event.description || 'Geen omschrijving beschikbaar.'}
                      </p>
                    </div>
                  </div>

                  {(event.interventionId || event.reminderId) && (
                    <div className="space-y-4">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Gekoppelde Items</h3>
                       <div className="space-y-2">
                          {event.interventionId && (
                            <button 
                              onClick={() => navigate('/interventions')}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-blue-200 transition-all text-left"
                            >
                               <div className="flex items-center gap-3">
                                  <Wrench className="w-4 h-4 text-blue-600" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Interventie Bekijken</span>
                               </div>
                               <ChevronRight className="w-4 h-4 text-slate-300" />
                            </button>
                          )}
                          {event.reminderId && (
                            <button 
                              onClick={() => navigate('/reminders')}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-blue-200 transition-all text-left"
                            >
                               <div className="flex items-center gap-3">
                                  <Bell className="w-4 h-4 text-amber-600" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Herinnering Bekijken</span>
                               </div>
                               <ChevronRight className="w-4 h-4 text-slate-300" />
                            </button>
                          )}
                       </div>
                    </div>
                  )}

                  {event.internalNotes && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Interne Notities</h3>
                      <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-3xl">
                        <p className="text-sm font-medium text-amber-900 leading-relaxed">
                          {event.internalNotes}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-100 flex gap-4">
                     <button 
                       onClick={onEdit}
                       className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95"
                     >
                       Bewerken
                     </button>
                     <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
                        <Trash2 className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Calendar;
