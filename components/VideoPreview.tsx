
import React, { useState, useEffect, useRef } from 'react';
import { Scene, ScriptType } from '../types';
import { Play, Pause, SkipBack, SkipForward, Download, Loader2, Video, AlertCircle, Image as ImageIcon, Film, DownloadCloud, Mic, Archive } from 'lucide-react';
import saveAs from 'file-saver';
import JSZip from 'jszip';

interface VideoPreviewProps {
  scenes: Scene[];
  title: string;
  scriptType: ScriptType;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ scenes = [], title, scriptType }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [processingSceneId, setProcessingSceneId] = useState<number | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isShorts = scriptType === 'shorts';
  const previewScenes = (scenes || []).filter(s => s && s.imageUrl);
  const currentScene = previewScenes[currentIndex];

  const getSupportedMimeType = () => {
    const types = [
      'video/mp4;codecs=avc1.4D401E,mp4a.40.2', 
      'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a', 
      'video/mp4',
      'video/webm;codecs=h264,aac',
      'video/webm;codecs=h264'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm'; 
  };

  const getRecorderOptions = () => {
    const mimeType = getSupportedMimeType();
    return {
      mimeType,
      videoBitsPerSecond: isShorts ? 2000000 : 2500000, 
      audioBitsPerSecond: 96000, 
    };
  };

  useEffect(() => {
    if (isPlaying && currentScene?.audioUrl && !isExporting && processingSceneId === null) {
      if (audioRef.current) {
        audioRef.current.src = currentScene.audioUrl;
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [currentIndex, isPlaying, currentScene, isExporting, processingSceneId]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && !currentScene?.audioUrl && !isExporting && processingSceneId === null) {
      timer = setTimeout(() => {
        handleNext();
      }, 2500);
    }
    return () => clearTimeout(timer);
  }, [currentIndex, isPlaying, currentScene, isExporting, processingSceneId]);

  const drawToCanvas = (imageUrl: string, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    return new Promise<void>((resolve) => {
      img.onload = () => {
        const canvasWidth = isShorts ? 720 : 1280;
        const canvasHeight = isShorts ? 1280 : 720;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        const imgAspect = img.width / img.height;
        const canvasAspect = canvasWidth / canvasHeight;
        let dW, dH, oX, oY;
        
        if (imgAspect > canvasAspect) {
          dW = canvasWidth; dH = canvasWidth / imgAspect;
          oX = 0; oY = (canvasHeight - dH) / 2;
        } else {
          dH = canvasHeight; dW = canvasHeight * imgAspect;
          oX = (canvasWidth - dW) / 2; oY = 0;
        }
        ctx.drawImage(img, oX, oY, dW, dH);
        resolve();
      };
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentScene?.imageUrl) return;
    drawToCanvas(currentScene.imageUrl, canvas);
  }, [currentScene, isShorts]);

  const handleAudioEnd = () => {
    handleNext();
  };

  const handleNext = () => {
    if (previewScenes && currentIndex < previewScenes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentIndex(0);
    }
  };

  const generateSceneBlob = async (scene: Scene): Promise<Blob | null> => {
    if (!scene.imageUrl || !scene.audioUrl) return null;
    
    const tempCanvas = document.createElement('canvas');
    await drawToCanvas(scene.imageUrl, tempCanvas);
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const destination = audioCtx.createMediaStreamDestination();
    const canvasStream = tempCanvas.captureStream(30); 
    const combinedStream = new MediaStream([...canvasStream.getTracks(), ...destination.stream.getTracks()]);
    
    const options = getRecorderOptions();
    const recorder = new MediaRecorder(combinedStream, options);
    const localChunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => localChunks.push(e.data);
    
    const recordingPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mimeTypePrefix = options.mimeType.split(';')[0];
        const blob = new Blob(localChunks, { type: mimeTypePrefix });
        audioCtx.close();
        resolve(blob);
      };
    });

    recorder.start();

    const audio = new Audio(scene.audioUrl);
    audio.crossOrigin = "anonymous";
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(destination);
    
    await new Promise<void>((resolve) => {
      audio.onended = () => { source.disconnect(); resolve(); };
      audio.onerror = () => { source.disconnect(); resolve(); };
      audio.play().catch(resolve);
    });

    recorder.stop();
    return await recordingPromise;
  };

  const handleExportSingleScene = async (scene: Scene, index: number) => {
    if (processingSceneId !== null || isExporting) return;
    setProcessingSceneId(scene.id);
    try {
      const blob = await generateSceneBlob(scene);
      if (blob) {
        saveAs(blob, `${index + 1}.mp4`);
      }
    } catch (e) {
      alert("클립 추출 중 오류가 발생했습니다.");
    } finally {
      setProcessingSceneId(null);
    }
  };

  const handleExportAllIndividual = async () => {
    const readyScenes = (scenes || []).filter(s => s && s.imageUrl && s.audioUrl);
    if (readyScenes.length === 0) {
      alert("먼저 이미지와 음성을 생성해주세요.");
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const zip = new JSZip();
      
      // 모든 장면을 병렬로 처리 (Browser의 리소스 한계를 고려하여 최대 5개씩 묶어서 실행)
      const CONCURRENCY = 5;
      let completed = 0;

      for (let i = 0; i < readyScenes.length; i += CONCURRENCY) {
        const chunk = readyScenes.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(async (scene, chunkIdx) => {
          const blob = await generateSceneBlob(scene);
          completed++;
          setExportProgress(Math.round((completed / readyScenes.length) * 100));
          return { blob, index: i + chunkIdx };
        }));

        results.forEach(res => {
          if (res.blob) {
            zip.file(`${res.index + 1}.mp4`, res.blob);
          }
        });
      }
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${title || 'clips'}_all_scenes.zip`);
    } catch (e) {
      console.error(e);
      alert("일괄 추출 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportFullVideo = async () => {
    const readyScenes = (scenes || []).filter(s => s && s.imageUrl && s.audioUrl);
    if (readyScenes.length === 0) {
      alert("영상 제작을 위해 모든 장면의 이미지와 음성을 먼저 생성해주세요.");
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);
    setCurrentIndex(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const destination = audioCtx.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(30); 
    const combinedStream = new MediaStream([...canvasStream.getTracks(), ...destination.stream.getTracks()]);
    
    const options = getRecorderOptions();
    const recorder = new MediaRecorder(combinedStream, options);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const mimeTypePrefix = options.mimeType.split(';')[0];
      const blob = new Blob(chunksRef.current, { type: mimeTypePrefix });
      saveAs(blob, `${title || 'financial_video'}.mp4`);
      setIsExporting(false); audioCtx.close();
    };
    recorder.start();

    for (let i = 0; i < readyScenes.length; i++) {
      const sceneIndex = (scenes || []).indexOf(readyScenes[i]);
      if (sceneIndex !== -1) {
        setCurrentIndex(sceneIndex);
      }
      setExportProgress(Math.round(((i + 1) / readyScenes.length) * 100));
      const scene = readyScenes[i];
      const audio = new Audio(scene.audioUrl);
      audio.crossOrigin = "anonymous";
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(destination);
      await new Promise<void>((resolve) => { 
        audio.onended = () => { source.disconnect(); resolve(); }; 
        audio.onerror = () => { source.disconnect(); resolve(); };
        audio.play().catch(resolve); 
      });
    }
    recorder.stop();
  };

  if (!previewScenes || previewScenes.length === 0) {
    return (
      <div className="p-20 text-center bg-white rounded-2xl border-2 border-dashed flex flex-col items-center gap-4">
        <ImageIcon size={48} className="text-slate-200" />
        <p className="text-slate-400 font-bold">이미지가 생성된 장면이 없습니다. 스토리보드에서 '전체 생성'을 눌러주세요.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative group mx-auto" style={{ 
        aspectRatio: isShorts ? '9 / 16' : '16 / 9',
        maxWidth: isShorts ? '400px' : '100%'
      }}>
        <canvas ref={canvasRef} className="w-full h-full object-contain" />
        <audio ref={audioRef} onEnded={handleAudioEnd} className="hidden" />

        {(isExporting || processingSceneId !== null) && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-50 p-6 text-center">
            <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
            <h3 className="text-white font-bold text-xl mb-2">
              {processingSceneId ? "클립 추출 중..." : "고화질 비디오 인코딩 중..."}
            </h3>
            {!processingSceneId && (
              <>
                <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                </div>
                <span className="text-emerald-500 text-xs font-bold">{exportProgress}% 완료</span>
                <p className="text-slate-400 text-[10px] mt-2">일괄 다운로드 시 모든 장면이 동시에 생성되어 압축 파일로 제공됩니다.</p>
              </>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-8 z-20">
           <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="text-white transform hover:scale-125 transition-transform"><SkipBack size={isShorts ? 32 : 40}/></button>
           <button onClick={() => setIsPlaying(!isPlaying)} className="bg-white text-slate-900 p-5 rounded-full shadow-2xl transform hover:scale-110 transition-transform">
             {isPlaying ? <Pause size={isShorts ? 32 : 40} /> : <Play size={isShorts ? 32 : 40} className="ml-1"/>}
           </button>
           <button onClick={() => setCurrentIndex(Math.min(previewScenes.length - 1, currentIndex + 1))} className="text-white transform hover:scale-125 transition-transform"><SkipForward size={isShorts ? 32 : 40}/></button>
        </div>
        
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 z-10">
           <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
             <div 
               className="h-full bg-emerald-500 transition-all duration-300" 
               style={{ width: `${((currentIndex + 1) / previewScenes.length) * 100}%` }}
             ></div>
           </div>
           <span className="text-white text-[10px] font-black">{currentIndex + 1} / {previewScenes.length}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <button 
          onClick={handleExportFullVideo} 
          disabled={isExporting || processingSceneId !== null} 
          className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 font-bold"
        >
          <Download size={20} />
          통합 MP4 영상 다운로드
        </button>
        <button 
          onClick={handleExportAllIndividual} 
          disabled={isExporting || processingSceneId !== null} 
          className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl active:scale-95 disabled:opacity-50 font-bold"
        >
          <Archive size={20} />
          전체 개별 클립 일괄 다운로드 (ZIP)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             <Film size={18} className="text-emerald-600" /> 장면별 개별 관리
           </h3>
        </div>
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
          {(scenes || []).map((scene, index) => (
            <div key={scene.id} className={`p-4 flex items-center gap-4 transition-colors ${currentIndex === previewScenes.indexOf(scene) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
               <div className="w-24 aspect-video bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border border-slate-200" onClick={() => {
                 const pIdx = previewScenes.indexOf(scene);
                 if (pIdx !== -1) setCurrentIndex(pIdx);
               }}>
                 {scene.imageUrl ? <img src={scene.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}
               </div>
               
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 uppercase">Scene {index + 1}</span>
                    {scene.audioUrl && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Mic size={10} /> 음성 준비됨</span>}
                 </div>
                 <p className="text-xs text-slate-500 truncate">{scene.description}</p>
               </div>

               <div className="flex-shrink-0">
                 <button 
                   onClick={() => handleExportSingleScene(scene, index)}
                   disabled={!scene.imageUrl || !scene.audioUrl || processingSceneId !== null || isExporting}
                   className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-30 transition-all shadow-sm active:scale-90"
                   title="이 장면만 영상으로 다운로드"
                 >
                   {processingSceneId === scene.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                 </button>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
