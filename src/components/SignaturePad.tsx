import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  onClear?: () => void;
  title: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, title }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onClear?.();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) return;
    const data = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (data) {
      onSave(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{title}</label>
        <button 
          type="button"
          onClick={clear}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 link-3" />
          Wissen
        </button>
      </div>
      
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden touch-none relative h-48">
        <SignatureCanvas 
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: "w-full h-full cursor-crosshair",
            style: { width: '100%', height: '100%' }
          }}
        />
      </div>

      <div className="flex justify-end">
         <button 
          type="button"
          onClick={save}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all"
        >
          <Check className="w-3 h-3" />
          Bevestigen
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
