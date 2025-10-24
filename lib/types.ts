export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface DreamAnalysis {
  id: number; // timestamp for unique ID and sorting
  transcript: string;
  title: string;
  interpretation: string;
  shareableQuote: string;
  imageUrl: string;
  chatHistory: ChatMessage[];
  theme?: string;
  dreamType: string;
  isFavorite?: boolean;
}

export interface NotificationSettings {
  isEnabled: boolean;
  weekdayTime: string; // "HH:MM"
  weekendTime: string; // "HH:MM"
}

