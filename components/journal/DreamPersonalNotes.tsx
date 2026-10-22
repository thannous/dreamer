import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BookSectionMark } from './JournalBook';
import { useDreamsActions } from '@/context/DreamsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { formatDreamDate } from '@/lib/dateUtils';
import { generateUUID } from '@/lib/dreamUtils';
import { PERSONAL_NOTE_MAX_LENGTH, PERSONAL_NOTES_MAX_COUNT } from '@/lib/dreamPersonalNotes';
import type { DreamAnalysis, DreamPersonalNote } from '@/lib/types';

const EMPTY_NOTES: DreamPersonalNote[] = [];

/** Personal writing stays separate from the story, analysis and assistant conversations. */
export function DreamPersonalNotes({ dream, disabled = false }: { dream: DreamAnalysis; disabled?: boolean }) {
  const { t, currentLang } = useTranslation();
  const { colors } = useTheme();
  const { updateDream } = useDreamsActions();
  const [editing, setEditing] = useState<DreamPersonalNote | 'new' | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const notes = dream.personalNotes ?? EMPTY_NOTES;
  const locked = disabled || saving || dream.syncState === 'conflict';
  // Validate the same untrimmed draft shown by the counter; never truncate a paste.
  const draftTooLong = draft.length > PERSONAL_NOTE_MAX_LENGTH;
  const lengthError = draftTooLong ? t('notes.too_long', { limit: PERSONAL_NOTE_MAX_LENGTH }) : undefined;
  const close = useCallback(() => { setEditing(null); setDraft(''); setError(false); }, []);
  const write = useCallback(async (next: DreamPersonalNote[]) => {
    if (locked || busy.current) return;
    busy.current = true; setSaving(true); setError(false);
    try {
      await updateDream({ ...dream, personalNotes: next, clientUpdatedAt: Date.now() });
      close(); setDeleting(null);
    } catch { setError(true); }
    finally { busy.current = false; setSaving(false); }
  }, [close, dream, locked, updateDream]);
  const save = useCallback(() => {
    const text = draft.trim();
    if (!text || draftTooLong || !editing) return;
    const now = Date.now();
    if (editing === 'new') {
      if (notes.length >= PERSONAL_NOTES_MAX_COUNT) return;
      void write([...notes, { id: generateUUID(), text, createdAt: now, updatedAt: now }]);
    } else {
      // A remote refresh during editing cannot silently replace a newer version.
      const current = notes.find(note => note.id === editing.id);
      if (!current || current.updatedAt !== editing.updatedAt || current.text !== editing.text) { setError(true); return; }
      void write(notes.map(note => note.id === editing.id ? { ...note, text, updatedAt: Math.max(now, note.createdAt) } : note));
    }
  }, [draft, draftTooLong, editing, notes, write]);
  return <View testID="dream.personal-notes" className="mx-2 my-6 border-t border-line pt-5">
    <BookSectionMark label={t('notes.title')} />
    <Text className="mb-4 mt-2 font-sans text-[14px] leading-5 text-ivory-muted">{t('notes.description')}</Text>
    {notes.map(note => <View key={note.id} testID={`dream.note.${note.id}`} className="mb-4 border-l border-line pl-4">
      <Text className="mb-2 font-sans text-[12px] text-ivory-muted">{formatDreamDate(note.createdAt, currentLang)}
        {note.updatedAt > note.createdAt ? ` · ${t('notes.updated', { date: formatDreamDate(note.updatedAt, currentLang) })}` : ''}</Text>
      <Text selectable className="font-serif text-[18px] leading-7 text-ivory">{note.text}</Text>
      <View className="flex-row flex-wrap gap-3">
        <Pressable accessibilityRole="button" disabled={locked || editing !== null} onPress={() => { setEditing(note); setDraft(note.text); setError(false); setDeleting(null); }} className="min-h-[44px] justify-center">
          <Text className="font-sans text-[14px] text-champagne-on">{t('notes.edit')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={locked || editing !== null} onPress={() => setDeleting(note.id)} className="min-h-[44px] justify-center">
          <Text className="font-sans text-[14px] text-ivory-muted">{t('notes.delete')}</Text>
        </Pressable>
      </View>
      {deleting === note.id ? <View>
        <Text className="font-sans text-[14px] text-ivory">{t('notes.delete_confirm')}</Text>
        <View className="flex-row gap-5">
          <Pressable accessibilityRole="button" disabled={locked} onPress={() => void write(notes.filter(entry => entry.id !== note.id))} className="min-h-[44px] justify-center"><Text className="text-danger-on">{t('notes.delete_confirm_action')}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDeleting(null)} className="min-h-[44px] justify-center"><Text className="text-ivory">{t('common.cancel')}</Text></Pressable>
        </View>
      </View> : null}
    </View>)}
    {editing ? <View className="gap-3">
      <TextInput testID="dream.note.input" accessibilityLabel={t('notes.input')} placeholder={t('notes.prompt')} placeholderTextColor={colors.textSecondary}
        value={draft} onChangeText={setDraft} multiline editable={!locked} accessibilityHint={lengthError}
        textAlignVertical="top" className="min-h-[120px] rounded-xl border border-line bg-ink-soft p-4 font-serif text-[18px] leading-7 text-ivory" />
      <Text testID="dream.note.count" className="font-sans text-[12px] text-ivory-muted">{draft.length} / {PERSONAL_NOTE_MAX_LENGTH}</Text>
      {lengthError ? <Text testID="dream.note.length-error" accessibilityRole="alert" accessibilityLiveRegion="polite" className="font-sans text-[14px] text-danger-on">{lengthError}</Text> : null}
      <View className="flex-row gap-5">
        <Pressable accessibilityRole="button" testID="dream.note.save" disabled={locked || draftTooLong || !draft.trim()} onPress={save} className="min-h-[44px] justify-center"><Text className="text-champagne-on">{t(saving ? 'notes.saving' : 'notes.save')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving} onPress={close} className="min-h-[44px] justify-center"><Text className="text-ivory">{t('common.cancel')}</Text></Pressable>
      </View>
    </View> : notes.length < PERSONAL_NOTES_MAX_COUNT ? <Pressable accessibilityRole="button" testID="dream.note.add" disabled={locked} onPress={() => { setEditing('new'); setDraft(''); setError(false); setDeleting(null); }} className="min-h-[44px] justify-center">
      <Text className="font-sans text-[15px] text-champagne-on">{t('notes.add')}</Text>
    </Pressable> : <Text className="text-ivory-muted">{t('notes.limit')}</Text>}
    {error ? <Text accessibilityRole="alert" className="mt-3 text-danger-on">{t('notes.error')}</Text> : null}
  </View>;
}
