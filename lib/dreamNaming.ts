// A saved dream is named once, on its arrival in the journal: the page writes the name it
// has by then, the one its categorization gave it or, without one, its first words. From
// then on that name is the dream's: a categorization that lands later still fills in its
// theme and type, but does not rename it under the reader's eyes.
const named = new Set<string>();

export function markDreamNamed(identity: string): void {
  named.add(identity);
}

export function isDreamNamed(identity: string): boolean {
  return named.has(identity);
}
