import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }): React.ReactElement {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
      <Text style={[styles.title, { color: noctalia.text.primary }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: noctalia.text.secondary }]}>{error.message}</Text>
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: noctalia.action.primary,
            borderColor: noctalia.action.primaryBorder,
          },
        ]}
        onPress={resetError}
      >
        <Text style={[styles.buttonText, { color: noctalia.action.primaryText }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
