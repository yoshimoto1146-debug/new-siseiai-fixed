
import React, { useState } from 'react';
import { PhotoUploader } from './components/PhotoUploader';
import { ImageAdjustment } from './components/ImageAdjustment';
import { AnalysisView } from './components/AnalysisView';
import { ViewType, PhotoData, AnalysisResults } from './types';
import { analyzePosture, fileToBase64, resizeImage } from './services/gemini';
import { ChevronLeft, Sparkles, Activity, User, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'type-select' | 'upload' | 'align' | 'analyze'>('type-select');
  const [selectedViews, setSelectedViews] = useState<ViewType[]>(['back']);
  
  const [photos, setPhotos] = useState<Record<string, PhotoData>>({
    'v1-before': { id: 'v1-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v1-after': { id: 'v1-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v2-before': { id: 'v2-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v2-after': { id: 'v2-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const viewLabels: Record<ViewType, string> = {
    front: '前面', back: '後面', side: '側面', extension: '伸展', flexion: '屈曲'
  };

  const handleTypeToggle = (type: ViewType) => {
    if (selectedViews.includes(type)) {
      if (selectedViews.length > 1) setSelectedViews(selectedViews.filter(v => v !== type));
    } else {
      if (selectedViews.length < 2) setSelectedViews([...selectedViews, type]);
      else setSelectedViews([selectedViews[1], type]);
    }
  };

  const handleUpload = async (key: string, file: File) => {
    const base64 = await fileToBase64(file);
    const resized = await resizeImage(base64);
    setPhotos(prev => ({ ...prev, [key]: { ...prev[key], url: resized } }));
  };

  const canProceedToAlign = () => {
    return selectedViews.every((_, i) => photos[`v${i+1}-before`].url && photos[`v${i+1}-after`].url);
  };

  const startAnalysis = async () => {
    setStep('analyze');
    setIsAnalyzing(true);
    try {
      const v1 = { type: selectedViews[0], before: photos['v1-before'].url, after: photos['v1-after'].url };
      const v2 = selectedViews.length > 1 ? { type: selectedViews[1], before: photos['v2-before'].url, after: photos['v2-after'].url } : undefined;
      const res = await analyzePosture(v1, v2);
      setResults(res);
    } catch (e: any) {
      alert(`分析失敗: ${e.message}`);
      setStep('align');
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col p-4 md:p-8">
      <header className="max-w-6xl mx-auto w-full flex items-center mb-8 gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <Activity className="w-5 h-5" />
        </div>
        <h1 className="font-black text-slate-900 tracking-tight text-xl italic uppercase">PostureRefine Pro</h1>
      </header>

      <main className="flex-grow flex flex-col max-w-6xl mx-auto w-full">
        {step === 'type-select' && (
          <div className="my-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-black text-slate-900">分析する視点を選択</h2>
              <p className="text-slate-400 font-bold">後面のみでも、2つの視点でも分析可能です</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(Object.keys(viewLabels) as ViewType[]).map(type => (
                <button key={type} onClick={() => handleTypeToggle(type)} className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${selectedViews.includes(type) ? 'border-blue-600 bg-blue-50 text-blue-600 ring-4 ring-blue-50' : 'border-slate-100 bg-white text-slate-400'}`}>
                  <User className="w-8 h-8" />
                  <span className="font-black text-sm uppercase">{viewLabels[type]}</span>
                </button>
              ))}
            </div>
            <button disabled={selectedViews.length === 0} onClick={() => setStep('upload')} className="mx-auto flex items-center gap-3 px-14 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl disabled:opacity-20 hover:bg-blue-600 transition-all">
              画像アップロードへ <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <button onClick={() => setStep('type-select')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase"><ChevronLeft className="w-4 h-4" /> 視点選択に戻る</button>
            <div className={`grid grid-cols-1 ${selectedViews.length > 1 ? 'md:grid-cols-2' : ''} gap-12`}>
              {selectedViews.map((view, i) => (
                <div key={view} className="space-y-6">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-center">{viewLabels[view]}分析</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <PhotoUploader label="Before" imageUrl={photos[`v${i+1}-before`].url} onUpload={(f) => handleUpload(`v${i+1}-before`, f)} />
                    <PhotoUploader label="After" imageUrl={photos[`v${i+1}-after`].url} onUpload={(f) => handleUpload(`v${i+1}-after`, f)} />
                  </div>
                </div>
              ))}
            </div>
            <button disabled={!canProceedToAlign()} onClick={() => setStep('align')} className="mx-auto block px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-10">
              位置合わせの調整
            </button>
          </div>
        )}

        {step === 'align' && (
          <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
             <button onClick={() => setStep('upload')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase mb-4"><ChevronLeft className="w-4 h-4" /> 画像選択に戻る</button>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
               {selectedViews.flatMap((view, i) => [
                 <div key={`align-v${i+1}-before`} className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{viewLabels[view]} : Before</p>
                    <ImageAdjustment photo={photos[`v${i+1}-before`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v${i+1}-before`]: p}))} />
                 </div>,
                 <div key={`align-v${i+1}-after`} className="space-y-3">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest text-center">{viewLabels[view]} : After (透過Before重畳中)</p>
                    <ImageAdjustment photo={photos[`v${i+1}-after`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v${i+1}-after`]: p}))} referencePhoto={photos[`v${i+1}-before`]} />
                 </div>
               ])}
             </div>
             
             <button onClick={startAnalysis} className="mt-8 px-12 py-6 bg-blue-600 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:scale-105 transition-transform sticky bottom-4 z-50">
               <Sparkles className="w-6 h-6" /> AI 高精密解析を開始
             </button>
          </div>
        )}

        {step === 'analyze' && (
          isAnalyzing ? (
            <div className="my-auto flex flex-col items-center justify-center space-y-8">
              <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <h2 className="text-2xl font-black text-slate-900">AI 姿勢診断中...</h2>
              <p className="text-slate-400 font-bold animate-pulse">最新の理学療法知見に基づいて分析しています</p>
            </div>
          ) : results && <AnalysisView results={results} photos={photos} onReset={() => setStep('type-select')} />
        )}
      </main>
    </div>
  );
};

export default App;
