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
import { startNativeSpeechSession, type NativeSpeechSession } from '@/services/nativeSpeechRecognition';
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
  onSend: () => void;
  placeholder?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  transcriptionLocale?: string;
  testID?: string;
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
}: ComposerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { composerHeight } = useComposerHeightContext();
  // Keyboard state available for future use (e.g., adjusting UI based on keyboard)
  useKeyboardStateContext();

  const [isRecording, setIsRecording] = useState(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const baseInputRef = useRef('');
  const containerRef = useRef<View>(null);
  const localHeight = useSharedValue(0);

  // Track composer height for contentInset
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    localHeight.set(height);
    // Update shared context value on UI thread
    runOnUI(() => {
      'worklet';
      composerHeight.set(height);
    })();
  }, [composerHeight, localHeight]);

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

  const stopRecording = useCallback(async () => {
    const nativeSession = nativeSessionRef.current;
    nativeSessionRef.current = null;
    setIsRecording(false);

    if (!nativeSession) return;

    try {
      const result = await nativeSession.stop();
      const transcript = result.transcript?.trim();

      if (transcript) {
        const base = baseInputRef.current.trim();
        onChangeText(base ? `${base} ${transcript}` : transcript);
      } else {
        const normalizedError = result.error?.toLowerCase();
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
  }, [onChangeText, t]);

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

  const canSend = value.trim().length > 0 && !isLoading && !isDisabled;

  const composerContent = (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        { backgroundColor: colors.backgroundDark },
        animatedContainerStyle,
      ]}
      onLayout={handleLayout}
    >
      <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary }]}>
        <TextInput
          testID={testID}
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder={
            isRecording
              ? t('dream_chat.input.recording_placeholder')
              : placeholder || t('dream_chat.input.placeholder')
          }
          placeholderTextColor={colors.textSecondary}
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
          onPress={onSend}
          disabled={!canSend}
        >
          <MaterialCommunityIcons name="send" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
    </Animated.View>
  );

  // Wrap with KeyboardStickyView if available (iOS)
  if (Platform.OS === 'ios' && KeyboardStickyView) {
    return (
      <KeyboardStickyView
        style={styles.stickyWrapper}
        offset={{ closed: -insets.bottom, opened: -8 }}
      >
        {composerContent}
      </KeyboardStickyView>
    );
  }

  // Fallback for Android or when KeyboardStickyView not available
  return (
    <View style={[styles.fallbackWrapper, { paddingBottom: insets.bottom }]}>
      {composerContent}
    </View>
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
