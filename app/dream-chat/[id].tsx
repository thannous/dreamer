import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useDreams } from '@/context/DreamsContext';
import { Fonts } from '@/constants/theme';
import { startOrContinueChat } from '@/services/geminiService';
import { ChatMessage, DreamAnalysis } from '@/lib/types';

type CategoryType = 'symbols' | 'emotions' | 'growth' | 'general';

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

  const categoryQuestions: Record<CategoryType, string> = {
    symbols: 'Now, tell me about the symbolic meanings in my dream. What do the key symbols represent?',
    emotions: 'Now, help me understand the emotional landscape of this dream. What emotions am I processing?',
    growth: 'Now, what insights for personal growth can you share based on this dream?',
    general: '',
  };

  return dreamContext + categoryQuestions[category];
};

const QUICK_CATEGORIES = [
  { id: 'symbols', label: 'Symbols', icon: 'creation' as const },
  { id: 'emotions', label: 'Emotions', icon: 'heart-pulse' as const },
  { id: 'growth', label: 'Growth', icon: 'sprout' as const },
];

export default function DreamChatScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  const { dreams, updateDream } = useDreams();
  const dream = dreams.find((d) => d.id === Number(id));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (dream) {
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

      // If a category was selected, auto-send that question with dream context
      if (category && category !== 'general') {
        const categoryPrompt = buildCategoryPrompt(category as CategoryType, dream);
        if (categoryPrompt) {
          setTimeout(() => sendMessage(categoryPrompt), 500);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || !dream) return;

    // Add user message
    const userMessage: ChatMessage = { role: 'user', text: textToSend };
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
      await updateDream(dream.id, { chatHistory: finalMessages });
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        text: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCategory = (categoryId: string) => {
    if (!dream) return;
    const prompt = buildCategoryPrompt(categoryId as CategoryType, dream);
    if (prompt) {
      sendMessage(prompt);
    }
  };

  if (!dream) {
    return (
      <LinearGradient colors={['#131022', '#4A3B5F']} style={styles.container}>
        <Text style={styles.errorText}>Dream not found.</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#131022', '#131022']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#CFCFEA" />
          </Pressable>
          <Text style={styles.headerTitle}>Dream Analysis</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Dream Image with Title */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: dream.imageUrl }} style={styles.dreamImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(19, 16, 34, 0.9)', '#131022']}
            style={styles.imageGradient}
          >
            <Text style={styles.dreamTitle} numberOfLines={2}>
              {dream.title}
            </Text>
          </LinearGradient>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
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
                <View style={styles.avatarAI}>
                  <MaterialCommunityIcons name="brain" size={20} color="#CFCFEA" />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAI,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.messageTextUser,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
              {message.role === 'user' && (
                <View style={styles.avatarUser}>
                  <MaterialCommunityIcons name="account" size={20} color="#CFCFEA" />
                </View>
              )}
            </View>
          ))}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#8C9EFF" />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}

          {/* Quick Category Buttons */}
          {messages.length <= 2 && (
            <View style={styles.quickCategoriesContainer}>
              <Text style={styles.quickCategoriesLabel}>Quick Topics:</Text>
              <View style={styles.quickCategories}>
                {QUICK_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={({ pressed }) => [
                      styles.quickCategoryButton,
                      pressed && styles.quickCategoryButtonPressed,
                    ]}
                    onPress={() => handleQuickCategory(cat.id)}
                    disabled={isLoading}
                  >
                    <MaterialCommunityIcons name={cat.icon} size={16} color="#e0d9ff" />
                    <Text style={styles.quickCategoryText}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type your response..."
              placeholderTextColor="#9b92c9"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <Pressable
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <MaterialCommunityIcons name="send" size={20} color="#CFCFEA" />
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
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#CFCFEA',
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
    backgroundColor: 'rgba(19, 16, 34, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 207, 234, 0.1)',
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
    color: '#CFCFEA',
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
    color: '#CFCFEA',
    lineHeight: 28,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#131022',
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
    backgroundColor: '#3211d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3d385f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 12,
  },
  messageBubbleAI: {
    backgroundColor: '#2a263d',
  },
  messageBubbleUser: {
    backgroundColor: '#3211d4',
  },
  messageText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#d9d5f2',
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#CFCFEA',
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
    color: '#9b92c9',
  },
  quickCategoriesContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  quickCategoriesLabel: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#9b92c9',
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
    backgroundColor: 'rgba(50, 17, 212, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(224, 217, 255, 0.2)',
  },
  quickCategoryButtonPressed: {
    opacity: 0.6,
  },
  quickCategoryText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#e0d9ff',
  },
  inputContainer: {
    backgroundColor: '#131022',
    borderTopWidth: 1,
    borderTopColor: 'rgba(207, 207, 234, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#2a263d',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#d9d5f2',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3211d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
