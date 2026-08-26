import {
  getThemeModeForAmbience,
  isThemeAmbience,
  resolveThemeAmbience,
} from '@/lib/themeAmbience';

function localDateAt(hour: number) {
  return new Date(2026, 7, 23, hour, 0, 0, 0);
}

describe('global theme ambience', () => {
  it.each([
    [4, 'dark'],
    [5, 'morning'],
    [8, 'morning'],
    [9, 'light'],
    [16, 'light'],
    [17, 'afterglow'],
    [20, 'afterglow'],
    [21, 'dark'],
  ] as const)('maps local hour %i to %s', (hour, expected) => {
    expect(resolveThemeAmbience(localDateAt(hour))).toBe(expected);
  });

  it('uses a light native mode only for morning and daytime', () => {
    expect(getThemeModeForAmbience('morning')).toBe('light');
    expect(getThemeModeForAmbience('light')).toBe('light');
    expect(getThemeModeForAmbience('afterglow')).toBe('dark');
    expect(getThemeModeForAmbience('dark')).toBe('dark');
  });

  it('accepts only the four supported ambience identifiers', () => {
    expect(isThemeAmbience('afterglow')).toBe(true);
    expect(isThemeAmbience('system')).toBe(false);
  });
});
