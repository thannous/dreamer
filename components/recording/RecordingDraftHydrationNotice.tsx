import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export interface RecordingDraftHydrationNoticeProps {
  hydrationStatus: 'loading' | 'ready' | 'error';
  onRetry: () => void;
  messages: {
    loading: string;
    error: string;
    retry: string;
  };
}

export function RecordingDraftHydrationNotice({
  hydrationStatus,
  onRetry,
  messages,
}: RecordingDraftHydrationNoticeProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isLoading = hydrationStatus === 'loading';

  if (hydrationStatus === 'ready') return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
      ]}
    >
      <Text
        selectable
        accessibilityLiveRegion="polite"
        style={[styles.message, { color: noctalia.text.primary }]}
      >
        {isLoading ? messages.loading : messages.error}
      </Text>
      <Pressable
        onPress={() => {
          if (hydrationStatus === 'error') onRetry();
        }}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={messages.retry}
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
        style={({ pressed }) => [
          styles.retryButton,
          {
            backgroundColor: noctalia.surface.soft,
            borderColor: noctalia.surface.border,
            opacity: isLoading ? 0.55 : pressed ? 0.72 : 1,
          },
        ]}
      >
        <Text style={[styles.retryLabel, { color: noctalia.text.primary }]}>
          {messages.retry}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 16,
    gap: 12,
  },
  message: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
