import React, { useState } from 'react';
import { CheckCircle2, Activity, Share2, ArrowLeft } from 'lucide-react';
import { AnalysisResults, PhotoData, PostureLandmarks, Point2D, PosturePoint } from '../types';

const LandmarkLayer: React.FC<{ landmarks: PostureLandmarks; color: string; photo: PhotoData }> = ({ landmarks, color, photo }) => {
  if (!landmarks) return null;
  const toPct = (val: number) => val / 10;
  
  const generateSpinePath = () => {
    if (!landmarks.spinePath || landmarks.spinePath.length === 0) return "";
    return `M ${landmarks.spinePath.map(p => `${toPct(p.x)} ${toPct(p.y)}`).join(' L ')}`;
  };

  const style = { 
    transform: `scale(${photo.scale}) translate(${photo.offset.x}px, ${photo.offset.y}px) scaleX(${photo.isFlipped ? -1 : 1})`,
    transformOrigin: 'center center'
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40" style={style}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line 
          x1={toPct(landmarks.head.x)} y1={toPct(landmarks.head.y)} 
          x2={toPct(landmarks.heel.x)} y2={toPct(landmarks.heel.y)} 
          stroke={color} strokeWidth="0.2" strokeDasharray="1,1" strokeOpacity="0.3" 
        />
        <path d={generateSpinePath()} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {Object.entries(landmarks).map(([key, point]) => {
        if (key === 'spinePath' || !point || Array.isArray(point)) return null;
        const p = point as Point2D;
        return (
          <div key={key} className="absolute w-1.5 h-1.5 rounded-full border border-white shadow-sm -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${toPct(p.x)}%`, top: `${toPct(p.y)}%`, backgroundColor: color }} />
        );
      })}
    </div>
  );
};

export const AnalysisView: React.FC<{ results: AnalysisResults; photos: Record<string, PhotoData>; onReset: () => void }> = ({ results, photos, onReset }) => {
  const [activeView, setActiveView] = useState<'viewA' | 'viewB'>('viewA');
  const [sliderPos, setSliderPos] = useState(50);

  const viewData = activeView === 'viewA' ? results.viewA : results.viewB;
  const photoKey = activeView === 'viewA' ? 'v1' : 'v2';
  
  const photoBefore = photos[`${photoKey}-before`];
  const photoAfter = photos[`${photoKey}-after`];

  if (!viewData || !photoBefore || !photoAfter) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          {results.viewB && (
            <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
              <button onClick={() => setActiveView('viewA')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${activeView === 'viewA' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 1: {results.viewA.type.toUpperCase()}
              </button>
              <button onClick={() => setActiveView('viewB')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${activeView === 'viewB' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 2: {results.viewB.type.toUpperCase()}
              </button>
            </div>
          )}
          
          <div className="relative aspect-[3/4] bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white group">
            <div className="absolute inset-0">
              <img src={photoBefore.url} className="w-full h-full object-contain opacity-50 grayscale" style={{ transform: `scale(${photoBefore.scale}) translate(${photoBefore.offset.x}px, ${photoBefore.offset.y}px) scaleX(${photoBefore.isFlipped ? -1 : 1})` }} />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#94a3b8" photo={photoBefore} />
              <div className="absolute top-6 left-6 px-4 py-2 bg-slate-800/80 backdrop-blur-md rounded-full text-[10px] font-black text-white tracking-widest border border-white/10 uppercase">Before</div>
            </div>
            
            <div className="absolute inset-0 z-20" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img src={photoAfter.url} className="w-full h-full object-contain" style={{ transform: `scale(${photoAfter.scale}) translate(${photoAfter.offset.x}px, ${photoAfter.offset.y}px) scaleX(${photoAfter.isFlipped ? -1 : 1})` }} />
              <LandmarkLayer landmarks={viewData.afterLandmarks} color="#3b82f6" photo={photoAfter} />
              <div className="absolute top-6 left-6 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black text-white tracking-widest shadow-lg uppercase">After</div>
            </div>
            
            <input 
              type="range" 
              className="absolute bottom-10 left-10 right-10 z-50 accent-blue-600 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer" 
              value={sliderPos} 
              onChange={e => setSliderPos(Number(e.target.value))} 
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4 flex flex-col">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden shrink-0 border border-white/5">
            <p className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase mb-4">POSTURE ANALYSIS PRO</p>
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Analysis Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black tracking-tighter tabular-nums leading-none">{results.overallAfterScore}</span>
                  <span className="text-xl font-bold text-blue-500">/100</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <p className="text-xs font-medium leading-relaxed text-blue-50/80">{results.summary}</p>
            </div>
          </div>

          <div className="flex-grow space-y-2 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
            {Object.entries(results.detailedScores).map(([key, value]) => {
              const item = value as PosturePoint;
              return (
                <div key={key} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 transition-all hover:border-blue-200 group">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.status === 'improved' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
                    {item.status === 'improved' ? <CheckCircle2 className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-xs text-slate-700">{item.label}</span>
                      <span className="text-sm font-black text-blue-600">{item.score}<span className="text-[10px] ml-0.5">pts</span></span>
                    </div>
                    <div className="w-full bg-slate-50 h-1 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={onReset} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm tracking-widest uppercase hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> NEW ANALYSIS
          </button>
        </div>
      </div>
    </div>
  );
};
