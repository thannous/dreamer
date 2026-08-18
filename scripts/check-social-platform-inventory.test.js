'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  scheduledHeroDates,
  validatePrimaryQueueEvidence,
  validateHeroQueueEvidence,
  validateMainPlanReplacementState,
  validateActiveYouTubeOrder,
  validateYouTubeReplacementProtocol,
  validatePlatformInventory,
  validateReplacementCoverage,
} = require('./check-social-platform-inventory');

const header = [
  '| Asset exact | Rôle | Triage archive | Priorité | TikTok | Instagram | X | YouTube | Facebook | Pinterest | Note |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
];

function inventory(rows) {
  return [...header, ...rows].join('\n');
}

const complete = '| `hero.mp4` | HERO | **DÉJÀ PUBLIÉE** | — | [URL](https://www.tiktok.com/@noctaliadreams/video/a) | [URL](https://www.instagram.com/noctaliadreams/reel/a/) | [URL](https://x.com/NoctaliaDreams/status/a) | [URL](https://youtube.com/a) | [URL](https://www.facebook.com/a) | [URL](https://fr.pinterest.com/a) | ok |';
const archive = '| `archive.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/b) | — | — | — | — | — | test |';
const instagramDebt = '| `debt.mp4` | DETTE INSTAGRAM / archive secondaire gelée | **À RATTRAPER SUR INSTAGRAM — AFFECTÉ 16/08 À 12:45** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/debt) | **PRÊT — NON PUBLIÉ** | [URL](https://x.com/NoctaliaDreams/status/debt) | — | — | — | Extension secondaire toujours gelée. |';
const scheduled = '| `future.mp4` | HERO futur | — | A | [**PROGRAMMÉ — 30/08 15:30**](https://www.tiktok.com/@noctaliadreams/video/future) | — | — | — | — | — | preuve native future |';

function inventoryWithArchivePriorities(queuePriority, detailedPriority) {
  return [
    '### File opérationnelle complète des archives',
    '| Vague | Assets dans l\'ordre | Gate avant programmation |',
    '|---|---|---|',
    `| ${queuePriority} visuelle | \`archive.mp4\` | test |`,
    '',
    '## Stratégie de rattrapage',
    '',
    '### Première vague prioritaire',
    '| Ordre | Asset | Priorité | Préflight | Destination | Statut |',
    '|---:|---|---|---|---|---|',
    `| 1 | \`archive.mp4\` | ${detailedPriority} | ok | YouTube | PRÊT |`,
    '',
    '### Packaging natif du pilote archive',
    '',
    inventory([archive]),
  ].join('\n');
}

describe('social platform inventory guard', () => {
  it('accepts a complete hero and an archive with source proof', () => {
    expect(validatePlatformInventory(inventory([complete, archive]))).toEqual({ assets: 2, publicUrls: 7, scheduledUrls: 0, instagramDebts: 0 });
  });

  it('separates a native scheduled link from public proof', () => {
    expect(validatePlatformInventory(inventory([complete, scheduled]))).toEqual({ assets: 2, publicUrls: 6, scheduledUrls: 1, instagramDebts: 0 });
  });

  it('rejects a scheduled link as the only archive source proof', () => {
    const futureArchive = archive.replace('[URL](https://www.tiktok.com/@noctaliadreams/video/b)', '[**PROGRAMMÉ**](https://www.tiktok.com/@noctaliadreams/video/b)');
    expect(() => validatePlatformInventory(inventory([futureArchive]))).toThrow('sans aucune preuve publique source');
  });

  it('rejects a scheduled link inside a complete publication row', () => {
    const incomplete = complete.replace('[URL](https://www.tiktok.com/@noctaliadreams/video/a)', '[**PROGRAMMÉ**](https://www.tiktok.com/@noctaliadreams/video/a)');
    expect(() => validatePlatformInventory(inventory([incomplete]))).toThrow('exige 6 URL publiques, 5 trouvées');
  });

  it('rejects duplicate assets', () => {
    expect(() => validatePlatformInventory(inventory([complete, complete]))).toThrow('Asset dupliqué');
  });

  it('rejects a URL in the wrong platform column', () => {
    expect(() => validatePlatformInventory(inventory([complete.replace('https://www.tiktok.com/@noctaliadreams/video/a', 'https://x.com/NoctaliaDreams/status/wrong')]))).toThrow('domaine invalide');
  });

  it.each([
    ['TikTok', 'https://www.tiktok.com/@noctaliadreams/video/a', 'https://www.tiktok.com/@anotheraccount/video/a'],
    ['Instagram', 'https://www.instagram.com/noctaliadreams/reel/a/', 'https://www.instagram.com/anotheraccount/reel/a/'],
    ['X', 'https://x.com/NoctaliaDreams/status/a', 'https://x.com/anotheraccount/status/a'],
  ])('rejects a same-domain %s inventory URL owned by another account', (platform, exact, wrong) => {
    expect(() => validatePlatformInventory(inventory([complete.replace(exact, wrong)])))
      .toThrow(`URL hors du compte Noctalia exact dans la colonne ${platform}`);
  });

  it('rejects an incomplete DÉJÀ PUBLIÉE row', () => {
    expect(() => validatePlatformInventory(inventory([complete.replace('[URL](https://fr.pinterest.com/a)', '—')]))).toThrow('exige 6 URL');
  });

  it('rejects an archive without source proof', () => {
    expect(() => validatePlatformInventory(inventory([archive.replace('[URL](https://www.tiktok.com/@noctaliadreams/video/b)', '—')]))).toThrow('sans aucune preuve');
  });

  it('reconciles an Instagram debt with its execution card', () => {
    expect(validatePlatformInventory(inventory([instagramDebt]), {
      expectedInstagramDebts: [{ asset: 'debt.mp4', date: '16/08 à 12:45' }],
    })).toEqual({ assets: 1, publicUrls: 2, scheduledUrls: 0, instagramDebts: 1 });
  });

  it('rejects an Instagram debt missing from the consolidated register', () => {
    expect(() => validatePlatformInventory(inventory([archive]), {
      expectedInstagramDebts: [{ asset: 'debt.mp4', date: '16/08 à 12:45' }],
    })).toThrow('absente du registre consolidé');
  });

  it('rejects an Instagram debt scheduled on a different date', () => {
    expect(() => validatePlatformInventory(inventory([instagramDebt]), {
      expectedInstagramDebts: [{ asset: 'debt.mp4', date: '23/08 à 12:45' }],
    })).toThrow('date de dette Instagram incohérente');
  });

  it('rejects secondary publication while the Instagram debt is open', () => {
    const extended = instagramDebt.replace(' | — | — | — | Extension', ' | [URL](https://youtube.com/debt) | — | — | Extension');
    expect(() => validatePlatformInventory(inventory([extended]), {
      expectedInstagramDebts: [{ asset: 'debt.mp4', date: '16/08 à 12:45' }],
    })).toThrow('extension secondaire interdite');
  });

  it('accepts matching archive priorities in the operational queue and detailed wave', () => {
    expect(validatePlatformInventory(inventoryWithArchivePriorities('C', 'C'))).toEqual({
      assets: 1,
      publicUrls: 1,
      scheduledUrls: 0,
      instagramDebts: 0,
    });
  });

  it('rejects a priority drift between the operational queue and detailed wave', () => {
    expect(() => validatePlatformInventory(inventoryWithArchivePriorities('C', 'A')))
      .toThrow('archive.mp4: priorité archive incohérente (A au lieu de C)');
  });

  it('rejects an exact Facebook 28/28 claim while a scheduled hero still needs replacement', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **PROGRAMMÉ — À REMPLACER** | — | Supplanté par `new.mp4`. |';
    const coverage = '| Facebook `Noctalia` | Hero | Programmé | **28/28 heroes exacts** |';
    expect(() => validateReplacementCoverage(inventory([oldHero]), coverage))
      .toThrow('Couverture Facebook 28/28 interdite');
  });

  it('accepts a 27/28 Facebook coverage claim while the replacement remains pending', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **PROGRAMMÉ — À REMPLACER** | — | Supplanté par `new.mp4`. |';
    const coverage = '| Facebook `Noctalia` | Hero | **27/28 heroes exacts** | dette 1/28 |';
    expect(() => validateReplacementCoverage(inventory([oldHero]), coverage)).not.toThrow();
  });

  it('rejects a stale 27/28 Facebook claim after the replacement is closed', () => {
    const replacedHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE** | — | Supplanté. |';
    const coverage = '| Facebook `Noctalia` | Hero | **27/28 heroes exacts** | dette 1/28 |';
    expect(() => validateReplacementCoverage(inventory([replacedHero]), coverage))
      .toThrow('Couverture Facebook 27/28 obsolète');
  });

  it('rejects a stale 27/28 Facebook claim in a related archive card', () => {
    const replacedHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE** | — | Supplanté. |';
    const coverage = '| Facebook `Noctalia` | Hero | **28/28 heroes exacts** | dette 0/28 |';
    const archiveCard = '- Facebook : `27/28` heroes exacts programmés, dette `1/28`.';
    expect(() => validateReplacementCoverage(inventory([replacedHero]), coverage, archiveCard))
      .toThrow('Couverture Facebook 27/28 obsolète');
  });

  it('rejects a continuous X coverage claim while a scheduled C1 still needs replacement', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | — | Supplanté. |';
    const coverage = '| X `@NoctaliaDreams` | horaires | Programmé jusqu\'au **03/09** | dette future |';
    expect(() => validateReplacementCoverage(inventory([oldHero]), coverage))
      .toThrow('Couverture X continue interdite');
  });

  it('rejects an exact YouTube 19/28 claim while a scheduled hero still needs replacement', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | Supplanté. |';
    const coverage = '| YouTube `Noctalia` | Hero | Programmé jusqu\'au **01/09** | **9 heroes** prêts |';
    expect(() => validateReplacementCoverage(inventory([oldHero]), coverage))
      .toThrow('Couverture YouTube continue ou dette sous-estimée interdite');
  });

  it('accepts an exact YouTube 18/28 claim while the replacement remains pending', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | Supplanté. |';
    const coverage = '| YouTube `Noctalia` | Hero | **18/28 heroes exacts** | **10 actions** restantes |';
    expect(() => validateReplacementCoverage(inventory([oldHero]), coverage)).not.toThrow();
  });

  it('rejects an active YouTube retry that skips the pending 30/08 replacement', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | Supplanté. |';
    const activeCard = '| 10:45 | Une seule reprise YouTube du hero du 02/09 | preuve |';
    expect(() => validateActiveYouTubeOrder(inventory([oldHero]), activeCard))
      .toThrow('remplacer le 30/08 avant toute programmation du 02/09');
  });

  it('accepts the active YouTube retry when replacement proof gates 02/09', () => {
    const oldHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | Supplanté. |';
    const activeCard = "| 10:45 | Remplacer d'abord le hero erroné du 30/08 ; reprendre le 02/09 uniquement après preuve | preuve |";
    expect(() => validateActiveYouTubeOrder(inventory([oldHero]), activeCard)).not.toThrow();
  });

  it('rejects a stale main-plan claim that Facebook still needs replacement', () => {
    const replacedHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE** | — | Supplanté. |';
    const stalePlan = '| 30/08 | 15:30 / 15:45 / 16:15 | `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | hook | Les anciennes lignes YouTube/Facebook restent à remplacer avec preuve exacte. |';
    expect(() => validateMainPlanReplacementState(inventory([replacedHero]), stalePlan))
      .toThrow('Facebook doit être clos sans dette');
  });

  it('accepts a main-plan row that closes Facebook and keeps only YouTube pending', () => {
    const replacedHero = '| `old.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE** | — | Supplanté. |';
    const exactPlan = '| 30/08 | 15:30 / 15:45 / 16:15 | `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | hook | Facebook est **PROGRAMMÉ — REMPLACEMENT EXACT VÉRIFIÉ DANS LA MÊME LIGNE NATIVE**, sans dette restante ; seule YouTube reste à remplacer. |';
    expect(() => validateMainPlanReplacementState(inventory([replacedHero]), exactPlan)).not.toThrow();
  });

  it('requires a reversible and exact YouTube replacement package', () => {
    const oldHero = '| `DAY_LUNARPUNK_SILVER_LUNAR_02.mp4` | ANCIEN HERO | **À EXCLURE — SUPPLANTÉ** | — | — | — | — | **PROGRAMMÉ — À REMPLACER** | — | — | Supplanté. |';
    const newHero = '| `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | HERO | **RÉAFFECTÉ** | A | — | — | — | **PRÊT** | — | — | Floral. |';
    const card = `
ancien Short \`8-m-p4qXG_g\`
AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4
229d1f545586ccaa51e363af5fdb100d8e45906892c5b8bdfe08b9509527ced0
Would You Fly Through This Flower World? #Shorts
Not made for kids ; label IA ; droits
Seulement ensuite, modifier la visibilité de l'ancien Short vers \`Privée\`.
Ne jamais utiliser \`Supprimer définitivement\`.
Recontrôler qu'une seule occurrence publique future exacte reste à 18:00.
`;
    const proof = '| YouTube `UCQZsVAOggq_meTWYG-4dHfw` | 18:00 | `Would You Fly Through This Flower World? #Shorts` | **À REMPLACER — NON CONFIRMÉ** | À vérifier |\nelle sera alors passée en `Privée`, jamais supprimée';
    expect(() => validateYouTubeReplacementProtocol(inventory([oldHero, newHero]), card, proof)).not.toThrow();
    expect(() => validateYouTubeReplacementProtocol(
      inventory([oldHero, newHero]),
      card.replace('Seulement ensuite, ', ''),
      proof,
    )).toThrow('ordre transactionnel vers Privée absent');
  });

  it('reconciles exact HERO dates instead of trusting only coverage totals', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-queue-'));
    try {
      const dates = [];
      for (let day = 14; day <= 31; day += 1) dates.push(`2026-08-${String(day).padStart(2, '0')}`);
      for (let day = 1; day <= 10; day += 1) dates.push(`2026-09-${String(day).padStart(2, '0')}`);
      for (const date of dates) {
        const pinterest = date <= '2026-08-23' ? '**PROGRAMMÉ**' : '**PRÊT**';
        const youtube = date === '2026-08-30'
          ? '**À REMPLACER — NON CONFIRMÉ**'
          : (((date >= '2026-08-14' && date <= '2026-08-29') || date === '2026-08-31' || date === '2026-09-01') ? '**PROGRAMMÉ**' : '**PRÊT**');
        fs.writeFileSync(path.join(directory, `PUBLIC-PROOF-${date}.md`), [
          `| Pinterest \`@noctaliadreams\` | 17:30 | Hero | ${pinterest} | — |`,
          `| YouTube \`UCQZsVAOggq_meTWYG-4dHfw\` | 18:00 | Hero | ${youtube} | — |`,
          '| Facebook page `1266183263247451` | 18:15 | Hero | **PROGRAMMÉ** | — |',
        ].join('\n'));
      }
      const coverage = 'Pinterest : **10/28 heroes exacts**\nYouTube : **18/28 heroes exacts**\nFacebook : **28/28 heroes exacts**';
      expect(validateHeroQueueEvidence(directory, coverage)).toEqual({ Pinterest: 10, YouTube: 18, Facebook: 28 });
      const first = path.join(directory, 'PUBLIC-PROOF-2026-08-14.md');
      fs.writeFileSync(first, fs.readFileSync(first, 'utf8').replace(/\*\*PROGRAMMÉ\*\*/g, '**PUBLIÉ**'));
      expect(validateHeroQueueEvidence(directory, coverage)).toEqual({ Pinterest: 10, YouTube: 18, Facebook: 28 });
      const drift = path.join(directory, 'PUBLIC-PROOF-2026-08-24.md');
      fs.writeFileSync(drift, fs.readFileSync(drift, 'utf8').replace('**PRÊT**', '**PROGRAMMÉ**'));
      expect(() => validateHeroQueueEvidence(directory, coverage)).toThrow('Pinterest: compteur HERO incohérent');
      expect(validateHeroQueueEvidence(directory, coverage.replace('10/28', '11/28'))).toEqual({ Pinterest: 11, YouTube: 18, Facebook: 28 });
      expect(scheduledHeroDates(directory).get('Pinterest')).toHaveLength(11);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reconciles TikTok, Instagram direct and X across all 84 primary slots', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'primary-queue-'));
    try {
      const dates = [];
      for (let day = 14; day <= 31; day += 1) dates.push(`2026-08-${String(day).padStart(2, '0')}`);
      for (let day = 1; day <= 10; day += 1) dates.push(`2026-09-${String(day).padStart(2, '0')}`);
      let index = 0;
      for (const date of dates) {
        const rows = [];
        for (const slot of ['C1', 'C2', 'C3']) {
          const tiktok = index < 50 ? '**PROGRAMMÉ**' : '**PRÊT — NON PROGRAMMÉ**';
          rows.push(`| ${slot} | TikTok \`@noctaliadreams\` | 15:30 | \`asset-${index}.mp4\` | ${tiktok} | — |`);
          rows.push(`| ${slot} | Instagram \`@noctaliadreams\` | 15:45 | \`asset-${index}.mp4\` | **PRÊT — DIRECT** | — |`);
          rows.push(`| ${slot} | X \`@NoctaliaDreams\` | 16:15 | \`asset-${index}.mp4\` | **PROGRAMMÉ** | — |`);
          index += 1;
        }
        fs.writeFileSync(path.join(directory, `PUBLIC-PROOF-${date}.md`), rows.join('\n'));
      }
      const primaryCoverage = '| TikTok `@noctaliadreams` | cadence | **50/84 lignes exactes** | **34 lignes** à remplir |\n| Instagram `@noctaliadreams` | cadence | **84/84 lignes couvertes** | direct |\n| X `@NoctaliaDreams` | cadence | **84/84 lignes exactes** | **0 ligne restante** |';
      expect(validatePrimaryQueueEvidence(directory, primaryCoverage)).toEqual({ TikTok: 50, Instagram: 84, X: 84 });

      const drift = path.join(directory, 'PUBLIC-PROOF-2026-09-10.md');
      fs.writeFileSync(drift, fs.readFileSync(drift, 'utf8').replace('| C3 | X `@NoctaliaDreams` | 16:15 | `asset-83.mp4` | **PROGRAMMÉ** |', '| C3 | X `@NoctaliaDreams` | 16:15 | `asset-83.mp4` | **PRÊT — NON PROGRAMMÉ** |'));
      expect(() => validatePrimaryQueueEvidence(directory, primaryCoverage)).toThrow('X: couverture principale incohérente');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
