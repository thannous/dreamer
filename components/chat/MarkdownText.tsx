/**
 * MarkdownText - Secure markdown renderer for chat messages
 *
 * Features:
 * - Theme-aware styling (light/dark modes)
 * - Secure link handling with allowlist (https, http, mailto, tel)
 * - Disabled HTML and image rendering (XSS prevention)
 * - Error boundary with fallback to plain text
 * - Memoized component to prevent re-renders on scroll
 */

import React, { useCallback, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import * as Linking from 'expo-linking';
import { useTheme } from '@/context/ThemeContext';
import { createMarkdownStyles } from '@/constants/markdownStyles';
import {
  SECURE_MARKDOWN_OPTIONS,
  shouldRenderMarkdown,
} from '@/lib/markdownSecurity';

interface MarkdownTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Allowed URL schemes for security
 */
const ALLOWED_SCHEMES = ['https', 'http', 'mailto', 'tel'];

const SCHEME_REGEX = /^([a-z][a-z0-9+.-]*):/i;
const markdownParser = MarkdownIt(SECURE_MARKDOWN_OPTIONS);

interface MarkdownErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
}

interface MarkdownErrorBoundaryState {
  failed: boolean;
  resetKey: string;
}

class MarkdownErrorBoundary extends React.Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  state: MarkdownErrorBoundaryState = {
    failed: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(): Partial<MarkdownErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: MarkdownErrorBoundaryProps,
    state: MarkdownErrorBoundaryState
  ): Partial<MarkdownErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { failed: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('[MarkdownText] Markdown rendering error', {
        error,
        componentStack: info.componentStack,
      });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const getScheme = (url: string): string | null => {
  const match = SCHEME_REGEX.exec(url.trim());
  return match?.[1]?.toLowerCase() ?? null;
};

/**
 * Security: never log full user-provided URLs in production.
 * They can contain sensitive query params (auth tokens), emails, or phone numbers.
 */
function getSafeUrlForLog(url: string): string {
  const scheme = getScheme(url) ?? 'unknown';

  if (scheme === 'http' || scheme === 'https') {
    const match = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
    const host = match?.[1]?.split('@').pop();
    return host ? `${scheme}://${host}/…` : `${scheme}://[redacted]`;
  }

  return `${scheme}:[redacted]`;
}

/**
 * Check if URL scheme is allowed
 */
function isAllowedScheme(url: string): boolean {
  const scheme = getScheme(url);
  return scheme != null && ALLOWED_SCHEMES.includes(scheme);
}

/**
 * MarkdownText - Renders markdown with theme-aware styling and security
 */
const MarkdownTextComponent: React.FC<MarkdownTextProps> = ({ children, style }) => {
  const { colors } = useTheme();

  // Create markdown styles once (memoized)
  const markdownStyles = useMemo(() => {
    return createMarkdownStyles(colors);
  }, [colors]);

  // Handle markdown link clicks with security validation
  const handleLinkPress = useCallback(
    (url: string) => {
      // Validate URL scheme
      if (!isAllowedScheme(url)) {
        const scheme = getScheme(url) ?? 'unknown';
        console.warn(`[MarkdownText] Blocked unsafe URL scheme: ${scheme}`);
        return false;
      }

      // Open URL asynchronously without blocking
      (async () => {
        const urlForLog = __DEV__ ? url : getSafeUrlForLog(url);
        try {
          // Check if the device can open this URL
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            console.warn(`[MarkdownText] Device cannot open URL: ${urlForLog}`);
          }
        } catch (error) {
          console.warn(`[MarkdownText] Error opening URL: ${urlForLog}`, error);
        }
      })();

      // Return false to prevent default behavior (synchronously)
      return false;
    },
    []
  );

  // Fallback to plain text if markdown rendering fails
  const fallback = (
    <Text style={[styles.plainText, style]}>
      {children}
    </Text>
  );

  if (!shouldRenderMarkdown(children)) {
    if (__DEV__) {
      console.warn('[MarkdownText] Oversized input rendered as plain text', {
        length: children.length,
      });
    }
    return (
      fallback
    );
  }

  return (
    <MarkdownErrorBoundary fallback={fallback} resetKey={children}>
      <View style={styles.container}>
        <Markdown
          markdownit={markdownParser}
          style={markdownStyles}
          onLinkPress={handleLinkPress}
          rules={{
            // Disable potentially unsafe elements
            image: () => null,
            html_block: () => null,
            html_inline: () => null,
          }}
        >
          {children}
        </Markdown>
      </View>
    </MarkdownErrorBoundary>
  );
};

/**
 * Memoized component to prevent re-renders on scroll
 * Only re-renders if children or style props change
 */
export const MarkdownText = React.memo(MarkdownTextComponent, (prevProps, nextProps) => {
  return prevProps.children === nextProps.children && prevProps.style === nextProps.style;
});

MarkdownText.displayName = 'MarkdownText';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  plainText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
