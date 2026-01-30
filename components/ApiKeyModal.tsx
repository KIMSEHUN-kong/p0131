
import React, { useState } from 'react';
import { Key, ShieldCheck, ChevronRight, AlertCircle, X } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: () => void;
  onClose?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onClose }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }
    if (!key.startsWith('AIza')) {
      setError('올바른 Gemini API 키 형식이 아닙니다 (AIza로 시작).');
      return;
    }
    
    localStorage.setItem('gemini_api_key', key.trim());
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp border border-slate-200 relative">
        {onClose && (
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                title="닫기"
            >
                <X size={24} />
            </button>
        )}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Key size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">API 키 설정</h2>
          <p className="text-indigo-100 text-sm">
            {onClose ? '새로운 Gemini API 키를 입력하여 계속하세요.' : 'Gemini API 키를 입력하여 서비스를 시작하세요.'}
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Gemini API Key</label>
              <input 
                type="password" 
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                placeholder="AIza..."
              />
              {error && (
                <p className="text-red-500 text-xs flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-indigo-900 text-white font-bold rounded-xl hover:bg-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              {onClose ? '변경 및 저장' : '시작하기'} <ChevronRight size={18} />
            </button>
          </form>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
              <ShieldCheck size={12} /> 보안 안내
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              입력하신 API 키는 서버로 전송되지 않으며, 오직 <strong>브라우저 내부(Local Storage)</strong>에만 안전하게 저장되어 Google Gemini API와 직접 통신하는 데에만 사용됩니다.
            </p>
          </div>
          
          <div className="text-center">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              API 키가 없으신가요? Google AI Studio에서 발급받기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
