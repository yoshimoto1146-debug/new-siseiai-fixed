// Import React to fix 'Cannot find namespace React' errors
import React, { useState } from 'react';
import { CheckCircle2, Activity, ArrowLeft, Info, Sparkles, ChevronLeft, ChevronRight, TrendingUp, ArrowUpRight, Share2 } from 'lucide-react';
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
  
  // 背骨のラインを描画（曲線）
  const generateSpinePath = () => {
    const points = landmarks.spinePath || [];
    if (points.length < 2) return "";
    
    // ベジェ曲線風に滑らかにつなぐ
    let path = `M ${toPct(points[0].x)} ${toPct(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${toPct(points[i].x)} ${toPct(points[i].y)}`;
    }
    return path;
  };

  const style = { 
    transform: `scale(${photo.scale}) translate(${photo.offset.x}px, ${photo.offset.y}px) scaleX(${photo.isFlipped ? -1 : 1})`,
    transformOrigin: 'center center',
    opacity: opacity
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40" style={style}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* 垂直基準線 */}
        <line 
          x1={toPct(landmarks.head.x)} y1={toPct(landmarks.head.y)} 
          x2={toPct(landmarks.head.x)} y2={toPct(landmarks.heel.y)} 
          stroke="white" strokeWidth="0.1" strokeDasharray="1,1" strokeOpacity="0.2" 
        />
        
        {/* 背骨のライン（メインの強調表示） */}
        <path 
          d={generateSpinePath()} 
          fill="none" 
          stroke={color} 
          strokeWidth={isDashed ? "0.8" : "1.8"} 
          strokeDasharray={isDashed ? "2,2" : "none"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={isDashed ? "" : "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"}
          style={{ filter: isDashed ? 'none' : `drop-shadow(0 0 4px ${color})` }}
        />

        {/* 主要関節点の表示 */}
        {[landmarks.head, landmarks.shoulder, landmarks.hip, landmarks.knee, landmarks.ankle].map((p, i) => (
          <circle 
            key={i}
            cx={toPct(p.x)} 
            cy={toPct(p.y)} 
            r={isDashed ? "0.5" : "0.8"}
            fill={color}
            stroke="white"
            strokeWidth="0.2"
          />
        ))}
      </svg>
    </div>
  );
};

export const AnalysisView: React.FC<{ results: AnalysisResults; photos: Record<string, PhotoData>; onReset: () => void }> = ({ results, photos, onReset }) => {
  const [sliderPos, setSliderPos] = useState(50);

  const viewData = results.viewA;
  const photoBefore = photos[`v1-before`];
  const photoAfter = photos[`v1-after`];

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '姿勢分析レポート',
          text: `【姿勢改善結果】Before: ${results.overallBeforeScore}点 → After: ${results.overallAfterScore}点！\n${results.summary}`,
          url: window.location.href
        });
      } catch (e) {
        window.print();
      }
    } else {
      window.print();
    }
  };

  if (!viewData || !photoBefore?.url || !photoAfter?.url) return null;

  const scoreDiff = results.overallAfterScore - results.overallBeforeScore;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full pb-20 px-2 md:px-0">
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={onReset} className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest px-4 py-2 hover:bg-slate-50 rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" /> 戻る
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
          <Share2 className="w-4 h-4" /> レポートを保存
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="relative aspect-[3/4] bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white group touch-none select-none">
            {/* Before レイヤー */}
            <div className="absolute inset-0 z-10">
              <img 
                src={photoBefore.url} 
                className="w-full h-full object-contain opacity-60" 
                style={{ 
                  transform: `scale(${photoBefore.scale}) translate(${photoBefore.offset.x}px, ${photoBefore.offset.y}px) scaleX(${photoBefore.isFlipped ? -1 : 1})`, 
                  transformOrigin: 'center center' 
                }} 
              />
              <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#94a3b8" photo={photoBefore} />
            </div>
            
            {/* After レイヤー (スライダーで制御) */}
            <div className="absolute inset-0 z-20" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <div className="absolute inset-0 bg-slate-950">
                <img 
                  src={photoAfter.url} 
                  className="w-full h-full object-contain" 
                  style={{ 
                    transform: `scale(${photoAfter.scale}) translate(${photoAfter.offset.x}px, ${photoAfter.offset.y}px) scaleX(${photoAfter.isFlipped ? -1 : 1})`, 
                    transformOrigin: 'center center' 
                  }} 
                />
                {/* 比較用にBeforeの背骨ラインを点線で薄く残す */}
                <LandmarkLayer landmarks={viewData.beforeLandmarks} color="#ffffff" photo={photoAfter} opacity={0.2} isDashed={true} />
                {/* メインのAfter背骨ライン（青く光る） */}
                <LandmarkLayer landmarks={viewData.afterLandmarks} color="#3b82f6" photo={photoAfter} />
              </div>
            </div>
            
            {/* スライダーハンドル */}
            <div className="absolute top-0 bottom-0 z-[60] w-1 bg-white/80 shadow-2xl flex items-center justify-center pointer-events-none" style={{ left: `${sliderPos}%` }}>
              <div className="w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-blue-600 pointer-events-auto active:scale-110 transition-transform">
                <ChevronLeft className="w-4 h-4 text-blue-600" /><ChevronRight className="w-4 h-4 text-blue-600" />
              </div>
            </div>

            <input type="range" className="absolute inset-0 z-[70] w-full h-full opacity-0 cursor-ew-resize" min="0" max="100" value={sliderPos} onChange={e => setSliderPos(Number(e.target.value))} />
            
            <div className="absolute bottom-6 left-6 right-6 z-[80] flex justify-between">
               <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/20">Before (Grey Line)</div>
               <div className="bg-blue-600/80 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/20">After (Blue Glow)</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles className="w-24 h-24" /></div>
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">改善スコア</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-slate-500">{results.overallBeforeScore}</span>
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                    <span className="text-6xl font-black text-blue-400">{results.overallAfterScore}</span>
                  </div>
                </div>
                {scoreDiff > 0 && (
                  <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-2xl border border-green-500/30 flex items-center gap-1 animate-bounce">
                    <ArrowUpRight className="w-4 h-4" /><span className="font-black text-sm">+{scoreDiff} Up</span>
                  </div>
                )}
              </div>
              <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                <p className="text-sm font-bold text-blue-50/90 leading-relaxed italic">"{results.summary}"</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {(Object.entries(results.detailedScores) as [string, PosturePoint][]).map(([key, item]) => {
               const diff = item.afterScore - item.beforeScore;
               return (
                <div key={key} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[11px] text-slate-400 uppercase tracking-wider">{item.label}</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${diff > 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-800">{item.afterScore}点</span>
                    <div className="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${diff > 0 ? 'bg-green-500' : 'bg-blue-600'} transition-all duration-1000`} style={{ width: `${item.afterScore}%` }}></div>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
