import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { Fonts } from '@/constants/theme';
import { startOrContinueChat } from '@/services/geminiService';
import { ChatMessage, DreamAnalysis } from '@/lib/types';
import { GradientColors } from '@/constants/gradients';
import { getImageConfig } from '@/lib/imageUtils';

type CategoryType = 'symbols' | 'emotions' | 'growth' | 'general';

const getCategoryQuestion = (category: CategoryType): string => {
  const categoryQuestions: Record<CategoryType, string> = {
    symbols: 'Tell me about the symbolic meanings in my dream. What do the key symbols represent?',
    emotions: 'Help me understand the emotional landscape of this dream. What emotions am I processing?',
    growth: 'What insights for personal growth can you share based on this dream?',
    general: '',
  };
  return categoryQuestions[category];
};

const buildCategoryPrompt = (category: CategoryType, dream: DreamAnalysis): string => {
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

  const question = getCategoryQuestion(category);
  return dreamContext + 'Now, ' + question.charAt(0).toLowerCase() + question.slice(1);
};

const QUICK_CATEGORIES = [
  { id: 'symbols', label: 'Symbols', icon: 'creation' as const },
  { id: 'emotions', label: 'Emotions', icon: 'heart-pulse' as const },
  { id: 'growth', label: 'Growth', icon: 'sprout' as const },
];

export default function DreamChatScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  const { dreams, updateDream } = useDreams();
  const { colors, mode, shadows } = useTheme();
  const dreamId = useMemo(() => Number(id), [id]);
  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasSentCategoryRef = useRef(false);

  // Use full-resolution image config for chat view
  const imageConfig = useMemo(() => getImageConfig('full'), []);

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
        text: `I'm here to help you explore deeper insights about your dream "${dream.title}". What would you like to know?`,
      };
      setMessages([initialMessage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dream?.id]);

  // Send category-specific question if category is provided
  useEffect(() => {
    if (!dream || !category || category === 'general' || hasSentCategoryRef.current) {
      return;
    }

    const categoryPrompt = buildCategoryPrompt(category as CategoryType, dream);
    const question = getCategoryQuestion(category as CategoryType);

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
  }, [category, dream]); // sendMessage has stable dependencies via useCallback

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

        // Persist to dream
        await updateDream({ ...dream, chatHistory: finalMessages });
      } catch (error) {
        if (__DEV__) {
          console.error('Chat error:', error);
        }
        const errorMessage: ChatMessage = {
          role: 'model',
          text: 'Sorry, I encountered an error. Please try again.',
        };
        setMessages([...updatedMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, dream, messages, updateDream]
  );

  const handleQuickCategory = (categoryId: string) => {
    if (!dream) return;
    const prompt = buildCategoryPrompt(categoryId as CategoryType, dream);
    const question = getCategoryQuestion(categoryId as CategoryType);
    if (prompt) {
      sendMessage(prompt, question);
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
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>Dream not found.</Text>
        <Pressable
          onPress={handleBackPress}
          style={[styles.missingDreamBackButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.missingDreamBackButtonText, { color: colors.textPrimary }]}>Go Back</Text>
        </Pressable>
      </LinearGradient>
    );
  }

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
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Thinking...</Text>
            </View>
          )}

          {/* Quick Category Buttons */}
          {messages.length <= 2 && (
            <View style={styles.quickCategoriesContainer}>
              <Text style={[styles.quickCategoriesLabel, { color: colors.textSecondary }]}>Quick Topics:</Text>
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
                    <Text style={[styles.quickCategoryText, { color: colors.textPrimary }]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: colors.backgroundDark, borderTopColor: colors.divider }]}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Type your response..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: colors.accent }, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
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
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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
});
