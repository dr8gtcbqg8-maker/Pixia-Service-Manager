import { 
  collection, query, where, getDocs, addDoc, updateDoc, doc, 
  Timestamp, serverTimestamp, getDoc, limit, orderBy 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  EmailTemplate, EmailLog, Customer, Machine, 
  Intervention, WorkOrder, Appointment 
} from '../types';

export const emailService = {
  replacePlaceholders(template: string, data: any) {
    let content = template;
    const placeholders: Record<string, string> = {
      customer_name: data.customer?.name || 'Klant',
      contact_person: data.customer?.contactPerson || 'Contactpersoon',
      machine_brand: data.machine?.brand || 'Machine',
      machine_model: data.machine?.model || 'Model',
      serial_number: data.machine?.serialNumber || 'SN-Bekend',
      appointment_date: data.appointment?.date || 'Nader te bepalen',
      appointment_time: data.appointment?.startTime || data.appointment?.time || '--:--',
      location: data.appointment?.location || data.customer?.address || 'Locatie onbekend',
      technician_name: data.technician?.name || data.appointment?.technicianName || 'Technicus',
      work_order_number: data.workOrder?.orderNumber || 'Concept',
      company_name: 'Printers Plus'
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value || '');
    });

    return content;
  },

  async logEmail(log: Omit<EmailLog, 'id'>) {
    await addDoc(collection(db, 'email_logs'), {
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    });
  },

  async sendEmail(params: {
    recipient: string,
    subject: string,
    body: string,
    customerId?: string,
    machineId?: string,
    interventionId?: string,
    workOrderId?: string
  }) {
    console.log('Sending email:', params);
    // In a real app, this would trigger a cloud function sending via SendGrid/Postmark/Outlook
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Log the success
    await this.logEmail({
      timestamp: new Date().toISOString(),
      recipient: params.recipient,
      subject: params.subject,
      customerId: params.customerId,
      machineId: params.machineId,
      interventionId: params.interventionId,
      workOrderId: params.workOrderId,
      status: 'sent'
    });

    return true;
  },

  async triggerAutomation(type: string, data: any) {
    const q = query(
      collection(db, 'automation_rules'), 
      where('type', '==', type),
      where('active', '==', true)
    );
    const rulesSnap = await getDocs(q);
    
    for (const ruleDoc of rulesSnap.docs) {
      const rule = ruleDoc.data();
      const templateSnap = await getDoc(doc(db, 'email_templates', rule.templateId));
      if (!templateSnap.exists()) continue;
      
      const template = templateSnap.data() as EmailTemplate;
      const subject = this.replacePlaceholders(template.subject, data);
      const body = this.replacePlaceholders(template.body, data);
      
      const recipient = data.customer?.email || '';
      
      if (recipient) {
        await this.sendEmail({
          recipient,
          subject,
          body,
          customerId: data.customer?.id,
          machineId: data.machine?.id,
          interventionId: data.intervention?.id,
          workOrderId: data.workOrder?.id
        });
      }
    }
  }
};
