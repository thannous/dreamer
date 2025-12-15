import { Composer } from '@/components/chat/Composer';
import { LoadingIndicator, MessagesList } from '@/components/chat/MessagesList';
import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ChatProvider, useKeyboardStateContext } from '@/context/ChatContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { isMockModeEnabled } from '@/lib/env';
import { QuotaError, QuotaErrorCode } from '@/lib/errors';
import { getImageConfig } from '@/lib/imageUtils';
import { getTranscriptionLocale } from '@/lib/locale';
import { TID } from '@/lib/testIDs';
import { ChatMessage, DreamAnalysis, type DreamChatCategory, type ThemeMode } from '@/lib/types';
import { startOrContinueChat } from '@/services/geminiService';
import { createDreamInSupabase } from '@/services/supabaseDreamService';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { useNetworkState } from 'expo-network';
import { incrementLocalExplorationCount } from '@/services/quota/GuestAnalysisCounter';
import { markMockExploration } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type CategoryType = DreamChatCategory;

const LEGACY_DRAFT_PREFIXES = ['Here is my dream:'];

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
  { id: 'symbols', labelKey: 'dream_chat.quick.symbols', icon: 'creation' as const },
  { id: 'emotions', labelKey: 'dream_chat.quick.emotions', icon: 'heart-pulse' as const },
  { id: 'growth', labelKey: 'dream_chat.quick.growth', icon: 'sprout' as const },
];

const QUOTA_CHECK_TIMEOUT_MS = 12000; // Fail gracefully if quota check hangs

export default function DreamChatScreen() {
  const { t } = useTranslation();
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  const { dreams, updateDream } = useDreams();
  const { colors, mode, shadows } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isMockMode = isMockModeEnabled();
  const dreamId = useMemo(() => Number(id), [id]);
  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
  const { quotaStatus, canExplore, canChat, tier } = useQuota({ dreamId, dream });
  const { isConnected: hasNetwork } = useNetworkState();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [explorationBlocked, setExplorationBlocked] = useState(false);
  const [quotaCheckComplete, setQuotaCheckComplete] = useState(false);
  const [quotaCheckError, setQuotaCheckError] = useState<string | null>(null);
  const quotaCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const lastCategorySentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (quotaCheckTimeoutRef.current) {
        clearTimeout(quotaCheckTimeoutRef.current);
      }
    };
  }, []);

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
    const hasUserMessages = dream.chatHistory?.some((msg) => msg.role === 'user');
    return Boolean(dream.explorationStartedAt || hasUserMessages);
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

    // Initialize with existing chat history or start new conversation
    if (dream.chatHistory && dream.chatHistory.length > 0) {
      const localizedPrefix = t('dream_chat.draft_prefix');
      const normalized = dream.chatHistory.map((msg, index) => {
        if (index !== 0 || msg.role !== 'user') return msg;
        const text = msg.text ?? '';
        for (const legacyPrefix of LEGACY_DRAFT_PREFIXES) {
          if (text.startsWith(legacyPrefix)) {
            const rest = text.slice(legacyPrefix.length).trimStart();
            const updatedText = rest ? `${localizedPrefix} ${rest}` : localizedPrefix;
            return { ...msg, text: updatedText };
          }
        }
        return msg;
      });

      setMessages(normalized);
      lastCategorySentKeyRef.current = null; // allow new theme prompts when revisiting
    } else {
      // Start with initial AI greeting
      const initialMessage: ChatMessage = {
        role: 'model',
        text: t('dream_chat.initial_greeting', { title: dream.title }),
      };
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
      options?: { baseMessages?: ChatMessage[]; category?: Exclude<CategoryType, 'general'> }
    ) => {
      const textToSend = messageText || inputText.trim();
      if (!textToSend || !dream) return;

      if (messageLimit !== null && messagesRemaining <= 0) {
        showMessageLimitAlert();
        return;
      }

      // Safety: block sending while the initial exploration quota check is still running
      if (shouldGateOnQuotaCheck && !hasQuotaCheckClearance) {
        return;
      }

      // Check exploration quota for first message (new exploration)
      const baseMessages = options?.baseMessages ?? messages;
      const isFirstUserMessage = baseMessages.filter((msg) => msg.role === 'user').length === 0;

      if (isFirstUserMessage && !dream.explorationStartedAt) {
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
      if (user && !dream.remoteId) {
        if (hasNetwork) {
          // Auto-sync the dream with idempotence
          setIsLoading(true);
          try {
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
            const aiResponseText = await startOrContinueChat(dreamIdString, textToSend, language);

            // Add user message
            const userMessage: ChatMessage = {
              role: 'user',
              text: displayText || textToSend,
              ...(options?.category ? { meta: { category: options.category } } : {}),
            };
            const updatedMessages = [...baseMessages, userMessage];

            const aiMessage: ChatMessage = { role: 'model', text: aiResponseText };
            const finalMessages = [...updatedMessages, aiMessage];

            setMessages(finalMessages);

            // Persist chat history to dream
            const dreamUpdate: Partial<DreamAnalysis> = {
              ...synced,
              chatHistory: finalMessages,
            };

            await updateDream(dreamUpdate as DreamAnalysis);

            // Invalidate quota cache if this was the first message
            if (isFirstUserMessage) {
              if (isMockMode) {
                await markMockExploration({ id: dreamId });
              }
              if (!user && !synced.explorationStartedAt) {
                incrementLocalExplorationCount().catch((err) => {
                  if (__DEV__) console.warn('[DreamChat] Failed to increment exploration count', err);
                });
              }
            }
            quotaService.invalidate(user);
          } catch (error) {
            setIsLoading(false);
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
      const userMessage: ChatMessage = {
        role: 'user',
        text: displayText || textToSend,
        ...(options?.category ? { meta: { category: options.category } } : {}),
      };
      const updatedMessages = [...baseMessages, userMessage];
      setMessages(updatedMessages);
      setInputText('');
      setIsLoading(true);

      try {
      // ✅ PHASE 2: Get AI response with server-side quota enforcement
      // Note: No longer send history - server reads from dreams.chat_history
      // Server uses "claim before cost" pattern: message persisted BEFORE Gemini call

      // For guests: send full dream context (no DB entry)
      // For authenticated: send dreamId (server reads from DB)
      let aiResponseText: string;
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
        aiResponseText = await startOrContinueChat(
          String(dream.id),
          textToSend,
          language,
          dreamContext,
          guestFingerprint
        );
      } else {
        // Authenticated mode: send dreamId (current flow)
        const dreamIdString = String(dream.remoteId ?? dream.id);
        aiResponseText = await startOrContinueChat(dreamIdString, textToSend, language);
        }

        const aiMessage: ChatMessage = { role: 'model', text: aiResponseText };
        const finalMessages = [...updatedMessages, aiMessage];

        setMessages(finalMessages);

        // Persist chat history to dream
        // Note: exploration_started_at is set server-side by the DB trigger
        // when it detects the first model message in chat_history
        const dreamUpdate: Partial<DreamAnalysis> = {
          ...dream,
          chatHistory: finalMessages,
        };

        // Persist to dream
        await updateDream(dreamUpdate as DreamAnalysis);

        // Invalidate quota cache if this was the first message
        if (isFirstUserMessage) {
          if (isMockMode) {
            await markMockExploration({ id: dreamId });
          }
          if (!user && !dream.explorationStartedAt) {
            incrementLocalExplorationCount().catch((err) => {
              if (__DEV__) console.warn('[DreamChat] Failed to increment exploration count', err);
            });
          }
        }
        quotaService.invalidate(user);
      } catch (error) {
        if (__DEV__) {
          console.error('Chat error:', error);
        }
        const errorMessage: ChatMessage = {
          role: 'model',
          text: t('dream_chat.error_message'),
        };
        setMessages([...updatedMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      canChat,
      canExplore,
      dream,
      dreamId,
      explorationBlocked,
      hasNetwork,
      hasQuotaCheckClearance,
      inputText,
      isMockMode,
      language,
      messageLimit,
      messages,
      messagesRemaining,
      showMessageLimitAlert,
      shouldGateOnQuotaCheck,
      t,
      updateDream,
      user,
    ]
  );

  const handleQuickCategory = (categoryId: string) => {
    // Block if quota check not complete or exploration blocked
    if (!hasQuotaCheckClearance || isQuotaGateBlocked) return;
    if (messageLimitReached) {
      showMessageLimitAlert();
      return;
    }
    if (!dream) return;
    const question = getCategoryQuestion(categoryId as CategoryType, t);
    if (question) {
      sendMessage(question, undefined, { category: categoryId as Exclude<CategoryType, 'general'> });
    }
  };

  const gradientColors = mode === 'dark'
    ? GradientColors.darkBase
    : ([colors.backgroundDark, colors.backgroundDark] as const);

  const imageGradientColors = mode === 'dark'
    ? (['transparent', 'rgba(19, 16, 34, 0.9)', '#131022'] as const)
    : (['transparent', colors.backgroundDark + 'E6', colors.backgroundDark] as const);

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
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('dream_chat.not_found.title')}</Text>
        <Pressable
          onPress={handleBackPress}
          style={[styles.missingDreamBackButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.missingDreamBackButtonText, { color: colors.textPrimary }]}>{t('dream_chat.not_found.back')}</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  // If exploration is blocked, show upgrade screen
  if (isQuotaGateBlocked) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={[styles.blockedContainer]} testID={TID.Chat.ScreenBlocked}>
          <Ionicons name="lock-closed" size={64} color={colors.accent} />
          <Text style={[styles.blockedTitle, { color: colors.textPrimary }]}>
            {t('dream_chat.exploration_limit.title')}
          </Text>
          <Text style={[styles.blockedMessage, { color: colors.textSecondary }]}>
            {tier === 'guest'
              ? t('dream_chat.exploration_limit.message_guest')
              : t('dream_chat.exploration_limit.message_free')}
          </Text>
          <Pressable
            style={[styles.upgradeButton, shadows.lg, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/paywall')}
          >
            <Ionicons name="arrow-up-circle-outline" size={24} color={colors.textPrimary} />
            <Text style={[styles.upgradeButtonText, { color: colors.textPrimary }]}>
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
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.quotaCheckContainer}>
          {quotaCheckError ? (
            <>
              <Ionicons name="warning-outline" size={48} color="#FF5252" />
              <Text style={[styles.errorText, { color: colors.textPrimary, marginTop: 16 }]}>
                {quotaCheckError}
              </Text>
              <Pressable
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                onPress={runQuotaCheck}
              >
                <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>
                  {t('analysis.retry')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.errorText, { color: colors.textSecondary, marginTop: 16 }]}>
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
        <Image
          source={{ uri: dream.imageUrl }}
          style={styles.dreamImage}
          contentFit={imageConfig.contentFit}
          transition={imageConfig.transition}
          cachePolicy={imageConfig.cachePolicy}
          priority={imageConfig.priority}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />
        <LinearGradient
          colors={imageGradientColors}
          style={styles.imageGradient}
        >
          <Text style={[styles.dreamTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {dream.title}
          </Text>
        </LinearGradient>
      </View>
      {messages.length <= 2 && (
        <View style={styles.quickCategoriesContainer}>
          <Text style={[styles.quickCategoriesLabel, { color: colors.textSecondary }]}>{t('dream_chat.quick_topics')}</Text>
          <View style={styles.quickCategories}>
            {QUICK_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [
                  styles.quickCategoryButton,
                  {
                    backgroundColor: mode === 'dark' ? 'rgba(50, 17, 212, 0.2)' : colors.backgroundSecondary,
                    borderColor: colors.divider,
                  },
                  pressed && styles.quickCategoryButtonPressed,
                  (!hasQuotaCheckClearance || isQuotaGateBlocked || messageLimitReached) && { opacity: 0.5 },
                ]}
                onPress={() => handleQuickCategory(cat.id)}
                disabled={isLoading || !hasQuotaCheckClearance || isQuotaGateBlocked || messageLimitReached}
              >
                <MaterialCommunityIcons name={cat.icon} size={16} color={colors.textPrimary} />
                <Text style={[styles.quickCategoryText, { color: colors.textPrimary }]}>
                  {t(cat.labelKey)}
                </Text>
              </Pressable>
            ))}
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

  const composerFooter = shouldShowCounter
    ? (
      <ComposerFooter
        colors={colors}
        mode={mode}
        messageCounterLabel={messageCounterLabel}
        messageLimitReached={messageLimitReached}
        messagesRemaining={messagesRemaining}
        t={t}
        tier={tier}
      />
    )
    : null;

  const composerHeader = isLoading
    ? <LoadingIndicator text={t('dream_chat.thinking')} />
    : null;

  return (
    <ChatProvider isStreaming={isLoading}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <KeyboardAwareChatContent>
          <MessagesList
            messages={messages}
            isLoading={isLoading}
            loadingText={t('dream_chat.thinking')}
            ListHeaderComponent={headerComponent}
            style={[styles.messagesContainer, { backgroundColor: colors.backgroundDark }]}
          />
        </KeyboardAwareChatContent>

        <Composer
          value={inputText}
          onChangeText={setInputText}
          onSend={() => sendMessage()}
          placeholder={composerPlaceholder}
          isLoading={isLoading}
          isDisabled={messageLimitReached}
          transcriptionLocale={transcriptionLocale}
          testID={TID.Chat.Input}
          micTestID={TID.Chat.Mic}
          sendTestID={TID.Chat.Send}
          headerContent={composerHeader}
          footerContent={composerFooter}
        />
      </LinearGradient>
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
};

function ComposerFooter({
  colors,
  mode,
  messageCounterLabel,
  messageLimitReached,
  messagesRemaining,
  t,
  tier,
}: ComposerFooterProps) {
  const { isKeyboardVisible } = useKeyboardStateContext();

  const footerAnimatedStyle = useAnimatedStyle(() => {
    const hidden = isKeyboardVisible.value.value;
    return {
      opacity: withTiming(hidden ? 0 : 1, { duration: 150 }),
      transform: [{ translateY: withTiming(hidden ? 8 : 0, { duration: 150 }) }],
    };
  }, [isKeyboardVisible]);

  const isLowRemaining = messagesRemaining <= 5;
  const pillBackground = mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)';
  const pillBorder = mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const counterColor = isLowRemaining ? '#EF4444' : colors.textPrimary;
  const limitBannerBackground = mode === 'dark' ? '#3A1212' : '#FEE2E2';

  return (
    <Animated.View style={[styles.footerWrapper, footerAnimatedStyle]} pointerEvents="box-none">
      {!messageLimitReached && (
        <View
          style={[
            styles.messageCounterContainer,
            { backgroundColor: pillBackground, borderColor: pillBorder },
          ]}
        >
          <Ionicons
            name="chatbubble-outline"
            size={14}
            color={counterColor}
          />
          <Text
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
          style={[styles.limitWarningBanner, { backgroundColor: limitBannerBackground }]}
        >
          <View style={styles.limitWarningContent}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
            <Text style={[styles.limitWarningText, { color: '#EF4444' }]}>
              {t('dream_chat.limit_warning')}
            </Text>
          </View>
          <View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={styles.limitCtaButton}
            >
              <Text style={styles.limitCtaText}>
                {tier === 'guest'
                  ? t('dream_chat.limit_cta_guest')
                  : t('dream_chat.limit_cta_free')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/**
 * KeyboardAwareChatContent - Adjusts container height when keyboard is visible
 * This ensures the message list shrinks and messages remain visible above the keyboard
 */
type KeyboardAwareChatContentProps = {
  children: React.ReactNode;
};

function KeyboardAwareChatContent({ children }: KeyboardAwareChatContentProps) {
  const { keyboardHeight, isKeyboardVisible } = useKeyboardStateContext();

  const animatedStyle = useAnimatedStyle(() => {
    const kbHeight = Platform.OS === 'android' && isKeyboardVisible.value.value
      ? keyboardHeight.value.value
      : 0;
    return {
      flex: 1,
      marginBottom: withTiming(kbHeight, { duration: 150 }),
    };
  }, [keyboardHeight, isKeyboardVisible]);

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
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
    height: 300,
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
    paddingBottom: 12,
  },
  dreamTitle: {
    fontSize: 20,
    fontFamily: Fonts.lora.bold,
    // color: set dynamically
    lineHeight: 28,
  },
  messagesContainer: {
    flex: 1,
    // backgroundColor: set dynamically
  },
  quickCategoriesContainer: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  quickCategoriesLabel: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    marginBottom: 8,
  },
  quickCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // backgroundColor and borderColor: set dynamically
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickCategoryButtonPressed: {
    opacity: 0.6,
  },
  quickCategoryText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
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
    fontFamily: Fonts.lora.bold,
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
    letterSpacing: 0.5,
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
    letterSpacing: 0.3,
  },
  limitWarningBanner: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
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
    backgroundColor: '#EF4444',
    alignSelf: 'flex-end',
  },
  limitCtaText: {
    color: '#FFFFFF',
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
});
