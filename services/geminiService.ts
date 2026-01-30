
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { VideoIdea, Scene, ScriptResponse, ScriptSection, ScriptType } from "../types";

const TEXT_MODEL_FLASH = "gemini-3-flash-preview";
const TEXT_MODEL_PRO = "gemini-3-pro-preview"; // 롱폼 대본 및 복잡한 작업을 위해 Pro 모델 사용
const IMAGE_MODEL = "gemini-2.5-flash-image";
const SPEECH_MODEL = "gemini-2.5-flash-preview-tts";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API 키 가져오기 헬퍼 함수
const getApiKey = (): string => {
  const localKey = localStorage.getItem("gemini_api_key");
  const envKey = process.env.API_KEY;
  const key = localKey || envKey;
  
  if (!key) {
    throw new Error("API 키가 설정되지 않았습니다. 화면 우측 상단의 열쇠 아이콘을 눌러 키를 등록해주세요.");
  }
  return key;
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || JSON.stringify(error);
      
      if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        if (errorMsg.includes("limit: 0") || errorMsg.includes("per_day") || errorMsg.includes("Quota exceeded")) {
          const customError = new Error("API 할당량을 모두 소진했습니다. 자신의 API 키를 사용하거나 잠시 후 다시 시도해주세요.");
          (customError as any).isQuotaError = true;
          throw customError;
        }
        await sleep(Math.pow(2, i) * 1000 + Math.random() * 500);
        continue;
      }
      // API Key 관련 에러 처리
      if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
         const customError = new Error("유효하지 않은 API 키입니다. 다시 설정해주세요.");
         throw customError;
      }
      throw error;
    }
  }
  throw lastError;
}

const pcmToWav = (base64Pcm: string, sampleRate: number = 24000): string => {
  if (!base64Pcm) return "";
  try {
    const cleanBase64 = base64Pcm.replace(/\s/g, '');
    const binaryString = atob(cleanBase64);
    const pcmData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);

    const buffer = new ArrayBuffer(44 + pcmData.length);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); 
    view.setUint16(32, 2, true); 
    view.setUint16(34, 16, true); 
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);

    new Uint8Array(buffer, 44).set(pcmData);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("WAV conversion error:", e);
    return "";
  }
};

export const generateVideoIdeas = async (keyword?: string): Promise<VideoIdea[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // 구글 검색 그라운딩을 사용하여 최근 인기 주제 검색
  const prompt = `2025년 1월 18일부터 1월 25일 사이의 한국 유튜브 및 블로그에서 인기 있었던 철학/심리학 주제를 검색해 주세요. 
다음 카테고리를 중점적으로 확인하십시오:
- [정약용 관련]: 명언, 지혜, 철학, 가르침, 조언
- [인간관계]: 친구 구별(진짜/가짜), 성격 유형(조용한 사람), 배신과 경계, 관계 정리(손절, 거리두기)
- [가족과 자식]: 자식 교육, 부모 마음, 불효, 유산 상속, 고부갈등
- [노년과 나이]: 60-80세의 삶, 죽음과 임종(준비, 철학), 노년의 감정(외로움, 고독, 후회)
- [돈과 재물]: 부와 가난, 베풂, 상속
- [철학 사상]: 노자/장자(도교), 공자/맹자(유교), 불교(붓다, 법정스님), 서양 철학(니체, 쇼펜하우어, 스토아 철학)
- [처세술]: 하지 마라(금지형), 경계하라, 입 다물기, 착하게 살지 않기

검색된 인기 주제와 실제 트렌드를 바탕으로 중장년층(50-70대)의 클릭을 강하게 유도하는 한국어 유튜브 제목 5개를 생성하세요. 
제목은 시선을 사로잡는 강력한 문구여야 합니다.

출력 형식: 반드시 JSON 배열 [{title, premise}]만 출력.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: TEXT_MODEL_PRO,
      contents: prompt + (keyword ? `\n\n추가 키워드: ${keyword}` : ""),
      config: {
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              premise: { type: Type.STRING }
            },
            required: ["title", "premise"]
          }
        }
      }
    }));
    
    const text = response.text;
    if (!text) return [];
    
    // 소스 URL 추출 (그라운딩 메타데이터)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web?.title,
        uri: chunk.web?.uri
      }));

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) 
      ? parsed.map((item: any, i: number) => ({ 
          id: `idea-${i}-${Date.now()}`, 
          ...item,
          sources: sources.length > 0 ? sources : undefined
        })) 
      : [];
  } catch (e) {
    console.error("Video Ideas Error:", e);
    throw e;
  }
};

export const generateScript = async (title: string, protagonistName: string, type: ScriptType): Promise<ScriptResponse> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const isShorts = type === 'shorts';
  
  const prompt = `
    [영상 주제]: ‘${title}’
    [채널 이름]: ${protagonistName}
    [영상 유형]: ${isShorts ? '숏폼 (1200자 내외)' : '롱폼 (공백 포함 최소 4500자 이상 필구)'}
    
    [핵심 지침]: 
    ${isShorts ? '쇼츠 형식에 맞춰 핵심만 1200자 내외로 작성하세요.' : `
    - 반드시 공백 포함 4,500자 이상의 초고밀도 대본을 작성하십시오.
    - 각 본론 섹션(1~6)을 아주 상세하게 설명하십시오. 풍부한 예시, 비유, 과학적 근거를 한 문장도 허투루 쓰지 말고 길게 서술하십시오.
    - 독자가 충분히 감동하고 정보를 얻을 수 있도록 문장을 하나하나 정성스럽게 길게 늘려 쓰십시오.`}

    [대본 구조 템플릿]:
    1. 도입부: 공감 유도 및 주제 선언.
    2. 본론 (1~6개 섹션): 과학적 근거(도파민, 메타인지 등), 비유, 실사례 포함하여 아주 길게 서술.
    3. 전환부: 반전 포인트 및 깊은 성찰.
    4. 마무리: 요약 및 위로의 메시지.

    JSON 구조: {title, sections: [{id, title, content}]}
  `;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: TEXT_MODEL_PRO, 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 12000 }, 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["id", "title", "content"]
              }
            }
          },
          required: ["title", "sections"]
        }
      }
    }));
    
    const text = response.text;
    if (!text) throw new Error("API 응답이 비어있습니다.");
    
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    console.error("Generate Script Error:", e);
    throw e;
  }
};

export const extractScenesFromScript = async (script: string, protagonistDesc: string, isShorts: boolean): Promise<Scene[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const prompt = `
    다음은 유튜브 대본입니다. 이 대본의 **모든 텍스트를 단 한 문장도 생략하지 말고** 순차적으로 ${isShorts ? '10~15개' : '40~60개'}의 장면으로 나누어 스토리보드를 구성하십시오.
    
    [중요 규칙]:
    1. 대본의 텍스트를 절대 요약하지 마십시오.
    2. description(내레이션) 필드에는 대본에서 해당하는 문장을 그대로 모두 포함시켜야 합니다.
    3. 모든 장면의 description을 합치면 원래 대본의 내용과 일치해야 합니다.
    
    [이미지 생성 지침]: Colorful high-quality stickman style in formal wear (suits, dress shirts), thick black outlines, expressive faces, vibrant flat colors, clean vector illustration, strictly no text, no labels, no names in image.
    
    JSON 형식: [{id, description, imagePrompt, videoPrompt}]
    대본 내용: ${script}`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: TEXT_MODEL_PRO, 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              description: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
              videoPrompt: { type: Type.STRING }
            },
            required: ["id", "description", "imagePrompt", "videoPrompt"]
          }
        }
      }
    }));
    
    const text = response.text;
    if (!text) return [];
    
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Extract Scenes Error:", e);
    throw e;
  }
};

export const generateImage = async (prompt: string, aspectRatio: string = "16:9", protagonistDesc: string = "", referenceImageBase64?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const primaryStyle = "Colorful high-quality stylized stickman characters, vibrant flat design, thick black comic book outlines, extremely expressive facial expressions (large eyes), decent and formal clothing (vibrant blue, red, or dark gray formal suits, blazers, and dress shirts), professional and serious look for philosophy/psychology topics, modern clean vector illustration, professional YouTube thumbnail art style, solid or subtle gradient background, no text, no words, no letters, no labels, strictly no channel names, no protagonist names on image";
  
  const buildPrompt = (style: string, p: string, desc: string) => `
    [STYLE: ${style}] 
    [SCENE: ${p}] 
    [CHARACTERS: ${desc}] 
    [CLOTHING: Formal suit, blazer, or dress shirt]
    [TECHNICAL: High saturation, bold strokes, clean flat shading, no text inside the image, NO NAMES, NO CHANNEL NAMES, NO LOGOS]
    [BACKGROUND: Vibrant and clean, fits the emotional mood]
  `;

  try {
    const styledPrompt = buildPrompt(primaryStyle, prompt, protagonistDesc);
    const parts: any[] = [];
    if (referenceImageBase64) {
      const data = referenceImageBase64.includes('base64,') ? referenceImageBase64.split(',')[1] : referenceImageBase64;
      parts.push({ inlineData: { mimeType: 'image/png', data } });
    }
    parts.push({ text: styledPrompt });

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({ 
      model: IMAGE_MODEL, 
      contents: { parts }, 
      config: { imageConfig: { aspectRatio: aspectRatio as any } } 
    }));
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Image generation failed");
  } catch (e: any) {
    console.error("Generate Image Exception:", e);
    throw e;
  }
};

export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  if (!text || !text.trim()) return "";
  
  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: SPEECH_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    }));

    const audioPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (audioPart?.inlineData?.data) {
      return pcmToWav(audioPart.inlineData.data);
    }
    throw new Error("Audio generation failed");
  } catch (e: any) {
    console.error("Generate Speech Error:", e);
    throw e;
  }
};
