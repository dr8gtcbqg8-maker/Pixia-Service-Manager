import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

import { auth, db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { AuditLog, MaintenanceInterval } from '../types';
import { addMonths, format, parseISO, isValid } from 'date-fns';

export function calculateNextMaintenanceDate(args: {
  installDate?: string;
  lastMaintenanceDate?: string;
  maintenanceInterval: MaintenanceInterval;
  firstMaintenanceMonths?: number;
}): string | undefined {
  const { installDate, lastMaintenanceDate, maintenanceInterval, firstMaintenanceMonths } = args;

  if (maintenanceInterval === 'manual') return undefined;

  let basisDate: Date;
  
  if (lastMaintenanceDate) {
    basisDate = parseISO(lastMaintenanceDate);
  } else if (installDate) {
    basisDate = parseISO(installDate);
    if (firstMaintenanceMonths && firstMaintenanceMonths > 0) {
      if (basisDate && isValid(basisDate)) {
        return format(addMonths(basisDate, firstMaintenanceMonths), 'yyyy-MM-dd');
      }
    }
  } else {
    return undefined;
  }

  if (!basisDate || !isValid(basisDate)) return undefined;

  let monthsToAdd = 0;
  switch (maintenanceInterval) {
    case 'monthly': monthsToAdd = 1; break;
    case 'quarterly': monthsToAdd = 3; break;
    case 'half-yearly': monthsToAdd = 6; break;
    case 'annual': monthsToAdd = 12; break;
    default: return undefined;
  }

  return format(addMonths(basisDate, monthsToAdd), 'yyyy-MM-dd');
}

export async function logAction(
  action: string,
  module: string,
  entityType: AuditLog['entityType'],
  details: string,
  entityId?: string
) {
  try {
    if (!auth.currentUser) return;

    const log: Omit<AuditLog, 'id'> = {
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email || 'unknown',
      userName: auth.currentUser.displayName || null,
      action,
      module,
      entityType,
      entityId: entityId || null,
      details,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'audit_logs'), log);
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
