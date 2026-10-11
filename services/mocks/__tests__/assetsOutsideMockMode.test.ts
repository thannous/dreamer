// Outside mock mode, metro.config.js resolves the demo dream art to empty modules, but
// services/storageService.ts still loads the mock storage, which builds its predefined
// dreams at import time. Jest does not run that Metro rule, so this reproduces it.
const ART = ['cat', 'doors', 'floating', 'frozen-lake', 'glass-teeth', 'harbour', 'no-driver', 'staircase', 'station', 'tide'];

describe('mock dream art in a non-mock build', () => {
  it('lets the predefined dreams load without any image', () => {
    jest.isolateModules(() => {
      for (const name of ART) jest.doMock(`@/mock-data/assets/dreams/${name}.webp`, () => ({}));
      const { PREDEFINED_DREAMS } = require('@/mock-data/predefinedDreams');
      expect(PREDEFINED_DREAMS.length).toBeGreaterThan(0);
      expect(PREDEFINED_DREAMS[0].imageUrl).toBe('');
    });
  });
});
