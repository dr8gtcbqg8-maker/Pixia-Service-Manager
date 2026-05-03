import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EmailTemplate } from '../types';
import { Mail, Save, RotateCcw, Info, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'updatedAt'>[] = [
  {
    name: 'Afspraakbevestiging',
    type: 'appointment_confirmation',
    subject: 'Bevestiging van uw afspraak - Pixia Service Manager',
    body: 'Beste {{customer_name}},\n\nHierbij bevestigen wij uw afspraak op {{date}} om {{time}}.\n\nLocatie: {{location}}\nMachine: {{machine_model}}\n\nMet vriendelijke groet,\nHet team van Pixia Service Manager',
    placeholders: ['customer_name', 'date', 'time', 'location', 'machine_model'],
    active: true
  },
  {
    name: 'Onderhoudsherinnering',
    type: 'maintenance_reminder',
    subject: 'Herinnering: Periodiek onderhoud voor uw {{machine_model}}',
    body: 'Beste {{customer_name}},\n\nUw {{machine_model}} is volgens onze gegevens toe aan periodiek onderhoud. Om een optimale werking te garanderen, raden wij aan dit binnenkort in te plannen.\n\nNeem contact met ons op om een afspraak te maken.\n\nMet vriendelijke groet,\nPixia Service Manager',
    placeholders: ['customer_name', 'machine_model'],
    active: true
  },
  {
    name: 'Follow-up na Interventie',
    type: 'follow_up',
    subject: 'Hoe verliep uw recente servicebezoek?',
    body: 'Beste {{customer_name}},\n\nOnlangs hebben wij een interventie uitgevoerd aan uw {{machine_model}}.\n\nWij hopen dat alles naar wens is verlopen. Indien u nog vragen heeft of er zijn problemen, laat het ons dan direct weten.\n\nMet vriendelijke groet,\nTechniek Team Pixia Service Manager',
    placeholders: ['customer_name', 'machine_model'],
    active: true
  },
  {
    name: 'Werkbon Versturen',
    type: 'work_order',
    subject: 'Digitale Werkbon - {{work_order_number}}',
    body: 'Beste {{customer_name}},\n\nIn de bijlage vindt u de digitale werkbon van de werkzaamheden die wij hebben uitgevoerd op {{date}}.\n\nBedankt voor uw vertrouwen.\n\nMet vriendelijke groet,\nPixia Service Manager',
    placeholders: ['customer_name', 'work_order_number', 'date'],
    active: true
  },
  {
    name: 'Garantie Verloopt Binnenkort',
    type: 'warranty_warning',
    subject: 'Belangrijk: De garantie op uw {{machine_model}} verloopt bijna',
    body: 'Beste {{customer_name}},\n\nWij willen u attenderen op het feit dat de garantie op uw {{machine_model}} verloopt op {{warranty_end_date}}.\n\nWilt u nog een laatste controle laten uitvoeren voordat de garantie vervalt? Neem dan contact met ons op.\n\nMet vriendelijke groet,\nPixia Service Manager',
    placeholders: ['customer_name', 'machine_model', 'warranty_end_date'],
    active: true
  }
];

const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'email_templates'));
      if (snap.empty) {
        // Initialize with defaults if none exist
        const initialTemplates: EmailTemplate[] = [];
        for (const t of DEFAULT_TEMPLATES) {
          const docRef = await addDoc(collection(db, 'email_templates'), {
            ...t,
            updatedAt: new Date().toISOString()
          });
          initialTemplates.push({ id: docRef.id, ...t, updatedAt: new Date().toISOString() } as EmailTemplate);
        }
        setTemplates(initialTemplates);
        setSelectedTemplate(initialTemplates[0]);
      } else {
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
        setTemplates(fetched);
        setSelectedTemplate(fetched[0]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'email_templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'email_templates', selectedTemplate.id), {
        subject: selectedTemplate.subject,
        body: selectedTemplate.body,
        updatedAt: new Date().toISOString()
      });
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 3000);
      
      // Update local tracking
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? selectedTemplate : t));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `email_templates/${selectedTemplate.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return (
       <div className="p-12 flex justify-center">
         <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
       </div>
     );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar - Templates List */}
      <div className="space-y-2">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-4">Selecteer Template</h3>
         {templates.map(t => (
           <button
             key={t.id}
             onClick={() => setSelectedTemplate(t)}
             className={`w-full text-left p-4 rounded-2xl border transition-all ${
               selectedTemplate?.id === t.id 
               ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
               : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
             }`}
           >
             <p className="text-xs font-black truncate">{t.name}</p>
             <p className={`text-[10px] font-bold mt-1 ${selectedTemplate?.id === t.id ? 'text-blue-100' : 'text-slate-400'}`}>
                {t.type.split('_').join(' ')}
             </p>
           </button>
         ))}
      </div>

      {/* Editor Section */}
      <div className="lg:col-span-2 space-y-6">
         {selectedTemplate && (
           <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8"
           >
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Onderwerp</label>
                <input 
                  type="text"
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  value={selectedTemplate.subject}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Body</label>
                <textarea 
                  rows={10}
                  className="w-full px-6 py-6 bg-white border border-slate-200 rounded-[2rem] font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none font-sans"
                  value={selectedTemplate.body}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, body: e.target.value })}
                />
              </div>

              <div className="bg-white/50 rounded-2xl p-4 border border-white space-y-3">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Info className="w-3 h-3" />
                    Beschikbare Variabelen
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {selectedTemplate.placeholders.map(p => (
                      <span key={p} className="px-2 py-1 bg-slate-100 rounded text-[9px] font-mono text-slate-600">
                        {`{{${p}}}`}
                      </span>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                 <div className="flex items-center gap-2">
                   {showSavedMsg && (
                     <motion.div 
                       initial={{ opacity: 0, x: -10 }} 
                       animate={{ opacity: 1, x: 0 }}
                       className="flex items-center gap-2 text-green-600 text-[10px] font-black uppercase tracking-widest"
                     >
                       <CheckCircle2 className="w-4 h-4" />
                       Template Opgeslagen
                     </motion.div>
                   )}
                 </div>
                 <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 flex items-center gap-2"
                 >
                   {saving ? 'Bezig...' : (
                     <>
                        <Save className="w-4 h-4" />
                        Wijzigingen Opslaan
                     </>
                   )}
                 </button>
              </div>
           </motion.div>
         )}
      </div>
    </div>
  );
};

export default EmailTemplateManager;
