import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCID_TAB_BAR_INSET, LucidScreen } from '@/components/lucid/LucidUI';
import { PressableScale, Reveal } from '@/components/motion';
import {
  getLucidPalette,
  LucidIcon,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import {
  getLucidDayPhase,
  getLucidGuidanceProfile,
  type LucidDayPhase,
} from '@/lib/lucid/personalization';
import { evaluateLucidSessionAccess } from '@/lib/lucid/safety';

const DREAM_ATLAS = require('../../../assets/images/lucid/today-dream-atlas.png');
const GUIDE_ORB = require('../../../assets/images/lucid/lucid-guide-orb.png');

const COPY = {
  en: {
    day: 'Day',
    ready: 'Ready',
    guided: 'Guided practice',
    start: 'Start',
    continue: 'Continue',
    choose: 'Choose a journey',
    suggested: 'Suggested starting point',
    explore: (program: string) => `Explore ${program}`,
    focusTitle: { notice: 'Notice what feels unusual', recall: 'Keep the thread of your dreams', frequency: 'Build a steady lucid rhythm', stability: 'Stay lucid, calmly' },
    focusHint: { notice: 'Begin with deliberate attention.', recall: 'Begin with what remains on waking.', frequency: 'Practice consistently without shortening sleep.', stability: 'Practice a calm response after recognition.' },
    journey: (days: number) => `${days}-day journey`,
    today: 'today',
    rhythm: (nights: number) => `${nights} nights / week`,
    now: 'Now',
    morning: 'Morning review',
    morningHint: 'Capture what remains from last night',
    log: 'Log last night',
    reality: 'Reality check',
    realityHint: 'Pause and observe your surroundings',
    doCheck: 'Do a mindful check',
    prepareNight: 'Prepare for tonight',
    nightHint: 'Settle into your usual sleep window',
    sleepHint: 'Protect sleep; open night tools only when useful',
  },
  fr: {
    day: 'Jour',
    ready: 'Prêt',
    guided: 'Pratique guidée',
    start: 'Commencer',
    continue: 'Continuer',
    choose: 'Choisir un parcours',
    suggested: 'Point de départ suggéré',
    explore: (program: string) => `Découvrir ${program}`,
    focusTitle: { notice: 'Remarquez ce qui semble étrange', recall: 'Gardez le fil de vos rêves', frequency: 'Installez un rythme lucide', stability: 'Restez lucide, calmement' },
    focusHint: { notice: 'Commencez par une attention volontaire.', recall: 'Commencez par ce qui reste au réveil.', frequency: 'Pratiquez régulièrement sans raccourcir le sommeil.', stability: 'Entraînez une réponse calme après la prise de conscience.' },
    journey: (days: number) => `Parcours ${days} jours`,
    today: 'aujourd’hui',
    rhythm: (nights: number) => `${nights} nuits / semaine`,
    now: 'Maintenant',
    morning: 'Bilan du matin',
    morningHint: 'Notez ce qui reste de la nuit',
    log: 'Noter la nuit passée',
    reality: 'Test de réalité',
    realityHint: 'Faites une pause et observez autour de vous',
    doCheck: 'Faire un test conscient',
    prepareNight: 'Préparer cette nuit',
    nightHint: 'Entrez doucement dans votre fenêtre de sommeil',
    sleepHint: 'Protégez le sommeil ; ouvrez Nuit seulement si utile',
  },
  es: {
    day: 'Día',
    ready: 'Listo',
    guided: 'Práctica guiada',
    start: 'Empezar',
    continue: 'Continuar',
    choose: 'Elegir un recorrido',
    suggested: 'Punto de partida sugerido',
    explore: (program: string) => `Explorar ${program}`,
    focusTitle: { notice: 'Observa lo que parece extraño', recall: 'Conserva el hilo de tus sueños', frequency: 'Crea un ritmo lúcido constante', stability: 'Mantén la lucidez con calma' },
    focusHint: { notice: 'Empieza con atención deliberada.', recall: 'Empieza por lo que queda al despertar.', frequency: 'Practica con constancia sin acortar el sueño.', stability: 'Practica una respuesta tranquila al darte cuenta.' },
    journey: (days: number) => `Recorrido de ${days} días`,
    today: 'hoy',
    rhythm: (nights: number) => `${nights} noches / semana`,
    now: 'Ahora',
    morning: 'Revisión matinal',
    morningHint: 'Anota lo que queda de anoche',
    log: 'Registrar anoche',
    reality: 'Prueba de realidad',
    realityHint: 'Pausa y observa tu entorno',
    doCheck: 'Hacer una prueba consciente',
    prepareNight: 'Preparar esta noche',
    nightHint: 'Entra con calma en tu horario de sueño',
    sleepHint: 'Protege el sueño; abre Noche solo si te ayuda',
  },
  de: {
    day: 'Tag',
    ready: 'Bereit',
    guided: 'Geführte Übung',
    start: 'Starten',
    continue: 'Fortsetzen',
    choose: 'Programm wählen',
    suggested: 'Empfohlener Startpunkt',
    explore: (program: string) => `${program} entdecken`,
    focusTitle: { notice: 'Bemerke, was ungewöhnlich wirkt', recall: 'Halte den Faden deiner Träume', frequency: 'Baue einen ruhigen Klartraumrhythmus auf', stability: 'Bleibe ruhig und klar' },
    focusHint: { notice: 'Beginne mit bewusster Aufmerksamkeit.', recall: 'Beginne mit dem, was morgens bleibt.', frequency: 'Übe regelmäßig, ohne Schlaf zu kürzen.', stability: 'Übe nach dem Erkennen eine ruhige Reaktion.' },
    journey: (days: number) => `${days}-Tage-Programm`,
    today: 'heute',
    rhythm: (nights: number) => `${nights} Nächte / Woche`,
    now: 'Jetzt',
    morning: 'Morgenrückblick',
    morningHint: 'Halte fest, was von der Nacht bleibt',
    log: 'Letzte Nacht notieren',
    reality: 'Realitätscheck',
    realityHint: 'Halte inne und beobachte deine Umgebung',
    doCheck: 'Bewusst prüfen',
    prepareNight: 'Für diese Nacht vorbereiten',
    nightHint: 'Komme ruhig in deinem Schlaffenster an',
    sleepHint: 'Schütze deinen Schlaf; öffne Nacht nur bei Bedarf',
  },
  it: {
    day: 'Giorno',
    ready: 'Pronto',
    guided: 'Pratica guidata',
    start: 'Inizia',
    continue: 'Continua',
    choose: 'Scegli un percorso',
    suggested: 'Punto di partenza suggerito',
    explore: (program: string) => `Scopri ${program}`,
    focusTitle: { notice: 'Nota ciò che sembra insolito', recall: 'Conserva il filo dei tuoi sogni', frequency: 'Crea un ritmo lucido costante', stability: 'Resta lucido, con calma' },
    focusHint: { notice: 'Inizia con un’attenzione intenzionale.', recall: 'Inizia da ciò che resta al risveglio.', frequency: 'Pratica con costanza senza ridurre il sonno.', stability: 'Allena una risposta calma dopo esserti accorto del sogno.' },
    journey: (days: number) => `Percorso di ${days} giorni`,
    today: 'oggi',
    rhythm: (nights: number) => `${nights} notti / settimana`,
    now: 'Adesso',
    morning: 'Bilancio mattutino',
    morningHint: 'Annota ciò che resta della notte',
    log: 'Registra la notte',
    reality: 'Test di realtà',
    realityHint: 'Fermati e osserva ciò che ti circonda',
    doCheck: 'Fare un test consapevole',
    prepareNight: 'Preparati per stanotte',
    nightHint: 'Entra con calma nella tua finestra di sonno',
    sleepHint: 'Proteggi il sonno; apri Notte solo se utile',
  },
} as const;

type ContextAction = {
  key: 'morning' | 'reality' | 'night';
  route: '/lucid/morning' | '/lucid/reality-check' | '/lucid/(tabs)/night';
  testID: 'lucid-today-morning' | 'lucid-today-reality' | 'lucid-tab-night';
  icon: 'sunny-outline' | 'eye-outline' | 'moon-outline';
  label: string;
  accessibilityLabel: string;
  hint: string;
};

function getFeaturedContextKey(phase: LucidDayPhase): ContextAction['key'] {
  if (phase === 'morning') return 'morning';
  if (phase === 'day') return 'reality';
  return 'night';
}

export default function LucidTodayScreen() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content } = useLucidTrainer();
  const copy = COPY[content.locale];
  const now = useLucidNow();
  const guidance = getLucidGuidanceProfile({
    goal: state!.onboarding.goal,
    experience: state!.onboarding.experience,
  });
  const recommendedProgram = content.programs[guidance.recommendedTechnique];
  const dayPhase = getLucidDayPhase(now, state!.onboarding.sleepSchedule);
  const active =
    state!.progress.find((item) => item.status === 'active') ??
    state!.progress.find((item) => item.status === 'paused');
  const program = active ? content.programs[active.technique] : null;
  const sessionIndex = active && program
    ? Math.min(program.sessions.length - 1, Math.max(0, active.currentDay - 1))
    : 0;
  const session = program?.sessions[sessionIndex] ?? null;
  const currentDay = active ? active.currentDay : 0;
  const completedDays = active && program
    ? Math.min(active.completedExerciseIds.length, program.sessions.length)
    : 0;
  const primaryLabel = active && session
    ? `${completedDays === 0 ? copy.start : copy.continue} · ${session.durationMinutes} min`
    : copy.explore(recommendedProgram.title);
  const progressText = program
    ? `${currentDay}/${program.sessions.length} ${copy.today}`
    : null;
  const contextActions: ContextAction[] = [
    {
      key: 'morning',
      route: '/lucid/morning',
      testID: 'lucid-today-morning',
      icon: 'sunny-outline',
      label: copy.morning,
      accessibilityLabel: copy.log,
      hint: copy.morningHint,
    },
    {
      key: 'reality',
      route: '/lucid/reality-check',
      testID: 'lucid-today-reality',
      icon: 'eye-outline',
      label: copy.reality,
      accessibilityLabel: copy.doCheck,
      hint: copy.realityHint,
    },
    {
      key: 'night',
      route: '/lucid/(tabs)/night',
      testID: 'lucid-tab-night',
      icon: 'moon-outline',
      label: content.chrome.tabs.night,
      accessibilityLabel: copy.prepareNight,
      hint: dayPhase === 'sleep' ? copy.sleepHint : copy.nightHint,
    },
  ];
  const featuredContextKey = getFeaturedContextKey(dayPhase);
  const featuredContext = contextActions.find((action) => action.key === featuredContextKey)!;
  const secondaryContexts = contextActions.filter((action) => action.key !== featuredContextKey);

  const openPrimaryAction = () => {
    if (active && session) {
      const access = evaluateLucidSessionAccess({
        sessionNumber: active.currentDay,
        sessionCount: program?.sessions.length ?? 0,
        exerciseId: session.id,
        progress: active,
      });
      if (!access.allowed) {
        router.push(`/lucid/program/${active.technique}`);
        return;
      }
      router.push(`/lucid/session/${active.technique}/${active.currentDay}`);
      return;
    }
    router.push('/lucid/(tabs)/programs');
  };

  return (
    <LucidScreen
      testID="lucid-today"
      bottomInset={LUCID_TAB_BAR_INSET}
      contentStyle={styles.screenContent}
    >
      <Reveal distance={0} style={styles.hero}>
        <Image
          accessible={false}
          contentFit="cover"
          contentPosition="center"
          source={DREAM_ATLAS}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${palette.background}00`, palette.background]}
          locations={[0.56, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <PressableScale
          accessibilityLabel={content.chrome.tabs.settings}
          accessibilityRole="button"
          onPress={() => router.push('/lucid/(tabs)/settings')}
          testID="lucid-tab-settings"
          style={[
            styles.settingsAction,
            {
              // Keep the contextual action clear of Android's dev-client
              // diagnostics bubble while retaining a discreet hero placement.
              top: Math.max(insets.top, LucidSpace.md) + 64,
              backgroundColor: palette.surface,
              borderColor: palette.borderInteractive,
            },
          ]}
        >
          <Ionicons color={palette.text} name="settings-outline" size={LucidIcon.md} />
        </PressableScale>
      </Reveal>

      <Reveal index={1} distance={LucidSpace.sm} style={styles.mainContent}>
        <View style={styles.practiceCopy}>
          <Text style={[styles.overline, { color: palette.accent }]}>
            {active && program
              ? `${copy.day} ${active.currentDay} · ${program.title}`
              : `${copy.suggested} · ${recommendedProgram.title}`}
          </Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {session?.title ?? copy.focusTitle[guidance.focus]}
          </Text>
          <Text style={[styles.objective, { color: palette.textSecondary }]}>
            {session?.objective ?? copy.focusHint[guidance.focus]}
          </Text>
        </View>

        <PressableScale
          accessibilityLabel={primaryLabel}
          accessibilityRole="button"
          onPress={openPrimaryAction}
          testID="lucid-today-primary"
          style={styles.primaryAction}
        >
          <LinearGradient
            colors={[palette.accentStrong, palette.accent]}
            end={{ x: 1, y: 0.5 }}
            pointerEvents="none"
            start={{ x: 0, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.primaryIcon, { backgroundColor: palette.backgroundDeep }]}>
            <Ionicons
              color={mode === 'dark' ? palette.accent : palette.accentStrong}
              name={active ? 'arrow-forward' : 'map-outline'}
              size={LucidIcon.lg}
            />
          </View>
          <Text style={[styles.primaryLabel, { color: palette.backgroundDeep }]}>
            {primaryLabel}
          </Text>
        </PressableScale>

        {active && program && progressText ? (
          <View
            accessibilityLabel={`${copy.journey(program.sessions.length)}. ${progressText}`}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: program.sessions.length,
              now: currentDay,
              text: progressText,
            }}
            style={styles.progressBlock}
            testID="lucid-today-progress"
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: palette.accent }]}>
                {copy.journey(program.sessions.length)}
              </Text>
              <Text style={[styles.progressLabel, { color: palette.accent }]}>{progressText}</Text>
            </View>
            <View style={styles.progressSteps}>
              {program.sessions.map((item, index) => {
                const completed = index < completedDays;
                const current = index === currentDay - 1;
                return (
                  <React.Fragment key={item.id}>
                    {index > 0 ? (
                      <View
                        style={[
                          styles.progressConnector,
                          {
                            backgroundColor:
                              index <= completedDays ? palette.accent : palette.borderInteractive,
                          },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.progressDot,
                        {
                          borderColor:
                            completed || current ? palette.accent : palette.borderInteractive,
                          backgroundColor: completed ? palette.accent : palette.background,
                        },
                      ]}
                    >
                      {current && !completed ? (
                        <View
                          style={[styles.progressDotCurrent, { backgroundColor: palette.accent }]}
                        />
                      ) : null}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ) : null}

        <View
          accessible
          accessibilityLabel={copy.rhythm(state!.onboarding.weeklyTarget)}
          style={styles.rhythm}
          testID="lucid-today-rhythm"
        >
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.rhythmLabel, { color: palette.textSecondary }]}
          >
            {copy.rhythm(state!.onboarding.weeklyTarget)}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.rhythmStars}
          >
            {Array.from({ length: state!.onboarding.weeklyTarget }, (_, index) => (
              <View
                key={index}
                style={[styles.rhythmStar, { backgroundColor: palette.accent }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.contextActions}>
          <View testID="lucid-today-context-primary">
            <PressableScale
              accessibilityLabel={featuredContext.accessibilityLabel}
              accessibilityRole="button"
              onPress={() => router.push(featuredContext.route)}
              testID={featuredContext.testID}
              style={[
                styles.featuredContextAction,
                { backgroundColor: palette.surface, borderColor: palette.accent },
              ]}
            >
              <Image
                accessible={false}
                contentFit="contain"
                source={GUIDE_ORB}
                style={styles.contextOrb}
              />
              <View style={styles.featuredContextCopy}>
                <Text style={[styles.contextOverline, { color: palette.accent }]}>
                  {copy.now}
                </Text>
                <Text style={[styles.featuredContextLabel, { color: palette.text }]}>
                  {featuredContext.label}
                </Text>
                <Text style={[styles.featuredContextHint, { color: palette.textSecondary }]}>
                  {featuredContext.hint}
                </Text>
              </View>
              <Ionicons color={palette.accent} name="arrow-forward" size={LucidIcon.md} />
            </PressableScale>
          </View>

          <View style={styles.secondaryContexts}>
            {secondaryContexts.map((action) => (
              <PressableScale
                key={action.key}
                accessibilityLabel={action.accessibilityLabel}
                accessibilityRole="button"
                onPress={() => router.push(action.route)}
                testID={action.testID}
                style={[
                  styles.contextAction,
                  { backgroundColor: palette.surface, borderColor: palette.borderInteractive },
                ]}
              >
                <Ionicons
                  color={action.key === 'morning' ? palette.amber : palette.accent}
                  name={action.icon}
                  size={LucidIcon.md}
                />
                <Text numberOfLines={1} style={[styles.contextLabel, { color: palette.text }]}>
                  {action.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
      </Reveal>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  hero: {
    width: '100%',
    aspectRatio: 1.06,
    overflow: 'hidden',
  },
  settingsAction: {
    position: 'absolute',
    right: LucidSpace.gutter,
    width: 44,
    height: 44,
    borderRadius: LucidRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    marginTop: -LucidSpace.xl * 2,
    paddingHorizontal: LucidSpace.gutter,
    gap: LucidSpace.md,
  },
  practiceCopy: { gap: LucidSpace.sm },
  overline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.display[0],
    lineHeight: LucidType.display[1],
    letterSpacing: -0.8,
  },
  objective: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  primaryAction: {
    minHeight: 64,
    borderRadius: LucidRadius.full,
    overflow: 'hidden',
    padding: LucidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  primaryIcon: {
    width: 48,
    height: 48,
    borderRadius: LucidRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    flex: 1,
    paddingRight: 48 + LucidSpace.md,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
    textAlign: 'center',
  },
  progressBlock: { gap: LucidSpace.md },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  progressLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  progressSteps: { flexDirection: 'row', alignItems: 'center' },
  progressConnector: { flex: 1, height: 2 },
  progressDot: {
    width: LucidIcon.md,
    height: LucidIcon.md,
    borderRadius: LucidRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotCurrent: {
    width: LucidSpace.md,
    height: LucidSpace.md,
    borderRadius: LucidRadius.full,
  },
  rhythm: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LucidSpace.md,
  },
  rhythmLabel: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  rhythmStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.xs,
  },
  rhythmStar: {
    width: 6,
    height: 6,
    borderRadius: LucidRadius.full,
  },
  contextActions: { gap: LucidSpace.sm },
  featuredContextAction: {
    minHeight: 104,
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.sm,
  },
  contextOrb: {
    width: 68,
    height: 68,
  },
  featuredContextCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contextOverline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  featuredContextLabel: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
  },
  featuredContextHint: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  secondaryContexts: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LucidSpace.sm,
  },
  contextAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: LucidRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LucidSpace.sm,
    paddingHorizontal: LucidSpace.sm,
    paddingVertical: LucidSpace.sm,
  },
  contextLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textAlign: 'center',
  },
});
