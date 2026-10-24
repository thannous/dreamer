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
  applyBadgeEvent(ledger, { type: 'symbol_read', symbolId }), createEmptyBadgeLedger());

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
      type: 'dream_shared', dream: { id: 12345, clientRequestId: 'device-a-request' },
    });
    const second = applyBadgeEvent(createEmptyBadgeLedger(), {
      type: 'dream_shared', dream: { id: 12345, clientRequestId: 'device-b-request' },
    });
    await synchronizeBadgeLedger('a', first, remote.transport);
    const combined = await synchronizeBadgeLedger('a', second, remote.transport);
    expect(computeBadgeProgress(combined!, [])['night-echoes']).toBe(2);
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

  it('keeps disjoint historical months after dreams were deleted on both devices', async () => {
    const remote = server();
    const one = createEmptyBadgeLedger();
    one.keys['moon-cycles'] = ['2026-08', '2026-09'];
    one.best['moon-cycles'] = 2;
    const two = createEmptyBadgeLedger();
    two.keys['moon-cycles'] = ['2026-09', '2026-10'];
    two.best['moon-cycles'] = 2;
    await synchronizeBadgeLedger('a', one, remote.transport);
    const combined = await synchronizeBadgeLedger('a', two, remote.transport);
    expect(computeBadgeProgress(combined!, [])['moon-cycles']).toBe(3);
    expect(combined?.earned['moon-cycles']).toHaveLength(2);
  });

  it('rewrites an account copy of the first collection even when this device adds nothing', async () => {
    const remote = server();
    const converted = settleBadgeLedger(symbols('water', 'moon', 'sun'), [], 12345);
    remote.rows.set('a', { ledger: converted, revision: 3, accepted: false, legacy: true });
    const restored = await synchronizeBadgeLedger('a', createEmptyBadgeLedger(), remote.transport);
    expect(restored?.earned['symbol-explorer']).toEqual([12345]);
    expect(remote.rows.get('a')).toMatchObject({ revision: 4, accepted: true });
    expect(remote.rows.get('a')?.legacy).toBeUndefined();
  });
});
