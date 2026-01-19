import React, { useState, useEffect } from 'react';
import { CheckCircle2, Activity, ArrowLeft, Info, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnalysisResults, PhotoData, PostureLandmarks, Point2D, PosturePoint } from '../types';

const LandmarkLayer: React.FC<{ landmarks: PostureLandmarks; color: string; photo: PhotoData }> = ({ landmarks, color, photo }) => {
  if (!landmarks || !landmarks.head) return null;
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
          stroke={color} strokeWidth="0.2" strokeDasharray="1,1" strokeOpacity="0.4" 
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

  // 視点の切り替え時にデータが存在するかチェック
  useEffect(() => {
    if (activeView === 'viewB' && !results.viewB) {
      setActiveView('viewA');
    }
  }, [results, activeView]);

  const viewData = activeView === 'viewA' ? results.viewA : results.viewB;
  const photoKey = activeView === 'viewA' ? 'v1' : 'v2';
  
  const photoBefore = photos[`${photoKey}-before`];
  const photoAfter = photos[`${photoKey}-after`];

  // 白紙回避のためのデータ存在チェック
  if (!viewData || !photoBefore?.url || !photoAfter?.url) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-xl text-center space-y-6">
        <Info className="w-16 h-16 text-blue-500" />
        <h2 className="text-2xl font-black text-slate-900">表示エラーが発生しました</h2>
        <p className="text-slate-500">解析データの一部が取得できませんでした。最初からやり直してください。</p>
        <button onClick={onReset} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> 最初に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* スプリット・スライダー比較エリア */}
        <div className="lg:col-span-7 space-y-4">
          {results.viewB && (
            <div className="flex bg-white p-1 rounded-2xl border shadow-sm mb-4">
              <button onClick={() => setActiveView('viewA')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${activeView === 'viewA' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 1: {results.viewA.type.toUpperCase()}
              </button>
              <button onClick={() => setActiveView('viewB')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${activeView === 'viewB' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                視点 2: {results.viewB.type.toUpperCase()}
              </button>
            </div>
          )}
          
          <div className="relative aspect-[3/4] bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white group touch-none select-none">
            {/* Before (下層・右側に見える) */}
            <div className="absolute inset-0 z-10">
              <img 
                src={photoBefore.url} 
                className="w-full h-full object-contain opacity-50 grayscale" 
                style={{ transform: `scale(${photoBefore.scale}) translate(${photoBefore.offset.x}px, ${photoBefore.offset.y}px) scaleX(${photoBefore.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} 
              />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#94a3b8" photo={photoBefore} />
              <div className="absolute top-6 right-6 px-4 py-2 bg-slate-800/80 backdrop-blur-md rounded-full text-[10px] font-black text-white tracking-widest border border-white/10 uppercase z-10">Before</div>
            </div>
            
            {/* After (上層・左側を切り取る) */}
            <div className="absolute inset-0 z-20" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img 
                src={photoAfter.url} 
                className="w-full h-full object-contain" 
                style={{ transform: `scale(${photoAfter.scale}) translate(${photoAfter.offset.x}px, ${photoAfter.offset.y}px) scaleX(${photoAfter.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} 
              />
              <LandmarkLayer landmarks={viewData.afterLandmarks} color="#3b82f6" photo={photoAfter} />
              <div className="absolute top-6 left-6 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black text-white tracking-widest shadow-lg uppercase z-30">After</div>
            </div>
            
            {/* スライダーハンドル (中央線) */}
            <div 
              className="absolute top-0 bottom-0 z-40 w-1 bg-white flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-10 h-10 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-blue-600 pointer-events-auto">
                <div className="flex gap-1">
                  <ChevronLeft className="w-3.5 h-3.5 text-blue-600" />
                  <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                </div>
              </div>
            </div>

            {/* 透明な操作用スライダー */}
            <input 
              type="range" 
              className="absolute inset-0 z-[50] w-full h-full opacity-0 cursor-ew-resize" 
              min="0" 
              max="100"
              value={sliderPos} 
              onChange={e => setSliderPos(Number(e.target.value))} 
            />
          </div>
          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">画像中央をドラッグして Before/After を比較</p>
        </div>

        {/* 評価エリア */}
        <div className="lg:col-span-5 space-y-4 flex flex-col h-full">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden shrink-0 border border-white/5">
            <p className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Posture Analysis Result
            </p>
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">総合改善スコア</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black tracking-tighter tabular-nums leading-none">{results.overallAfterScore}</span>
                  <span className="text-xl font-bold text-blue-500">/100</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/10">
              <p className="text-[11px] font-medium leading-relaxed text-blue-50/80 italic">"{results.summary}"</p>
            </div>
          </div>

          <div className="flex-grow space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(results.detailedScores).map(([key, item]) => (
              <div key={key} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm transition-all hover:border-blue-200">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.status === 'improved' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
                    {item.status === 'improved' ? <CheckCircle2 className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-[11px] text-slate-700 uppercase">{item.label}</span>
                      <span className="text-sm font-black text-blue-600">{item.score}<span className="text-[10px] ml-0.5">pts</span></span>
                    </div>
                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                </div>
                {/* 改善アドバイスを表示 */}
                <div className="mt-2 pl-[58px] relative">
                  <div className="absolute left-[54px] top-1 bottom-1 w-[2px] bg-blue-50 rounded-full"></div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onReset} className="w-full py-5.5 bg-slate-900 text-white rounded-[2rem] font-black text-xs tracking-widest uppercase hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2 mt-2">
            <ArrowLeft className="w-4 h-4" /> 最初に戻って新しく分析
          </button>
        </div>
      </div>
    </div>
  );
};
