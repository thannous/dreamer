import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  LUCID_TAB_BAR_INSET,
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
import type { DreamAnalysis } from '@/lib/types';

const MAX_VISIBLE_DREAMS = 50;

const COPY = {
  en: {
    eyebrow: 'Your dream memory', title: 'Journal', subtitle: 'Real dreams stay at the centre of your practice.',
    profile: 'Open profile', capture: 'Capture a dream', signs: 'Dream signs', signsHint: 'Review patterns before they can guide training.',
    search: 'Search your dreams', dreams: 'Dreams', dreamCount: (count: number) => `${count} ${count === 1 ? 'dream' : 'dreams'}`,
    empty: 'Your recorded dreams will appear here.', noResults: 'No dream matches this search.', untitled: 'Untitled dream',
    more: (count: number) => `${count} more dreams remain available in your journal.`, openDream: (title: string) => `Open dream: ${title}`,
  },
  fr: {
    eyebrow: 'Ta mémoire onirique', title: 'Journal', subtitle: 'Tes rêves réels restent au centre de ta pratique.',
    profile: 'Ouvrir le profil', capture: 'Noter un rêve', signs: 'Signes oniriques', signsHint: 'Examine les motifs avant qu’ils puissent guider l’entraînement.',
    search: 'Rechercher dans tes rêves', dreams: 'Rêves', dreamCount: (count: number) => `${count} rêve${count > 1 ? 's' : ''}`,
    empty: 'Tes rêves enregistrés apparaîtront ici.', noResults: 'Aucun rêve ne correspond à cette recherche.', untitled: 'Rêve sans titre',
    more: (count: number) => `${count} autres rêves restent disponibles dans ton journal.`, openDream: (title: string) => `Ouvrir le rêve : ${title}`,
  },
  es: {
    eyebrow: 'Tu memoria onírica', title: 'Diario', subtitle: 'Tus sueños reales siguen en el centro de la práctica.',
    profile: 'Abrir perfil', capture: 'Anotar un sueño', signs: 'Señales oníricas', signsHint: 'Revisa los patrones antes de que puedan guiar el entrenamiento.',
    search: 'Buscar en tus sueños', dreams: 'Sueños', dreamCount: (count: number) => `${count} ${count === 1 ? 'sueño' : 'sueños'}`,
    empty: 'Tus sueños guardados aparecerán aquí.', noResults: 'Ningún sueño coincide con esta búsqueda.', untitled: 'Sueño sin título',
    more: (count: number) => `${count} sueños más siguen disponibles en tu diario.`, openDream: (title: string) => `Abrir sueño: ${title}`,
  },
  de: {
    eyebrow: 'Deine Traumerinnerung', title: 'Journal', subtitle: 'Deine echten Träume bleiben der Mittelpunkt der Übung.',
    profile: 'Profil öffnen', capture: 'Traum notieren', signs: 'Traumzeichen', signsHint: 'Prüfe Muster, bevor sie das Training beeinflussen dürfen.',
    search: 'Träume durchsuchen', dreams: 'Träume', dreamCount: (count: number) => `${count} ${count === 1 ? 'Traum' : 'Träume'}`,
    empty: 'Deine gespeicherten Träume erscheinen hier.', noResults: 'Kein Traum passt zu dieser Suche.', untitled: 'Traum ohne Titel',
    more: (count: number) => `${count} weitere Träume bleiben in deinem Journal verfügbar.`, openDream: (title: string) => `Traum öffnen: ${title}`,
  },
  it: {
    eyebrow: 'La tua memoria onirica', title: 'Diario', subtitle: 'I tuoi sogni reali restano al centro della pratica.',
    profile: 'Apri profilo', capture: 'Annota un sogno', signs: 'Segnali onirici', signsHint: 'Rivedi gli schemi prima che possano guidare l’allenamento.',
    search: 'Cerca nei tuoi sogni', dreams: 'Sogni', dreamCount: (count: number) => `${count} ${count === 1 ? 'sogno' : 'sogni'}`,
    empty: 'I sogni salvati appariranno qui.', noResults: 'Nessun sogno corrisponde alla ricerca.', untitled: 'Sogno senza titolo',
    more: (count: number) => `${count} altri sogni restano disponibili nel diario.`, openDream: (title: string) => `Apri sogno: ${title}`,
  },
} as const;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function searchableDreamText(dream: DreamAnalysis): string {
  return normalizeSearchText([
    dream.title,
    dream.transcript,
    dream.interpretation,
    ...(dream.symbols?.map((symbol) => symbol.name) ?? []),
    ...(dream.emotions?.map((emotion) => emotion.name) ?? []),
  ].join(' '));
}

function dreamPreview(dream: DreamAnalysis): string {
  return dream.transcript.trim() || dream.interpretation.trim();
}

export default function LucidJournalScreen() {
  const { dreams, loaded } = useDreamsData();
  const { content } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearchText(query.trim());
  const filteredDreams = useMemo(
    () => normalizedQuery
      ? dreams.filter((dream) => searchableDreamText(dream).includes(normalizedQuery))
      : dreams,
    [dreams, normalizedQuery]
  );
  const visibleDreams = filteredDreams.slice(0, MAX_VISIBLE_DREAMS);
  const hiddenCount = Math.max(0, filteredDreams.length - visibleDreams.length);

  return (
    <LucidScreen
      bottomInset={LUCID_TAB_BAR_INSET}
      eyebrow={copy.eyebrow}
      subtitle={copy.subtitle}
      testID="lucid-journal"
      title={copy.title}
      trailing={(
        <LucidIconAction
          icon="person-outline"
          label={copy.profile}
          onPress={() => router.push('/lucid/(tabs)/settings')}
        />
      )}
    >
      <View style={styles.actions}>
        <LucidButton
          icon="create-outline"
          label={copy.capture}
          onPress={() => router.push('/recording')}
          testID="lucid-journal-capture"
        />
        <LucidCard
          accessibilityLabel={`${copy.signs}. ${copy.signsHint}`}
          onPress={() => router.push('/lucid/dream-signs' as never)}
          style={styles.signsCard}
          testID="lucid-journal-signs"
        >
          <View style={[styles.signsIcon, { backgroundColor: palette.accentSoft }]}>
            <Ionicons color={palette.accent} name="shapes-outline" size={LucidIcon.lg} />
          </View>
          <View style={styles.signsCopy}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.signs}</Text>
            <Text style={[styles.cardBody, { color: palette.textSecondary }]}>{copy.signsHint}</Text>
          </View>
          <Ionicons color={palette.accent} name="chevron-forward" size={LucidIcon.md} />
        </LucidCard>
      </View>

      <View
        style={[
          styles.searchShell,
          { backgroundColor: palette.surface, borderColor: palette.borderInteractive },
        ]}
      >
        <Ionicons color={palette.textMuted} name="search" size={LucidIcon.md} />
        <TextInput
          accessibilityLabel={copy.search}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder={copy.search}
          placeholderTextColor={palette.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: palette.text }]}
          testID="lucid-journal-search"
          value={query}
        />
      </View>

      <LucidSectionHeader
        action={<LucidPill label={copy.dreamCount(filteredDreams.length)} tone="neutral" />}
        title={copy.dreams}
      />

      {!loaded ? (
        <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: palette.textSecondary }]}>
          {content.chrome.common.loading}
        </Text>
      ) : null}
      {loaded && visibleDreams.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>
          {dreams.length === 0 ? copy.empty : copy.noResults}
        </Text>
      ) : null}
      {visibleDreams.map((dream) => {
        const title = dream.title.trim() || copy.untitled;
        const preview = dreamPreview(dream);
        const date = new Intl.DateTimeFormat(content.locale, { dateStyle: 'medium' }).format(dream.id);
        return (
          <LucidCard
            accessibilityLabel={copy.openDream(title)}
            key={dream.id}
            onPress={() => router.push(`/journal/${dream.id}`)}
            style={styles.dreamCard}
            testID={`lucid-journal-dream-${dream.id}`}
          >
            <View style={styles.dreamHeader}>
              <Text numberOfLines={2} style={[styles.cardTitle, styles.dreamTitle, { color: palette.text }]}>
                {title}
              </Text>
              <Text style={[styles.date, { color: palette.textMuted }]}>{date}</Text>
            </View>
            {preview ? (
              <Text numberOfLines={3} style={[styles.cardBody, { color: palette.textSecondary }]}>
                {preview}
              </Text>
            ) : null}
          </LucidCard>
        );
      })}
      {hiddenCount > 0 ? (
        <Text style={[styles.more, { color: palette.textSecondary }]}>{copy.more(hiddenCount)}</Text>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: LucidSpace.sm },
  signsCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  signsIcon: {
    width: 48,
    height: 48,
    borderRadius: LucidRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signsCopy: { flex: 1, minWidth: 0, gap: 2 },
  searchShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.sm,
    borderWidth: 1,
    borderRadius: LucidRadius.lg,
    paddingHorizontal: LucidSpace.md,
  },
  searchInput: {
    minHeight: 50,
    flex: 1,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  empty: {
    paddingVertical: LucidSpace.xl,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
    textAlign: 'center',
  },
  dreamCard: { gap: LucidSpace.sm },
  dreamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LucidSpace.md,
  },
  dreamTitle: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  cardBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  date: {
    flexShrink: 0,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  more: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textAlign: 'center',
  },
});
