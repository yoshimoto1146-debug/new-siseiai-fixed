import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Activity, ArrowLeft, Info, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnalysisResults, PhotoData, PostureLandmarks, Point2D } from '../types';

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

  // viewBが存在しない場合、強制的にviewAへ
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

  // 白紙エラーを徹底防止
  if (!viewData || !photoBefore?.url || !photoAfter?.url) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-xl text-center space-y-6 max-w-lg mx-auto">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <Info className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">表示エラーを回避しました</h2>
        <p className="text-slate-500 font-bold">解析データの読み込みに失敗しました。2視点ある場合、データの形式が異なっている可能性があります。</p>
        <button onClick={onReset} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
          <ArrowLeft className="w-5 h-5" /> 最初からやり直す
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 画像比較：スプリットスライダー実装 */}
        <div className="lg:col-span-7 space-y-6">
          {results.viewB && (
            <div className="flex bg-white p-1 rounded-[1.5rem] border shadow-sm ring-4 ring-slate-50">
              <button 
                onClick={() => setActiveView('viewA')} 
                className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest ${activeView === 'viewA' ? 'bg-blue-600 text-white shadow-xl translate-y-[-1px]' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                視点 1: {results.viewA.type}
              </button>
              <button 
                onClick={() => setActiveView('viewB')} 
                className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-widest ${activeView === 'viewB' ? 'bg-blue-600 text-white shadow-xl translate-y-[-1px]' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                視点 2: {results.viewB.type}
              </button>
            </div>
          )}
          
          <div className="relative aspect-[3/4] bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-white group touch-none select-none">
            {/* Before (下層・固定) */}
            <div className="absolute inset-0 z-10">
              <img 
                src={photoBefore.url} 
                className="w-full h-full object-contain opacity-40 grayscale" 
                style={{ transform: `scale(${photoBefore.scale}) translate(${photoBefore.offset.x}px, ${photoBefore.offset.y}px) scaleX(${photoBefore.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} 
              />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#94a3b8" photo={photoBefore} />
              <div className="absolute top-8 right-8 px-4 py-2 bg-slate-900/60 backdrop-blur-md rounded-full text-[10px] font-black text-white tracking-widest border border-white/10 uppercase z-50">Before</div>
            </div>
            
            {/* After (上層・スライダーで左から表示) */}
            <div className="absolute inset-0 z-20" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img 
                src={photoAfter.url} 
                className="w-full h-full object-contain" 
                style={{ transform: `scale(${photoAfter.scale}) translate(${photoAfter.offset.x}px, ${photoAfter.offset.y}px) scaleX(${photoAfter.isFlipped ? -1 : 1})`, transformOrigin: 'center center' }} 
              />
              <LandmarkLayer landmarks={viewData.afterLandmarks} color="#3b82f6" photo={photoAfter} />
              <div className="absolute top-8 left-8 px-4 py-2 bg-blue-600 rounded-full text-[10px] font-black text-white tracking-widest shadow-2xl uppercase z-50">After</div>
            </div>
            
            {/* スライダーの仕切り線ハンドル */}
            <div 
              className="absolute top-0 bottom-0 z-[60] w-1 bg-white/80 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.5)] flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-[0_0_30px_rgba(0,0,0,0.3)] flex items-center justify-center border-4 border-blue-600 pointer-events-auto active:scale-110 transition-transform">
                <div className="flex gap-1.5">
                  <ChevronLeft className="w-4 h-4 text-blue-600" />
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            {/* スライダー操作用の透明インプット */}
            <input 
              type="range" 
              className="absolute inset-0 z-[70] w-full h-full opacity-0 cursor-ew-resize" 
              min="0" 
              max="100"
              value={sliderPos} 
              onChange={e => setSliderPos(Number(e.target.value))} 
            />
          </div>
          <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">左右にドラッグして変化をチェック</p>
        </div>

        {/* スコア・理学療法士のアドバイスエリア */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 総合評価カード */}
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden shrink-0 border border-white/5">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <p className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">Analysis Results</p>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">総合姿勢スコア</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-8xl font-black tracking-tighter tabular-nums leading-none">{results.overallAfterScore}</span>
                    <span className="text-2xl font-bold text-blue-500">/100</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 shadow-inner">
                <p className="text-sm font-bold leading-relaxed text-blue-50/90 italic">"{results.summary}"</p>
              </div>
            </div>
            
            {/* 背景装飾 */}
            <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-blue-500/10 rounded-full blur-[80px]"></div>
          </div>

          {/* 各部位の詳細スコアとアドバイス */}
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[500px] flex-grow">
            {Object.entries(results.detailedScores).map(([key, item]) => (
              <div key={key} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${item.status === 'improved' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-600'}`}>
                    {item.status === 'improved' ? <CheckCircle2 className="w-7 h-7" /> : <Activity className="w-7 h-7" />}
                  </div>
                  <div className="flex-grow space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-xs text-slate-800 uppercase tracking-tight">{item.label}</span>
                      <span className="text-lg font-black text-blue-600 tabular-nums">{item.score}<span className="text-[10px] ml-0.5">pts</span></span>
                    </div>
                    <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden shadow-inner p-[2px]">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                </div>
                
                {/* 理学療法士のアドバイス：ここを確実に表示 */}
                <div className="mt-4 pl-[76px] relative">
                  <div className="absolute left-[68px] top-1 bottom-1 w-[3px] bg-blue-100 rounded-full"></div>
                  <div className="flex items-start gap-3 bg-blue-50/30 p-4 rounded-2xl border border-blue-50/50">
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">理学療法士のアドバイス</p>
                      <p className="text-[12px] font-bold text-slate-600 leading-relaxed italic">
                        {item.description || "現在の姿勢を維持しつつ、日々のストレッチを継続しましょう。"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onReset} className="w-full py-6 bg-slate-950 text-white rounded-[2.5rem] font-black text-sm tracking-[0.2em] uppercase hover:bg-blue-600 transition-all shadow-2xl flex items-center justify-center gap-3 group active:scale-95">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 最初に戻って新しい分析へ
          </button>
        </div>
      </div>
    </div>
  );
};
