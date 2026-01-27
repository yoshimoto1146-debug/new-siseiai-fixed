
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

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const key = process.env.API_KEY;
  if (!key) throw new Error('MISSING_API_KEY');

  const ai = new GoogleGenAI({ apiKey: key });
  
  const systemInstruction = `あなたは理学療法士です。2枚の写真を比較し、背骨（spinePath）の7点を抽出して姿勢改善を分析してください。
beforeScoreとafterScoreは100点満点で算出してください。`;

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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: `視点: ${viewA.type}。比較分析を開始します。` },
        { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
        { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
      ],
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
    console.error("API Error:", error);
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
