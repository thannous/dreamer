import { createKeyedSerialLock } from '@/lib/serialLock';
import { isLucidNativeKeyValueStorage, type LucidKeyValueStorage } from './lucidKeyValueStorage';
import {
  isLucidTrainerEncryptedValueError,
  isLucidTrainerStorageCapacityError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from './lucidTrainerSecureStorage';

export type LucidPracticeStorageErrorReason =
  | 'invalid_scope'
  | 'invalid_metadata'
  | 'persistence_failed'
  | 'storage_full';

type PracticeStore<Envelope> = {
  namespace: string;
  suffix: string;
  practice: string;
  version: number;
  keys: readonly string[];
  storageLabel: string;
  ErrorType: new (reason: LucidPracticeStorageErrorReason, message: string) => Error;
  parse: (value: unknown, scope: string) => Envelope | null;
  empty: (scope: string) => Envelope;
};

type PracticeTransaction<Envelope> = {
  load(): Promise<Envelope>;
  save(envelope: Envelope): Promise<void>;
  clear(): Promise<void>;
};

export function hasPracticeEnvelopeKeys(
  value: unknown,
  expected: readonly string[]
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function createLucidPracticeStore<Envelope>(definition: PracticeStore<Envelope>) {
  const { ErrorType } = definition;
  const lock = createKeyedSerialLock();

  function storageKey(scope: string): string {
    if (
      typeof scope !== 'string' ||
      scope.length > 256 ||
      scope.trim() !== scope ||
      (scope !== 'guest' && !/^user:[A-Za-z0-9._:-]+$/.test(scope))
    ) {
      throw new ErrorType('invalid_scope', `${definition.practice} user scope is invalid`);
    }
    return `${definition.namespace}:${encodeURIComponent(scope)}:${definition.suffix}`;
  }

  function persistenceError(error: unknown): Error {
    if (error instanceof ErrorType) return error;
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (isLucidTrainerStorageCapacityError(error) || /enospc|no space|quota/i.test(message)) {
      return new ErrorType('storage_full', 'Local storage is full');
    }
    return new ErrorType('persistence_failed', `Local ${definition.storageLabel} persistence failed`);
  }

  function run<T>(
    scope: string,
    storage: LucidKeyValueStorage,
    operation: (transaction: PracticeTransaction<Envelope>) => Promise<T>
  ): Promise<T> {
    const key = storageKey(scope);

    async function clear(): Promise<void> {
      try {
        await storage.removeItem(key);
      } catch (error) {
        throw persistenceError(error);
      }
    }

    async function load(): Promise<Envelope> {
      let plaintext: string | null;
      try {
        plaintext = await storage.getItem(key);
        if (plaintext && isLucidNativeKeyValueStorage(storage)) {
          try {
            plaintext = await revealLucidTrainerStoredValue(key, plaintext);
          } catch (error) {
            if (!isLucidTrainerEncryptedValueError(error)) throw error;
            // A damaged ciphertext is unreadable even if its removal also fails.
            await storage.removeItem(key).catch(() => undefined);
            return definition.empty(scope);
          }
        }
      } catch (error) {
        throw persistenceError(error);
      }
      if (!plaintext) return definition.empty(scope);
      try {
        const parsed = definition.parse(JSON.parse(plaintext) as unknown, scope);
        if (parsed) return parsed;
      } catch (error) {
        if (error instanceof ErrorType) throw error;
      }
      await clear();
      return definition.empty(scope);
    }

    async function save(envelope: Envelope): Promise<void> {
      const parsed = definition.parse(envelope, scope);
      if (!parsed) {
        throw new ErrorType('invalid_metadata', `Invalid local ${definition.storageLabel} envelope`);
      }
      const plaintext = JSON.stringify(parsed);
      try {
        const stored = isLucidNativeKeyValueStorage(storage)
          ? await protectLucidTrainerStoredValue(key, plaintext)
          : plaintext;
        await storage.setItem(key, stored);
      } catch (error) {
        throw persistenceError(error);
      }
    }

    return lock.run(scope, () => operation({ load, save, clear }));
  }

  function importEnvelope(
    scope: string,
    payload: unknown,
    storage: LucidKeyValueStorage
  ): Promise<Envelope> {
    return run(scope, storage, async ({ save }) => {
      const invalidPayload = `${definition.practice} import payload is invalid`;
      if (!hasPracticeEnvelopeKeys(payload, definition.keys)) {
        throw new ErrorType('invalid_metadata', invalidPayload);
      }
      if (payload.version !== definition.version) {
        throw new ErrorType('invalid_metadata', `${definition.practice} import version is unknown`);
      }
      if (payload.userScope !== scope) {
        throw new ErrorType('invalid_metadata', `${definition.practice} import scope does not match`);
      }
      const parsed = definition.parse(payload, scope);
      if (!parsed) throw new ErrorType('invalid_metadata', invalidPayload);
      await save(parsed);
      return parsed;
    });
  }

  return { storageKey, run, importEnvelope, countScopeLocks: lock.countKeys };
}
