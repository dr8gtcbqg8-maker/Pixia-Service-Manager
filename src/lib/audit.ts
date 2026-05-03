import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AuditLog } from '../types';

export async function logAction(
  action: string, 
  entityType: AuditLog['entityType'], 
  entityId: string, 
  details: string = '',
  module: string = 'general'
) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const logData: Omit<AuditLog, 'id'> = {
      userId: user.uid,
      userEmail: user.email || 'unknown',
      userName: user.displayName || undefined,
      action,
      module,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'audit_logs'), logData);
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
