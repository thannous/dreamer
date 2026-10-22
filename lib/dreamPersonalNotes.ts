import type { DreamPersonalNote } from './types';

export const PERSONAL_NOTE_MAX_LENGTH = 4000;
export const PERSONAL_NOTES_MAX_COUNT = 50;

/** Reject malformed persisted/remote notes rather than turn corrupt data into an empty notebook. */
export function parsePersonalNotes(value: unknown): DreamPersonalNote[] | undefined {
  if (value === undefined) return undefined; // An older server must not acknowledge a write it did not keep.
  if (!Array.isArray(value) || value.length > PERSONAL_NOTES_MAX_COUNT) throw new Error('Invalid personal notes');
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid personal note');
    const note = entry as DreamPersonalNote;
    if (typeof note.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(note.id) || ids.has(note.id)
      || typeof note.text !== 'string' || !note.text.trim() || note.text.length > PERSONAL_NOTE_MAX_LENGTH
      || !Number.isSafeInteger(note.createdAt) || note.createdAt <= 0
      || !Number.isSafeInteger(note.updatedAt) || note.updatedAt < note.createdAt) throw new Error('Invalid personal note');
    ids.add(note.id);
    return { id: note.id, text: note.text, createdAt: note.createdAt, updatedAt: note.updatedAt };
  });
}
