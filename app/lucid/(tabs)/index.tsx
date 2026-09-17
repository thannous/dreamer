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
  getLucidPersonalizedPlan,
  type LucidPersonalizedPlan,
  type LucidPlanPrimaryAction,
} from '@/lib/lucid/personalization';
import { evaluateLucidSafetyPolicyFromState } from '@/lib/lucid/safety';
import { resolveLucidTodayAction } from '@/lib/lucid/todayAction';

const DREAM_ATLAS = require('../../../assets/images/lucid/today-dream-atlas.png');

const COPY = {
  en: {
    day: 'Day',
    ready: 'Ready',
    guided: 'Guided practice',
    start: 'Start',
    continue: 'Continue',
    resumeTraining: 'Resume training',
    viewJourney: 'View journey',
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
    recallNow: 'Strengthen recall',
    recallHint: 'Capture what remains before training tonight.',
    recallAction: 'Capture this morning',
    protectNow: 'Protect sleep',
    protectHint: 'Pause interruptions until sleep recovers.',
    protectAction: 'Check last night',
    reduceNow: 'Ease night signals',
    reduceHint: 'Open Night to pause or reduce cues that woke you.',
    reduceAction: 'Review night signals',
    why: 'Why?',
    whyHide: 'Hide the reason',
    whyReasons: {
      prudent_defaults: 'A cautious MILD start matches your current profile.',
      weak_recall: 'Recent mornings show little dream recall, so recall comes first.',
      beginner_weak_recall: 'As a beginner with weak recall, dream memory comes before night techniques.',
      first_lucid_mild: 'Enough recall is in place for a first lucid attempt with guided MILD.',
      frequent_lucidity_ssild: 'SSILD is the suggested next practice for more frequent lucidity.',
      recall_goal: 'Your chosen goal is stronger dream recall.',
      sleep_recovery: 'Recent sleep looks strained, so interruptions stay paused.',
      repeated_signal_wakeups: 'Night signals woke you twice recently, so cues are reduced or paused.',
      policy_recovery: 'Safety recovery is active, so night interruptions stay off.',
      policy_reduced: 'Safety reduced intensity is active for night practice.',
    },
  },
  fr: {
    day: 'Jour',
    ready: 'Prêt',
    guided: 'Pratique guidée',
    start: 'Commencer',
    continue: 'Continuer',
    resumeTraining: 'Reprendre l’entraînement',
    viewJourney: 'Voir le parcours',
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
    recallNow: 'Renforcer le rappel',
    recallHint: 'Notez ce qui reste avant d’entraîner cette nuit.',
    recallAction: 'Faire le bilan du matin',
    protectNow: 'Protéger le sommeil',
    protectHint: 'Suspendez les interruptions le temps de récupérer.',
    protectAction: 'Revoir la nuit passée',
    reduceNow: 'Alléger les signaux',
    reduceHint: 'Ouvrez Nuit pour réduire ou pauser les signaux qui vous ont réveillé.',
    reduceAction: 'Revoir les signaux',
    why: 'Pourquoi ?',
    whyHide: 'Masquer la raison',
    whyReasons: {
      prudent_defaults: 'Un départ MILD prudent correspond à votre profil actuel.',
      weak_recall: 'Les matins récents montrent peu de rappel, donc le rappel passe d’abord.',
      beginner_weak_recall: 'Débutant avec un rappel faible : la mémoire des rêves passe avant les techniques de nuit.',
      first_lucid_mild: 'Le rappel suffit pour un premier essai lucide avec MILD guidé.',
      frequent_lucidity_ssild: 'SSILD est la pratique suggérée pour une lucidité plus fréquente.',
      recall_goal: 'Votre objectif choisi est un meilleur rappel des rêves.',
      sleep_recovery: 'Le sommeil récent paraît fragile, donc les interruptions restent en pause.',
      repeated_signal_wakeups: 'Les signaux vous ont réveillé deux fois récemment, donc ils sont réduits ou en pause.',
      policy_recovery: 'Le mode récupération de sécurité est actif, donc les interruptions restent coupées.',
      policy_reduced: 'L’intensité réduite de sécurité s’applique à la pratique de nuit.',
    },
  },
  es: {
    day: 'Día',
    ready: 'Listo',
    guided: 'Práctica guiada',
    start: 'Empezar',
    continue: 'Continuar',
    resumeTraining: 'Reanudar entrenamiento',
    viewJourney: 'Ver el recorrido',
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
    recallNow: 'Reforzar el recuerdo',
    recallHint: 'Anota lo que queda antes de entrenar esta noche.',
    recallAction: 'Hacer la revisión matinal',
    protectNow: 'Proteger el sueño',
    protectHint: 'Pausa las interrupciones hasta recuperar el sueño.',
    protectAction: 'Revisar anoche',
    reduceNow: 'Suavizar las señales',
    reduceHint: 'Abre Noche para pausar o reducir las señales que te despertaron.',
    reduceAction: 'Revisar las señales',
    why: '¿Por qué?',
    whyHide: 'Ocultar el motivo',
    whyReasons: {
      prudent_defaults: 'Un inicio prudente con MILD encaja con tu perfil actual.',
      weak_recall: 'Las mañanas recientes muestran poco recuerdo, así que el recuerdo va primero.',
      beginner_weak_recall: 'Como principiante con poco recuerdo, la memoria onírica va antes que las técnicas nocturnas.',
      first_lucid_mild: 'Hay recuerdo suficiente para un primer intento lúcido con MILD guiado.',
      frequent_lucidity_ssild: 'SSILD es la práctica sugerida para una lucidez más frecuente.',
      recall_goal: 'Tu objetivo elegido es un mejor recuerdo de los sueños.',
      sleep_recovery: 'El sueño reciente parece frágil, así que las interrupciones siguen en pausa.',
      repeated_signal_wakeups: 'Las señales te despertaron dos veces recientemente, así que se reducen o pausan.',
      policy_recovery: 'La recuperación de seguridad está activa, así que las interrupciones siguen apagadas.',
      policy_reduced: 'La intensidad reducida de seguridad se aplica a la práctica nocturna.',
    },
  },
  de: {
    day: 'Tag',
    ready: 'Bereit',
    guided: 'Geführte Übung',
    start: 'Starten',
    continue: 'Fortsetzen',
    resumeTraining: 'Training fortsetzen',
    viewJourney: 'Programm ansehen',
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
    recallNow: 'Erinnerung stärken',
    recallHint: 'Halte fest, was bleibt, bevor du heute Nacht übst.',
    recallAction: 'Morgenrückblick starten',
    protectNow: 'Schlaf schützen',
    protectHint: 'Unterbrechungen pausieren, bis der Schlaf sich erholt.',
    protectAction: 'Letzte Nacht prüfen',
    reduceNow: 'Nachtsignale dämpfen',
    reduceHint: 'Öffne Nacht, um Signale zu reduzieren oder zu pausieren, die dich weckten.',
    reduceAction: 'Nachtsignale prüfen',
    why: 'Warum?',
    whyHide: 'Grund ausblenden',
    whyReasons: {
      prudent_defaults: 'Ein vorsichtiger MILD-Start passt zu deinem aktuellen Profil.',
      weak_recall: 'Die letzten Morgen zeigen wenig Traumerinnerung, deshalb kommt Erinnerung zuerst.',
      beginner_weak_recall: 'Als Anfänger mit schwacher Erinnerung kommt Traumgedächtnis vor Nachttechniken.',
      first_lucid_mild: 'Die Erinnerung reicht für einen ersten Klartraumversuch mit geführtem MILD.',
      frequent_lucidity_ssild: 'SSILD ist die vorgeschlagene Praxis für häufigere Klarträume.',
      recall_goal: 'Dein gewähltes Ziel ist eine stärkere Traumerinnerung.',
      sleep_recovery: 'Der letzte Schlaf wirkt belastet, deshalb bleiben Unterbrechungen pausiert.',
      repeated_signal_wakeups: 'Nachtsignale haben dich kürzlich zweimal geweckt, deshalb werden sie reduziert oder pausiert.',
      policy_recovery: 'Die Sicherheits-Erholung ist aktiv, deshalb bleiben Unterbrechungen aus.',
      policy_reduced: 'Die reduzierte Sicherheitsintensität gilt für die Nachtpraxis.',
    },
  },
  it: {
    day: 'Giorno',
    ready: 'Pronto',
    guided: 'Pratica guidata',
    start: 'Inizia',
    continue: 'Continua',
    resumeTraining: 'Riprendi allenamento',
    viewJourney: 'Vedi il percorso',
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
    recallNow: 'Rafforzare il ricordo',
    recallHint: 'Annota ciò che resta prima di allenarti stanotte.',
    recallAction: 'Fai il bilancio mattutino',
    protectNow: 'Proteggere il sonno',
    protectHint: 'Sospendi le interruzioni finché il sonno non si riprende.',
    protectAction: 'Rivedi la notte',
    reduceNow: 'Alleggerire i segnali',
    reduceHint: 'Apri Notte per ridurre o mettere in pausa i segnali che ti hanno svegliato.',
    reduceAction: 'Rivedi i segnali',
    why: 'Perché?',
    whyHide: 'Nascondi il motivo',
    whyReasons: {
      prudent_defaults: 'Un avvio MILD prudente corrisponde al tuo profilo attuale.',
      weak_recall: 'Le mattine recenti mostrano poco ricordo, quindi il ricordo viene prima.',
      beginner_weak_recall: 'Da principiante con ricordo debole, la memoria dei sogni viene prima delle tecniche notturne.',
      first_lucid_mild: 'C’è ricordo sufficiente per un primo tentativo lucido con MILD guidato.',
      frequent_lucidity_ssild: 'SSILD è la pratica suggerita per una lucidità più frequente.',
      recall_goal: 'Il tuo obiettivo scelto è un ricordo dei sogni più forte.',
      sleep_recovery: 'Il sonno recente sembra affaticato, quindi le interruzioni restano in pausa.',
      repeated_signal_wakeups: 'I segnali ti hanno svegliato due volte di recente, quindi sono ridotti o in pausa.',
      policy_recovery: 'Il recupero di sicurezza è attivo, quindi le interruzioni restano spente.',
      policy_reduced: 'L’intensità ridotta di sicurezza si applica alla pratica notturna.',
    },
  },
} as const;

type ContextAction = {
  key: 'morning' | 'reality' | 'night';
  route: '/lucid/morning' | '/lucid/reality-check' | '/lucid/(tabs)/night';
  testID: 'lucid-today-morning' | 'lucid-today-reality' | 'lucid-tab-night';
  icon: 'sunny-outline' | 'eye-outline' | 'moon-outline';
  label: string;
  accessibilityLabel: string;
};

type LucidTodayCopy = (typeof COPY)[keyof typeof COPY];

function isPlanOverrideAction(action: LucidPlanPrimaryAction): boolean {
  return (
    action === 'strengthen_recall' ||
    action === 'protect_sleep' ||
    action === 'reduce_night_signals'
  );
}

function getPlanRecommendedTechnique(
  plan: LucidPersonalizedPlan
): 'mild' | 'ssild' {
  return plan.recommendedTechnique ?? 'mild';
}

function getPlanPrimaryCopy(
  copy: LucidTodayCopy,
  action: LucidPlanPrimaryAction
): { overline: string; title: string; hint: string; action: string } | null {
  if (action === 'strengthen_recall') {
    return {
      overline: copy.recallNow,
      title: copy.focusTitle.recall,
      hint: copy.recallHint,
      action: copy.recallAction,
    };
  }
  if (action === 'protect_sleep') {
    return {
      overline: copy.protectNow,
      title: copy.focusTitle.stability,
      hint: copy.protectHint,
      action: copy.protectAction,
    };
  }
  if (action === 'reduce_night_signals') {
    return {
      overline: copy.reduceNow,
      title: copy.focusTitle.stability,
      hint: copy.reduceHint,
      action: copy.reduceAction,
    };
  }
  return null;
}

export default function LucidTodayScreen() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content } = useLucidTrainer();
  const copy = COPY[content.locale];
  const now = useLucidNow();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const safetyPolicy = evaluateLucidSafetyPolicyFromState(state);
  const plan = getLucidPersonalizedPlan({
    goal: state!.onboarding.goal,
    experience: state!.onboarding.experience,
    observations: state!.experiments,
    policy: safetyPolicy,
  });
  const recommendedTechnique = getPlanRecommendedTechnique(plan);
  const recommendedProgram = content.programs[recommendedTechnique];
  const dayPhase = getLucidDayPhase(now, state!.onboarding.sleepSchedule);
  const active =
    state!.progress.find((item) => item.status === 'active') ??
    state!.progress.find((item) => item.status === 'paused');
  const program = active ? content.programs[active.technique] : null;
  const sessionIndex = active && program
    ? Math.min(program.sessions.length - 1, Math.max(0, active.currentDay - 1))
    : 0;
  const session = program?.sessions[sessionIndex] ?? null;
  const currentDay = active?.currentDay ?? 0;
  const completedDays = active && program
    ? Math.min(active.completedExerciseIds.length, program.sessions.length)
    : 0;
  const planCopy = getPlanPrimaryCopy(copy, plan.primaryAction);
  const showPlanSummary = !active || isPlanOverrideAction(plan.primaryAction);
  const progressText = program
    ? `${currentDay}/${program.sessions.length} ${copy.today}`
    : null;
  const todayAction = resolveLucidTodayAction({
    phase: dayPhase,
    plan,
    policy: safetyPolicy,
    program: active,
    sessionCount: program?.sessions.length,
    sessionId: session?.id,
  });
  const primaryPresentation: {
    overline: string;
    title: string;
    hint: string;
    label: string;
    icon: 'sunny-outline' | 'eye-outline' | 'moon-outline' | 'arrow-forward' | 'refresh-outline' | 'map-outline';
  } = (() => {
    if (todayAction.kind === 'morning_capture') {
      return { overline: copy.now, title: copy.morning, hint: copy.morningHint, label: copy.log, icon: 'sunny-outline' };
    }
    if (todayAction.kind === 'reality_check') {
      return { overline: copy.now, title: copy.reality, hint: copy.realityHint, label: copy.doCheck, icon: 'eye-outline' };
    }
    if (todayAction.kind === 'night_tools') {
      return { overline: copy.now, title: content.chrome.tabs.night, hint: copy.sleepHint, label: copy.prepareNight, icon: 'moon-outline' };
    }
    if (todayAction.kind === 'sleep_recovery') {
      return { overline: copy.protectNow, title: copy.focusTitle.stability, hint: copy.protectHint, label: copy.protectAction, icon: 'sunny-outline' };
    }
    if (todayAction.kind === 'guided_ritual' && active && program && session) {
      return {
        overline: `${copy.day} ${active.currentDay} · ${program.title}`,
        title: session.title,
        hint: session.objective,
        label: `${completedDays === 0 ? copy.start : copy.continue} · ${session.durationMinutes} min`,
        icon: 'arrow-forward',
      };
    }
    if (todayAction.kind === 'resume_program' && program) {
      return {
        overline: `${program.title} · ${progressText ?? ''}`,
        title: copy.resumeTraining,
        hint: session?.objective ?? copy.focusHint[plan.focus],
        label: copy.resumeTraining,
        icon: 'refresh-outline',
      };
    }
    return {
      overline: `${copy.suggested} · ${recommendedProgram.title}`,
      title: copy.focusTitle[plan.focus],
      hint: copy.focusHint[plan.focus],
      label: copy.explore(recommendedProgram.title),
      icon: 'map-outline',
    };
  })();
  const contextActions: ContextAction[] = [
    {
      key: 'morning',
      route: '/lucid/morning',
      testID: 'lucid-today-morning',
      icon: 'sunny-outline',
      label: copy.morning,
      accessibilityLabel: copy.log,
    },
    {
      key: 'reality',
      route: '/lucid/reality-check',
      testID: 'lucid-today-reality',
      icon: 'eye-outline',
      label: copy.reality,
      accessibilityLabel: copy.doCheck,
    },
    {
      key: 'night',
      route: '/lucid/(tabs)/night',
      testID: 'lucid-tab-night',
      icon: 'moon-outline',
      label: content.chrome.tabs.night,
      accessibilityLabel: copy.prepareNight,
    },
  ];

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
            {primaryPresentation.overline}
          </Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {primaryPresentation.title}
          </Text>
          <Text style={[styles.objective, { color: palette.textSecondary }]}>
            {primaryPresentation.hint}
          </Text>
        </View>

        <PressableScale
          accessibilityLabel={primaryPresentation.label}
          accessibilityRole="button"
          onPress={() => router.push(todayAction.route)}
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
              name={primaryPresentation.icon}
              size={LucidIcon.lg}
            />
          </View>
          <Text style={[styles.primaryLabel, { color: palette.backgroundDeep }]}>
            {primaryPresentation.label}
          </Text>
        </PressableScale>

        {showPlanSummary ? (
          <View style={styles.planSummary} testID="lucid-today-plan">
            <Text style={[styles.overline, { color: palette.accent }]}>
              {planCopy?.overline ?? `${copy.suggested} · ${recommendedProgram.title}`}
            </Text>
            <Text style={[styles.planSummaryTitle, { color: palette.text }]}>
              {planCopy?.title ?? copy.focusTitle[plan.focus]}
            </Text>
            <Text style={[styles.planSummaryHint, { color: palette.textSecondary }]}>
              {planCopy?.hint ?? copy.focusHint[plan.focus]}
            </Text>
          </View>
        ) : null}

        {showPlanSummary ? (
          <View style={styles.whyBlock}>
            <PressableScale
              accessibilityLabel={whyOpen ? copy.whyHide : copy.why}
              accessibilityRole="button"
              accessibilityState={{ expanded: whyOpen }}
              haptic="none"
              onPress={() => setWhyOpen((open) => !open)}
              scale={1}
              style={styles.whyToggle}
              testID="lucid-today-why"
            >
              <Text style={[styles.whyLabel, { color: palette.accent }]}>{whyOpen ? copy.whyHide : copy.why}</Text>
            </PressableScale>
            {whyOpen ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.whyReason, { color: palette.textSecondary }]}
                testID="lucid-today-why-reason"
              >
                {copy.whyReasons[plan.reasonCode]}
              </Text>
            ) : null}
          </View>
        ) : null}

        {active && program && progressText ? (
          <View style={styles.progressBlock} testID="lucid-today-progress">
            <View
              accessible
              accessibilityLabel={`${copy.journey(program.sessions.length)}. ${progressText}`}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: program.sessions.length,
                now: currentDay,
                text: progressText,
              }}
              style={styles.progressMetric}
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
            <PressableScale
              accessibilityLabel={active.status === 'paused' ? copy.resumeTraining : copy.viewJourney}
              accessibilityRole="button"
              haptic="none"
              onPress={() => router.push(`/lucid/program/${active.technique}`)}
              scale={1}
              style={styles.progressAction}
              testID="lucid-today-progress-action"
            >
              <Text style={[styles.progressActionLabel, { color: palette.accent }]}>
                {active.status === 'paused' ? copy.resumeTraining : copy.viewJourney}
              </Text>
              <Ionicons color={palette.accent} name="arrow-forward" size={LucidIcon.sm} />
            </PressableScale>
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

        <View style={styles.contextActions} testID="lucid-today-shortcuts">
          <View style={styles.secondaryContexts}>
            {contextActions.map((action) => (
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
  planSummary: { gap: LucidSpace.xs, paddingTop: LucidSpace.sm },
  planSummaryTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  planSummaryHint: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  whyBlock: {
    gap: LucidSpace.xs,
  },
  whyToggle: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: LucidSpace.xs,
  },
  whyLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  whyReason: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  progressBlock: { gap: LucidSpace.md },
  progressMetric: { gap: LucidSpace.md },
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
  progressAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: LucidSpace.xs,
  },
  progressActionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
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
