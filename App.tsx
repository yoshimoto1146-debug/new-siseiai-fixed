
import React, { useState, useEffect, useCallback } from 'react';
import { PhotoUploader } from './components/PhotoUploader';
import { ImageAdjustment } from './components/ImageAdjustment';
import { AnalysisView } from './components/AnalysisView';
import { ViewType, PhotoData, AnalysisResults } from './types';
import { analyzePosture, fileToBase64, resizeImage } from './services/gemini';
import { ChevronLeft, Sparkles, Activity, User, ArrowRight, AlertCircle, Key, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'type-select' | 'upload' | 'align' | 'analyze'>('type-select');
  const [selectedViews, setSelectedViews] = useState<ViewType[]>(['back']);
  const [error, setError] = useState<{title: string, message: string, isQuota?: boolean} | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  
  const [photos, setPhotos] = useState<Record<string, PhotoData>>({
    'v1-before': { id: 'v1-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v1-after': { id: 'v1-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v2-before': { id: 'v2-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v2-after': { id: 'v2-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const checkKeyStatus = useCallback(async () => {
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        console.warn("Key status check failed, assuming false", e);
        setHasKey(false);
      }
    }
  }, []);

  useEffect(() => {
    checkKeyStatus();
    // 1秒後にもう一度チェック（window.aistudioの初期化ラグ対策）
    const timer = setTimeout(checkKeyStatus, 1000);
    return () => clearTimeout(timer);
  }, [checkKeyStatus]);

  const handleSelectKey = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log("Attempting to open key selection...");
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // 成功を信じて進む
        setHasKey(true);
        setError(null);
      } else {
        alert("設定画面を読み込めませんでした。お手数ですがページを再読み込み(リロード)してください。");
      }
    } catch (e) {
      console.error("Key selection UI failed", e);
      alert("エラーが発生しました。時間を置いて再度お試しください。");
    }
  };

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
    const v1Ok = !!(photos['v1-before']?.url && photos['v1-after']?.url);
    if (selectedViews.length === 1) return v1Ok;
    const v2Ok = !!(photos['v2-before']?.url && photos['v2-after']?.url);
    return v1Ok && v2Ok;
  };

  const startAnalysis = async () => {
    setStep('analyze');
    setIsAnalyzing(true);
    setError(null);
    try {
      const v1 = { type: selectedViews[0], before: photos['v1-before'].url, after: photos['v1-after'].url };
      const v2 = selectedViews.length > 1 ? { type: selectedViews[1], before: photos['v2-before'].url, after: photos['v2-after'].url } : undefined;
      const res = await analyzePosture(v1, v2);
      setResults(res);
    } catch (e: any) {
      console.error(e);
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
        setError({
          title: '利用制限に達しました',
          message: '無料枠（20回）を超えたか、APIキーの設定が必要です。',
          isQuota: true
        });
      } else if (msg.includes('not found') || msg.includes('invalid') || msg.includes('api_key')) {
        setHasKey(false);
        setError({
          title: 'キーの設定が必要です',
          message: 'APIキーが正しく読み込めませんでした。右上の設定からキーを選択してください。'
        });
      } else {
        setError({
          title: '解析エラー',
          message: '通信エラーが発生しました。時間を置いて再度お試しください。'
        });
      }
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col p-4 md:p-8">
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="font-black text-slate-900 tracking-tight text-xl italic uppercase">PostureRefine Pro</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={(e) => handleSelectKey(e)} 
            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm flex items-center gap-2 group cursor-pointer"
          >
            <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">スタッフ設定</span>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col max-w-6xl mx-auto w-full">
        {!hasKey ? (
          <div className="my-auto max-w-lg mx-auto w-full bg-white p-12 rounded-[3rem] shadow-2xl border border-blue-50 text-center space-y-8 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto">
              <Key className="w-10 h-10" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-slate-900">APIキーの設定</h2>
              <p className="text-slate-500 font-bold leading-relaxed">
                分析を開始するには、ご自身のGoogleアカウントでAPIキーを選択する必要があります。
              </p>
            </div>
            <button onClick={(e) => handleSelectKey(e)} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-blue-700 transition-all active:scale-95">
              キーを選択して開始
            </button>
          </div>
        ) : step === 'type-select' && (
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
            <button onClick={() => setStep('type-select')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase"><ChevronLeft className="w-4 h-4" /> 戻る</button>
            <div className={`grid grid-cols-1 ${selectedViews.length > 1 ? 'md:grid-cols-2' : ''} gap-12`}>
              {selectedViews.map((view, i) => (
                <div key={view} className="space-y-6">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-center">{viewLabels[view]}分析</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <PhotoUploader label="Before" imageUrl={photos[`v${i+1}-before`].url} onUpload={(f) => handleUpload(`v${i+1}-before`, f)} />
                    <PhotoUploader label="After" imageUrl={photos[`v${i+1}-after`].url} onUpload={(f) => handleUpload(`v${i+1}-after`, f)} />
                  </div>
                </div>
              ))}
            </div>
            <button disabled={!canProceedToAlign()} onClick={() => setStep('align')} className="mx-auto block px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-10 active:scale-95 transition-transform">
              位置合わせの調整
            </button>
          </div>
        )}

        {step === 'align' && (
          <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
             <button onClick={() => setStep('upload')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase mb-4"><ChevronLeft className="w-4 h-4" /> 戻る</button>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
               {selectedViews.flatMap((view, i) => [
                 <div key={`align-v${i+1}-before`} className="space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewLabels[view]} : Before</p>
                    </div>
                    <ImageAdjustment photo={photos[`v${i+1}-before`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v${i+1}-before`]: p}))} viewType={view} />
                 </div>,
                 <div key={`align-v${i+1}-after`} className="space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{viewLabels[view]} : After</p>
                    </div>
                    <ImageAdjustment photo={photos[`v${i+1}-after`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v${i+1}-after`]: p}))} viewType={view} referencePhoto={photos[`v${i+1}-before`]} />
                 </div>
               ])}
             </div>
             <button onClick={startAnalysis} className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg px-12 py-6 bg-blue-600 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-blue-700 transition-all z-50 active:scale-95">
               <Sparkles className="w-6 h-6" /> AI 高精密解析を開始
             </button>
          </div>
        )}

        {step === 'analyze' && (
          isAnalyzing ? (
            <div className="my-auto flex flex-col items-center justify-center space-y-8">
              <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <h2 className="text-2xl font-black text-slate-900">AI 姿勢診断中...</h2>
              <p className="text-slate-400 font-bold animate-pulse text-center">理学療法の専門知見に基づいて分析しています</p>
            </div>
          ) : error ? (
            <div className="my-auto max-w-lg mx-auto w-full bg-white p-12 rounded-[3rem] shadow-2xl border border-red-50 text-center space-y-8">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900">{error.title}</h2>
                <p className="text-slate-500 font-bold leading-relaxed">{error.message}</p>
              </div>
              <div className="flex flex-col gap-3">
                {error.isQuota && (
                  <button onClick={(e) => handleSelectKey(e)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2">
                    <Key className="w-5 h-5" /> 別のキーを選択する
                  </button>
                )}
                <button onClick={() => setStep('align')} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black">
                  戻ってやり直す
                </button>
              </div>
            </div>
          ) : results && <AnalysisView results={results} photos={photos} onReset={() => setStep('type-select')} />
        )}
      </main>
    </div>
  );
};

export default App;
