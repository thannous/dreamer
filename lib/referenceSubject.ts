export type ReferenceSubjectType = 'person' | 'animal';

type ReferenceSubjectSignals = {
  hasPerson?: boolean | null;
  hasAnimal?: boolean | null;
};

export function resolveReferenceSubjectType(
  signals: ReferenceSubjectSignals
): ReferenceSubjectType | null {
  if (signals.hasPerson === true) {
    return 'person';
  }
  if (signals.hasAnimal === true) {
    return 'animal';
  }
  return null;
}
