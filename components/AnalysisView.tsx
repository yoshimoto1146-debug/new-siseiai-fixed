
import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Activity, ArrowLeft, Info, Sparkles, ChevronLeft, ChevronRight, TrendingUp, ArrowUpRight } from 'lucide-react';
import { AnalysisResults, PhotoData, PostureLandmarks, Point2D, PosturePoint } from '../types';

const LandmarkLayer: React.FC<{ 
  landmarks: PostureLandmarks; 
  color: string; 
  photo: PhotoData;
  opacity?: number;
  isDashed?: boolean;
}> = ({ landmarks, color, photo, opacity = 1, isDashed = false }) => {
  if (!landmarks || !landmarks.head) return null;
  const toPct = (val: number) => val / 10;
  
  const generateSpinePath = () => {
    if (!landmarks.spinePath || landmarks.spinePath.length === 0) return "";
    return `M ${landmarks.spinePath.map(p => `${toPct(p.x)} ${toPct(p.y)}`).join(' L ')}`;
  };

  const style = { 
    transform: `scale(${photo.scale}) translate(${photo.offset.x}px, ${photo.offset.y}px) scaleX(${photo.isFlipped ? -1 : 1})`,
    transformOrigin: 'center center',
    opacity: opacity
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40" style={style}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line 
          x1={toPct(landmarks.head.x)} y1={toPct(landmarks.head.y)} 
          x2={toPct(landmarks.heel.x)} y2={toPct(landmarks.heel.y)} 
          stroke={color} strokeWidth="0.2" strokeDasharray={isDashed ? "0.5,0.5" : "1,1"} strokeOpacity="0.4" 
        />
        <path 
          d={generateSpinePath()} 
          fill="none" 
          stroke={color} 
          strokeWidth={isDashed ? "0.4" : "0.8"} 
          strokeDasharray={isDashed ? "1,1" : "none"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
      {Object.entries(landmarks).map(([key, point]) => {
        if (key === 'spinePath' || !point || Array.isArray(point)) return null;
        const p = point as Point2D;
        return (
          <div key={key} className={`absolute rounded-full border border-white shadow-sm -translate-x-1/2 -translate-y-1/2 ${isDashed ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
            style={{ 
              left: `${toPct(p.x)}%`, 
              top: `${toPct(p.y)}%`, 
              backgroundColor: color,
              opacity: isDashed ? 0.5 : 1
            }} />
        );
      })}
    </div>
  );
};

export const AnalysisView: React.FC<{ results: AnalysisResults; photos: Record<string, PhotoData>; onReset: () => void }> = ({ results, photos, onReset }) => {
  const [activeView, setActiveView] = useState<'viewA' | 'viewB'>('viewA');
  const [sliderPos, setSliderPos] = useState(50);

  useEffect(() => {
    if (!results.viewB && activeView === 'viewB') {
      setActiveView('viewA');
    }
  }, [results.viewB, activeView]);

  const viewData = useMemo(() => {
    return activeView === 'viewA' ? results.viewA : results.viewB;
  }, [activeView, results]);

  const photoKey = activeView === 'viewA' ? 'v1' : 'v2';
  const photoBefore = photos[`${photoKey}-before`];
  const photoAfter = photos[`${photoKey}-after`];

  if (!viewData || !photoBefore?.url || !photoAfter?.url) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-xl text-center space-y-6 max-w-lg mx-auto">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <Info className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">表示エラー</h2>
        <p className="text-slate-500 font-bold">データを読み込めませんでした。もう一度お試しください。</p>
        <button onClick={onReset} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> 最初からやり直す
        </button>
      </div>
    );
  }

  const scoreDiff = results.overallAfterScore - results.overallBeforeScore;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full pb-20 px-2 md:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左側：ビジュアル比較 */}
        <div className="lg:col-span-7 space-y-6">
          {results.viewB && (
            <div className="flex bg-white p-1 rounded-[1.5rem] border shadow-sm ring-4 ring-slate-50">
              <button onClick={() => setActiveView('viewA')} className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all ${activeView === 'viewA' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 1: {results.viewA.type.toUpperCase()}
              </button>
              <button onClick={() => setActiveView('viewB')} className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all ${activeView === 'viewB' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 2: {results.viewB.type.toUpperCase()}
              </button>
            </div>
          )}
          
          <div className="relative aspect-[3/4] bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white group touch-none select-none">
            <div className="absolute inset-0 z-10">
              <img src={photoBefore.url} className="w-full h-full object-contain opacity-40 grayscale" style={{ transform: `scale(${photoBefore.scale}) translate(${photoBefore.offset.x}px, ${photoBefore.offset.y}px) scaleX(${photoBefore.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#94a3b8" photo={photoBefore} />
            </div>
            
            <div className="absolute inset-0 z-20" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img src={photoAfter.url} className="w-full h-full object-contain" style={{ transform: `scale(${photoAfter.scale}) translate(${photoAfter.offset.x}px, ${photoAfter.offset.y}px) scaleX(${photoAfter.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#ffffff" photo={photoAfter} opacity={0.3} isDashed={true} />
              <LandmarkLayer landmarks={viewData.afterLandmarks} color="#3b82f6" photo={photoAfter} />
            </div>
            
            <div className="absolute top-0 bottom-0 z-[60] w-1 bg-white/80 shadow-2xl flex items-center justify-center pointer-events-none" style={{ left: `${sliderPos}%` }}>
              <div className="w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-blue-600 pointer-events-auto active:scale-110 transition-transform">
                <ChevronLeft className="w-4 h-4 text-blue-600" /><ChevronRight className="w-4 h-4 text-blue-600" />
              </div>
            </div>

            <input type="range" className="absolute inset-0 z-[70] w-full h-full opacity-0 cursor-ew-resize" min="0" max="100" value={sliderPos} onChange={e => setSliderPos(Number(e.target.value))} />
          </div>
        </div>

        {/* 右側：スコア詳細 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">姿勢スコアの変化</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-slate-500">{results.overallBeforeScore}</span>
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                    <span className="text-6xl font-black text-blue-400">{results.overallAfterScore}</span>
                  </div>
                </div>
                {scoreDiff > 0 && (
                  <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-2xl border border-green-500/30 flex items-center gap-1 animate-bounce">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="font-black text-sm">+{scoreDiff}点UP</span>
                  </div>
                )}
              </div>
              <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                <p className="text-sm font-bold text-blue-50/90 leading-relaxed italic">"{results.summary}"</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[600px] flex-grow">
            {(Object.entries(results.detailedScores) as [string, PosturePoint][]).map(([key, item]) => {
               const diff = item.afterScore - item.beforeScore;
               return (
                <div key={key} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${diff > 0 ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-600'}`}>
                        {diff > 0 ? <CheckCircle2 className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                      </div>
                      <div>
                        <span className="font-black text-xs text-slate-800 uppercase tracking-wider">{item.label}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-bold text-slate-400">{item.beforeScore}</span>
                          <span className="text-xs text-slate-300">→</span>
                          <span className={`text-xl font-black ${diff > 0 ? 'text-green-500' : 'text-blue-600'}`}>{item.afterScore}pts</span>
                        </div>
                      </div>
                    </div>
                    {diff > 0 && (
                      <span className="text-[10px] font-black bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">
                        +{diff}
                      </span>
                    )}
                  </div>

                  <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    {/* Before Score Bar */}
                    <div 
                      className="absolute inset-0 bg-slate-300/40 transition-all duration-1000 ease-out" 
                      style={{ width: `${item.beforeScore}%` }}
                    ></div>
                    {/* After Score Bar */}
                    <div 
                      className={`absolute inset-0 ${diff > 0 ? 'bg-green-500' : 'bg-blue-600'} h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.3)]`} 
                      style={{ width: `${item.afterScore}%` }}
                    ></div>
                    {/* Progress indicator */}
                    {diff > 0 && (
                      <div 
                        className="absolute h-full bg-white/30 animate-pulse" 
                        style={{ left: `${item.beforeScore}%`, width: `${diff}%` }}
                      ></div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[12px] font-bold text-slate-600 leading-relaxed italic">
                      <span className="text-blue-500 mr-2">アドバイス:</span>{item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={onReset} className="w-full py-6 bg-slate-950 text-white rounded-[2.5rem] font-black text-sm uppercase hover:bg-blue-600 transition-all shadow-2xl flex items-center justify-center gap-3 group active:scale-95">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 最初に戻る
          </button>
        </div>
      </div>
    </div>
  );
};
