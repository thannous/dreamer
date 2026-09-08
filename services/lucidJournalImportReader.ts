import type { JournalImportConfirmation, JournalImportItem, JournalImportPage } from '@/lib/lucid/journalImport';

/** Supplied by the authenticated session owner, never by an appId header or user metadata. */
export interface JournalImportSessionAuthority {
  userId: string;
  clientId: string;
  product: 'lucid';
  /** Changes on every authentication transition, including A -> B -> A. */
  sessionGeneration: string;
  destinationScope: string;
}
export interface ConfirmedJournalImportGrant extends JournalImportConfirmation {
  destinationClientId: string;
  scope: 'all' | 'selected';
}
/** Supabase's RPC result is untrusted until this adapter validates it. */
export interface JournalImportRpcClient {
  rpc(name: 'read_journal_import_page', args: { p_cursor: string; p_limit: number }): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const decimal = (value: unknown): value is string => typeof value === 'string' && /^[0-9]+$/.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed Journal import response');
  return value as Record<string, unknown>;
};
function parseItem(raw: unknown): JournalImportItem {
  const value = record(raw);
  if (!decimal(value.id) || !decimal(value.revision) || !date(value.createdAt) || typeof value.transcript !== 'string' ||
    !(value.clientRequestId === null || uuid(value.clientRequestId))) throw new Error('Malformed Journal import item');
  return { id: value.id, revision: value.revision, createdAt: value.createdAt,
    transcript: value.transcript, clientRequestId: value.clientRequestId };
}

/** No fallback table read: server grant/client checks remain the authorization boundary. */
export function createLucidJournalImportReader(deps: {
  client: JournalImportRpcClient;
  confirmation: ConfirmedJournalImportGrant;
  getSessionAuthority(): JournalImportSessionAuthority | null;
  now(): Date;
  limit?: number;
}): (input: { grantId: string; cursor: string; sourceAccount: string }) => Promise<JournalImportPage> {
  const grant = { ...deps.confirmation };
  const initial = deps.getSessionAuthority();
  const authority = initial ? { ...initial } : null;
  const limit = deps.limit ?? 100;
  if (grant.confirmed !== true || !uuid(grant.grantId) || !uuid(grant.cursor) || !uuid(grant.sourceAccount) ||
    !date(grant.expiresAt) || !grant.destinationClientId || !grant.destinationScope ||
    !['all', 'selected'].includes(grant.scope) || !Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('Invalid confirmed Journal import grant');
  }
  const assertAuthority = () => {
    const current = deps.getSessionAuthority();
    if (!authority || !current || !authority.sessionGeneration || current.sessionGeneration !== authority.sessionGeneration ||
      current.userId !== grant.sourceAccount || current.userId !== authority.userId || current.product !== 'lucid' ||
      current.clientId !== grant.destinationClientId || current.clientId !== authority.clientId ||
      current.destinationScope !== grant.destinationScope || current.destinationScope !== authority.destinationScope) {
      throw new Error('Journal import session unavailable or changed');
    }
    if (deps.now().getTime() >= Date.parse(grant.expiresAt)) throw new Error('Journal import grant expired');
  };
  assertAuthority();
  return async input => {
    assertAuthority();
    if (input.grantId !== grant.grantId || input.sourceAccount !== grant.sourceAccount || !uuid(input.cursor)) {
      throw new Error('Journal import request does not match confirmation');
    }
    const result = await deps.client.rpc('read_journal_import_page', { p_cursor: input.cursor, p_limit: limit });
    assertAuthority();
    // Denial is never represented as an empty page; no direct dreams access is attempted.
    if (result.error) throw new Error('Journal import page denied or unavailable', { cause: result.error });
    const value = record(result.data);
    if (value.grantId !== grant.grantId || !Array.isArray(value.items) || value.items.length > limit ||
      typeof value.done !== 'boolean' || (value.done ? value.nextCursor !== null : !uuid(value.nextCursor) || value.nextCursor === input.cursor)) {
      throw new Error('Malformed Journal import page');
    }
    const items = value.items.map(parseItem);
    const identities = new Set(items.map(item => item.id));
    if (identities.size !== items.length) throw new Error('Duplicate Journal import item');
    return { grantId: grant.grantId, items, nextCursor: value.nextCursor as string | null, done: value.done };
  };
}
