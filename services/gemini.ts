
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
      resolve(canvas.toDataURL('image/jpeg', 0.4));
    };
  });
};

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error('MISSING_API_KEY');
  }

  // APIコール直前にインスタンス化
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。
ユーザーがアップロードした2枚の写真（Before/After）を比較分析してください。
特に「背骨のライン（spinePath）」を最重要視します。

【分析のガイドライン】
1. spinePath: 頸椎下部から仙骨まで、背骨の隆起に沿って正確に7点を抽出してください。
2. landmark: 0-1000の範囲で座標を指定。
3. 比較: BeforeとAfterで同じ基準点を用い、改善が見られる箇所を具体的に言語化してください。
4. 数値化: 各項目のbeforeScore/afterScoreは、理想的な姿勢を100点として算出してください。`;

  const pointSchema = {
    type: Type.OBJECT,
    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
    required: ['x', 'y']
  };

  const landmarkSchema = {
    type: Type.OBJECT,
    properties: {
      head: pointSchema, ear: pointSchema, shoulder: pointSchema,
      spinePath: { type: Type.ARRAY, items: pointSchema, description: "背骨の曲線を表す7つの点" },
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
    { text: `分析視点: ${viewA.type}。背中のラインの変化に注目して詳細にスコアリングしてください。` },
    { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
    { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    if (!response.text) throw new Error('EMPTY_RESPONSE');
    return JSON.parse(response.text.trim());
  } catch (error: any) {
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};
