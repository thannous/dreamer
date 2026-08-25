import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LucidButton, LucidCard, LucidIconAction, LucidPill, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidExperimentResult, LucidPersonalFactor, LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

const FACTORS: LucidPersonalFactor[] = ['stress', 'alcohol', 'caffeine_late', 'exercise', 'screen_late', 'sleep_debt', 'unusual_schedule'];
const TECHNIQUES: LucidTechnique[] = ['mild', 'ssild', 'wbtb'];
const RESULTS: LucidExperimentResult[] = ['none', 'pre_lucid', 'lucid'];
const PREP_MINUTES = [0, 5, 10, 20, 30];
const COPY = {
  en: { eyebrow: 'On waking', title: 'Notice, don’t judge', technique: 'Technique', prep: 'Preparation', minutes: 'minutes', result: 'Result', none: 'No lucidity', pre_lucid: 'Almost lucid', lucid: 'Lucid', recall: 'Dream recall', lucidity: 'Lucidity', sleep: 'Sleep quality', factors: 'Personal factors', notes: 'Optional notes', placeholder: 'A few neutral details…', save: 'Save morning review', saved: 'Saved offline', stress: 'Stress', alcohol: 'Alcohol', caffeine_late: 'Late caffeine', exercise: 'Exercise', screen_late: 'Late screen', sleep_debt: 'Sleep debt', unusual_schedule: 'Unusual schedule', scoreUnset: '-', needTechnique: 'Choose last night’s technique first', needPrep: 'Choose how long you prepared', needResult: 'Choose the result first', needRecall: 'Choose dream recall first', needSleep: 'Choose sleep quality first', needLucidity: 'Choose lucidity first' },
  fr: { eyebrow: 'Au réveil', title: 'Observez, sans juger', technique: 'Technique', prep: 'Préparation', minutes: 'minutes', result: 'Résultat', none: 'Pas de lucidité', pre_lucid: 'Presque lucide', lucid: 'Lucide', recall: 'Rappel du rêve', lucidity: 'Lucidité', sleep: 'Qualité du sommeil', factors: 'Facteurs personnels', notes: 'Notes facultatives', placeholder: 'Quelques détails neutres…', save: 'Enregistrer le bilan', saved: 'Enregistré hors ligne', stress: 'Stress', alcohol: 'Alcool', caffeine_late: 'Caféine tardive', exercise: 'Exercice', screen_late: 'Écran tardif', sleep_debt: 'Dette de sommeil', unusual_schedule: 'Horaire inhabituel', scoreUnset: '-', needTechnique: 'Choisissez d’abord la technique de la veille', needPrep: 'Choisissez d’abord la durée de préparation', needResult: 'Choisissez d’abord le résultat', needRecall: 'Choisissez d’abord le rappel du rêve', needSleep: 'Choisissez d’abord la qualité du sommeil', needLucidity: 'Choisissez d’abord la lucidité' },
  es: { eyebrow: 'Al despertar', title: 'Observa, no juzgues', technique: 'Técnica', prep: 'Preparación', minutes: 'minutos', result: 'Resultado', none: 'Sin lucidez', pre_lucid: 'Casi lúcido', lucid: 'Lúcido', recall: 'Recuerdo', lucidity: 'Lucidez', sleep: 'Calidad del sueño', factors: 'Factores personales', notes: 'Notas opcionales', placeholder: 'Algunos detalles neutrales…', save: 'Guardar revisión', saved: 'Guardado sin conexión', stress: 'Estrés', alcohol: 'Alcohol', caffeine_late: 'Cafeína tardía', exercise: 'Ejercicio', screen_late: 'Pantalla tardía', sleep_debt: 'Deuda de sueño', unusual_schedule: 'Horario inusual', scoreUnset: '-', needTechnique: 'Elige primero la técnica de anoche', needPrep: 'Elige primero cuánto te preparaste', needResult: 'Elige primero el resultado', needRecall: 'Elige primero el recuerdo del sueño', needSleep: 'Elige primero la calidad del sueño', needLucidity: 'Elige primero la lucidez' },
  de: { eyebrow: 'Beim Aufwachen', title: 'Beobachten, nicht bewerten', technique: 'Technik', prep: 'Vorbereitung', minutes: 'Minuten', result: 'Ergebnis', none: 'Keine Klarheit', pre_lucid: 'Fast klar', lucid: 'Klar', recall: 'Traumerinnerung', lucidity: 'Klarheit', sleep: 'Schlafqualität', factors: 'Persönliche Faktoren', notes: 'Optionale Notizen', placeholder: 'Einige neutrale Details…', save: 'Morgenrückblick speichern', saved: 'Offline gespeichert', stress: 'Stress', alcohol: 'Alkohol', caffeine_late: 'Spätes Koffein', exercise: 'Bewegung', screen_late: 'Später Bildschirm', sleep_debt: 'Schlafdefizit', unusual_schedule: 'Ungewöhnlicher Rhythmus', scoreUnset: '-', needTechnique: 'Wähle zuerst die Technik der letzten Nacht', needPrep: 'Wähle zuerst die Vorbereitungszeit', needResult: 'Wähle zuerst das Ergebnis', needRecall: 'Wähle zuerst die Traumerinnerung', needSleep: 'Wähle zuerst die Schlafqualität', needLucidity: 'Wähle zuerst die Klarheit' },
  it: { eyebrow: 'Al risveglio', title: 'Osserva, non giudicare', technique: 'Tecnica', prep: 'Preparazione', minutes: 'minuti', result: 'Risultato', none: 'Nessuna lucidità', pre_lucid: 'Quasi lucido', lucid: 'Lucido', recall: 'Ricordo', lucidity: 'Lucidità', sleep: 'Qualità del sonno', factors: 'Fattori personali', notes: 'Note facoltative', placeholder: 'Alcuni dettagli neutrali…', save: 'Salva bilancio', saved: 'Salvato offline', stress: 'Stress', alcohol: 'Alcol', caffeine_late: 'Caffeina tardiva', exercise: 'Esercizio', screen_late: 'Schermo tardivo', sleep_debt: 'Debito di sonno', unusual_schedule: 'Orario insolito', scoreUnset: '-', needTechnique: 'Scegli prima la tecnica della notte scorsa', needPrep: 'Scegli prima quanto ti sei preparato', needResult: 'Scegli prima il risultato', needRecall: 'Scegli prima il ricordo del sogno', needSleep: 'Scegli prima la qualità del sonno', needLucidity: 'Scegli prima la lucidità' },
} as const;

type MorningCopy = (typeof COPY)[keyof typeof COPY];

export default function LucidMorningScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, addExperiment } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [technique, setTechnique] = useState<LucidTechnique | null>(null);
  const [preparationMinutes, setPreparationMinutes] = useState<number | null>(null);
  const [result, setResult] = useState<LucidExperimentResult | null>(null);
  const [lucidityLevel, setLucidityLevel] = useState<number | null>(null);
  const [recallLevel, setRecallLevel] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [factors, setFactors] = useState<LucidPersonalFactor[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const disabledReason = getMorningDisabledReason({ copy, technique, preparationMinutes, result, recallLevel, sleepQuality, lucidityLevel });
  const toggleFactor = (factor: LucidPersonalFactor) => setFactors((items) => items.includes(factor) ? items.filter((item) => item !== factor) : [...items, factor]);
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  const save = async () => {
    if (technique == null || preparationMinutes == null || result == null || recallLevel == null || sleepQuality == null) return;
    const resolvedLucidityLevel = result === 'none' ? 0 : lucidityLevel;
    if (resolvedLucidityLevel == null) return;
    setSaving(true);
    try {
      await addExperiment({
        technique,
        preparationMinutes,
        result,
        lucidityLevel: resolvedLucidityLevel,
        recallLevel,
        sleepQuality,
        factors,
        notes: notes.trim() || undefined,
      });
      Alert.alert(copy.saved, content.morningReview.saveOfflineNote, [{ text: content.chrome.common.done, onPress: close }]);
    } finally {
      setSaving(false);
    }
  };
  return (
    <LucidScreen eyebrow={copy.eyebrow} title={copy.title} subtitle={content.morningReview.intro} trailing={<LucidIconAction label={content.chrome.common.cancel} icon="close" onPress={close} />} testID="lucid-morning">
      <LucidCard accent="amber"><View style={styles.sun}><View style={[styles.sunIcon, { backgroundColor: palette.amberSoft }]}><Ionicons name="sunny" size={33} color={palette.amber} /></View><Text style={[styles.neutral, { color: palette.text }]}>{content.morningReview.neutralOutcome}</Text></View></LucidCard>
      <FieldTitle text={copy.technique} />
      <View style={styles.row}>{TECHNIQUES.map((item) => <SelectChip key={item} label={content.programs[item].title} selected={technique === item} onPress={() => setTechnique(item)} />)}</View>
      <FieldTitle text={copy.prep} /><View style={styles.row}>{PREP_MINUTES.map((value) => <SelectChip key={value} label={`${value} ${copy.minutes}`} selected={preparationMinutes === value} onPress={() => setPreparationMinutes(value)} />)}</View>
      <FieldTitle text={copy.result} /><View style={styles.row}>{RESULTS.map((item) => <SelectChip key={item} label={copy[item]} selected={result === item} onPress={() => setResult(item)} />)}</View>
      <Score title={copy.recall} unsetLabel={copy.scoreUnset} value={recallLevel} onChange={setRecallLevel} />
      {result != null && result !== 'none' ? <Score title={copy.lucidity} unsetLabel={copy.scoreUnset} value={lucidityLevel} onChange={setLucidityLevel} /> : null}
      <Score title={copy.sleep} unsetLabel={copy.scoreUnset} value={sleepQuality} onChange={setSleepQuality} />
      <FieldTitle text={copy.factors} /><View style={styles.row}>{FACTORS.map((factor) => <SelectChip key={factor} label={copy[factor]} selected={factors.includes(factor)} onPress={() => toggleFactor(factor)} />)}</View>
      <FieldTitle text={copy.notes} /><TextInput accessibilityLabel={copy.notes} multiline maxLength={4000} onChangeText={setNotes} placeholder={copy.placeholder} placeholderTextColor={palette.textMuted} style={[styles.notes, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]} textAlignVertical="top" value={notes} />
      <LucidButton label={copy.save} icon="checkmark" disabled={Boolean(disabledReason)} disabledReason={disabledReason} loading={saving} onPress={() => void save()} testID="lucid-morning-save" />
    </LucidScreen>
  );
}

function getMorningDisabledReason({
  copy,
  technique,
  preparationMinutes,
  result,
  recallLevel,
  sleepQuality,
  lucidityLevel,
}: {
  copy: MorningCopy;
  technique: LucidTechnique | null;
  preparationMinutes: number | null;
  result: LucidExperimentResult | null;
  recallLevel: number | null;
  sleepQuality: number | null;
  lucidityLevel: number | null;
}) {
  if (technique == null) return copy.needTechnique;
  if (preparationMinutes == null) return copy.needPrep;
  if (result == null) return copy.needResult;
  if (recallLevel == null) return copy.needRecall;
  if (sleepQuality == null) return copy.needSleep;
  if (result !== 'none' && lucidityLevel == null) return copy.needLucidity;
  return undefined;
}

function FieldTitle({ text }: { text: string }) { const { colors, mode } = useTheme(); const palette = getLucidPalette(colors, mode); return <Text style={[styles.fieldTitle, { color: palette.text }]}>{text}</Text>; }
function SelectChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { const { colors, mode } = useTheme(); const palette = getLucidPalette(colors, mode); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised, borderColor: selected ? palette.accent : palette.border }]}><Text style={[styles.chipText, { color: selected ? palette.accent : palette.textSecondary }]}>{label}</Text></Pressable>; }
function Score({ title, unsetLabel, value, onChange }: { title: string; unsetLabel: string; value: number | null; onChange: (value: number) => void }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const selected = value != null;
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreTop}>
        <FieldTitle text={title} />
        <LucidPill label={`${selected ? value : unsetLabel} / 5`} tone={selected && value >= 4 ? 'cyan' : 'neutral'} />
      </View>
      <View style={styles.scoreRow}>{[0, 1, 2, 3, 4, 5].map((score) => {
        const isSelected = selected && score === value;
        return (
          <Pressable key={score} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} onPress={() => onChange(score)} style={[styles.score, { backgroundColor: isSelected ? palette.cyan : palette.surfaceRaised }]}>
            <Text style={[styles.scoreText, { color: isSelected ? palette.backgroundDeep : palette.textSecondary }]}>{score}</Text>
          </Pressable>
        );
      })}</View>
    </View>
  );
}
const styles = StyleSheet.create({ sun: { alignItems: 'center', gap: 12 }, sunIcon: { width: 66, height: 66, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, neutral: { fontFamily: 'Fraunces_500Medium', fontSize: 17, lineHeight: 24, textAlign: 'center' }, fieldTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, chipText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11 }, scoreBlock: { gap: 10 }, scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, scoreRow: { flexDirection: 'row', gap: 7 }, score: { flex: 1, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, scoreText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 }, notes: { minHeight: 120, borderRadius: 18, borderWidth: 1, padding: 15, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 20 } });
