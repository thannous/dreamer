/**
 * Predefined realistic dreams for mock mode
 */

import type { DreamAnalysis } from '@/lib/types';

/**
 * Collection of predefined dreams with realistic content
 * These can be injected into mock storage when the "existing user" profile is selected
 */
export const PREDEFINED_DREAMS: Array<Omit<DreamAnalysis, 'id'>> = [
  {
    title: 'The Infinite Library',
    transcript: 'I found myself in an enormous library with endless shelves reaching up into darkness. Books were floating around me, their pages turning on their own. I picked up a golden book that seemed to glow, and when I opened it, I could see memories from my childhood playing out on the pages like a movie.',
    interpretation: 'The infinite library represents your vast inner knowledge and memories. The floating books suggest ideas and thoughts that are currently active in your subconscious. The golden book containing childhood memories indicates a need to reconnect with your past to understand your present. This dream suggests you\'re in a phase of self-discovery and reflection.',
    shareableQuote: 'Within us lies an infinite library of memories, waiting to be rediscovered.',
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/library-dream/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/library-dream/400/300',
    chatHistory: [],
    isFavorite: true,
    imageGenerationFailed: false,
  },
  {
    title: 'Ocean of Stars',
    transcript: 'I was swimming in an ocean, but instead of water, it was filled with stars and galaxies. I could breathe perfectly, and colorful fish made of light swam alongside me. The deeper I dove, the more beautiful it became. I felt completely at peace.',
    interpretation: 'Swimming in a cosmic ocean symbolizes diving deep into your unconscious mind and spiritual self. The stars and galaxies represent infinite possibilities and cosmic consciousness. The light-fish are positive energies guiding you. This dream reflects a period of spiritual growth and inner peace. You\'re exploring dimensions of yourself beyond the physical.',
    shareableQuote: 'We are all made of stardust, swimming in the cosmic ocean of existence.',
    theme: 'surreal',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/ocean-stars/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ocean-stars/400/300',
    chatHistory: [
      {
        role: 'user',
        text: 'Why did I feel so peaceful in this dream?',
      },
      {
        role: 'model',
        text: 'The sense of peace you felt indicates that you\'re in harmony with your deeper self. Water often represents emotions, and being able to breathe in it suggests you\'re comfortable navigating your emotional landscape. The cosmic elements show you\'re connecting with something greater than yourself, which brings natural tranquility.',
      },
    ],
    isFavorite: true,
    imageGenerationFailed: false,
  },
  {
    title: 'The Shadowy Pursuer',
    transcript: 'I was running through dark corridors in an old building. Something was chasing me, but I couldn\'t see what it was. Every time I looked back, there was just a dark shadow. My heart was pounding. I kept running until I found a door with light coming from underneath it.',
    interpretation: 'Being chased in a dream often represents avoiding something in your waking life. The shadow pursuer could symbolize unresolved fears, responsibilities, or aspects of yourself you\'re not ready to face. The dark corridors represent confusion or feeling lost. The door with light is hopeful - it suggests there\'s a solution or escape route available to you. This dream is encouraging you to confront what you\'re running from.',
    shareableQuote: 'Sometimes what chases us in dreams is merely a shadow of our own making.',
    theme: 'noir',
    dreamType: 'Nightmare',
    imageUrl: 'https://picsum.photos/seed/shadow-chase/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/shadow-chase/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
  },
  {
    title: 'Garden in the Clouds',
    transcript: 'I was walking through a beautiful garden floating among the clouds. There were flowers I\'d never seen before, in colors that don\'t exist in real life. A gentle breeze carried the scent of jasmine. I sat on a bench and watched birds made of rainbow light fly by. Time seemed to stand still.',
    interpretation: 'A cloud garden represents elevated consciousness and spiritual ascension. The impossible colors and fantastical birds symbolize experiences beyond ordinary reality - you\'re opening up to new perspectives. The timeless quality suggests you\'re entering a phase where you\'re less concerned with worldly pressures. This is a deeply positive dream about transcendence and finding peace above life\'s chaos.',
    shareableQuote: 'In dreams, we visit gardens that bloom beyond the boundaries of reality.',
    theme: 'calm',
    dreamType: 'Lucid Dream',
    imageUrl: 'https://picsum.photos/seed/cloud-garden/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/cloud-garden/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
  },
  {
    title: 'The Forgotten Classroom',
    transcript: 'I was back in school, sitting in a classroom I didn\'t recognize. The teacher was speaking, but I couldn\'t understand the language. I realized I had an important exam I hadn\'t studied for. I looked down at the test paper, and the questions were written in symbols I couldn\'t read.',
    interpretation: 'School dreams often relate to learning lessons in your current life. The unfamiliar classroom and incomprehensible language suggest you\'re facing a situation where you feel unprepared or out of your depth. The unreadable exam represents challenges that seem insurmountable right now. This dream is highlighting feelings of inadequacy or impostor syndrome. It\'s reminding you that learning is a process, and it\'s okay not to have all the answers.',
    shareableQuote: 'Life\'s greatest lessons often come from tests we didn\'t know we were taking.',
    theme: 'surreal',
    dreamType: 'Recurring Dream',
    imageUrl: 'https://picsum.photos/seed/classroom/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/classroom/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
  },
  {
    title: 'Meeting My Future Self',
    transcript: 'I was walking down a street when I saw someone who looked exactly like me, but older. They smiled at me knowingly and said, "Everything\'s going to be okay." We sat together on a park bench and they told me stories about adventures I haven\'t had yet. When I woke up, I felt incredibly hopeful.',
    interpretation: 'Meeting your future self is a powerful symbol of self-guidance and wisdom. This dream suggests your subconscious is trying to reassure you about your path forward. The older you represents your potential and the wisdom you\'ll gain. The message that "everything\'s going to be okay" is your inner voice providing comfort during uncertain times. The untold adventures hint at exciting possibilities ahead.',
    shareableQuote: 'The future self we meet in dreams is the person we are becoming.',
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/future-self/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/future-self/400/300',
    chatHistory: [
      {
        role: 'user',
        text: 'Was this really a message from my future self?',
      },
      {
        role: 'model',
        text: 'While it\'s more likely a manifestation of your own wisdom and intuition, the message is still valid and meaningful. Your subconscious has access to your deepest knowledge about yourself, your patterns, and your trajectory. In that sense, it truly is your "future self" speaking - the part of you that knows you\'ll grow and overcome current challenges.',
      },
    ],
    isFavorite: true,
    imageGenerationFailed: false,
  },
  {
    title: 'The Singing Forest',
    transcript: 'I walked into a forest where all the trees were singing in harmony. Each tree had a different voice - some deep like cellos, others high like flutes. As I walked deeper, I discovered I could sing too, and my voice blended perfectly with theirs. Animals gathered around to listen. The whole forest felt alive and aware.',
    interpretation: 'A singing forest represents harmony with nature and your environment. The different voices symbolize diversity and how different elements can work together beautifully. Your ability to join the song suggests you\'re finding your place and voice in your community or life situation. The attentive animals indicate that others are noticing and appreciating your contribution. This dream celebrates connection and belonging.',
    shareableQuote: 'When we find our true voice, we harmonize with the world around us.',
    theme: 'calm',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/singing-forest/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/singing-forest/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
  },
  {
    title: 'The Broken Mirror',
    transcript: 'I was looking at myself in a mirror when it suddenly cracked. Each piece of the broken mirror showed a different version of me - one was smiling, one was crying, one looked angry, one looked peaceful. I tried to put the pieces back together, but they kept rearranging themselves into different patterns.',
    interpretation: 'A broken mirror represents fragmented self-identity or seeing different aspects of yourself. Each reflection shows a different emotion or persona you carry. The inability to reassemble it suggests you\'re struggling to integrate these different parts into a cohesive whole. This isn\'t necessarily negative - it\'s recognizing your complexity. The dream encourages accepting that you\'re multifaceted, and that\'s okay. You don\'t have to be just one thing.',
    shareableQuote: 'We are not one person, but many reflections dancing together.',
    theme: 'noir',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/broken-mirror/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/broken-mirror/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
  },
];

const PRELOADED_ANALYSIS_USAGE = 2;
const PRELOADED_EXPLORATION_USAGE = 1;

/**
 * Generate timestamps for predefined dreams
 * Spreads them over the last 30 days
 */
export function getPredefinedDreamsWithTimestamps(): DreamAnalysis[] {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const usedTimestamps = new Set<number>();
  let seededAnalyses = 0;
  let seededExplorations = 0;

  return PREDEFINED_DREAMS.map((dream, index) => {
    // Space dreams out over the last ~30 days while keeping each timestamp unique
    const daysAgo = index * 2 + Math.random(); // disjoint ranges avoid collisions
    let timestamp = Math.round(now - daysAgo * dayInMs);

    // Ensure uniqueness in case Math.random() produces the same fractional part
    while (usedTimestamps.has(timestamp)) {
      timestamp -= 1000; // move back one second to preserve ordering
    }
    usedTimestamps.add(timestamp);

    const baseDream: DreamAnalysis = {
      ...dream,
      id: timestamp, // Use number timestamp as ID
      isAnalyzed: dream.isAnalyzed ?? true,
      analysisStatus: dream.analysisStatus ?? 'done',
    };

    if (baseDream.isAnalyzed && baseDream.analyzedAt == null && seededAnalyses < PRELOADED_ANALYSIS_USAGE) {
      baseDream.analyzedAt = timestamp;
      seededAnalyses += 1;
    }

    const hasChatHistory = Array.isArray(baseDream.chatHistory) && baseDream.chatHistory.length > 0;
    if (hasChatHistory && baseDream.explorationStartedAt == null && seededExplorations < PRELOADED_EXPLORATION_USAGE) {
      baseDream.explorationStartedAt = timestamp + 15 * 60 * 1000; // 15 minutes after recording
      seededExplorations += 1;
    }

    return baseDream;
  });
}
