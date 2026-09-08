/** Offline preflight, ordering and evidence helpers. No provider credentials or I/O on import. */
export const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;
export type Fixture = {
  id: string; lang: typeof LANGUAGES[number]; kind: 'short' | 'rich'; transcript: string;
  observations: string[]; expectedType: 'Unknown' | 'Lucid Dream' | 'Recurring Dream' | 'Nightmare' | 'Symbolic Dream';
  reportedEmotions: string[];
};
export type Version = 'before' | 'after';
const TYPES = ['Unknown', 'Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'];
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 30 &&
  value.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 500);
export function validateFixtures(value: unknown, suite: 'initial' | 'followup' = 'initial'): Fixture[] {
  if (!Array.isArray(value) || value.length !== 6) throw new Error('Expected six synthetic fixtures.');
  const ids = new Set<string>();
  const languages = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(row.id) || ids.has(row.id) ||
      !LANGUAGES.includes(row.lang) || languages.has(row.lang) ||
      !['short', 'rich'].includes(row.kind) || typeof row.transcript !== 'string' ||
      !row.transcript.trim() || row.transcript.length > 6000 ||
      !strings(row.observations) || row.observations.length === 0 ||
      !strings(row.reportedEmotions) || !TYPES.includes(row.expectedType)) {
      throw new Error('Invalid synthetic fixture shape, identity, language or review metadata.');
    }
    const words = row.transcript.trim().split(/\s+/u).length;
    // Corpus-specific operational labels, not a universal language length metric.
    if ((row.kind === 'short' && words > 25) || (row.kind === 'rich' && words < 40)) {
      throw new Error('Fixture length label does not match the corpus word bounds.');
    }
    ids.add(row.id); languages.add(row.lang);
  }
  if ((suite === 'initial' && value.filter((row) => row.kind === 'short').length !== 3) ||
    !value.some((row) => row.expectedType === 'Lucid Dream') ||
    !value.some((row) => row.expectedType === 'Unknown')) {
    throw new Error('Expected three short, three rich and both lucid-positive and unknown controls.');
  }
  if (suite === 'followup' && !value.some((row) => row.expectedType === 'Nightmare')) {
    throw new Error('Followup requires an explicit nightmare positive control.');
  }
  return value as Fixture[];
}

export function planPairs(fixtures: Fixture[]): { fixture: Fixture; versions: Version[] }[] {
  const counts = { short: 0, rich: 0 };
  return fixtures.map((fixture) => {
    const rank = counts[fixture.kind]++;
    // Both orders within each length; opposite first orders balance the whole corpus 3:3.
    const beforeFirst = (rank + (fixture.kind === 'rich' ? 1 : 0)) % 2 === 0;
    return { fixture, versions: beforeFirst ? ['before', 'after'] : ['after', 'before'] };
  });
}

export type Evidence = {
  id: string; version: Version; model: string; milliseconds: number; rawText: string;
  usage: unknown; parseStatus?: 'pending' | 'valid' | 'invalid'; response?: unknown;
  interpretationWords?: number;
};
export async function preserveResponse(evidence: Evidence, save: (value: Evidence) => Promise<void>): Promise<Evidence> {
  // Durable raw text precedes parsing. A crash during parsing retains paid output.
  const result: Evidence = { ...evidence, parseStatus: 'pending' };
  await save({ ...result });
  try {
    result.response = JSON.parse(result.rawText);
    result.parseStatus = 'valid';
    const interpretation = (result.response as { interpretation?: unknown } | null)?.interpretation;
    result.interpretationWords = typeof interpretation === 'string'
      ? interpretation.trim().split(/\s+/u).filter(Boolean).length : 0;
  } catch {
    result.parseStatus = 'invalid';
  }
  await save({ ...result });
  return result;
}

export type AtomicFileIO = {
  writeTextFile: (path: string, text: string, options: { mode: number; createNew: boolean }) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
};
/** Same-directory rename preserves the previous complete receipt if staging fails. */
export async function atomicWriteJson(path: string, value: unknown, io: AtomicFileIO = Deno): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  let cleanup = true;
  try {
    await io.writeTextFile(temporary, text, { mode: 0o600, createNew: true });
    await io.rename(temporary, path);
  } catch (error) {
    // An improbable createNew collision is not our file to clean up.
    if (error instanceof Deno.errors.AlreadyExists) cleanup = false;
    throw error;
  } finally {
    // Only our unique staging file is eligible for cleanup; never remove the target.
    if (cleanup) {
      try { await io.remove(temporary); } catch { /* Missing or inaccessible staging file. */ }
    }
  }
}

export function budgetedFetch(send: typeof fetch, reserve: (count: number) => Promise<void>): typeof fetch {
  let requests = 0;
  let reservationTail: Promise<void> = Promise.resolve();
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
      throw new Error('Unexpected provider endpoint blocked.');
    }
    if (requests >= 12) throw new Error('Hard limit of 12 provider HTTP requests reached.');
    const count = ++requests;
    // Increment synchronously for the cap, but commit receipts in count order.
    // A failed receipt poisons the chain: subsequent requests remain fail-closed.
    reservationTail = reservationTail.then(() => reserve(count));
    await reservationTail; // No send if the budget receipt cannot be persisted.
    return send(input, init);
  };
}
