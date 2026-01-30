
export interface VideoIdea {
  id: string;
  title: string;
  premise: string;
  sources?: { title?: string; uri?: string }[];
}

export type ScriptType = 'shorts' | 'longform';

export interface ScriptSection {
  id: number;
  title: string;
  content: string;
}

export interface ScriptResponse {
  title: string;
  sections: ScriptSection[];
}

export interface ScriptRequest {
  title: string;
  protagonistName: string;
  scriptType: ScriptType;
}

export interface GeminiError {
  message: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface Scene {
  id: number;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
  imageUrl?: string;
  audioUrl?: string;
  isLoading?: boolean;
  isAudioLoading?: boolean;
}

export interface Protagonist {
  description: string;
  imageUrl?: string;
}
