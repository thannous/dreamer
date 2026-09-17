import React, { useCallback, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import remend from 'remend';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { createMarkdownStyles } from '@/constants/markdownStyles';
import { sanitizeMarkdown, isAllowedMarkdownUrl, shouldRenderMarkdown } from '@/lib/markdownSecurity';

interface MarkdownTextProps extends Pick<ViewProps, 'testID' | 'accessibilityLiveRegion'> {
  children: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  variant?: 'body' | 'reading';
  tone?: 'default' | 'onAccent';
  isStreaming?: boolean;
  selectable?: boolean;
}

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


/** Shared native/Web renderer. Never write repaired streaming text back to the dream. */
export const MarkdownText = React.memo(function MarkdownText({
  children, style, containerStyle, variant = 'body', tone = 'default', isStreaming = false, selectable = true, ...rest
}: MarkdownTextProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const palette = useMemo(() => tone === 'onAccent' ? { ...colors, textPrimary: colors.textOnAccentSurface, accentText: colors.textOnAccentSurface, backgroundSecondary: colors.accentLight, backgroundCard: colors.accent, divider: colors.accentDark } : colors, [colors, tone]);
  const textStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const markdownStyle = useMemo(() => createMarkdownStyles(palette, textStyle, variant), [palette, textStyle, variant]);
  const canRender = shouldRenderMarkdown(children);
  const markdown = useMemo(() => {
    if (!canRender) return null;
    try {
      return sanitizeMarkdown(isStreaming ? remend(children, { linkMode: 'text-only', htmlTags: false, images: false, katex: false }) : children);
    } catch {
      return null;
    }
  }, [canRender, children, isStreaming]);
  const onLinkPress = useCallback(({ url }: { url: string }) => {
    if (!isAllowedMarkdownUrl(url)) return;
    void Linking.canOpenURL(url).then((allowed) => allowed ? Linking.openURL(url) : undefined)
      .catch(() => { /* A link failure must not interrupt reading or expose its URL in logs. */ });
  }, []);
  const fallback = <Text selectable={selectable} style={[{ color: palette.textPrimary, fontSize: 16, lineHeight: 24 }, style]}>{children}</Text>;
  return (
    <View {...rest} style={[{ alignSelf: 'stretch' }, containerStyle]}>
      {markdown === null ? fallback : (
        <MarkdownErrorBoundary fallback={fallback} resetKey={children}>
          <EnrichedMarkdownText
            markdown={markdown}
            markdownStyle={markdownStyle}
            flavor="github"
            selectable={selectable}
            allowFontScaling
            enableLinkPreview={false}
            enableTaskListItemToggle={false}
            onLinkPress={onLinkPress}
            onLinkLongPress={onLinkPress}
            md4cFlags={{ latexMath: false }}
            spoilerOverlay="solid"
            selectionMenuConfig={{ copy: { label: t('common.copy') }, copyAsMarkdown: { enabled: false }, copyImageUrl: { enabled: false } }}
          />
        </MarkdownErrorBoundary>
      )}
    </View>
  );
});
