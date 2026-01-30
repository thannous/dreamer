/**
 * Floating Composer - v0-style chat input that floats above content
 * Based on patterns from https://vercel.com/blog/how-we-built-the-v0-ios-app
 *
 * Key features:
 * - Absolute positioned, floats above ScrollView content
 * - Height tracked via shared value for contentInset calculation
 * - Keyboard-aware positioning using KeyboardStickyView (when available)
 * - Speech-to-text support with mic button
 */

import { LanguagePackMissingSheet } from '@/components/speech/LanguagePackMissingSheet';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import { Fonts } from '@/constants/theme';
import { useComposerHeightContext, useKeyboardStateContext } from '@/context/ChatContext';
import { useTheme } from '@/context/ThemeContext';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import {
  registerOfflineModelPromptHandler,
  type OfflineModelPromptHandler,
} from '@/services/nativeSpeechRecognition';
import {
  openGoogleVoiceSettingsBestEffort,
  openSpeechRecognitionLanguageSettings,
} from '@/lib/speechRecognitionSettings';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Try to import KeyboardStickyView if the native module exists.
// Guard with NativeModules so Expo Go (no native module) doesn't throw during require.
const KeyboardStickyView: React.ComponentType<{
  offset?: { closed?: number; opened?: number };
  style?: ViewStyle;
  children: React.ReactNode;
}> | null = (() => {
  if (Platform.OS !== 'ios') return null;
  if (!NativeModules?.KeyboardController) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const KeyboardController = require('react-native-keyboard-controller');
    return KeyboardController.KeyboardStickyView ?? null;
  } catch {
    return null;
  }
})();

type ComposerContextValue = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text?: string) => void;
  placeholder?: string;
  isLoading: boolean;
  isDisabled: boolean;
  transcriptionLocale: string;
  testID?: string;
  micTestID?: string;
  sendTestID?: string;
  isRecording: boolean;
  canSend: boolean;
  handleTextInputPress: () => void;
  handleSend: () => void;
  toggleRecording: () => void;
  textInputRef: React.RefObject<TextInput | null>;
};

const ComposerContext = createContext<ComposerContextValue | null>(null);

const useComposerContext = () => {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error('Composer components must be used within Composer.Root');
  }
  return context;
};

interface ComposerRootProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text?: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  transcriptionLocale?: string;
  testID?: string;
  micTestID?: string;
  sendTestID?: string;
  children: React.ReactNode;
}

function Root({
  value,
  onChangeText,
  onSend,
  placeholder,
  isLoading = false,
  isDisabled = false,
  transcriptionLocale = 'en-US',
  testID,
  micTestID,
  sendTestID,
  children,
}: ComposerRootProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { composerHeight } = useComposerHeightContext();
  const { keyboardHeight } = useKeyboardStateContext();

  const [languagePackMissingInfo, setLanguagePackMissingInfo] = useState<{
    locale: string;
    installedLocales: string[];
  } | null>(null);
  const [showOfflineModelSheet, setShowOfflineModelSheet] = useState(false);
  const [offlineModelLocale, setOfflineModelLocale] = useState('');
  const offlineModelPromptResolveRef = useRef<(() => void) | null>(null);
  const offlineModelPromptPromiseRef = useRef<Promise<void> | null>(null);
  const offlineModelSheetVisibleRef = useRef(false);
  const containerRef = useRef<View>(null);
  const textInputRef = useRef<TextInput>(null);
  const localHeight = useSharedValue(0);

  const handleLanguagePackMissingClose = useCallback(() => {
    setLanguagePackMissingInfo(null);
  }, []);

  const handleLanguagePackMissingOpenSettings = useCallback(() => {
    handleLanguagePackMissingClose();
    void openSpeechRecognitionLanguageSettings();
  }, [handleLanguagePackMissingClose]);

  const handleLanguagePackMissingOpenGoogleSettings = useCallback(() => {
    handleLanguagePackMissingClose();
    void openGoogleVoiceSettingsBestEffort();
  }, [handleLanguagePackMissingClose]);

  // Track composer height for contentInset
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    localHeight.set(height);
    // Update shared context value on UI thread
    runOnUI(() => {
      'worklet';
      composerHeight.value.value = height;
    })();
  }, [composerHeight, localHeight]);

  const resolveOfflineModelPrompt = useCallback(() => {
    const resolve = offlineModelPromptResolveRef.current;
    offlineModelPromptResolveRef.current = null;
    offlineModelPromptPromiseRef.current = null;
    resolve?.();
  }, []);

  const waitForOfflineModelPromptClose = useCallback((): Promise<void> => {
    if (offlineModelPromptPromiseRef.current) {
      return offlineModelPromptPromiseRef.current;
    }

    offlineModelPromptPromiseRef.current = new Promise<void>((resolve) => {
      offlineModelPromptResolveRef.current = () => {
        resolve();
      };
    });

    return offlineModelPromptPromiseRef.current;
  }, []);

  const handleOfflineModelPromptShow = useCallback(
    async (locale: string) => {
      setOfflineModelLocale(locale);
      setShowOfflineModelSheet(true);
      await waitForOfflineModelPromptClose();
    },
    [waitForOfflineModelPromptClose]
  );

  const handleOfflineModelSheetClose = useCallback(() => {
    setShowOfflineModelSheet(false);
    setOfflineModelLocale('');
    resolveOfflineModelPrompt();
  }, [resolveOfflineModelPrompt]);

  const handleOfflineModelDownloadComplete = useCallback(
    (_success: boolean) => {
      handleOfflineModelSheetClose();
    },
    [handleOfflineModelSheetClose]
  );

  useEffect(() => {
    offlineModelSheetVisibleRef.current = showOfflineModelSheet;
  }, [showOfflineModelSheet]);

  // Register offline model prompt handler
  useEffect(() => {
    const handler: OfflineModelPromptHandler = {
      get isVisible() {
        return offlineModelSheetVisibleRef.current;
      },
      show: handleOfflineModelPromptShow,
    };
    return registerOfflineModelPromptHandler(handler);
  }, [handleOfflineModelPromptShow]);

  useEffect(() => {
    return () => {
      resolveOfflineModelPrompt();
    };
  }, [resolveOfflineModelPrompt]);

  const recordingSession = useRecordingSession({
    transcriptionLocale,
    t,
    onPartialTranscript: (text, { baseTranscript }) => {
      const base = baseTranscript.trim();
      onChangeText(base ? `${base} ${text}` : text);
    },
    onLanguagePackMissing: ({ locale, installedLocales }) => {
      setLanguagePackMissingInfo({ locale, installedLocales });
    },
  });

  const {
    isRecording,
    baseTranscriptRef,
    startRecording: startSessionRecording,
    stopRecording: stopSessionRecording,
    setupAppStateListener,
    forceStopRecording,
  } = recordingSession;

  useEffect(() => {
    const cleanup = setupAppStateListener();
    return () => {
      cleanup();
      void forceStopRecording('unmount');
    };
  }, [forceStopRecording, setupAppStateListener]);

  // Speech-to-text handlers
  const startRecording = useCallback(async () => {
    const response = await startSessionRecording(value);
    if (response.success) {
      return;
    }
    if (response.error === 'offline_model_not_ready') {
      return;
    }
    Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
  }, [startSessionRecording, t, value]);

  const stopRecording = useCallback(async (): Promise<string | undefined> => {
    const result = await stopSessionRecording();

    const base = baseTranscriptRef.current.trim();
    const transcript = result.transcript?.trim();
    if (transcript) {
      const finalText = base ? `${base} ${transcript}` : transcript;
      onChangeText(finalText);
      return finalText;
    }

    if (result.error === 'rate_limited') {
      Alert.alert(t('common.error_title'), t('error.rate_limit'));
      return;
    }

    if (result.error === 'language_pack_missing') {
      return base;
    }

    if (result.error === 'no_speech') {
      Alert.alert(
        t('recording.alert.no_speech.title'),
        t('recording.alert.no_speech.message')
      );
    }

    return base;
  }, [baseTranscriptRef, onChangeText, stopSessionRecording, t]);

  const handleTextInputPress = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      // Focus input and place cursor at the end
      setTimeout(() => {
        textInputRef.current?.focus();
        const textLength = value.length;
        textInputRef.current?.setSelection(textLength, textLength);
      }, 0);
    }
  }, [isRecording, stopRecording, value]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const canSend = value.trim().length > 0 && !isLoading && !isDisabled;

  const handleSend = useCallback(async () => {
    let textOverride: string | undefined;
    if (isRecording) {
      textOverride = await stopRecording();
    }
    onSend(textOverride?.trim());
  }, [isRecording, onSend, stopRecording]);

  const contextValue = useMemo<ComposerContextValue>(() => ({
    value,
    onChangeText,
    onSend,
    placeholder,
    isLoading,
    isDisabled,
    transcriptionLocale,
    testID,
    micTestID,
    sendTestID,
    isRecording,
    canSend,
    handleTextInputPress,
    handleSend,
    toggleRecording,
    textInputRef,
  }), [
    value,
    onChangeText,
    onSend,
    placeholder,
    isLoading,
    isDisabled,
    transcriptionLocale,
    testID,
    micTestID,
    sendTestID,
    isRecording,
    canSend,
    handleTextInputPress,
    handleSend,
    toggleRecording,
    textInputRef,
  ]);

  // Animated style for subtle appearance
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(1, { duration: 200 }),
    };
  });

  // Lift the composer above the keyboard on Android (KeyboardStickyView handles iOS)
  const animatedWrapperStyle = useAnimatedStyle(() => {
    const offset = Platform.OS === 'android' ? keyboardHeight.value.value : 0;
    return {
      transform: [{ translateY: withTiming(-offset, { duration: 160 }) }],
    };
  }, [keyboardHeight]);

  const composerContent = (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        { backgroundColor: 'transparent' },
        animatedContainerStyle,
      ]}
      onLayout={handleLayout}
    >
      <ComposerContext.Provider value={contextValue}>
        {children}
      </ComposerContext.Provider>
    </Animated.View>
  );

  // Wrap with KeyboardStickyView if available (iOS)
  if (Platform.OS === 'ios' && KeyboardStickyView) {
    return (
      <>
        <KeyboardStickyView
          style={styles.stickyWrapper}
          offset={{ closed: -insets.bottom, opened: -8 }}
        >
          {composerContent}
        </KeyboardStickyView>
        <LanguagePackMissingSheet
          visible={Boolean(languagePackMissingInfo)}
          onClose={handleLanguagePackMissingClose}
          locale={languagePackMissingInfo?.locale ?? transcriptionLocale}
          installedLocales={languagePackMissingInfo?.installedLocales ?? []}
          onOpenSettings={handleLanguagePackMissingOpenSettings}
          onOpenGoogleAppSettings={handleLanguagePackMissingOpenGoogleSettings}
        />
        <OfflineModelDownloadSheet
          visible={showOfflineModelSheet}
          onClose={handleOfflineModelSheetClose}
          locale={offlineModelLocale}
          onDownloadComplete={handleOfflineModelDownloadComplete}
        />
      </>
    );
  }

  // Fallback for Android or when KeyboardStickyView not available
  return (
    <>
      <Animated.View
        style={[styles.fallbackWrapper, { paddingBottom: insets.bottom }, animatedWrapperStyle]}
      >
        {composerContent}
      </Animated.View>
      <LanguagePackMissingSheet
        visible={Boolean(languagePackMissingInfo)}
        onClose={handleLanguagePackMissingClose}
        locale={languagePackMissingInfo?.locale ?? transcriptionLocale}
        installedLocales={languagePackMissingInfo?.installedLocales ?? []}
        onOpenSettings={handleLanguagePackMissingOpenSettings}
        onOpenGoogleAppSettings={handleLanguagePackMissingOpenGoogleSettings}
      />
      <OfflineModelDownloadSheet
        visible={showOfflineModelSheet}
        onClose={handleOfflineModelSheetClose}
        locale={offlineModelLocale}
        onDownloadComplete={handleOfflineModelDownloadComplete}
      />
    </>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <View style={styles.headerContainer}>{children}</View>;
}

function Footer({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <View style={styles.footerContainer}>{children}</View>;
}

function Body({ children }: { children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  const isWeb = Platform.OS === 'web';
  const blurIntensity = mode === 'dark' ? 15 : 5;
  const opacityHex = Math.round((mode === 'dark' ? 0.4 : 0.65) * 255).toString(16).padStart(2, '0');
  const glassBackground = isWeb ? `${colors.backgroundCard}${opacityHex}` : 'transparent';

  return (
    <View
      style={[
        styles.inputWrapper,
        {
          backgroundColor: glassBackground,
          borderColor: mode === 'dark' ? 'rgba(255,255,255,0.14)' : colors.divider,
          borderWidth: 1,
          overflow: 'hidden',
        },
      ]}
    >
      {!isWeb && (
        <BlurView
          intensity={blurIntensity}
          tint={mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

function Input() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const {
    value,
    onChangeText,
    placeholder,
    isLoading,
    isDisabled,
    isRecording,
    testID,
    textInputRef,
    handleTextInputPress,
  } = useComposerContext();

  return (
    <TextInput
      ref={textInputRef}
      testID={testID}
      style={[styles.input, { color: colors.textPrimary }]}
      placeholder={
        isRecording
          ? t('dream_chat.input.recording_placeholder')
          : placeholder || t('dream_chat.input.placeholder')
      }
      placeholderTextColor={mode === 'dark' ? '#e4def7' : colors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      onPressIn={handleTextInputPress}
      multiline
      maxLength={500}
      editable={!isLoading && !isDisabled && !isRecording}
    />
  );
}

function MicButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRecording, isLoading, isDisabled, toggleRecording, micTestID } = useComposerContext();

  return (
    <Pressable
      style={[
        styles.iconButton,
        { backgroundColor: isRecording ? colors.accent : colors.backgroundCard },
        (isLoading || isDisabled) && styles.buttonDisabled,
      ]}
      onPress={toggleRecording}
      disabled={isLoading || isDisabled}
      accessibilityLabel={isRecording ? t('dream_chat.mic.stop') : t('dream_chat.mic.start')}
      testID={micTestID}
    >
      <Ionicons
        name={isRecording ? 'stop' : 'mic'}
        size={20}
        color={isRecording ? colors.textPrimary : colors.textSecondary}
      />
    </Pressable>
  );
}

function SendButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { canSend, handleSend, sendTestID } = useComposerContext();

  return (
    <Pressable
      style={[
        styles.iconButton,
        { backgroundColor: colors.accent },
        !canSend && styles.buttonDisabled,
      ]}
      onPress={handleSend}
      disabled={!canSend}
      accessibilityRole="button"
      accessibilityLabel={t('dream_chat.send')}
      accessibilityState={{ disabled: !canSend }}
      testID={sendTestID}
    >
      <MaterialCommunityIcons name="send" size={20} color={colors.textPrimary} />
    </Pressable>
  );
}

export const Composer = {
  Root,
  Header,
  Footer,
  Body,
  Input,
  MicButton,
  SendButton,
};

const styles = StyleSheet.create({
  stickyWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  fallbackWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    maxHeight: 100,
    paddingVertical: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  footerContainer: {
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  headerContainer: {
    marginBottom: 12,
  },
});
