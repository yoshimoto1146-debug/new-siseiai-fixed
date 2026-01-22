
import { GoogleGenAI, Type } from "@google/genai";
import { ViewType, AnalysisResults } from "../types";

export const resizeImage = (base64Str: string, maxWidth = 768, maxHeight = 768): Promise<string> => {
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
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.6)); // 圧縮率を高めてデータ量を削減
    };
  });
};

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string },
  viewB?: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。
Before画像とAfter画像を比較し、姿勢改善を数値化してください。

評価の鉄則：
1. 総合スコアと各詳細項目（ストレートネック等）のすべてで、Before点数とAfter点数を算出すること。
2. 改善が見られる場合は After > Before の数値にすること。
3. 日本語で論理的かつ具体的なアドバイスを添えること。
4. landmarksの座標は 0-1000 の範囲で正確に出力すること。`;

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

  const parts = [
    { text: `視点1: ${viewA.type}${viewB ? `, 視点2: ${viewB.type}` : ''}を分析しJSONで返してください。` },
    { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
    { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
  ];

  if (viewB) {
    parts.push({ inlineData: { data: viewB.before.split(',')[1], mimeType: 'image/jpeg' } });
    parts.push({ inlineData: { data: viewB.after.split(',')[1], mimeType: 'image/jpeg' } });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts }],
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
          viewB: { 
            type: Type.OBJECT, 
            properties: { beforeLandmarks: landmarkSchema, afterLandmarks: landmarkSchema },
            nullable: true
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

  return JSON.parse(response.text);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};
