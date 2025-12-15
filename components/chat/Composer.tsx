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

import { Fonts } from '@/constants/theme';
import { useComposerHeightContext, useKeyboardStateContext } from '@/context/ChatContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguagePackMissingSheet } from '@/components/speech/LanguagePackMissingSheet';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import {
  getSpeechLocaleAvailability,
  startNativeSpeechSession,
  ensureOfflineSttModel,
  registerOfflineModelPromptHandler,
  type NativeSpeechSession,
  type OfflineModelPromptHandler,
} from '@/services/nativeSpeechRecognition';
import {
  openGoogleVoiceSettingsBestEffort,
  openSpeechRecognitionLanguageSettings,
} from '@/lib/speechRecognitionSettings';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AudioModule } from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { transcribeAudio } from '@/services/speechToText';
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

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text?: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  transcriptionLocale?: string;
  testID?: string;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  micTestID?: string;
  sendTestID?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder,
  isLoading = false,
  isDisabled = false,
  transcriptionLocale = 'en-US',
  testID,
  headerContent,
  footerContent,
  micTestID,
  sendTestID,
}: ComposerProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { composerHeight } = useComposerHeightContext();
  const { keyboardHeight } = useKeyboardStateContext();

  const [isRecording, setIsRecording] = useState(false);
  const [languagePackMissingInfo, setLanguagePackMissingInfo] = useState<{
    locale: string;
    installedLocales: string[];
  } | null>(null);
  const [showOfflineModelSheet, setShowOfflineModelSheet] = useState(false);
  const [offlineModelLocale, setOfflineModelLocale] = useState('');
  const offlineModelPromptResolveRef = useRef<(() => void) | null>(null);
  const offlineModelPromptPromiseRef = useRef<Promise<void> | null>(null);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const baseInputRef = useRef('');
  const containerRef = useRef<View>(null);
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

  const handleOfflineModelDownloadComplete = useCallback((_success: boolean) => undefined, []);

  // Register offline model prompt handler
  useEffect(() => {
    const handler: OfflineModelPromptHandler = {
      isVisible: showOfflineModelSheet,
      show: handleOfflineModelPromptShow,
    };
    registerOfflineModelPromptHandler(handler);
  }, [handleOfflineModelPromptShow, showOfflineModelSheet]);

  useEffect(() => {
    return () => {
      resolveOfflineModelPrompt();
    };
  }, [resolveOfflineModelPrompt]);

  // Cleanup speech session on unmount
  useEffect(() => {
    return () => {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
    };
  }, []);

  // Speech-to-text handlers
  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
        return;
      }

      // Ensure offline STT model is available (Android 13+)
      const modelReady = await ensureOfflineSttModel(transcriptionLocale);

      // Block on Android 13+ if user cancelled/declined the download
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33 && !modelReady) {
        if (__DEV__) {
          console.log('[Composer] offline model not ready, aborting start');
        }
        return;
      }

      const localeAvailability = await getSpeechLocaleAvailability(transcriptionLocale);
      if (localeAvailability?.installedLocales.length && !localeAvailability.isInstalled) {
        setLanguagePackMissingInfo({
          locale: transcriptionLocale,
          installedLocales: localeAvailability.installedLocales,
        });
        return;
      }

      nativeSessionRef.current?.abort();
      baseInputRef.current = value;

      const session = await startNativeSpeechSession(transcriptionLocale, {
        onPartial: (text) => {
          const base = baseInputRef.current.trim();
          onChangeText(base ? `${base} ${text}` : text);
        },
      });

      if (!session) {
        Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
        return;
      }

      nativeSessionRef.current = session;
      setIsRecording(true);
    } catch {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
      setIsRecording(false);
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    }
  }, [value, transcriptionLocale, onChangeText, t]);

  const stopRecording = useCallback(async (): Promise<string | undefined> => {
    const nativeSession = nativeSessionRef.current;
    nativeSessionRef.current = null;
    setIsRecording(false);

    if (!nativeSession) return value;

    try {
      const result = await nativeSession.stop();
      const transcript = result.transcript?.trim();

      if (transcript) {
        const base = baseInputRef.current.trim();
        const finalText = base ? `${base} ${transcript}` : transcript;
        onChangeText(finalText);
        return finalText;
      } else {
        const normalizedError = result.error?.toLowerCase();
        const isRateLimited =
          result.errorCode === 'too-many-requests' ||
          normalizedError?.includes('too many requests') ||
          false;
        const isLanguagePackMissing =
          result.errorCode === 'language-not-supported' ||
          normalizedError?.includes('language-not-supported') ||
          normalizedError?.includes('not yet downloaded') ||
          false;
        const recordedUri = result.recordedUri ?? undefined;

        if (isRateLimited && recordedUri) {
          try {
            const fallbackTranscript = await transcribeAudio({
              uri: recordedUri,
              languageCode: transcriptionLocale,
            });
            if (fallbackTranscript?.trim()) {
              const base = baseInputRef.current.trim();
              const finalText = base ? `${base} ${fallbackTranscript.trim()}` : fallbackTranscript.trim();
              onChangeText(finalText);
              return finalText;
            }
          } catch {
            // ignore and continue to other handling
          }
        }
        if (isRateLimited) {
          Alert.alert(t('common.error_title'), t('error.rate_limit'));
          return;
        }
        if (isLanguagePackMissing) {
          const availability = await getSpeechLocaleAvailability(transcriptionLocale);
          setLanguagePackMissingInfo({
            locale: transcriptionLocale,
            installedLocales: availability?.installedLocales ?? [],
          });
          return baseInputRef.current;
        }
        if (!normalizedError?.includes('no speech')) {
          Alert.alert(
            t('recording.alert.no_speech.title'),
            t('recording.alert.no_speech.message')
          );
        }
      }
    } catch {
      // Silent fail on stop
    }
    return baseInputRef.current;
  }, [onChangeText, transcriptionLocale, t, value]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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

  const canSend = value.trim().length > 0 && !isLoading && !isDisabled;

  const handleSend = useCallback(async () => {
    let textOverride: string | undefined;
    if (isRecording) {
      textOverride = await stopRecording();
    }
    baseInputRef.current = '';
    onSend(textOverride?.trim());
  }, [isRecording, onSend, stopRecording]);

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
      {footerContent ? (
        <View style={styles.footerContainer}>
          {footerContent}
        </View>
      ) : null}
      {headerContent ? (
        <View style={styles.headerContainer}>
          {headerContent}
        </View>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: mode === 'dark' ? colors.backgroundCard : colors.backgroundSecondary,
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.14)' : colors.divider,
            borderWidth: 1,
          },
        ]}
      >
        <TextInput
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
          multiline
          maxLength={500}
          editable={!isLoading && !isDisabled && !isRecording}
        />

        {/* Mic button */}
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

        {/* Send button */}
        <Pressable
          style={[
            styles.iconButton,
            { backgroundColor: colors.accent },
            !canSend && styles.buttonDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend}
          testID={sendTestID}
        >
          <MaterialCommunityIcons name="send" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
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
