/* @jest-environment jsdom */

import React from 'react';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockRename = jest.fn().mockResolvedValue(undefined);
const mockHide = jest.fn().mockResolvedValue(undefined);
const mockUnhide = jest.fn().mockResolvedValue(undefined);
const mockMerge = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);

const mockNow = 1_787_911_200_000;

const mockDreams = [
  { id: mockNow, title: 'Le couloir aux miroirs', transcript: 'Un miroir tremblait.' },
  { id: mockNow + 1_000, title: 'La chambre blanche', transcript: 'Le même miroir revenait.' },
];

let mockReduceMotion = false;
let mockDreamSignCandidates = [
  {
    id: 'sign:miroir',
    label: 'Miroir',
    category: 'object',
    distinctDreamCount: 2,
    sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
    evidence: [],
  },
  {
    id: 'sign:marie',
    label: 'Marie',
    category: 'person',
    distinctDreamCount: 2,
    sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
    evidence: [],
  },
];
let mockAtlasState = {
  snapshot: {
    version: 1,
    nodes: [
      {
        id: 'sign:miroir',
        label: 'Miroir',
        category: 'object',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        lastAppearanceAt: mockNow + 1_000,
        hidden: false,
      },
      {
        id: 'sign:marie',
        label: 'Marie',
        category: 'person',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        lastAppearanceAt: mockNow,
        hidden: true,
      },
    ],
    preferences: { version: 1, renamed: {}, hidden: ['sign:marie'], merges: {}, deleted: [] },
  },
  list: [],
  isLoading: false,
  isMutating: false,
  error: null as string | null,
};

jest.mock('expo-router', () => ({ router: { back: mockBack, push: mockPush } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: 'fr', chrome: { common: { loading: 'Chargement…' } } },
    state: { dreamSignDecisions: [{ id: 'sign:miroir', decision: 'confirmed' }, { id: 'sign:marie', decision: 'confirmed' }] },
    userScope: 'guest',
    dreamSignCandidates: mockDreamSignCandidates,
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

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockReduceMotion,
}));

jest.mock('@/hooks/useLucidDreamAtlas', () => ({
  useLucidDreamAtlas: () => ({
    ...mockAtlasState,
    refresh: mockRefresh,
    renameNode: mockRename,
    hideNode: mockHide,
    unhideNode: mockUnhide,
    mergeNodes: mockMerge,
    deleteNode: mockDelete,
    clearPreferences: jest.fn(),
  }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, testID, title, trailing }: any) => (
    <main data-testid={testID}><h1>{title}</h1>{trailing}{children}</main>
  ),
  LucidButton: ({ disabled, label, loading, onPress }: any) => (
    <button disabled={disabled || loading} onClick={onPress}>{label}</button>
  ),
  LucidCard: ({ children, testID }: any) => <section data-testid={testID}>{children}</section>,
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidPill: ({ label }: any) => <span>{label}</span>,
  LucidSectionHeader: ({ action, title }: any) => <div><h2>{title}</h2>{action}</div>,
}));

const { default: LucidDreamAtlasScreen } = require('@/app/lucid/dream-atlas');

describe('Lucid dream atlas screen', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    mockDreamSignCandidates = [
      {
        id: 'sign:miroir',
        label: 'Miroir',
        category: 'object',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        evidence: [],
      },
      {
        id: 'sign:marie',
        label: 'Marie',
        category: 'person',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        evidence: [],
      },
    ];
    mockAtlasState = {
      ...mockAtlasState,
      isLoading: false,
      error: null,
    };
    jest.spyOn(Alert, 'alert').mockImplementation(((_title, _message, buttons) => {
      buttons?.find((button) => button.style !== 'cancel')?.onPress?.();
    }) as typeof Alert.alert);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('lists visible and hidden signs with sources and opens the journal', () => {
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByText('Atlas des rêves')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:miroir')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:marie')).not.toBeNull();
    expect(screen.getByText('Masqué')).not.toBeNull();
    expect(screen.getByText('Carte décorative des signes visibles')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-summary-sign:miroir').textContent).toMatch(
      /Miroir\. Visible\. Vu dans 2 rêves/
    );
    fireEvent.click(screen.getByTestId(`lucid-dream-atlas-source-${mockNow}`));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${mockNow}`);
  });

  it('hides the decorative map when Reduce Motion is on', () => {
    mockReduceMotion = true;
    render(<LucidDreamAtlasScreen />);
    expect(screen.queryByText('Carte décorative des signes visibles')).toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:miroir')).not.toBeNull();
  });

  it('saves a rename, opens a pause, and rehearses the exact chosen source dream', async () => {
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByRole('button', { name: 'Enregistrer le nom' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByTestId('lucid-dream-atlas-rename'), { target: { value: 'Mon miroir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));
    await waitFor(() => expect(mockRename).toHaveBeenCalledWith('sign:miroir', 'Mon miroir'));
    fireEvent.click(screen.getByRole('button', { name: 'Pause attentive' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/reality-check');
    expect(screen.queryByRole('button', { name: 'Répétition ciblée' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Répéter cette scène : Le couloir aux miroirs' }));
    expect(mockPush).toHaveBeenCalledWith(
      `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(String(mockNow))}&signId=${encodeURIComponent('sign:miroir')}`
    );
    fireEvent.click(screen.getByRole('button', { name: 'Répéter cette scène : La chambre blanche' }));
    expect(mockPush).toHaveBeenCalledWith(
      `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(String(mockNow + 1_000))}&signId=${encodeURIComponent('sign:miroir')}`
    );
    fireEvent.change(screen.getByTestId('lucid-dream-atlas-rename'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Enregistrer le nom' })).toHaveProperty('disabled', true);
  });

  it('confirms merge and delete without premium gating', async () => {
    render(<LucidDreamAtlasScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Marie' }));
    await waitFor(() => expect(mockMerge).toHaveBeenCalledWith('sign:miroir', 'sign:marie'));
    fireEvent.click(screen.getByTestId('lucid-dream-atlas-node-sign:miroir'));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer de l’atlas' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it('rehearses a merged source with the confirmed sign that actually carries it', () => {
    mockDreamSignCandidates = [
      {
        id: 'sign:miroir',
        label: 'Miroir',
        category: 'object',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        evidence: [],
      },
      {
        id: 'sign:marie',
        label: 'Marie',
        category: 'person',
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow + 2_000), String(mockNow + 3_000)],
        evidence: [],
      },
    ];
    mockAtlasState = {
      ...mockAtlasState,
      snapshot: {
        version: 1,
        nodes: [
          {
            id: 'sign:marie',
            label: 'Marie',
            category: 'person',
            distinctDreamCount: 4,
            sourceDreamIds: [String(mockNow), String(mockNow + 1_000), String(mockNow + 2_000), String(mockNow + 3_000)],
            lastAppearanceAt: mockNow + 3_000,
            hidden: false,
          },
        ],
        preferences: {
          version: 1,
          renamed: {},
          hidden: [],
          merges: { 'sign:miroir': 'sign:marie' },
          deleted: [],
        },
      },
    };
    render(<LucidDreamAtlasScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Répéter cette scène : Le couloir aux miroirs' }));
    expect(mockPush).toHaveBeenCalledWith(
      `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(String(mockNow))}&signId=${encodeURIComponent('sign:miroir')}`
    );
    fireEvent.click(screen.getByRole('button', { name: 'Répéter cette scène : La chambre blanche' }));
    expect(mockPush).toHaveBeenCalledWith(
      `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(String(mockNow + 1_000))}&signId=${encodeURIComponent('sign:miroir')}`
    );
    expect(screen.queryByRole('button', { name: /Répéter cette scène : Rêve enregistré/ })).toBeNull();
  });

  it('shows an empty CTA to dream signs', () => {
    mockAtlasState = { ...mockAtlasState, snapshot: { version: 1, nodes: [], preferences: { version: 1, renamed: {}, hidden: [], merges: {}, deleted: [] } } };
    render(<LucidDreamAtlasScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Examiner les signes' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/dream-signs');
  });

  it('retries after an atlas load error', () => {
    mockAtlasState = { ...mockAtlasState, error: 'persistence_failed' };
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByText(/n’a pas pu être enregistré/)).not.toBeNull();
    expect(screen.queryByText('persistence_failed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockRefresh).toHaveBeenCalled();
  });
});
