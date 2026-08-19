/**
 * Uniwind's runtime needs the Metro transformer that compiles `global.css`.
 * Tests only need the two entry points the app actually calls: a theme setter
 * that records the last value and a hook reporting the resolved theme.
 */
type ThemeName = 'light' | 'dark' | 'system';

let currentTheme: ThemeName = 'light';

export const Uniwind = {
  setTheme: (theme: ThemeName) => {
    currentTheme = theme;
  },
};

export const useUniwind = () => ({
  theme: currentTheme === 'system' ? 'light' : currentTheme,
});
