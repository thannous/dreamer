/**
 * Generators for random mock data
 */

import type { AppLanguage, DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { getRandomImageForTheme, getThumbnailUrl } from './assets';

const DREAM_TITLES = [
  'Flying Over the Ocean',
  'Lost in a Maze',
  'Meeting an Old Friend',
  'Running Through a Forest',
  'Climbing a Mountain',
  'Swimming with Dolphins',
  'Dancing in the Rain',
  'Exploring an Ancient Temple',
  'Riding a Dragon',
  'Walking on Clouds',
];

const INTERPRETATIONS = [
  'This dream reflects a desire for freedom and escape from daily constraints.',
  'The maze symbolizes feeling lost or confused in your waking life.',
  'Meeting someone from your past suggests unresolved emotions or nostalgia.',
  'Running represents a pursuit of goals or fleeing from responsibilities.',
  'Climbing indicates ambition and the desire to overcome challenges.',
  'Water creatures often symbolize emotional depth and exploration.',
  'Dancing suggests joy, self-expression, and liberation.',
  'Ancient structures represent wisdom, history, or exploring your subconscious.',
  'Mythical creatures embody power, transformation, and imagination.',
  'Being above the ground symbolizes gaining perspective or spiritual elevation.',
];

const SHAREABLE_QUOTES = [
  'Dreams are the whispers of our soul.',
  'In dreams, we find our truest selves.',
  'The subconscious speaks in symbols.',
  'Every dream is a journey within.',
  'Listen to what your dreams tell you.',
  'Dreams unlock hidden truths.',
  'The mind paints with infinite colors.',
  'In sleep, we explore other worlds.',
  'Dreams are letters from ourselves.',
  'The night reveals what day conceals.',
];

const THEMES: DreamTheme[] = [
  'surreal',
  'mystical',
  'calm',
  'noir',
];

const DREAM_TYPES: DreamType[] = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'];

const TRANSCRIPTS = [
  'I was flying high above the ocean, feeling completely free. The water was crystal clear below me.',
  'I found myself in an endless maze with walls that kept shifting. I felt anxious but determined to find the exit.',
  'An old friend I haven\'t seen in years appeared. We talked for what felt like hours, laughing together.',
  'I was running through a dense forest, jumping over roots and ducking under branches. My heart was racing.',
  'I was climbing a massive mountain. Each step was difficult, but the view kept getting more beautiful.',
  'I was swimming in the ocean when dolphins appeared around me. They seemed to be guiding me somewhere.',
  'Rain was falling, but instead of running for cover, I found myself dancing joyfully in the downpour.',
  'I discovered an ancient temple hidden in the jungle. Inside were mysterious symbols on the walls.',
  'A magnificent dragon appeared and let me ride on its back. We soared through the clouds together.',
  'I was walking on clouds, looking down at the world below. Everything seemed peaceful and distant.',
];

/**
 * Generate a random dream analysis
 */
export function generateRandomDream(): Omit<DreamAnalysis, 'id'> {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const index = Math.floor(Math.random() * DREAM_TITLES.length);
  const imageUrl = getRandomImageForTheme(theme);

  return {
    title: DREAM_TITLES[index],
    transcript: TRANSCRIPTS[index],
    interpretation: INTERPRETATIONS[index],
    shareableQuote: SHAREABLE_QUOTES[Math.floor(Math.random() * SHAREABLE_QUOTES.length)],
    theme,
    dreamType: DREAM_TYPES[Math.floor(Math.random() * DREAM_TYPES.length)],
    imageUrl,
    thumbnailUrl: getThumbnailUrl(imageUrl),
    imageSource: 'ai',
    chatHistory: [],
    isFavorite: Math.random() > 0.7,
    imageGenerationFailed: false,
  };
}

/**
 * Generate a chat response based on user message
 */
export function generateChatResponse(userMessage: string, dreamContext: string): string {
  const responses = [
    `That's an interesting question about "${dreamContext.slice(0, 30)}...". The symbols in your dream often represent deeper meanings.`,
    `Based on your dream, ${userMessage.toLowerCase()} could relate to your subconscious processing recent experiences.`,
    `Dreams like yours often symbolize personal growth. Let me elaborate on that aspect.`,
    `The elements you mentioned in your dream are quite significant. They may represent transformation in your life.`,
    `I sense that this dream is trying to tell you something important about your current life situation.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

function pickFromTranscript<T>(transcript: string, items: readonly T[]): T {
  let hash = 0;
  for (let index = 0; index < transcript.length; index += 1) {
    hash = (hash * 31 + transcript.charCodeAt(index)) >>> 0;
  }
  return items[hash % items.length];
}

export function titleFromTranscript(transcript: string): string {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  if (!cleaned) return DREAM_TITLES[0];

  const sentence = cleaned.split(/[.!?…]/)[0]?.trim() || cleaned;
  const words = sentence.split(' ').filter(Boolean).slice(0, 8);
  const raw = words.join(' ');
  const clipped = raw.length > 52 ? `${raw.slice(0, 49).trimEnd()}…` : raw;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

/**
 * Generate analysis result (for API mock).
 * Titles follow the transcript so successive mock dreams stay distinguishable.
 * The fixture follows the app language; it does not attempt to interpret the dream.
 */
type AnalysisCopy = {
  fallbackTitle: string;
  interpretations: readonly string[];
  quotes: readonly string[];
  symbols: readonly { name: string; meaning: string }[];
  emotions: readonly { name: string; insight: string }[];
  questions: readonly string[];
};

const ANALYSIS_COPY: Record<AppLanguage, AnalysisCopy> = {
  en: {
    fallbackTitle: DREAM_TITLES[0],
    interpretations: INTERPRETATIONS,
    quotes: SHAREABLE_QUOTES,
    symbols: [
      { name: 'Water', meaning: 'Emotional currents moving beneath the surface of this dream.' },
      { name: 'Light', meaning: 'A guiding awareness drawing your attention toward change.' },
      { name: 'Doorway', meaning: 'A threshold between what is familiar and what is still forming.' },
    ],
    emotions: [
      { name: 'Wonder', insight: 'An openness to what this dream is showing you.' },
      { name: 'Longing', insight: 'A quiet pull toward something not yet named.' },
    ],
    questions: [
      'What part of this dream felt most alive to you?',
      'Where in your waking life do you feel a similar pull?',
    ],
  },
  fr: {
    fallbackTitle: 'Un rêve à explorer',
    interpretations: [
      'Ce rêve peut évoquer un besoin de liberté et d’espace.',
      'Le chemin du rêve peut rappeler une question que tu explores en ce moment.',
      'Une rencontre dans le rêve peut faire écho à un souvenir ou à une émotion.',
    ],
    quotes: [
      'Un rêve ouvre parfois une nouvelle perspective.',
      'Chaque détail peut inviter à la réflexion.',
      'La nuit laisse une trace à explorer.',
    ],
    symbols: [
      { name: 'Eau', meaning: 'L’eau peut évoquer le mouvement des émotions.' },
      { name: 'Lumière', meaning: 'La lumière peut représenter un repère dans le rêve.' },
      { name: 'Porte', meaning: 'Une porte peut suggérer un passage ou une possibilité.' },
    ],
    emotions: [
      { name: 'Étonnement', insight: 'Une ouverture à ce que le rêve te montre.' },
      { name: 'Nostalgie', insight: 'Un lien possible avec un souvenir encore présent.' },
    ],
    questions: [
      'Quel moment de ce rêve t’a le plus marqué ?',
      'Retrouves-tu une sensation de ce rêve dans ta journée ?',
    ],
  },
  es: {
    fallbackTitle: 'Un sueño por explorar',
    interpretations: [
      'Este sueño puede evocar un deseo de libertad y espacio.',
      'El recorrido del sueño puede recordar una pregunta que exploras ahora.',
      'Un encuentro en el sueño puede conectar con un recuerdo o una emoción.',
    ],
    quotes: [
      'Un sueño puede abrir una nueva perspectiva.',
      'Cada detalle invita a reflexionar.',
      'La noche deja una huella por explorar.',
    ],
    symbols: [
      { name: 'Agua', meaning: 'El agua puede evocar el movimiento de las emociones.' },
      { name: 'Luz', meaning: 'La luz puede representar una guía dentro del sueño.' },
      { name: 'Puerta', meaning: 'Una puerta puede sugerir un paso o una posibilidad.' },
    ],
    emotions: [
      { name: 'Asombro', insight: 'Una apertura a lo que muestra el sueño.' },
      { name: 'Nostalgia', insight: 'Un posible vínculo con un recuerdo presente.' },
    ],
    questions: [
      '¿Qué momento del sueño te llamó más la atención?',
      '¿Reconoces hoy alguna sensación de ese sueño?',
    ],
  },
  de: {
    fallbackTitle: 'Ein Traum zum Erkunden',
    interpretations: [
      'Dieser Traum könnte einen Wunsch nach Freiheit und Raum andeuten.',
      'Der Weg im Traum könnte an eine Frage erinnern, die dich gerade beschäftigt.',
      'Eine Begegnung im Traum könnte mit einer Erinnerung oder einem Gefühl verbunden sein.',
    ],
    quotes: [
      'Ein Traum kann eine neue Perspektive eröffnen.',
      'Jedes Detail lädt zum Nachdenken ein.',
      'Die Nacht hinterlässt eine Spur zum Erkunden.',
    ],
    symbols: [
      { name: 'Wasser', meaning: 'Wasser kann die Bewegung von Gefühlen andeuten.' },
      { name: 'Licht', meaning: 'Licht kann im Traum ein Orientierungspunkt sein.' },
      { name: 'Tür', meaning: 'Eine Tür kann einen Übergang oder eine Möglichkeit andeuten.' },
    ],
    emotions: [
      { name: 'Staunen', insight: 'Offenheit für das, was der Traum zeigt.' },
      { name: 'Sehnsucht', insight: 'Eine mögliche Verbindung zu einer Erinnerung.' },
    ],
    questions: [
      'Welcher Moment dieses Traums ist dir besonders in Erinnerung geblieben?',
      'Erkennst du heute ein Gefühl aus diesem Traum wieder?',
    ],
  },
  it: {
    fallbackTitle: 'Un sogno da esplorare',
    interpretations: [
      'Questo sogno può evocare un desiderio di libertà e spazio.',
      'Il percorso del sogno può richiamare una domanda che stai esplorando.',
      'Un incontro nel sogno può collegarsi a un ricordo o a un’emozione.',
    ],
    quotes: [
      'Un sogno può aprire una nuova prospettiva.',
      'Ogni dettaglio invita alla riflessione.',
      'La notte lascia una traccia da esplorare.',
    ],
    symbols: [
      { name: 'Acqua', meaning: 'L’acqua può evocare il movimento delle emozioni.' },
      { name: 'Luce', meaning: 'La luce può rappresentare un punto di riferimento nel sogno.' },
      { name: 'Porta', meaning: 'Una porta può suggerire un passaggio o una possibilità.' },
    ],
    emotions: [
      { name: 'Meraviglia', insight: 'Apertura verso ciò che il sogno mostra.' },
      { name: 'Nostalgia', insight: 'Un possibile legame con un ricordo ancora presente.' },
    ],
    questions: [
      'Quale momento del sogno ti è rimasto più impresso?',
      'Riconosci oggi una sensazione provata nel sogno?',
    ],
  },
  pt: {
    fallbackTitle: 'Um sonho para explorar',
    interpretations: [
      'Este sonho pode evocar um desejo de liberdade e espaço.',
      'O caminho do sonho pode lembrar uma questão que estás a explorar.',
      'Um encontro no sonho pode estar ligado a uma memória ou emoção.',
    ],
    quotes: [
      'Um sonho pode abrir uma nova perspetiva.',
      'Cada detalhe convida à reflexão.',
      'A noite deixa um rasto para explorar.',
    ],
    symbols: [
      { name: 'Água', meaning: 'A água pode evocar o movimento das emoções.' },
      { name: 'Luz', meaning: 'A luz pode representar um ponto de referência no sonho.' },
      { name: 'Porta', meaning: 'Uma porta pode sugerir uma passagem ou possibilidade.' },
    ],
    emotions: [
      { name: 'Admiração', insight: 'Abertura ao que o sonho mostra.' },
      { name: 'Saudade', insight: 'Uma possível ligação a uma memória presente.' },
    ],
    questions: [
      'Que momento do sonho te marcou mais?',
      'Reconheces hoje alguma sensação desse sonho?',
    ],
  },
};

export function generateAnalysisResult(transcript: string, lang = 'en') {
  const language = lang.slice(0, 2).toLowerCase() as AppLanguage;
  const copy = ANALYSIS_COPY[language] ?? ANALYSIS_COPY.en;
  const theme = pickFromTranscript(transcript, THEMES);
  const dreamType = pickFromTranscript(transcript, DREAM_TYPES);

  return {
    title: transcript.trim() ? titleFromTranscript(transcript) : copy.fallbackTitle,
    interpretation: pickFromTranscript(transcript, copy.interpretations),
    shareableQuote: pickFromTranscript(transcript, copy.quotes),
    theme,
    dreamType,
    imagePrompt: `A ${theme} dream scene: ${transcript.slice(0, 50)}`,
    symbols: copy.symbols.map(symbol => ({ ...symbol })),
    emotions: copy.emotions.map(emotion => ({ ...emotion })),
    reflectionQuestions: [...copy.questions],
  };
}
