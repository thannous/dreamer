import { applyBadgeEvent, computeBadgeProgress, createEmptyBadgeLedger, settleBadgeLedger, type BadgeLedger } from '@/lib/badges/ledger';
import { synchronizeBadgeLedger, type BadgeLedgerTransport, type RemoteBadgeLedger } from '@/services/badgeLedgerSync';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function server() {
  const rows = new Map<string, RemoteBadgeLedger>();
  let loseNextAck = false;
  const transport: BadgeLedgerTransport = {
    async exchange(userId, revision, ledger) {
      let row = rows.get(userId) ?? { ledger: createEmptyBadgeLedger(), revision: 0, accepted: false };
      const accepted = revision === row.revision && ledger != null;
      if (accepted) {
        row = { ledger: copy(ledger), revision: row.revision + 1, accepted: true };
        rows.set(userId, row);
        if (loseNextAck) { loseNextAck = false; throw new Error('ack lost'); }
      }
      return copy({ ...row, accepted });
    },
  };
  return { transport, rows, loseAck: () => { loseNextAck = true; } };
}
const symbols = (...ids: string[]): BadgeLedger => ids.reduce((ledger, symbolId) =>
  applyBadgeEvent(ledger, { type: 'symbol_viewed', symbolId }), createEmptyBadgeLedger());

describe('badge account continuity (transport isolation)', () => {
  it('restores facts and original earned dates onto an empty device', async () => {
    const remote = server();
    const original = settleBadgeLedger(symbols('water', 'moon', 'sun'), [], 12345);
    await synchronizeBadgeLedger('a', original, remote.transport);
    const restored = await synchronizeBadgeLedger('a', createEmptyBadgeLedger(), remote.transport);
    expect(restored?.earned['symbol-explorer']).toEqual([12345]);
    expect(computeBadgeProgress(restored!, [])['symbol-explorer']).toBe(3);
  });

  it('unions concurrent devices, deduplicates overlap and awards a newly crossed threshold', async () => {
    const remote = server();
    await Promise.all([
      synchronizeBadgeLedger('a', symbols('water', 'moon'), remote.transport),
      synchronizeBadgeLedger('a', symbols('moon', 'sun'), remote.transport),
    ]);
    const restored = await synchronizeBadgeLedger('a', createEmptyBadgeLedger(), remote.transport);
    expect(computeBadgeProgress(restored!, [])['symbol-explorer']).toBe(3);
    expect(restored?.earned['symbol-explorer']).toHaveLength(1);
    const revision = remote.rows.get('a')!.revision;
    await synchronizeBadgeLedger('a', symbols('water', 'moon', 'sun'), remote.transport);
    expect(remote.rows.get('a')!.revision).toBe(revision);
  });

  it('does not collapse distinct devices whose dreams have the same local timestamp', async () => {
    const remote = server();
    const first = applyBadgeEvent(createEmptyBadgeLedger(), {
      type: 'dream_saved', input: 'text', dream: { id: 12345, clientRequestId: 'device-a-request' },
    });
    const second = applyBadgeEvent(createEmptyBadgeLedger(), {
      type: 'dream_saved', input: 'text', dream: { id: 12345, clientRequestId: 'device-b-request' },
    });
    await synchronizeBadgeLedger('a', first, remote.transport);
    const combined = await synchronizeBadgeLedger('a', second, remote.transport);
    expect(computeBadgeProgress(combined!, [])['ink-dreamer']).toBe(2);
  });

  it('retries a lost acknowledgement without double counting or changing acquired dates', async () => {
    const remote = server();
    const local = settleBadgeLedger(symbols('water', 'moon', 'sun'), [], 12345);
    remote.loseAck();
    await expect(synchronizeBadgeLedger('a', local, remote.transport)).rejects.toThrow('ack lost');
    const retried = await synchronizeBadgeLedger('a', local, remote.transport);
    expect(retried?.earned['symbol-explorer']).toEqual([12345]);
    expect(computeBadgeProgress(retried!, [])['symbol-explorer']).toBe(3);
  });

  it('stops a stale account worker before writing and never imports A into B', async () => {
    const remote = server();
    let current = true;
    const delayed: BadgeLedgerTransport = { async exchange(...args) {
      const result = await remote.transport.exchange(...args);
      current = false;
      return result;
    } };
    expect(await synchronizeBadgeLedger('a', symbols('water'), delayed, () => current)).toBeNull();
    expect(remote.rows.has('a')).toBe(false);
    const b = await synchronizeBadgeLedger('b', createEmptyBadgeLedger(), remote.transport);
    expect(computeBadgeProgress(b!, [])['symbol-explorer']).toBe(0);
  });

  it('keeps disjoint historical days after dreams were deleted on both devices', async () => {
    const remote = server();
    const one = createEmptyBadgeLedger();
    one.keys['gentle-rhythm'] = ['2026-10-01', '2026-10-02'];
    one.best['gentle-rhythm'] = 2;
    const two = createEmptyBadgeLedger();
    two.keys['gentle-rhythm'] = ['2026-10-02', '2026-10-03'];
    two.best['gentle-rhythm'] = 2;
    await synchronizeBadgeLedger('a', one, remote.transport);
    const combined = await synchronizeBadgeLedger('a', two, remote.transport);
    expect(computeBadgeProgress(combined!, [])['gentle-rhythm']).toBe(3);
    expect(combined?.earned['gentle-rhythm']).toHaveLength(1);
  });
});
