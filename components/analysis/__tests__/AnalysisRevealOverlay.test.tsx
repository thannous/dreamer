/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { AnalysisRevealOverlay } from '@/components/analysis/AnalysisRevealOverlay';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

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
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { regular: 'sg', medium: 'sg-med', bold: 'sg-bold' } },
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { primary: '#fff' },
    accent: { base: '#ead4b4', text: '#ead4b4'},
    surface: { raised: '#222', borderStrong: '#555', overlay: 'rgba(3,4,13,0.72)' },
    atmosphere: { glow: '#ead4b4', star: '#eee' },
  }),
}));

describe('AnalysisRevealOverlay', () => {
  it('renders nothing while hidden', () => {
    render(<AnalysisRevealOverlay visible={false} />);

    expect(screen.queryByText('analysis.reveal.title')).toBeNull();
  });

  it('renders the reveal title and orb when visible', () => {
    render(<AnalysisRevealOverlay visible />);

    expect(screen.getByText('analysis.reveal.title')).toBeTruthy();
    expect(screen.getByTestId('icon.sparkles')).toBeTruthy();
  });
});
