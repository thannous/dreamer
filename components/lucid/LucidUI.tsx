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
  type AccessibilityState,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { LucidGlass } from '@/components/lucid/LucidGlass';
import { getLucidPalette, LucidIcon, LucidPress, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useOptionalLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Trois opacités « désactivé » cohabitaient sans token : 0,45 / 0,38 / 0,55.
const DISABLED_OPACITY = 0.45;

// La barre d'onglets flotte à `max(insets.bottom, 10)` du bas et mesure 70 de
// haut : le contenu doit réserver de quoi passer dessous sans s'y cacher.
export const LUCID_TAB_BAR_INSET = 92;

export function LucidScreen({
  children,
  eyebrow,
  title,
  subtitle,
  status,
  trailing,
  bottomInset = 24,
  footer,
  scroll = true,
  contentStyle,
  testID,
  ...scrollProps
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  // Statut d'écran (synchronisation, mode). Il occupe sa propre ligne : posé à
  // côté du titre, une pastille de 160px ampute la colonne de titre de moitié
  // et coupe les mots. `trailing` reste réservé à une action de 44px.
  status?: ReactNode;
  trailing?: ReactNode;
  // Réserve sous le dernier élément. `LUCID_TAB_BAR_INSET` sous les onglets, où
  // la barre flotte par-dessus le contenu ; la valeur par défaut ailleurs. Les
  // deux étaient confondues, et six écrans sans barre gardaient 132px de vide.
  bottomInset?: number;
  // Barre d'action épinglée hors du ScrollView. Dans le flux, elle sort de
  // l'écran dès que le contenu dépasse — l'onboarding y perdait son bouton.
  footer?: ReactNode;
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
            paddingBottom: Math.max(insets.bottom, 20) + bottomInset,
          },
          contentStyle,
        ]}
      >
        {status ? <View style={styles.statusRow}><LucidGlass radius={16} style={styles.statusGlass}>{status}</LucidGlass></View> : null}
        {(eyebrow || title || subtitle || trailing) && (
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              {eyebrow ? (
                <Text style={[styles.eyebrow, { color: palette.textMuted }]}>{eyebrow}</Text>
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
        colors={palette.atmosphere}
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
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

export function LucidCard({
  children,
  style,
  accent = 'none',
  onPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: 'none' | 'accent' | 'amber';
  onPress?: () => void;
  accessibilityLabel?: string;
  // Le rôle décrit le mécanisme, pas l'habillage. Une carte qui ouvre un écran
  // est un bouton (défaut), une étape de séance qu'on coche est une case à
  // cocher — et son état coché doit s'annoncer, puisque c'est lui qui débloque
  // le bouton de fin.
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const reduceMotion =
    useOptionalLucidTrainer()?.state?.onboarding.accessibility.reduceMotion ?? false;
  const accentColor =
    accent === 'accent' ? palette.accent : accent === 'amber' ? palette.amber : palette.border;
  // Une carte pressable est un contrôle : son bord doit tenir 3:1. En thème
  // clair la carte blanche ne se détache du fond que de 1,08:1, le filet est
  // donc le seul repère. À 47% d'opacité il tombait à 1,94:1.
  const interactive = !!onPress;
  const cardStyle = [
    styles.card,
    {
      backgroundColor: palette.surface,
      borderColor:
        accent === 'none'
          ? interactive
            ? palette.borderInteractive
            : palette.border
          : interactive
            ? accentColor
            : `${accentColor}77`,
    },
    style,
  ];

  // Sans `onPress` la carte retournait une View nue : elle perdait son libellé,
  // et les séances verrouillées d'un programme devenaient muettes.
  if (!onPress)
    return (
      <View
        accessible={accessibilityLabel ? true : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        testID={testID}
        style={cardStyle}
      >
        {children}
      </View>
    );
  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
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
  disabledReason,
  loading = false,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  // Shown under the button while it is disabled. A disabled action must always
  // name the condition it is waiting for, never leave the user guessing.
  disabledReason?: string;
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
      ? palette.dangerSoft
      : variant === 'secondary'
        ? palette.surfaceRaised
        : 'transparent';

  const reason = disabled && !loading && disabledReason ? disabledReason : null;
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint ?? reason ?? undefined}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          // La bordure délimite une cible tactile : 3:1 minimum. À 40% d'opacité
          // le rouge tombait à 2,76:1 en sombre et 2,13:1 en clair ; plein, il
          // tient 8,49:1 et 6,31:1 sur la surface de carte.
          borderColor: danger ? palette.danger : primary ? palette.accentStrong : palette.borderInteractive,
          opacity: disabled ? DISABLED_OPACITY : pressed ? LucidPress.opacity : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} color={foreground} size={LucidIcon.md} /> : null}
          <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );

  if (!reason) return button;
  return (
    <View style={styles.buttonBlock}>
      {button}
      <Text accessibilityLiveRegion="polite" style={[styles.buttonReason, { color: palette.amber }]}>{reason}</Text>
    </View>
  );
}

/**
 * Tuile d'icône. Elle existait en dix exemplaires, dix géométries et trois
 * recettes de fond — dont `${color}1F` et `${palette.accent}22`, des alphas
 * calculés dont le rendu dépend de la surface en dessous. Le fond vient
 * désormais d'un token opaque, toujours.
 */
export function LucidIconTile({ icon, tone = 'accent', size = 'md' }: { icon: IconName; tone?: 'accent' | 'amber' | 'neutral' | 'solid'; size?: 'sm' | 'md' | 'lg' }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  // `solid` existe pour les surfaces déjà teintées en `accentSoft` : une tuile
  // `accentSoft` y était invisible, fond sur fond.
  const color = tone === 'solid' ? palette.backgroundDeep : tone === 'amber' ? palette.amber : tone === 'neutral' ? palette.textSecondary : palette.accent;
  const background = tone === 'solid' ? palette.accent : tone === 'amber' ? palette.amberSoft : tone === 'neutral' ? palette.surfaceRaised : palette.accentSoft;
  const box = size === 'sm' ? styles.tileSm : size === 'lg' ? styles.tileLg : styles.tileMd;
  const glyph = size === 'sm' ? LucidIcon.md : size === 'lg' ? LucidIcon.xl : LucidIcon.lg;
  return (
    <View style={[box, { backgroundColor: background }]}>
      <Ionicons name={icon} size={glyph} color={color} />
    </View>
  );
}

/** Surtitre. Un seul palier pour tous les libellés en capitales du module. */
export function LucidOverline({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'accent' | 'amber' }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const color = tone === 'accent' ? palette.accentOn : tone === 'amber' ? palette.amber : palette.textMuted;
  return <Text style={[styles.eyebrow, { color }]}>{text}</Text>;
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

export function LucidPill({ label, tone = 'accent', icon }: { label: string; tone?: 'accent' | 'amber' | 'neutral'; icon?: IconName }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const color = tone === 'amber' ? palette.amber : tone === 'neutral' ? palette.textSecondary : palette.accentOn;
  const bg = tone === 'amber' ? palette.amberSoft : tone === 'neutral' ? palette.surfaceRaised : palette.accentSoft;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={LucidIcon.sm} color={color} /> : null}
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
      <View style={[styles.progressFill, { backgroundColor: palette.accent, width: `${normalized * 100}%` }]} />
    </View>
  );
}

export function LucidMetric({ value, label, tone = 'neutral', style }: { value: string; label: string; tone?: 'accent' | 'amber' | 'neutral'; style?: ViewStyle }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  // Une tuile ne se colore que si la couleur encode quelque chose. Par défaut
  // elle est neutre : trois tuiles vides en trois teintes ne disaient rien.
  const color = tone === 'accent' ? palette.accent : tone === 'amber' ? palette.amber : palette.text;
  return (
    <View style={[styles.metric, { backgroundColor: palette.surfaceRaised }, style]}>
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
  role = 'radio',
  testID,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  // `radio` dans un groupe exclusif, `checkbox` pour une case isolée. Une case
  // à cocher annoncée « bouton radio » promet un groupe qui n'existe pas.
  role?: 'radio' | 'checkbox';
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surface,
          borderColor: selected ? palette.accent : palette.borderInteractive,
          opacity: pressed ? LucidPress.opacity : 1,
        },
      ]}
    >
      {icon ? <LucidIconTile icon={icon} tone={selected ? 'solid' : 'neutral'} size="sm" /> : null}
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, { color: palette.text }]}>{title}</Text>
        {description ? <Text style={[styles.choiceDescription, { color: palette.textSecondary }]}>{description}</Text> : null}
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={LucidIcon.lg} color={selected ? palette.accent : palette.textMuted} />
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
  divider = true,
  testID,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: IconName;
  // Posé sur l'interrupteur lui-même : c'est lui qui bascule, et son libellé
  // d'accessibilité est le même que celui du titre — une sélection par texte
  // matcherait deux nœuds.
  testID?: string;
  // Le filet sépare deux lignes. La dernière d'un groupe n'a rien à séparer :
  // son filet doublait celui du bloc suivant ou flottait au bord de la carte.
  divider?: boolean;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={[styles.toggleRow, { borderBottomColor: divider ? palette.border : 'transparent' }]}>
      {icon ? <Ionicons name={icon} size={LucidIcon.md} color={palette.accent} /> : null}
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: palette.text }]}>{title}</Text>
        {description ? <Text style={[styles.toggleDescription, { color: palette.textSecondary }]}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        onValueChange={onValueChange}
        testID={testID}
        value={value}
        // Éteint, le rail était à 1,22:1 sur la carte en thème clair, et le
        // pouce blanc à 1,22:1 sur le rail : l'interrupteur off était invisible.
        trackColor={{ false: palette.borderInteractive, true: palette.accent }}
        // Le pouce prend la surface : clair sur le rail sombre, sombre sur le
        // rail accent. Le pouce presque blanc était à 1,94:1 sur l'accent sombre.
        thumbColor={palette.surface}
      />
    </View>
  );
}

// 44×44 : la seule cible tactile d'un écran qui n'a que la place d'une icône.
// `tone="danger"` reprend l'habillage du bouton danger — une action destructive
// se reconnaît avant d'être touchée, pas après.
export function LucidIconAction({ label, icon, onPress, role = 'button', tone = 'neutral' }: { label: string; icon: IconName; onPress: () => void; role?: AccessibilityRole; tone?: 'neutral' | 'danger' }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const danger = tone === 'danger';
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.iconAction, { backgroundColor: danger ? palette.dangerSoft : palette.surfaceRaised, borderColor: danger ? palette.danger : palette.borderInteractive, opacity: pressed ? LucidPress.opacity : 1 }]}>
      <Ionicons name={icon} size={LucidIcon.md} color={danger ? palette.danger : palette.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContainer: { flex: 1 },
  content: { width: '100%', paddingHorizontal: LucidSpace.gutter, gap: LucidSpace.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.lg, marginBottom: LucidSpace.xs },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusGlass: { padding: LucidSpace.xs },
  footer: { paddingHorizontal: LucidSpace.gutter, paddingTop: LucidSpace.md, gap: LucidSpace.sm },
  headerCopy: { flex: 1, minWidth: 0, gap: LucidSpace.sm },
  eyebrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 1.5, textTransform: 'uppercase' },
  // Fraunces est la voix du produit, pas sa police d'interface. Deux graisses,
  // deux rôles, et rien d'autre :
  //   _600SemiBold — le titre d'écran. Un seul par écran, celui-ci.
  //   _500Medium   — la phrase de principe qu'on lit une fois : le rappel neutre
  //                  du matin, le principe du test de réalité, l'invite de
  //                  réflexion d'une séance.
  // Tout ce qui se scanne — titres de carte, valeurs, libellés, boutons —
  // descend sur Space Grotesk. Du serif sur chaque titre de carte donnait un ton
  // éditorial à un écran qu'on consulte, pas qu'on lit.
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.display[0], lineHeight: LucidType.display[1], letterSpacing: -0.8 },
  subtitle: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  card: { borderRadius: LucidRadius.xl, borderWidth: 1, padding: LucidSpace.lg, gap: LucidSpace.md },
  pressed: { opacity: LucidPress.opacity, transform: [{ scale: LucidPress.scale }] },
  pressedWithoutMotion: { opacity: LucidPress.opacity },
  button: { minHeight: 52, borderRadius: LucidRadius.lg, borderWidth: 1, paddingHorizontal: LucidSpace.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: LucidSpace.sm },
  buttonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.body[0], lineHeight: LucidType.body[1], textAlign: 'center' },
  buttonBlock: { gap: LucidSpace.sm },
  buttonReason: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: LucidSpace.md, marginTop: LucidSpace.lg },
  sectionCopy: { flex: 1, gap: LucidSpace.xs },
  sectionTitle: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], letterSpacing: 0.2 },
  sectionCaption: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  pill: { minHeight: 28, borderRadius: LucidRadius.full, paddingHorizontal: LucidSpace.md, paddingVertical: LucidSpace.xs, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: LucidSpace.xs },
  pillLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 0.25 },
  progressTrack: { height: 7, borderRadius: LucidRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: LucidRadius.full },
  metric: { flex: 1, minWidth: 92, borderRadius: LucidRadius.lg, padding: LucidSpace.md, gap: LucidSpace.xs },
  metricValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1], fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  choice: { minHeight: 78, borderRadius: LucidRadius.lg, borderWidth: 1, padding: LucidSpace.md, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  choiceCopy: { flex: 1, gap: LucidSpace.xs },
  choiceTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  choiceDescription: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  toggleRow: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingVertical: LucidSpace.md },
  toggleCopy: { flex: 1, gap: LucidSpace.xs },
  toggleTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  toggleDescription: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  iconAction: { width: 44, height: 44, borderRadius: LucidRadius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Une seule silhouette pour la tuile d'icône, en trois tailles. Elle existait
  // en dix géométries et trois recettes de fond, dont deux alphas calculés dont
  // le rendu dépendait de la surface en dessous.
  tileSm: { width: 40, height: 40, borderRadius: LucidRadius.md, alignItems: 'center', justifyContent: 'center' },
  tileMd: { width: 56, height: 56, borderRadius: LucidRadius.lg, alignItems: 'center', justifyContent: 'center' },
  tileLg: { width: 72, height: 72, borderRadius: LucidRadius.xl, alignItems: 'center', justifyContent: 'center' },
});
