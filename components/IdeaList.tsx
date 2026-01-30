
import React, { useState } from 'react';
import { VideoIdea } from '../types';
import { Sparkles, ArrowRight, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface IdeaListProps {
  ideas: VideoIdea[];
  onSelect: (idea: VideoIdea) => void;
  loading: boolean;
}

export const IdeaList: React.FC<IdeaListProps> = ({ ideas, onSelect, loading }) => {
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const toggleSources = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedSources(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse p-5">
            <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6 mb-4"></div>
            <div className="h-10 bg-slate-50 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (ideas.length === 0) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-yellow-500" size={20} />
          실시간 트렌드 분석 추천 제목
        </h2>
        <span className="text-[10px] text-slate-400 font-medium">검색 기간: 2025.01.18 - 01.25</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md flex flex-col"
          >
            <button
              onClick={() => onSelect(idea)}
              className="p-5 text-left flex-1 hover:bg-emerald-50/30 transition-colors"
            >
              <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-emerald-700 leading-tight">
                {idea.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                {idea.premise}
              </p>
              <div className="flex items-center text-emerald-600 text-sm font-bold">
                이 제목으로 대본 작성 <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            {idea.sources && idea.sources.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50">
                <button 
                  onClick={(e) => toggleSources(e, idea.id)}
                  className="w-full px-5 py-2 flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  참고한 트렌드 소스 ({idea.sources.length}개)
                  {expandedSources[idea.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {expandedSources[idea.id] && (
                  <div className="px-5 pb-3 space-y-1.5 animate-fadeIn">
                    {idea.sources.map((source, idx) => (
                      <a 
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-[10px] text-slate-500 hover:text-indigo-600 transition-colors bg-white p-1.5 rounded border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={10} className="mt-0.5 flex-shrink-0" />
                        <span className="truncate flex-1">{source.title || source.uri}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
