/**
 * Jest stub for `uniwind`.
 *
 * Uniwind resolves `className` at build time inside the Metro transformer, which Jest
 * never runs. Under test, `className` is simply an inert prop: components still render
 * and behave identically, they just carry no resolved styles. Tests that need to assert
 * on visual state should assert on props/testIDs, not on generated styles.
 */
import React from 'react';

type ThemeName = 'morning' | 'light' | 'afterglow' | 'dark' | 'system';

let currentTheme: ThemeName = 'light';
let hasAdaptiveThemes = true;

export const Uniwind = {
  get currentTheme() {
    return currentTheme;
  },
  get hasAdaptiveThemes() {
    return hasAdaptiveThemes;
  },
  setTheme(theme: ThemeName) {
    currentTheme = theme === 'system' ? 'light' : theme;
    hasAdaptiveThemes = theme === 'system';
  },
  updateCSSVariables() {},
};

export const useUniwind = () => ({
  theme: currentTheme,
  hasAdaptiveThemes,
});

export const withUniwind = <P,>(Component: React.ComponentType<P>) => Component;

export const useResolveClassNames = () => ({});
export const getCSSVariable = () => undefined;
export const useCSSVariable = () => undefined;

export const ScopedTheme = ({ children }: React.PropsWithChildren<{ name?: string }>) => <>{children}</>;
export const ScopedVariables = ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <>{children}</>;
export const LayoutDirection = ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <>{children}</>;
