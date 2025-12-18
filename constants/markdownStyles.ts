/**
 * Markdown styles for react-native-markdown-display
 * Theme-aware styling for markdown elements in chat messages
 */

import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { Fonts } from './theme';
import type { ThemeColors } from './journalTheme';

interface MarkdownStyles {
  [key: string]: TextStyle | ViewStyle;
}

/**
 * Create theme-aware markdown styles
 * @param colors - Theme colors (DarkTheme or LightTheme)
 * @returns StyleSheet of markdown element styles
 */
export function createMarkdownStyles(colors: ThemeColors): MarkdownStyles {
  return StyleSheet.create({
    // Document body
    body: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: Fonts.spaceGrotesk.regular,
      lineHeight: 20,
    },

    // Headings
    heading1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      lineHeight: 32,
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      lineHeight: 28,
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      color: colors.textPrimary,
      fontSize: 17,
      fontFamily: Fonts.spaceGrotesk.medium,
      fontWeight: '500',
      lineHeight: 24,
      marginTop: 8,
      marginBottom: 4,
    },
    heading4: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: Fonts.spaceGrotesk.medium,
      fontWeight: '500',
      lineHeight: 21,
      marginTop: 6,
      marginBottom: 3,
    },
    heading5: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      lineHeight: 20,
      marginTop: 4,
      marginBottom: 2,
    },
    heading6: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 2,
      marginBottom: 0,
    },

    // Paragraph
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      lineHeight: 20,
    },

    // Inline formatting
    strong: {
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    em: {
      fontFamily: Fonts.spaceGrotesk.regular,
      fontStyle: 'italic',
      color: colors.textPrimary,
    },
    s: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },

    // Links
    link: {
      color: colors.accent,
      textDecorationLine: 'underline',
    },

    // Code
    code_inline: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.accent,
      fontFamily: Platform.select({
        ios: Fonts.mono,
        default: 'monospace',
      }) as any,
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },

    // Code block
    fence: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.textPrimary,
      fontFamily: Platform.select({
        ios: Fonts.mono,
        default: 'monospace',
      }) as any,
      fontSize: 12,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      lineHeight: 18,
    },

    // Lists
    bullet_list: {
      marginTop: 4,
      marginBottom: 8,
    },
    ordered_list: {
      marginTop: 4,
      marginBottom: 8,
    },
    list_item: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    list_item_bullet: {
      color: colors.accent,
      marginRight: 8,
    },
    list_item_number: {
      color: colors.accent,
      marginRight: 8,
    },

    // Blockquote
    blockquote: {
      backgroundColor: colors.backgroundSecondary,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      paddingLeft: 12,
      paddingRight: 12,
      paddingVertical: 8,
      marginVertical: 8,
      marginHorizontal: 0,
    },

    // Horizontal rule
    hr: {
      backgroundColor: colors.divider,
      height: 1,
      marginVertical: 8,
    },

    // Tables (if supported)
    table: {
      borderWidth: 1,
      borderColor: colors.divider,
      marginVertical: 8,
    },
    tableHeader: {
      backgroundColor: colors.backgroundSecondary,
    },
    tableHeaderCell: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: Fonts.spaceGrotesk.bold,
      fontWeight: '700',
      padding: 8,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    tableRowCell: {
      flex: 1,
      color: colors.textPrimary,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.divider,
    },
  });
}
