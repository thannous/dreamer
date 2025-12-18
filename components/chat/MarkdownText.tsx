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

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as Linking from 'expo-linking';
import { useTheme } from '@/context/ThemeContext';
import { createMarkdownStyles } from '@/constants/markdownStyles';

interface MarkdownTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Allowed URL schemes for security
 */
const ALLOWED_SCHEMES = ['https', 'http', 'mailto', 'tel'];

const SCHEME_REGEX = /^([a-z][a-z0-9+.-]*):/i;

const getScheme = (url: string): string | null => {
  const match = SCHEME_REGEX.exec(url.trim());
  return match?.[1]?.toLowerCase() ?? null;
};

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
  const [renderError, setRenderError] = useState(false);

  // Create markdown styles once (memoized)
  const markdownStyles = useMemo(() => {
    return createMarkdownStyles(colors);
  }, [colors]);

  // Handle markdown link clicks with security validation
  const handleLinkPress = useCallback(
    (url: string) => {
      // Validate URL scheme
      if (!isAllowedScheme(url)) {
        console.warn(`[MarkdownText] Blocked unsafe URL scheme: ${url}`);
        return false;
      }

      // Open URL asynchronously without blocking
      (async () => {
        try {
          // Check if the device can open this URL
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            console.warn(`[MarkdownText] Device cannot open URL: ${url}`);
          }
        } catch (error) {
          console.warn(`[MarkdownText] Error opening URL: ${url}`, error);
        }
      })();

      // Return false to prevent default behavior (synchronously)
      return false;
    },
    []
  );

  // Fallback to plain text if markdown rendering fails
  if (renderError) {
    return (
      <Text style={[styles.plainText, style]}>
        {children}
      </Text>
    );
  }

  try {
    return (
      <View style={styles.container}>
        <Markdown
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
    );
  } catch (error) {
    // Render error handler
    console.error('[MarkdownText] Markdown rendering error:', error);
    setRenderError(true);
    return (
      <Text style={[styles.plainText, style]}>
        {children}
      </Text>
    );
  }
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
