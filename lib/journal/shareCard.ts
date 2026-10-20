import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import type { DreamAnalysis } from '@/lib/types';

/** The words a share card carries under its name: none, the dream as told, or the line it inspired. */
export type ShareCardText = 'none' | 'story' | 'quote';

/** What a dream's share card shows. « Créé par Noctalia Dream » is always on it. */
export type ShareCardOptions = {
  painting: boolean;
  title: boolean;
  date: boolean;
  text: ShareCardText;
};

type ShareCardDream = Pick<DreamAnalysis, 'title' | 'transcript' | 'shareableQuote' | 'promptVersion'>;

/** The longest opening of the story a card carries, in characters. */
export const SHARE_CARD_STORY_MAX = 320;

/** The texts this dream can put on its card, in the order they are offered. */
export function getShareCardTexts(dream: ShareCardDream): ShareCardText[] {
  const texts: ShareCardText[] = ['none'];
  if (dream.transcript?.trim()) texts.push('story');
  // Every analysed dream offers the line its reading shows, as its page does.
  if (dream.shareableQuote?.trim()) texts.push('quote');
  return texts;
}

/**
 * A card as it is first offered: the painting when there is one, the name, the date, and
 * the line Noctalia wrote from the dream. Older readings kept an excerpt of the dreamer's
 * own words in that place: like the story, the dreamer's own words, it is only ever chosen.
 */
export function getDefaultShareCardOptions(dream: ShareCardDream): ShareCardOptions {
  return {
    painting: true,
    title: Boolean(dream.title?.trim()),
    date: true,
    text: dream.shareableQuote?.trim() && isPoeticDreamQuote(dream) ? 'quote' : 'none',
  };
}

/** The story as a card carries it: its opening, ended on a whole word. */
export function getShareCardStory(transcript: string, max = SHARE_CARD_STORY_MAX): string {
  const story = transcript.trim().replace(/\s+/g, ' ');
  if (story.length <= max) return story;
  const opening = story.slice(0, max);
  const lastSpace = opening.lastIndexOf(' ');
  const words = lastSpace > max * 0.6 ? opening.slice(0, lastSpace) : opening;
  return `${words.replace(/[\s,;:.!?…-]+$/u, '')}…`;
}
