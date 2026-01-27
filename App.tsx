import React, { useState } from 'react';
import { PhotoUploader } from './components/PhotoUploader';
import { ImageAdjustment } from './components/ImageAdjustment';
import { AnalysisView } from './components/AnalysisView';
import { ViewType, PhotoData, AnalysisResults } from './types';
import { analyzePosture, fileToBase64, resizeImage } from './services/gemini';
import { ChevronLeft, Sparkles, Activity, User, ArrowRight, AlertCircle, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'type-select' | 'upload' | 'align' | 'analyze'>('type-select');
  const [selectedView, setSelectedView] = useState<ViewType>('side');
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  
  const [photos, setPhotos] = useState<Record<string, PhotoData>>({
    'v1-before': { id: 'v1-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v1-after': { id: 'v1-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const viewLabels: Record<ViewType, string> = {
    front: '前面', back: '後面', side: '側面', extension: '伸展', flexion: '屈曲'
  };

  const handleUpload = async (key: string, file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64);
      setPhotos(prev => ({ ...prev, [key]: { ...prev[key], url: resized } }));
    } catch (e) {
      console.error("Upload error", e);
    }
  };

  const canProceedToAlign = () => !!photos['v1-before'].url && !!photos['v1-after'].url;

  const startAnalysis = async () => {
    setStep('analyze');
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const v1 = { type: selectedView, before: photos['v1-before'].url, after: photos['v1-after'].url };
      const res = await analyzePosture(v1);
      setResults(res);
      setIsAnalyzing(false);
    } catch (e: any) {
      console.error("Analysis caught error:", e);
      
      if (e.message === 'API_KEY_NOT_SET') {
        setError({
          title: 'APIキー未設定',
          message: '環境変数に API_KEY が設定されていません。プロジェクトの設定を確認してください。'
        });
      } else {
        setError({
          title: '解析エラー',
          message: 'AIとの通信に失敗しました。APIキーの有効期限や設定、ネットワーク状況を確認してください。'
        });
      }
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col p-4 md:p-8">
      <header className="max-w-6xl mx-auto w-full mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="font-black text-slate-900 tracking-tight text-xl italic uppercase">PostureRefine Pro</h1>
        </div>
      </header>

      <main className="flex-grow flex flex-col max-w-6xl mx-auto w-full">
        {step === 'type-select' && (
          <div className="my-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 text-center">
            <h2 className="text-4xl font-black text-slate-900">分析視点を選択</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(Object.keys(viewLabels) as ViewType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => setSelectedView(type)} 
                  className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${selectedView === type ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-white text-slate-400'}`}
                >
                  <User className="w-8 h-8" />
                  <span className="font-black text-sm uppercase">{viewLabels[type]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('upload')} className="mx-auto flex items-center gap-3 px-14 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl hover:bg-blue-600 transition-all">
              画像をアップロード <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            <button onClick={() => setStep('type-select')} className="text-slate-400 font-black text-xs flex items-center gap-2 uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> 戻る</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <PhotoUploader label="Before" imageUrl={photos[`v1-before`].url} onUpload={(f) => handleUpload(`v1-before`, f)} />
              <PhotoUploader label="After" imageUrl={photos[`v1-after`].url} onUpload={(f) => handleUpload(`v1-after`, f)} />
            </div>
            <button disabled={!canProceedToAlign()} onClick={() => setStep('align')} className="mx-auto block px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-30">
              位置調整へ
            </button>
          </div>
        )}

        {step === 'align' && (
          <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
             <button onClick={() => setStep('upload')} className="text-slate-400 font-black text-xs flex items-center gap-2 uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> 戻る</button>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
               <ImageAdjustment photo={photos[`v1-before`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v1-before`]: p}))} viewType={selectedView} />
               <ImageAdjustment photo={photos[`v1-after`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v1-after`]: p}))} viewType={selectedView} referencePhoto={photos[`v1-before`]} />
             </div>
             <button onClick={() => startAnalysis()} className="mx-auto mt-8 w-full max-w-lg px-12 py-6 bg-blue-600 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-blue-700 transition-all active:scale-95">
               <Sparkles className="w-6 h-6" /> AI 解析を開始
             </button>
          </div>
        )}

        {step === 'analyze' && (
          isAnalyzing ? (
            <div className="my-auto flex flex-col items-center justify-center space-y-8 text-center">
              <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <h2 className="text-2xl font-black text-slate-900">AI 診断中...</h2>
              <p className="text-slate-400 font-bold">姿勢のバランスを精密分析しています</p>
            </div>
          ) : error ? (
            <div className="my-auto max-w-lg mx-auto w-full bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-8">
              <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
              <h2 className="text-2xl font-black">{error.title}</h2>
              <p className="text-slate-500 font-bold">{error.message}</p>
              <button onClick={() => startAnalysis()} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-colors hover:bg-slate-800">
                <RefreshCcw className="w-5 h-5" /> 再試行
              </button>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">詳細はブラウザのコンソールを確認してください</p>
            </div>
          ) : results && <AnalysisView results={results} photos={photos} onReset={() => setStep('type-select')} />
        )}
      </main>
    </div>
  );
};

export default App;
