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
      resolve(canvas.toDataURL('image/jpeg', 0.6));
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

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error('API_KEY_NOT_SET');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。2枚の写真を比較し、姿勢改善を分析してください。
特に背骨（spinePath）のラインに沿った7点を抽出し、数値化してください。座標は画像全体を1000x1000とした相対値で指定してください。
各項目のbeforeScore/afterScoreは100点満点で算出してください。
必ずJSON形式で正確に回答してください。`;

  const pointSchema = {
    type: Type.OBJECT,
    properties: { 
      x: { type: Type.NUMBER, description: "0-1000の範囲のX座標" }, 
      y: { type: Type.NUMBER, description: "0-1000の範囲のY座標" } 
    },
    required: ['x', 'y']
  };

  const landmarkSchema = {
    type: Type.OBJECT,
    properties: {
      head: pointSchema, 
      ear: pointSchema, 
      shoulder: pointSchema,
      spinePath: { type: Type.ARRAY, items: pointSchema, description: "背骨に沿った7つの点" },
      hip: pointSchema, 
      knee: pointSchema, 
      ankle: pointSchema, 
      heel: pointSchema
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `分析視点: ${viewA.type}。1枚目がBefore、2枚目がAfterです。精密に比較してください。` },
          { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
          { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            viewA: { 
              type: Type.OBJECT, 
              properties: { 
                beforeLandmarks: landmarkSchema, 
                afterLandmarks: landmarkSchema 
              }, 
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
        },
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) throw new Error('EMPTY_RESPONSE');
    
    // JSONのパース
    const cleanJson = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    throw error;
  }
};
