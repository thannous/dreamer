// A saved dream is named once, on its arrival in the journal: the seal (or, without it, the
// page) writes the name its pre-analysis gave it or, when none came in time, its first words.
// A name from the pre-analysis is the dream's: a categorization landing later still fills in
// its theme and type, but does not rename it. First words only stand in: a pre-analysis that
// lands later renames the dream, which the page then shows from its next opening.
const named = new Map<string, { provisional: boolean }>();

export function markDreamNamed(identity: string, provisional = false): void {
  named.set(identity, { provisional });
}

/** Whether the dream keeps the name it was given on arrival, whatever comes later. */
export function keepsDreamName(identity: string): boolean {
  const name = named.get(identity);
  return name !== undefined && !name.provisional;
}
