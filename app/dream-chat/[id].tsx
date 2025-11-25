import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { QuotaError, QuotaErrorCode } from '@/lib/errors';
import { getImageConfig } from '@/lib/imageUtils';
import { TID } from '@/lib/testIDs';
import { ChatMessage, DreamAnalysis } from '@/lib/types';
import { startOrContinueChat } from '@/services/geminiService';
import { startNativeSpeechSession, type NativeSpeechSession } from '@/services/nativeSpeechRecognition';
import { quotaService } from '@/services/quotaService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AudioModule } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CategoryType = 'symbols' | 'emotions' | 'growth' | 'general';

const getCategoryQuestion = (category: CategoryType, t: (key: string) => string): string => {
  const categoryQuestions: Record<CategoryType, string> = {
    symbols: t('dream_chat.prompt.symbols'),
    emotions: t('dream_chat.prompt.emotions'),
    growth: t('dream_chat.prompt.growth'),
    general: '',
  };
  return categoryQuestions[category];
};

const buildCategoryPrompt = (category: CategoryType, dream: DreamAnalysis, t: (key: string) => string): string => {
  if (category === 'general') return '';

  const dreamContext = `Here's my dream:

Title: "${dream.title}"
Type: ${dream.dreamType}
${dream.theme ? `Theme: ${dream.theme}` : ''}

Original Dream:
${dream.transcript}

AI Analysis:
${dream.interpretation}

Key Quote: "${dream.shareableQuote}"

---

`;

  const question = getCategoryQuestion(category, t);
  return dreamContext + 'Now, ' + question.charAt(0).toLowerCase() + question.slice(1);
};

const QUICK_CATEGORIES = [
  { id: 'symbols', labelKey: 'dream_chat.quick.symbols', icon: 'creation' as const },
  { id: 'emotions', labelKey: 'dream_chat.quick.emotions', icon: 'heart-pulse' as const },
  { id: 'growth', labelKey: 'dream_chat.quick.growth', icon: 'sprout' as const },
];

export default function DreamChatScreen() {
  const { t } = useTranslation();
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  const { dreams, updateDream } = useDreams();
  const { colors, mode, shadows } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const dreamId = useMemo(() => Number(id), [id]);
  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
  const { quotaStatus, canExplore, canChat } = useQuota({ dreamId, dream });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [explorationBlocked, setExplorationBlocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasSentCategoryRef = useRef(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const baseInputRef = useRef('');

  // Speech recognition locale based on language
  const transcriptionLocale = useMemo(() => {
    switch (language) {
      case 'fr':
        return 'fr-FR';
      case 'es':
        return 'es-ES';
      default:
        return 'en-US';
    }
  }, [language]);

  // Use full-resolution image config for chat view
  const imageConfig = useMemo(() => getImageConfig('full'), []);

  // Count user messages for quota display
  const userMessageCount = useMemo(() => {
    return messages.filter((msg) => msg.role === 'user').length;
  }, [messages]);

  // Check exploration quota on mount
  useEffect(() => {
    const checkExplorationQuota = async () => {
      if (!dream) return;

      const canExploreDream = await canExplore();
      if (!canExploreDream) {
        setExplorationBlocked(true);
      }
    };

    checkExplorationQuota();
  }, [dream, dreamId, canExplore]);

  // Initialize chat messages from dream history
  useEffect(() => {
    if (!dream) return;

    // Initialize with existing chat history or start new conversation
    if (dream.chatHistory && dream.chatHistory.length > 0) {
      setMessages(dream.chatHistory);
    } else {
      // Start with initial AI greeting
      const initialMessage: ChatMessage = {
        role: 'model',
        text: t('dream_chat.initial_greeting', { title: dream.title }),
      };
      setMessages([initialMessage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dream?.id, t]);

  // Send category-specific question if category is provided
  useEffect(() => {
    if (!dream || !category || category === 'general' || hasSentCategoryRef.current) {
      return;
    }

    const categoryPrompt = buildCategoryPrompt(category as CategoryType, dream, t);
    const question = getCategoryQuestion(category as CategoryType, t);

    if (categoryPrompt) {
      hasSentCategoryRef.current = true;
      const timeoutId = setTimeout(() => {
        sendMessage(categoryPrompt, question);
      }, 500);

      return () => {
        clearTimeout(timeoutId);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dream, t]); // sendMessage has stable dependencies via useCallback

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [messages]);

  const sendMessage = useCallback(
    async (messageText?: string, displayText?: string) => {
      const textToSend = messageText || inputText.trim();
      if (!textToSend || !dream) return;

      // Check message quota before sending
      const canSendMessage = await canChat();
      if (!canSendMessage) {
        const tier = user ? 'free' : 'guest';
        const limitError = new QuotaError(QuotaErrorCode.MESSAGE_LIMIT_REACHED, tier);
        Alert.alert(
          'Message Limit Reached',
          limitError.userMessage,
          [
            { text: 'OK' },
            {
              text: 'Upgrade',
              onPress: () => router.push('/(tabs)/settings'),
            },
          ]
        );
        return;
      }

      // Check if this is the first user message (mark as explored)
      const isFirstUserMessage = messages.filter((msg) => msg.role === 'user').length === 0;

      // Add user message (use displayText if provided, otherwise use textToSend)
      const userMessage: ChatMessage = { role: 'user', text: displayText || textToSend };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInputText('');
      setIsLoading(true);

      try {
        // Build conversation history for API
        const history = updatedMessages.map((msg) => ({
          role: msg.role,
          text: msg.text,
        }));

        // Get AI response
        const aiResponseText = await startOrContinueChat(history, textToSend, 'en');

        const aiMessage: ChatMessage = { role: 'model', text: aiResponseText };
        const finalMessages = [...updatedMessages, aiMessage];

        setMessages(finalMessages);

        // Mark dream as explored if this is the first user message
        const dreamUpdate: Partial<DreamAnalysis> = {
          ...dream,
          chatHistory: finalMessages,
        };

        if (isFirstUserMessage && !dream.explorationStartedAt) {
          dreamUpdate.explorationStartedAt = Date.now();
        }

        // Persist to dream
        await updateDream(dreamUpdate as DreamAnalysis);

        // Invalidate quota cache if this was the first message
        if (isFirstUserMessage) {
          quotaService.invalidate(user);
        }
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
    [inputText, dream, messages, updateDream, canChat, user, t]
  );

  const handleQuickCategory = (categoryId: string) => {
    if (!dream) return;
    const prompt = buildCategoryPrompt(categoryId as CategoryType, dream, t);
    const question = getCategoryQuestion(categoryId as CategoryType, t);
    if (prompt) {
      sendMessage(prompt, question);
    }
  };

  // Speech-to-text: stop recording and get transcript
  const stopRecording = useCallback(async () => {
    const nativeSession = nativeSessionRef.current;
    nativeSessionRef.current = null;
    setIsRecording(false);

    if (!nativeSession) return;

    try {
      const result = await nativeSession.stop();
      const transcript = result.transcript?.trim();

      if (transcript) {
        // Replace partial text with final transcript using the original input as base
        setInputText(() => {
          const base = baseInputRef.current.trim();
          return base ? `${base} ${transcript}` : transcript;
        });
      } else {
        const normalizedError = result.error?.toLowerCase();
        if (!normalizedError?.includes('no speech')) {
          Alert.alert(
            t('recording.alert.no_speech.title'),
            t('recording.alert.no_speech.message')
          );
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[DreamChat] Failed to stop speech recognition:', error);
      }
    }
  }, [t]);

  // Speech-to-text: start recording
  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
        return;
      }

      // Abort any existing session
      nativeSessionRef.current?.abort();
      baseInputRef.current = inputText;

      // Start native speech session
      const session = await startNativeSpeechSession(transcriptionLocale, {
        onPartial: (text) => {
          // Update input text with partial transcript
          const base = baseInputRef.current.trim();
          setInputText(base ? `${base} ${text}` : text);
        },
      });

      if (!session) {
        Alert.alert(
          t('common.error_title'),
          t('recording.alert.start_failed')
        );
        return;
      }

      nativeSessionRef.current = session;
      setIsRecording(true);
    } catch (error) {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
      setIsRecording(false);
      if (__DEV__) {
        console.error('[DreamChat] Failed to start speech recognition:', error);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    }
  }, [inputText, t, transcriptionLocale]);

  // Toggle recording on/off
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup speech session on unmount
  useEffect(() => {
    return () => {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
    };
  }, []);

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
  if (explorationBlocked) {
    const tier = user ? 'free' : 'guest';
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
            onPress={() => router.push('/(tabs)/settings')}
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

  // Calculate if message limit is reached
  const quotaMessages = quotaStatus?.usage.messages;
  const rawMessageLimit = quotaMessages?.limit;
  const messageLimit = typeof rawMessageLimit === 'number'
    ? rawMessageLimit
    : rawMessageLimit === null
      ? null
      : 20;
  const fallbackRemaining = messageLimit === null
    ? Number.POSITIVE_INFINITY
    : messageLimit - userMessageCount;
  const messagesRemaining = typeof quotaMessages?.remaining === 'number'
    ? quotaMessages.remaining
    : fallbackRemaining;
  const messageLimitReached = messageLimit !== null && messagesRemaining <= 0;
  const messageCounterLabel = typeof messageLimit === 'number'
    ? t('dream_chat.message_counter', { used: userMessageCount, limit: messageLimit })
    : '';

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <Pressable
        onPress={handleBackPress}
        style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >


        {/* Dream Image with Title */}
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

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.messagesContainer, { backgroundColor: colors.backgroundDark }]}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageRow,
                message.role === 'user' ? styles.messageRowUser : styles.messageRowAI,
              ]}
            >
              {message.role === 'model' && (
                <View style={[styles.avatarAI, { backgroundColor: colors.accent }]}>
                  <MaterialCommunityIcons name="brain" size={20} color={colors.textPrimary} />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user'
                    ? [styles.messageBubbleUser, { backgroundColor: colors.accent }]
                    : [styles.messageBubbleAI, { backgroundColor: colors.backgroundSecondary }],
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: colors.textPrimary },
                    message.role === 'user' && styles.messageTextUser,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
              {message.role === 'user' && (
                <View style={[styles.avatarUser, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialCommunityIcons name="account" size={20} color={colors.textPrimary} />
                </View>
              )}
            </View>
          ))}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('dream_chat.thinking')}</Text>
            </View>
          )}

          {/* Quick Category Buttons */}
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
                        borderColor: colors.divider
                      },
                      pressed && styles.quickCategoryButtonPressed,
                    ]}
                    onPress={() => handleQuickCategory(cat.id)}
                    disabled={isLoading}
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
        </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: colors.backgroundDark, borderTopColor: colors.divider, paddingBottom: insets.bottom + 12 }]}>
          {/* Message Counter */}
          {typeof messageLimit === 'number' && (
            <View style={[styles.messageCounterContainer]}>
              <Ionicons
                name="chatbubble-outline"
                size={14}
                color={messagesRemaining <= 5 ? '#EF4444' : colors.textSecondary}
              />
              <Text style={[
                styles.messageCounter,
                { color: messagesRemaining <= 5 ? '#EF4444' : colors.textSecondary }
              ]}>
                {messageCounterLabel}
              </Text>
              {messageLimitReached && (
                <Text style={[styles.limitReachedText, { color: '#EF4444' }]}>
                  {t('dream_chat.limit_reached')}
                </Text>
              )}
            </View>
          )}

          {messageLimitReached && (
            <View
              testID={TID.Text.ChatLimitBanner}
              style={[styles.limitWarningBanner, { backgroundColor: '#EF444420' }]}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.limitWarningText, { color: '#EF4444' }]}>
                {t('dream_chat.limit_warning')}
              </Text>
            </View>
          )}

          <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary }]}>
            <TextInput
              testID={TID.Chat.Input}
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder={
                isRecording
                  ? t('dream_chat.input.recording_placeholder')
                  : messageLimitReached
                    ? t('dream_chat.input.limit_placeholder')
                    : t('dream_chat.input.placeholder')
              }
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading && !messageLimitReached && !isRecording}
            />
            {/* Mic button for speech-to-text */}
            <Pressable
              testID={TID.Chat.Mic}
              style={[
                styles.micButton,
                { backgroundColor: isRecording ? colors.accent : colors.backgroundCard },
                (isLoading || messageLimitReached) && styles.sendButtonDisabled,
              ]}
              onPress={toggleRecording}
              disabled={isLoading || messageLimitReached}
              accessibilityLabel={isRecording ? t('dream_chat.mic.stop') : t('dream_chat.mic.start')}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={20}
                color={isRecording ? colors.textPrimary : colors.textSecondary}
              />
            </Pressable>
            {/* Send button */}
            <Pressable
              testID={TID.Chat.Send}
              style={[styles.sendButton, { backgroundColor: colors.accent }, (!inputText.trim() || isLoading || messageLimitReached) && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading || messageLimitReached}
            >
              <MaterialCommunityIcons name="send" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
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
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    // backgroundColor and borderBottomColor: set dynamically
    borderBottomWidth: 1,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  imageContainer: {
    width: '100%',
    height: 200,
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
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatarAI: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor: set dynamically
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor: set dynamically
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 12,
  },
  messageBubbleAI: {
    // backgroundColor: set dynamically
  },
  messageBubbleUser: {
    // backgroundColor: set dynamically
  },
  messageText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 20,
  },
  messageTextUser: {
    // color: set dynamically
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
  },
  quickCategoriesContainer: {
    marginTop: 16,
    marginBottom: 8,
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
  inputContainer: {
    // backgroundColor and borderTopColor: set dynamically
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // paddingBottom is set dynamically with safe area insets
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    // backgroundColor: set dynamically
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    // backgroundColor: set dynamically
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  messageCounter: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  limitReachedText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  limitWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  limitWarningText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
