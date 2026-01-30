
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { IdeaList } from './components/IdeaList';
import { ScriptViewer } from './components/ScriptViewer';
import { ApiKeyModal } from './components/ApiKeyModal';
import { VideoIdea, ScriptSection, ScriptType } from './types';
import { generateVideoIdeas, generateScript } from './services/geminiService';
import { User, Loader2, Zap, FileText, Search, Brain, Heart } from 'lucide-react';

const DEFAULT_NAME = "삶의지혜";

function App() {
  const [apiKeySet, setApiKeySet] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false); // 모달 표시 여부 제어
  
  const [step, setStep] = useState<'ideas' | 'script'>('ideas');
  const [protagonistName, setProtagonistName] = useState(DEFAULT_NAME);
  const [scriptType, setScriptType] = useState<ScriptType>('longform');
  const [keyword, setKeyword] = useState("");
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null);
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
  
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  useEffect(() => {
    // Check if API key exists in local storage or env
    const localKey = localStorage.getItem('gemini_api_key');
    const envKey = process.env.API_KEY;
    if (localKey || envKey) {
      setApiKeySet(true);
    } else {
      setShowApiKeyModal(true); // 키가 없으면 모달 열기
    }
  }, []);

  const handleApiKeySave = () => {
    setApiKeySet(true);
    setShowApiKeyModal(false);
    setIsQuotaExceeded(false); // 키를 바꿨으므로 쿼타 에러 상태 해제
    setError(null);
  };

  const handleOpenApiKeyModal = () => {
    setShowApiKeyModal(true);
  };

  const handleCloseApiKeyModal = () => {
    // 키가 이미 세팅되어 있다면 닫기 가능, 아니면 닫기 불가 (초기 진입 시)
    if (apiKeySet) {
      setShowApiKeyModal(false);
    }
  };

  const handleGenerateIdeas = async () => {
    setLoadingIdeas(true);
    setError(null);
    setIsQuotaExceeded(false);
    try {
      const newIdeas = await generateVideoIdeas(keyword);
      setIdeas(Array.isArray(newIdeas) ? newIdeas : []);
    } catch (err: any) {
      setError(err.message || "아이디어를 생성하는 도중 문제가 발생했습니다.");
      if (err.isQuotaError) setIsQuotaExceeded(true);
      // 기존 아이디어 유지 (에러가 나도 데이터 날리지 않음)
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleSelectIdea = async (idea: VideoIdea) => {
    setSelectedIdea(idea);
    setLoadingScript(true);
    setStep('script');
    setError(null);
    try {
      const response = await generateScript(idea.title, protagonistName, scriptType);
      if (response && Array.isArray(response.sections)) {
        setScriptSections(response.sections);
      } else {
        throw new Error("Invalid script response");
      }
    } catch (err: any) {
      setError(err.message || "대본을 작성하는 도중 문제가 발생했습니다.");
      if (err.isQuotaError) setIsQuotaExceeded(true);
      setStep('ideas');
    } finally {
      setLoadingScript(false);
    }
  };

  const reset = () => {
    setStep('ideas');
    setScriptSections([]);
    setSelectedIdea(null);
    setError(null);
  };

  return (
    <>
      {showApiKeyModal && (
        <ApiKeyModal 
          onSave={handleApiKeySave} 
          onClose={apiKeySet ? handleCloseApiKeyModal : undefined} // 키가 없으면 닫기 버튼 숨김
        />
      )}

      <Layout onChangeApiKey={handleOpenApiKeyModal}>
        <div className="space-y-8">
          {step === 'ideas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    채널 페르소나 / 이름
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={protagonistName}
                      onChange={(e) => setProtagonistName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="예: 삶의지혜"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    영상 형식 선택
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setScriptType('longform')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${scriptType === 'longform' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <FileText size={16} /> 롱폼 (5000자)
                    </button>
                    <button 
                      onClick={() => setScriptType('shorts')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${scriptType === 'shorts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Zap size={16} /> 쇼츠 (1200자)
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  심리/철학 주제 키워드 (선택 사항)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="예: 노년의 고독, 무례한 사람 대처법, 자존감 회복 등"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
                  />
                </div>
                <p className="text-[10px] text-slate-400">중장년층이 공감할 만한 심리적 키워드를 입력하면 더 효과적인 아이디어가 나옵니다.</p>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={handleGenerateIdeas}
                  disabled={loadingIdeas}
                  className="w-full md:w-1/2 px-6 py-3 bg-indigo-900 text-white font-bold rounded-xl hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
                >
                  {loadingIdeas ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      바이럴 제목 구상 중...
                    </>
                  ) : (
                    <>
                      <Brain size={20} />
                      철학적 통찰 아이디어 생성
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center font-medium animate-fadeIn border border-red-100 shadow-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span>{error}</span>
                    {isQuotaExceeded && (
                      <button 
                        onClick={handleOpenApiKeyModal} 
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                      >
                        API 키 변경하고 계속하기
                      </button>
                    )}
                  </div>
              </div>
          )}

          {step === 'ideas' && ideas && Array.isArray(ideas) && (
            <IdeaList 
              ideas={ideas} 
              onSelect={handleSelectIdea} 
              loading={loadingIdeas} 
            />
          )}

          {step === 'script' && loadingScript && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl animate-pulse">🧠</span>
                </div>
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">
                심리학 기반 전문 대본을 집필하고 있습니다...
              </h3>
              <p className="mt-2 text-slate-500 max-w-md flex flex-col items-center gap-2">
                <span className="flex items-center gap-1.5 text-indigo-600 font-bold"><Heart size={14} /> 공감과 위로의 감정선을 설계 중</span>
                <span className="text-xs text-slate-400 font-medium">(중장년층 타겟 맞춤형 톤앤매너 반영 중)</span>
              </p>
            </div>
          )}

          {step === 'script' && !loadingScript && scriptSections.length > 0 && selectedIdea && (
            <ScriptViewer 
              initialSections={scriptSections} 
              title={selectedIdea.title} 
              protagonistName={protagonistName}
              scriptType={scriptType}
              onBack={reset} 
              onChangeApiKey={handleOpenApiKeyModal}
            />
          )}
        </div>
      </Layout>
    </>
  );
}

export default App;
