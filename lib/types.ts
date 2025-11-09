export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface DreamAnalysis {
  id: number; // timestamp for unique ID and sorting
  remoteId?: number; // Supabase row id when persisted online
  transcript: string;
  title: string;
  interpretation: string;
  shareableQuote: string;
  imageUrl: string; // Full-resolution image for detail views
  thumbnailUrl?: string; // Smaller thumbnail for list views (optional for backward compatibility)
  chatHistory: ChatMessage[];
  theme?: string;
  dreamType: string;
  isFavorite?: boolean;
  imageGenerationFailed?: boolean; // True if analysis succeeded but image generation failed
  pendingSync?: boolean;
}

export interface NotificationSettings {
  isEnabled: boolean;
  weekdayTime: string; // "HH:MM"
  weekendTime: string; // "HH:MM"
}

export type ThemePreference = 'light' | 'dark' | 'auto';

export type ThemeMode = 'light' | 'dark';

export type LanguagePreference = 'auto' | 'en' | 'fr' | 'es';

export type DreamMutation =
  | {
      id: string;
      type: 'create';
      createdAt: number;
      dream: DreamAnalysis;
    }
  | {
      id: string;
      type: 'update';
      createdAt: number;
      dream: DreamAnalysis;
    }
  | {
      id: string;
      type: 'delete';
      createdAt: number;
      dreamId: number;
      remoteId?: number;
    };
