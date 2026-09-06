import type { DreamAnalysis, DreamListReadResult } from '@/lib/types';

export class DreamStorageReadError extends Error {
  constructor() {
    super('Dream storage could not be read');
    this.name = 'DreamStorageReadError';
  }
}

export class DreamPersistenceError extends Error {
  constructor(
    readonly operation: 'read' | 'write',
    readonly target: 'device' | 'remote-cache'
  ) {
    super(operation === 'read' ? 'Dream storage could not be read' : 'Dream changes could not be saved');
    this.name = 'DreamPersistenceError';
  }
}

export function requireReadableDreams(result: DreamListReadResult): DreamAnalysis[] {
  if (result.status === 'error') throw new DreamStorageReadError();
  return result.status === 'loaded' ? result.value : [];
}
