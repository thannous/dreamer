/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { LucidExperiment } from '@/lib/lucid/model';

const mockAlert = jest.fn();
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockResetLocalData = jest.fn();
const mockClearLucidMorningVoiceNotes = jest.fn();
const mockDeleteLucidTrainerCloudData = jest.fn();
const mockBuildNoctaliaHandoffLinks = jest.fn();
const mockShareLucidTrainerExport = jest.fn();
const mockTrackProductEvent = jest.fn();
const mockRequestAccountDeletion = jest.fn();
const mockFinalizeAccountDeletion = jest.fn();

let mockUser: { id: string } | null;
let mockUserScope: string;
let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it';
let mockState: ReturnType<typeof createState>;

function createState() {
  return {
    onboarding: { analyticsConsent: false },
    preferences: {
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
    },
    experiments: [
      {
        id: 'experiment-1',
        technique: 'mild' as const,
        result: 'lucid' as const,
        lucidityLevel: 4,
        recallLevel: 3,
        occurredAt: 1_700_000_000_000,
        notes: 'private notes must never leave Lucid Trainer',
      },
    ] as LucidExperiment[],
  };
}

jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  Linking: {
    canOpenURL: (...args: unknown[]) => mockCanOpenURL(...args),
    openURL: (...args: unknown[]) => mockOpenURL(...args),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    amber: '#9a6200',
    border: '#ccc',
    cyan: '#087f8c',
    surface: '#fff',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: mockState,
      content: getLucidContent(mockLocale),
      resetLocalData: mockResetLocalData,
      userScope: mockUserScope,
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidScreen: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  LucidButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));

jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

jest.mock('@/lib/lucid/deepLinks', () => ({
  buildNoctaliaHandoffLinks: (...args: unknown[]) =>
    mockBuildNoctaliaHandoffLinks(...args),
}));

jest.mock('@/services/accountDeletionService', () => ({
  requestAccountDeletion: (...args: unknown[]) => mockRequestAccountDeletion(...args),
  finalizeAccountDeletion: (...args: unknown[]) => mockFinalizeAccountDeletion(...args),
}));

jest.mock('@/services/lucidMorningVoiceNoteStorage', () => ({
  clearLucidMorningVoiceNotes: (...args: unknown[]) =>
    mockClearLucidMorningVoiceNotes(...args),
}));

jest.mock('@/services/lucidTrainerCloudData', () => ({
  deleteLucidTrainerCloudData: (...args: unknown[]) =>
    mockDeleteLucidTrainerCloudData(...args),
}));

jest.mock('@/services/lucidTrainerExport', () => ({
  shareLucidTrainerExport: (...args: unknown[]) => mockShareLucidTrainerExport(...args),
}));

const { default: LucidDataScreen } = require('@/app/lucid/data');

type AlertAction = { text?: string; onPress?: () => void };

function pressAlertAction(label: string, callIndex = 0): void {
  const actions = mockAlert.mock.calls[callIndex]?.[2] as AlertAction[] | undefined;
  const action = actions?.find((candidate) => candidate.text === label);
  if (!action?.onPress) throw new Error(`Missing alert action: ${label}`);
  act(() => action.onPress?.());
}

describe('Lucid Trainer data management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockUserScope = 'guest';
    mockLocale = 'en';
    mockState = createState();
    mockResetLocalData.mockResolvedValue(undefined);
    mockClearLucidMorningVoiceNotes.mockResolvedValue(undefined);
    mockDeleteLucidTrainerCloudData.mockResolvedValue(undefined);
    mockRequestAccountDeletion.mockResolvedValue({ deleted: true });
    mockFinalizeAccountDeletion.mockResolvedValue(undefined);
    mockCanOpenURL.mockResolvedValue(false);
    mockOpenURL.mockResolvedValue(undefined);
    mockBuildNoctaliaHandoffLinks.mockReturnValue({
      appUrl: 'noctalia://recording?minimal=1',
      fallbackUrl: 'https://dream.noctalia.app/?minimal=1',
    });
    mockTrackProductEvent.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('deletes the cloud generation before local data for a signed-in user even when sync is off', async () => {
    const order: string[] = [];
    mockUser = { id: 'user-1' };
    mockUserScope = 'user:user-1';
    mockDeleteLucidTrainerCloudData.mockImplementation(async () => {
      order.push('cloud');
    });
    mockClearLucidMorningVoiceNotes.mockImplementation(async () => {
      order.push('voice');
    });
    mockResetLocalData.mockImplementation(async () => {
      order.push('local');
    });

    render(<LucidDataScreen />);
    expect(mockState.preferences.cloudSyncEnabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() => expect(mockResetLocalData).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['cloud', 'voice', 'local']);
    expect(mockDeleteLucidTrainerCloudData).toHaveBeenCalledTimes(1);
    expect(mockClearLucidMorningVoiceNotes).toHaveBeenCalledWith('user:user-1');
  });

  it('preserves local data and reports an error when cloud deletion fails', async () => {
    mockUser = { id: 'user-1' };
    mockDeleteLucidTrainerCloudData.mockRejectedValue(new Error('cloud unavailable'));

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'This could not be loaded. Your saved training remains on this device.',
        'The operation could not be completed. Your local data was preserved.'
      )
    );
    expect(mockClearLucidMorningVoiceNotes).not.toHaveBeenCalled();
    expect(mockResetLocalData).not.toHaveBeenCalled();
  });

  it('deletes only local data for a guest', async () => {
    const order: string[] = [];
    mockClearLucidMorningVoiceNotes.mockImplementation(async () => {
      order.push('voice');
    });
    mockResetLocalData.mockImplementation(async () => {
      order.push('local');
    });

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() => expect(mockResetLocalData).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['voice', 'local']);
    expect(mockClearLucidMorningVoiceNotes).toHaveBeenCalledWith('guest');
    expect(mockDeleteLucidTrainerCloudData).not.toHaveBeenCalled();
  });

  it('keeps the Noctalia transfer disabled without explicit opt-in', () => {
    render(<LucidDataScreen />);

    const transfer = screen.getByRole('button', { name: 'Send latest summary' });
    expect((transfer as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(transfer);

    expect(mockBuildNoctaliaHandoffLinks).not.toHaveBeenCalled();
    expect(mockCanOpenURL).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('uses the secure web fallback after an explicitly consented transfer', async () => {
    mockState.preferences.noctaliaLinkEnabled = true;

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Send latest summary' }));
    pressAlertAction('Open Noctalia');

    await waitFor(() =>
      expect(mockOpenURL).toHaveBeenCalledWith('https://dream.noctalia.app/?minimal=1')
    );
    expect(mockBuildNoctaliaHandoffLinks).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        technique: 'mild',
        outcome: 'lucid',
        lucidity: 'medium',
        recall: 'medium',
      },
      { dataTransfer: true }
    );
    expect(mockCanOpenURL).toHaveBeenCalledWith('noctalia://recording?minimal=1');
    expect(mockAlert).toHaveBeenCalledWith(
      'Noctalia is not installed; the secure web fallback will open.'
    );
  });

  it('transfers an older fully reported result when a newer minimal capture is first', async () => {
    mockState.preferences.noctaliaLinkEnabled = true;
    mockState.experiments = [
      {
        id: 'older-ssild',
        technique: 'ssild' as const,
        result: 'pre_lucid' as const,
        lucidityLevel: 2,
        recallLevel: 2,
        occurredAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
      {
        id: 'minimal-new',
        technique: null,
        result: null,
        lucidityLevel: null,
        recallLevel: null,
        occurredAt: 1_700_000_300_000,
        updatedAt: 1_700_000_300_000,
        captureMode: 'write' as const,
        recallText: 'a fragment',
        cueOutcome: 'indeterminate' as const,
      },
      {
        id: 'newer-wbtb',
        technique: 'wbtb' as const,
        result: 'lucid' as const,
        lucidityLevel: 5,
        recallLevel: 4,
        occurredAt: 1_700_000_200_000,
        updatedAt: 1_700_000_200_000,
      },
    ] as LucidExperiment[];

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Send latest summary' }));
    pressAlertAction('Open Noctalia');

    await waitFor(() => expect(mockBuildNoctaliaHandoffLinks).toHaveBeenCalledTimes(1));
    expect(mockBuildNoctaliaHandoffLinks).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        technique: 'wbtb',
        outcome: 'lucid',
        lucidity: 'high',
        recall: 'medium',
      },
      { dataTransfer: true }
    );
  });

  it('keeps transfer disabled when no experiment has a complete reportable summary', () => {
    mockState.preferences.noctaliaLinkEnabled = true;
    mockState.experiments = [
      {
        id: 'minimal-only',
        technique: null,
        result: null,
        lucidityLevel: null,
        recallLevel: null,
        occurredAt: 1_700_000_000_000,
        captureMode: 'nothing_for_now' as const,
        cueOutcome: 'not_heard' as const,
      },
    ] as LucidExperiment[];

    render(<LucidDataScreen />);
    const transfer = screen.getByRole('button', { name: 'Send latest summary' });
    expect((transfer as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(transfer);
    expect(mockBuildNoctaliaHandoffLinks).not.toHaveBeenCalled();
  });

  it('clears local voice notes then resets before finalizing a confirmed account deletion', async () => {
    const order: string[] = [];
    mockUser = { id: 'user-1' };
    mockUserScope = 'user:user-1';
    mockRequestAccountDeletion.mockImplementation(async () => {
      order.push('request');
      return { deleted: true };
    });
    mockClearLucidMorningVoiceNotes.mockImplementation(async () => {
      order.push('voice');
    });
    mockResetLocalData.mockImplementation(async () => {
      order.push('local');
    });
    mockFinalizeAccountDeletion.mockImplementation(async () => {
      order.push('finalize');
    });

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete entire account' }));
    pressAlertAction('Delete entire account');

    await waitFor(() => expect(mockFinalizeAccountDeletion).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['request', 'voice', 'local', 'finalize']);
    expect(mockClearLucidMorningVoiceNotes).toHaveBeenCalledWith('user:user-1');
    expect(mockReplace).toHaveBeenCalledWith('/lucid/onboarding');
  });

  it('does not start local cleanup when account deletion is not confirmed', async () => {
    mockUser = { id: 'user-1' };
    mockRequestAccountDeletion.mockResolvedValue({ deleted: false });

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete entire account' }));
    pressAlertAction('Delete entire account');

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'This could not be loaded. Your saved training remains on this device.',
        'The operation could not be completed. Your local data was preserved.'
      )
    );
    expect(mockClearLucidMorningVoiceNotes).not.toHaveBeenCalled();
    expect(mockResetLocalData).not.toHaveBeenCalled();
    expect(mockFinalizeAccountDeletion).not.toHaveBeenCalled();
  });

  it('reports a partial error when clearing voice notes fails after cloud deletion', async () => {
    mockUser = { id: 'user-1' };
    mockUserScope = 'user:user-1';
    mockClearLucidMorningVoiceNotes.mockRejectedValue(new Error('voice clear failed'));

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'Deletion incomplete',
        'This operation could not be completed. Some data or media may already have been removed, including a cloud copy if one existed.'
      )
    );
    expect(mockDeleteLucidTrainerCloudData).toHaveBeenCalledTimes(1);
    expect(mockClearLucidMorningVoiceNotes).toHaveBeenCalledWith('user:user-1');
    expect(mockResetLocalData).not.toHaveBeenCalled();
  });

  it('reports a partial error when local reset fails after voice notes are cleared', async () => {
    mockResetLocalData.mockRejectedValue(new Error('reset failed'));

    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'Deletion incomplete',
        'This operation could not be completed. Some data or media may already have been removed, including a cloud copy if one existed.'
      )
    );
    expect(mockClearLucidMorningVoiceNotes).toHaveBeenCalledWith('guest');
    expect(mockResetLocalData).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'en' as const,
      'Delete trainer data',
      'Deletion incomplete',
      'This operation could not be completed. Some data or media may already have been removed, including a cloud copy if one existed.',
      'JSON and CSV export structured Lucid Trainer data. Audio files stay on this device and must be shared individually from Voice notes. Text notes remain included because this export is for you.',
      'Open Voice notes',
      'Optional account sync still excludes media. Audio files are never uploaded.',
    ],
    [
      'fr' as const,
      'Supprimer les données Trainer',
      'Suppression incomplète',
      'L’opération n’a pas abouti. Certaines données ou certains médias peuvent déjà avoir été retirés, y compris une copie cloud s’il en existait une.',
      'JSON et CSV exportent les données structurées de Lucid Trainer. Les fichiers audio restent locaux et doivent être partagés un par un depuis Notes vocales. Les notes textuelles restent incluses car cet export est pour vous.',
      'Ouvrir les notes vocales',
      'La synchronisation facultative du compte exclut toujours les médias. Les fichiers audio ne sont jamais envoyés.',
    ],
    [
      'es' as const,
      'Eliminar datos',
      'Eliminación incompleta',
      'No se pudo completar la operación. Algunos datos o archivos pueden haberse eliminado ya, incluida una copia en la nube si existía.',
      'JSON y CSV exportan tus datos estructurados de Lucid Trainer. Los archivos de audio permanecen en este dispositivo y deben compartirse uno a uno desde Notas de voz. Las notas de texto se incluyen porque esta exportación es para ti.',
      'Abrir notas de voz',
      'La sincronización opcional de la cuenta sigue excluyendo los medios. Los archivos de audio nunca se suben.',
    ],
    [
      'de' as const,
      'Trainer-Daten löschen',
      'Löschen unvollständig',
      'Der Vorgang konnte nicht abgeschlossen werden. Einige Daten oder Medien wurden möglicherweise bereits entfernt, einschließlich einer Cloudkopie, falls vorhanden.',
      'JSON und CSV exportieren deine strukturierten Lucid-Trainer-Daten. Audiodateien bleiben lokal und müssen einzeln unter Sprachnotizen geteilt werden. Textnotizen sind enthalten, weil dieser Export für dich ist.',
      'Sprachnotizen öffnen',
      'Die optionale Kontosynchronisierung schließt Medien weiterhin aus. Audiodateien werden nie hochgeladen.',
    ],
    [
      'it' as const,
      'Elimina dati Trainer',
      'Eliminazione incompleta',
      'Operazione non completata. Alcuni dati o file potrebbero essere già stati rimossi, inclusa una copia cloud se esisteva.',
      'JSON e CSV esportano i dati strutturati di Lucid Trainer. I file audio restano su questo dispositivo e vanno condivisi uno per uno da Note vocali. Le note testuali restano incluse perché l’export è per te.',
      'Apri le note vocali',
      'La sincronizzazione facoltativa dell’account continua a escludere i media. I file audio non vengono mai caricati.',
    ],
  ])(
    'keeps export and partial-deletion copy honest in %s',
    async (locale, deleteLabel, partialTitle, partialError, exportBody, voiceNotes, syncNote) => {
      mockLocale = locale;
      mockClearLucidMorningVoiceNotes.mockRejectedValue(new Error('voice clear failed'));

      render(<LucidDataScreen />);
      expect(screen.getByText(exportBody)).toBeTruthy();
      expect(screen.getByText(syncNote)).toBeTruthy();
      expect(screen.getByRole('button', { name: voiceNotes })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: deleteLabel }));
      pressAlertAction(deleteLabel);

      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(partialTitle, partialError));
      expect(mockResetLocalData).not.toHaveBeenCalled();
    }
  );

  it('opens Voice notes without exporting audio files', () => {
    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Voice notes' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/morning-voice');
    expect(mockShareLucidTrainerExport).not.toHaveBeenCalled();
  });
});
