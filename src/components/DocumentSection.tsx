import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppDocument } from '../types';
import { 
  FileText, Image as ImageIcon, Trash2, Download, Plus, X, 
  File, FileCheck, FileCode, FileWarning, Eye, UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { logAction } from '../lib/audit';
import ConfirmDialog from './ConfirmDialog';

interface DocumentSectionProps {
  customerId?: string;
  machineId?: string;
  interventionId?: string;
  workOrderId?: string;
}

const CATEGORY_LABELS: Record<AppDocument['category'], string> = {
  invoice: 'Factuur',
  installation: 'Installatieformulier',
  'work-order': 'Werkbon',
  photo: 'Foto',
  'serial-plate': 'Serienummerplaatje',
  fault: 'Storing',
  manual: 'Handleiding',
  warranty: 'Garantiepapier',
  report: 'Onderhoudsrapport',
  other: 'Overig'
};

const DocumentSection: React.FC<DocumentSectionProps> = ({ 
  customerId, machineId, interventionId, workOrderId 
}) => {
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  
  const [uploadData, setUploadData] = useState<{
    file: File | null;
    category: AppDocument['category'];
    description: string;
  }>({
    file: null,
    category: 'other',
    description: ''
  });

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      let q;
      if (customerId) {
        q = query(collection(db, 'documents'), where('customerId', '==', customerId), orderBy('uploadDate', 'desc'));
      } else if (machineId) {
        q = query(collection(db, 'documents'), where('machineId', '==', machineId), orderBy('uploadDate', 'desc'));
      } else if (interventionId) {
        q = query(collection(db, 'documents'), where('interventionId', '==', interventionId), orderBy('uploadDate', 'desc'));
      } else if (workOrderId) {
        q = query(collection(db, 'documents'), where('workOrderId', '==', workOrderId), orderBy('uploadDate', 'desc'));
      } else {
        setLoading(false);
        return;
      }

      const snap = await getDocs(q);
      setDocuments(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch (err) {
      // If index is missing, it might fail. In this environment indices are auto-created usually,
      // but if not we might need to handle the list differently.
      console.error('Error fetching documents:', err);
      // Fallback: fetch all and filter client-side if needed (only for small sets)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [customerId, machineId, interventionId, workOrderId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadData({ ...uploadData, file: e.target.files[0] });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const newDoc: Omit<AppDocument, 'id'> = {
          name: uploadData.file!.name,
          type: uploadData.file!.type,
          category: uploadData.category,
          url: base64String,
          customerId: customerId || '',
          machineId: machineId || '',
          interventionId: interventionId || '',
          workOrderId: workOrderId || '',
          description: uploadData.description,
          uploadDate: new Date().toISOString(),
          fileSize: uploadData.file!.size
        };

        const docRef = await addDoc(collection(db, 'documents'), newDoc);
        
        const entityInfo = customerId ? 'klant' : (machineId ? 'machine' : (interventionId ? 'interventie' : 'werkbon'));
        await logAction('Document geüpload', 'document', docRef.id, `Bestand: ${newDoc.name}, Gekoppeld aan: ${entityInfo}`);
        
        setIsUploadModalOpen(false);
        setUploadData({ file: null, category: 'other', description: '' });
        fetchDocuments();
      };
      reader.readAsDataURL(uploadData.file);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'documents');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'documents', deleteConfirm.id));
      await logAction('Document verwijderd', 'document', deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
      fetchDocuments();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `documents/${deleteConfirm.id}`);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-rose-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-blue-600" />
          Documenten & Foto's
        </h3>
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all border border-slate-800"
        >
          <UploadCloud className="w-4 h-4" />
          Toevoegen
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(d => (
            <div key={d.id} className="p-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group flex flex-col">
              <div className="flex items-start justify-between mb-3">
                 <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-all">
                    {getFileIcon(d.type)}
                 </div>
                 <div className="flex items-center gap-1">
                    <a 
                      href={d.url} 
                      download={d.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, id: d.id })}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>
              
              <div className="flex-1">
                 <h4 className="text-xs font-black text-slate-900 line-clamp-1 mb-1">{d.name}</h4>
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{CATEGORY_LABELS[d.category]}</span>
                    <span className="text-[8px] font-bold text-slate-300">{(d.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                 </div>
                 {d.description && (
                   <p className="text-[10px] text-slate-500 font-medium italic mt-2 line-clamp-2">{d.description}</p>
                 )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                 <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Gechupload op</span>
                 <span className="text-[8px] font-bold text-slate-500">{new Date(d.uploadDate).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center opacity-40">
           <FileWarning className="w-10 h-10 mb-4" />
           <p className="text-[10px] font-black uppercase tracking-widest">Geen documenten gevonden</p>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsUploadModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Bestand Toevoegen</h2>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Kies Bestand</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 text-slate-300 group-hover:text-blue-500 mb-2" />
                      <p className="text-xs font-bold text-slate-500">{uploadData.file ? uploadData.file.name : 'Selecteer een bestand'}</p>
                    </div>
                    <input type="file" className="hidden" onChange={handleFileChange} required />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Categorie</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={uploadData.category}
                    onChange={(e) => setUploadData({ ...uploadData, category: e.target.value as any })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Omschrijving</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Bijv. Foto van voorpaneel..."
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsUploadModalOpen(false)}
                    className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit" 
                    disabled={!uploadData.file}
                    className="flex-[2] py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-100 active:scale-95 disabled:opacity-50"
                  >
                    Bestand Koppelen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Document Verwijderen"
        message="Weet u zeker dat u dit document wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default DocumentSection;
