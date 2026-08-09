/**
 * Emotion families — matching a dream's free-text emotion names to 12 canonical families.
 *
 * WHY THIS MODULE EXISTS, AND WHY IT LOOKS LIKE THIS:
 *
 * (a) Emotion names are FREE TEXT. They are emitted by the analysis schema in the user's
 *     language at analysis time ("Sentiment d'imposture", "Quiet unease", "Reluctance"),
 *     so they do not concentrate on their own: a measurement spike over 30 real dreams
 *     found 89 mentions for 78 distinct names. Only a family lexicon makes them countable.
 *
 * (b) Dreams carry NO language tag. A user who switches app language keeps their old
 *     dreams, so one journal routinely holds mixed-language emotion names. The lexicon is
 *     therefore AUTHORED per language but INDEXED GLOBALLY, and `matchEmotionFamily` takes
 *     no language parameter. Global uniqueness (one fragment -> exactly one family) is what
 *     makes that safe, and it is enforced by a test.
 *
 * (c) The 12 family ids are FIXED by the phase-1 contract. Do not add to them, rename them
 *     or merge them. Widening the union is a product decision, not a refactor.
 *
 * (d) The lexicon is DATA, not UI copy, and must never move into `lib/i18n/*`. Only the
 *     family LABELS the user reads are UI copy; they live in the catalogues behind
 *     `stats.emotion.family.<id>` and are resolved by `getEmotionFamilyLabel`
 *     (lib/dreamLabels.ts).
 *
 * (e) THERE IS DELIBERATELY NO LEADING-ARTICLE STRIPPING. See the comment on
 *     `normalizeEmotionText` — it is load-bearing, not an omission.
 */

import { compareDreamFacets } from '@/lib/dreamFacets';
import type { AppLanguage, DreamAnalysis } from '@/lib/types';

export type EmotionFamilyId =
  | 'fear'
  | 'loneliness'
  | 'weariness'
  | 'helplessness'
  | 'irritation'
  | 'disorientation'
  | 'urgency'
  | 'tenderness'
  | 'grief'
  | 'joy'
  | 'serenity'
  | 'guilt';

export const EMOTION_FAMILY_IDS: readonly EmotionFamilyId[] = [
  'fear',
  'loneliness',
  'weariness',
  'helplessness',
  'irritation',
  'disorientation',
  'urgency',
  'tenderness',
  'grief',
  'joy',
  'serenity',
  'guilt',
] as const;

/** Dreams carrying at least one emotion name required before the section reads at all. */
export const MIN_DREAMS_FOR_EMOTION_PROFILE = 3;

// ─── Normalisation ───────────────────────────────────────────────────────────

const stripAccents = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Lower-cases, strips accents, drops parentheticals, and reduces everything that is not
 * `[a-z0-9]` to a single space.
 *
 * THERE IS NO LEADING-ARTICLE STRIPPING, ON PURPOSE.
 *
 * An earlier draft stripped one leading article from the UNION of all five languages'
 * article lists. That union contains the English article `a`, which ate the head of the
 * French fragments `a bout` (weariness, from "à bout") and `a l ecart` (loneliness, from
 * "à l'écart"), making both permanently unmatchable — and it broke this module's own
 * normalisation invariant, since `normalizeEmotionText('a bout') === 'bout' !== 'a bout'`.
 *
 * Stripping is also unnecessary: `matchEmotionFamily` scans EVERY start index, so a leading
 * article never blocks a match — "la solitude" matches `solitude` at index 1, "Die
 * Einsamkeit" matches `einsam*` at index 1. Deleting the machinery is therefore provably
 * behaviour-neutral in every other direction, and the fragment self-resolution sweep (test
 * G2) is the evidence across all ~900 fragments.
 *
 * Apostrophes, hyphens and slashes deliberately become SEPARATORS (a divergence from the
 * measurement spike): "angoisse d'être démasqué" tokenises to
 * [angoisse, d, etre, demasque], so the 2-token fragment `etre demasque` can match across
 * the apostrophe.
 */
export function normalizeEmotionText(raw: string): string {
  let text = stripAccents(String(raw ?? '').toLowerCase());
  text = text.replace(/\([^)]*\)/g, ' ');
  text = text.replace(/[^a-z0-9]+/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

const tokenize = (normalized: string): string[] => (normalized ? normalized.split(' ') : []);

// ─── Lexicon ─────────────────────────────────────────────────────────────────

/**
 * NOTATION
 * - A fragment is space-separated NORMALISED tokens (already lower-case, accent-free).
 * - A token ending in `*` is a PREFIX token: it matches any input token starting with it.
 * - A token without `*` is EXACT.
 * - LENGTH RULES apply to SINGLE-TOKEN fragments, which are the only ones that can
 *   over-match on their own: prefix >= 4 characters before the `*`, exact >= 3 characters.
 *   There is NO short-prefix exception: `joy*` used to be one, and it was silently inert —
 *   the bucket key is a token's first four characters, so a 3-character stem indexes under
 *   `joy` while its own inflections bucket under `joyf`/`joyo` and never find it. It is now
 *   spelled out as `joy`, `joyful`, `joyous`. Inside a MULTI-token fragment, short function words (`a l ecart`,
 *   `sense of loss`, `pas a la hauteur`) are harmless because the whole sequence has to match
 *   contiguously; those fragments are only required to carry at least one token of >= 4
 *   characters. All of this is enforced by test A3.
 *
 * FAMILY DEFINITIONS (what makes the assignments reviewable):
 * fear = dread, terror, panic, anxiety, worry, apprehension, unease, threat, avoidance.
 * loneliness = isolation, exclusion, abandonment, being apart or unseen, loneliness in company.
 * weariness = fatigue, depletion, boredom, lassitude, reluctance/reticence.
 * helplessness = powerlessness, resignation, futility, hopelessness, being trapped or overwhelmed.
 * irritation = annoyance, frustration, anger, exasperation, impatience, resentment.
 * disorientation = confusion, strangeness, vertigo, unreality, detachment, numbness, not recognising oneself.
 * urgency = pressure, haste, stress, restlessness, being late, determination/drive.
 * tenderness = affection, love, attachment, warmth, nostalgia, longing, compassion.
 * grief = sadness, sorrow, mourning, loss, melancholy, emptiness.
 * joy = happiness, euphoria, exhilaration, lightness, wonder, fascination, curiosity, pride, hope, freedom.
 * serenity = calm, peace, relief, comfort, safety, trust, composure, acceptance.
 * guilt = shame, remorse, regret, embarrassment, self-consciousness, imposter feeling, unworthiness.
 *
 * HOMOGRAPHS DELIBERATELY EXCLUDED (the traps found and removed — do not "restore" them):
 * - FR "hâte" and EN "hate" both normalise to `hate` but belong to different families
 *   (urgency / irritation) -> BOTH omitted; FR uses `precipitation`/`empressement`,
 *   EN uses `anger`/`fury`.
 * - FR "indigne" (unworthy, guilt) and "indigné" (indignant, irritation) both normalise to
 *   `indigne` -> omitted; FR guilt uses `indignite`, FR irritation uses `indignation`.
 * - IT `rifiut*` would cover both "rifiuto" (rejection -> loneliness) and "rifiuto di
 *   guardare" (refusal to look -> fear) -> omitted; IT loneliness uses `respint*`, and
 *   `rifiuto di guardare` is a 3-token fear fragment.
 * - ES/IT `solo`/`sola` alone are ambiguous (ES "alone" vs IT "only") -> only the 2-token
 *   `sentirse solo` / `sentirsi solo` forms are indexed.
 * - FR `las` (3 chars, identical to the Spanish article) -> omitted; weariness is reached
 *   through `lasse*` and `lassitude`.
 * - DE `hast` -> omitted (collides with the auxiliary verb); urgency uses `eile`, `hektik`,
 *   `zeitdruck`.
 */
export type EmotionLexicon = Readonly<Record<AppLanguage, Readonly<Record<EmotionFamilyId, readonly string[]>>>>;

export const EMOTION_FAMILY_LEXICON: EmotionLexicon = {
  en: {
    fear: ['fear*', 'afraid', 'scared', 'terror', 'terrif*', 'dread*', 'panic*', 'anxiet*', 'anxious', 'worry', 'worried', 'worrying', 'apprehens*', 'unease', 'uneasy', 'uneasiness', 'nervous*', 'alarm*', 'threat*', 'horror', 'horrif*', 'fright*', 'foreboding', 'angst', 'phobi*', 'danger', 'unsafe', 'on edge', 'avoidance', 'sense of danger', 'refusal to look', 'afraid to look'],
    loneliness: ['lonel*', 'alone', 'isolat*', 'abandon*', 'exclu*', 'left out', 'left behind', 'unseen', 'unheard', 'invisible', 'outsider', 'apart', 'disconnect*', 'reject*', 'solitude', 'estrange*', 'forsaken'],
    weariness: ['weari*', 'tired', 'tiredness', 'exhaust*', 'fatigu*', 'drain*', 'deplet*', 'worn out', 'heaviness', 'dull*', 'bored', 'boredom', 'reluctan*', 'reticen*', 'unwilling*', 'listless*', 'apath*', 'burnout', 'burned out', 'lethargy', 'lethargi*'],
    helplessness: ['helpless*', 'powerless*', 'hopeless*', 'futil*', 'resign*', 'defeat*', 'discourage*', 'despair', 'despond*', 'stuck', 'trapped', 'no control', 'out of control', 'loss of control', 'unable', 'inability', 'at the mercy', 'overwhelm*', 'vulnerab*', 'impoten*'],
    irritation: ['irritat*', 'annoy*', 'frustrat*', 'anger', 'angry', 'rage', 'furious', 'fury', 'exasperat*', 'impatien*', 'resent*', 'indignat*', 'outrage*', 'bitter*'],
    disorientation: ['confus*', 'disorient*', 'lost', 'strange*', 'unreal*', 'surreal', 'dreamlike', 'dizzy*', 'vertigo', 'bewilder*', 'dazed', 'daze', 'detach*', 'numb*', 'unmoored', 'adrift', 'uncanny', 'disarray', 'dissoci*', 'dereal*', 'depersonal*'],
    urgency: ['urgen*', 'hurry', 'haste', 'rush*', 'pressur*', 'stress*', 'restless*', 'agitat*', 'being late', 'running late', 'too late', 'deadline', 'no time', 'time running out', 'determin*'],
    tenderness: ['tender*', 'affection*', 'love', 'loving', 'warmth', 'caring', 'attach*', 'fond*', 'nostalg*', 'longing', 'yearning', 'intimacy', 'closeness', 'compassion*', 'devotion'],
    grief: ['grief', 'griev*', 'sad', 'sadness', 'sorrow*', 'mourn*', 'loss', 'sense of loss', 'bereave*', 'heartbreak*', 'heartache', 'melanchol*', 'tears', 'tearful', 'weeping', 'emptiness', 'hollow*'],
    // 'joy' is spelled out rather than written 'joy*': the bucket key is the first
    // four characters of a token, so a three-character prefix stem indexes under
    // 'joy' while its own inflections bucket under 'joyf'/'joyo' and never find it.
    // Prefix stems must stay >= 4 characters — see the bucketKey invariant.
    joy: ['joy', 'joyful', 'joyous', 'happy', 'happiness', 'delight*', 'euphori*', 'exhilarat*', 'elat*', 'excit*', 'lightness', 'buoyan*', 'wonder*', 'awe', 'fascinat*', 'curiosity', 'curious', 'amusement', 'amused', 'playful*', 'triumph*', 'pride', 'hope', 'hopeful*', 'freedom'],
    serenity: ['calm*', 'peace*', 'seren*', 'relief', 'reliev*', 'comfort*', 'safe', 'safety', 'secure', 'security', 'reassur*', 'sooth*', 'contentment', 'contented', 'composure', 'composed', 'stillness', 'trust*', 'acceptance', 'accepting', 'gentle*', 'ease', 'at ease', 'grounded', 'steadiness', 'steady', 'letting go'],
    guilt: ['guilt*', 'shame*', 'ashamed', 'remorse*', 'regret*', 'embarrass*', 'self conscious*', 'self blame', 'self doubt', 'self reproach', 'self criticism', 'impost*', 'fraud*', 'unworthy', 'unworthiness', 'inadequa*', 'exposed', 'being exposed', 'unmasked', 'found out', 'being found out', 'humiliat*', 'disgrace*', 'not good enough'],
  },
  fr: {
    fear: ['peur*', 'angoiss*', 'inquiet*', 'effroi', 'terreur', 'terrifi*', 'paniqu*', 'apprehen*', 'malaise*', 'craint*', 'frayeur', 'phobi*', 'menac*', 'danger*', 'insecurit*', 'alarm*', 'nervosit*', 'nerveu*', 'trac', 'prudence figee', 'refus de regarder', 'evitement', 'en danger'],
    loneliness: ['solitude', 'seul*', 'isol*', 'abandon*', 'exclu*', 'a l ecart', 'rejet*', 'incompris*', 'invisible', 'delaiss*', 'esseul*', 'solitude dans la foule'],
    weariness: ['lassitude', 'lasse*', 'epuis*', 'fatigu*', 'usure', 'ennui*', 'apath*', 'torpeur', 'lourdeur', 'pesanteur', 'a bout', 'reticen*', 'desinteret', 'morosite'],
    helplessness: ['impuissan*', 'desespoir', 'desesper*', 'resignation', 'resign*', 'decourag*', 'abattement', 'abattu*', 'defaite', 'en vain', 'futilit*', 'inutilit*', 'sans espoir', 'sans issue', 'coince*', 'piege*', 'depasse*', 'accabl*', 'submerge*', 'perte de controle', 'sans controle', 'vulnerab*', 'incapacit*', 'incapable', 'desarme*'],
    irritation: ['irrit*', 'agac*', 'enerv*', 'frustr*', 'colere', 'rage', 'fureur', 'furieu*', 'exasper*', 'impatien*', 'ressentiment', 'rancoeur', 'indignation', 'amertume'],
    disorientation: ['confus*', 'desorient*', 'perdu*', 'egare*', 'etranget*', 'etrangere a soi', 'etranger a soi', 'irreel*', 'surreel*', 'vertige*', 'desarroi', 'trouble', 'flou', 'dissoci*', 'depersonnal*', 'engourdissement', 'detach*', 'brouillard'],
    urgency: ['urgence', 'urgent*', 'precipitation', 'empressement', 'stress*', 'pression', 'tension', 'agitation', 'agite*', 'febril*', 'determin*', 'en retard', 'trop tard', 'manque de temps', 'course contre la montre'],
    tenderness: ['tendress*', 'affection', 'affectueu*', 'amour*', 'amoureu*', 'chaleur', 'attachement', 'attach*', 'nostalgi*', 'douceur', 'bienveillance', 'complicite', 'intimite', 'proximite'],
    grief: ['tristesse', 'triste*', 'chagrin*', 'peine', 'deuil', 'perte', 'sentiment de perte', 'melancoli*', 'larmes', 'pleurs', 'desolation', 'dechirement', 'vide', 'douleur', 'souffrance'],
    joy: ['joie*', 'heureu*', 'bonheur', 'euphori*', 'exalt*', 'enthousias*', 'excit*', 'legerete', 'emerveill*', 'fascin*', 'curiosite', 'curieu*', 'amuse*', 'jubilation', 'triomphe', 'fierte', 'espoir', 'liberte', 'ravissement', 'allegresse'],
    serenity: ['calme*', 'paix', 'serenit*', 'soulag*', 'apais*', 'reconfort*', 'securite', 'en securite', 'rassur*', 'confiance', 'accept*', 'quietude', 'tranquill*', 'repos', 'lacher prise', 'bien etre'],
    guilt: ['culpabilit*', 'coupable', 'honte*', 'honteu*', 'remords', 'regret*', 'gene', 'embarras*', 'impost*', 'doute de soi', 'demasque*', 'etre demasque', 'indignite', 'humili*', 'inadequat*', 'pas a la hauteur'],
  },
  es: {
    fear: ['miedo*', 'temor*', 'terror*', 'panic*', 'ansied*', 'angusti*', 'inquietud', 'preocupa*', 'aprensi*', 'desasosiego', 'nervios*', 'alarma*', 'amenaza*', 'peligro*', 'pavor', 'fobia*', 'inseguridad', 'evitacion'],
    loneliness: ['soledad', 'sentirse solo', 'sentirse sola', 'aisl*', 'abandon*', 'exclu*', 'rechazo', 'apartad*', 'invisible', 'incomprendid*', 'desarraigo'],
    weariness: ['cansanci*', 'cansad*', 'agotam*', 'agotad*', 'fatiga*', 'hastio', 'aburrimient*', 'aburrid*', 'desgaste', 'apat*', 'pesadez', 'reticen*', 'desgan*', 'abulia'],
    helplessness: ['impotenci*', 'impotent*', 'desesperanz*', 'desespera*', 'resignaci*', 'resignad*', 'desanim*', 'desalient*', 'derrota*', 'atrapad*', 'sin salida', 'sin esperanza', 'inutilidad', 'incapaz', 'incapacidad', 'desamparo', 'abrumad*', 'sin control', 'perdida de control', 'vulnerab*'],
    irritation: ['irritaci*', 'irritad*', 'enfado', 'enojo', 'molest*', 'frustraci*', 'frustrad*', 'rabia', 'furia', 'furios*', 'exasperaci*', 'impacienc*', 'impacient*', 'resentimient*', 'indignaci*', 'amargura', 'colera'],
    disorientation: ['confusi*', 'confundid*', 'desorientaci*', 'desorientad*', 'perdido', 'perdidos', 'extran*', 'irreal*', 'vertigo', 'mareo', 'aturdimient*', 'desconciert*', 'desconcertad*', 'entumecim*', 'desapego', 'disociaci*'],
    urgency: ['urgencia', 'urgent*', 'prisa', 'apremio', 'presion', 'estres', 'tension', 'agitaci*', 'agitad*', 'determinaci*', 'decidid*', 'llegar tarde', 'sin tiempo', 'contrarreloj', 'apuro'],
    tenderness: ['ternura', 'tiern*', 'afecto', 'afectuos*', 'amor', 'amoros*', 'carino', 'carinos*', 'calidez', 'apego', 'nostalgi*', 'dulzura', 'intimidad', 'cercania', 'anoranza', 'compasi*'],
    grief: ['tristeza', 'trist*', 'pena', 'duelo', 'perdida', 'melancoli*', 'dolor*', 'sufrimient*', 'llanto', 'lagrimas', 'desconsuelo', 'vacio', 'congoja'],
    joy: ['alegria', 'alegr*', 'feliz', 'felic*', 'euforia', 'eufori*', 'entusiasm*', 'excitaci*', 'ligereza', 'asombro', 'maravill*', 'fascinaci*', 'fascinad*', 'curiosidad', 'curios*', 'diversion', 'orgullo', 'esperanza', 'libertad', 'jubilo', 'dicha'],
    serenity: ['calma*', 'tranquil*', 'paz', 'seren*', 'alivio', 'aliviad*', 'sosiego', 'consuelo', 'seguridad', 'segur*', 'confianza', 'aceptaci*', 'reposo', 'bienestar'],
    guilt: ['culpa*', 'verguenza', 'avergonzad*', 'remordimient*', 'arrepentim*', 'bochorno', 'impostor*', 'indignidad', 'humillaci*', 'inadecuaci*', 'duda de si', 'expuest*'],
  },
  de: {
    fear: ['angst*', 'furcht*', 'panik*', 'schreck*', 'entsetz*', 'grauen', 'sorge*', 'besorg*', 'beunruhig*', 'nervos*', 'bedroh*', 'gefahr*', 'unsicherheit', 'phobie*', 'beklommen*', 'mulmig', 'vermeidung'],
    loneliness: ['einsam*', 'allein*', 'isoli*', 'verlass*', 'ausgeschloss*', 'ausgrenzung', 'abgelehnt', 'unsichtbar', 'zuruckgewiesen'],
    weariness: ['mude*', 'erschopf*', 'ermud*', 'ausgelaugt', 'uberdruss', 'langeweile', 'lustlos*', 'apathie', 'schwere', 'zoger*', 'widerwill*', 'abgeschlagen', 'matt'],
    helplessness: ['hilflos*', 'ohnmacht*', 'machtlos*', 'ausweglos*', 'hoffnungslos*', 'resign*', 'entmutig*', 'verzweifl*', 'gefangen', 'festgefahren', 'uberford*', 'uberwalt*', 'kontrollverlust', 'ausgeliefert', 'verletzlich*', 'unfahig*', 'sinnlos*'],
    irritation: ['arger*', 'genervt', 'gereizt*', 'frustr*', 'wut', 'wuten*', 'zorn*', 'ungeduld*', 'groll', 'emport*', 'verbitter*', 'verargert'],
    disorientation: ['verwirr*', 'desorientier*', 'orientierungslos*', 'verloren*', 'fremdheit', 'befremd*', 'unwirklich*', 'schwindel*', 'benommen*', 'betaubt*', 'entfremd*', 'losgelost*', 'dissoziat*'],
    urgency: ['dringlich*', 'dringend*', 'eile', 'hektik', 'zeitdruck', 'druck', 'stress*', 'anspannung', 'unruhe', 'unruhig*', 'getrieben*', 'entschlossen*', 'zu spat', 'zeitnot'],
    tenderness: ['zartlich*', 'zuneigung', 'liebe*', 'warme', 'verbundenheit', 'bindung', 'nostalgi*', 'sehnsucht', 'mitgefuhl*', 'innigkeit', 'zuwendung'],
    grief: ['trauer*', 'traurig*', 'kummer', 'verlust*', 'schmerz*', 'melancholi*', 'wehmut', 'leid', 'leiden', 'tranen', 'betrubt*', 'leere'],
    joy: ['freude*', 'freudig*', 'glucklich*', 'gluck', 'euphori*', 'begeister*', 'aufregung', 'leichtigkeit', 'staunen', 'faszin*', 'neugier*', 'vergnugen', 'stolz', 'hoffnung', 'hoffnungsvoll*', 'freiheit', 'jubel'],
    serenity: ['ruhe*', 'gelassen*', 'frieden*', 'friedlich*', 'erleichter*', 'beruhig*', 'trost*', 'geborgenheit', 'sicherheit', 'vertrauen*', 'akzeptanz', 'entspann*', 'stille', 'wohlgefuhl', 'zufrieden*'],
    guilt: ['schuld*', 'scham*', 'schande', 'beschamt*', 'reue', 'bedauern', 'peinlich*', 'verlegenheit', 'hochstapler*', 'blossgestellt*', 'entlarvt*', 'unzulanglich*', 'minderwertig*', 'erniedrig*', 'versagen*'],
  },
  it: {
    fear: ['paura*', 'timore*', 'terrore*', 'panic*', 'ansia*', 'ansios*', 'angoscia*', 'inquietudine', 'preoccupa*', 'apprension*', 'nervos*', 'allarm*', 'minacci*', 'pericol*', 'spavent*', 'fobia*', 'insicurezza', 'evitamento', 'rifiuto di guardare'],
    loneliness: ['solitudine', 'sentirsi solo', 'sentirsi sola', 'isolam*', 'isolat*', 'abbandon*', 'esclus*', 'respint*', 'invisibile', 'incompres*', 'emarginat*'],
    weariness: ['stanchezza', 'stanc*', 'spossat*', 'esaurim*', 'esaurit*', 'sfinim*', 'sfinit*', 'fatica*', 'noia', 'apatia', 'riluttan*', 'reticen*', 'pesantezza', 'svogliat*', 'logorio'],
    helplessness: ['impotenz*', 'impotent*', 'dispera*', 'rassegn*', 'scoraggiam*', 'scoraggiat*', 'sconfitt*', 'intrappolat*', 'senza via', 'senza speranza', 'inutilita', 'incapac*', 'sopraffatt*', 'vulnerabil*', 'perdita di controllo', 'sconforto'],
    irritation: ['irrit*', 'fastidio', 'infastidit*', 'frustr*', 'rabbia', 'arrabbiat*', 'furia', 'furios*', 'esasper*', 'impazien*', 'risentiment*', 'indignazione', 'amarezza', 'collera'],
    disorientation: ['confus*', 'disorientam*', 'disorientat*', 'perdut*', 'smarrim*', 'smarrit*', 'estraneit*', 'stran*', 'irreal*', 'vertigin*', 'stordim*', 'intorpidim*', 'distacco', 'distaccat*', 'dissociaz*', 'spaesament*'],
    urgency: ['urgenza', 'urgent*', 'fretta', 'premura', 'pressione', 'stress*', 'tensione', 'agitazione', 'agitat*', 'irrequiet*', 'determinazione', 'determin*', 'in ritardo', 'troppo tardi', 'affanno'],
    tenderness: ['tenerezza', 'affetto', 'affettuos*', 'amore*', 'amorevol*', 'calore', 'attaccament*', 'nostalgi*', 'dolcezza', 'intimita', 'vicinanza', 'compassion*'],
    grief: ['tristezza', 'trist*', 'dolore*', 'lutto', 'perdita', 'malinconi*', 'sofferenza', 'pianto', 'lacrime', 'vuoto', 'struggimento', 'cordoglio'],
    joy: ['gioia*', 'felic*', 'euforia', 'eufori*', 'entusiasm*', 'eccitazione', 'leggerezza', 'meraviglia', 'stupore', 'affascinat*', 'fascinazione', 'curiosita', 'curios*', 'divertimento', 'orgoglio', 'speranza', 'liberta', 'esultanza', 'allegria'],
    serenity: ['calma*', 'tranquill*', 'pace', 'seren*', 'sollievo', 'conforto', 'sicurezza', 'rassicur*', 'fiducia', 'accettazione', 'quiete', 'riposo', 'benessere'],
    guilt: ['colpa*', 'colpevol*', 'vergogna*', 'vergognos*', 'rimorso', 'rimpianto', 'imbarazz*', 'impostor*', 'smascherat*', 'inadeguat*', 'umiliazione', 'umilia*', 'indegnita'],
  },
};

// ─── Lazy global index + matcher ─────────────────────────────────────────────

type LexiconFragment = {
  family: EmotionFamilyId;
  /** Fragment tokens with the prefix marker stripped. */
  tokens: string[];
  /** Per token: true when that token is a prefix match. */
  prefixLast: boolean[];
  tokenCount: number;
  /** Total characters of the fragment excluding '*' and spaces. */
  weight: number;
  /** The raw fragment string, for the tie-break and for failure messages. */
  source: string;
};

/**
 * Bucket key = first 4 characters of the fragment's first token (the whole token when
 * shorter). Prefix tokens are >= 4 chars, so the key is always derivable, and any input
 * token that could match shares the same key: key(t) = t.slice(0, 4).
 */
const bucketKey = (token: string) => token.slice(0, 4);

let index: Map<string, LexiconFragment[]> | null = null;

function getIndex(): Map<string, LexiconFragment[]> {
  if (index) return index;

  const built = new Map<string, LexiconFragment[]>();

  for (const language of Object.keys(EMOTION_FAMILY_LEXICON) as AppLanguage[]) {
    const families = EMOTION_FAMILY_LEXICON[language];

    for (const family of Object.keys(families) as EmotionFamilyId[]) {
      for (const source of families[family]) {
        const rawTokens = source.split(' ');
        const tokens = rawTokens.map((token) => (token.endsWith('*') ? token.slice(0, -1) : token));
        const prefixLast = rawTokens.map((token) => token.endsWith('*'));
        const fragment: LexiconFragment = {
          family,
          tokens,
          prefixLast,
          tokenCount: tokens.length,
          weight: tokens.join('').length,
          source,
        };

        const key = bucketKey(tokens[0]);
        const bucket = built.get(key);
        if (bucket) bucket.push(fragment);
        else built.set(key, [fragment]);
      }
    }
  }

  index = built;
  return built;
}

/**
 * Negation is per-occurrence, not per-fragment: a fragment that matches at one negated
 * position and one clean position still counts. The guard only inspects the token BEFORE
 * the match start, which is why a negator INSIDE a fragment (`pas a la hauteur`,
 * `sans espoir`) is never treated as a guard against itself.
 */
const NEGATORS = new Set([
  'no', 'not', 'without', 'never',
  'sans', 'pas', 'aucun', 'aucune', 'jamais', 'ni',
  'sin', 'ningun', 'ninguna', 'nunca',
  'ohne', 'kein', 'keine', 'keinen', 'nie', 'niemals',
  'senza', 'nessun', 'nessuna', 'mai',
]);

function matchesAt(tokens: string[], at: number, fragment: LexiconFragment): boolean {
  if (at + fragment.tokenCount > tokens.length) return false;
  if (at > 0 && NEGATORS.has(tokens[at - 1])) return false;

  for (let offset = 0; offset < fragment.tokenCount; offset += 1) {
    const token = tokens[at + offset];
    const expected = fragment.tokens[offset];
    if (fragment.prefixLast[offset]) {
      if (!token.startsWith(expected)) return false;
    } else if (token !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Ranking is on the FRAGMENT, not the matched span: more tokens wins, then more characters,
 * then source ascending (code-unit, never `localeCompare`), then family ascending.
 */
function isBetterFragment(a: LexiconFragment, b: LexiconFragment): boolean {
  if (a.tokenCount !== b.tokenCount) return a.tokenCount > b.tokenCount;
  if (a.weight !== b.weight) return a.weight > b.weight;
  if (a.source !== b.source) return a.source < b.source;
  return a.family < b.family;
}

/**
 * Maps one free-text emotion name to a family, or null when nothing in the lexicon matches.
 * Takes NO language parameter: global fragment uniqueness makes fragment -> family a
 * function, and one journal routinely mixes languages.
 */
export function matchEmotionFamily(rawName: string): EmotionFamilyId | null {
  const tokens = tokenize(normalizeEmotionText(rawName));
  if (tokens.length === 0) return null;

  let best: LexiconFragment | null = null;

  for (let i = 0; i < tokens.length; i += 1) {
    for (const fragment of getIndex().get(bucketKey(tokens[i])) ?? []) {
      if (!matchesAt(tokens, i, fragment)) continue;
      if (best === null || isBetterFragment(fragment, best)) best = fragment;
    }
  }

  return best ? best.family : null;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export type EmotionFamilyCount = {
  family: EmotionFamilyId;
  /** Number of DREAMS in which this family appears at least once. */
  count: number;
};

export type EmotionProfile = {
  /** Every family with count > 0, ranked. The caller slices; this module does not. */
  families: EmotionFamilyCount[];
  /** Families present in at least two distinct dreams, preserving the same ranking. */
  recurringFamilies: EmotionFamilyCount[];
  /** Dreams that carried at least one non-blank emotion name. */
  dreamsWithEmotions: number;
  /** Number of families with count > 0 — the honest number the locked state shows. */
  distinctFamilies: number;
  /** Number of families present in at least two distinct dreams. */
  recurringFamilyCount: number;
  totalMentions: number;
  matchedMentions: number;
  /** matchedMentions / totalMentions, 0..1, exactly 0 when totalMentions === 0. Not rounded. */
  coverage: number;
  unmatched: {
    /** Dreams that produced at least one unmatched mention. */
    dreams: number;
    mentions: number;
  };
  hasEnoughDreams: boolean;
  /** Math.max(0, MIN_DREAMS_FOR_EMOTION_PROFILE - dreamsWithEmotions) — the single source for the "N more" copy. */
  dreamsUntilReady: number;
};

/**
 * A QUALIFYING DREAM is one whose `emotions` array holds at least one non-blank `name`.
 * Deliberately NOT gated on `isDreamAnalyzed` — the emotions array is itself the evidence
 * that the analysis ran, and a stricter gate would silently drop dreams restored from an
 * older schema.
 */
export function buildEmotionProfile(dreams: DreamAnalysis[]): EmotionProfile {
  const counts = new Map<EmotionFamilyId, number>();

  let dreamsWithEmotions = 0;
  let totalMentions = 0;
  let matchedMentions = 0;
  let unmatchedMentions = 0;
  let unmatchedDreams = 0;

  for (const dream of dreams) {
    const emotions = dream?.emotions;
    if (!Array.isArray(emotions) || emotions.length === 0) continue;

    const seen = new Set<EmotionFamilyId>();
    let sawMention = false;
    let sawUnmatched = false;

    for (const emotion of emotions) {
      const name = typeof emotion?.name === 'string' ? emotion.name.trim() : '';
      if (!name) continue;

      sawMention = true;
      totalMentions += 1;

      const family = matchEmotionFamily(name);
      if (family) {
        matchedMentions += 1;
        seen.add(family);
      } else {
        sawUnmatched = true;
        unmatchedMentions += 1;
      }
    }

    if (!sawMention) continue;

    dreamsWithEmotions += 1;
    if (sawUnmatched) unmatchedDreams += 1;
    for (const family of seen) counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  const families: EmotionFamilyCount[] = Array.from(counts.entries())
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => compareDreamFacets(a.count, a.family, b.count, b.family));
  const recurringFamilies = families.filter(({ count }) => count >= 2);

  return {
    families,
    recurringFamilies,
    dreamsWithEmotions,
    distinctFamilies: families.length,
    recurringFamilyCount: recurringFamilies.length,
    totalMentions,
    matchedMentions,
    coverage: totalMentions === 0 ? 0 : matchedMentions / totalMentions,
    unmatched: {
      dreams: unmatchedDreams,
      mentions: unmatchedMentions,
    },
    hasEnoughDreams: dreamsWithEmotions >= MIN_DREAMS_FOR_EMOTION_PROFILE,
    dreamsUntilReady: Math.max(0, MIN_DREAMS_FOR_EMOTION_PROFILE - dreamsWithEmotions),
  };
}
