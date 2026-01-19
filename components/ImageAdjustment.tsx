import React, { useState, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FlipHorizontal2 } from 'lucide-react';
import { PhotoData } from '../types';

interface ImageAdjustmentProps {
  photo: PhotoData;
  onUpdate: (photo: PhotoData) => void;
  referencePhoto?: PhotoData;
}

export const ImageAdjustment: React.FC<ImageAdjustmentProps> = ({ photo, onUpdate, referencePhoto }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    lastPos.current = { x: clientX, y: clientY };
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - lastPos.current.x;
    const dy = clientY - lastPos.current.y;
    onUpdate({
      ...photo,
      offset: { x: photo.offset.x + dx, y: photo.offset.y + dy }
    });
    lastPos.current = { x: clientX, y: clientY };
  }, [isDragging, photo, onUpdate]);

  const handleEnd = () => setIsDragging(false);

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white select-none touch-none">
        {/* 透明なドラッグ受け取りレイヤー */}
        <div 
          className="absolute inset-0 z-[100] cursor-move"
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleEnd}
        />

        {/* 赤い十字線ガイド (床面ギリギリ bottom-0 に配置) */}
        <div className="absolute inset-0 z-[80] pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/40"></div>
          <div className="absolute top-0 left-1/2 w-[1px] h-full bg-red-500/40"></div>
          
          {/* 足元ターゲット (位置を最下部に固定) */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-14 h-14 border-[3px] border-red-500 rounded-full flex items-center justify-center bg-red-500/10 backdrop-blur-[2px] shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
            </div>
            <p className="mt-1 px-2 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-full uppercase tracking-tighter shadow-xl ring-1 ring-white/20">
              かかとをここに固定
            </p>
          </div>
        </div>

        {/* 参照画像 (Before) - 透かし表示 */}
        {referencePhoto && referencePhoto.url && (
          <div 
            className="absolute inset-0 pointer-events-none z-20 mix-blend-screen opacity-30 grayscale"
            style={{ 
              transform: `scale(${referencePhoto.scale}) translate(${referencePhoto.offset.x}px, ${referencePhoto.offset.y}px) scaleX(${referencePhoto.isFlipped ? -1 : 1})`,
              transformOrigin: 'center center'
            }}
          >
            <img src={referencePhoto.url} className="w-full h-full object-contain" alt="Reference" />
          </div>
        )}

        {/* メイン画像 */}
        <div 
          className="absolute inset-0 pointer-events-none z-30"
          style={{ 
            transform: `scale(${photo.scale}) translate(${photo.offset.x}px, ${photo.offset.y}px) scaleX(${photo.isFlipped ? -1 : 1})`,
            transformOrigin: 'center center',
            opacity: isDragging ? 0.7 : 1 
          }}
        >
          {photo.url && <img src={photo.url} className="w-full h-full object-contain" alt="Target" />}
        </div>
      </div>

      {/* 調整ツール */}
      <div className="flex justify-center items-center gap-2 p-2 bg-white rounded-full shadow-lg border border-slate-100 w-fit mx-auto relative z-[110]">
        <button onClick={() => onUpdate({...photo, scale: photo.scale + 0.1})} className="p-2.5 hover:bg-slate-50 rounded-full text-slate-600 transition-colors"><ZoomIn className="w-5 h-5"/></button>
        <button onClick={() => onUpdate({...photo, scale: Math.max(0.1, photo.scale - 0.1)})} className="p-2.5 hover:bg-slate-50 rounded-full text-slate-600 transition-colors"><ZoomOut className="w-5 h-5"/></button>
        <button onClick={() => onUpdate({...photo, isFlipped: !photo.isFlipped})} className={`p-2.5 rounded-full transition-all ${photo.isFlipped ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FlipHorizontal2 className="w-5 h-5"/></button>
        <button onClick={() => onUpdate({...photo, scale: 1, offset: {x:0, y:0}, isFlipped: false})} className="p-2.5 text-red-400 hover:bg-red-50 rounded-full transition-colors"><RotateCcw className="w-5 h-5"/></button>
      </div>
    </div>
  );
};
