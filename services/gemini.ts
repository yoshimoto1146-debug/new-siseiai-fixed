import { GoogleGenAI, Type } from "@google/genai";
import { ViewType, AnalysisResults } from "../types";

// 画像のクオリティを向上（512px -> 1024px, quality 0.6 -> 0.85）
export const resizeImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
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
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      // 画質を 0.85 に向上
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error("Attempt failed:", error);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  // 環境変数のチェックを強化
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error('API_KEY_NOT_SET');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。2枚の写真を比較し、姿勢改善を分析してください。
座標は画像全体を1000x1000とした相対値で出力してください。
必ずJSON形式で正確に回答してください。言語は日本語でお願いします。`;

  const pointSchema = {
    type: Type.OBJECT,
    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
    required: ['x', 'y']
  };

  const landmarkSchema = {
    type: Type.OBJECT,
    properties: {
      head: pointSchema, ear: pointSchema, shoulder: pointSchema,
      spinePath: { type: Type.ARRAY, items: pointSchema },
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

  const responseSchema = {
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
  };

  return withRetry(async () => {
    // モデルを gemini-3-flash-preview に変更（Proを避けるため）
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `分析視点: ${viewA.type}。1枚目がBefore（改善前）、2枚目がAfter（改善後）です。詳細に分析してJSONで出力してください。` },
          { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
          { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema as any
      }
    });

    const text = response.text;
    if (!text) throw new Error('EMPTY_RESPONSE');
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error:", text);
      throw new Error('INVALID_JSON_RESPONSE');
    }
  });
};
