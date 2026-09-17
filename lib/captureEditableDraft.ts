export type CaptureDraftSection = { question: string | null; prefix: string; text: string };
export type CaptureEditableDraft = { sections: CaptureDraftSection[] };

// These labels are part of already persisted plain-text drafts, across all app languages.
// Keep their original spelling/spacing on serialization, even after a language change.
const LABELS = [
  ['Question :', 'Réponse :'], ['Question:', 'Answer:'], ['Pregunta:', 'Respuesta:'],
  ['Pergunta:', 'Resposta:'], ['Domanda:', 'Risposta:'], ['Frage:', 'Antwort:'],
] as const;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseCaptureEditableDraft(source: string): CaptureEditableDraft {
  const boundaries: { start: number; prefix: string; question: string }[] = [];
  for (const [question, answer] of LABELS) {
    const pattern = new RegExp(`(?:\\r?\\n){2}${escapeRegex(question)}[ \\t]*([^\\r\\n]+)\\r?\\n${escapeRegex(answer)}[ \\t]*`, 'g');
    for (const match of source.matchAll(pattern)) {
      boundaries.push({ start: match.index!, prefix: match[0], question: match[1].trim() });
    }
  }
  boundaries.sort((left, right) => left.start - right.start);
  return { sections: [
    { question: null, prefix: '', text: source.slice(0, boundaries[0]?.start ?? source.length) },
    ...boundaries.map((boundary, index) => ({
      question: boundary.question,
      prefix: boundary.prefix,
      text: source.slice(boundary.start + boundary.prefix.length, boundaries[index + 1]?.start ?? source.length),
    })),
  ] };
}

export function serializeCaptureEditableDraft(draft: CaptureEditableDraft): string {
  return draft.sections.map(section => section.prefix + section.text).join('');
}

export function updateCaptureDraftSection(draft: CaptureEditableDraft, index: number, text: string): CaptureEditableDraft {
  return { sections: draft.sections.map((section, position) => position === index ? { ...section, text } : section) };
}
