/**
 * The dream story's epilogue: after the reader leaves a just-captured dream for the
 * journal, that dream's card glows once. A single token, kept in memory only, so the
 * glow never survives a restart, never replays on scroll and expires if the reader goes
 * somewhere else first.
 */
const EPILOGUE_TTL_MS = 60_000;

let pending: { key: string; expiresAt: number } | null = null;

export function markDreamStoryEpilogue(key: string, now = Date.now()): void {
  pending = { key, expiresAt: now + EPILOGUE_TTL_MS };
}

/** The dream whose card should glow now, if any; taking it spends the token. */
export function takeDreamStoryEpilogue(now = Date.now()): string | null {
  const token = pending;
  pending = null;
  return token && token.expiresAt > now ? token.key : null;
}
