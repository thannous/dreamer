import { describe, expect, it } from '@jest/globals';

import {
  buildEmotionProfile,
  EMOTION_FAMILY_IDS,
  EMOTION_FAMILY_LEXICON,
  matchEmotionFamily,
  MIN_DREAMS_FOR_EMOTION_PROFILE,
  normalizeEmotionText,
  type EmotionFamilyId,
} from '../dreamEmotions';
import type { DreamAnalysis } from '../types';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1,
  transcript: 'Dream',
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  chatHistory: [],
  ...overrides,
});

const withEmotions = (id: number, names: string[]): DreamAnalysis =>
  buildDream({ id, emotions: names.map((name) => ({ name, insight: '' })) });

const languages = Object.keys(EMOTION_FAMILY_LEXICON) as (keyof typeof EMOTION_FAMILY_LEXICON)[];

type LexiconEntry = { language: string; family: EmotionFamilyId; fragment: string };

const allFragments: LexiconEntry[] = languages.flatMap((language) =>
  (Object.keys(EMOTION_FAMILY_LEXICON[language]) as EmotionFamilyId[]).flatMap((family) =>
    EMOTION_FAMILY_LEXICON[language][family].map((fragment) => ({ language, family, fragment }))
  )
);

/**
 * GROUNDING CORPUS — transcribed, not invented.
 *
 * Source: the measurement spike artifact `extracted-emotions.json` (30 real dreams, 20 fr +
 * 10 en, 89 emotion mentions, 78 DISTINCT names). Every distinct name is present here, either
 * in GROUNDING_CORPUS with a hand-assigned family, or in GROUNDING_CORPUS_UNMATCHED with a
 * written reason. Nothing was dropped.
 *
 * This is the highest-value test in the file: it drives `matchEmotionFamily` against strings
 * the product actually produced, not strings written to fit the lexicon.
 * Revert that makes it fail: delete `'lassitude'` from fr weariness — the named case
 * ['Lassitude', 'weariness'] goes red and names itself.
 */
const GROUNDING_CORPUS: [string, EmotionFamilyId][] = [
  // ── fr ──────────────────────────────────────────────────────────────────────
  ["Sentiment d'imposture", 'guilt'],
  ['Anxiété de performance', 'fear'],
  ['Lassitude', 'weariness'],
  ['Terreur', 'fear'],
  ['Vertige', 'disorientation'],
  ['Soulagement du réveil', 'serenity'],
  ['Épuisement', 'weariness'],
  ['Frustration diffuse', 'irritation'],
  ["Solitude auprès de l'autre", 'loneliness'],
  ['Impatience', 'irritation'],
  ['Résignation', 'helplessness'],
  ['Solitude dans la foule', 'loneliness'],
  ['Peur', 'fear'],
  ['Impuissance', 'helplessness'],
  ['Refus de regarder', 'fear'],
  ['Solitude', 'loneliness'],
  ['Obstination lasse', 'weariness'],
  ['Panique', 'fear'],
  ['Désarroi', 'disorientation'],
  ["Sentiment d'urgence", 'urgency'],
  ['Tendresse', 'tenderness'],
  ['Tristesse contenue', 'grief'],
  ["Peur de rompre l'instant", 'fear'],
  ['Euphorie', 'joy'],
  ['Légèreté', 'joy'],
  ['Appréhension', 'fear'],
  ['Découragement', 'helplessness'],
  ['Culpabilité', 'guilt'],
  ["Sentiment d'être à l'écart", 'loneliness'],
  ["Angoisse d'être démasqué", 'guilt'],
  ['Désorientation', 'disorientation'],
  ['Inquiétude', 'fear'],
  ['Détermination', 'urgency'],
  ['Urgence', 'urgency'],
  ['Résignation anticipée', 'helplessness'],
  ['Attachement', 'tenderness'],
  ['Agacement', 'irritation'],
  ['Étrangeté à soi', 'disorientation'],
  ['Stress', 'urgency'],
  ['Exaspération', 'irritation'],
  ["Solitude de l'urgence", 'loneliness'],
  ['Honte', 'guilt'],
  ['Malaise', 'fear'],
  ['Doute de soi', 'guilt'],
  ['Renoncement soulagé', 'serenity'],
  ['Effroi', 'fear'],
  ['Prudence figée', 'fear'],
  // ── en ──────────────────────────────────────────────────────────────────────
  ['Panic', 'fear'],
  ['Shame', 'guilt'],
  ['Isolation', 'loneliness'],
  ['Nostalgia', 'tenderness'],
  ['Quiet unease', 'fear'],
  ['Reluctance', 'weariness'],
  ['Calm', 'serenity'],
  ['Quiet apprehension', 'fear'],
  ['Exhilaration', 'joy'],
  ['Frustration', 'irritation'],
  ['Anxiety about being misread', 'fear'],
  ['Helplessness', 'helplessness'],
  ['Composure', 'serenity'],
  ['Reticence', 'weariness'],
  ['Loneliness in company', 'loneliness'],
  ['Restlessness', 'urgency'],
  ['Self-consciousness', 'guilt'],
  ['Comfort', 'serenity'],
  ['Grief', 'grief'],
  ['Trust', 'serenity'],
  ['Weariness', 'weariness'],
  ['Futility', 'helplessness'],
  ['Unexpected comfort', 'serenity'],
  ['Detachment', 'disorientation'],
  ['Fascination', 'joy'],
  ['Guilt', 'guilt'],
  ['Reluctant obligation', 'weariness'],
  ['Unease', 'fear'],
];

/**
 * Names from the same artifact deliberately left OUT of the lexicon. Each one is a real
 * string the product emitted; none is dropped silently. Adding a fragment for any of them
 * would blur a family boundary rather than sharpen it.
 */
const GROUNDING_CORPUS_UNMATCHED: string[] = [
  // Disappointment is not one of the 12 families: it sits between grief (the loss) and
  // helplessness (the futility), and mapping it to either would corrupt both counts.
  'Attente déçue',
  // "Not mattering" is a self-worth judgement, not an affect; it reads as loneliness in
  // some dreams and as guilt in others, so no single fragment is honest.
  'Sentiment de ne pas compter',
  // Responsibility is a stance toward a situation, not a feeling; the 12 families are
  // affective and none of them owns it.
  'Sentiment de responsabilité',
];

describe('dreamEmotions lexicon', () => {
  it('[A1] declares all twelve canonical families in every language and nothing else', () => {
    // Revert: delete the `serenity` list from the `it` pack.
    for (const language of languages) {
      expect(Object.keys(EMOTION_FAMILY_LEXICON[language]).sort()).toEqual([...EMOTION_FAMILY_IDS].sort());
    }

    expect(EMOTION_FAMILY_IDS).toHaveLength(12);
  });

  it('[A2] stores every fragment already normalised', () => {
    // Revert: paste 'Épuisement' into fr weariness — or re-add the leading-article strip
    // loop, which turned `a bout` into `bout` and broke this invariant against the module's
    // own lexicon.
    for (const { language, family, fragment } of allFragments) {
      const bare = fragment.replace(/\*/g, '');
      expect({ language, family, fragment, normalized: normalizeEmotionText(bare) }).toEqual({
        language,
        family,
        fragment,
        normalized: bare,
      });
    }
  });

  it('[A3] keeps single-token fragments long enough not to over-match', () => {
    // Revert: re-add fr `'las*'` (3-character prefix).
    // No short-prefix exception any more: `joy*` was silently inert (bucket key is the
    // first 4 chars, so a 3-char stem never met its own inflections) and is now spelled out.
    // Multi-token fragments are exempt from the length floor because
    // the whole sequence has to match contiguously; they only have to carry one real word.
    const SHORT_PREFIX_ALLOWLIST: string[] = [];

    for (const { language, family, fragment } of allFragments) {
      const tokens = fragment.split(' ');
      const where = `${language}/${family}/${fragment}`;

      if (tokens.length === 1) {
        const token = tokens[0];
        if (token.endsWith('*')) {
          if (SHORT_PREFIX_ALLOWLIST.includes(token)) continue;
          expect({ where, length: token.length - 1 >= 4 }).toEqual({ where, length: true });
        } else {
          expect({ where, length: token.length >= 3 }).toEqual({ where, length: true });
        }
      } else {
        const hasRealWord = tokens.some((token) => token.replace('*', '').length >= 4);
        expect({ where, hasRealWord }).toEqual({ where, hasRealWord: true });
      }
    }
  });

  it('[A4] maps every fragment to exactly one family across all five languages', () => {
    // GLOBAL uniqueness is what makes a language-free matcher safe.
    // Revert: add `'hate'` to fr urgency AND `'hate'` to en irritation.
    const owners = new Map<string, Set<EmotionFamilyId>>();

    for (const { family, fragment } of allFragments) {
      const set = owners.get(fragment) ?? new Set<EmotionFamilyId>();
      set.add(family);
      owners.set(fragment, set);
    }

    const ambiguous = [...owners.entries()]
      .filter(([, families]) => families.size > 1)
      .map(([fragment, families]) => `${fragment} -> ${[...families].sort().join(', ')}`);

    expect(ambiguous).toEqual([]);
  });
});

describe('dreamEmotions grounding corpus', () => {
  it.each(GROUNDING_CORPUS)('[B] matches the real emotion name %p to %p', (name: string, family: EmotionFamilyId) => {
    expect(matchEmotionFamily(name)).toBe(family);
  });

  it.each(GROUNDING_CORPUS_UNMATCHED.map((name) => [name]))(
    '[B] leaves the deliberately unmapped name %p unmatched',
    (name: string) => {
      // These are pinned so that "improving" the lexicon into one of them is a visible,
      // reviewed change rather than an accident.
      expect(matchEmotionFamily(name)).toBeNull();
    }
  );
});

describe('dreamEmotions matcher precedence', () => {
  it('[C1] prefers the two-token fragment over a one-token fragment of another family', () => {
    // Revert: drop rule 1 (tokenCount) from isBetterFragment — `espoir` (fr joy) wins.
    expect(matchEmotionFamily('sans espoir')).toBe('helplessness');
  });

  it('[C2] prefers the three-token fragment over a one-token fragment of another family', () => {
    // Revert: drop rule 1 — `perte` (fr grief) wins.
    expect(matchEmotionFamily('perte de contrôle')).toBe('helplessness');
  });

  it('[C3] prefers the heavier fragment when the token counts tie', () => {
    // THE ONLY test that kills rule 2 (weight). Revert: drop it — the tie falls to
    // source-ascending and 'hoffnung' < 'hoffnungslos*', so joy wins.
    expect(matchEmotionFamily('Hoffnungslosigkeit')).toBe('helplessness');
  });

  it('[C4] scans every start index, so a later multi-token fragment can beat an earlier one', () => {
    // Revert: drop rule 1 — `angoiss*` (fr fear) wins over `etre demasque` (fr guilt).
    expect(matchEmotionFamily('angoisse d’être démasqué')).toBe('guilt');
  });
});

describe('dreamEmotions normalisation', () => {
  it('[D1] ignores case and accents', () => {
    // Revert: delete stripAccents — 'é' becomes a separator and nothing matches.
    expect(matchEmotionFamily('ÉPUISEMENT')).toBe('weariness');
    expect(matchEmotionFamily('épuisement')).toBe('weariness');
  });

  it('[D2] matches a fragment that does not start the name', () => {
    // This does NOT guard an article-stripping step — there is none, deliberately. It guards
    // the matcher's scan-every-start-index loop, which is what makes stripping unnecessary.
    // C4 is the primary guard for that property; this is the cheap article-shaped case.
    expect(matchEmotionFamily('La solitude')).toBe('loneliness');
    expect(matchEmotionFamily('Die Einsamkeit')).toBe('loneliness');
  });

  it('[D3] splits on typographic punctuation', () => {
    // Revert: delete the punctuation replace — the token stays "l’angoisse", which does not
    // start with 'angoiss', and the match goes null.
    expect(matchEmotionFamily('l’angoisse')).toBe('fear');
  });

  it('[D4] drops parentheticals before matching', () => {
    // Revert: delete the parenthetical drop — the 2-token `sans espoir` outranks `peur*`
    // and the answer becomes helplessness.
    expect(matchEmotionFamily('peur (sans espoir)')).toBe('fear');
  });

  it('[D5] matches French fragments that begin with a one-letter word', () => {
    // THE ARTICLE-STRIP REGRESSION. Revert: re-add the leading-article strip loop — the
    // English article 'a' eats the head of `a bout` and `a l ecart`, both fragments become
    // permanently unmatchable, and both of these go null.
    expect(matchEmotionFamily('à bout de souffle')).toBe('weariness');
    expect(matchEmotionFamily('à l’écart')).toBe('loneliness');
  });
});

describe('dreamEmotions negation', () => {
  it('[E1] rejects a fragment preceded by a negator', () => {
    // Revert: delete the NEGATORS check in matchesAt.
    expect(matchEmotionFamily('sans peur')).toBeNull();
    expect(matchEmotionFamily('without fear')).toBeNull();
    expect(matchEmotionFamily('ohne Angst')).toBeNull();
  });

  it('[E2] never lets a negator inside a fragment guard against that fragment', () => {
    // Revert: make the guard scan the whole token list instead of the token before the
    // match start — `pas a la hauteur` would veto itself.
    expect(matchEmotionFamily('pas à la hauteur')).toBe('guilt');
  });

  it('[E3] returns null for vocabulary it does not know', () => {
    // Revert: return a default family instead of null.
    expect(matchEmotionFamily('quantum flux')).toBeNull();
  });
});

describe('buildEmotionProfile', () => {
  it('[F1] returns a neutral profile for an empty journal', () => {
    const profile = buildEmotionProfile([]);

    expect(profile.families).toEqual([]);
    expect(profile.distinctFamilies).toBe(0);
    expect(profile.dreamsWithEmotions).toBe(0);
    expect(profile.coverage).toBe(0);
    expect(profile.hasEnoughDreams).toBe(false);
    expect(profile.dreamsUntilReady).toBe(MIN_DREAMS_FOR_EMOTION_PROFILE);
  });

  it('[F2] skips dreams with no emotions array', () => {
    // Revert: drop the `Array.isArray` guard.
    const profile = buildEmotionProfile([buildDream({ id: 1 }), buildDream({ id: 2, emotions: [] })]);

    expect(profile.dreamsWithEmotions).toBe(0);
    expect(profile.totalMentions).toBe(0);
  });

  it('[F3] does not count a blank emotion name as a mention', () => {
    // Revert: drop `if (!name) continue` — the dream qualifies on whitespace alone.
    const profile = buildEmotionProfile([withEmotions(1, ['  ', ''])]);

    expect(profile.dreamsWithEmotions).toBe(0);
    expect(profile.totalMentions).toBe(0);
  });

  it('[F4] counts DREAMS, not mentions, per family', () => {
    // THE counting-unit test: the locked-state copy ("N emotions keep coming back") is only
    // honest if a family counts once per dream.
    // Revert: drop the per-dream Set and increment directly — fear would read 2.
    const profile = buildEmotionProfile([withEmotions(1, ['peur', 'terreur'])]);

    expect(profile.families).toEqual([{ family: 'fear', count: 1 }]);
    expect(profile.totalMentions).toBe(2);
    expect(profile.matchedMentions).toBe(2);
  });

  it('[F5a] keeps one-off detected families out of the recurring set', () => {
    const profile = buildEmotionProfile([
      withEmotions(1, ['peur']),
      withEmotions(2, ['joie']),
      withEmotions(3, ['solitude']),
    ]);

    expect(profile.families).toHaveLength(3);
    expect(profile.distinctFamilies).toBe(3);
    expect(profile.recurringFamilies).toEqual([]);
    expect(profile.recurringFamilyCount).toBe(0);
  });

  it('[F5b] marks a family as recurring only when it appears in multiple dreams', () => {
    const profile = buildEmotionProfile([
      withEmotions(1, ['peur']),
      withEmotions(2, ['terreur', 'joie']),
      withEmotions(3, ['solitude']),
    ]);

    expect(profile.recurringFamilies).toEqual([{ family: 'fear', count: 2 }]);
    expect(profile.recurringFamilyCount).toBe(1);
  });

  it('[F6] keeps unmatched mentions out of the matched count and out of coverage', () => {
    // Revert: count unmatched mentions into matchedMentions.
    const profile = buildEmotionProfile([withEmotions(1, ['peur', 'zzyzx'])]);

    expect(profile.matchedMentions).toBe(1);
    expect(profile.totalMentions).toBe(2);
    expect(profile.coverage).toBeCloseTo(0.5, 10);
    expect(profile.unmatched.mentions).toBe(1);
    expect(profile.unmatched.dreams).toBe(1);
  });

  it('[F7] counts every unmatched mention but the dream only once', () => {
    // `unmatched` deliberately keeps NO sample of the original names: nothing in production
    // read them, and they are raw user-derived text.
    // Revert: count unmatched dreams per mention instead of per dream -> dreams becomes 18.
    const noise = Array.from({ length: 17 }, (_, i) => `zzyzx${i}`);
    const profile = buildEmotionProfile([withEmotions(1, [...noise, 'zzyzx0'])]);

    expect(profile.unmatched.mentions).toBe(noise.length + 1);
    expect(profile.unmatched.dreams).toBe(1);
    expect(profile).not.toHaveProperty('unmatched.samples');
  });

  it('[F8] crosses the readiness boundary at exactly MIN_DREAMS_FOR_EMOTION_PROFILE', () => {
    // Revert: `>` instead of `>=` in hasEnoughDreams.
    const dreams = Array.from({ length: MIN_DREAMS_FOR_EMOTION_PROFILE }, (_, i) => withEmotions(i + 1, ['peur']));

    const ready = buildEmotionProfile(dreams);
    expect(ready.hasEnoughDreams).toBe(true);
    expect(ready.dreamsUntilReady).toBe(0);

    const short = buildEmotionProfile(dreams.slice(0, MIN_DREAMS_FOR_EMOTION_PROFILE - 1));
    expect(short.hasEnoughDreams).toBe(false);
    expect(short.dreamsUntilReady).toBe(1);
  });

  it('[F9] breaks count ties on the family id, not on insertion order', () => {
    // Revert: `.sort((a, b) => b.count - a.count)` — V8's stable sort keeps Map insertion
    // order and joy, inserted first, would come first.
    const profile = buildEmotionProfile([withEmotions(1, ['joie']), withEmotions(2, ['peur'])]);

    expect(profile.families.map((entry) => entry.family)).toEqual(['fear', 'joy']);
  });

  it('[F10] is independent of dream order and of emotion order within a dream', () => {
    // The fixture carries ZERO unmatched mentions on purpose: the unmatched counter is
    // push-ordered, so a fixture with two distinct unmatched names would make a whole-object
    // toEqual fail against a CORRECT implementation.
    const journal = [
      withEmotions(1, ['peur', 'solitude']),
      withEmotions(2, ['joie']),
      withEmotions(3, ['peur', 'lassitude']),
      withEmotions(4, ['solitude']),
      withEmotions(5, ['calme', 'joie']),
      withEmotions(6, ['colère']),
    ];

    expect(buildEmotionProfile(journal)).toEqual(buildEmotionProfile([...journal].reverse()));
    expect(buildEmotionProfile(journal).unmatched.mentions).toBe(0);
  });

  it('[F11] counts the same family across languages as one family', () => {
    // Revert: add a language parameter to matchEmotionFamily and scope the index.
    const profile = buildEmotionProfile([withEmotions(1, ['peur']), withEmotions(2, ['panic'])]);

    expect(profile.families).toEqual([{ family: 'fear', count: 2 }]);
  });
});

describe('dreamEmotions lexicon integrity sweeps', () => {
  it('[G1] allow-lists every cross-family prefix overlap', () => {
    // A4 keys on the fragment STRING, so it is blind to OVER-match: adding `'triste'` to fr
    // tenderness while fr grief holds `'trist*'` passes A4 (two distinct strings) and
    // silently steals every "triste" from grief.
    //
    // The allow-list is EMPTY today, and that is the finding: the adjudicated lexicon
    // contains no cross-family prefix shadowing at all. It stays here as the artifact any
    // future deliberate overlap must be written into, with a reason.
    // Revert that makes it fail: add `'triste'` to fr tenderness.
    const INTENDED_PREFIX_OVERLAPS: string[] = [];

    const singleToken = allFragments.filter((entry) => !entry.fragment.includes(' '));
    const found: string[] = [];

    for (const outer of singleToken) {
      if (!outer.fragment.endsWith('*')) continue;
      const prefix = outer.fragment.slice(0, -1);

      for (const inner of singleToken) {
        if (inner.family === outer.family) continue;
        if (!inner.fragment.replace('*', '').startsWith(prefix)) continue;
        found.push(`${outer.fragment}|${inner.fragment}`);
      }
    }

    expect([...new Set(found)].filter((pair) => !INTENDED_PREFIX_OVERLAPS.includes(pair)).sort()).toEqual([]);
    expect(INTENDED_PREFIX_OVERLAPS.filter((pair) => !found.includes(pair))).toEqual([]);
  });

  it('[G2] resolves every fragment to the family that declared it', () => {
    // ~975 assertions in one loop. This is the sweep that proves deleting the
    // leading-article machinery was behaviour-neutral across the whole lexicon.
    // Revert: re-add the leading-article strip loop — `a bout` and `a l ecart` report
    // themselves by name.
    const wrong = allFragments
      .map(({ language, family, fragment }) => ({
        where: `${language}/${family}/${fragment}`,
        resolved: matchEmotionFamily(fragment.replace(/\*/g, '')),
        family,
      }))
      .filter((entry) => entry.resolved !== entry.family)
      .map((entry) => `${entry.where} -> ${entry.resolved}`);

    expect(wrong).toEqual([]);
  });

  it('[G3] reports the true matched ratio over the grounding corpus plus three controls', () => {
    // Drives the AGGREGATE path (totalMentions / matchedMentions / coverage / unmatched),
    // which group B never executes. Two distinct reverts are caught: deleting any single
    // fragment covering a corpus string (matchedMentions drops), and changing coverage to
    // ignore the unmatched denominator.
    const controls = ['quantum flux', 'zzyzx', 'tessellation'];
    const names = [...GROUNDING_CORPUS.map(([name]) => name), ...GROUNDING_CORPUS_UNMATCHED, ...controls];
    const profile = buildEmotionProfile(names.map((name, i) => withEmotions(i + 1, [name])));

    expect(profile.totalMentions).toBe(GROUNDING_CORPUS.length + GROUNDING_CORPUS_UNMATCHED.length + controls.length);
    expect(profile.matchedMentions).toBe(GROUNDING_CORPUS.length);
    expect(profile.coverage).toBeCloseTo(profile.matchedMentions / profile.totalMentions, 10);
    expect(profile.unmatched.mentions).toBe(GROUNDING_CORPUS_UNMATCHED.length + controls.length);
    expect(profile.unmatched.dreams).toBe(GROUNDING_CORPUS_UNMATCHED.length + controls.length);
  });
});
