import type { RitualId } from './inspirationRituals';

export type DreamChatCategory = 'symbols' | 'emotions' | 'growth' | 'general';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt?: number;
  meta?: {
    category?: DreamChatCategory;
  };
}

/**
 * Analysis status for tracking async operations and offline queue
 */
export type AnalysisStatus = 'none' | 'pending' | 'done' | 'failed';

/**
 * Canonical dream type categories used in the app.
 * The AI/backend should always return one of these values.
 */
export type DreamType = 'Lucid Dream' | 'Recurring Dream' | 'Nightmare' | 'Symbolic Dream';

/**
 * Canonical dream visual/emotional themes.
 */
export type DreamTheme = 'surreal' | 'mystical' | 'calm' | 'noir';

export interface DreamAnalysis {
  id: number; // timestamp for unique ID and sorting
  remoteId?: number; // Supabase row id when persisted online
  clientRequestId?: string; // Idempotency key for creates to avoid duplicates
  transcript: string;
  title: string;
  interpretation: string;
  shareableQuote: string;
  imageUrl: string; // Full-resolution image for detail views
  thumbnailUrl?: string; // Smaller thumbnail for list views (optional for backward compatibility)
  imageUpdatedAt?: number; // Timestamp bump to force image refresh when replaced
  imageSource?: 'user' | 'ai'; // Track if the image comes from user upload or AI generation
  chatHistory: ChatMessage[];
  theme?: DreamTheme;
  dreamType: DreamType;
  isFavorite?: boolean;
  imageGenerationFailed?: boolean; // True if analysis succeeded but image generation failed
  pendingSync?: boolean;

  // Quota-related fields
  isAnalyzed?: boolean; // Whether AI analysis has been performed (separates recording from analysis)
  analyzedAt?: number; // Timestamp when analysis was completed
  analysisStatus?: AnalysisStatus; // Current status of analysis (for offline queue, idempotence)
  analysisRequestId?: string; // UUID for server-side idempotence
  explorationStartedAt?: number; // Timestamp when first chat message was sent (marks dream as "explored")
}

export interface NotificationSettings {
  weekdayEnabled: boolean;
  weekdayTime: string; // "HH:MM"
  weekendEnabled: boolean;
  weekendTime: string; // "HH:MM"
}

export interface RitualStepProgress {
  date: string; // Local date key YYYY-MM-DD
  steps: Partial<Record<RitualId, Record<string, boolean>>>;
}

export type ThemePreference = 'light' | 'dark' | 'auto';

export type ThemeMode = 'light' | 'dark';

export type AppLanguage = 'en' | 'fr' | 'es';

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

/**
 * Quota usage information
 */
export interface QuotaUsage {
  analysis: {
    used: number;
    limit: number | null; // null = unlimited
    remaining: number | null; // null = unlimited
  };
  exploration: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  messages: {
    used: number; // For a specific dream
    limit: number | null;
    remaining: number | null;
  };
}

export type SubscriptionTier = 'guest' | 'free' | 'plus' | 'premium';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiryDate?: string | null;
  productId?: string | null;
  willRenew?: boolean;
}

export type PurchaseInterval = 'monthly' | 'annual';

export interface PurchasePackage {
  id: string;
  interval: PurchaseInterval;
  price: number; // Numeric price for calculations (e.g. discount)
  priceFormatted: string;
  currency: string;
  title?: string;
  description?: string;
}

/**
 * Complete quota status for a user
 */
export interface QuotaStatus {
  tier: SubscriptionTier;
  usage: QuotaUsage;
  canAnalyze: boolean;
  canExplore: boolean;
  reasons?: string[]; // Reasons why an action is blocked
  isUpgraded?: boolean; // Whether this device fingerprint has already created an account
}

/**
 * Offline action queue item types
 */
export type OfflineAction =
  | {
      id: string;
      type: 'ANALYZE';
      dreamId: number;
      requestId: string;
      transcript: string;
      timestamp: number;
      retries?: number;
    }
  | {
      id: string;
      type: 'CHAT_MESSAGE';
      dreamId: number;
      message: string;
      timestamp: number;
      retries?: number;
    };
