
import { GoogleGenAI, Type } from "@google/genai";
import { ViewType, AnalysisResults } from "../types";

export const resizeImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // 品質を少し下げて軽量化
    };
  });
};

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string },
  viewB?: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。
提供されたBefore画像とAfter画像を比較し、姿勢の改善度を100点満点で厳格に評価してください。

重要ルール:
1. BeforeとAfterの差を明確に数値化すること。
2. 改善している場合は afterScore > beforeScore とすること。
3. 各評価項目（detailedScores）についても、必ずbeforeScoreとafterScoreを算出し、具体的な変化を数値で示すこと。
4. 日本語で、論理的かつ前向きなフィードバックを返すこと。

座標系は 0-1000 です。関節が見えない場合でも推測して値を埋めてください。`;

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
    { text: `分析対象視点1: ${viewA.type}${viewB ? `, 視点2: ${viewB.type}` : ''}` },
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
