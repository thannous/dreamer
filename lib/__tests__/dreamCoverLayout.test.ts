import { getDreamCoverLayout } from '../dreamCoverLayout';

describe('dream cover viewport layout', () => {
  it('keeps the portrait on a tall phone and lifts the caption 50 units', () => {
    const layout = getDreamCoverLayout(390, 844, 104);
    expect(layout.imageHeight).toBeCloseTo(390 * 16 / 9);
    expect(layout.captionTop).toBeCloseTo(layout.imageHeight - 50);
  });

  it.each([104, 176, 300])('keeps a %i-high caption visible on a short phone', (captionHeight) => {
    const layout = getDreamCoverLayout(390, 568, captionHeight);
    expect(layout.captionTop + captionHeight).toBeLessThanOrEqual(568 - 16);
    expect(layout.imageHeight).toBeLessThan(390 * 16 / 9);
  });

  it('reserves more room when a title wraps or fonts grow', () => {
    expect(getDreamCoverLayout(390, 568, 176).imageHeight)
      .toBeLessThan(getDreamCoverLayout(390, 568, 104).imageHeight);
  });

  it('keeps nonnegative geometry when text exceeds the entire viewport', () => {
    expect(getDreamCoverLayout(320, 240, 400)).toEqual({ imageHeight: 50, captionTop: 0 });
  });
});
