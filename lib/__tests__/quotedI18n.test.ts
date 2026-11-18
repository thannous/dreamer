import { getTranslator, loadTranslations } from '@/lib/i18n';

// The dream's summary line is quoted in the chat header, on the dream page, in the
// reading and in the shared text. Each language uses its own quote marks.
const expected: Record<string, string> = {
  de: '„Die Tür öffnet sich.“',
  en: '“The door opens.”',
  es: '«La puerta se abre.»',
  fr: '« La porte s’ouvre. »',
  it: '«La porta si apre.»',
  pt: '“A porta se abre.”',
};
const lines: Record<string, string> = {
  de: 'Die Tür öffnet sich.',
  en: 'The door opens.',
  es: 'La puerta se abre.',
  fr: 'La porte s’ouvre.',
  it: 'La porta si apre.',
  pt: 'A porta se abre.',
};

describe('common.quoted', () => {
  it.each(Object.keys(expected))('quotes a line with the marks of %s', async (language) => {
    await loadTranslations(language as Parameters<typeof loadTranslations>[0]);
    expect(getTranslator(language as Parameters<typeof getTranslator>[0])('common.quoted', { text: lines[language] }))
      .toBe(expected[language]);
  });
});
