import { IconSymbol } from '@/components/ui/icon-symbol';
import { NightSkyBand } from '@/components/ui/NightSkyBand';
import type { DreamerScene } from '@/constants/dreamerArtwork';
import { ThemeLayout } from '@/constants/journalTheme';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import React, { type ReactNode, memo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

export interface NoctaliaHeaderAction {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  testID?: string;
}

export interface NoctaliaHeaderChip {
  id: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

interface NoctaliaScreenHeaderProps {
  scene?: DreamerScene;
  titleKey: string;
  prominentTitle?: boolean;
  /**
   * `tab` is the shared header of the main destinations: wordmark and actions on
   * one row, the page title below, the night sky behind it in the dark theme.
   */
  variant?: 'standard' | 'editorial' | 'tab';
  /** Secondary line under the title (`tab` variant only). */
  subtitle?: string;
  /** Paint the night sky behind the `tab` header. Off when the screen draws its own artwork. */
  backdrop?: boolean;
  includeTopInset?: boolean;
  actions?: NoctaliaHeaderAction[];
  chips?: NoctaliaHeaderChip[];
  slot?: ReactNode;
  /** Search or another compact control beside the title when space permits. */
  inlineSlot?: ReactNode;
}

export const NoctaliaScreenHeader = memo(function NoctaliaScreenHeader({
  scene,
  titleKey,
  prominentTitle = false,
  variant = 'standard',
  includeTopInset = true,
  actions = [],
  chips = [],
  slot,
  inlineSlot,
  subtitle,
  backdrop = true,
}: NoctaliaScreenHeaderProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isNarrow = width < 480;
  // Beside the desktop sidebar the wordmark is already on screen.
  const showBrand = !(Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT);
  // Without the wordmark above it, the page title carries the header alone.
  const isProminent = prominentTitle || !showBrand;
  const titleFontScale = Math.min(fontScale, 1.4);
  const brandFontScale = Math.min(fontScale, 1.3);
  const brandTypography = variant === 'editorial' ? styles.editorialBrand : isProminent ? styles.quietBrand : styles.brand;
  const titleTypography = variant === 'editorial' ? styles.editorialTitle : isProminent ? styles.prominentTitle : styles.subtitle;
  // Keep actions beside the title, including enlarged text, whenever both fit.
  const availableTitleWidth = width - (isNarrow ? 32 : 48) - actions.length * 52;
  const stackActions = actions.length > 0 && availableTitleWidth < 110 * titleFontScale;
  const inlineTitleWidth = 120 * titleFontScale;
  // Keep mobile search full-width and stable across native text-size changes.
  const canInlineSlot = Boolean(inlineSlot) && !isNarrow && availableTitleWidth - 32
    >= inlineTitleWidth + 140 * titleFontScale;
  const wrapInlineSlot = Boolean(inlineSlot) && !canInlineSlot;
  const wrapTitle = stackActions || titleFontScale >= 1.3;
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const iconButtonBg = noctalia.surface.soft;
  const quietIconColor = noctalia.text.secondary;
  const [measuredHeight, setMeasuredHeight] = useState(0);

  if (variant === 'tab') {
    const tabTitleScale = Math.min(fontScale, 1.3);
    // Same gutter as the Today hero; only the narrowest phones tighten it.
    const horizontalPadding = width <= 360 ? ThemeLayout.spacing.md : ThemeLayout.spacing.lg;
    return (
      <View
        onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
        style={[styles.tabContainer, { paddingTop: (includeTopInset ? insets.top : 0) + ThemeLayout.spacing.md }]}
      >
        {/* One treatment on every tab: the screen's painting (or the night sky) fills the whole
            header from the top of the screen, status bar included, and fades into the page. */}
        {/* A screen that paints its own top (backdrop={false}) passes the scene to that painting instead. */}
        {backdrop ? (
          <NightSkyBand height={(measuredHeight || insets.top + 160) + 40} background={noctalia.screen.background}
            scene={scene} />
        ) : null}
        <View style={[styles.tabBrandRow, { paddingHorizontal: horizontalPadding }]}>
          {showBrand ? (
            <View style={styles.tabBrand} accessible accessibilityLabel="Noctalia">
              <IconSymbol name="moon.stars.fill" size={22} color={noctalia.accent.text} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.tabBrandText, {
                  color: noctalia.text.primary,
                  fontSize: styles.tabBrandText.fontSize * brandFontScale,
                  lineHeight: styles.tabBrandText.lineHeight * brandFontScale,
                }]}
              >
                Noctalia
              </Text>
            </View>
          ) : <View style={styles.tabBrand} />}
          {actions.length > 0 ? (
            <View style={styles.headerActions}>
              {actions.map((action) => (
                <Pressable
                  key={action.accessibilityLabel}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.tabIconButton,
                    { backgroundColor: action.active ? noctalia.action.primary : iconButtonBg },
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel}
                  testID={action.testID}
                >
                  <IconSymbol
                    name={action.icon}
                    size={22}
                    color={action.active ? noctalia.action.primaryText : noctalia.text.primary}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: horizontalPadding }}>
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            style={[styles.tabTitle, {
              color: noctalia.text.primary,
              fontSize: styles.tabTitle.fontSize * tabTitleScale,
              lineHeight: styles.tabTitle.lineHeight * tabTitleScale,
            }]}
            numberOfLines={tabTitleScale >= 1.3 ? undefined : 1}
            adjustsFontSizeToFit={tabTitleScale < 1.3}
            minimumFontScale={0.8}
          >
            {t(titleKey)}
          </Text>
          {subtitle ? (
            <Text style={[styles.tabSubtitle, { color: noctalia.text.secondary }]} maxFontSizeMultiplier={1.6}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {inlineSlot ? <View style={{ paddingHorizontal: horizontalPadding }}>{inlineSlot}</View> : null}
        {slot ? <View style={styles.slot}>{slot}</View> : null}
      </View>
    );
  }

  return (
    <View onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
      style={[styles.container, isProminent && styles.prominentContainer, variant === 'editorial' && styles.editorialContainer, { paddingTop: (includeTopInset ? insets.top : 0) + ThemeLayout.spacing.sm, borderBottomColor: noctalia.surface.border }]}>
      {/* Same as the tab header: the painting fills the header from the top of the screen. */}
      {scene && backdrop ? <NightSkyBand height={(measuredHeight || insets.top + 160) + 40} background={noctalia.screen.background} scene={scene} /> : null}
      <View style={[styles.titleRow, isNarrow && styles.titleRowNarrow, stackActions && styles.titleRowStacked, wrapInlineSlot && styles.searchRowWrapped]}>
        <View style={[styles.titleBlock, stackActions && styles.titleBlockStacked,
          Boolean(inlineSlot) && (canInlineSlot
            ? { flex: 0, flexBasis: 'auto', width: inlineTitleWidth }
            : { flex: 0, flexBasis: 'auto', width: '100%', paddingRight: stackActions ? 0 : actions.length * 52 }),
        ]}>
          {showBrand ? <Text
            style={[styles.brand, isProminent && styles.quietBrand, variant === 'editorial' && styles.editorialBrand, {
              color: noctalia.text.primary,
              fontSize: brandTypography.fontSize * brandFontScale,
              lineHeight: brandTypography.lineHeight * brandFontScale,
            }]}
            allowFontScaling={false}
            numberOfLines={wrapTitle ? undefined : 1}
            adjustsFontSizeToFit={!wrapTitle}
            minimumFontScale={0.84}
          >
            Noctalia
          </Text> : null}
          <Text
            accessibilityRole={isProminent || variant === 'editorial' ? 'header' : undefined}
            allowFontScaling={false}
            style={[styles.subtitle, isProminent && styles.prominentTitle, variant === 'editorial' && styles.editorialTitle, {
              color: isProminent || variant === 'editorial' ? noctalia.text.primary : noctalia.text.secondary,
              fontSize: titleTypography.fontSize * titleFontScale,
              lineHeight: titleTypography.lineHeight * titleFontScale,
            }]}
            numberOfLines={wrapTitle ? undefined : 1}
            adjustsFontSizeToFit={!wrapTitle}
            minimumFontScale={0.84}
          >
            {t(titleKey)}
          </Text>
        </View>
        {inlineSlot ? (
          <View style={[styles.inlineSlot, wrapInlineSlot && styles.inlineSlotWrapped]}>
            {inlineSlot}
          </View>
        ) : null}
        {actions.length > 0 ? (
          <View style={[styles.headerActions, variant === 'editorial' && styles.editorialActions, isNarrow && styles.headerActionsNarrow, stackActions && styles.headerActionsStacked,
            wrapInlineSlot && !stackActions && { position: 'absolute', top: 0, right: isNarrow ? 16 : 24 },
          ]}>
            {actions.map((action) => (
              <Pressable
                key={action.accessibilityLabel}
                onPress={action.onPress}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: action.active ? noctalia.action.primary : iconButtonBg,
                    borderColor: action.active ? noctalia.action.primaryBorder : noctalia.surface.border,
                  },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                testID={action.testID}
              >
                <IconSymbol
                  name={action.icon}
                  size={20}
                  color={action.active ? noctalia.action.primaryText : quietIconColor}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {slot ? <View style={styles.slot}>{slot}</View> : null}

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <View style={[styles.chipsRow, Platform.OS === 'web' ? webMaxContentStyle : null]}>
            {chips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={chip.onPress}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: chip.active ? noctalia.action.primary : iconButtonBg,
                    borderColor: chip.active ? noctalia.action.primaryBorder : noctalia.surface.border,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={chip.accessibilityLabel ?? chip.label}
                testID={chip.testID}
              >
                <IconSymbol
                  name={chip.icon}
                  size={17}
                  color={chip.active ? noctalia.action.primaryText : quietIconColor}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.chipText,
                    {
                      color: chip.active ? noctalia.action.primaryText : noctalia.text.secondary,
                      fontSize: styles.chipText.fontSize * brandFontScale,
                      lineHeight: styles.chipText.lineHeight * brandFontScale,
                    },
                    Platform.OS === 'web' ? webNowrapStyle : null,
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
});

const webMaxContentStyle = { width: 'max-content' } as unknown as ViewStyle;
const webNowrapStyle = { whiteSpace: 'nowrap' } as unknown as TextStyle;

const styles = StyleSheet.create({
  tabContainer: {
    gap: ThemeLayout.spacing.sm,
    paddingBottom: ThemeLayout.spacing.md,
  },
  tabBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.md,
  },
  tabBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
  },
  tabBrandText: {
    flexShrink: 1,
    fontFamily: Fonts.fraunces.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  tabIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 38,
    lineHeight: 46,
  },
  tabSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  editorialContainer: { borderBottomWidth: 0 },
  editorialBrand: { fontSize: 18, lineHeight: 24, marginBottom: 8 },
  editorialTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 28, lineHeight: 36, opacity: 1 },
  editorialActions: { alignSelf: 'flex-start' },
  container: {
    gap: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prominentContainer: { borderBottomWidth: 0 },
  quietBrand: { fontSize: 18, lineHeight: 24 },
  prominentTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 28,
    lineHeight: 36,
    opacity: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.md,
    paddingHorizontal: ThemeLayout.spacing.lg,
  },
  titleRowNarrow: {
    gap: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  titleRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  titleBlockStacked: {
    flex: 0,
    width: '100%',
  },
  brand: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
    lineHeight: 21,
  },
  headerActions: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.md,
    flexShrink: 0,
  },
  headerActionsNarrow: {
    gap: ThemeLayout.spacing.sm,
  },
  headerActionsStacked: {
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRowWrapped: {
    flexWrap: 'wrap',
  },
  inlineSlot: {
    flex: 1,
    minWidth: 0,
  },
  inlineSlotWrapped: {
    flexBasis: '100%',
    width: '100%',
  },
  slot: {
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  chipsScroll: {
    flexGrow: 0,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    gap: 7,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
    flexGrow: 0,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.76,
  },
});
