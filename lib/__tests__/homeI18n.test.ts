import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';

const homeTodayKeys = [
  'home.today.eyebrow',
  'home.today.resources',
  'home.today.loading.title',
  'home.today.loading.body',
  'home.today.draft_resume.title',
  'home.today.draft_resume.body',
  'home.today.draft_resume.cta',
  'home.today.empty.title',
  'home.today.empty.body',
  'home.today.empty.cta',
  'home.today.capture_due.title',
  'home.today.capture_due.body',
  'home.today.capture_due.cta',
  'home.today.continue_today.title',
  'home.today.continue_today.body',
  'home.today.continue_today.cta',
  'home.today.optional_deepen.title',
  'home.today.optional_deepen.body',
  'home.today.optional_deepen.cta',
  'home.today.rest.title',
  'home.today.rest.body',
  'home.today.rest.cta',
] as const;

describe('home today i18n', () => {
  const packs = { de, en, es, fr, it: italian, pt };

  it('has Accueil Aujourd’hui copy in every supported language', () => {
    for (const [language, translations] of Object.entries(packs)) {
      for (const key of homeTodayKeys) {
        expect({ language, key, value: translations[key] }).toMatchObject({
          language,
          key,
          value: expect.any(String),
        });
        expect(translations[key]).not.toBe(key);
        expect(translations[key].trim()).not.toBe('');
      }
    }
  });

  it('keeps French Accueil copy in tutoiement', () => {
    expect(fr['home.today.draft_resume.body']).toMatch(/Termine le rêve/);
    expect(fr['home.today.empty.cta']).toMatch(/Capturer/);
    expect(fr['home.today.rest.title']).toBe('Tu as terminé pour aujourd’hui');
    expect(fr['home.today.rest.body']).toBe(
      'Ton rêve est enregistré et exploré. Tu peux revenir au journal quand tu veux.'
    );
    expect(fr['nav.home']).toBe('Accueil');
  });
});
