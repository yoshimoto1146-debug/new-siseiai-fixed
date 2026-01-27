
import { GoogleGenAI, Type } from "@google/genai";
import { ViewType, AnalysisResults } from "../types";

export const resizeImage = (base64Str: string, maxWidth = 512, maxHeight = 512): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, width, height);
      }
      // 圧縮率を0.4に下げて通信量を最小化
      resolve(canvas.toDataURL('image/jpeg', 0.4));
    };
  });
};

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey.length < 5) {
    throw new Error('API_KEY_MISSING: APIキーが設定されていません。環境変数を確認してください。');
  }

  // Use new GoogleGenAI right before the call to ensure up-to-date API key usage
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。
BeforeとAfterの画像を比較し、姿勢改善を詳細に数値化してください。
landmarksは 0-1000 の範囲で指定。
spinePathは背中のラインに沿って「正確に5点だけ」抽出してください。
全ての詳細項目で beforeScore と afterScore を必ず個別に算出すること。`;

  const pointSchema = {
    type: Type.OBJECT,
    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
    required: ['x', 'y']
  };

  const landmarkSchema = {
    type: Type.OBJECT,
    properties: {
      head: pointSchema, ear: pointSchema, shoulder: pointSchema,
      spinePath: { type: Type.ARRAY, items: pointSchema, description: "Exactly 5 points" },
      hip: pointSchema, knee: pointSchema, ankle: pointSchema, heel: pointSchema
    },
    required: ['head', 'ear', 'shoulder', 'spinePath', 'hip', 'knee', 'ankle', 'heel']
  };

  const scoreItemSchema = {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING },
      beforeScore: { type: Type.NUMBER },
      afterScore: { type: Type.NUMBER },
      description: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['improved', 'same', 'needs-attention'] }
    },
    required: ['label', 'beforeScore', 'afterScore', 'description', 'status']
  };

  const parts = [
    { text: `分析視点: ${viewA.type}` },
    { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
    { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
  ];

  // Updated model to gemini-3-flash-preview for multi-modal analysis tasks
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          viewA: { 
            type: Type.OBJECT, 
            properties: { beforeLandmarks: landmarkSchema, afterLandmarks: landmarkSchema }, 
            required: ['beforeLandmarks', 'afterLandmarks'] 
          },
          overallBeforeScore: { type: Type.NUMBER },
          overallAfterScore: { type: Type.NUMBER },
          detailedScores: {
            type: Type.OBJECT,
            properties: {
              straightNeck: scoreItemSchema,
              rolledShoulder: scoreItemSchema,
              kyphosis: scoreItemSchema,
              swayback: scoreItemSchema,
              oLegs: scoreItemSchema
            },
            required: ['straightNeck', 'rolledShoulder', 'kyphosis', 'swayback', 'oLegs']
          },
          summary: { type: Type.STRING }
        },
        required: ['viewA', 'overallBeforeScore', 'overallAfterScore', 'detailedScores', 'summary']
      }
    }
  });

  if (!response.text) {
    throw new Error('MODEL_EMPTY_RESPONSE: モデルから空の応答が返されました。');
  }

  return JSON.parse(response.text);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};
