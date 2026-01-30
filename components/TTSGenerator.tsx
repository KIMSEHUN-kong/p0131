
import React, { useState, useEffect, useRef } from 'react';
import { generateSpeech } from '../services/geminiService';
import { Play, Download, Mic, Loader2, Volume2, Music } from 'lucide-react';

interface TTSGeneratorProps {
  script: string;
}

interface AudioChunk {
  id: number;
  text: string;
  audioUrl?: string;
  isLoading: boolean;
}

const VOICES = [
  { name: 'Puck', label: '남성 1 (Puck - 굵은 목소리)', gender: 'male' },
  { name: 'Charon', label: '남성 2 (Charon - 차분한 목소리)', gender: 'male' },
  { name: 'Kore', label: '여성 1 (Kore - 차분한 목소리)', gender: 'female' },
  { name: 'Fenrir', label: '남성 3 (Fenrir - 거친 목소리)', gender: 'male' },
  { name: 'Zephyr', label: '여성 2 (Zephyr - 부드러운 목소리)', gender: 'female' },
];

export const TTSGenerator: React.FC<TTSGeneratorProps> = ({ script }) => {
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [isInitializing, setIsInitializing] = useState(true);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (script !== undefined && script !== null) {
      const splitChunks = splitScript(script);
      setChunks(splitChunks.map((text, index) => ({
        id: index,
        text,
        isLoading: false
      })));
      setIsInitializing(false);
    }
  }, [script]);

  const splitScript = (fullScript: string): string[] => {
    if (!fullScript) return [];
    const MAX_LENGTH = 1000;
    const cleanScript = fullScript
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    const paragraphs = cleanScript.split(/\n\s*\n/);
    const result: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      if ((currentChunk + "\n" + para).length <= MAX_LENGTH) {
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      } else {
        if (currentChunk) result.push(currentChunk);
        
        if (para.length > MAX_LENGTH) {
           const sentences = para.match(/[^.!?]+[.!?]+["']?|.+/g) || [para];
           let subChunk = "";
           for (const sen of sentences) {
             if ((subChunk + sen).length <= MAX_LENGTH) {
                subChunk += sen;
             } else {
                if (subChunk) result.push(subChunk);
                subChunk = sen;
             }
           }
           if (subChunk) currentChunk = subChunk; else currentChunk = "";
        } else {
          currentChunk = para;
        }
      }
    }
    if (currentChunk) result.push(currentChunk);
    return result;
  };

  const handleTextChange = (id: number, newText: string) => {
    setChunks(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  const handleGenerateAudio = async (id: number) => {
    setChunks(prev => prev.map(c => c.id === id ? { ...c, isLoading: true } : c));
    try {
      const chunk = chunks.find(c => c.id === id);
      if (chunk && chunk.text) {
        const audioUrl = await generateSpeech(chunk.text, selectedVoice);
        setChunks(prev => prev.map(c => c.id === id ? { ...c, audioUrl, isLoading: false } : c));
      } else {
        throw new Error("Text is empty");
      }
    } catch (e) {
      console.error(e);
      setChunks(prev => prev.map(c => c.id === id ? { ...c, isLoading: false } : c));
      alert("오디오 생성 실패");
    }
  };

  const handlePreviewVoice = async () => {
    if (isPreviewLoading) return;
    setIsPreviewLoading(true);
    setPreviewAudioUrl(null);
    try {
        const sampleText = "안녕하세요, 이 목소리로 대본을 읽어드립니다.";
        const audioUrl = await generateSpeech(sampleText, selectedVoice);
        setPreviewAudioUrl(audioUrl);
        setTimeout(() => {
            if (previewAudioRef.current) {
                previewAudioRef.current.play();
            }
        }, 100);
    } catch (e) {
        console.error(e);
        alert("미리듣기 생성 실패");
    } finally {
        setIsPreviewLoading(false);
    }
  };

  const handleDownload = (audioUrl: string, id: number) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts_part_${id + 1}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (isInitializing) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <Mic size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">AI 성우 설정</h3>
            <p className="text-xs text-slate-500">대본이 자동으로 1000자 이내로 분할되었습니다.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <select 
                    value={selectedVoice}
                    onChange={(e) => {
                        setSelectedVoice(e.target.value);
                        setPreviewAudioUrl(null);
                    }}
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 min-w-[200px]"
                >
                    {VOICES.map(voice => (
                        <option key={voice.name} value={voice.name}>{voice.label}</option>
                    ))}
                </select>
                <button
                    onClick={handlePreviewVoice}
                    disabled={isPreviewLoading}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                    {isPreviewLoading ? <Loader2 className="animate-spin" size={18} /> : <Volume2 size={18} />}
                </button>
                {previewAudioUrl && (
                    <audio ref={previewAudioRef} src={previewAudioUrl} className="hidden" />
                )}
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {chunks.map((chunk, index) => (
          <div key={chunk.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
             <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Part {index + 1}</span>
                <span className="text-xs text-slate-400">{(chunk.text || "").length}자</span>
             </div>
             
             <div className="p-4 grid md:grid-cols-2 gap-6">
               <div className="flex flex-col gap-2">
                 <textarea
                   value={chunk.text || ""}
                   onChange={(e) => handleTextChange(chunk.id, e.target.value)}
                   className="w-full h-40 p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                 />
                 <div className="flex justify-end">
                    <button
                      onClick={() => handleGenerateAudio(chunk.id)}
                      disabled={chunk.isLoading || !chunk.text?.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {chunk.isLoading ? <Loader2 className="animate-spin" size={16} /> : <Music size={16} />}
                      음성 생성
                    </button>
                 </div>
               </div>

               <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-4">
                 {chunk.audioUrl ? (
                   <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
                     <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-2">
                       <Play size={32} className="ml-1" />
                     </div>
                     <audio controls src={chunk.audioUrl} className="w-full h-10" />
                     <button
                       onClick={() => handleDownload(chunk.audioUrl!, chunk.id)}
                       className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                     >
                       <Download size={16} /> WAV 다운로드
                     </button>
                   </div>
                 ) : (
                   <div className="text-center text-slate-400 space-y-2">
                     <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                       <Mic size={24} />
                     </div>
                     <p className="text-sm">음성을 생성해주세요</p>
                   </div>
                 )}
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
