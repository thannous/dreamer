/* @jest-environment jsdom */

import React from 'react';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { LucidDreamSignCategory } from '@/lib/lucid/dreamSigns';

type LucidAtlasTestCategory = LucidDreamSignCategory | null;

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockCanGoBack = false;
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
let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'fr';
let mockDreamSignCandidates: {
  id: string;
  label: string;
  category: LucidAtlasTestCategory;
  distinctDreamCount: number;
  sourceDreamIds: string[];
  evidence: [];
}[] = [
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
const defaultAtlasState = {
  snapshot: {
    version: 1,
    nodes: [
      {
        id: 'sign:miroir',
        label: 'Miroir',
        category: 'object' as LucidAtlasTestCategory,
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        lastAppearanceAt: mockNow + 1_000,
        hidden: false,
      },
      {
        id: 'sign:marie',
        label: 'Marie',
        category: 'person' as LucidAtlasTestCategory,
        distinctDreamCount: 2,
        sourceDreamIds: [String(mockNow), String(mockNow + 1_000)],
        lastAppearanceAt: mockNow,
        hidden: true,
      },
    ] as {
      id: string;
      label: string;
      category: LucidAtlasTestCategory;
      distinctDreamCount: number;
      sourceDreamIds: string[];
      lastAppearanceAt: number;
      hidden: boolean;
    }[],
    preferences: { version: 1, renamed: {}, hidden: ['sign:marie'], merges: {}, deleted: [] },
  },
  list: [],
  isLoading: false,
  isMutating: false,
  error: null as string | null,
};
let mockAtlasState = defaultAtlasState;

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => mockCanGoBack,
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => {
  const actual = jest.requireActual('../react-native-stub');
  return {
    ...actual,
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
    Pressable: ({
      children,
      onPress,
      disabled,
      testID,
      accessibilityLabel,
      accessibilityState,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean; expanded?: boolean };
    }) => (
      <button
        aria-expanded={accessibilityState?.expanded}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
  };
});

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: mockLocale, chrome: { common: { loading: 'Chargement…' } } },
    state: { dreamSignDecisions: [{ id: 'sign:miroir', decision: 'confirmed' }, { id: 'sign:marie', decision: 'confirmed' }] },
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

const mockUseLucidDreamAtlas = jest.fn((_options: { signs: unknown; dreams?: unknown }) => ({
  ...mockAtlasState,
  refresh: mockRefresh,
  renameNode: mockRename,
  hideNode: mockHide,
  unhideNode: mockUnhide,
  mergeNodes: mockMerge,
  deleteNode: mockDelete,
  clearPreferences: jest.fn(),
}));

jest.mock('@/hooks/useLucidDreamAtlas', () => ({
  useLucidDreamAtlas: (options: { signs: unknown; dreams?: unknown }) => mockUseLucidDreamAtlas(options),
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
    mockCanGoBack = false;
    mockReduceMotion = false;
    mockLocale = 'fr';
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
      ...defaultAtlasState,
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

  it('keeps the atlas local by default and shares only organization with optional sync', () => {
    const privacyCopy = {
      fr: 'Cet atlas reste local par défaut. Le texte des rêves reste sur cet appareil. Avec la sync optionnelle, seule l’organisation de l’atlas est partagée.',
      en: 'This atlas stays on this device by default. Dream text remains local. Optional sync shares only atlas organization.',
      es: 'Este atlas permanece local de forma predeterminada. El texto de los sueños se queda en este dispositivo. Con la sincronización opcional, solo se comparte la organización del atlas.',
      de: 'Dieser Atlas bleibt standardmäßig lokal. Traumtext bleibt auf diesem Gerät. Bei optionaler Synchronisierung wird nur die Atlas-Organisation geteilt.',
      it: 'Questo atlante resta locale per impostazione predefinita. Il testo dei sogni resta su questo dispositivo. Con la sync opzionale si condivide solo l’organizzazione dell’atlante.',
    } as const;

    render(<LucidDreamAtlasScreen />);
    expect(mockUseLucidDreamAtlas).toHaveBeenCalledWith({
      signs: expect.any(Array),
      dreams: mockDreams,
    });
    expect(mockUseLucidDreamAtlas.mock.calls[0][0]).not.toHaveProperty('userScope');
    expect(screen.getByText(privacyCopy.fr)).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-map')).not.toBeNull();

    for (const locale of ['en', 'es', 'de', 'it'] as const) {
      cleanup();
      mockLocale = locale;
      render(<LucidDreamAtlasScreen />);
      expect(screen.getByText(privacyCopy[locale])).not.toBeNull();
      expect(screen.queryByText(/premium/i)).toBeNull();
      expect(screen.getByTestId('lucid-dream-atlas-map')).not.toBeNull();
    }
  });

  it('lists visible and hidden signs with sources and opens the journal', () => {
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByText('Atlas des rêves')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:miroir')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:marie')).not.toBeNull();
    expect(screen.getByText('Masqué')).not.toBeNull();
    expect(screen.getByText('Carte des signes visibles')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-map-node-sign:miroir')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-atlas-map-node-sign:marie')).toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-summary-sign:miroir').textContent).toMatch(
      /Miroir\. Objet\. Visible\. Vu dans 2 rêves/
    );
    expect(screen.getByTestId('lucid-dream-atlas-node-meta-sign:miroir').textContent).toMatch(
      /^Objet · Dernière apparition:/
    );
    fireEvent.click(screen.getByTestId(`lucid-dream-atlas-source-${mockNow}`));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${mockNow}`);
  });

  it('localizes every atlas category in meta and summaries without leaking English keys', () => {
    const lastSeen = {
      en: 'Last appearance',
      fr: 'Dernière apparition',
      es: 'Última aparición',
      de: 'Letztes Erscheinen',
      it: 'Ultima comparsa',
    } as const;
    const visibility = {
      en: { visible: 'Visible', hidden: 'Hidden' },
      fr: { visible: 'Visible', hidden: 'Masqué' },
      es: { visible: 'Visible', hidden: 'Oculta' },
      de: { visible: 'Sichtbar', hidden: 'Ausgeblendet' },
      it: { visible: 'Visibile', hidden: 'Nascosto' },
    } as const;
    const frequency = {
      en: 'Seen in 1 dream',
      fr: 'Vu dans 1 rêve',
      es: 'Aparece en 1 sueño',
      de: 'In 1 Traum gesehen',
      it: 'Presente in 1 sogno',
    } as const;
    const categories = {
      en: { person: 'Person', place: 'Place', object: 'Object', emotion: 'Emotion', anomaly: 'Anomaly', action: 'Action' },
      fr: { person: 'Personne', place: 'Lieu', object: 'Objet', emotion: 'Émotion', anomaly: 'Anomalie', action: 'Action' },
      es: { person: 'Persona', place: 'Lugar', object: 'Objeto', emotion: 'Emoción', anomaly: 'Anomalía', action: 'Acción' },
      de: { person: 'Person', place: 'Ort', object: 'Objekt', emotion: 'Emotion', anomaly: 'Anomalie', action: 'Handlung' },
      it: { person: 'Persona', place: 'Luogo', object: 'Oggetto', emotion: 'Emozione', anomaly: 'Anomalia', action: 'Azione' },
    } as const;
    const nodes = [
      { id: 'sign:marie', label: 'Marie', category: 'person' as const, hidden: true, offset: 0 },
      { id: 'sign:gare', label: 'Gare', category: 'place' as const, hidden: false, offset: 1 },
      { id: 'sign:miroir', label: 'Miroir', category: 'object' as const, hidden: false, offset: 2 },
      { id: 'sign:peur', label: 'Peur', category: 'emotion' as const, hidden: false, offset: 3 },
      { id: 'sign:dents', label: 'Dents', category: 'anomaly' as const, hidden: false, offset: 4 },
      { id: 'sign:courir', label: 'Courir', category: 'action' as const, hidden: false, offset: 5 },
      { id: 'sign:inconnu', label: 'Inconnu', category: null, hidden: false, offset: 6 },
    ];
    const rawKeys = ['person', 'place', 'object', 'emotion', 'anomaly', 'action'] as const;
    const formatLastSeen = (locale: keyof typeof lastSeen, offset: number) =>
      `${lastSeen[locale]}: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(mockNow + offset))}`;

    mockDreamSignCandidates = nodes.map((node) => ({
      id: node.id,
      label: node.label,
      category: node.category,
      distinctDreamCount: 1,
      sourceDreamIds: [String(mockNow + node.offset)],
      evidence: [],
    }));
    mockAtlasState = {
      ...mockAtlasState,
      snapshot: {
        version: 1,
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.label,
          category: node.category,
          distinctDreamCount: 1,
          sourceDreamIds: [String(mockNow + node.offset)],
          lastAppearanceAt: mockNow + node.offset,
          hidden: node.hidden,
        })),
        preferences: { version: 1, renamed: {}, hidden: ['sign:marie'], merges: {}, deleted: [] },
      },
    };

    for (const locale of ['en', 'fr', 'es', 'de', 'it'] as const) {
      cleanup();
      mockLocale = locale;
      render(<LucidDreamAtlasScreen />);

      for (const node of nodes) {
        const localizedCategory = node.category ? categories[locale][node.category] : '—';
        const last = formatLastSeen(locale, node.offset);
        const vis = node.hidden ? visibility[locale].hidden : visibility[locale].visible;
        expect(screen.getByTestId(`lucid-dream-atlas-node-meta-${node.id}`).textContent).toBe(
          `${localizedCategory} · ${last}`
        );
        expect(screen.getByTestId(`lucid-dream-atlas-node-summary-${node.id}`).textContent).toBe(
          `${node.label}. ${localizedCategory}. ${vis}. ${frequency[locale]}. ${last}.`
        );
        if (!node.hidden) {
          expect(screen.getByTestId(`lucid-dream-atlas-map-node-${node.id}`).getAttribute('aria-label')).toBe(
            `${node.label}. ${localizedCategory}. ${visibility[locale].visible}. ${frequency[locale]}. ${last}.`
          );
        }
      }

      const body = document.body.textContent ?? '';
      for (const key of rawKeys) {
        expect(body).not.toMatch(new RegExp(`(^|[^A-Za-z])${key}([^A-Za-z]|$)`));
      }
    }
  });

  it('hides the map when Reduce Motion is on and keeps the full sign list', () => {
    mockReduceMotion = true;
    render(<LucidDreamAtlasScreen />);
    expect(screen.queryByText('Carte des signes visibles')).toBeNull();
    expect(screen.queryByTestId('lucid-dream-atlas-map')).toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:miroir')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:marie')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-summary-sign:marie').textContent).toMatch(
      /Marie\. Personne\. Masqué\. Vu dans 2 rêves/
    );
    expect(screen.getByTestId('lucid-dream-atlas-node-meta-sign:marie').textContent).toMatch(
      /^Personne · Dernière apparition:/
    );
  });

  it('lets graph nodes select a sign, announce selection, and show shared-dream relations', () => {
    mockAtlasState = {
      ...mockAtlasState,
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
            hidden: false,
          },
        ],
        preferences: { version: 1, renamed: {}, hidden: [], merges: {}, deleted: [] },
      },
    };
    render(<LucidDreamAtlasScreen />);
    const miroirNode = screen.getByTestId('lucid-dream-atlas-map-node-sign:miroir');
    const marieNode = screen.getByTestId('lucid-dream-atlas-map-node-sign:marie');
    expect(miroirNode.getAttribute('aria-selected')).toBe('true');
    expect(marieNode.getAttribute('aria-selected')).toBe('false');
    expect(miroirNode.getAttribute('aria-label') ?? '').toMatch(/Miroir\. Objet\. Visible\. Vu dans 2 rêves/);
    expect(miroirNode.getAttribute('aria-label') ?? '').toMatch(/Dernière apparition/);
    expect(screen.getByTestId('lucid-dream-atlas-detail-sign:miroir')).not.toBeNull();
    expect(screen.getByText('Miroir · Marie : 2 rêves en commun')).not.toBeNull();
    fireEvent.click(marieNode);
    expect(screen.getByTestId('lucid-dream-atlas-map-node-sign:marie').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('lucid-dream-atlas-map-node-sign:miroir').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('lucid-dream-atlas-detail-sign:marie')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-atlas-detail-sign:miroir')).toBeNull();
  });

  it('caps visible graph nodes without truncating the structured list', () => {
    mockAtlasState = {
      ...mockAtlasState,
      snapshot: {
        version: 1,
        nodes: Array.from({ length: 13 }, (_, index) => ({
          id: `sign:n${index}`,
          label: `Signe ${index}`,
          category: 'object',
          distinctDreamCount: 1,
          sourceDreamIds: [String(mockNow + index)],
          lastAppearanceAt: mockNow + index,
          hidden: false,
        })),
        preferences: { version: 1, renamed: {}, hidden: [], merges: {}, deleted: [] },
      },
    };
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByTestId('lucid-dream-atlas-map-node-sign:n0')).not.toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-map-node-sign:n11')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-atlas-map-node-sign:n12')).toBeNull();
    expect(screen.getByTestId('lucid-dream-atlas-node-sign:n12')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-atlas-map-relations')).toBeNull();
  });

  it('saves a rename, opens a pause, and rehearses the exact chosen source dream', async () => {
    render(<LucidDreamAtlasScreen />);
    expect(screen.getByRole('button', { name: 'Enregistrer le nom' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByTestId('lucid-dream-atlas-rename'), { target: { value: 'Mon miroir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));
    await waitFor(() => expect(mockRename).toHaveBeenCalledWith('sign:miroir', 'Mon miroir'));
    fireEvent.click(screen.getByRole('button', { name: 'Pause attentive' }));
    expect(mockPush).toHaveBeenCalledWith(
      `/lucid/reality-check?signId=${encodeURIComponent('sign:miroir')}`
    );
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

  it('replaces to journal when Close has no history', () => {
    render(<LucidDreamAtlasScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/journal');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('uses native back when Close has history', () => {
    mockCanGoBack = true;
    render(<LucidDreamAtlasScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
