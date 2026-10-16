import { createContext, useContext } from 'react';

/** The pages either side, for the controls at a page's foot: the turns a page can take. */
export type JournalPageTurns = {
  /** Which page shows them: a dream page, or tonight's. */
  page: 'dream' | 'tonight';
  previous: boolean;
  next: boolean;
  locked: boolean;
  turn: (forward: boolean) => void;
};
export const PageTurnsContext = createContext<{
  atTonight: boolean; hasOlder: boolean; hasNewer: boolean; locked: boolean; turn: (forward: boolean) => void;
} | null>(null);

/**
 * The turns a page can take from its foot: the same targets as the swipe, for whoever turns
 * pages otherwise (keyboard, screen reader, voice or switch control). Null outside the journal.
 */
export function useJournalPageTurns(page: JournalPageTurns['page']): JournalPageTurns | null {
  const turns = useContext(PageTurnsContext);
  if (!turns) return null;
  const onTonight = page === 'tonight';
  return {
    page,
    // Tonight's page only turns back; a dream page, hidden under it meanwhile, turns neither way.
    previous: onTonight ? turns.atTonight : !turns.atTonight && turns.hasOlder,
    next: !onTonight && !turns.atTonight && turns.hasNewer,
    locked: turns.locked,
    turn: turns.turn,
  };
}
