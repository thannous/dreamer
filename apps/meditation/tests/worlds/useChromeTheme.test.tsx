import { renderHook } from '@testing-library/react-native';

import { NightTheme, PaperTheme } from '@/constants/theme';
import { useChromeTheme } from '@/hooks/useChromeTheme';

let mockPathname = '/';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

describe('useChromeTheme', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('follows the selected world on the immersive home', () => {
    const view = renderHook(() => useChromeTheme());

    expect(view.result.current).toMatchObject({
      mode: 'dark',
      colors: NightTheme,
      followsWorld: true,
    });
  });

  it('returns to the app theme away from home', () => {
    const view = renderHook(() => useChromeTheme());

    mockPathname = '/search';
    view.rerender(undefined);

    expect(view.result.current).toMatchObject({
      mode: 'light',
      colors: PaperTheme,
      followsWorld: false,
    });
  });
});
