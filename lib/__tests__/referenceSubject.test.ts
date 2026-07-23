import { describe, expect, it } from '@jest/globals';

import { resolveReferenceSubjectType } from '@/lib/referenceSubject';

describe('resolveReferenceSubjectType', () => {
  it.each([
    [{ hasPerson: true, hasAnimal: false }, 'person'],
    [{ hasPerson: false, hasAnimal: true }, 'animal'],
    [{ hasPerson: true, hasAnimal: true }, 'person'],
    [{ hasPerson: false, hasAnimal: false }, null],
  ] as const)(
    'resolves %o to %s',
    (
      signals: Parameters<typeof resolveReferenceSubjectType>[0],
      expected: ReturnType<typeof resolveReferenceSubjectType>
    ) => {
      expect(resolveReferenceSubjectType(signals)).toBe(expected);
    }
  );
});
