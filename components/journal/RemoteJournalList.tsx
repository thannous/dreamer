import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { DreamListItem } from '@/lib/journalReadContracts';
import { useRemoteJournalList } from '@/hooks/useRemoteJournalList';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';

export function RemoteJournalList({ userId, searchQuery, onOpenDream, header, bottomInset = 0 }: {
  userId: string; searchQuery: string; onOpenDream: (item: DreamListItem) => Promise<void>;
  header?: React.ReactElement; bottomInset?: number;
}) {
  const { items, loading, error, complete, loadMore } = useRemoteJournalList(userId);
  const { t } = useTranslation();
  const { formatShortDate } = useLocaleFormatting();
  const [opening, setOpening] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const active = useRef(true);
  const openingRef = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const open = async (item: DreamListItem) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(item.id); setFailed(null);
    try { await onOpenDream(item); }
    catch { if (active.current) setFailed(item.id); }
    finally { openingRef.current = false; if (active.current) setOpening(null); }
  };
  const query = searchQuery.trim().toLocaleLowerCase();
  const matches = items.filter(item => !query || `${item.title ?? ''} ${item.transcript}`.toLocaleLowerCase().includes(query));
  return <FlatList
    testID="journal-remote-preview"
    style={{ flex: 1, marginBottom: bottomInset }}
    data={matches}
    keyExtractor={item => String(item.remoteId)}
    ListHeaderComponent={header}
    keyboardShouldPersistTaps="handled"
    renderItem={({ item }) => <Pressable accessibilityRole="button" disabled={opening !== null} onPress={() => { void open(item); }} className="mx-4 mb-3 rounded-xl bg-ink-soft p-4">
      <Text className="font-sans-bold text-body text-ivory">{item.title}</Text>
      <Text className="font-sans text-body-sm text-ivory-muted">{formatShortDate(item.id)}</Text>
      <Text numberOfLines={3} className="font-sans text-body text-ivory">{item.transcript}</Text>
      {opening === item.id && <Text className="text-ivory-muted">{t('journal.preview.loading')}</Text>}
      {failed === item.id && <Text accessibilityRole="alert" className="text-ivory">{t('journal.preview.open_failed')}</Text>}
    </Pressable>}
    ListFooterComponent={<View className="p-4">
      <Text className="text-center font-sans text-body-sm text-ivory-muted">{t('journal.preview.scope')}</Text>
      {loading ? <Text className="text-center text-ivory-muted">{t('journal.preview.loading')}</Text> : !complete && <Pressable accessibilityRole="button" onPress={() => { void loadMore(); }} className="min-h-[48px] items-center justify-center"><Text className="text-champagne-on">{t(error ? 'journal.persistence.retry' : 'journal.pagination.more')}</Text></Pressable>}
    </View>}
  />;
}
