import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidChoiceCard,
  LucidProgressBar,
  LucidScreen,
  LucidToggleRow,
} from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type {
  LucidExperienceLevel,
  LucidGoal,
  LucidPermissionState,
} from '@/lib/lucid/model';
import { isLucidLocalTime } from '@/lib/lucid/model';
import { LUCID_HOME_HREF } from '@/lib/lucid/routes';
import { reconcileLucidTrainerReminders } from '@/services/lucidTrainerNotifications';

const STEP_COUNT = 7;

const LOCAL = {
  en: { step: 'Step', goal: 'Choose one goal', experience: 'Choose your level', reminders: 'Practice rhythm', sleep: 'Your sleep window', permissions: 'Notifications, when useful', access: 'Comfort and access', consent: 'Your choices', bed: 'Bedtime', wake: 'Wake time', enable: 'Enable notifications', later: 'Not now', analytics: 'Share minimal product analytics', cloud: 'Sync with my Noctalia account', link: 'Allow a minimal handoff to Noctalia', safety: 'I will keep sound low and stop if it disturbs sleep', reduceMotion: 'Reduce motion', largerText: 'Use larger text', screenReader: 'Optimize labels for a screen reader', invalidTime: 'Use a valid 24-hour time such as 22:30.', finish: 'Set up my trainer', days: 'days / week' },
  fr: { step: 'Étape', goal: 'Choisissez un objectif', experience: 'Votre expérience', reminders: 'Rythme d’entraînement', sleep: 'Votre fenêtre de sommeil', permissions: 'Des notifications, au bon moment', access: 'Confort et accessibilité', consent: 'Vos choix', bed: 'Coucher', wake: 'Réveil', enable: 'Activer les notifications', later: 'Plus tard', analytics: 'Partager des analytics produit minimales', cloud: 'Synchroniser avec mon compte Noctalia', link: 'Autoriser un transfert minimal vers Noctalia', safety: 'Je garderai un volume bas et arrêterai si mon sommeil est perturbé', reduceMotion: 'Réduire les animations', largerText: 'Utiliser un texte plus grand', screenReader: 'Optimiser les libellés pour un lecteur d’écran', invalidTime: 'Utilisez une heure valide au format 24 h, par exemple 22:30.', finish: 'Configurer mon entraînement', days: 'jours / semaine' },
  es: { step: 'Paso', goal: 'Elige un objetivo', experience: 'Tu experiencia', reminders: 'Ritmo de práctica', sleep: 'Tu horario de sueño', permissions: 'Notificaciones, cuando ayuden', access: 'Comodidad y accesibilidad', consent: 'Tus decisiones', bed: 'Hora de dormir', wake: 'Hora de despertar', enable: 'Activar notificaciones', later: 'Ahora no', analytics: 'Compartir analítica mínima del producto', cloud: 'Sincronizar con mi cuenta Noctalia', link: 'Permitir una transferencia mínima a Noctalia', safety: 'Mantendré el volumen bajo y pararé si altera mi sueño', reduceMotion: 'Reducir las animaciones', largerText: 'Usar texto más grande', screenReader: 'Optimizar etiquetas para lector de pantalla', invalidTime: 'Usa una hora válida de 24 horas, por ejemplo 22:30.', finish: 'Configurar mi entrenamiento', days: 'días / semana' },
  de: { step: 'Schritt', goal: 'Wähle ein Ziel', experience: 'Deine Erfahrung', reminders: 'Übungsrhythmus', sleep: 'Dein Schlaffenster', permissions: 'Benachrichtigungen, wenn sie helfen', access: 'Komfort und Barrierefreiheit', consent: 'Deine Entscheidungen', bed: 'Schlafenszeit', wake: 'Aufstehzeit', enable: 'Benachrichtigungen aktivieren', later: 'Jetzt nicht', analytics: 'Minimale Produktanalyse teilen', cloud: 'Mit meinem Noctalia-Konto synchronisieren', link: 'Minimale Übergabe an Noctalia erlauben', safety: 'Ich halte die Lautstärke niedrig und stoppe bei Schlafstörungen', reduceMotion: 'Bewegung reduzieren', largerText: 'Größeren Text verwenden', screenReader: 'Beschriftungen für Screenreader optimieren', invalidTime: 'Nutze eine gültige 24-Stunden-Zeit, zum Beispiel 22:30.', finish: 'Training einrichten', days: 'Tage / Woche' },
  it: { step: 'Passaggio', goal: 'Scegli un obiettivo', experience: 'La tua esperienza', reminders: 'Ritmo di pratica', sleep: 'La tua finestra di sonno', permissions: 'Notifiche, quando servono', access: 'Comfort e accessibilità', consent: 'Le tue scelte', bed: 'Ora di dormire', wake: 'Ora di sveglia', enable: 'Attiva notifiche', later: 'Non ora', analytics: 'Condividi analisi minime del prodotto', cloud: 'Sincronizza con il mio account Noctalia', link: 'Consenti un passaggio minimo a Noctalia', safety: 'Terrò il volume basso e interromperò se disturba il sonno', reduceMotion: 'Riduci le animazioni', largerText: 'Usa testo più grande', screenReader: 'Ottimizza le etichette per lo screen reader', invalidTime: 'Usa un orario valido di 24 ore, per esempio 22:30.', finish: 'Configura il mio training', days: 'giorni / settimana' },
} as const;

export default function LucidOnboardingScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, completeOnboarding, updatePreferences } = useLucidTrainer();
  const locale = content.locale;
  const copy = LOCAL[locale];
  const initial = state!.onboarding;
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<LucidGoal | null>(initial.goal);
  const [experience, setExperience] = useState<LucidExperienceLevel | null>(initial.experience);
  const [weeklyTarget, setWeeklyTarget] = useState(initial.weeklyTarget);
  const [bedtime, setBedtime] = useState(initial.sleepSchedule.bedtime);
  const [wakeTime, setWakeTime] = useState(initial.sleepSchedule.wakeTime);
  const [notificationPermission, setNotificationPermission] = useState<LucidPermissionState>(initial.notificationsPermission);
  const [notificationExplained, setNotificationExplained] = useState(initial.notificationsExplained);
  const [reduceMotion, setReduceMotion] = useState(initial.accessibility.reduceMotion);
  const [analyticsConsent, setAnalyticsConsent] = useState(initial.analyticsConsent ?? false);
  const [audioSafetyAccepted, setAudioSafetyAccepted] = useState(initial.audioSafetyAccepted);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [noctaliaLinkEnabled, setNoctaliaLinkEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const timeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }, []);

  const canContinue =
    (step !== 1 || goal !== null) &&
    (step !== 2 || experience !== null) &&
    (step !== 4 || (isLucidLocalTime(bedtime) && isLucidLocalTime(wakeTime)));

  const requestNotifications = async () => {
    setNotificationExplained(true);
    const result = await reconcileLucidTrainerReminders(
      { version: 1, timeZone, reminders: [] },
      { requestPermissionIfNeeded: true }
    );
    setNotificationPermission(result.permission === 'granted' ? 'granted' : result.permission === 'denied' ? 'denied' : 'unknown');
  };

  const next = async () => {
    if (step === 4 && !canContinue) {
      Alert.alert(content.chrome.appName, copy.invalidTime);
      return;
    }
    if (step < STEP_COUNT - 1) {
      setStep((value) => value + 1);
      return;
    }
    if (!goal || !experience) return;
    setSaving(true);
    try {
      await completeOnboarding({
        goal,
        experience,
        weeklyTarget,
        sleepSchedule: { bedtime, wakeTime, timeZone },
        notificationsPermission: notificationPermission,
        notificationsExplained: notificationExplained,
        audioSafetyAccepted,
        analyticsConsent,
        accessibility: {
          reduceMotion,
          // Text scaling and screen-reader semantics follow the operating system;
          // they are not app-specific modes that users need to enable here.
          largerText: initial.accessibility.largerText,
          screenReaderOptimized: initial.accessibility.screenReaderOptimized,
        },
      });
      await updatePreferences({ cloudSyncEnabled, noctaliaLinkEnabled });
      router.replace(LUCID_HOME_HREF);
    } finally {
      setSaving(false);
    }
  };

  const titles = [content.onboarding.title, copy.goal, copy.experience, copy.reminders, copy.sleep, copy.permissions, copy.consent];

  return (
    <LucidScreen
      testID="lucid-onboarding"
      eyebrow={`${copy.step} ${step + 1} / ${STEP_COUNT}`}
      title={titles[step]}
      subtitle={step === 0 ? content.onboarding.intro : undefined}
    >
      <LucidProgressBar value={(step + 1) / STEP_COUNT} accessibilityLabel={titles[step]} />

      {step === 0 ? (
        <>
          <LucidCard accent="violet">
            <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="moon" size={34} color={palette.accent} />
            </View>
            <Text style={[styles.heroTitle, { color: palette.text }]}>{content.chrome.tagline}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{content.onboarding.wellbeingNotice}</Text>
          </LucidCard>
          {content.onboarding.consentItems.slice(0, 3).map((item) => (
            <View key={item} style={styles.pointRow}>
              <Ionicons name="checkmark-circle" size={20} color={palette.cyan} />
              <Text style={[styles.pointText, { color: palette.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </>
      ) : null}

      {step === 1 ? content.onboarding.goals.map((choice, index) => (
        <LucidChoiceCard key={choice.id} testID={`lucid-goal-${choice.id}`} title={choice.title} description={choice.description} selected={goal === choice.id} onPress={() => setGoal(choice.id)} icon={(['sparkles', 'repeat', 'shield-checkmark', 'book'] as const)[index] ?? 'moon'} />
      )) : null}

      {step === 2 ? content.onboarding.experienceLevels.map((choice, index) => (
        <LucidChoiceCard key={choice.id} testID={`lucid-experience-${choice.id}`} title={choice.title} description={choice.description} selected={experience === choice.id} onPress={() => setExperience(choice.id)} icon={(['leaf', 'compass', 'telescope'] as const)[index] ?? 'star'} />
      )) : null}

      {step === 3 ? (
        <LucidCard>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{content.onboarding.reminderExplanation}</Text>
          <View accessibilityRole="radiogroup" style={styles.frequencyRow}>
            {[2, 3, 5, 7].map((value) => (
              <Pressable key={value} testID={`lucid-weekly-target-${value}`} accessibilityRole="radio" accessibilityState={{ selected: weeklyTarget === value }} onPress={() => setWeeklyTarget(value)} style={[styles.frequency, { backgroundColor: weeklyTarget === value ? palette.accentSoft : palette.surfaceRaised, borderColor: weeklyTarget === value ? palette.accent : palette.border }]}>
                <Text style={[styles.frequencyValue, { color: weeklyTarget === value ? palette.accent : palette.text }]}>{value}</Text>
                <Text style={[styles.frequencyLabel, { color: palette.textSecondary }]}>{copy.days}</Text>
              </Pressable>
            ))}
          </View>
        </LucidCard>
      ) : null}

      {step === 4 ? (
        <LucidCard>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{content.onboarding.sleepScheduleExplanation}</Text>
          <View style={styles.timeRow}>
            <TimeField label={copy.bed} value={bedtime} onChange={setBedtime} />
            <TimeField label={copy.wake} value={wakeTime} onChange={setWakeTime} />
          </View>
          <View style={styles.pointRow}>
            <Ionicons name="globe-outline" size={19} color={palette.cyan} />
            <Text style={[styles.pointText, { color: palette.textSecondary }]}>{timeZone}</Text>
          </View>
        </LucidCard>
      ) : null}

      {step === 5 ? (
        <>
          <LucidCard accent="cyan">
            <Text style={[styles.heroTitle, { color: palette.text }]}>{content.onboarding.permissionsTitle}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{content.onboarding.notificationPermission}</Text>
            {notificationPermission === 'granted' ? (
              <View style={styles.pointRow}>
                <Ionicons name="checkmark-circle" size={20} color={palette.success} />
                <Text style={[styles.pointText, { color: palette.success }]}>{copy.enable}</Text>
              </View>
            ) : (
              <LucidButton label={copy.enable} icon="notifications" onPress={() => void requestNotifications()} />
            )}
            <LucidButton label={copy.later} variant="ghost" onPress={() => { setNotificationExplained(true); setNotificationPermission('unknown'); }} />
          </LucidCard>
          <LucidCard>
            <Text style={[styles.heroTitle, { color: palette.text }]}>{content.onboarding.accessibilityTitle}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{content.onboarding.accessibilityBody}</Text>
            <LucidToggleRow title={copy.reduceMotion} value={reduceMotion} onValueChange={setReduceMotion} icon="accessibility" />
          </LucidCard>
        </>
      ) : null}

      {step === 6 ? (
        <LucidCard>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{content.privacy.localFirst}</Text>
          <LucidToggleRow title={copy.analytics} description={content.privacy.analytics} value={analyticsConsent} onValueChange={setAnalyticsConsent} icon="analytics" />
          <LucidToggleRow title={copy.cloud} description={content.privacy.optionalSync} value={cloudSyncEnabled} onValueChange={setCloudSyncEnabled} icon="cloud-upload" />
          <LucidToggleRow title={copy.link} description={content.privacy.minimalTransfer} value={noctaliaLinkEnabled} onValueChange={setNoctaliaLinkEnabled} icon="link" />
          <LucidToggleRow title={copy.safety} description={content.onboarding.audioPermission} value={audioSafetyAccepted} onValueChange={setAudioSafetyAccepted} icon="volume-low" />
        </LucidCard>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? <LucidButton label={content.chrome.common.back} variant="secondary" onPress={() => setStep((value) => value - 1)} /> : null}
        <View style={styles.primaryAction}>
          <LucidButton label={step === STEP_COUNT - 1 ? copy.finish : content.chrome.common.continue} disabled={!canContinue} loading={saving} onPress={() => void next()} icon={step === STEP_COUNT - 1 ? 'sparkles' : 'arrow-forward'} testID="lucid-onboarding-continue" />
        </View>
      </View>
    </LucidScreen>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.timeField}>
      <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType="numbers-and-punctuation" maxLength={5} onChangeText={onChange} placeholder="22:30" placeholderTextColor={palette.textMuted} selectTextOnFocus style={[styles.timeInput, { backgroundColor: palette.surfaceRaised, borderColor: isLucidLocalTime(value) ? palette.border : palette.danger, color: palette.text }]} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, lineHeight: 28 },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 21 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  frequency: { flexGrow: 1, minWidth: 115, borderRadius: 17, borderWidth: 1, padding: 14, gap: 3 },
  frequencyValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26 },
  frequencyLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1, gap: 7 },
  fieldLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12 },
  timeInput: { minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryAction: { flex: 1 },
});
