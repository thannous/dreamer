/* @jest-environment jsdom */

import React from 'react';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  createLucidMorningVoiceNote,
  type LucidMorningVoiceCaptureState,
  type LucidMorningVoiceErrorReason,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';

const NOW = Date.UTC(2026, 7, 28, 8, 30, 0);
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockStart = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockStop = jest.fn();
const mockReset = jest.fn();
const mockRefresh = jest.fn();
const mockRename = jest.fn();
const mockTranscript = jest.fn();
const mockLink = jest.fn();
const mockDelete = jest.fn();
const mockPlay = jest.fn();
const mockPausePlayback = jest.fn();
const mockReplay = jest.fn();
const mockShare = jest.fn();

let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'fr';
let mockAutoStart: string | string[] | undefined;
let mockExperiments: {
  id: string;
  occurredAt: number;
  captureMode?: 'speak' | 'write' | 'nothing_for_now';
  recallText?: string;
}[] = [
  { id: 'exp_morning_link01', occurredAt: NOW, captureMode: 'write', recallText: 'Le même couloir' },
];
let mockRecorder = {
  capture: { phase: 'idle', noteId: null, errorReason: null } as LucidMorningVoiceCaptureState,
  permission: 'unknown' as 'unknown' | 'granted' | 'denied',
  durationMillis: 0,
  note: null as LucidMorningVoiceNote | null,
  sourceUri: null as string | null,
  errorReason: null as LucidMorningVoiceErrorReason | null,
};
let mockNotes: LucidMorningVoiceNote[] = [];
let mockNotesError: LucidMorningVoiceErrorReason | null = null;
let mockNotesLoading = false;
let mockPlayer = {
  isLoaded: true,
  isPlaying: false,
  isBuffering: false,
  currentTimeSeconds: 0,
  durationSeconds: 1.8,
  error: null as 'invalid_uri' | 'invalid_metadata' | 'playback_failed' | null,
};

function note(overrides: Partial<LucidMorningVoiceNote> = {}): LucidMorningVoiceNote {
  return createLucidMorningVoiceNote({
    id: 'mvn_morning_note01',
    userScope: 'guest',
    experimentId: null,
    status: 'ready',
    title: 'Couloir du matin',
    transcript: null,
    durationMs: 1_800,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_morning_note01.m4a',
    createdAt: NOW,
    updatedAt: NOW,
    recoverable: false,
    now: NOW,
    ...overrides,
  });
}

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ autoStart: mockAutoStart }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: mockLocale, chrome: { common: { loading: 'Chargement…', retry: 'Réessayer' } } },
    state: { experiments: mockExperiments },
    userScope: 'guest',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    danger: '#b42318',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
    surfaceRaised: '#f5f5f5',
    borderInteractive: '#777',
  }),
}));

jest.mock('@/hooks/useLucidMorningVoiceRecorder', () => ({
  useLucidMorningVoiceRecorder: () => ({
    ...mockRecorder,
    start: mockStart,
    pause: mockPause,
    resume: mockResume,
    stop: mockStop,
    reset: mockReset,
  }),
}));

jest.mock('@/hooks/useLucidMorningVoiceNotes', () => ({
  useLucidMorningVoiceNotes: () => ({
    notes: mockNotes,
    isLoading: mockNotesLoading,
    isMutating: false,
    error: mockNotesError,
    refresh: mockRefresh,
    renameNote: mockRename,
    updateTranscript: mockTranscript,
    linkToExperiment: mockLink,
    deleteNote: mockDelete,
    getByExperimentId: jest.fn(),
  }),
}));

jest.mock('@/services/lucidMorningVoiceNoteExport', () => ({
  shareLucidMorningVoiceNote: (...args: unknown[]) => mockShare(...args),
}));

jest.mock('@/hooks/useLucidMorningVoicePlayer', () => ({
  useLucidMorningVoicePlayer: () => ({
    ...mockPlayer,
    play: mockPlay,
    pause: mockPausePlayback,
    replay: mockReplay,
    stop: jest.fn(),
  }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, testID, title, trailing }: any) => (
    <main data-testid={testID}>
      <h1>{title}</h1>
      {trailing}
      {children}
    </main>
  ),
  LucidButton: ({ accessibilityHint, disabled, disabledReason, label, loading, onPress, testID, variant }: any) => (
    <button
      aria-label={label}
      data-hint={accessibilityHint}
      data-testid={testID}
      data-variant={variant}
      disabled={disabled || loading}
      onClick={onPress}
    >
      {label}
      {disabled && disabledReason ? <span>{disabledReason}</span> : null}
    </button>
  ),
  LucidCard: ({ children, testID }: any) => <section data-testid={testID}>{children}</section>,
  LucidIconAction: ({ label, onPress }: any) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidPill: ({ label }: any) => <span>{label}</span>,
  LucidSectionHeader: ({ action, title }: any) => (
    <div>
      <h2>{title}</h2>
      {action}
    </div>
  ),
}));

const { default: LucidMorningVoiceScreen } = require('@/app/lucid/morning-voice');

describe('Lucid morning voice notes screen', () => {
  beforeEach(() => {
    mockLocale = 'fr';
    mockAutoStart = undefined;
    mockExperiments = [
      { id: 'exp_morning_link01', occurredAt: NOW, captureMode: 'write', recallText: 'Le même couloir' },
    ];
    mockRecorder = {
      capture: { phase: 'idle', noteId: null, errorReason: null },
      permission: 'unknown',
      durationMillis: 0,
      note: null,
      sourceUri: null,
      errorReason: null,
    };
    mockNotes = [];
    mockNotesError = null;
    mockNotesLoading = false;
    mockPlayer = {
      isLoaded: true,
      isPlaying: false,
      isBuffering: false,
      currentTimeSeconds: 0,
      durationSeconds: 1.8,
      error: null,
    };
    mockStart.mockReset().mockResolvedValue(undefined);
    mockPause.mockReset().mockResolvedValue(undefined);
    mockResume.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset().mockResolvedValue(undefined);
    mockReset.mockReset();
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockRename.mockReset().mockResolvedValue(undefined);
    mockTranscript.mockReset().mockResolvedValue(undefined);
    mockLink.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
    mockPlay.mockReset().mockResolvedValue(undefined);
    mockPausePlayback.mockReset().mockResolvedValue(undefined);
    mockReplay.mockReset().mockResolvedValue(undefined);
    mockShare.mockReset().mockResolvedValue({ uri: note().uri, shared: true });
    jest.spyOn(Alert, 'alert').mockImplementation(((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    }) as typeof Alert.alert);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('explains the microphone before Speak and starts recording on the first tap', () => {
    render(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice')).not.toBeNull();
    expect(screen.getByText(/premier tap sur Parler/i)).not.toBeNull();
    expect(screen.getByText(/restent sur cet appareil/i)).not.toBeNull();
    expect(screen.getByTestId('lucid-morning-voice-speak').getAttribute('data-hint')).toMatch(/micro/i);
    expect(mockStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('lucid-morning-voice-speak'));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it('does not auto-start on direct access', () => {
    const { rerender } = render(<LucidMorningVoiceScreen />);
    rerender(<LucidMorningVoiceScreen />);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('auto-starts only once when opened with autoStart=1, even after rerender', () => {
    mockAutoStart = '1';
    const { rerender } = render(<LucidMorningVoiceScreen />);
    expect(mockStart).toHaveBeenCalledTimes(1);
    rerender(<LucidMorningVoiceScreen />);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('shows duration, pause, resume, stop and a recoverable interrupted draft without inventing completion', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'recording', noteId: 'mvn_morning_note01', errorReason: null },
      durationMillis: 4_000,
    };
    const { rerender } = render(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice-duration').textContent).toBe('Durée: 0:04');
    expect(screen.getByTestId('lucid-morning-voice-status').textContent).toMatch(/cet appareil/i);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-pause'));
    expect(mockPause).toHaveBeenCalledTimes(1);

    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'paused', noteId: 'mvn_morning_note01', errorReason: null },
      durationMillis: 4_000,
    };
    rerender(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-resume'));
    fireEvent.click(screen.getByTestId('lucid-morning-voice-stop'));
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);

    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'interrupted', noteId: 'mvn_morning_note01', errorReason: 'interrupted' },
      errorReason: 'interrupted',
      durationMillis: 4_000,
    };
    rerender(<LucidMorningVoiceScreen />);
    expect(screen.getAllByText(/brouillon récupérable/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/note terminée/i)).not.toBeNull();
    expect(screen.queryByText(/complétion/i)).not.toBeNull();
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();
  });

  it('plays, renames, edits an optional transcript, links an exact morning review and confirms delete', async () => {
    mockNotes = [note()];
    render(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-play-mvn_morning_note01'));
    fireEvent.click(screen.getByTestId('lucid-morning-voice-replay-mvn_morning_note01'));
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockReplay).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('lucid-morning-voice-rename-mvn_morning_note01'), {
      target: { value: 'Couloir bleu' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-voice-save-title-mvn_morning_note01'));
    await waitFor(() => expect(mockRename).toHaveBeenCalledWith('mvn_morning_note01', 'Couloir bleu'));

    fireEvent.change(screen.getByTestId('lucid-morning-voice-transcript-mvn_morning_note01'), {
      target: { value: 'Le même couloir revenait.' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-voice-save-transcript-mvn_morning_note01'));
    await waitFor(() =>
      expect(mockTranscript).toHaveBeenCalledWith('mvn_morning_note01', 'Le même couloir revenait.')
    );

    fireEvent.click(screen.getByTestId('lucid-morning-voice-link-mvn_morning_note01-exp_morning_link01'));
    await waitFor(() => expect(mockLink).toHaveBeenCalledWith('mvn_morning_note01', 'exp_morning_link01'));

    fireEvent.click(screen.getByTestId('lucid-morning-voice-delete-mvn_morning_note01'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('mvn_morning_note01'));
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('exposes Speak, Pause, Stop and duration to a screen reader during capture', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'recording', noteId: 'mvn_morning_note01', errorReason: null },
      durationMillis: 4_000,
    };
    const { rerender } = render(<LucidMorningVoiceScreen />);
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();
    expect(screen.getByTestId('lucid-morning-voice-pause').getAttribute('aria-label')).toBe('Pause');
    expect(screen.getByTestId('lucid-morning-voice-pause').getAttribute('data-hint')).toMatch(/brouillon reste/i);
    expect(screen.getByTestId('lucid-morning-voice-stop').getAttribute('aria-label')).toBe('Arrêter');
    expect(screen.getByTestId('lucid-morning-voice-stop').getAttribute('data-hint')).toMatch(/rien n/i);
    expect(screen.getByTestId('lucid-morning-voice-status').textContent).toMatch(/cet appareil/i);
    expect(screen.getByTestId('lucid-morning-voice-duration').textContent).toBe('Durée: 0:04');

    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'paused', noteId: 'mvn_morning_note01', errorReason: null },
      durationMillis: 4_000,
    };
    rerender(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice-resume').getAttribute('aria-label')).toBe('Reprendre');
    expect(screen.getByTestId('lucid-morning-voice-resume').getAttribute('data-hint')).toMatch(/enregistrement local/i);
  });

  it('keeps a recoverable interrupted draft after an incoming-call style interruption', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'interrupted', noteId: 'mvn_morning_note01', errorReason: 'interrupted' },
      errorReason: 'interrupted',
      durationMillis: 4_000,
      sourceUri: note().uri,
    };
    render(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice-status').textContent).toMatch(/brouillon récupérable/i);
    expect(screen.getAllByText(/brouillon récupérable/i).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();
    expect(screen.queryByText(/note terminée/i)).not.toBeNull();
  });

  it('surfaces out-of-storage without inventing completion and offers a local retry', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'stopping', noteId: 'mvn_morning_note01', errorReason: 'storage_full' },
      errorReason: 'storage_full',
      durationMillis: 4_000,
      sourceUri: note().uri,
    };
    render(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice-error').textContent).toMatch(/plus assez d’espace/i);
    expect(screen.getByTestId('lucid-morning-voice-retry-save').getAttribute('aria-label')).toBe(
      'Réessayer l’enregistrement'
    );
    expect(screen.getByTestId('lucid-morning-voice-retry-save').getAttribute('data-hint')).toMatch(/rien n/i);
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-morning-voice-retry-save'));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('surfaces typed permission, storage, interruption and playback errors without blocking a missing transcript', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'error', noteId: null, errorReason: 'permission_denied' },
      errorReason: 'permission_denied',
    };
    mockNotes = [note({ transcript: null })];
    mockPlayer = { ...mockPlayer, isLoaded: false, error: 'playback_failed' };
    const { rerender } = render(<LucidMorningVoiceScreen />);
    expect(screen.getByText(/accès au micro a été refusé/i)).not.toBeNull();
    expect(screen.getAllByText(/lecture est indisponible/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('lucid-morning-voice-save-transcript-mvn_morning_note01')).toHaveProperty(
      'disabled',
      true
    );

    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'error', noteId: null, errorReason: 'storage_full' },
      errorReason: 'storage_full',
    };
    rerender(<LucidMorningVoiceScreen />);
    expect(screen.getByText(/plus assez d’espace/i)).not.toBeNull();
  });

  it('does not share on render and only shares the exact note after an explicit tap', async () => {
    const current = note();
    mockNotes = [current];
    render(<LucidMorningVoiceScreen />);
    expect(screen.getByTestId('lucid-morning-voice-share-mvn_morning_note01').getAttribute('data-hint')).toMatch(
      /feuille de partage/i
    );
    expect(mockShare).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('lucid-morning-voice-share-mvn_morning_note01'));
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    expect(mockShare).toHaveBeenCalledWith(current);
    expect(screen.getByTestId('lucid-morning-voice-note-mvn_morning_note01')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-morning-voice-play-mvn_morning_note01'));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('keeps the note visible when sharing is unavailable or fails', async () => {
    mockNotes = [note()];
    mockShare.mockResolvedValueOnce({ uri: note().uri, shared: false });
    render(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-share-mvn_morning_note01'));
    await waitFor(() =>
      expect(screen.getByTestId('lucid-morning-voice-share-error-mvn_morning_note01').textContent).toMatch(
        /partage est indisponible/i
      )
    );
    expect(screen.queryByText(/plus assez d’espace/i)).toBeNull();
    expect(screen.getByTestId('lucid-morning-voice-note-mvn_morning_note01')).not.toBeNull();

    cleanup();
    mockShare.mockRejectedValueOnce(new Error('native share failed'));
    render(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-share-mvn_morning_note01'));
    await waitFor(() =>
      expect(screen.getByTestId('lucid-morning-voice-share-error-mvn_morning_note01').textContent).toMatch(
        /n’a pas pu être partagé/i
      )
    );
    expect(screen.getByTestId('lucid-morning-voice-rename-mvn_morning_note01')).not.toBeNull();
    expect(screen.getByTestId('lucid-morning-voice-delete-mvn_morning_note01')).not.toBeNull();
  });

  it('retries a failed persist from stopping and interrupted without inventing completion', () => {
    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'stopping', noteId: 'mvn_morning_note01', errorReason: 'storage_full' },
      errorReason: 'storage_full',
      durationMillis: 4_000,
    };
    const { rerender } = render(<LucidMorningVoiceScreen />);
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();
    expect(screen.queryByTestId('lucid-morning-voice-stop')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-morning-voice-retry-save'));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
    expect(screen.queryByText(/note terminée/i)).not.toBeNull();
    expect(screen.queryByTestId('lucid-morning-voice-speak')).toBeNull();

    mockRecorder = {
      ...mockRecorder,
      capture: { phase: 'interrupted', noteId: 'mvn_morning_note01', errorReason: 'persistence_failed' },
      errorReason: 'persistence_failed',
      durationMillis: 4_000,
    };
    rerender(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByTestId('lucid-morning-voice-retry-save'));
    expect(mockStop).toHaveBeenCalledTimes(2);
    expect(mockReset).not.toHaveBeenCalled();
    expect(screen.getAllByText(/brouillon récupérable/i).length).toBeGreaterThan(0);
  });

  it('lists loaded notes newest first', () => {
    const older = note({ id: 'mvn_morning_note01', createdAt: NOW, title: 'Ancienne note' });
    const newer = note({
      id: 'mvn_morning_note02',
      createdAt: NOW + 1_000,
      updatedAt: NOW + 1_000,
      title: 'Note du réveil',
      uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_morning_note02.m4a',
    });
    mockNotes = [older, newer];
    render(<LucidMorningVoiceScreen />);
    const noteCards = screen.getAllByTestId(/lucid-morning-voice-note-/);
    expect(noteCards.map((node) => node.getAttribute('data-testid'))).toEqual([
      'lucid-morning-voice-note-mvn_morning_note02',
      'lucid-morning-voice-note-mvn_morning_note01',
    ]);
    expect(noteCards[0].textContent).toMatch(/Note du réveil/);
    expect(noteCards[1].textContent).toMatch(/Ancienne note/);
  });

  it('closes back to the journal and covers remaining locales without paywall copy', () => {
    render(<LucidMorningVoiceScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(mockBack).toHaveBeenCalled();

    for (const locale of ['en', 'es', 'de', 'it'] as const) {
      cleanup();
      mockLocale = locale;
      render(<LucidMorningVoiceScreen />);
      expect(screen.getByTestId('lucid-morning-voice')).not.toBeNull();
      expect(screen.queryByText(/premium/i)).toBeNull();
      expect(screen.getByTestId('lucid-morning-voice-speak')).not.toBeNull();
    }
  });
});
