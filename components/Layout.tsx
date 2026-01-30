
import React from 'react';
import { Brain, Sparkles, KeyRound } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onChangeApiKey?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onChangeApiKey }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Brain size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              철학/심리 유튜브 <span className="text-indigo-600">생성기</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
             <div className="hidden md:flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <span>Psychology Script Expert</span>
             </div>
             {onChangeApiKey && (
               <button 
                onClick={onChangeApiKey}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"
                title="API 키 설정/변경"
               >
                 <KeyRound size={18} />
               </button>
             )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 text-sm">
        <p>Powered by Google Gemini 3 Flash & Psychology Engine</p>
      </footer>
    </div>
  );
};
