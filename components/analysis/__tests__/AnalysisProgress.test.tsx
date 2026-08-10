/* @jest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import type { ClassifiedError } from '@/lib/errors';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID ?? 'pressable'} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@/lib/moti', () => {
  const React = require('react');
  return {
    MotiView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    MotiText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark', shadows: { md: {} } }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { regular: 'sg', medium: 'sg-med', bold: 'sg-bold' } },
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { primary: '#fff', secondary: '#ccc', tertiary: '#999' },
    accent: { base: '#ead4b4' },
    surface: {
      active: '#111',
      raised: '#222',
      soft: '#333',
      border: '#444',
      borderStrong: '#555',
    },
    action: { primary: '#ead4b4', primaryBorder: '#fff', primaryText: '#000' },
    status: { danger: { icon: '#f00', text: '#faa' } },
    atmosphere: { glow: '#ead4b4', glowOpacity: 0.16, veil: '#123', star: '#eee' },
  }),
}));

const flushInitialEffects = () => act(() => undefined);

describe('AnalysisProgress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the step message, progress and first mantra', () => {
    render(
      <AnalysisProgress
        step={AnalysisStep.ANALYZING}
        progress={25}
        message="Analyzing your dream..."
        error={null}
      />
    );
    flushInitialEffects();

    expect(screen.getByText('Analyzing your dream...')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText('analysis.mantra.analyzing.1')).toBeTruthy();
    expect(screen.getByTestId('icon.sparkles')).toBeTruthy();
  });

  it('rotates mantras over time', () => {
    render(
      <AnalysisProgress
        step={AnalysisStep.ANALYZING}
        progress={25}
        message="Analyzing your dream..."
        error={null}
      />
    );
    flushInitialEffects();

    expect(screen.getByText('analysis.mantra.analyzing.1')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(4200);
    });
    expect(screen.getByText('analysis.mantra.analyzing.2')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(4200);
    });
    expect(screen.getByText('analysis.mantra.analyzing.3')).toBeTruthy();
  });

  it('shows the per-step icon for image generation', () => {
    render(
      <AnalysisProgress
        step={AnalysisStep.GENERATING_IMAGE}
        progress={65}
        message="Generating dream imagery..."
        error={null}
      />
    );
    flushInitialEffects();

    expect(screen.getByTestId('icon.photo')).toBeTruthy();
    expect(screen.getByText('analysis.mantra.generating_image.1')).toBeTruthy();
  });

  it('renders the error state with a working retry button', () => {
    const onRetry = jest.fn();
    const error: ClassifiedError = {
      type: 'network',
      message: 'offline',
      userMessage: 'Network unavailable',
      canRetry: true,
      originalError: new Error('offline'),
    } as ClassifiedError;

    render(
      <AnalysisProgress
        step={AnalysisStep.ERROR}
        progress={0}
        message="Network unavailable"
        error={error}
        onRetry={onRetry}
      />
    );
    flushInitialEffects();

    expect(screen.getByText('Network unavailable')).toBeTruthy();
    fireEvent.click(screen.getByText('analysis.retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
