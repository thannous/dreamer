import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurrealTheme, Fonts } from '@/constants/theme';

interface ImageRetryProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function ImageRetry({ onRetry, isRetrying = false }: ImageRetryProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="image-outline" size={64} color={SurrealTheme.textMuted} />
        {!isRetrying && (
          <View style={styles.errorBadge}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
          </View>
        )}
      </View>

      <Text style={styles.title}>Image Generation Failed</Text>
      <Text style={styles.message}>
        We couldn&apos;t generate an image for this dream. You can try again to create dream imagery.
      </Text>

      <Pressable
        style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
        onPress={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.retryButtonText}>Generating...</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry Image Generation</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: SurrealTheme.darkAccent,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SurrealTheme.shape,
    borderStyle: 'dashed',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  errorBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: SurrealTheme.darkAccent,
    borderRadius: 12,
    padding: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: SurrealTheme.textLight,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: SurrealTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SurrealTheme.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: SurrealTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
