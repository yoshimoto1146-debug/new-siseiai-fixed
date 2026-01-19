import { GoogleGenAI, Type } from "@google/genai";
import { ViewType, AnalysisResults } from "../types";

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
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
};

export const analyzePosture = async (
  viewA: { type: ViewType; before: string; after: string },
  viewB?: { type: ViewType; before: string; after: string }
): Promise<AnalysisResults> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `あなたは世界最高峰の理学療法士です。
提供されたBefore/After画像を分析し、姿勢の変化を詳細に評価してください。
各評価項目（detailedScores）において、Before画像時点でのスコア（beforeScore）と、After画像時点でのスコア（afterScore）を算出して比較してください。
重要: 各項目（detailedScores）の "description" フィールドには、その部位の姿勢を改善するための「具体的で短い理学療法的な一言アドバイス（例：胸を張りましょう、顎を引く意識を）」を必ず日本語で含めてください。

写真が1セットのみの場合は、viewBをnullとして返し、視点1のみで分析を完結させてください。
座標系は 0-1000 です。関節が見えない場合でも推測して値を埋めてください。
必ず有効なJSONのみを返してください。`;

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
    { text: `分析依頼: 視点1は「${viewA.type}」です。${viewB ? `視点2は「${viewB.type}」です。` : '視点2はありません。'}` },
    { inlineData: { data: viewA.before.split(',')[1], mimeType: 'image/jpeg' } },
    { inlineData: { data: viewA.after.split(',')[1], mimeType: 'image/jpeg' } }
  ];

  if (viewB) {
    parts.push({ inlineData: { data: viewB.before.split(',')[1], mimeType: 'image/jpeg' } });
    parts.push({ inlineData: { data: viewB.after.split(',')[1], mimeType: 'image/jpeg' } });
  }

  try {
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

    const text = response.text;
    if (!text) throw new Error('AIから応答がありませんでした。');
    return JSON.parse(text);
  } catch (e: any) {
    console.error("Analysis Error:", e);
    throw new Error(`分析に失敗しました: ${e.message}`);
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};
