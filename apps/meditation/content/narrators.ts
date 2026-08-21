import type { Narrator, NarratorId } from '@/lib/types';

/**
 * Three voices. `wordless` is not a person: it is the option for someone who
 * wants the practice without being spoken to, and it matters more than it looks
 * — plenty of people bounce off meditation apps because of the voice alone.
 */
export const NARRATORS: Narrator[] = [
  { id: 'camille', name: 'Camille' },
  { id: 'adrien', name: 'Adrien' },
  { id: 'wordless', name: '—' },
];

export const NARRATOR_BY_ID: Record<NarratorId, Narrator> = NARRATORS.reduce(
  (acc, narrator) => ({ ...acc, [narrator.id]: narrator }),
  {} as Record<NarratorId, Narrator>
);
