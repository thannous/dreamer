import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type AccessibilityRole,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useOptionalLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function LucidScreen({
  children,
  eyebrow,
  title,
  subtitle,
  trailing,
  scroll = true,
  contentStyle,
  testID,
  ...scrollProps
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  trailing?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
} & Omit<ScrollViewProps, 'contentContainerStyle'>) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const insets = useSafeAreaInsets();
  const content = (
    <ScreenContainer style={styles.screenContainer} maxWidth={760}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 18) + 12,
            paddingBottom: Math.max(insets.bottom, 20) + 112,
          },
          contentStyle,
        ]}
      >
        {(eyebrow || title || subtitle || trailing) && (
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              {eyebrow ? (
                <Text style={[styles.eyebrow, { color: palette.cyan }]}>{eyebrow}</Text>
              ) : null}
              {title ? (
                <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>
            {trailing}
          </View>
        )}
        {children}
      </View>
    </ScreenContainer>
  );

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={
          mode === 'dark'
            ? ['rgba(105,82,190,0.25)', 'rgba(12,18,36,0)', 'rgba(23,91,96,0.12)']
            : ['rgba(140,116,214,0.16)', 'rgba(246,246,251,0)', 'rgba(67,164,157,0.09)']
        }
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

export function LucidCard({
  children,
  style,
  accent = 'none',
  onPress,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: 'none' | 'violet' | 'cyan' | 'amber';
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const reduceMotion =
    useOptionalLucidTrainer()?.state?.onboarding.accessibility.reduceMotion ?? false;
  const accentColor =
    accent === 'violet'
      ? palette.accent
      : accent === 'cyan'
        ? palette.cyan
        : accent === 'amber'
          ? palette.amber
          : palette.border;
  const cardStyle = [
    styles.card,
    {
      backgroundColor: palette.surface,
      borderColor: accent === 'none' ? palette.border : `${accentColor}77`,
    },
    style,
  ];

  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        cardStyle,
        pressed && (reduceMotion ? styles.pressedWithoutMotion : styles.pressed),
      ]}
    >
      {children}
    </Pressable>
  );
}

export function LucidButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const foreground = primary ? palette.backgroundDeep : danger ? palette.danger : palette.text;
  const background = primary
    ? palette.accentStrong
    : danger
      ? `${palette.danger}18`
      : variant === 'secondary'
        ? palette.surfaceRaised
        : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: danger ? `${palette.danger}66` : primary ? palette.accentStrong : palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} color={foreground} size={19} /> : null}
          <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function LucidSectionHeader({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        {caption ? <Text style={[styles.sectionCaption, { color: palette.textSecondary }]}>{caption}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function LucidPill({ label, tone = 'violet', icon }: { label: string; tone?: 'violet' | 'cyan' | 'amber' | 'neutral'; icon?: IconName }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const color = tone === 'cyan' ? palette.cyan : tone === 'amber' ? palette.amber : tone === 'neutral' ? palette.textSecondary : palette.accent;
  const bg = tone === 'cyan' ? palette.cyanSoft : tone === 'amber' ? palette.amberSoft : tone === 'neutral' ? palette.surfaceRaised : palette.accentSoft;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function LucidProgressBar({ value, accessibilityLabel }: { value: number; accessibilityLabel?: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const normalized = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalized * 100) }}
      style={[styles.progressTrack, { backgroundColor: palette.surfaceRaised }]}
    >
      <View style={[styles.progressFill, { backgroundColor: palette.cyan, width: `${normalized * 100}%` }]} />
    </View>
  );
}

export function LucidMetric({ value, label, tone = 'violet' }: { value: string; label: string; tone?: 'violet' | 'cyan' | 'amber' }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const color = tone === 'cyan' ? palette.cyan : tone === 'amber' ? palette.amber : palette.accent;
  return (
    <View style={[styles.metric, { backgroundColor: palette.surfaceRaised }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function LucidChoiceCard({
  title,
  description,
  selected,
  onPress,
  icon,
  testID,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surface,
          borderColor: selected ? palette.accent : palette.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={[styles.choiceIcon, { backgroundColor: selected ? `${palette.accent}22` : palette.surfaceRaised }]}>
          <Ionicons name={icon} size={21} color={selected ? palette.accent : palette.textSecondary} />
        </View>
      ) : null}
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, { color: palette.text }]}>{title}</Text>
        {description ? <Text style={[styles.choiceDescription, { color: palette.textSecondary }]}>{description}</Text> : null}
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? palette.accent : palette.textMuted} />
    </Pressable>
  );
}

export function LucidToggleRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  icon,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={[styles.toggleRow, { borderBottomColor: palette.border }]}>
      {icon ? <Ionicons name={icon} size={21} color={palette.accent} /> : null}
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: palette.text }]}>{title}</Text>
        {description ? <Text style={[styles.toggleDescription, { color: palette.textSecondary }]}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        onValueChange={onValueChange}
        value={value}
        trackColor={{ false: palette.surfaceMuted, true: palette.accent }}
        thumbColor={mode === 'dark' ? '#F7F5FF' : '#FFFFFF'}
      />
    </View>
  );
}

export function LucidIconAction({ label, icon, onPress, role = 'button' }: { label: string; icon: IconName; onPress: () => void; role?: AccessibilityRole }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconAction, { backgroundColor: palette.surfaceRaised, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={21} color={palette.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContainer: { flex: 1 },
  content: { width: '100%', paddingHorizontal: 20, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 2 },
  headerCopy: { flex: 1, gap: 7 },
  eyebrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 13 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  pressedWithoutMotion: { opacity: 0.82 },
  button: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, lineHeight: 26 },
  sectionCaption: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
  pill: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, letterSpacing: 0.25 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  metric: { flex: 1, minWidth: 92, borderRadius: 18, padding: 14, gap: 3 },
  metricValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, lineHeight: 31 },
  metricLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, lineHeight: 16 },
  choice: { minHeight: 78, borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, gap: 3 },
  choiceTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, lineHeight: 20 },
  choiceDescription: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 18 },
  toggleRow: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  toggleCopy: { flex: 1, gap: 3 },
  toggleTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, lineHeight: 20 },
  toggleDescription: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, lineHeight: 17 },
  iconAction: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
