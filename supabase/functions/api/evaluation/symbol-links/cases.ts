/**
 * Synthetic pairs of short dream accounts for the symbol-link bench, written for it.
 * They are not real journal content. Dream A is analyzed first, without known symbols;
 * dream B is analyzed with the known symbols that A's stored reading yields.
 *
 * Each side names its target element with a pattern over symbol names (the reading is in
 * the dream's language, so patterns cover both languages). What is expected by kind:
 * - same: one element worded differently; B's target carries A's target link.
 * - return: one element, salient in A and secondary in B; B still lists it, with A's link.
 * - trap: similar words for different things; no symbol of B carries A's target link.
 * - dictionary: forms of one dictionary symbol; each target resolves to `expectedSymbolId`.
 */
import { DREAM_SYMBOL_IDS } from '../../lib/dreamSymbolIds.ts';

export type SymbolLinkKind = 'same' | 'return' | 'trap' | 'dictionary';
export const SYMBOL_LINK_KINDS: readonly SymbolLinkKind[] = ['same', 'return', 'trap', 'dictionary'];

export type DreamSide = { transcript: string; target: RegExp };

export type SymbolLinkCase = {
  id: string;
  kind: SymbolLinkKind;
  lang: 'fr' | 'en';
  /** What the pair tests. */
  note: string;
  a: DreamSide;
  b: DreamSide;
  /** dictionary only: the id both targets must resolve to. */
  expectedSymbolId?: string;
};

export const SYMBOL_LINK_CASES: readonly SymbolLinkCase[] = [
  // ---- same: one element, worded differently.
  {
    id: 'same-lighthouse',
    kind: 'same',
    lang: 'fr',
    note: 'A lighthouse named in A, only described in B.',
    a: {
      transcript: 'Je marchais sur une plage de galets au crépuscule. Au bout de la jetée, un vieux phare blanc balayait l’eau de son faisceau. Je voulais l’atteindre avant la nuit, mais le sable me ralentissait à chaque pas.',
      target: /phare|lighthouse/iu,
    },
    b: {
      transcript: 'J’étais sur un bateau de pêche dans le brouillard. Sur un rocher, une grande tour éclairait la mer par intervalles réguliers, et le capitaine disait qu’il fallait la suivre pour rentrer au port.',
      target: /phare|lighthouse|\btour\b|tower|lumi[eè]re|\blight\b|faisceau|beacon/iu,
    },
  },
  {
    id: 'same-grandmother-house',
    kind: 'same',
    lang: 'fr',
    note: 'The grandmother’s country house, then "chez mamie".',
    a: {
      transcript: 'J’étais dans la maison de campagne de ma grand-mère, avec ses volets verts et l’odeur de confiture qui venait de la cuisine. Elle m’appelait depuis le jardin mais je ne la trouvais pas.',
      target: /maison|house|campagne|chez/iu,
    },
    b: {
      transcript: 'Je suis arrivé chez mamie à vélo. Tout était pareil : les volets verts, la nappe à carreaux, le vieux buffet. Mais il n’y avait personne.',
      target: /chez|maison|house|mamie|grand-?m[eè]re|grandmother/iu,
    },
  },
  {
    id: 'same-carousel',
    kind: 'same',
    lang: 'fr',
    note: 'A carousel named in A, described by its wooden horses in B (not the dictionary horse).',
    a: {
      transcript: 'Sur une place déserte, un manège tournait tout seul avec sa musique d’orgue un peu fausse. Je montais dessus et il accélérait jusqu’à ce que la place disparaisse.',
      target: /man[eè]ge|carousel|merry/iu,
    },
    b: {
      transcript: 'C’était une fête foraine, la nuit. Des chevaux de bois montaient et descendaient en rond sous des ampoules colorées, et je n’arrivais pas à descendre du mien.',
      target: /man[eè]ge|carousel|merry|chevaux de bois|cheval de bois|wooden horse/iu,
    },
  },
  {
    id: 'same-treehouse',
    kind: 'same',
    lang: 'fr',
    note: 'A treehouse, then "the little plank house in the tree" (not the dictionary house).',
    a: {
      transcript: 'Je me cachais dans une cabane construite dans un vieux chêne. Les planches craquaient et, par la fenêtre, je voyais toute la vallée.',
      target: /cabane|treehouse|tree ?house|tree-house/iu,
    },
    b: {
      transcript: 'Je montais une échelle de corde jusqu’à la petite maison de planches perchée dans l’arbre de mon enfance. Quelqu’un avait laissé une lampe allumée à l’intérieur.',
      target: /cabane|maison|treehouse|tree ?house|tree-house|house/iu,
    },
  },
  {
    id: 'same-vending-machine',
    kind: 'same',
    lang: 'en',
    note: 'A vending machine, then "a snack dispenser".',
    a: {
      transcript: 'I was stuck in a school hallway at night. A glowing vending machine hummed at the end of it, and every button I pressed gave me a different coin back.',
      target: /vending|machine|distributeur/iu,
    },
    b: {
      transcript: 'In the train station there was a snack dispenser full of tiny glass bottles. I kept feeding it tickets instead of money and it kept refusing them.',
      target: /vending|dispenser|machine|distributeur/iu,
    },
  },
  {
    id: 'same-piano',
    kind: 'same',
    lang: 'en',
    note: 'A piano named in A, "a big black instrument with ivory keys" in B (not the dictionary key).',
    a: {
      transcript: 'I was playing an old upright piano in an empty concert hall. Some notes made no sound at all, and I kept searching for the missing ones.',
      target: /piano/iu,
    },
    b: {
      transcript: 'Someone had left a big black instrument with ivory keys in my kitchen. When I lifted the lid, it was full of sand.',
      target: /piano|instrument/iu,
    },
  },

  // ---- return: salient in A, secondary in B.
  {
    id: 'return-lighthouse',
    kind: 'return',
    lang: 'fr',
    note: 'A lighthouse at the centre of A, glimpsed through a window in B.',
    a: {
      transcript: 'Je vivais seule dans un phare au milieu de l’océan. Chaque soir, je montais allumer la grande lampe et j’attendais qu’un bateau réponde.',
      target: /phare|lighthouse/iu,
    },
    b: {
      transcript: 'Je préparais un dîner pour des amis dans un appartement inconnu. On riait, on cherchait des verres partout. Par la fenêtre, au loin, le phare clignotait sur la côte.',
      target: /phare|lighthouse/iu,
    },
  },
  {
    id: 'return-red-umbrella',
    kind: 'return',
    lang: 'fr',
    note: 'A red umbrella carries the dreamer in A, rests against a desk in B.',
    a: {
      transcript: 'Je traversais une ville sous l’orage avec un parapluie rouge qui m’emportait dans les airs à chaque rafale.',
      target: /parapluie|umbrella/iu,
    },
    b: {
      transcript: 'Je passais un examen dans un gymnase immense et je n’avais rien révisé. Mon parapluie rouge était posé contre ma table, encore mouillé.',
      target: /parapluie|umbrella/iu,
    },
  },
  {
    id: 'return-carousel',
    kind: 'return',
    lang: 'en',
    note: 'A carousel at the centre of A, passed on the way in B.',
    a: {
      transcript: 'I rode an old carousel alone in an empty fairground. The painted animals had human faces and the music played backwards.',
      target: /carousel|merry|man[eè]ge/iu,
    },
    b: {
      transcript: 'I was late for my sister’s wedding and ran across a park. I passed the old carousel without stopping, then lost my shoes on the wet lawn.',
      target: /carousel|merry|man[eè]ge/iu,
    },
  },
  {
    id: 'return-grandmother-house',
    kind: 'return',
    lang: 'fr',
    note: 'The grandmother’s house at the centre of A, a short stop on a road trip in B.',
    a: {
      transcript: 'Je repeignais les volets de la maison de ma grand-mère, au bord d’un canal. Elle me regardait depuis la fenêtre en souriant.',
      target: /maison|house/iu,
    },
    b: {
      transcript: 'On partait en voiture avec mes cousins pour un long voyage. On s’arrêtait un instant devant la maison de ma grand-mère, puis la route continuait vers la mer.',
      target: /maison|house/iu,
    },
  },

  // ---- trap: similar words, different things.
  {
    id: 'trap-car-key-clef',
    kind: 'trap',
    lang: 'fr',
    note: 'A car key, then a treble clef ("clé de sol"), which is not the dictionary key.',
    a: {
      transcript: 'Je cherchais partout la clé de ma voiture dans un parking souterrain. Je la retrouvais enfin, mais elle ne rentrait dans aucune serrure.',
      target: /cl[eé]|key/iu,
    },
    b: {
      transcript: 'J’étais devant une partition immense. Une clé de sol dorée flottait au début de la portée et chantait toute seule.',
      target: /cl[eé]|clef|treble/iu,
    },
  },
  {
    id: 'trap-castle-tower-eiffel',
    kind: 'trap',
    lang: 'fr',
    note: 'A castle tower, then a cardboard Eiffel tower: "tower" alone must not join them.',
    a: {
      transcript: 'Je montais l’escalier en spirale d’une tour de château en ruine. En haut, des corbeaux tournaient autour des créneaux.',
      target: /\btour\b|tower|donjon|ch[aâ]teau|castle/iu,
    },
    b: {
      transcript: 'Dans ma chambre d’enfant, il y avait une tour Eiffel en carton que j’avais construite moi-même. Elle penchait de plus en plus et je n’osais pas la toucher.',
      target: /\btour\b|tower|eiffel/iu,
    },
  },
  {
    id: 'trap-headlight-lighthouse',
    kind: 'trap',
    lang: 'fr',
    note: 'A car headlight ("phare"), then a lighthouse ("phare").',
    a: {
      transcript: 'Je conduisais de nuit sur une route de montagne. Un des phares de ma voiture s’est éteint et je ne voyais plus que la moitié du virage.',
      target: /phare|headlight|\bfeux?\b/iu,
    },
    b: {
      transcript: 'Je nageais vers une côte rocheuse et un phare immense se dressait sur la falaise, tout blanc sous la lune.',
      target: /phare|lighthouse/iu,
    },
  },
  {
    id: 'trap-mouse-computer',
    kind: 'trap',
    lang: 'fr',
    note: 'A mouse (animal), then a computer mouse, which is not the dictionary mouse.',
    a: {
      transcript: 'Une petite souris grise traversait la cuisine et se glissait sous le frigo. Je la suivais à quatre pattes.',
      target: /souris|mouse/iu,
    },
    b: {
      transcript: 'Au bureau, la souris de mon ordinateur ne répondait plus. Le curseur se déplaçait tout seul et écrivait des mots que je ne comprenais pas.',
      target: /souris|mouse|ordinateur|computer|curseur|cursor/iu,
    },
  },
  {
    id: 'trap-crane-bird-machine',
    kind: 'trap',
    lang: 'fr',
    note: 'A crane (bird), then a construction crane: "crane" alone must not join them.',
    a: {
      transcript: 'Une grue cendrée se posait au bord d’un étang gelé et dansait en déployant ses ailes.',
      target: /grue|crane|oiseau|bird/iu,
    },
    b: {
      transcript: 'Une énorme grue de chantier soulevait ma maison au-dessus de la ville, et je regardais par la fenêtre les toits rapetisser.',
      target: /grue|crane/iu,
    },
  },
  {
    id: 'trap-bat-baseball',
    kind: 'trap',
    lang: 'en',
    note: 'A bat (animal), then a baseball bat, which is not the dictionary bat.',
    a: {
      transcript: 'A bat flew into my bedroom and hung upside down from the lamp. It watched me with tiny shining eyes.',
      target: /\bbat\b|chauve/iu,
    },
    b: {
      transcript: 'I was at a baseball game and someone handed me a wooden bat. Every time I swung it, the ball turned into a balloon.',
      target: /\bbat\b|batte/iu,
    },
  },

  // ---- dictionary: forms that must resolve to a dictionary id.
  {
    id: 'dictionary-kitten-cat',
    kind: 'dictionary',
    lang: 'fr',
    expectedSymbolId: 'cat',
    note: 'A kitten, then an old tomcat ("matou").',
    a: {
      transcript: 'Un chaton roux dormait sur le paillasson de mon appartement. Quand j’ouvrais, il entrait et s’installait sur mon oreiller.',
      target: /chaton|\bchat\b|kitten|\bcat\b/iu,
    },
    b: {
      transcript: 'Mon vieux matou miaulait derrière la fenêtre de la salle de bain, trempé par la pluie.',
      target: /matou|\bchat\b|\bcat\b/iu,
    },
  },
  {
    id: 'dictionary-front-door',
    kind: 'dictionary',
    lang: 'fr',
    expectedSymbolId: 'door',
    note: 'A front door, then a landing door.',
    a: {
      transcript: 'La porte d’entrée de chez moi était grande ouverte au milieu de la nuit et un courant d’air froid traversait le couloir.',
      target: /porte|door/iu,
    },
    b: {
      transcript: 'Quelqu’un frappait à la porte du palier, trois coups lents, mais personne n’était derrière quand j’ouvrais.',
      target: /porte|door/iu,
    },
  },
  {
    id: 'dictionary-puppy-dog',
    kind: 'dictionary',
    lang: 'fr',
    expectedSymbolId: 'dog',
    note: 'A puppy, then the neighbour’s "toutou".',
    a: {
      transcript: 'Un chiot noir me suivait dans les rues de la ville et s’asseyait chaque fois que je m’arrêtais.',
      target: /chiot|chien|puppy|dog/iu,
    },
    b: {
      transcript: 'Le toutou de la voisine aboyait sans arrêt dans l’escalier, comme pour me prévenir de quelque chose.',
      target: /toutou|chien|dog/iu,
    },
  },
  {
    id: 'dictionary-lift-elevator',
    kind: 'dictionary',
    lang: 'en',
    expectedSymbolId: 'elevator',
    note: 'A lift, then an elevator.',
    a: {
      transcript: 'The lift in my office building went sideways instead of up, sliding past rooms I had never seen.',
      target: /\blift\b|elevator|ascenseur/iu,
    },
    b: {
      transcript: 'I was trapped in an elevator between two floors with a stranger who kept humming.',
      target: /elevator|\blift\b|ascenseur/iu,
    },
  },
];

/** Refuses a malformed corpus before anything is sent. */
export const validateCases = (cases: readonly SymbolLinkCase[]): readonly SymbolLinkCase[] => {
  const ids = new Set<string>();
  for (const testCase of cases) {
    const where = `Symbol-link case ${testCase.id}`;
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(testCase.id) || ids.has(testCase.id)) throw new Error(`${where}: invalid or duplicate id.`);
    ids.add(testCase.id);
    if (!SYMBOL_LINK_KINDS.includes(testCase.kind)) throw new Error(`${where}: unknown kind.`);
    if (testCase.lang !== 'fr' && testCase.lang !== 'en') throw new Error(`${where}: unknown language.`);
    for (const side of [testCase.a, testCase.b]) {
      if (!side.transcript.trim() || side.transcript.length > 600) throw new Error(`${where}: transcript must be short and non-empty.`);
      // A global or sticky pattern keeps state between tests and would match unreliably.
      if (!(side.target instanceof RegExp) || side.target.global || side.target.sticky) throw new Error(`${where}: invalid target pattern.`);
    }
    const expectsId = testCase.kind === 'dictionary';
    if (expectsId !== (testCase.expectedSymbolId !== undefined)) throw new Error(`${where}: expectedSymbolId belongs to dictionary cases only.`);
    if (expectsId && !DREAM_SYMBOL_IDS.includes(testCase.expectedSymbolId!)) throw new Error(`${where}: expectedSymbolId is not a dictionary id.`);
  }
  for (const kind of SYMBOL_LINK_KINDS) {
    if (!cases.some((testCase) => testCase.kind === kind)) throw new Error(`The symbol-link corpus has no ${kind} case.`);
  }
  return cases;
};
