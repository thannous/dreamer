/**
 * Generators for random mock data
 */

import type { DreamAnalysis, ChatMessage } from '@/lib/types';
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

const THEMES: Array<'surreal' | 'mystical' | 'calm' | 'noir'> = [
  'surreal',
  'mystical',
  'calm',
  'noir',
];

const DREAM_TYPES = [
  'Lucid Dream',
  'Recurring Dream',
  'Nightmare',
  'Prophetic Dream',
  'Symbolic Dream',
  'Epic Dream',
  'Progressive Dream',
  'Mutual Dream',
];

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

  return {
    title: DREAM_TITLES[index],
    transcript: TRANSCRIPTS[index],
    interpretation: INTERPRETATIONS[index],
    shareableQuote: SHAREABLE_QUOTES[Math.floor(Math.random() * SHAREABLE_QUOTES.length)],
    theme,
    dreamType: DREAM_TYPES[Math.floor(Math.random() * DREAM_TYPES.length)],
    imageUrl: getRandomImageForTheme(theme),
    thumbnailUrl: getThumbnailUrl(getRandomImageForTheme(theme)),
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

/**
 * Generate random analysis result (for API mock)
 */
export function generateAnalysisResult(transcript: string) {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

  return {
    title: DREAM_TITLES[Math.floor(Math.random() * DREAM_TITLES.length)],
    interpretation: INTERPRETATIONS[Math.floor(Math.random() * INTERPRETATIONS.length)],
    shareableQuote: SHAREABLE_QUOTES[Math.floor(Math.random() * SHAREABLE_QUOTES.length)],
    theme,
    dreamType: DREAM_TYPES[Math.floor(Math.random() * DREAM_TYPES.length)],
    imagePrompt: `A ${theme} dream scene: ${transcript.slice(0, 50)}`,
  };
}
