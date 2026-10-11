export type TranscriptSelection = { start: number; end: number };
export type DictationInsertion = { base: string; selection: TranscriptSelection };

function clampSelection(base: string, selection: TranscriptSelection): TranscriptSelection {
  const start = Math.max(0, Math.min(selection.start, base.length));
  return { start, end: Math.max(start, Math.min(selection.end, base.length)) };
}

/** A recognizer preview is cumulative: replace this session's range, never append each preview. */
export function insertDictation({ base, selection }: DictationInsertion, speech: string) {
  const { start, end } = clampSelection(base, selection);
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

/** An insertion and the words the current recognizer session has written into it. */
export type DictationAnchor = DictationInsertion & { speech?: string };

/**
 * Keeps a dictation anchored when the editor reports `edited`. The recognizer
 * resends every word of its session, so restarting the insertion at the caret
 * would write those words a second time. iOS can report the text it was just
 * given, or an earlier preview, as an edit.
 * Edits before or after the dictated words move them; edits inside them stay with
 * the recognizer. Returns null when nothing was dictated yet or an edit crosses
 * the dictated words' boundary.
 */
export function rebaseDictation(anchor: DictationAnchor, edited: string): DictationAnchor | null {
  const speech = anchor.speech;
  if (!speech?.trim()) return null;
  const written = insertDictation(anchor, speech);
  const text = written.text;
  const head = clampSelection(anchor.base, anchor.selection).start;
  const tail = text.length - written.selection.end;
  const limit = Math.min(text.length, edited.length);
  let prefix = 0;
  while (prefix < limit && text[prefix] === edited[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < limit - prefix && text[text.length - 1 - suffix] === edited[edited.length - 1 - suffix]) {
    suffix += 1;
  }

  const shift = edited.length - text.length;
  let start = head;
  let after = tail;
  if (suffix >= text.length - head) {
    start = head + shift;
  } else if (prefix >= text.length - tail) {
    after = tail + shift;
  } else if (prefix < head || suffix < tail) {
    return null;
  }
  return {
    base: edited.slice(0, start) + edited.slice(edited.length - after),
    selection: { start, end: start },
    speech,
  };
}
