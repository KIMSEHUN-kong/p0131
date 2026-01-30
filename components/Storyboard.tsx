
import React, { useState, useRef } from 'react';
import { Scene, AspectRatio, Protagonist, ScriptType } from '../types';
import { generateImage, extractScenesFromScript, generateSpeech } from '../services/geminiService';
import { RefreshCw, Video, Image as ImageIcon, Loader2, PlayCircle, Volume2, Upload, Mic, Zap, Copy, Check, AlertCircle, Key } from 'lucide-react';

interface StoryboardProps {
  script: string;
  protagonistName: string;
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  protagonist: Protagonist;
  setProtagonist: React.Dispatch<React.SetStateAction<Protagonist>>;
  scriptType: ScriptType;
  onChangeApiKey: () => void;
}

const VOICES = [
  { name: 'Charon', label: '남성 (Charon - 차분하고 지적인)' },
  { name: 'Kore', label: '여성 (Kore - 따뜻하고 공감적인)' },
  { name: 'Puck', label: '남성 (Puck - 신뢰감 있는 굵은 톤)' },
  { name: 'Zephyr', label: '여성 (Zephyr - 부드러운 목소리)' },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function promiseAllStepByStep<T>(items: any[], asyncFn: (item: any) => Promise<T>, concurrency: number = 3): Promise<void> {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(item => asyncFn(item)));
    await sleep(200);
  }
}

export const Storyboard: React.FC<StoryboardProps> = ({ script, protagonistName, scenes = [], setScenes, protagonist, setProtagonist, scriptType, onChangeApiKey }) => {
  const [isGeneratingProtagonist, setIsGeneratingProtagonist] = useState(false);
  const [isLoadingScenes, setIsLoadingScenes] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(scriptType === 'shorts' ? "9:16" : "16:9");
  const [copyStatus, setCopyStatus] = useState<Record<number, boolean>>({});
  
  const [selectedVoice, setSelectedVoice] = useState('Charon');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      if (!url || url.startsWith('data:')) return url || "";
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject("Failed to read");
        reader.readAsDataURL(blob);
      });
    } catch (e) { return ""; }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setProtagonist(prev => ({ ...prev, imageUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateProtagonist = async () => {
    setIsGeneratingProtagonist(true);
    setQuotaError(null);
    try {
      const imageUrl = await generateImage("A simple stickman character, clean lines, white background", "1:1", protagonist.description);
      setProtagonist(prev => ({ ...prev, imageUrl }));
    } catch (e: any) {
      if (e.isQuotaError) setQuotaError(e.message);
      else alert(`캐릭터 가이드 생성 실패: ${e.message || '알 수 없는 오류'}`);
    } finally {
      setIsGeneratingProtagonist(false);
    }
  };

  const handleAnalyzeScript = async () => {
    setIsLoadingScenes(true);
    setQuotaError(null);
    try {
      const extractedScenes = await extractScenesFromScript(script, protagonist.description, scriptType === 'shorts');
      setScenes(Array.isArray(extractedScenes) ? extractedScenes : []);
    } catch (e: any) {
      if (e.isQuotaError) setQuotaError(e.message);
      else alert("장면 분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingScenes(false);
    }
  };

  const handleUpdatePrompt = (sceneId: number, field: 'imagePrompt' | 'videoPrompt' | 'description', value: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, [field]: value } : s));
  };

  const handleGenerateAudioOnly = async (sceneId: number) => {
    const scene = (scenes || []).find(s => s.id === sceneId);
    if (!scene) return;
    setQuotaError(null);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isAudioLoading: true } : s));
    try {
      const audioUrl = await generateSpeech(scene.description, selectedVoice);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, audioUrl, isAudioLoading: false } : s));
    } catch (e: any) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isAudioLoading: false } : s));
      if (e.isQuotaError) setQuotaError(e.message);
    }
  };

  const handleGenerateImageOnly = async (sceneId: number) => {
    const scene = (scenes || []).find(s => s.id === sceneId);
    if (!scene) return;
    setQuotaError(null);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true } : s));
    try {
      let refBase64 = protagonist.imageUrl ? await getBase64FromUrl(protagonist.imageUrl) : undefined;
      const imageUrl = await generateImage(scene.imagePrompt, aspectRatio, protagonist.description, refBase64);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl, isLoading: false } : s));
    } catch (e: any) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: false } : s));
      if (e.isQuotaError) setQuotaError(e.message);
    }
  };

  const handleCopyPrompt = (sceneId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(prev => ({ ...prev, [sceneId]: true }));
    setTimeout(() => {
      setCopyStatus(prev => ({ ...prev, [sceneId]: false }));
    }, 2000);
  };

  const handleGenerateAllParallel = async () => {
    const currentScenes = scenes || [];
    if (currentScenes.length === 0) return;
    setIsProcessingAll(true);
    setQuotaError(null);
    
    setScenes(prev => prev.map(s => ({
      ...s,
      isLoading: !s.imageUrl,
      isAudioLoading: !s.audioUrl
    })));

    try {
      let refBase64 = protagonist.imageUrl ? await getBase64FromUrl(protagonist.imageUrl) : undefined;
      
      await promiseAllStepByStep(currentScenes, async (scene) => {
        const tasks = [];
        if (!scene.imageUrl) {
          tasks.push((async () => {
            try {
              const imageUrl = await generateImage(scene.imagePrompt, aspectRatio, protagonist.description, refBase64);
              setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, imageUrl, isLoading: false } : s));
            } catch (err: any) {
              setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isLoading: false } : s));
              if (err.isQuotaError) setQuotaError(err.message);
            }
          })());
        }
        if (!scene.audioUrl) {
          tasks.push((async () => {
            try {
              const audioUrl = await generateSpeech(scene.description, selectedVoice);
              setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, audioUrl, isAudioLoading: false } : s));
            } catch (err: any) {
              setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isAudioLoading: false } : s));
              if (err.isQuotaError) setQuotaError(err.message);
            }
          })());
        }
        await Promise.all(tasks);
      }, 3); 
    } finally {
      setIsProcessingAll(false);
      setScenes(prev => prev.map(s => ({ ...s, isLoading: false, isAudioLoading: false })));
    }
  };

  const handleGenerateSceneAll = async (sceneId: number) => {
    const scene = (scenes || []).find(s => s.id === sceneId);
    if (!scene) return;
    setQuotaError(null);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: !s.imageUrl, isAudioLoading: !s.audioUrl } : s));
    try {
      let refBase64 = protagonist.imageUrl ? await getBase64FromUrl(protagonist.imageUrl) : undefined;
      const tasks = [];
      if (!scene.imageUrl) {
        tasks.push(generateImage(scene.imagePrompt, aspectRatio, protagonist.description, refBase64).then(imageUrl => {
          setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl, isLoading: false } : s));
        }));
      }
      if (!scene.audioUrl) {
        tasks.push(generateSpeech(scene.description, selectedVoice).then(audioUrl => {
          setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, audioUrl, isAudioLoading: false } : s));
        }));
      }
      await Promise.all(tasks);
    } catch (e: any) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: false, isAudioLoading: false } : s));
      if (e.isQuotaError) setQuotaError(e.message);
    }
  };

  const handlePreviewVoice = async () => {
    if (isPreviewLoading) return;
    setIsPreviewLoading(true);
    setQuotaError(null);
    try {
      const audioUrl = await generateSpeech("오늘의 심리학적 인사이트를 들려드립니다.", selectedVoice);
      setPreviewAudioUrl(audioUrl);
      setTimeout(() => previewAudioRef.current?.play(), 100);
    } catch (e: any) {
      if (e.isQuotaError) setQuotaError(e.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-fadeIn pb-20">
      {quotaError && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 animate-slideUp">
          <AlertCircle className="text-amber-600 mt-1 flex-shrink-0" size={24} />
          <div className="flex-1 space-y-3">
            <h4 className="font-bold text-amber-900">API 할당량 초과 안내</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              {quotaError} 현재 더 많은 작업을 수행하기 위해서는 다른 API 키를 등록해야 합니다. 하단 버튼을 눌러 새 키를 입력하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={onChangeApiKey}
                className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Key size={14} /> 다른 API 키 등록하고 계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ImageIcon className="text-indigo-600" /> 비주얼 스타일 가이드 (스틱맨)
        </h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">캐릭터/상황 묘사</label>
              <textarea
                value={protagonist.description}
                onChange={(e) => setProtagonist(prev => ({ ...prev, description: e.target.value }))}
                className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                placeholder="간결한 막대 인간 캐릭터 스타일"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleGenerateProtagonist} disabled={isGeneratingProtagonist} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95">
                {isGeneratingProtagonist ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} 가이드 재생성
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 flex items-center gap-2 transition-all active:scale-95">
                <Upload size={16} /> 이미지 업로드
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
          </div>
          <div className="w-full md:w-48 h-48 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative shadow-inner">
            {protagonist.imageUrl ? <img src={protagonist.imageUrl} className="w-full h-full object-cover" alt="주인공 가이드" /> : <ImageIcon size={32} className="text-slate-300" />}
            {isGeneratingProtagonist && <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]"><Loader2 className="animate-spin text-indigo-600" /></div>}
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-4 mb-6 sticky top-0 bg-slate-50/95 backdrop-blur-md py-4 z-30 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><Video size={20} /></div>
               <h3 className="text-lg font-bold text-slate-900">상세 스토리보드</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
               <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="bg-white border border-slate-300 text-xs font-bold rounded-lg p-2 outline-none shadow-sm cursor-pointer hover:border-indigo-500 transition-colors">
                 <option value="16:9">16:9 롱폼</option>
                 <option value="9:16">9:16 쇼츠</option>
               </select>
               
               {!(scenes && scenes.length > 0) ? (
                 <button onClick={handleAnalyzeScript} disabled={isLoadingScenes} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow active:scale-95">
                  {isLoadingScenes ? <Loader2 className="animate-spin" size={14} /> : <PlayCircle size={14} />} 장면 분석 및 스토리보드 구성
                </button>
               ) : (
                 <div className="flex gap-2">
                    <button onClick={handleGenerateAllParallel} disabled={isProcessingAll} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow active:scale-95">
                      {isProcessingAll ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} 전체 장면 일괄 생성
                    </button>
                 </div>
               )}
            </div>
          </div>

          {(scenes && scenes.length > 0) && (
            <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-indigo-600">
                <Mic size={16} />
                <span className="text-xs font-bold">내레이션 보이스:</span>
              </div>
              <div className="flex-1 flex items-center gap-2 w-full sm:w-auto">
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg p-2 outline-none">
                  {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                </select>
                <button onClick={handlePreviewVoice} disabled={isPreviewLoading} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-100 transition-all active:scale-90">
                  {isPreviewLoading ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
              {previewAudioUrl && <audio key={previewAudioUrl} ref={previewAudioRef} src={previewAudioUrl} className="hidden" />}
            </div>
          )}
        </div>

        <div className="grid gap-6">
          {(scenes || []).map((scene, index) => (
            <div key={scene.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col lg:flex-row">
              <div className="w-full lg:w-2/5 aspect-video bg-slate-50 border-r border-slate-100 relative overflow-hidden">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} className="w-full h-full object-cover" alt={`장면 ${index + 1}`} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                    <ImageIcon size={40} />
                  </div>
                )}
                {(scene.isLoading || scene.isAudioLoading) && (
                  <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20 backdrop-blur-[2px]">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2 py-1 bg-slate-900/80 text-white text-[10px] font-black rounded-md">SCENE {index + 1}</div>
              </div>

              <div className="flex-1 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider block">장면 내레이션</label>
                    <textarea
                      value={scene.description}
                      onChange={(e) => handleUpdatePrompt(scene.id, 'description', e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none h-32 shadow-inner leading-relaxed"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                     <button title="음성 생성" onClick={() => handleGenerateAudioOnly(scene.id)} disabled={scene.isAudioLoading} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all">
                       {scene.isAudioLoading ? <Loader2 className="animate-spin" size={20} /> : <Mic size={20} />}
                     </button>
                     <button title="이미지 생성" onClick={() => handleGenerateImageOnly(scene.id)} disabled={scene.isLoading} className="p-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 active:scale-95 transition-all">
                       {scene.isLoading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                     </button>
                     <button title="이미지+음성 생성" onClick={() => handleGenerateSceneAll(scene.id)} disabled={scene.isLoading || scene.isAudioLoading} className="p-3 bg-indigo-900 text-white rounded-xl hover:bg-indigo-950 active:scale-95 transition-all">
                       <Zap size={20} />
                     </button>
                  </div>
                </div>

                {scene.audioUrl && (
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Volume2 size={16} className="text-indigo-600" />
                    <audio key={scene.audioUrl} src={scene.audioUrl} controls className="flex-1 h-8" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">이미지 프롬프트</label>
                    <textarea value={scene.imagePrompt} onChange={(e) => handleUpdatePrompt(scene.id, 'imagePrompt', e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg text-[10px] h-14" />
                  </div>
                  <div className="space-y-1 relative group/field">
                    <div className="flex justify-between items-center mb-1">
                       <label className="text-[9px] font-bold text-slate-400 uppercase">비주얼 가이드</label>
                       <button 
                         onClick={() => handleCopyPrompt(scene.id, scene.videoPrompt)}
                         className="p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                         title="복사하기"
                       >
                         {copyStatus[scene.id] ? <Check size={12} /> : <Copy size={12} />}
                       </button>
                    </div>
                    <textarea 
                      value={scene.videoPrompt} 
                      onChange={(e) => handleUpdatePrompt(scene.id, 'videoPrompt', e.target.value)} 
                      className="w-full p-2 bg-indigo-50/30 border border-indigo-100 rounded-lg text-[10px] h-14 pr-8" 
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
