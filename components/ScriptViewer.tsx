
import React, { useState, useEffect } from 'react';
import { Copy, Check, RotateCcw, Download, FileText, Image as ImageIcon, Mic, Play } from 'lucide-react';
import { Storyboard } from './Storyboard';
import { TTSGenerator } from './TTSGenerator';
import { VideoPreview } from './VideoPreview';
import { ScriptSection, Scene, Protagonist, ScriptType } from '../types';

interface ScriptViewerProps {
  initialSections: ScriptSection[];
  title: string;
  onBack: () => void;
  protagonistName: string;
  scriptType: ScriptType;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ initialSections = [], title, onBack, protagonistName, scriptType }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'visual' | 'audio' | 'preview'>('text');
  const [copied, setCopied] = useState(false);
  const [sections, setSections] = useState<ScriptSection[]>(initialSections || []);
  const [fullScript, setFullScript] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  const [protagonist, setProtagonist] = useState<Protagonist>({
    description: `Colorful stylized stickman character, thick black comic outlines, vibrant blue formal suit or dress shirt, professional and decent attire, large expressive eyes, shocked or emotional expression, modern flat vector art, white background, strictly no text, no names`,
    imageUrl: undefined,
  });

  useEffect(() => {
    if (sections && Array.isArray(sections)) {
      const joined = sections.map(s => s.content || "").join('\n\n');
      setFullScript(joined);
    } else {
      setFullScript("");
    }
  }, [sections]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden animate-slideUp flex flex-col min-h-[80vh]">
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
        <div>
           <button onClick={onBack} className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1">
             <RotateCcw size={12} /> 처음으로
           </button>
           <h2 className="font-bold text-lg text-slate-900 truncate max-w-md">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={16} />
          </button>
          <button onClick={handleCopy} className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white rounded-lg transition-all ${copied ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '복사됨!' : '대본 복사'}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto">
        {[
          { id: 'text', label: '대본 편집', icon: FileText },
          { id: 'visual', label: '스토리보드', icon: ImageIcon },
          { id: 'audio', label: '통합 TTS', icon: Mic },
          { id: 'preview', label: '영상 미리보기', icon: Play }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-slate-50 p-6 overflow-y-auto custom-scrollbar">
        {activeTab === 'text' && sections && Array.isArray(sections) && (
          <div className="max-w-4xl mx-auto space-y-6">
            {sections.map((section, idx) => (
              <div key={section.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400 font-bold uppercase">Part {idx+1}: {section.title}</span>
                </div>
                <textarea
                  value={section.content || ""}
                  onChange={(e) => setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: e.target.value } : s))}
                  className="w-full min-h-[150px] text-slate-700 bg-transparent border-none outline-none resize-none leading-relaxed"
                />
              </div>
            ))}
          </div>
        )}
        {activeTab === 'visual' && (
          <Storyboard 
            script={fullScript} 
            protagonistName={protagonistName} 
            scenes={scenes} 
            setScenes={setScenes}
            protagonist={protagonist}
            setProtagonist={setProtagonist}
            scriptType={scriptType}
          />
        )}
        {activeTab === 'audio' && <TTSGenerator script={fullScript} />}
        {activeTab === 'preview' && <VideoPreview scenes={scenes} title={title} scriptType={scriptType} />}
      </div>
    </div>
  );
};
