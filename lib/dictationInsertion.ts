export type TranscriptSelection = { start: number; end: number };
export type DictationInsertion = { base: string; selection: TranscriptSelection };

/** A recognizer preview is cumulative: replace this session's range, never append each preview. */
export function insertDictation({ base, selection }: DictationInsertion, speech: string) {
  const start = Math.max(0, Math.min(selection.start, base.length));
  const end = Math.max(start, Math.min(selection.end, base.length));
  const words = speech.trim();
  if (!words) return { text: base, selection: { start, end } };

  const before = base.slice(0, start);
  const after = base.slice(end);
  const leading = before && !/[\s’'\-([{]$/u.test(before) && !/^[,.;:!?…]/u.test(words) ? ' ' : '';
  const trailing = after && !/^[\s,.;:!?…’'\-)}\]]/u.test(after) ? ' ' : '';
  const inserted = leading + words;
  const caret = before.length + inserted.length;
  return {
    text: before + inserted + trailing + after,
    selection: { start: caret, end: caret },
  };
}
