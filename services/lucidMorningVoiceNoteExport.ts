import * as Sharing from 'expo-sharing';

import {
  LucidMorningVoiceNoteError,
  assertLucidMorningVoiceNote,
  isLocalLucidMorningVoiceUri,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';

export type LucidMorningVoiceNoteShareResult = {
  uri: string;
  shared: boolean;
};

export type LucidMorningVoiceNoteShareAdapter = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    uri: string,
    options?: { mimeType?: string; dialogTitle?: string; UTI?: string }
  ) => Promise<void>;
};

export async function shareLucidMorningVoiceNote(
  note: LucidMorningVoiceNote,
  sharing: LucidMorningVoiceNoteShareAdapter = Sharing
): Promise<LucidMorningVoiceNoteShareResult> {
  assertLucidMorningVoiceNote(note);
  if (!isLocalLucidMorningVoiceUri(note.uri)) {
    throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
  }

  const available = await sharing.isAvailableAsync();
  if (!available) {
    return { uri: note.uri, shared: false };
  }

  await sharing.shareAsync(note.uri, {
    mimeType: note.mimeType,
    dialogTitle: note.title,
  });

  return { uri: note.uri, shared: true };
}
