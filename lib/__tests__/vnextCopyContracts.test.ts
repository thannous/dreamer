import { describe, expect, it } from '@jest/globals';

import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';

const packs = { de, en, es, fr, it: italian, pt } as const;

const analysisActionKeys = [
  'journal.detail.action.analyze.message',
  'journal.detail.action.explore.message',
  'journal.detail.action.continue.message',
] as const;

const analysisProgressKeys = [
  'analysis.step.generating_image',
  'analysis.mantra.generating_image.1',
  'analysis.mantra.generating_image.2',
  'analysis.mantra.generating_image.3',
] as const;

const morningKeys = Array.from({ length: 15 }, (_, index) => `notifications.prompt.morning_${index + 1}`);

const imagePromisePattern =
  /imagen|illustration|illustrazione|ilustra|image|imagery|visual idea|ideia visual|erstes bild|traumbild|onirique|dreamscape|painting|pintando|dipingend|gerando as imagens|generating dream/i;

const guestRecordingCapPattern =
  /up to \{limit\}|hasta \{limit\}|fino a \{limit\}|bis zu \{limit\}|at[eé] \{limit\}|jusqu.à \{limit\}|two dreams|2 r[eê]ves|zwei träume|due sogni|dois sonhos|hasta dos|limit of 2 dream/i;

const morningPressurePattern =
  /don'?t let|never miss|slip away|fade fast|before they fade|record yours now|journal them now|is calling|unlock the meaning|ne laissez|ne ratez|s.échapper|s.estompent vite|enregistrez les maintenant|vous appelle|no dejes|anótalos ahora|regístralos ahora|lass deine träume nicht|schreibe sie jetzt auf|zeichne deine jetzt auf|non lasciare|annotali adesso|registrali ora|não deixe|registre-os agora|desaparecem rápido|svaniscono in fretta/i;

describe('VNext copy contracts', () => {
  it('keeps analysis and reflection actions from promising an image', () => {
    for (const [language, translations] of Object.entries(packs)) {
      for (const key of analysisActionKeys) {
        expect({ language, key, value: translations[key] }).toEqual({
          language,
          key,
          value: expect.any(String),
        });
        expect(translations[key]).not.toMatch(imagePromisePattern);
      }

      for (const key of analysisProgressKeys) {
        expect(translations[key]).not.toMatch(imagePromisePattern);
      }

      expect(translations['journal.detail.image_replace.subtitle']).toMatch(/optional|optionnelle|opcional|separat/i);
      expect(translations['journal.detail.image_replace.subtitle']).not.toMatch(
        /analysis will create|l’analyse crée|el análisis generar|die analyse erstellt|l'analisi creer|a análise criar/i
      );
      expect(translations['journal.detail.image.ai_locked_note']).toMatch(/optional|optionnelle|opcional|opzionale/i);
      expect(translations['journal.detail.image.preparing_subtitle']).toMatch(/optional|optionnelle|opcional|opzionale|facultativ|facoltativ/i);
    }
  });

  it('describes the guest journal as unlimited and AI features as plan-limited', () => {
    for (const [language, translations] of Object.entries(packs)) {
      const guestJournal = translations['recording.alert.limit.message'];
      const guestReflection = translations['dream_chat.exploration_limit.message_guest'];

      expect({ language, guestJournal }).toEqual({
        language,
        guestJournal: expect.stringMatching(/unlimited|illimit|ilimit|unbegrenzt/i),
      });
      expect(guestJournal).not.toMatch(guestRecordingCapPattern);
      expect(guestJournal).not.toMatch(/\{limit\}/);
      expect(guestJournal).not.toMatch(/costly|coûteux|costoso|kostspielig|costosi|caro de IA/i);
      expect(guestJournal).toMatch(/AI|IA|KI/i);
      expect(guestJournal).toMatch(/limited|limitées|limitadas|begrenzt|limitate/i);

      expect(guestReflection).not.toMatch(/\b2\b|two |deux |dos |zwei |due |dois /i);
      expect(guestReflection).toMatch(/unlimited|illimit|ilimit|unbegrenzt/i);
    }
  });

  it('keeps morning reminder prompts invitational rather than guilt-inducing', () => {
    for (const [language, translations] of Object.entries(packs)) {
      for (const key of morningKeys) {
        const value = translations[key];
        expect({ language, key, value }).toEqual({
          language,
          key,
          value: expect.any(String),
        });
        expect(value).not.toMatch(morningPressurePattern);
      }
    }
  });
});
