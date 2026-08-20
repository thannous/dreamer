import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LucidButton, LucidCard, LucidChoiceCard, LucidIconAction, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidRealityCheckContext, LucidRealityCheckMethod, LucidRealityCheckOutcome } from '@/lib/lucid/model';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

const METHODS: LucidRealityCheckMethod[] = ['nose_breathing', 'finger_count', 'text_reread', 'memory_trace'];
const CONTEXTS: LucidRealityCheckContext[] = ['scheduled', 'transition', 'emotion', 'dream_sign', 'spontaneous'];
const COPY = {
  en: { eyebrow: 'Mindful pause', title: 'Is this a dream?', subtitle: 'Do not perform the gesture mechanically. First reconstruct how you arrived here.', method: 'Choose a check', context: 'What prompted it?', outcome: 'What did you notice?', awake: 'Awake', dreaming: 'Dreaming', uncertain: 'Unsure', mindful: 'I paused and genuinely questioned the moment', save: 'Save reality check', saved: 'Check saved', incomplete: 'Still to answer:', confirm: 'Confirmation', nose_breathing: 'Pinch nose and breathe', finger_count: 'Count your fingers twice', text_reread: 'Read, look away, read again', memory_trace: 'Trace the last few minutes', scheduled: 'Scheduled reminder', transition: 'Place or activity change', emotion: 'Strong emotion', dream_sign: 'Personal dream sign', spontaneous: 'Spontaneous thought' },
  fr: { eyebrow: 'Pause consciente', title: 'Est-ce un rêve ?', subtitle: 'Ne faites pas le geste mécaniquement. Retracez d’abord comment vous êtes arrivé ici.', method: 'Choisissez un test', context: 'Qu’est-ce qui l’a déclenché ?', outcome: 'Qu’avez-vous observé ?', awake: 'Éveillé', dreaming: 'En rêve', uncertain: 'Incertain', mindful: 'J’ai réellement pris le temps de questionner ce moment', save: 'Enregistrer le test', saved: 'Test enregistré', incomplete: 'À renseigner :', confirm: 'Confirmation', nose_breathing: 'Pincer le nez et respirer', finger_count: 'Compter deux fois ses doigts', text_reread: 'Lire, détourner le regard, relire', memory_trace: 'Retracer les dernières minutes', scheduled: 'Rappel planifié', transition: 'Changement de lieu ou d’activité', emotion: 'Émotion forte', dream_sign: 'Signe onirique personnel', spontaneous: 'Pensée spontanée' },
  es: { eyebrow: 'Pausa consciente', title: '¿Es esto un sueño?', subtitle: 'No hagas el gesto mecánicamente. Reconstruye primero cómo llegaste aquí.', method: 'Elige una prueba', context: '¿Qué la provocó?', outcome: '¿Qué notaste?', awake: 'Despierto', dreaming: 'Soñando', uncertain: 'Inseguro', mindful: 'Me detuve y cuestioné realmente el momento', save: 'Guardar prueba', saved: 'Prueba guardada', incomplete: 'Falta responder:', confirm: 'Confirmación', nose_breathing: 'Tapar la nariz y respirar', finger_count: 'Contar los dedos dos veces', text_reread: 'Leer, apartar la vista y releer', memory_trace: 'Reconstruir los últimos minutos', scheduled: 'Recordatorio programado', transition: 'Cambio de lugar o actividad', emotion: 'Emoción fuerte', dream_sign: 'Señal onírica personal', spontaneous: 'Pensamiento espontáneo' },
  de: { eyebrow: 'Bewusste Pause', title: 'Ist das ein Traum?', subtitle: 'Führe die Geste nicht mechanisch aus. Rekonstruiere zuerst, wie du hierherkamst.', method: 'Test wählen', context: 'Was war der Auslöser?', outcome: 'Was hast du bemerkt?', awake: 'Wach', dreaming: 'Träumend', uncertain: 'Unsicher', mindful: 'Ich habe den Moment wirklich hinterfragt', save: 'Realitätscheck speichern', saved: 'Check gespeichert', incomplete: 'Noch offen:', confirm: 'Bestätigung', nose_breathing: 'Nase zuhalten und atmen', finger_count: 'Finger zweimal zählen', text_reread: 'Lesen, wegsehen, erneut lesen', memory_trace: 'Letzte Minuten nachvollziehen', scheduled: 'Geplante Erinnerung', transition: 'Orts- oder Aktivitätswechsel', emotion: 'Starke Emotion', dream_sign: 'Persönliches Traumzeichen', spontaneous: 'Spontaner Gedanke' },
  it: { eyebrow: 'Pausa consapevole', title: 'È un sogno?', subtitle: 'Non fare il gesto meccanicamente. Ricostruisci prima come sei arrivato qui.', method: 'Scegli un test', context: 'Cosa lo ha attivato?', outcome: 'Cosa hai notato?', awake: 'Sveglio', dreaming: 'In sogno', uncertain: 'Incerto', mindful: 'Mi sono fermato e ho davvero messo in dubbio il momento', save: 'Salva test', saved: 'Test salvato', incomplete: 'Ancora da indicare:', confirm: 'Conferma', nose_breathing: 'Chiudi il naso e respira', finger_count: 'Conta le dita due volte', text_reread: 'Leggi, distogli lo sguardo, rileggi', memory_trace: 'Ripercorri gli ultimi minuti', scheduled: 'Promemoria programmato', transition: 'Cambio di luogo o attività', emotion: 'Emozione forte', dream_sign: 'Segnale onirico personale', spontaneous: 'Pensiero spontaneo' },
} as const;

export default function LucidRealityCheckScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, addRealityCheck } = useLucidTrainer();
  const copy = COPY[content.locale];
  // Nothing is pre-answered: a check the user never performed must not be
  // recordable in one tap, least of all its outcome.
  const [method, setMethod] = useState<LucidRealityCheckMethod | null>(null);
  const [context, setContext] = useState<LucidRealityCheckContext | null>(null);
  const [outcome, setOutcome] = useState<LucidRealityCheckOutcome | null>(null);
  const [mindful, setMindful] = useState(false);
  const [saving, setSaving] = useState(false);
  const missing = ([method === null ? copy.method : null, context === null ? copy.context : null, outcome === null ? copy.outcome : null, mindful ? null : copy.confirm] as (string | null)[]).filter((label): label is string => label !== null);
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  // Un test de réalité est une validation rare : elle mérite le seul retour que
  // le corps perçoit sans regarder. Jamais l'unique retour — l'alerte reste.
  const save = async () => { if (method === null || context === null || outcome === null || !mindful) return; setSaving(true); try { await addRealityCheck({ method, context, outcome, mindful }); if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); Alert.alert(copy.saved, content.realityChecks.completionPrompt, [{ text: content.chrome.common.done, onPress: close }]); } finally { setSaving(false); } };
  return (
    <LucidScreen eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} trailing={<LucidIconAction label={content.chrome.common.cancel} icon="close" onPress={close} />} testID="lucid-reality-check">
      <LucidCard accent="accent"><View style={styles.focus}><View style={[styles.eye, { backgroundColor: palette.accentSoft }]}><Ionicons name="eye" size={37} color={palette.accent} /></View><Text style={[styles.focusText, { color: palette.text }]}>{content.realityChecks.qualityPrinciples[0]}</Text></View></LucidCard>
      <Text style={[styles.section, { color: palette.text }]}>{copy.method}</Text>
      {/* Trois groupes exclusifs : sans conteneur nommé, un bouton radio s'annonce sans jamais dire de quel choix il fait partie. */}
      <View accessibilityRole="radiogroup" accessibilityLabel={copy.method} style={styles.group}>{METHODS.map((item) => <LucidChoiceCard key={item} title={copy[item]} selected={method === item} onPress={() => setMethod(item)} icon={item === 'nose_breathing' ? 'fitness' : item === 'finger_count' ? 'hand-left' : item === 'text_reread' ? 'text' : 'time'} />)}</View>
      <Text style={[styles.section, { color: palette.text }]}>{copy.context}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={copy.context} style={styles.wrap}>{CONTEXTS.map((item) => <LucidPillButton key={item} label={copy[item]} groupLabel={copy.context} selected={context === item} onPress={() => setContext(item)} />)}</View>
      <Text style={[styles.section, { color: palette.text }]}>{copy.outcome}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={copy.outcome} style={styles.outcomes}>{(['awake', 'dreaming', 'uncertain'] as const).map((item) => <LucidPillButton key={item} label={copy[item]} groupLabel={copy.outcome} selected={outcome === item} onPress={() => setOutcome(item)} />)}</View>
      {/* Une case isolée, pas un groupe : `checkbox`, pas `radio`. */}
      <LucidChoiceCard title={copy.mindful} role="checkbox" selected={mindful} onPress={() => setMindful((value) => !value)} icon="sparkles" />
      <LucidButton label={copy.save} icon="checkmark" disabled={missing.length > 0} disabledReason={`${copy.incomplete} ${missing.join(', ')}`} loading={saving} onPress={() => void save()} testID="lucid-reality-save" />
    </LucidScreen>
  );
}

// Un `<Text onPress>` de 34pt sans état pressé : une dizaine de contrôles qu'on
// vise mal et qui ne répondent pas au doigt. Pressable, 44 de haut, et la teinte
// remplit sans écrire — le libellé sélectionné passe sur `accentOn`.
function LucidPillButton({ label, groupLabel, selected, onPress }: { label: string; groupLabel: string; selected: boolean; onPress: () => void }) {
  const { colors, mode } = useTheme(); const palette = getLucidPalette(colors, mode);
  return <Pressable accessibilityRole="radio" accessibilityLabel={`${groupLabel}, ${label}`} accessibilityState={{ selected, checked: selected }} onPress={onPress} style={({ pressed }) => [styles.pillButton, { backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised, borderColor: selected ? palette.accent : palette.borderInteractive, opacity: pressed ? 0.78 : 1 }]}><Text style={[styles.pillButtonLabel, { color: selected ? palette.accentOn : palette.textSecondary }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({ focus: { alignItems: 'center', gap: 14, paddingVertical: 5 }, eye: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, focusText: { fontFamily: 'Fraunces_500Medium', fontSize: 18, lineHeight: 25, textAlign: 'center' }, section: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, marginTop: 4 }, group: { gap: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, outcomes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pillButton: { minHeight: 44, justifyContent: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 }, pillButtonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12 } });
