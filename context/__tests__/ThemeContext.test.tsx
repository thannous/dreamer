/* @jest-environment jsdom */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUseColorScheme = jest.fn();
const mockGetThemePreference = jest.fn();
const mockSaveThemePreference = jest.fn();

jest.mock('../../hooks/use-color-scheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

jest.mock('../../services/storageService', () => ({
  getThemePreference: mockGetThemePreference,
  saveThemePreference: mockSaveThemePreference,
}));

const { DarkTheme, LightTheme, Shadows } = require('../../constants/journalTheme');
const { ThemeProvider, useTheme } = require('../ThemeContext');

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockGetThemePreference.mockResolvedValue('auto');
  });

  it('given stored dark preference__when provider mounts__then uses dark theme', async () => {
    mockUseColorScheme.mockReturnValue('light');
    mockGetThemePreference.mockResolvedValue('dark');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.preference).toBe('dark');
    expect(result.current.mode).toBe('dark');
    expect(result.current.systemMode).toBe('light');
    expect(result.current.colors).toBe(DarkTheme);
    expect(result.current.shadows).toBe(Shadows.dark);
  });

  it('given auto preference and dark system__when provider mounts__then follows system', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    mockGetThemePreference.mockResolvedValue('auto');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.systemMode).toBe('dark');
    expect(result.current.mode).toBe('dark');
    expect(result.current.colors).toBe(DarkTheme);
  });

  it('given user updates preference__when setPreference called__then persists and updates mode', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.setPreference('dark');
    });

    expect(mockSaveThemePreference).toHaveBeenCalledWith('dark');
    expect(result.current.preference).toBe('dark');
    expect(result.current.mode).toBe('dark');
    expect(result.current.colors).toBe(DarkTheme);
  });

  it('given missing provider__when using hook__then returns default snapshot', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.preference).toBe('auto');
    expect(result.current.mode).toBe('light');
    expect(result.current.colors).toBe(LightTheme);
    expect(result.current.shadows).toBe(Shadows.light);
  });
});
