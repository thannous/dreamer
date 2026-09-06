import type { LucidExperiment } from './model';

/** Narrow training input; historical numeric ids identify unavailable Journal sources. */
export interface LucidTrainingSource {
  id: string | number;
  title: string;
  transcript: string;
  symbols?: { name: string }[];
  emotions?: { name: string }[];
}
export interface LucidObservation extends LucidTrainingSource {
  id: string;
  occurredAt: number;
  provenance: { kind: 'lucid_observation'; experimentId: string };
  voiceCapture?: LucidExperiment['voiceCapture'];
}
export function projectLucidObservations(experiments: readonly LucidExperiment[]): LucidObservation[] {
  return experiments.filter(item => Boolean(item.recallText?.trim() || item.notes?.trim() || item.voiceCapture === 'local_note'))
    .map(item => {
      const transcript = [item.recallText?.trim(), item.notes?.trim()].filter(Boolean).join('\n\n');
      return {
        id: lucidObservationSourceId(item.id, item.occurredAt),
        occurredAt: item.occurredAt,
        provenance: { kind: 'lucid_observation' as const, experimentId: item.id },
        title: transcript.split('\n')[0]?.slice(0, 80) ?? '',
        transcript,
        voiceCapture: item.voiceCapture,
      };
    }).sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id));
}
/** Stable local identity, not an authorization token or cryptographic digest.
 * FNV-1a 128 over UTF-16 bytes preserves every accepted experiment identifier.
 * The exact timestamp is included in the hash, including fractional timestamps.
 */
export function lucidObservationSourceId(experimentId: string, occurredAt: number): string {
  const input = JSON.stringify([experimentId, occurredAt]);
  let hash = BigInt('0x6c62272e07bb014262b821756295c58d');
  const prime = BigInt('0x1000000000000000000013b');
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    hash = ((hash ^ BigInt(code & 255)) * prime) & mask;
    hash = ((hash ^ BigInt(code >>> 8)) * prime) & mask;
  }
  return `lucid:${occurredAt}:${hash.toString(16).padStart(32, '0')}`;
}

export function isLucidObservationSourceId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  const match = /^lucid:([^:]+):[a-f0-9]{32}$/.exec(value);
  if (!match) return false;
  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= 8_640_000_000_000_000 && String(timestamp) === match[1];
}

export function lucidSourceTimestamp(id: string | number): number {
  if (typeof id === 'string' && id.startsWith('lucid:')) {
    return isLucidObservationSourceId(id) ? Number(id.slice(6, id.lastIndexOf(':'))) : Number.NaN;
  }
  return Number(id);
}

export const LUCID_LOCAL_SIGN_PREFIX = 'sign:lucid:';
export function localLucidSignId(candidateId: string): string {
  return `${LUCID_LOCAL_SIGN_PREFIX}${candidateId.slice('sign:'.length)}`;
}
