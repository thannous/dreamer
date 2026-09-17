import { parseCaptureEditableDraft, serializeCaptureEditableDraft, updateCaptureDraftSection } from '../captureEditableDraft';

it('edits only the selected answer while preserving questions, other answers and exact original spacing', () => {
  const source = ' Une plage.\r\n\r\nQuestion : Quelle couleur ?\r\nRéponse : Noir.\r\n\r\nQuestion : Quel bruit ?\r\nRéponse : Des vagues.\nJe crois.';
  const draft = parseCaptureEditableDraft(source);
  expect(draft.sections.map(section => section.question)).toEqual([null, 'Quelle couleur ?', 'Quel bruit ?']);
  expect(serializeCaptureEditableDraft(draft)).toBe(source);
  expect(serializeCaptureEditableDraft(updateCaptureDraftSection(draft, 1, 'Gris, plutôt.'))).toBe(source.replace('Noir.', 'Gris, plutôt.'));
  expect(serializeCaptureEditableDraft(draft)).toBe(source);
});

it.each([
  ['Question :', 'Réponse :'], ['Question:', 'Answer:'], ['Pregunta:', 'Respuesta:'],
  ['Pergunta:', 'Resposta:'], ['Domanda:', 'Risposta:'], ['Frage:', 'Antwort:'],
])('restores stored exchanges using %s regardless of the current UI language', (question, answer) => {
  const source = `A dream.\n\n${question} A question?\n${answer} A short answer.`;
  const draft = parseCaptureEditableDraft(source);
  expect(draft.sections).toHaveLength(2);
  expect(draft.sections[1].text).toBe('A short answer.');
  expect(serializeCaptureEditableDraft(draft)).toBe(source);
});

it.each(['A plain fragment.', 'I wondered:\nQuestion : Pourquoi ?\nPuis je me suis réveillé.', ''])('preserves unstructured or incomplete drafts without dropping text', source => {
  const draft = parseCaptureEditableDraft(source);
  expect(draft.sections).toHaveLength(1);
  expect(serializeCaptureEditableDraft(draft)).toBe(source);
});

it('keeps an emptied answer associated with its question', () => {
  const draft = parseCaptureEditableDraft('Une plage.\n\nQuestion : Quelle couleur ?\nRéponse : Noir.');
  const edited = updateCaptureDraftSection(draft, 1, '');
  expect(serializeCaptureEditableDraft(edited)).toBe('Une plage.\n\nQuestion : Quelle couleur ?\nRéponse : ');
  expect(parseCaptureEditableDraft(serializeCaptureEditableDraft(edited)).sections[1].question).toBe('Quelle couleur ?');
});
