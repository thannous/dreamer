/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockCanGoBack = false;
const mockSaveDecision = jest.fn().mockResolvedValue(undefined);

const mockDreams = [
  { id: 101, title: 'Le couloir aux miroirs', transcript: 'Un miroir tremblait.' },
  { id: 102, title: 'La chambre blanche', transcript: 'Le même miroir revenait.' },
];

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => mockCanGoBack,
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: 'fr', chrome: { common: { loading: 'Chargement…' } } },
    state: { dreamSignDecisions: [] },
    dreamSignCandidates: [{
      id: 'sign:miroir',
      label: 'Miroir',
      category: 'object',
      distinctDreamCount: 2,
      sourceDreamIds: ['101', '102'],
      evidence: [],
    }],
    saveDreamSignDecision: mockSaveDecision,
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
    surfaceRaised: '#f5f5f5',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, testID, title, trailing }: any) => (
    <main data-testid={testID}><h1>{title}</h1>{trailing}{children}</main>
  ),
  LucidButton: ({ label, loading, onPress }: any) => (
    <button disabled={loading} onClick={onPress}>{label}</button>
  ),
  LucidCard: ({ children, testID }: any) => <section data-testid={testID}>{children}</section>,
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidPill: ({ label }: any) => <span>{label}</span>,
  LucidSectionHeader: ({ action, title }: any) => <div><h2>{title}</h2>{action}</div>,
}));

const { default: LucidDreamSignsScreen } = require('@/app/lucid/dream-signs');

describe('Lucid dream signs', () => {
  beforeEach(() => {
    mockCanGoBack = false;
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('shows frequency and source dreams before an explicit confirmation', async () => {
    render(<LucidDreamSignsScreen />);

    expect(screen.getByText('Miroir')).not.toBeNull();
    expect(screen.getByText('Vu dans 2 rêves')).not.toBeNull();
    expect(screen.getByText('Le couloir aux miroirs')).not.toBeNull();
    expect(screen.getByText('La chambre blanche')).not.toBeNull();
    expect(screen.getByText(/Rien n’est envoyé pour analyse/)).not.toBeNull();

    fireEvent.change(screen.getByTestId('lucid-dream-sign-name-sign:miroir'), {
      target: { value: 'Mon miroir' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le signe' }));

    await waitFor(() => expect(mockSaveDecision).toHaveBeenCalledWith({
      id: 'sign:miroir',
      decision: 'confirmed',
      customLabel: 'Mon miroir',
      sourceDreamIds: ['101', '102'],
    }));
  });

  it('supports rejection and opens the exact source dream', async () => {
    render(<LucidDreamSignsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Ce n’est pas un signe' }));
    await waitFor(() => expect(mockSaveDecision).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sign:miroir', decision: 'rejected' })
    ));

    fireEvent.click(screen.getByTestId('lucid-dream-sign-source-101'));
    expect(mockPush).toHaveBeenCalledWith('/journal/101');
  });

  it('replaces to journal when Close has no history', () => {
    render(<LucidDreamSignsScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/journal');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('uses native back when Close has history', () => {
    mockCanGoBack = true;
    render(<LucidDreamSignsScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
