import { Composer } from '@/components/chat/Composer';
import { Exploration360Panel } from '@/components/chat/Exploration360Panel';
import { LoadingIndicator, MessagesList } from '@/components/chat/MessagesList';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ChatProvider, useKeyboardStateContext } from '@/context/ChatContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { computeNextInputAfterSend } from '@/lib/chat/composerUtils';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { getDreamAnalysisState } from '@/lib/dreamUsage';
import { generateUUID } from '@/lib/dreamUtils';
import { isChatDebugEnabled, isMockModeEnabled } from '@/lib/env';
import { getUserErrorMessage, QuotaError, QuotaErrorCode } from '@/lib/errors';
import { canUseExploration360Synthesis, getExploration360SynthesisStatus } from '@/lib/exploration360';
import { HttpError } from '@/lib/http';
import { getImageConfig } from '@/lib/imageUtils';
import { getTranscriptionLocale } from '@/lib/locale';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { TID } from '@/lib/testIDs';
import { ChatMessage, DreamAnalysis, type DreamChatCategory, type ThemeMode } from '@/lib/types';
import { startOrContinueChat } from '@/services/geminiService';
import { incrementLocalExplorationCount } from '@/services/quota/GuestAnalysisCounter';
import { markMockExploration } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import { createDreamInSupabase } from '@/services/supabaseDreamService';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DecoLines } from '@/constants/journalTheme';
import { MotiView } from '@/lib/moti';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNetworkState } from 'expo-network';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type CategoryType = DreamChatCategory;
type SendMessageOptions = {
  baseMessages?: ChatMessage[];
  category?: Exclude<CategoryType, 'general'>;
  clientRequestId?: string;
  meta?: ChatMessage['meta'];
};

const LEGACY_DRAFT_PREFIXES = ['Here is my dream:'];

const STREAMING_MESSAGE_ID = 'streaming-reply';

const getCategoryQuestion = (category: CategoryType, t: (key: string) => string): string => {
  const categoryQuestions: Record<CategoryType, string> = {
    symbols: t('dream_chat.prompt.symbols'),
    emotions: t('dream_chat.prompt.emotions'),
    growth: t('dream_chat.prompt.growth'),
    general: '',
  };
  return categoryQuestions[category];
};

const QUICK_CATEGORIES = [
  { id: 'symbols', labelKey: 'dream_chat.quick.symbols', icon: 'sparkles' as const },
  { id: 'emotions', labelKey: 'dream_chat.quick.emotions', icon: 'heart.fill' as const },
  { id: 'growth', labelKey: 'dream_chat.quick.growth', icon: 'leaf.fill' as const },
];

const QUOTA_CHECK_TIMEOUT_MS = 12000; // Fail gracefully if quota check hangs

const createChatMessage = (
  role: 'user' | 'model',
  text: string,
  options?: {
    id?: string;
    category?: Exclude<CategoryType, 'general'>;
    meta?: ChatMessage['meta'];
    parts?: ChatMessage['parts'];
  }
): ChatMessage => {
  const meta = resolveChatMessageMeta(options);
  return {
    id: options?.id ?? generateUUID(),
    role,
    text,
    ...(options?.parts ? { parts: options.parts } : {}),
    createdAt: Date.now(),
    ...(meta ? { meta } : {}),
  };
};

const resolveChatMessageMeta = (options?: {
  category?: Exclude<CategoryType, 'general'>;
  meta?: ChatMessage['meta'];
}): ChatMessage['meta'] | undefined => {
  const meta = {
    ...(options?.meta ?? {}),
    ...(options?.category ? { category: options.category } : {}),
  };
  return Object.keys(meta).length > 0 ? meta : undefined;
};

const isExploration360SynthesisUpgradeError = (error: unknown): boolean => {
  if (!(error instanceof HttpError)) return false;
  const body = error.body as { code?: unknown; error?: unknown } | undefined;
  return (
    error.status === 402 &&
    (body?.code === 'EXPLORATION_360_SYNTHESIS_PLUS_REQUIRED' ||
      body?.error === 'EXPLORATION_360_SYNTHESIS_PLUS_REQUIRED')
  );
};

// Track chat history migrations across screen mounts to prevent duplicate writes when
// users rapidly open the same chat multiple times.
const CHAT_HISTORY_MIGRATION_VERSION = 1;
const chatHistoryMigrationInFlightByDreamId = new Map<number, Promise<void>>();
const chatHistoryMigrationCompletedByDreamId = new Map<number, number>();

export default function DreamChatScreen() {
  const { t } = useTranslation();
  const { id, category, mode: routeMode } = useLocalSearchParams<{ id: string; category?: string; mode?: string }>();
  const { dreams, updateDream, applyServerDreamState } = useDreams();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { user } = useAuth();
  const { language } = useLanguage();
  const isMockMode = isMockModeEnabled();
  const debugChat = __DEV__ && isChatDebugEnabled();
  const dreamId = useMemo(() => Number(id), [id]);
  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
  const exploration360Status = useMemo(() => getExploration360SynthesisStatus(dream), [dream]);
  const { quotaStatus, canExplore, canChat, tier } = useQuota({ dreamId, dream });
  const networkState = useNetworkState();
  const hasNetwork = useMemo(() => {
    if (networkState.isInternetReachable != null) {
      return networkState.isInternetReachable;
    }
    if (networkState.isConnected != null) {
      return networkState.isConnected;
    }
    return true;
  }, [networkState.isConnected, networkState.isInternetReachable]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Partial model reply while the response streams in; null when idle.
  const [streamingReply, setStreamingReply] = useState<string | null>(null);

  // While a reply streams in, render it as a virtual trailing model message
  // and drop the "thinking" indicator as soon as the first tokens arrive.
  const displayMessages = useMemo(() => {
    if (!streamingReply) return messages;
    return [
      ...messages,
      {
        id: STREAMING_MESSAGE_ID,
        role: 'model' as const,
        text: streamingReply,
        createdAt: (messages[messages.length - 1]?.createdAt ?? 0) + 1,
      },
    ];
  }, [messages, streamingReply]);
  const showThinkingIndicator = isLoading && !streamingReply;
  const [isScrolling, setIsScrolling] = useState(false);
  const [explorationBlocked, setExplorationBlocked] = useState(false);
  const [quotaCheckComplete, setQuotaCheckComplete] = useState(false);
  const [quotaCheckError, setQuotaCheckError] = useState<string | null>(null);
  const quotaCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const lastCategorySentKeyRef = useRef<string | null>(null);
  const lastSynthesisSentKeyRef = useRef<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (quotaCheckTimeoutRef.current) {
        clearTimeout(quotaCheckTimeoutRef.current);
      }
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!debugChat) return;
    console.debug('[DreamChat] mount', {
      dreamId,
      routeId: id,
      hasUser: Boolean(user),
      ts: Date.now(),
    });
    return () => {
      console.debug('[DreamChat] unmount', { dreamId, ts: Date.now() });
    };
  }, [debugChat, dreamId, id, user]);

  useEffect(() => {
    if (!debugChat) return;
    console.debug('[DreamChat] state', {
      dreamId,
      messageCount: messages.length,
      isLoading,
      ts: Date.now(),
    });
  }, [debugChat, dreamId, isLoading, messages.length]);

  // Speech recognition locale based on language
  const transcriptionLocale = useMemo(() => getTranscriptionLocale(language), [language]);

  // Use full-resolution image config for chat view
  const imageConfig = useMemo(() => getImageConfig('full'), []);

  // Count user messages for quota display
  const userMessageCount = useMemo(() => {
    return messages.filter((msg) => msg.role === 'user').length;
  }, [messages]);

  const quotaMessages = quotaStatus?.usage.messages;
  const rawMessageLimit = quotaMessages?.limit;
  const messageLimit = typeof rawMessageLimit === 'number'
    ? rawMessageLimit
    : rawMessageLimit === null
      ? null
      : 20;

  const quotaRemaining = typeof quotaMessages?.remaining === 'number' ? quotaMessages.remaining : null;
  const localRemaining = messageLimit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(messageLimit - userMessageCount, 0);
  const messagesRemaining = messageLimit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(Math.min(localRemaining, quotaRemaining ?? localRemaining), 0);
  const messageLimitReached = messageLimit !== null && messagesRemaining <= 0;
  const messageCounterLabel = typeof messageLimit === 'number'
    ? t('dream_chat.message_counter', { used: userMessageCount, limit: messageLimit })
    : '';

  const isExistingExploration = useMemo(() => {
    if (!dream) return false;
    return getDreamAnalysisState(dream).isExplored;
  }, [dream]);
  const shouldGateOnQuotaCheck = !isExistingExploration;
  const hasQuotaCheckClearance = shouldGateOnQuotaCheck ? quotaCheckComplete : true;
  const isQuotaGateBlocked = shouldGateOnQuotaCheck && explorationBlocked;

  const showMessageLimitAlert = useCallback(() => {
    Alert.alert(
      t('dream_chat.message_limit.title'),
      t('dream_chat.limit_warning'),
      [
        { text: t('common.ok') },
        {
          text: tier === 'guest'
            ? t('dream_chat.limit_cta_guest')
            : t('dream_chat.limit_cta_free'),
          onPress: () => router.push('/(tabs)/settings'),
        },
      ]
    );
  }, [t, tier]);

  const runQuotaCheck = useCallback(async () => {
    if (!isMountedRef.current) return;

    setQuotaCheckComplete(false);
    setQuotaCheckError(null);

    if (!dream) {
      setQuotaCheckComplete(true);
      return;
    }

    if (quotaCheckTimeoutRef.current) {
      clearTimeout(quotaCheckTimeoutRef.current);
    }

    let didTimeout = false;
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      quotaCheckTimeoutRef.current = setTimeout(() => {
        didTimeout = true;
        reject(new Error('QUOTA_CHECK_TIMEOUT'));
      }, QUOTA_CHECK_TIMEOUT_MS);
    });

    try {
      const canExploreDream = await Promise.race([canExplore(), timeoutPromise]);
      setExplorationBlocked(!canExploreDream);
    } catch (error) {
      if (__DEV__ && !didTimeout) {
        console.error('[DreamChat] Quota check failed:', error);
      }
      setQuotaCheckError(t('dream_chat.quota_check_error'));
    } finally {
      if (quotaCheckTimeoutRef.current) {
        clearTimeout(quotaCheckTimeoutRef.current);
        quotaCheckTimeoutRef.current = null;
      }
      if (isMountedRef.current) {
        setQuotaCheckComplete(true);
      }
    }
  }, [dream, canExplore, t]);

  // Check exploration quota on mount
  useEffect(() => {
    runQuotaCheck();
  }, [runQuotaCheck]);

  // Initialize chat messages from dream history
  useEffect(() => {
    if (!dream) return;

    type LegacyChatMessage = Partial<Omit<ChatMessage, 'id'>> & {
      id?: unknown;
      createdAt?: unknown;
    };

    // Initialize with existing chat history or start new conversation
    if (dream.chatHistory && dream.chatHistory.length > 0) {
      const localizedPrefix = t('dream_chat.draft_prefix');
      let didChange = false;
      const normalized = dream.chatHistory.map((msg, index) => {
        const legacyMsg: LegacyChatMessage = msg;

        const rawId = legacyMsg.id;
        const fallbackId = `legacy-${dream.id}-${index}`;
        const nextId = typeof rawId === 'string' && rawId.length > 0 ? rawId : fallbackId;
        if (nextId !== rawId) {
          didChange = true;
        }

        const rawCreatedAt = legacyMsg.createdAt;
        const createdAt =
          typeof rawCreatedAt === 'number' && Number.isFinite(rawCreatedAt) ? rawCreatedAt : undefined;
        if (createdAt !== rawCreatedAt && rawCreatedAt !== undefined) {
          didChange = true;
        }

        const next: ChatMessage = { ...msg, id: nextId, createdAt };

        if (index !== 0 || next.role !== 'user') return next;

        const text = next.text ?? '';
        for (const legacyPrefix of LEGACY_DRAFT_PREFIXES) {
          if (text.startsWith(legacyPrefix)) {
            const rest = text.slice(legacyPrefix.length).trimStart();
            const updatedText = rest ? `${localizedPrefix} ${rest}` : localizedPrefix;
            if (updatedText !== text) {
              didChange = true;
            }
            return { ...next, text: updatedText };
          }
        }
        return next;
      });

      setMessages(normalized);
      lastCategorySentKeyRef.current = null; // allow new theme prompts when revisiting

      if (
        didChange &&
        chatHistoryMigrationCompletedByDreamId.get(dream.id) !== CHAT_HISTORY_MIGRATION_VERSION &&
        !chatHistoryMigrationInFlightByDreamId.has(dream.id)
      ) {
        const migration = (async () => {
          try {
            await updateDream({ ...dream, chatHistory: normalized } as DreamAnalysis);
            chatHistoryMigrationCompletedByDreamId.set(dream.id, CHAT_HISTORY_MIGRATION_VERSION);
          } catch (error) {
            if (__DEV__) {
              console.warn('[DreamChat] Failed to persist chat history migration', error);
            }
          } finally {
            chatHistoryMigrationInFlightByDreamId.delete(dream.id);
          }
        })();
        chatHistoryMigrationInFlightByDreamId.set(dream.id, migration);
      }
    } else {
      // Start with initial AI greeting
      const initialMessage = createChatMessage('model', t('dream_chat.initial_greeting', { title: dream.title }));
      setMessages([initialMessage]);
      lastCategorySentKeyRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dream?.id, t]);

  // Send category-specific question if category is provided
  useEffect(() => {
    // Wait for quota check to complete before auto-sending
    if (!hasQuotaCheckClearance) {
      return;
    }

    // Don't send if exploration is blocked
    if (isQuotaGateBlocked) {
      return;
    }

    if (!dream || !category || category === 'general') {
      return;
    }

    // Wait until existing history is loaded into state to avoid dropping messages
    const hasStoredHistory = Boolean(dream.chatHistory?.length);
    const messagesReady = messages.length > 0 || !hasStoredHistory;
    if (!messagesReady) {
      return;
    }

    const categoryKey = `${dream.id}:${category}`;
    if (lastCategorySentKeyRef.current === categoryKey) {
      return;
    }

    const question = getCategoryQuestion(category as CategoryType, t);

    if (question) {
      lastCategorySentKeyRef.current = categoryKey;
      const timeoutId = setTimeout(() => {
        const baseMessages = messages.length > 0 ? messages : dream.chatHistory ?? [];
        sendMessage(question, undefined, {
          baseMessages,
          category: category as Exclude<CategoryType, 'general'>,
        });
      }, 500);

      return () => {
        clearTimeout(timeoutId);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dream, messages.length, t, hasQuotaCheckClearance, isQuotaGateBlocked]); // sendMessage has stable dependencies via useCallback

  const sendMessage = useCallback(
    async (
      messageText?: string,
      displayText?: string,
      options?: SendMessageOptions
    ) => {
      const textToSend = messageText || inputText.trim();
      if (!textToSend || !dream) return;
      const resolvedDisplayText = displayText ?? textToSend;
      const messageMeta = resolveChatMessageMeta({
        category: options?.category,
        meta: options?.meta,
      });
      const chatRequestId = options?.clientRequestId ?? generateUUID();

      // Guard against concurrent sends (double taps, quick topics during streaming, etc.)
      if (isLoading || sendInFlightRef.current) {
        return;
      }
      sendInFlightRef.current = true;

      try {
      if (debugChat) {
        const baseMessages = options?.baseMessages ?? messages;
        console.debug('[DreamChat] sendMessage start', {
          dreamId: dream.id,
          baseMessageCount: baseMessages.length,
          textLength: textToSend.length,
          ts: Date.now(),
        });
      }

      if (messageLimit !== null && messagesRemaining <= 0) {
        // Only show alert for new explorations; existing explorations have the banner
        if (!isExistingExploration) {
          showMessageLimitAlert();
        }
        return;
      }

      if (!hasNetwork && !isMockMode) {
        Alert.alert(
          t('common.error_title'),
          t('error.network'),
          [{ text: t('common.ok') }]
        );
        return;
      }

      // Safety: block sending while the initial exploration quota check is still running
      if (shouldGateOnQuotaCheck && !hasQuotaCheckClearance) {
        return;
      }

      // Check exploration quota for first message (new exploration)
      const baseMessages = options?.baseMessages ?? messages;
      const isFirstUserMessage = baseMessages.filter((msg) => msg.role === 'user').length === 0;

      if (isFirstUserMessage && !isExistingExploration) {
        // Block if exploration is already blocked
        if (explorationBlocked) {
          return;
        }
        // Clear cached quota counts before checking to avoid stale cache windows
        quotaService.invalidate(user);
        // Double-check exploration quota before starting new exploration
        try {
          const canExploreDream = await canExplore();
          if (!canExploreDream) {
            setExplorationBlocked(true);
            return;
          }
          // Note: Actual quota enforcement happens server-side via DB trigger
          // when the AI response is added to chat_history. This client-side check
          // provides fast feedback to the user.
        } catch (error) {
          if (error instanceof QuotaError && error.code === QuotaErrorCode.EXPLORATION_LIMIT_REACHED) {
            setExplorationBlocked(true);
            return;
          }
          if (__DEV__) {
            console.error('[DreamChat] Exploration quota check failed:', error);
          }
          Alert.alert(
            t('common.error_title'),
            t('dream_chat.quota_check_error'),
            [{ text: t('common.ok') }]
          );
          return;
        }
      }

      // Check message quota before sending
      const canSendMessage = await canChat();
      if (!canSendMessage) {
        showMessageLimitAlert();
        return;
      }

      // ✅ GUARD: Ensure dream is synced before allowing chat
      // If remoteId is missing, attempt auto-sync or show error
      // Note: Guests have local-only dreams and don't require sync
      if (user && !dream.remoteId && !isMockMode) {
        if (hasNetwork) {
          // Auto-sync the dream with idempotence
          setIsLoading(true);
          setInputText((current) => computeNextInputAfterSend(current, textToSend));
          try {
            const controller = new AbortController();
            requestAbortRef.current = controller;
            // Ensure clientRequestId for idempotence (prevent duplicates)
            const dreamToSync = dream.clientRequestId
              ? dream
              : { ...dream, clientRequestId: `dream-${dream.id}` };

            const synced = await createDreamInSupabase(dreamToSync, user.id);

            // IMPORTANT: synced.id may differ from dream.id (reconstructed from server's created_at)
            // Update with the returned dream which has correct id + remoteId
            await updateDream(synced);

            // Now proceed with chat using synced.remoteId
            const dreamIdString = String(synced.remoteId);
            const aiResponse = await startOrContinueChat(dreamIdString, textToSend, language, undefined, undefined, {
              signal: controller.signal,
              clientRequestId: chatRequestId,
              messageMeta,
              onDelta: setStreamingReply,
            });

            // Add user message
            const userMessage = createChatMessage('user', resolvedDisplayText, {
              id: chatRequestId,
              category: options?.category,
              meta: options?.meta,
            });
            const updatedMessages = [...baseMessages, userMessage];

            const aiMessage = createChatMessage('model', aiResponse.text, {
              id: aiResponse.message?.id,
              parts: aiResponse.message?.parts,
            });
            const finalMessages = [...updatedMessages, aiMessage];

            setMessages(finalMessages);

            // Persist chat history to dream
            const dreamUpdate: Partial<DreamAnalysis> = {
              ...synced,
              chatHistory: finalMessages,
            };

            await applyServerDreamState(dreamUpdate as DreamAnalysis);

            // Invalidate quota cache if this was the first message
            if (isFirstUserMessage) {
              if (isMockMode) {
                await markMockExploration({ id: dreamId });
              }
              if (!user && !isExistingExploration) {
                incrementLocalExplorationCount().catch((err) => {
                  if (__DEV__) console.warn('[DreamChat] Failed to increment exploration count', err);
                });
              }
            }
            quotaService.invalidate(user);
          } catch (error) {
            setIsLoading(false);
            if (messageMeta?.exploration360Synthesis && isExploration360SynthesisUpgradeError(error)) {
              router.push(buildPaywallHref('exploration_limit'));
              return;
            }
            if (__DEV__) {
              console.error('[DreamChat] Sync error:', error);
            }
            Alert.alert(
              t('dream_chat.sync_failed_title'),
              t('dream_chat.sync_failed_message'),
              [{ text: t('common.ok') }]
            );
            return;
          } finally {
            setIsLoading(false);
            setStreamingReply(null);
            if (requestAbortRef.current) {
              requestAbortRef.current = null;
            }
          }
          return;
        } else {
          // No network or not authenticated - cannot sync
          Alert.alert(
            t('dream_chat.not_synced_title'),
            t('dream_chat.not_synced_message'),
            [{ text: t('common.ok') }]
          );
          return;
        }
      }

      // Add user message (use displayText if provided, otherwise use textToSend)
      const userMessage = createChatMessage('user', resolvedDisplayText, {
        id: chatRequestId,
        category: options?.category,
        meta: options?.meta,
      });
      const updatedMessages = [...baseMessages, userMessage];
      setMessages(updatedMessages);
      setInputText((current) => computeNextInputAfterSend(current, textToSend));
      setIsLoading(true);

      try {
        const controller = new AbortController();
        requestAbortRef.current = controller;
        // ✅ PHASE 2: Get AI response with server-side quota enforcement
        // Note: No longer send history - server reads from dreams.chat_history
        // Server uses "claim before cost" pattern: message persisted BEFORE Gemini call

        // For guests: send full dream context (no DB entry)
        // For authenticated: send dreamId (server reads from DB)
        let aiResponse: Awaited<ReturnType<typeof startOrContinueChat>>;
        let guestFingerprint: string | undefined;
        if (!user) {
          try {
            guestFingerprint = await getDeviceFingerprint();
          } catch (err) {
            if (__DEV__) {
              console.warn('[DreamChat] Failed to get device fingerprint for guest chat', err);
            }
          }
        }
        if (!user && !dream.remoteId) {
          // Guest mode: send complete dream context
          const dreamContext = {
            transcript: dream.transcript,
            title: dream.title,
            interpretation: dream.interpretation,
            shareableQuote: dream.shareableQuote,
            dreamType: dream.dreamType,
            theme: dream.theme,
            chatHistory: updatedMessages,  // Current messages before AI response
          };
          aiResponse = await startOrContinueChat(
            String(dream.id),
            textToSend,
            language,
            dreamContext,
            guestFingerprint,
            {
              signal: controller.signal,
              clientRequestId: chatRequestId,
              messageMeta,
              onDelta: setStreamingReply,
            }
          );
        } else {
          // Authenticated mode: send dreamId (current flow)
          const dreamIdString = String(dream.remoteId ?? dream.id);
          aiResponse = await startOrContinueChat(dreamIdString, textToSend, language, undefined, undefined, {
            signal: controller.signal,
            clientRequestId: chatRequestId,
            messageMeta,
            onDelta: setStreamingReply,
          });
        }

        const aiMessage = createChatMessage('model', aiResponse.text, {
          id: aiResponse.message?.id,
          parts: aiResponse.message?.parts,
        });
        const finalMessages = [...updatedMessages, aiMessage];

        setMessages(finalMessages);
        if (debugChat) {
          console.debug('[DreamChat] sendMessage success', {
            dreamId: dream.id,
            userMessageCount: updatedMessages.length,
            aiTextLength: aiResponse.text.length,
            finalMessageCount: finalMessages.length,
            ts: Date.now(),
          });
        }

        // Persist chat history to dream
        // Note: exploration_started_at is set server-side by the DB trigger
        // when it detects the first model message in chat_history
        const dreamUpdate: Partial<DreamAnalysis> = {
          ...dream,
          chatHistory: finalMessages,
        };

        // Persist to dream
        if (user && !isMockMode) {
          // The atomic chat RPC already committed both messages. Update only
          // the local cache to avoid a redundant full-dream write and revision race.
          await applyServerDreamState(dreamUpdate as DreamAnalysis);
        } else {
          await updateDream(dreamUpdate as DreamAnalysis);
        }

        // Invalidate quota cache if this was the first message
        if (isFirstUserMessage) {
          if (isMockMode) {
            await markMockExploration({ id: dreamId });
          }
          if (!user && !isExistingExploration) {
            incrementLocalExplorationCount().catch((err) => {
              if (__DEV__) console.warn('[DreamChat] Failed to increment exploration count', err);
            });
          }
        }
        quotaService.invalidate(user);
      } catch (error) {
        if (debugChat) {
          console.debug('[DreamChat] sendMessage error', {
            dreamId: dream.id,
            ts: Date.now(),
            error,
          });
        }
        if (messageMeta?.exploration360Synthesis && isExploration360SynthesisUpgradeError(error)) {
          setMessages(baseMessages);
          router.push(buildPaywallHref('exploration_limit'));
          return;
        }
        if (__DEV__) {
          console.error('Chat error:', error);
        }
        const userMessage = error instanceof Error ? getUserErrorMessage(error, t) : t('dream_chat.error_message');
        const errorMessage = createChatMessage('model', t('dream_chat.error_message'), {
          meta: {
            isError: true,
            retry: {
              messageText: textToSend,
              displayText: resolvedDisplayText,
              clientRequestId: chatRequestId,
            },
          },
        });
        const enrichedErrorMessage =
          userMessage === t('dream_chat.error_message')
            ? errorMessage
            : createChatMessage('model', userMessage, { meta: errorMessage.meta });
        setMessages([...updatedMessages, enrichedErrorMessage]);
      } finally {
        setIsLoading(false);
        setStreamingReply(null);
        if (requestAbortRef.current) {
          requestAbortRef.current = null;
        }
      }
      } finally {
        sendInFlightRef.current = false;
      }
    },
    [
      debugChat,
      canChat,
      canExplore,
      dream,
      dreamId,
      explorationBlocked,
      hasNetwork,
      hasQuotaCheckClearance,
      inputText,
      isLoading,
      isExistingExploration,
      isMockMode,
      language,
      messageLimit,
      messages,
      messagesRemaining,
      showMessageLimitAlert,
      shouldGateOnQuotaCheck,
      t,
      applyServerDreamState,
      updateDream,
      user,
    ]
  );

  const handleRetryMessage = useCallback(
    (message: ChatMessage) => {
      if (isLoading) return;
      const retry = message.meta?.retry;
      if (!retry) return;
      const baseMessages = messages.filter(
        (msg) => msg.id !== message.id && msg.id !== retry.clientRequestId
      );
      setMessages(baseMessages);
      sendMessage(retry.messageText, retry.displayText, {
        baseMessages,
        clientRequestId: retry.clientRequestId,
      });
    },
    [isLoading, messages, sendMessage]
  );

  const sendSynthesisRequest = useCallback(
    (baseMessages?: ChatMessage[]) => {
      if (!dream || !exploration360Status.canGenerateSynthesis || isLoading) {
        return;
      }

      if (!canUseExploration360Synthesis(tier)) {
        router.push(buildPaywallHref('exploration_limit'));
        return;
      }

      sendMessage(
        t('dream_chat.prompt.synthesis_360'),
        t('dream_chat.exploration360.synthesis.display'),
        {
          baseMessages,
          meta: { exploration360Synthesis: true },
        },
      );
    },
    [dream, exploration360Status.canGenerateSynthesis, isLoading, sendMessage, t, tier],
  );

  const handleSynthesisPress = useCallback(() => {
    sendSynthesisRequest();
  }, [sendSynthesisRequest]);

  useEffect(() => {
    if (routeMode !== 'synthesis' || !dream || !exploration360Status.canGenerateSynthesis) {
      return;
    }
    if (!hasQuotaCheckClearance || isQuotaGateBlocked || isLoading) {
      return;
    }

    const hasStoredHistory = Boolean(dream.chatHistory?.length);
    const messagesReady = messages.length > 0 || !hasStoredHistory;
    if (!messagesReady) {
      return;
    }

    const synthesisKey = `${dream.id}:synthesis`;
    if (lastSynthesisSentKeyRef.current === synthesisKey) {
      return;
    }

    lastSynthesisSentKeyRef.current = synthesisKey;
    const timeoutId = setTimeout(() => {
      const baseMessages = messages.length > 0 ? messages : dream.chatHistory ?? [];
      sendSynthesisRequest(baseMessages);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    dream,
    exploration360Status.canGenerateSynthesis,
    hasQuotaCheckClearance,
    isLoading,
    isQuotaGateBlocked,
    messages,
    routeMode,
    sendSynthesisRequest,
  ]);

  const handleQuickCategory = (categoryId: string) => {
    if (isLoading) return;
    // Block if quota check not complete or exploration blocked
    if (!hasQuotaCheckClearance || isQuotaGateBlocked) return;
    if (messageLimitReached) {
      // Only show alert for new explorations; existing explorations have the banner
      if (!isExistingExploration) {
        showMessageLimitAlert();
      }
      return;
    }
    if (!dream) return;
    const question = getCategoryQuestion(categoryId as CategoryType, t);
    if (question) {
      sendMessage(question, undefined, { category: categoryId as Exclude<CategoryType, 'general'> });
    }
  };

  const gradientColors = noctalia.screen.gradient;

  const imageGradientColors = ([
    'transparent',
    `${noctalia.screen.background}E6`,
    noctalia.screen.background,
  ] as const);
  const backButtonSurface = {
    backgroundColor: noctalia.surface.raised,
    borderWidth: 1,
    borderColor: noctalia.surface.border,
  };
  const getQuickCategoryColor = (categoryId: string) => {
    if (categoryId === 'emotions') return colors.tags.mystical;
    if (categoryId === 'growth') return colors.tags.calm;
    return noctalia.accent.base;
  };

  const dreamImageUri = dream?.imageUrl?.trim();

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/journal');
    }
  }, []);

  if (!dream) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <AtmosphericBackground />
        <Text style={[styles.errorText, { color: noctalia.text.primary }]}>{t('dream_chat.not_found.title')}</Text>
        <Pressable
          onPress={handleBackPress}
          style={[styles.missingDreamBackButton, { backgroundColor: noctalia.action.primary }]}
        >
          <Text style={[styles.missingDreamBackButtonText, { color: noctalia.action.primaryText }]}>{t('dream_chat.not_found.back')}</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // If exploration is blocked, show upgrade screen
  if (isQuotaGateBlocked) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <AtmosphericBackground />
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, backButtonSurface]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.accent.base} />
        </Pressable>

        <View style={[styles.blockedContainer]} testID={TID.Chat.ScreenBlocked}>
          <IconSymbol name="lock.fill" size={64} color={noctalia.accent.base} />
          <Text style={[styles.blockedTitle, { color: noctalia.text.primary }]}>
            {t('dream_chat.exploration_limit.title')}
          </Text>
          <Text style={[styles.blockedMessage, { color: noctalia.text.secondary }]}>
            {tier === 'guest'
              ? t('dream_chat.exploration_limit.message_guest')
              : t('dream_chat.exploration_limit.message_free')}
          </Text>
          <Pressable
            style={[styles.upgradeButton, shadows.lg, { backgroundColor: noctalia.action.primary }]}
            onPress={() => router.push(buildPaywallHref('exploration_limit'))}
          >
            <IconSymbol name="arrow.up.circle" size={24} color={noctalia.action.primaryText} />
            <Text style={[styles.upgradeButtonText, { color: noctalia.action.primaryText }]}>
              {tier === 'guest' ? t('dream_chat.exploration_limit.cta_guest') : t('dream_chat.exploration_limit.cta_free')}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  // Show loading or error while checking quota
  if (shouldGateOnQuotaCheck && (!quotaCheckComplete || quotaCheckError)) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <AtmosphericBackground />
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, backButtonSurface]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.accent.base} />
        </Pressable>

        <View style={styles.quotaCheckContainer}>
          {quotaCheckError ? (
            <>
              <IconSymbol name="exclamationmark.triangle.fill" size={48} color={noctalia.status.danger.icon} />
              <Text style={[styles.errorText, { color: noctalia.text.primary, marginTop: 16 }]}>
                {quotaCheckError}
              </Text>
              <Pressable
                style={[styles.retryButton, { backgroundColor: noctalia.action.primary }]}
                onPress={runQuotaCheck}
              >
                <Text style={[styles.retryButtonText, { color: noctalia.action.primaryText }]}>
                  {t('analysis.retry')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={noctalia.accent.base} />
              <Text style={[styles.errorText, { color: noctalia.text.secondary, marginTop: 16 }]}>
                {t('dream_chat.checking_access')}
              </Text>
            </>
          )}
        </View>
      </LinearGradient>
    );
  }

  const headerComponent = (
    <>
      <View style={styles.imageContainer}>
        {dreamImageUri ? (
          <Image
            source={{ uri: dreamImageUri }}
            style={styles.dreamImage}
            contentFit={imageConfig.contentFit}
            transition={imageConfig.transition}
            cachePolicy={imageConfig.cachePolicy}
            priority={imageConfig.priority}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        ) : (
          <View
            style={[
              styles.dreamImage,
              styles.imagePlaceholder,
              { backgroundColor: noctalia.surface.soft },
            ]}
          />
        )}
        <LinearGradient
          colors={imageGradientColors}
          style={styles.imageGradient}
        >
          <Text style={[styles.dreamTitle, { color: noctalia.text.primary }]} numberOfLines={2}>
            {dream.title}
          </Text>
          {dream.shareableQuote ? (
            <Text style={[styles.dreamQuotePreview, { color: noctalia.text.secondary }]}>
              &quot;{dream.shareableQuote}&quot;
            </Text>
          ) : null}
        </LinearGradient>
      </View>
      {/* Decorative rule between header and content */}
      <View style={styles.decoRuleContainer}>
        <View style={[DecoLines.rule, { backgroundColor: noctalia.accent.base }]} />
      </View>
      <Exploration360Panel
        progress={exploration360Status.progress}
        hasSynthesis={exploration360Status.hasSynthesis}
        onSynthesisPress={handleSynthesisPress}
        synthesisDisabled={isLoading || !hasQuotaCheckClearance || isQuotaGateBlocked}
        animationDelay={160}
        style={styles.exploration360Panel}
      />
      {messages.length <= 2 && (
        <View style={styles.quickCategoriesContainer}>
          <Text style={[styles.quickCategoriesLabel, { color: noctalia.text.secondary }]}>{t('dream_chat.quick_topics')}</Text>
          <View style={styles.quickCategories}>
            {QUICK_CATEGORIES.map((cat, index) => {
              const catColor = getQuickCategoryColor(cat.id);
              const isQuickDisabled = isLoading || !hasQuotaCheckClearance || isQuotaGateBlocked || messageLimitReached;
              return (
                <MotiView
                  key={cat.id}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: isQuickDisabled ? 0.5 : 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 200 + index * 80 }}
                >
                  <FlatGlassCard
                    onPress={isQuickDisabled ? undefined : () => handleQuickCategory(cat.id)}
                    style={styles.quickCategoryGlass}
                    testID={`quick-category-${cat.id}`}
                    animationDelay={0}
                  >
                    <View style={[styles.quickCategoryAccent, { backgroundColor: catColor }]} />
                    <View style={styles.quickCategoryInner}>
                      <IconSymbol name={cat.icon} size={16} color={noctalia.text.primary} />
                      <Text style={[styles.quickCategoryText, { color: noctalia.text.primary }]}>
                        {t(cat.labelKey)}
                      </Text>
                    </View>
                  </FlatGlassCard>
                </MotiView>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  const composerPlaceholder = messageLimitReached
    ? t('dream_chat.input.limit_placeholder')
    : t('dream_chat.input.placeholder');

  // Show counter only when approaching the limit (≥15 messages) or limit reached
  const shouldShowCounter = typeof messageLimit === 'number' &&
    (userMessageCount >= 15 || messageLimitReached);

  // IMPORTANT: Always render these components to prevent Android NullPointerException
  // when animated views are removed mid-animation. Use visible prop instead.
  const composerFooter = (
    <ComposerFooter
      colors={colors}
      mode={mode}
      messageCounterLabel={messageCounterLabel}
      messageLimitReached={messageLimitReached}
      messagesRemaining={messagesRemaining}
      t={t}
      tier={tier}
      visible={shouldShowCounter}
    />
  );

  const composerHeader = (
    <LoadingIndicator text={t('dream_chat.thinking')} visible={showThinkingIndicator} />
  );

  return (
    <ChatProvider isStreaming={isLoading}>
      <ScrollPerfProvider isScrolling={isScrolling}>
        <LinearGradient colors={gradientColors} style={styles.gradient}>
          <AtmosphericBackground />
          <Pressable
            onPress={handleBackPress}
            style={[styles.floatingBackButton, shadows.lg, backButtonSurface]}
            accessibilityRole="button"
            accessibilityLabel={t('journal.back_button')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol name="chevron.left" size={22} color={noctalia.accent.base} />
          </Pressable>

          <MessagesList
            messages={displayMessages}
            isLoading={showThinkingIndicator}
            loadingText={t('dream_chat.thinking')}
            ListHeaderComponent={headerComponent}
            style={[styles.messagesContainer, { backgroundColor: noctalia.screen.background }]}
            contentContainerStyle={styles.messagesContent}
            onRetryMessage={handleRetryMessage}
            retryA11yLabel={t('analysis.retry')}
            onScrollStateChange={setIsScrolling}
          />

          <Composer.Root
            value={inputText}
            onChangeText={setInputText}
            onSend={(text) => sendMessage(text)}
            placeholder={composerPlaceholder}
            isLoading={isLoading}
            isDisabled={messageLimitReached}
            transcriptionLocale={transcriptionLocale}
            testID={TID.Chat.Input}
            micTestID={TID.Chat.Mic}
            sendTestID={TID.Chat.Send}
          >
            <Composer.Footer>{composerFooter}</Composer.Footer>
            <Composer.Header>{composerHeader}</Composer.Header>
            <Composer.Body>
              <Composer.Input />
              <Composer.MicButton />
              <Composer.SendButton />
            </Composer.Body>
          </Composer.Root>
        </LinearGradient>
      </ScrollPerfProvider>
    </ChatProvider>
  );
}

type ComposerFooterProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  mode: ThemeMode;
  messageCounterLabel: string;
  messageLimitReached: boolean;
  messagesRemaining: number;
  t: (key: string, replacements?: { [k: string]: string | number }) => string;
  tier: string;
  visible?: boolean;
};

/**
 * ComposerFooter - Message counter and limit warning
 *
 * IMPORTANT: Uses visibility control instead of conditional rendering to prevent
 * Android NullPointerException in ViewGroup.dispatchDraw when animated views
 * are removed mid-animation.
 */
function ComposerFooter({
  colors,
  mode,
  messageCounterLabel,
  messageLimitReached,
  messagesRemaining,
  t,
  tier,
  visible = true,
}: ComposerFooterProps) {
  const { isKeyboardVisible } = useKeyboardStateContext();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const footerAnimatedStyle = useAnimatedStyle(() => {
    // Hide when keyboard is visible OR when not visible
    const hidden = isKeyboardVisible.get() || !visible;
    return {
      opacity: withTiming(hidden ? 0 : 1, { duration: 150 }),
      transform: [{ translateY: withTiming(hidden ? 8 : 0, { duration: 150 }) }],
    };
  }, [isKeyboardVisible, visible]);

  const isLowRemaining = messagesRemaining <= 5;
  const pillBackground = noctalia.surface.raised;
  const pillBorder = noctalia.surface.border;
  const counterColor = isLowRemaining ? noctalia.status.danger.text : noctalia.text.primary;

  return (
    <Animated.View
      style={[styles.footerWrapper, !visible && styles.footerWrapperHidden, footerAnimatedStyle]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {!messageLimitReached && (
        <View
          style={[
            styles.messageCounterContainer,
            { backgroundColor: pillBackground, borderColor: pillBorder },
          ]}
        >
          <IconSymbol name="bubble.left.and.bubble.right" size={14} color={counterColor} />
          <Text
            testID={TID.Text.ChatMessageCounter}
            style={[
              styles.messageCounter,
              { color: counterColor },
            ]}
          >
            {messageCounterLabel}
          </Text>
        </View>
      )}

      {messageLimitReached && (
        <View
          testID={TID.Text.ChatLimitBanner}
          style={[
            styles.limitWarningBanner,
            {
              backgroundColor: noctalia.status.danger.background,
              borderColor: noctalia.status.danger.border,
            },
          ]}
        >
          <View style={styles.limitWarningContent}>
            <IconSymbol name="exclamationmark.circle.fill" size={16} color={noctalia.status.danger.icon} />
            <Text style={[styles.limitWarningText, { color: noctalia.status.danger.text }]}>
              {t('dream_chat.limit_warning')}
            </Text>
          </View>
          <View>
            <GesturePressable
              onPress={() => router.push('/(tabs)/settings')}
              style={[
                styles.limitCtaButton,
                { backgroundColor: noctalia.status.danger.icon },
              ]}
            >
              <Text style={[styles.limitCtaText, { color: noctalia.action.primaryText }]}>
                {tier === 'guest'
                  ? t('dream_chat.limit_cta_guest')
                  : t('dream_chat.limit_cta_free')}
              </Text>
            </GesturePressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  errorText: {
    // color: set dynamically
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  quotaCheckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  imageContainer: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  dreamImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  dreamTitle: {
    fontSize: 22,
    fontFamily: Fonts.fraunces.semiBold,
    // color: set dynamically
    lineHeight: 30,
  },
  dreamQuotePreview: {
    fontSize: 13,
    fontFamily: Fonts.lora.regularItalic,
    opacity: 0.6,
    marginTop: 4,
    lineHeight: 18,
  },
  imagePlaceholder: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  messagesContainer: {
    flex: 1,
    // backgroundColor: set dynamically
  },
  messagesContent: {
    paddingTop: 0,
  },
  quickCategoriesContainer: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  exploration360Panel: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  quickCategoriesLabel: {
    fontSize: 12,
    fontFamily: Fonts.lora.regularItalic,
    // color: set dynamically
    marginBottom: 10,
  },
  quickCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCategoryGlass: {
    overflow: 'hidden',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  quickCategoryAccent: {
    width: '100%',
    height: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  quickCategoryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickCategoryText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
  },
  decoRuleContainer: {
    alignItems: 'center',
    marginVertical: 0,
  },
  missingDreamBackButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  missingDreamBackButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  // Exploration blocked screen
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 20,
  },
  blockedTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 16,
  },
  blockedMessage: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  upgradeButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  // Message counter
  messageCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  messageCounter: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  limitWarningBanner: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  limitWarningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  limitWarningText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  limitCtaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  limitCtaText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    fontWeight: '600',
  },
  footerWrapper: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: 'center',
  },
  footerWrapperHidden: {
    display: 'none',
  },
});
