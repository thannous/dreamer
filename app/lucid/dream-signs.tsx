import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import {
  getLucidPalette,
  LucidIcon,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useDreamsData } from '@/context/DreamsContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { reconcileLucidDreamSignDecisions } from '@/lib/lucid/dreamSigns';
import type { LucidDreamSignDecision } from '@/lib/lucid/model';

const COPY = {
  en: {
    eyebrow: 'Your dream memory', title: 'Dream signs', subtitle: 'Review recurring patterns before they influence your training.',
    close: 'Close', candidates: 'Patterns to review', confirmed: 'Confirmed', rejected: 'Dismissed', pending: 'To review',
    frequency: (count: number) => `Seen in ${count} ${count === 1 ? 'dream' : 'dreams'}`,
    sources: 'Source dreams', rename: 'Personal name (optional)', confirm: 'Confirm sign', reject: 'Not a sign', reconsider: 'Review again',
    empty: 'Record at least two dreams with a recurring detail to see a suggestion here.',
    privacy: 'Suggestions are calculated on this device. Nothing is sent for analysis.',
    sourceFallback: 'Recorded dream', saved: 'Saved',
  },
  fr: {
    eyebrow: 'Ta mémoire onirique', title: 'Signes oniriques', subtitle: 'Examine les motifs récurrents avant qu’ils influencent ton entraînement.',
    close: 'Fermer', candidates: 'Motifs à examiner', confirmed: 'Confirmé', rejected: 'Écarté', pending: 'À examiner',
    frequency: (count: number) => `Vu dans ${count} rêve${count > 1 ? 's' : ''}`,
    sources: 'Rêves sources', rename: 'Nom personnel (facultatif)', confirm: 'Confirmer le signe', reject: 'Ce n’est pas un signe', reconsider: 'Réexaminer',
    empty: 'Enregistre au moins deux rêves avec un détail récurrent pour voir une suggestion ici.',
    privacy: 'Les suggestions sont calculées sur cet appareil. Rien n’est envoyé pour analyse.',
    sourceFallback: 'Rêve enregistré', saved: 'Enregistré',
  },
  es: {
    eyebrow: 'Tu memoria onírica', title: 'Señales oníricas', subtitle: 'Revisa los patrones recurrentes antes de que influyan en tu entrenamiento.',
    close: 'Cerrar', candidates: 'Patrones por revisar', confirmed: 'Confirmada', rejected: 'Descartada', pending: 'Por revisar',
    frequency: (count: number) => `Aparece en ${count} ${count === 1 ? 'sueño' : 'sueños'}`,
    sources: 'Sueños de origen', rename: 'Nombre personal (opcional)', confirm: 'Confirmar señal', reject: 'No es una señal', reconsider: 'Revisar de nuevo',
    empty: 'Registra al menos dos sueños con un detalle recurrente para ver una sugerencia aquí.',
    privacy: 'Las sugerencias se calculan en este dispositivo. No se envía nada para análisis.',
    sourceFallback: 'Sueño registrado', saved: 'Guardado',
  },
  de: {
    eyebrow: 'Deine Traumerinnerung', title: 'Traumzeichen', subtitle: 'Prüfe wiederkehrende Muster, bevor sie dein Training beeinflussen.',
    close: 'Schließen', candidates: 'Muster zum Prüfen', confirmed: 'Bestätigt', rejected: 'Verworfen', pending: 'Zu prüfen',
    frequency: (count: number) => `In ${count} ${count === 1 ? 'Traum' : 'Träumen'} gesehen`,
    sources: 'Quellträume', rename: 'Persönlicher Name (optional)', confirm: 'Zeichen bestätigen', reject: 'Kein Zeichen', reconsider: 'Erneut prüfen',
    empty: 'Erfasse mindestens zwei Träume mit einem wiederkehrenden Detail, um hier einen Vorschlag zu sehen.',
    privacy: 'Vorschläge werden auf diesem Gerät berechnet. Nichts wird zur Analyse gesendet.',
    sourceFallback: 'Gespeicherter Traum', saved: 'Gespeichert',
  },
  it: {
    eyebrow: 'La tua memoria onirica', title: 'Segnali onirici', subtitle: 'Rivedi gli schemi ricorrenti prima che influenzino l’allenamento.',
    close: 'Chiudi', candidates: 'Schemi da rivedere', confirmed: 'Confermato', rejected: 'Scartato', pending: 'Da rivedere',
    frequency: (count: number) => `Presente in ${count} ${count === 1 ? 'sogno' : 'sogni'}`,
    sources: 'Sogni di origine', rename: 'Nome personale (facoltativo)', confirm: 'Conferma segnale', reject: 'Non è un segnale', reconsider: 'Rivedi',
    empty: 'Registra almeno due sogni con un dettaglio ricorrente per vedere un suggerimento qui.',
    privacy: 'I suggerimenti vengono calcolati su questo dispositivo. Nulla viene inviato per l’analisi.',
    sourceFallback: 'Sogno registrato', saved: 'Salvato',
  },
} as const;

function decisionTone(decision: LucidDreamSignDecision) {
  return decision === 'confirmed' ? 'accent' as const : decision === 'rejected' ? 'neutral' as const : 'amber' as const;
}

export default function LucidDreamSignsScreen() {
  const { dreams, loaded } = useDreamsData();
  const { content, state, dreamSignCandidates, saveDreamSignDecision } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const reconciled = useMemo(
    () => reconcileLucidDreamSignDecisions(dreamSignCandidates, state?.dreamSignDecisions ?? []),
    [dreamSignCandidates, state?.dreamSignDecisions]
  );
  const dreamsById = useMemo(
    () => new Map(dreams.map((dream) => [String(dream.id), dream] as const)),
    [dreams]
  );

  const save = async (
    sign: (typeof reconciled)[number],
    decision: LucidDreamSignDecision
  ) => {
    setSavingId(sign.id);
    setSavedId(null);
    try {
      await saveDreamSignDecision({
        id: sign.id,
        decision,
        customLabel: labels[sign.id] ?? sign.displayLabel,
        sourceDreamIds: sign.sourceDreamIds,
      });
      setSavedId(sign.id);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      subtitle={copy.subtitle}
      testID="lucid-dream-signs"
      title={copy.title}
      trailing={<LucidIconAction icon="close" label={copy.close} onPress={() => router.back()} />}
    >
      <LucidCard accent="accent" style={styles.privacyCard}>
        <Ionicons color={palette.accent} name="phone-portrait-outline" size={LucidIcon.md} />
        <Text style={[styles.body, styles.privacyCopy, { color: palette.textSecondary }]}>{copy.privacy}</Text>
      </LucidCard>

      <LucidSectionHeader
        action={<LucidPill label={String(reconciled.length)} tone="neutral" />}
        title={copy.candidates}
      />

      {!loaded ? (
        <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: palette.textSecondary }]}>
          {content.chrome.common.loading}
        </Text>
      ) : null}
      {loaded && reconciled.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>{copy.empty}</Text>
      ) : null}

      {reconciled.map((sign) => {
        const persisted = state?.dreamSignDecisions?.find((item) => item.id === sign.id);
        const inputValue = labels[sign.id] ?? persisted?.customLabel ?? sign.label;
        const busy = savingId === sign.id;
        const statusLabel = sign.decision === 'confirmed'
          ? copy.confirmed
          : sign.decision === 'rejected'
            ? copy.rejected
            : copy.pending;
        return (
          <LucidCard key={sign.id} style={styles.signCard} testID={`lucid-dream-sign-${sign.id}`}>
            <View style={styles.signHeader}>
              <View style={styles.signTitleBlock}>
                <Text style={[styles.signTitle, { color: palette.text }]}>{sign.displayLabel}</Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  {copy.frequency(sign.distinctDreamCount)}
                </Text>
              </View>
              <LucidPill label={savedId === sign.id ? copy.saved : statusLabel} tone={decisionTone(sign.decision)} />
            </View>

            <Text style={[styles.label, { color: palette.textMuted }]}>{copy.sources}</Text>
            <View style={styles.sources}>
              {sign.sourceDreamIds.map((sourceId) => {
                const dream = dreamsById.get(sourceId);
                const sourceTitle = dream?.title?.trim() || copy.sourceFallback;
                return (
                  <Pressable
                    accessibilityRole="link"
                    key={sourceId}
                    onPress={() => router.push(`/journal/${sourceId}`)}
                    style={({ pressed }) => [
                      styles.source,
                      { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive },
                      pressed && styles.pressed,
                    ]}
                    testID={`lucid-dream-sign-source-${sourceId}`}
                  >
                    <Ionicons color={palette.accent} name="book-outline" size={LucidIcon.sm} />
                    <Text numberOfLines={1} style={[styles.sourceText, { color: palette.text }]}>{sourceTitle}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              accessibilityLabel={copy.rename}
              editable={!busy}
              maxLength={80}
              onChangeText={(value) => setLabels((current) => ({ ...current, [sign.id]: value }))}
              placeholder={copy.rename}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive, color: palette.text },
              ]}
              testID={`lucid-dream-sign-name-${sign.id}`}
              value={inputValue}
            />

            <View style={styles.actions}>
              {sign.decision === 'rejected' ? (
                <LucidButton
                  label={copy.reconsider}
                  loading={busy}
                  onPress={() => void save(sign, 'pending')}
                  variant="secondary"
                />
              ) : (
                <>
                  <LucidButton
                    label={copy.confirm}
                    loading={busy}
                    onPress={() => void save(sign, 'confirmed')}
                  />
                  <LucidButton
                    label={copy.reject}
                    loading={busy}
                    onPress={() => void save(sign, 'rejected')}
                    variant="ghost"
                  />
                </>
              )}
            </View>
          </LucidCard>
        );
      })}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm },
  privacyCopy: { flex: 1 },
  empty: {
    paddingVertical: LucidSpace.xl,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  signCard: { gap: LucidSpace.md },
  signHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.sm },
  signTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  signTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
  },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sources: { gap: LucidSpace.xs },
  source: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.sm,
    borderWidth: 1,
    borderRadius: LucidRadius.md,
    paddingHorizontal: LucidSpace.md,
  },
  sourceText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: LucidRadius.lg,
    paddingHorizontal: LucidSpace.md,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  actions: { gap: LucidSpace.xs },
  pressed: { opacity: 0.72 },
});
