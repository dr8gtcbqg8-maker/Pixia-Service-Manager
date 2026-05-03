export type UserRole = 'admin' | 'technician' | 'planner' | 'viewer' | 'customer';

export type UserStatus = 'active' | 'inactive' | 'invited';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  customerId?: string; 
  lastLogin?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  billingAddress?: string;
  locations?: string[];
  notes?: string;
  internalNotes?: string;
  status: 'active' | 'inactive' | 'lead' | 'prospect';
  createdAt: string;
}

export type MachineType = 'printer' | 'laminator' | 'other';
export type MaintenanceInterval = 'monthly' | 'quarterly' | 'half-yearly' | 'annual' | 'manual';
export type MachineStatus = 'active' | 'maintenance-needed' | 'faulty' | 'out-of-service' | 'replaced';

export interface Machine {
  id: string;
  customerId: string;
  type: MachineType;
  brand: string;
  model: string;
  serialNumber: string;
  saleDate?: string;
  installDate?: string;
  warrantyPeriodMonths?: number;
  warrantyEndDate?: string;
  hasServiceContract: boolean;
  maintenanceInterval: MaintenanceInterval;
  firstMaintenanceMonths?: number;
  autoScheduleEnabled: boolean;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  location?: string;
  status: MachineStatus;
  notes?: string;
  internalNotes?: string;
  qrCodeUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export type InterventionType = 'maintenance' | 'fault' | 'installation' | 'inspection' | 'warranty' | 'training' | 'other';
export type InterventionStatus = 'to-be-scheduled' | 'planned' | 'on-route' | 'in-progress' | 'waiting-parts' | 'completed' | 'cancelled';

export type WorkOrderStatus = 'draft' | 'in-progress' | 'awaiting-signature' | 'completed';

export interface WorkOrder {
  id: string;
  orderNumber: string;
  date: string;
  customerId: string;
  machineId: string;
  interventionId: string;
  technicianName: string;
  type: InterventionType;
  workDescription: string;
  partsUsed: { 
    itemId?: string;
    name: string; 
    quantity: number;
    unitPrice?: number;
  }[];
  hoursWorked: number;
  travelTime: number;
  notes?: string;
  clientName?: string;
  clientSignature?: string; // Base64 image
  technicianSignature?: string; // Base64 image
  signedAt?: string;
  status: WorkOrderStatus;
  stockProcessed?: boolean;
  emailSentAt?: string;
  emailStatus?: 'pending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface Intervention {
  id: string;
  machineId: string;
  customerId: string;
  technicianId?: string;
  technicianName?: string;
  date: string;
  time?: string;
  startedAt?: string;
  type: InterventionType;
  priority: ReminderPriority;
  problemDescription?: string;
  workPerformed?: string;
  partsUsed?: { 
    itemId?: string; 
    name: string;
    quantity: number; 
    unitPrice?: number;
  }[];
  hoursWorked?: number;
  travelTime?: number;
  status: InterventionStatus;
  followUpAction?: string;
  nextMaintenanceDate?: string;
  stockProcessed?: boolean;
  internalNotes?: string;
  customerNotes?: string;
  createdAt: string;
}

export interface AppDocument {
  id: string;
  name: string;
  type: string; // mime type
  category: 'invoice' | 'installation' | 'work-order' | 'photo' | 'serial-plate' | 'fault' | 'manual' | 'warranty' | 'report' | 'other';
  url: string; // Base64 or mock URL
  customerId?: string;
  machineId?: string;
  interventionId?: string;
  workOrderId?: string;
  description?: string;
  uploadDate: string;
  fileSize: number;
}

export type AppointmentType = 'maintenance' | 'fault' | 'installation' | 'follow-up' | 'warranty' | 'contract' | 'stock' | 'general' | 'other';
export type AppointmentPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Appointment {
  id: string;
  title: string;
  customerId: string;
  machineId?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  priority: AppointmentPriority;
  location: string;
  description: string;
  internalNotes?: string;
  status: 'planned' | 'confirmed' | 'cancelled' | 'completed' | 'in-progress' | 'waiting' | 'on-route' | 'waiting-parts';
  reminderId?: string;
  interventionId?: string;
  outlookEventId?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  syncedAt?: string;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'appointment_confirmation' | 'maintenance_reminder' | 'intervention_confirmation' | 'work_order' | 'follow_up' | 'warranty_warning' | 'contract_warning' | 'stock_alert';
  active: boolean;
  placeholders: string[]; 
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  timestamp: string;
  recipient: string;
  subject: string;
  customerId?: string;
  machineId?: string;
  interventionId?: string;
  workOrderId?: string;
  status: 'draft' | 'sent' | 'failed';
  error?: string;
}

export interface OutlookConnection {
  id: string;
  userId: string;
  account: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  type: string;
  templateId: string;
  active: boolean;
  triggerDays?: number;
  manualCheck: boolean;
  recipientType: 'customer' | 'technician' | 'admin';
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  action: string;
  module: string; // e.g. 'users', 'customers', 'machines', 'auth'
  entityType: 'customer' | 'machine' | 'intervention' | 'work_order' | 'document' | 'inventory' | 'auth' | 'settings' | 'user';
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface BusinessSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  kvk: string;
  btw: string;
  logoUrl?: string;
  defaultEmailSender: string;
  defaultWorkOrderTerms: string;
}

export interface AppSettings {
  language: 'nl' | 'en';
  dateFormat: string;
  timezone: string;
  maintenanceIntervalDefault: number; // in months
  warrantyWarningDays: number;
  stockWarningThreshold: number;
  workOrderPrefix: string;
  interventionPrefix: string;
}

export interface NotificationSettings {
  remindersEnabled: boolean;
  emailNotifications: boolean;
  dashboardAlerts: boolean;
  maintenanceReminderDays: number;
  warrantyReminderDays: number;
  stockAlertsEnabled: boolean;
}

export interface SecuritySettings {
  passwordPolicy: string;
  twoFactorEnabled: boolean;
  sessionDurationMode: 'hours' | 'days';
  sessionDuration: number;
  autoLogoutTime: number; // in minutes
}

export type MutationType = 'increase' | 'decrease' | 'correction' | 'intervention';

export interface InventoryMutation {
  id: string;
  itemId: string;
  type: MutationType;
  quantity: number;
  reason?: string;
  interventionId?: string;
  technicianName?: string;
  timestamp: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  partNumber: string;
  supplier: string;
  stockCount: number;
  minStock: number;
  location: string;
  purchasePrice: number;
  sellingPrice: number;
  notes: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ReminderType = 'maintenance' | 'warranty' | 'contract' | 'call' | 'follow-up' | 'stock' | 'other';

export interface Reminder {
  id: string;
  title: string;
  description: string;
  customerId?: string;
  machineId?: string;
  interventionId?: string;
  dueDate: string;
  priority: ReminderPriority;
  status: 'open' | 'planned' | 'executed' | 'ignored';
  type: ReminderType;
  internalNotes?: string;
  createdAt: string;
}

export type AlertPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AlertStatus = 'open' | 'seen' | 'resolved' | 'dismissed';

export interface SmartAlert {
  id: string;
  title: string;
  description: string;
  priority: AlertPriority;
  status: AlertStatus;
  type: 'stock' | 'maintenance' | 'warranty' | 'failure' | 'inactivity';
  relatedId?: string;
  createdAt: string;
  updatedAt: string;
}

