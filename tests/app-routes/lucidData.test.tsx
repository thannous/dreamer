/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();
const mockReplace = jest.fn();
const mockResetLocalData = jest.fn();
const mockDeleteLucidTrainerCloudData = jest.fn();
const mockBuildNoctaliaHandoffLinks = jest.fn();
const mockShareLucidTrainerExport = jest.fn();
const mockTrackProductEvent = jest.fn();
const mockRequestAccountDeletion = jest.fn();
const mockFinalizeAccountDeletion = jest.fn();

let mockUser: { id: string } | null;
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
    ],
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
      content: getLucidContent('en'),
      resetLocalData: mockResetLocalData,
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
    mockState = createState();
    mockResetLocalData.mockResolvedValue(undefined);
    mockDeleteLucidTrainerCloudData.mockResolvedValue(undefined);
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
    mockDeleteLucidTrainerCloudData.mockImplementation(async () => {
      order.push('cloud');
    });
    mockResetLocalData.mockImplementation(async () => {
      order.push('local');
    });

    render(<LucidDataScreen />);
    expect(mockState.preferences.cloudSyncEnabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() => expect(mockResetLocalData).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['cloud', 'local']);
    expect(mockDeleteLucidTrainerCloudData).toHaveBeenCalledTimes(1);
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
    expect(mockResetLocalData).not.toHaveBeenCalled();
  });

  it('deletes only local data for a guest', async () => {
    render(<LucidDataScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trainer data' }));
    pressAlertAction('Delete trainer data');

    await waitFor(() => expect(mockResetLocalData).toHaveBeenCalledTimes(1));
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
});
