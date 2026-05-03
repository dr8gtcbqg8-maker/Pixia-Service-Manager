import { 
  collection, query, where, getDocs, addDoc, updateDoc, doc, 
  Timestamp, serverTimestamp, getDoc, limit, orderBy 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { OutlookConnection, Appointment, Intervention } from '../types';

const CLIENT_ID = (import.meta as any).env.VITE_MICROSOFT_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

export const outlookService = {
  async getConnection(): Promise<OutlookConnection | null> {
    if (!auth.currentUser) return null;
    const q = query(collection(db, 'outlook_connections'), where('userId', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as OutlookConnection;
  },

  getAuthUrl() {
    const scopes = ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'].join(' ');
    const params = new URLSearchParams({
      client_id: CLIENT_ID || 'PENDING_CONFIG',
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      response_mode: 'query',
      scope: scopes,
      state: 'placeholder_state'
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async connect(code: string) {
    // In a real app, this would exchange code for tokens in a cloud function
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const connection: Omit<OutlookConnection, 'id'> = {
        userId: auth.currentUser.uid,
        account: 'service@printersplus.nl', 
        status: 'connected',
        lastSync: new Date().toISOString(),
        accessToken: 'MOCK_ACCESS_TOKEN',
        refreshToken: 'MOCK_REFRESH_TOKEN',
        expiresAt: Date.now() + 3600000
      };

      const docRef = await addDoc(collection(db, 'outlook_connections'), connection);
      
      // Log connection action
      await addDoc(collection(db, 'audit_logs'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        action: 'Outlook gekoppeld',
        module: 'settings',
        entityType: 'outlook_connection',
        entityId: docRef.id,
        timestamp: new Date().toISOString()
      });

      return { id: docRef.id, ...connection };
    } catch (err) {
      console.error('Outlook connection error:', err);
      throw err;
    }
  },

  async disconnect(connectionId: string) {
    await updateDoc(doc(db, 'outlook_connections', connectionId), {
      status: 'disconnected',
      updatedAt: new Date().toISOString()
    });

    if (auth.currentUser) {
      await addDoc(collection(db, 'audit_logs'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        action: 'Outlook ontkoppeld',
        module: 'settings',
        entityType: 'outlook_connection',
        entityId: connectionId,
        timestamp: new Date().toISOString()
      });
    }
  },

  async syncAppointment(appointment: Appointment) {
    console.log('Syncing appointment to Outlook:', appointment);
    // Simulate API call to Microsoft Graph
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Success simulation
    const eventId = `EXT_OUTLOOK_${Math.random().toString(36).substr(2, 9)}`;
    
    await updateDoc(doc(db, 'appointments', appointment.id), {
      outlookEventId: eventId,
      syncStatus: 'synced',
      syncedAt: new Date().toISOString()
    });

    return eventId;
  }
};
