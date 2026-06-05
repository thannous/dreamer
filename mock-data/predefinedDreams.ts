/**
 * Predefined realistic dreams for mock mode.
 *
 * The eight entries intentionally cover the main product states:
 * done, explored, failed, image failed, pending, sync pending, sync conflict, none.
 */

import type { DreamAnalysis } from '@/lib/types';

const mockUuid = (index: number, variant = 0): string =>
  `00000000-0000-4000-8000-${String(index * 100 + variant).padStart(12, '0')}`;

/**
 * Collection of predefined dreams with realistic content.
 * These can be injected into mock storage when a populated profile is selected.
 */
export const PREDEFINED_DREAMS: Omit<DreamAnalysis, 'id'>[] = [
  {
    title: 'The Infinite Library',
    transcript: 'I found myself in an enormous library with endless shelves reaching up into darkness. Books were floating around me, their pages turning on their own. I picked up a golden book that seemed to glow, and when I opened it, I could see memories from my childhood playing out on the pages like a movie.',
    interpretation: 'The infinite library represents your vast inner knowledge and memories. The floating books suggest ideas and thoughts that are currently active in your subconscious. The golden book containing childhood memories indicates a need to reconnect with your past to understand your present. This dream suggests you are in a phase of self-discovery and reflection.',
    shareableQuote: 'Within us lies an infinite library of memories, waiting to be rediscovered.',
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/library-dream/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/library-dream/400/300',
    chatHistory: [],
    isFavorite: true,
    imageGenerationFailed: false,
    isAnalyzed: true,
    analysisStatus: 'done',
    imageSource: 'ai',
    hasPerson: false,
    hasAnimal: false,
  },
  {
    title: 'Ocean of Stars',
    transcript: 'I was swimming in an ocean, but instead of water, it was filled with stars and galaxies. I could breathe perfectly, and colorful fish made of light swam alongside me. The deeper I dove, the more beautiful it became. I felt completely at peace.',
    interpretation: 'Swimming in a cosmic ocean symbolizes diving deep into your unconscious mind and spiritual self. The stars and galaxies represent infinite possibilities and cosmic consciousness. The light-fish are positive energies guiding you. This dream reflects a period of spiritual growth and inner peace. You are exploring dimensions of yourself beyond the physical.',
    shareableQuote: 'We are all made of stardust, swimming in the cosmic ocean of existence.',
    theme: 'surreal',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/ocean-stars/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ocean-stars/400/300',
    chatHistory: [
      {
        id: 'ocean-user-1',
        role: 'user',
        text: 'Why did I feel so peaceful in this dream?',
        meta: { category: 'emotions' },
      },
      {
        id: 'ocean-model-1',
        role: 'model',
        text: 'The sense of peace suggests you are moving comfortably through your emotional landscape. The cosmic water points to a wider inner perspective, while the light-fish feel like supportive cues from your intuition.',
        meta: { category: 'emotions' },
      },
    ],
    isFavorite: true,
    imageGenerationFailed: false,
    isAnalyzed: true,
    analysisStatus: 'done',
    imageSource: 'ai',
    hasPerson: false,
    hasAnimal: true,
  },
  {
    title: 'The Shadowy Pursuer',
    transcript: 'I was running through dark corridors in an old building. Something was chasing me, but I could not see what it was. Every time I looked back, there was just a dark shadow. My heart was pounding. I kept running until I found a door with light coming from underneath it.',
    interpretation: '',
    shareableQuote: '',
    theme: 'noir',
    dreamType: 'Nightmare',
    imageUrl: '',
    thumbnailUrl: undefined,
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
    isAnalyzed: false,
    analysisStatus: 'failed',
    analysisRequestId: mockUuid(3, 1),
    hasPerson: true,
    hasAnimal: false,
  },
  {
    title: 'Garden in the Clouds',
    transcript: 'I was walking through a beautiful garden floating among the clouds. There were flowers I had never seen before, in colors that do not exist in real life. A gentle breeze carried the scent of jasmine. I sat on a bench and watched birds made of rainbow light fly by. Time seemed to stand still.',
    interpretation: 'A cloud garden represents elevated consciousness and spiritual ascension. The impossible colors and fantastical birds symbolize experiences beyond ordinary reality. You are opening up to new perspectives. The timeless quality suggests you are entering a phase where you are less concerned with worldly pressures.',
    shareableQuote: 'In dreams, we visit gardens that bloom beyond the boundaries of reality.',
    theme: 'calm',
    dreamType: 'Lucid Dream',
    imageUrl: '',
    thumbnailUrl: undefined,
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: true,
    isAnalyzed: true,
    analysisStatus: 'done',
    imageSource: 'ai',
    imageJobErrorCode: 'IMAGE_GENERATION_FAILED',
    imageJobErrorMessage: 'Mock image generation failed after analysis completed.',
    hasPerson: true,
    hasAnimal: true,
  },
  {
    title: 'The Forgotten Classroom',
    transcript: 'I was back in school, sitting in a classroom I did not recognize. The teacher was speaking, but I could not understand the language. I realized I had an important exam I had not studied for. I looked down at the test paper, and the questions were written in symbols I could not read.',
    interpretation: '',
    shareableQuote: '',
    theme: undefined,
    dreamType: 'Recurring Dream',
    imageUrl: '',
    thumbnailUrl: undefined,
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
    isAnalyzed: false,
    analysisStatus: 'pending',
    analysisRequestId: mockUuid(5, 1),
    imageJobId: mockUuid(5, 2),
    imageJobStatus: 'running',
    imageJobRequestId: mockUuid(5, 3),
    hasPerson: true,
    hasAnimal: false,
  },
  {
    title: 'Meeting My Future Self',
    transcript: 'I was walking down a street when I saw someone who looked exactly like me, but older. They smiled at me knowingly and said, "Everything is going to be okay." We sat together on a park bench and they told me stories about adventures I have not had yet. When I woke up, I felt incredibly hopeful.',
    interpretation: 'Meeting your future self is a powerful symbol of self-guidance and wisdom. This dream suggests your subconscious is trying to reassure you about your path forward. The older version of you represents your potential and the wisdom you will gain. The message of reassurance is your inner voice offering comfort during uncertainty.',
    shareableQuote: 'The future self we meet in dreams is the person we are becoming.',
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/future-self/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/future-self/400/300',
    chatHistory: [],
    isFavorite: true,
    imageGenerationFailed: false,
    isAnalyzed: true,
    analysisStatus: 'done',
    imageSource: 'ai',
    syncState: 'pending',
    pendingSync: true,
    hasPerson: true,
    hasAnimal: false,
  },
  {
    title: 'The Singing Forest',
    transcript: 'I walked into a forest where all the trees were singing in harmony. Each tree had a different voice, some deep like cellos, others high like flutes. As I walked deeper, I discovered I could sing too, and my voice blended perfectly with theirs. Animals gathered around to listen. The whole forest felt alive and aware.',
    interpretation: 'A singing forest represents harmony with nature and your environment. The different voices symbolize diversity and how different elements can work together beautifully. Your ability to join the song suggests you are finding your place and voice in your community or life situation.',
    shareableQuote: 'When we find our true voice, we harmonize with the world around us.',
    theme: 'calm',
    dreamType: 'Symbolic Dream',
    imageUrl: 'https://picsum.photos/seed/singing-forest/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/singing-forest/400/300',
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
    isAnalyzed: true,
    analysisStatus: 'done',
    imageSource: 'ai',
    syncState: 'conflict',
    pendingSync: true,
    lastSyncError: 'Mock conflict: the remote dream changed before local edits synced.',
    hasPerson: false,
    hasAnimal: true,
  },
  {
    title: 'The Broken Mirror',
    transcript: 'I was looking at myself in a mirror when it suddenly cracked. Each piece of the broken mirror showed a different version of me. One was smiling, one was crying, one looked angry, one looked peaceful. I tried to put the pieces back together, but they kept rearranging themselves into different patterns.',
    interpretation: '',
    shareableQuote: '',
    theme: 'noir',
    dreamType: 'Symbolic Dream',
    imageUrl: '',
    thumbnailUrl: undefined,
    chatHistory: [],
    isFavorite: false,
    imageGenerationFailed: false,
    isAnalyzed: false,
    analysisStatus: 'none',
    hasPerson: true,
    hasAnimal: false,
  },
];

function withMockChatTimestamps(dream: DreamAnalysis, timestamp: number): DreamAnalysis {
  if (!dream.chatHistory.length) return dream;

  return {
    ...dream,
    chatHistory: dream.chatHistory.map((message, messageIndex) => ({
      ...message,
      createdAt: message.createdAt ?? timestamp + (messageIndex + 1) * 5 * 60 * 1000,
    })),
  };
}

function buildMockConflictRemoteDream(dream: DreamAnalysis, index: number): DreamAnalysis {
  return {
    ...dream,
    id: dream.id + 1,
    title: `${dream.title} (remote)`,
    interpretation: `${dream.interpretation} The remote copy keeps the calmer version of the reading.`,
    revisionId: mockUuid(index + 1, 99),
    syncState: 'clean',
    pendingSync: false,
    lastSyncError: undefined,
    conflictRemoteDream: undefined,
  };
}

/**
 * Generate timestamps for predefined dreams.
 * Spreads them over the last 30 days.
 */
export function getPredefinedDreamsWithTimestamps(): DreamAnalysis[] {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const usedTimestamps = new Set<number>();

  return PREDEFINED_DREAMS.map((dream, index) => {
    // Space dreams out over the last ~30 days while keeping each timestamp unique.
    const daysAgo = index * 2 + Math.random(); // disjoint ranges avoid collisions
    let timestamp = Math.round(now - daysAgo * dayInMs);

    // Ensure uniqueness in case Math.random() produces the same fractional part.
    while (usedTimestamps.has(timestamp)) {
      timestamp -= 1000; // move back one second to preserve ordering
    }
    usedTimestamps.add(timestamp);

    let baseDream: DreamAnalysis = {
      ...dream,
      id: timestamp,
      remoteId: dream.remoteId ?? 10_000 + index,
      clientRequestId: dream.clientRequestId ?? mockUuid(index + 1),
      revisionId: dream.revisionId ?? mockUuid(index + 1, 10),
      updatedAt: dream.updatedAt ?? timestamp + 10 * 60 * 1000,
      clientUpdatedAt: dream.clientUpdatedAt ?? timestamp + 9 * 60 * 1000,
      lastSyncedAt: dream.lastSyncedAt ?? (dream.syncState ? undefined : timestamp + 11 * 60 * 1000),
      imageSource: dream.imageSource ?? (dream.imageUrl ? 'ai' : undefined),
    };

    const status = baseDream.analysisStatus ?? 'none';
    if (status === 'done') {
      baseDream = {
        ...baseDream,
        isAnalyzed: true,
        analyzedAt: baseDream.analyzedAt ?? timestamp + 8 * 60 * 1000,
        analysisRequestId: baseDream.analysisRequestId ?? mockUuid(index + 1, 1),
      };
    } else {
      baseDream = {
        ...baseDream,
        isAnalyzed: false,
        analyzedAt: undefined,
      };
    }

    baseDream = withMockChatTimestamps(baseDream, timestamp);

    const hasModelHistory = baseDream.chatHistory.some((message) => message.role === 'model' && !message.meta?.isError);
    if (hasModelHistory && baseDream.explorationStartedAt == null) {
      baseDream.explorationStartedAt = timestamp + 15 * 60 * 1000;
    }

    if (baseDream.syncState === 'conflict') {
      baseDream.conflictRemoteDream = buildMockConflictRemoteDream(baseDream, index);
    }

    return baseDream;
  });
}
