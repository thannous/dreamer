/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockPush = jest.fn();
let mockDreams = [
  {
    id: Date.UTC(2026, 7, 26),
    title: 'La forêt bleue',
    transcript: 'Je retrouvais le même renard près des arbres.',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'normal' as const,
  },
  {
    id: Date.UTC(2026, 7, 25),
    title: 'Train de nuit',
    transcript: 'Le quai changeait de numéro.',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'normal' as const,
  },
];

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

jest.mock('expo-router', () => ({ router: { push: mockPush } }));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: {
      locale: 'fr',
      chrome: { common: { loading: 'Chargement…' } },
    },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    borderInteractive: '#777',
    surface: '#fff',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LUCID_TAB_BAR_INSET: 92,
  LucidScreen: ({
    children,
    eyebrow,
    subtitle,
    testID,
    title,
    trailing,
  }: {
    children: React.ReactNode;
    eyebrow?: string;
    subtitle?: string;
    testID?: string;
    title?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      <span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p>{trailing}{children}
    </main>
  ),
  LucidButton: ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} onClick={onPress}>{label}</button>
  ),
  LucidCard: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => onPress ? (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>{children}</button>
  ) : <section data-testid={testID}>{children}</section>,
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidSectionHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div><h2>{title}</h2>{action}</div>
  ),
}));

const { default: LucidJournalScreen } = require('@/app/lucid/(tabs)/journal');

describe('Lucid Journal tab', () => {
  it('uses the real local journal and exposes profile, capture, signs, voice notes and dream routes', () => {
    render(<LucidJournalScreen />);

    expect(screen.getByText('La forêt bleue')).not.toBeNull();
    expect(screen.getByText('Train de nuit')).not.toBeNull();
    expect(screen.getByText('2 rêves')).not.toBeNull();
    expect(screen.getByText('Noter un rêve')).not.toBeNull();
    expect(screen.getByText('Signes oniriques')).not.toBeNull();
    expect(screen.getByText('Atlas des rêves')).not.toBeNull();
    expect(screen.getByText('Voir les signes confirmés et les rêves sources.')).not.toBeNull();
    expect(screen.getByLabelText('Atlas des rêves. Voir les signes confirmés et les rêves sources.')).not.toBeNull();
    expect(screen.getByText('Notes vocales du matin')).not.toBeNull();
    expect(screen.getByText('Parle une note locale du matin. Rien n’est envoyé.')).not.toBeNull();
    expect(screen.getByLabelText('Notes vocales du matin. Parle une note locale du matin. Rien n’est envoyé.')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le profil' }));
    fireEvent.click(screen.getByTestId('lucid-journal-capture'));
    fireEvent.click(screen.getByTestId('lucid-journal-signs'));
    fireEvent.click(screen.getByTestId('lucid-journal-atlas'));
    fireEvent.click(screen.getByTestId('lucid-journal-voice'));
    fireEvent.click(screen.getByTestId(`lucid-journal-dream-${mockDreams[0].id}`));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/lucid/(tabs)/settings');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/recording');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/lucid/dream-signs');
    expect(mockPush).toHaveBeenNthCalledWith(4, '/lucid/dream-atlas');
    expect(mockPush).toHaveBeenNthCalledWith(5, '/lucid/morning-voice');
    expect(mockPush).toHaveBeenNthCalledWith(6, `/journal/${mockDreams[0].id}`);
  });

  it('searches accent-insensitively without duplicating journal state', () => {
    render(<LucidJournalScreen />);

    fireEvent.change(screen.getByTestId('lucid-journal-search'), { target: { value: 'foret' } });

    expect(screen.getByText('La forêt bleue')).not.toBeNull();
    expect(screen.queryByText('Train de nuit')).toBeNull();
    expect(screen.getByText('1 rêve')).not.toBeNull();
  });
});
