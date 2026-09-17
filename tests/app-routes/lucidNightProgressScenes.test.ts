jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

const { shouldUseLucidNightReflow } = require('@/components/lucid/LucidNightSanctuary');
const { shouldUseLucidProgressReflow } = require('@/components/lucid/LucidProgressConstellation');

describe('Lucid night and progress scene reflow', () => {
  it('reflows below 380 dp or from fontScale 1.3', () => {
    expect(shouldUseLucidNightReflow(393, 1)).toBe(false);
    expect(shouldUseLucidProgressReflow(393, 1)).toBe(false);
    expect(shouldUseLucidNightReflow(379, 1)).toBe(true);
    expect(shouldUseLucidProgressReflow(390, 1.3)).toBe(true);
  });
});
