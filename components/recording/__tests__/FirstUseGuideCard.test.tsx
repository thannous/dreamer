/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { FirstUseGuideCard } from '@/components/recording/FirstUseGuideCard';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Pressable: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#c5a46d',
      backgroundCard: '#111',
      backgroundSecondary: '#222',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      timeline: '#333',
    },
  }),
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { full: 999, md: 8 },
    spacing: { md: 16, sm: 8 },
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        'recording.first_use.eyebrow': 'Premier rêve',
        'recording.first_use.title': 'Racontez votre rêve à la voix, complétez-le par écrit, ou explorez d’abord.',
        'recording.first_use.step.value.title': 'Dicter avec la voix',
        'recording.first_use.step.value.body': 'Touchez le micro et racontez les images qui restent, même dans le désordre.',
        'recording.first_use.step.privacy.title': 'Affiner par écrit',
        'recording.first_use.step.privacy.body': 'Passez au texte pour corriger la transcription, ajouter une émotion ou préciser un détail.',
        'recording.first_use.step.backup.title': 'Explorer sans enregistrer',
        'recording.first_use.step.backup.body': 'Le bouton Explorer l’univers onirique ouvre le dictionnaire et les guides de rêves.',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('FirstUseGuideCard', () => {
  it('explains voice, writing, and direct exploration on first use', () => {
    render(<FirstUseGuideCard />);

    expect(screen.getByTestId(TID.Component.FirstUseGuideCard)).toBeTruthy();
    expect(screen.getByText('Dicter avec la voix')).toBeTruthy();
    expect(screen.getByText('Affiner par écrit')).toBeTruthy();
    expect(screen.getByText('Explorer sans enregistrer')).toBeTruthy();
    expect(screen.getByText('Le bouton Explorer l’univers onirique ouvre le dictionnaire et les guides de rêves.')).toBeTruthy();
    expect(screen.getByTestId('icon.mic')).toBeTruthy();
    expect(screen.getByTestId('icon.keyboard')).toBeTruthy();
    expect(screen.getByTestId('icon.book.closed.fill')).toBeTruthy();
  });
});
