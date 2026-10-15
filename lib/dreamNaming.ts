import { matchesDreamTarget, type DreamTarget } from '@/lib/dreamIdentity';

// A saved dream is named once, on its arrival in the journal: the seal (or, without it, the
// page) writes the name its pre-analysis gave it or, when none came in time, its first words.
// A name from the pre-analysis is the dream's: a categorization landing later still fills in
// its theme and type, but does not rename it. First words only stand in: a pre-analysis that
// lands later renames the dream, which the page then shows from its next opening.
// Each dream is held by its target, so it stays found when synchronization gives it its remote id.
type Target = Exclude<DreamTarget, number>;
const named: { target: Target; provisional: boolean }[] = [];

export function markDreamNamed(dream: Target, provisional = false): void {
  const target = { id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId };
  const index = named.findIndex((name) => matchesDreamTarget(dream, name.target));
  if (index >= 0) named.splice(index, 1);
  named.push({ target, provisional });
}

/** Whether the dream keeps the name it was given on arrival, whatever comes later. */
export function keepsDreamName(dream: Target): boolean {
  const name = named.find((entry) => matchesDreamTarget(dream, entry.target));
  return name !== undefined && !name.provisional;
}
