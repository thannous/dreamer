/** Preparatory RPC contract; no client import flow is enabled. */
export interface JournalImportGrant {
  grantId: string;
  cursor: string;
  expiresAt: string;
  scope: 'all' | 'selected';
}
export interface JournalImportItem {
  /** Decimal bigint strings avoid JavaScript precision loss. */
  id: string;
  clientRequestId: string | null;
  /** Opaque UUID from dreams.revision_id; not a numeric counter. */
  revision: string;
  createdAt: string;
  transcript: string;
}
export interface JournalImportPage {
  grantId: string;
  items: JournalImportItem[];
  nextCursor: string | null;
  done: boolean;
}
