import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import {
  LucidProgressConstellation,
  shouldUseLucidProgressReflow,
} from '@/components/lucid/LucidProgressConstellation';
import {
  LUCID_TAB_BAR_INSET,
  LucidButton,
  LucidIconAction,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import {
  getLucidPalette,
  LucidRadius,
  LucidScene,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import { getLucidGuidanceProfile } from '@/lib/lucid/personalization';
import type { LucidGuidanceFocus } from '@/lib/lucid/personalization';
import { buildLucidWeeklyReview } from '@/lib/lucid/progress';
import type { LucidExperiment, LucidTechnique } from '@/lib/lucid/model';

const PROGRESS_CONSTELLATION = require('../../../assets/images/lucid/progress-constellation.png');

const METHOD_ANCHORS: Record<LucidTechnique, ViewStyle> = {
  mild: { left: '18%', top: '58%' },
  ssild: { left: '46%', top: '36%' },
  wbtb: { left: '68%', top: '18%' },
};

const COPY = {
  en: {
    eyebrow: 'Progress',
    title: 'Patterns, not promises',
    focusTitle: {
      notice: 'Notice more',
      recall: 'Remember more',
      frequency: 'Practice more often',
      stability: 'Stay calm',
    },
    subtitle: 'Read your own signals.',
    overview: 'Last 7 days',
    attempts: 'attempts',
    recall: 'recall rate',
    lucid: 'lucid dreams',
    sleep: 'sleep quality',
    methods: 'Method comparison',
    attemptsShort: 'attempts',
    noData: 'No attempts yet',
    early: 'Early signal',
    usable: 'Personal signal',
    history: 'Recent experiences',
    empty: 'Your morning reviews will appear here.',
    weekly: 'Complete weekly review',
    weeklyHistory: 'Saved weekly reviews',
    weeklyEmpty: 'Saved weekly reviews will appear here after you complete one.',
    weeklyPractice: 'practice days',
    weeklyRecall: 'recall days',
    weeklyFocus: 'Suggested focus',
    delete: 'Delete this review?',
    cancel: 'Cancel',
    confirm: 'Delete',
    none: 'No lucidity',
    pre_lucid: 'Almost lucid',
    resultLucid: 'Lucid',
    coach: 'Offline adaptation',
    improving: 'Trend improving',
    steady: 'Trend steady',
    declining: 'Trend declining',
    insufficient_data: 'More observations needed',
    path: 'Seven-day path',
    methodDetail: 'Method details',
    showMethodDetail: 'Show method bars and evidence',
    hideMethodDetail: 'Hide method bars and evidence',
    captureNeutral: 'Morning capture',
    nothingForNow: 'Nothing for now',
    writeCapture: 'Written capture',
    speakCapture: 'Typed after speaking',
    linkedPractice: 'Linked practice',
    cue_not_heard: 'Cue not heard',
    cue_heard_in_dream: 'Cue heard in the dream',
    cue_heard_woke: 'Cue heard and woke me',
    cue_indeterminate: 'Cue unsure',
  },
  fr: {
    eyebrow: 'Progression',
    title: 'Des tendances, pas des promesses',
    focusTitle: {
      notice: 'Mieux remarquer',
      recall: 'Mieux se souvenir',
      frequency: 'Pratiquer plus souvent',
      stability: 'Rester calme',
    },
    subtitle: 'Lisez vos propres signaux.',
    overview: '7 derniers jours',
    attempts: 'essais',
    recall: 'taux de rappel',
    lucid: 'rêves lucides',
    sleep: 'qualité du sommeil',
    methods: 'Comparaison des méthodes',
    attemptsShort: 'essais',
    noData: 'Aucun essai',
    early: 'Signal précoce',
    usable: 'Signal personnel',
    history: 'Expériences récentes',
    empty: 'Vos bilans du matin apparaîtront ici.',
    weekly: 'Faire le bilan hebdomadaire',
    weeklyHistory: 'Bilans hebdomadaires enregistrés',
    weeklyEmpty: 'Les bilans hebdomadaires enregistrés apparaîtront ici après le premier.',
    weeklyPractice: 'jours de pratique',
    weeklyRecall: 'jours de rappel',
    weeklyFocus: 'Axe suggéré',
    delete: 'Supprimer ce bilan ?',
    cancel: 'Annuler',
    confirm: 'Supprimer',
    none: 'Pas de lucidité',
    pre_lucid: 'Presque lucide',
    resultLucid: 'Lucide',
    coach: 'Adaptation hors ligne',
    improving: 'Tendance en progrès',
    steady: 'Tendance stable',
    declining: 'Tendance en baisse',
    insufficient_data: 'Plus d’observations nécessaires',
    path: 'Chemin des 7 jours',
    methodDetail: 'Détail des méthodes',
    showMethodDetail: 'Afficher les barres et le niveau de preuve',
    hideMethodDetail: 'Masquer les barres et le niveau de preuve',
    captureNeutral: 'Capture du matin',
    nothingForNow: 'Rien pour l’instant',
    writeCapture: 'Capture écrite',
    speakCapture: 'Texte après avoir parlé',
    linkedPractice: 'Pratique liée',
    cue_not_heard: 'Signal non entendu',
    cue_heard_in_dream: 'Signal entendu dans le rêve',
    cue_heard_woke: 'Signal entendu, réveil',
    cue_indeterminate: 'Signal incertain',
  },
  es: {
    eyebrow: 'Progreso',
    title: 'Patrones, no promesas',
    focusTitle: {
      notice: 'Observar más',
      recall: 'Recordar más',
      frequency: 'Practicar más a menudo',
      stability: 'Mantener la calma',
    },
    subtitle: 'Lee tus propias señales.',
    overview: 'Últimos 7 días',
    attempts: 'intentos',
    recall: 'tasa de recuerdo',
    lucid: 'sueños lúcidos',
    sleep: 'calidad del sueño',
    methods: 'Comparación de métodos',
    attemptsShort: 'intentos',
    noData: 'Sin intentos',
    early: 'Señal temprana',
    usable: 'Señal personal',
    history: 'Experiencias recientes',
    empty: 'Tus revisiones matinales aparecerán aquí.',
    weekly: 'Completar revisión semanal',
    weeklyHistory: 'Revisiones semanales guardadas',
    weeklyEmpty: 'Las revisiones semanales guardadas aparecerán aquí después de completar una.',
    weeklyPractice: 'días de práctica',
    weeklyRecall: 'días de recuerdo',
    weeklyFocus: 'Foco sugerido',
    delete: '¿Eliminar esta revisión?',
    cancel: 'Cancelar',
    confirm: 'Eliminar',
    none: 'Sin lucidez',
    pre_lucid: 'Casi lúcido',
    resultLucid: 'Lúcido',
    coach: 'Adaptación sin conexión',
    improving: 'Tendencia al alza',
    steady: 'Tendencia estable',
    declining: 'Tendencia a la baja',
    insufficient_data: 'Se necesitan más observaciones',
    path: 'Camino de 7 días',
    methodDetail: 'Detalle de métodos',
    showMethodDetail: 'Mostrar barras y evidencia',
    hideMethodDetail: 'Ocultar barras y evidencia',
    captureNeutral: 'Captura de la mañana',
    nothingForNow: 'Nada por ahora',
    writeCapture: 'Captura escrita',
    speakCapture: 'Texto después de hablar',
    linkedPractice: 'Práctica vinculada',
    cue_not_heard: 'Señal no oída',
    cue_heard_in_dream: 'Señal oída en el sueño',
    cue_heard_woke: 'Señal oída y despertó',
    cue_indeterminate: 'Señal incierta',
  },
  de: {
    eyebrow: 'Fortschritt',
    title: 'Muster statt Versprechen',
    focusTitle: {
      notice: 'Mehr wahrnehmen',
      recall: 'Mehr erinnern',
      frequency: 'Öfter üben',
      stability: 'Ruhig bleiben',
    },
    subtitle: 'Lies deine eigenen Signale.',
    overview: 'Letzte 7 Tage',
    attempts: 'Versuche',
    recall: 'Erinnerungsrate',
    lucid: 'Klarträume',
    sleep: 'Schlafqualität',
    methods: 'Methodenvergleich',
    attemptsShort: 'Versuche',
    noData: 'Keine Versuche',
    early: 'Frühes Signal',
    usable: 'Persönliches Signal',
    history: 'Letzte Erfahrungen',
    empty: 'Deine Morgenrückblicke erscheinen hier.',
    weekly: 'Wochenrückblick',
    weeklyHistory: 'Gespeicherte Wochenrückblicke',
    weeklyEmpty: 'Gespeicherte Wochenrückblicke erscheinen hier nach dem ersten Abschluss.',
    weeklyPractice: 'Übungstage',
    weeklyRecall: 'Erinnerungstage',
    weeklyFocus: 'Vorgeschlagener Fokus',
    delete: 'Diesen Rückblick löschen?',
    cancel: 'Abbrechen',
    confirm: 'Löschen',
    none: 'Keine Klarheit',
    pre_lucid: 'Fast klar',
    resultLucid: 'Klar',
    coach: 'Offline-Anpassung',
    improving: 'Trend verbessert sich',
    steady: 'Trend stabil',
    declining: 'Trend sinkt',
    insufficient_data: 'Mehr Beobachtungen nötig',
    path: 'Sieben-Tage-Pfad',
    methodDetail: 'Methodendetails',
    showMethodDetail: 'Balken und Evidenz anzeigen',
    hideMethodDetail: 'Balken und Evidenz ausblenden',
    captureNeutral: 'Morgennotiz',
    nothingForNow: 'Jetzt nichts',
    writeCapture: 'Geschriebene Notiz',
    speakCapture: 'Getippt nach dem Sprechen',
    linkedPractice: 'Verknüpfte Übung',
    cue_not_heard: 'Signal nicht gehört',
    cue_heard_in_dream: 'Signal im Traum gehört',
    cue_heard_woke: 'Signal gehört, aufgewacht',
    cue_indeterminate: 'Signal unsicher',
  },
  it: {
    eyebrow: 'Progressi',
    title: 'Schemi, non promesse',
    focusTitle: {
      notice: 'Notare di più',
      recall: 'Ricordare di più',
      frequency: 'Praticare più spesso',
      stability: 'Restare calmi',
    },
    subtitle: 'Leggi i tuoi segnali.',
    overview: 'Ultimi 7 giorni',
    attempts: 'tentativi',
    recall: 'tasso di ricordo',
    lucid: 'sogni lucidi',
    sleep: 'qualità del sonno',
    methods: 'Confronto metodi',
    attemptsShort: 'tentativi',
    noData: 'Nessun tentativo',
    early: 'Segnale iniziale',
    usable: 'Segnale personale',
    history: 'Esperienze recenti',
    empty: 'I bilanci mattutini appariranno qui.',
    weekly: 'Completa bilancio settimanale',
    weeklyHistory: 'Bilanci settimanali salvati',
    weeklyEmpty: 'I bilanci settimanali salvati appariranno qui dopo il primo.',
    weeklyPractice: 'giorni di pratica',
    weeklyRecall: 'giorni di ricordo',
    weeklyFocus: 'Focus suggerito',
    delete: 'Eliminare questo bilancio?',
    cancel: 'Annulla',
    confirm: 'Elimina',
    none: 'Nessuna lucidità',
    pre_lucid: 'Quasi lucido',
    resultLucid: 'Lucido',
    coach: 'Adattamento offline',
    improving: 'Tendenza in crescita',
    steady: 'Tendenza stabile',
    declining: 'Tendenza in calo',
    insufficient_data: 'Servono più osservazioni',
    path: 'Percorso di 7 giorni',
    methodDetail: 'Dettaglio metodi',
    showMethodDetail: 'Mostra barre e evidenza',
    hideMethodDetail: 'Nascondi barre e evidenza',
    captureNeutral: 'Cattura del mattino',
    nothingForNow: 'Niente per ora',
    writeCapture: 'Cattura scritta',
    speakCapture: 'Testo dopo aver parlato',
    linkedPractice: 'Pratica collegata',
    cue_not_heard: 'Segnale non udito',
    cue_heard_in_dream: 'Segnale udito nel sogno',
    cue_heard_woke: 'Segnale udito, risveglio',
    cue_indeterminate: 'Segnale incerto',
  },
} as const;

type ProgressCopy = (typeof COPY)[keyof typeof COPY];

function historyTitle(
  item: LucidExperiment,
  copy: ProgressCopy,
  programs: ReturnType<typeof useLucidTrainer>['content']['programs']
): string {
  if (item.technique) return programs[item.technique].title;
  if (item.captureMode === 'nothing_for_now') return copy.nothingForNow;
  if (item.techniqueAutoLink) {
    return `${copy.linkedPractice}: ${programs[item.techniqueAutoLink.technique].title}`;
  }
  if (item.captureMode === 'write') return copy.writeCapture;
  if (item.captureMode === 'speak') return copy.speakCapture;
  return copy.captureNeutral;
}

function historyMeta(item: LucidExperiment, copy: ProgressCopy, date: string): string {
  const parts = [date];
  if (item.result === 'lucid') parts.push(copy.resultLucid);
  else if (item.result) parts.push(copy[item.result]);
  if (item.cueOutcome) parts.push(copy[`cue_${item.cueOutcome}`]);
  return parts.join(' · ');
}

function formatPercent(value: number | null) {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

type LucidProgressMetric = 'attempts' | 'recall' | 'lucid' | 'sleep';

const METRIC_ORDER: Record<LucidGuidanceFocus, readonly LucidProgressMetric[]> = {
  notice: ['attempts', 'recall', 'lucid', 'sleep'],
  recall: ['recall', 'attempts', 'lucid', 'sleep'],
  frequency: ['lucid', 'attempts', 'recall', 'sleep'],
  stability: ['sleep', 'lucid', 'attempts', 'recall'],
};

export default function LucidProgressScreen() {
  const { fontScale, width } = useWindowDimensions();
  const reflow = shouldUseLucidProgressReflow(width, fontScale);
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, deleteExperiment } = useLucidTrainer();
  const copy = COPY[content.locale];
  const profile = getLucidGuidanceProfile({
    goal: state!.onboarding.goal,
    experience: state!.onboarding.experience,
  });
  const now = useLucidNow();
  const review = useMemo(() => {
    const endAt = now + 1;
    return buildLucidWeeklyReview(state!.experiments, { startAt: endAt - 7 * 86400000, endAt });
  }, [now, state]);
  const weeklyReviews = useMemo(
    () =>
      [...state!.weeklyReviews]
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id))
        .slice(0, 12),
    [state]
  );
  const avgSleep = review.current.averageSleepQuality;
  const maxAttempts = Math.max(1, ...review.comparison.methods.map((method) => method.attempts));
  const confirmDelete = (id: string) =>
    Alert.alert(copy.delete, undefined, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.confirm, style: 'destructive', onPress: () => void deleteExperiment(id) },
    ]);
  const sleepLabel = `${copy.sleep} / 5`;
  const sleepValue = avgSleep == null ? '—' : avgSleep.toFixed(1);
  const recallValue = formatPercent(review.current.recallRate);
  const trendLabel = copy[review.trend.direction];
  const [methodsOpen, setMethodsOpen] = React.useState(false);
  const coachingCopy =
    content.weeklyReview.adaptationRules[
      review.coaching.action === 'protect_sleep'
        ? 0
        : review.coaching.action === 'strengthen_recall'
          ? 1
          : 2
    ] ?? content.weeklyReview.coachingNote;

  return (
    <LucidScreen
      bottomInset={LUCID_TAB_BAR_INSET}
      testID="lucid-progress"
      contentStyle={styles.screenContent}
    >
      <LucidProgressConstellation
        fadeColor={palette.background}
        reflow={reflow}
        source={PROGRESS_CONSTELLATION}
      >
        <View
          accessibilityLabel={copy.methods}
          pointerEvents="box-none"
          style={styles.methodScene}
        >
          {review.comparison.methods.map((method) => {
            const leader = review.comparison.leader === method.technique;
            const title = content.programs[method.technique].title;
            const rate = formatPercent(method.successRate);
            const meta = method.attempts
              ? `${method.attempts} ${copy.attemptsShort} · ${rate}`
              : copy.noData;
            return (
              <View
                key={method.technique}
                accessible
                accessibilityLabel={`${title}. ${meta}`}
                style={[
                  styles.star,
                  reflow ? styles.starReflow : METHOD_ANCHORS[method.technique],
                  {
                    borderColor: reflow
                      ? leader
                        ? palette.accent
                        : palette.borderInteractive
                      : LucidScene.border,
                    backgroundColor: reflow
                      ? leader
                        ? palette.accentSoft
                        : palette.surface
                      : LucidScene.surface,
                  },
                ]}
                testID={`lucid-progress-method-${method.technique}`}
              >
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.starCore,
                    leader && styles.starCoreLeader,
                    { backgroundColor: leader ? palette.accent : palette.borderInteractive },
                  ]}
                />
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.starTitle, { color: reflow ? palette.text : LucidScene.text }]}
                >
                  {title}
                </Text>
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.starMeta,
                    { color: reflow ? palette.textSecondary : LucidScene.textSecondary },
                  ]}
                >
                  {meta}
                </Text>
              </View>
            );
          })}
        </View>
      </LucidProgressConstellation>

      <View style={styles.mainContent}>
        <View style={styles.heroCopy}>
          <Text style={[styles.overline, { color: palette.accent }]}>{copy.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {copy.focusTitle[profile.focus]}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{copy.subtitle}</Text>
        </View>

        <View
          accessibilityRole="summary"
          style={[styles.overview, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={styles.overviewTop}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.overview}</Text>
            <View
              style={[
                styles.trend,
                {
                  backgroundColor:
                    review.trend.direction === 'improving'
                      ? palette.accentSoft
                      : review.trend.direction === 'declining'
                        ? palette.amberSoft
                        : palette.surfaceRaised,
                },
              ]}
            >
              <Text
                style={[
                  styles.trendLabel,
                  {
                    color:
                      review.trend.direction === 'improving'
                        ? palette.accentOn
                        : review.trend.direction === 'declining'
                          ? palette.amber
                          : palette.textSecondary,
                  },
                ]}
              >
                {trendLabel}
              </Text>
            </View>
          </View>
          <View style={[styles.metrics, reflow && styles.metricsReflow]}>
            {METRIC_ORDER[profile.focus].map((metric) => {
              if (metric === 'attempts') {
                return (
                  <View key="attempts" style={styles.metric} testID="metric-attempts">
                    <Text style={[styles.metricValue, { color: palette.text }]}>{String(review.current.attempts)}</Text>
                    <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{copy.attempts}</Text>
                  </View>
                );
              }
              if (metric === 'recall') {
                return (
                  <View key="recall" style={styles.metric} testID="metric-recall rate">
                    <Text style={[styles.metricValue, { color: palette.text }]}>{recallValue}</Text>
                    <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{copy.recall}</Text>
                  </View>
                );
              }
              if (metric === 'lucid') {
                return (
                  <View key="lucid" style={styles.metric} testID="metric-lucid dreams">
                    <Text style={[styles.metricValue, { color: palette.text }]}>
                      {String(review.current.lucidDreams)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{copy.lucid}</Text>
                  </View>
                );
              }
              return (
                <View key="sleep" style={styles.metric} testID={`metric-${sleepLabel}`}>
                  <Text style={[styles.metricValue, { color: palette.text }]}>{sleepValue}</Text>
                  <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{sleepLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.coach, { backgroundColor: palette.surface, borderColor: palette.accent }]}>
          <Text style={[styles.overline, { color: palette.accent }]}>{copy.coach}</Text>
          <Text style={[styles.coachText, { color: palette.text }]}>{coachingCopy}</Text>
          <Text style={[styles.small, { color: palette.textSecondary }]}>{content.weeklyReview.coachingNote}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={methodsOpen ? copy.hideMethodDetail : copy.showMethodDetail}
          accessibilityState={{ expanded: methodsOpen }}
          onPress={() => setMethodsOpen((open) => !open)}
          testID="lucid-progress-methods-toggle"
          style={({ pressed }) => [
            styles.disclosure,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderInteractive,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <View style={styles.disclosureCopy}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.methodDetail}</Text>
            <Text style={[styles.small, { color: palette.textSecondary }]}>
              {review.comparison.evidence === 'usable' ? copy.usable : copy.early}
            </Text>
          </View>
        </Pressable>
        {methodsOpen ? (
          <View style={[styles.methodList, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {review.comparison.methods.map((method) => {
              const rate = method.successRate ?? 0;
              const leader = review.comparison.leader === method.technique;
              const title = content.programs[method.technique].title;
              const meta = method.attempts
                ? `${method.attempts} ${copy.attemptsShort} · ${Math.round(rate * 100)}%`
                : copy.noData;
              return (
                <View key={method.technique} style={styles.method}>
                  <View style={styles.methodTop}>
                    <Text style={[styles.methodName, { color: palette.text }]}>{title}</Text>
                    <Text style={[styles.methodMeta, { color: palette.textSecondary }]}>{meta}</Text>
                  </View>
                  <View style={[styles.bar, { backgroundColor: palette.surfaceRaised }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${method.attempts ? Math.max(8, (method.attempts / maxAttempts) * 100) : 0}%`,
                          backgroundColor: leader ? palette.accent : palette.borderInteractive,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
            <Text style={[styles.small, { color: palette.textMuted }]}>
              {review.comparison.evidence === 'usable' ? copy.usable : copy.early}
            </Text>
          </View>
        ) : null}

        <LucidButton
          label={copy.weekly}
          variant="secondary"
          icon="calendar"
          onPress={() => router.push('/lucid/weekly')}
        />

        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
          {copy.weeklyHistory}
        </Text>
        {weeklyReviews.length === 0 ? (
          <View
            style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            testID="lucid-weekly-history-empty"
          >
            <Text style={[styles.empty, { color: palette.textSecondary }]}>{copy.weeklyEmpty}</Text>
          </View>
        ) : (
          weeklyReviews.map((item) => {
            const weekLabel = new Intl.DateTimeFormat(content.locale, { dateStyle: 'medium' }).format(
              new Date(`${item.weekStart}T00:00:00`)
            );
            const practiceLabel = `${copy.weeklyPractice}: ${item.practiceDays}`;
            const recallLabel = `${copy.weeklyRecall}: ${item.recallDays}`;
            const lucidLabel = `${copy.lucid}: ${item.lucidDreams}`;
            const focusLabel = item.recommendedTechnique
              ? `${copy.weeklyFocus}: ${content.programs[item.recommendedTechnique].title}`
              : null;
            return (
              <View
                accessible
                accessibilityLabel={[weekLabel, focusLabel, practiceLabel, recallLabel, lucidLabel]
                  .filter(Boolean)
                  .join('. ')}
                key={item.id}
                style={[styles.historyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                testID={`lucid-weekly-history-${item.id}`}
              >
                <View style={styles.historyTop}>
                  <View style={styles.historyCopy}>
                    <Text style={[styles.methodName, { color: palette.text }]}>{weekLabel}</Text>
                    {focusLabel ? (
                      <Text style={[styles.methodMeta, { color: palette.textSecondary }]}>{focusLabel}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.historyScores}>
                  {[practiceLabel, recallLabel, lucidLabel].map((label) => (
                    <Text
                      key={label}
                      style={[styles.score, { color: palette.textSecondary, backgroundColor: palette.surfaceRaised }]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
                {item.notes ? (
                  <Text numberOfLines={2} style={[styles.small, { color: palette.textSecondary }]}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
          {copy.history}
        </Text>
        {state!.experiments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.empty, { color: palette.textSecondary }]}>{copy.empty}</Text>
            <LucidButton
              label={content.morningReview.title}
              icon="sunny"
              onPress={() => router.push('/lucid/morning')}
            />
          </View>
        ) : (
          state!.experiments.slice(0, 12).map((item) => {
            const date = new Intl.DateTimeFormat(content.locale, { dateStyle: 'medium' }).format(item.occurredAt);
            const title = historyTitle(item, copy, content.programs);
            return (
              <View
                key={item.id}
                style={[styles.historyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <View style={styles.historyTop}>
                  <View style={styles.historyCopy}>
                    <Text style={[styles.methodName, { color: palette.text }]}>{title}</Text>
                    <Text style={[styles.methodMeta, { color: palette.textSecondary }]}>
                      {historyMeta(item, copy, date)}
                    </Text>
                  </View>
                  {/* Une icône de 19pt sans rôle, portant le même libellé sur les douze cartes : douze boutons « Supprimer » indiscernables. La cible fait 44 et nomme le bilan qu'elle détruit. */}
                  <LucidIconAction
                    label={`${copy.confirm}: ${title}, ${date}`}
                    icon="trash-outline"
                    tone="danger"
                    onPress={() => confirmDelete(item.id)}
                  />
                </View>
                {item.recallLevel != null || item.sleepQuality != null ? (
                  <View style={styles.historyScores}>
                    {item.recallLevel != null ? (
                      <Text style={[styles.score, { color: palette.textSecondary, backgroundColor: palette.surfaceRaised }]}>
                        {`${copy.recall}: ${item.recallLevel}/5`}
                      </Text>
                    ) : null}
                    {item.sleepQuality != null ? (
                      <Text style={[styles.score, { color: palette.textSecondary, backgroundColor: palette.surfaceRaised }]}>
                        {`${copy.sleep}: ${item.sleepQuality}/5`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {item.recallText ? (
                  <Text numberOfLines={2} style={[styles.small, { color: palette.textSecondary }]}>
                    {item.recallText}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text numberOfLines={2} style={[styles.small, { color: palette.textSecondary }]}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  methodScene: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },
  star: {
    position: 'absolute',
    width: 108,
    minHeight: 52,
    borderRadius: LucidRadius.md,
    borderWidth: 1,
    paddingHorizontal: LucidSpace.xs,
    paddingVertical: LucidSpace.xs,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starReflow: {
    position: 'relative',
    left: 'auto',
    top: 'auto',
    width: 'auto',
    marginHorizontal: LucidSpace.gutter,
    marginTop: LucidSpace.sm,
  },
  starCore: {
    width: 10,
    height: 10,
    borderRadius: LucidRadius.full,
    marginBottom: 2,
  },
  starCoreLeader: {
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: 'rgba(231, 255, 248, 0.72)',
    shadowColor: '#78E6C6',
    shadowOpacity: 0.9,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  starTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textAlign: 'center',
    textShadowColor: 'rgba(0, 10, 18, 0.92)',
    textShadowRadius: 5,
  },
  starMeta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    textAlign: 'center',
    textShadowColor: 'rgba(0, 10, 18, 0.92)',
    textShadowRadius: 5,
  },
  mainContent: {
    marginTop: -LucidSpace.xl * 2,
    paddingHorizontal: LucidSpace.gutter,
    gap: LucidSpace.lg,
  },
  heroCopy: { gap: LucidSpace.sm },
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
  subtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  overview: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LucidSpace.md,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    letterSpacing: 0.2,
  },
  trend: {
    minHeight: 28,
    borderRadius: LucidRadius.full,
    paddingHorizontal: LucidSpace.md,
    justifyContent: 'center',
  },
  trendLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  metricsReflow: { flexDirection: 'column' },
  metric: { flexBasis: '47%', flexGrow: 1, minWidth: 0, gap: LucidSpace.xs },
  metricValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  coach: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.sm,
  },
  coachText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  small: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  disclosure: {
    minHeight: 56,
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    paddingHorizontal: LucidSpace.lg,
    paddingVertical: LucidSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disclosureCopy: { flex: 1, gap: LucidSpace.xs },
  methodList: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  method: { gap: LucidSpace.sm },
  methodTop: { flexDirection: 'row', justifyContent: 'space-between', gap: LucidSpace.md },
  methodName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  methodMeta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
  bar: { height: 8, borderRadius: LucidRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: LucidRadius.full },
  emptyCard: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  empty: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    textAlign: 'center',
  },
  historyCard: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  historyCopy: { flex: 1, gap: LucidSpace.xs },
  historyScores: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  score: {
    minHeight: 28,
    borderRadius: LucidRadius.full,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.xs,
    overflow: 'hidden',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
});
