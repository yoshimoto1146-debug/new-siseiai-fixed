
import React, { useState, useEffect } from 'react';
import { PhotoUploader } from './components/PhotoUploader';
import { ImageAdjustment } from './components/ImageAdjustment';
import { AnalysisView } from './components/AnalysisView';
import { ViewType, PhotoData, AnalysisResults } from './types';
import { analyzePosture, fileToBase64, resizeImage } from './services/gemini';
import { ChevronLeft, Sparkles, Activity, User, ArrowRight, AlertCircle, RefreshCcw, Key } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'type-select' | 'upload' | 'align' | 'analyze'>('type-select');
  const [selectedView, setSelectedView] = useState<ViewType>('back');
  const [error, setError] = useState<{title: string, message: string, detail?: string, type?: 'key' | 'quota' | 'network'} | null>(null);
  
  const [photos, setPhotos] = useState<Record<string, PhotoData>>({
    'v1-before': { id: 'v1-before', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
    'v1-after': { id: 'v1-after', url: '', scale: 1, offset: { x: 0, y: 0 }, isFlipped: false },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const viewLabels: Record<ViewType, string> = {
    front: '前面', back: '後面', side: '側面', extension: '伸展', flexion: '屈曲'
  };

  // 起動時にAI Studio環境を確認
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            console.log("API Key not found, prompting user...");
          }
        } catch (e) {
          console.error("AI Studio integration error", e);
        }
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        setError(null);
        // キー選択後は成功したとみなして続行
      } catch (e) {
        console.error("Key selection failed", e);
      }
    } else {
      // AI Studio環境以外（ローカルや通常のWeb公開）の場合
      setError({
        title: 'APIキーが設定されていません',
        message: 'この環境では、.envファイルまたはデプロイ設定の「API_KEY」にGemini APIキーを設定してください。',
        type: 'key'
      });
    }
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

  const canProceedToAlign = () => {
    return !!photos['v1-before'].url && !!photos['v1-after'].url;
  };

  const startAnalysis = async (retryCount = 0) => {
    setStep('analyze');
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const v1 = { type: selectedView, before: photos['v1-before'].url, after: photos['v1-after'].url };
      const res = await analyzePosture(v1);
      setResults(res);
      setIsAnalyzing(false);
    } catch (e: any) {
      console.error("Analysis Error Details:", e);
      const msg = e.message || '';

      // ガイドライン対応: 「Requested entity was not found」の場合はキー再選択
      if (msg.includes('Requested entity was not found') || msg.includes('404')) {
        setIsAnalyzing(false);
        handleOpenKeySelector();
        return;
      }

      if (msg === 'MISSING_API_KEY' || msg === 'INVALID_API_KEY') {
        setError({
          title: 'APIキーが必要です',
          message: '解析を行うには、有効なGemini APIキーを設定または選択してください。',
          type: 'key'
        });
      } else if (msg === 'QUOTA_EXCEEDED') {
        setError({
          title: '利用制限（無料枠）を超えました',
          message: 'APIの無料枠の上限に達しました。しばらく待ってから再度お試しください。',
          type: 'quota'
        });
      } else {
        if (retryCount < 1) { // ネットワーク一時エラーを考慮して1回だけ自動リトライ
          setTimeout(() => startAnalysis(retryCount + 1), 2000);
          return;
        }
        setError({
          title: '通信エラーが発生しました',
          message: 'APIへの接続に失敗しました。APIキーが正しいか、インターネット接続を確認してください。',
          detail: msg,
          type: 'network'
        });
      }
      setIsAnalyzing(false);
    }
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
        <button 
          onClick={handleOpenKeySelector}
          className="p-3 text-slate-400 hover:text-blue-600 transition-colors"
          title="APIキー設定"
        >
          <Key className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-grow flex flex-col max-w-6xl mx-auto w-full">
        {step === 'type-select' && (
          <div className="my-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-black text-slate-900">分析する視点を選択</h2>
              <p className="text-slate-400 font-bold">比較したいポーズを1つ選んでください</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(Object.keys(viewLabels) as ViewType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => setSelectedView(type)} 
                  className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${selectedView === type ? 'border-blue-600 bg-blue-50 text-blue-600 ring-4 ring-blue-50' : 'border-slate-100 bg-white text-slate-400'}`}
                >
                  <User className="w-8 h-8" />
                  <span className="font-black text-sm uppercase">{viewLabels[type]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('upload')} className="mx-auto flex items-center gap-3 px-14 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl hover:bg-blue-600 transition-all">
              画像アップロードへ <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            <button onClick={() => setStep('type-select')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase"><ChevronLeft className="w-4 h-4" /> 戻る</button>
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-center">{viewLabels[selectedView]}分析</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <PhotoUploader label="Before" imageUrl={photos[`v1-before`].url} onUpload={(f) => handleUpload(`v1-before`, f)} />
                <PhotoUploader label="After" imageUrl={photos[`v1-after`].url} onUpload={(f) => handleUpload(`v1-after`, f)} />
              </div>
            </div>
            <button 
              disabled={!canProceedToAlign()} 
              onClick={() => setStep('align')} 
              className="mx-auto block px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              位置合わせの調整
            </button>
          </div>
        )}

        {step === 'align' && (
          <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
             <button onClick={() => setStep('upload')} className="text-slate-400 font-black text-xs flex items-center gap-2 tracking-widest uppercase mb-4"><ChevronLeft className="w-4 h-4" /> 戻る</button>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
               <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewLabels[selectedView]} : Before</p>
                  </div>
                  <ImageAdjustment photo={photos[`v1-before`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v1-before`]: p}))} viewType={selectedView} />
               </div>
               <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{viewLabels[selectedView]} : After</p>
                  </div>
                  <ImageAdjustment photo={photos[`v1-after`]} onUpdate={(p) => setPhotos(prev => ({...prev, [`v1-after`]: p}))} viewType={selectedView} referencePhoto={photos[`v1-before`]} />
               </div>
             </div>
             <button onClick={() => startAnalysis(0)} className="mx-auto mt-8 w-full max-w-lg px-12 py-6 bg-blue-600 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-blue-700 transition-all z-50 active:scale-95">
               <Sparkles className="w-6 h-6" /> AI 高精密解析を開始
             </button>
          </div>
        )}

        {step === 'analyze' && (
          isAnalyzing ? (
            <div className="my-auto flex flex-col items-center justify-center space-y-8">
              <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <h2 className="text-2xl font-black text-slate-900">AI 姿勢診断中...</h2>
              <p className="text-slate-400 font-bold animate-pulse">数秒〜数十秒かかる場合があります</p>
            </div>
          ) : error ? (
            <div className="my-auto max-w-lg mx-auto w-full bg-white p-12 rounded-[3rem] shadow-2xl border border-red-50 text-center space-y-8 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900">{error.title}</h2>
                <p className="text-slate-500 font-bold leading-relaxed">{error.message}</p>
                {error.detail && <p className="text-[10px] text-slate-300 font-mono mt-2 overflow-hidden text-ellipsis italic">Error: {error.detail}</p>}
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleOpenKeySelector} 
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <Key className="w-5 h-5" /> APIキーを設定/選択する
                </button>
                
                <button 
                  onClick={() => startAnalysis(0)} 
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <RefreshCcw className="w-5 h-5" /> 再試行する
                </button>
                
                <button onClick={() => setStep('align')} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black">
                  戻って調整し直す
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
