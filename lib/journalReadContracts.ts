import type { DreamAnalysis } from './types';

/** A projection, never a replacement for a durable DreamAnalysis. */
export type DreamListItem = Pick<DreamAnalysis,
  'id' | 'remoteId' | 'clientRequestId' | 'revisionId' | 'updatedAt' |
  'transcript' | 'shareableQuote' | 'explorationStartedAt' | 'title' | 'imageUrl' | 'thumbnailUrl' | 'dreamType' |
  'theme' | 'isFavorite' | 'memory' | 'isAnalyzed' | 'analyzedAt' |
  'analysisStatus' | 'analysisRequestId' | 'imageGenerationFailed'>;

/** Insertion-order traversal. Updates are read live, not an MVCC snapshot. */
export interface JournalCursor {
  version: 1;
  userId: string;
  highWatermark: number;
  beforeId: number;
}
export interface JournalReadOptions {
  cursor?: JournalCursor | null;
  pageSize?: number;
}
export interface JournalPage<T> {
  items: T[];
  nextCursor: JournalCursor | null;
  /** Only an empty response proves exhaustion, even if the server caps pages. */
  complete: boolean;
}
export class JournalTraversalError extends Error {
  readonly complete = false;
  constructor(readonly userId: string, readonly cursor: JournalCursor | null, readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Journal traversal interrupted');
    this.name = 'JournalTraversalError';
  }
}
