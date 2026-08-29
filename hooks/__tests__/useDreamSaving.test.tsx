/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';

// Use jest.hoisted to ensure mock functions are available during module loading
const {
  mockCategorizeDream,
  mockAnalyzeDream,
  mockAddDream,
  mockApplyDreamCategorization,
} = ((factory: any) => factory())(() => ({
  mockCategorizeDream: jest.fn().mockResolvedValue({
    title: 'Test Dream',
    theme: 'surreal',
    dreamType: 'Lucid Dream',
  }),
  mockAnalyzeDream: jest.fn().mockResolvedValue({ id: 1, isAnalyzed: true }),
  mockAddDream: jest.fn().mockImplementation((dream: unknown) => Promise.resolve({ ...dream as object, id: Date.now() })),
  mockApplyDreamCategorization: jest.fn().mockResolvedValue(null),
}));

let mockCurrentUser: any = { id: 'test-user' };
let mockCanAnalyzeNow = true;
let mockTier = 'free';

// Mock all dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'web',
    select: (spec: Record<string, unknown>) => spec.web ?? spec.default,
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Use relative paths for mocks
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockCurrentUser,
  })),
}));

jest.mock('../../context/DreamsContext', () => ({
  useDreams: jest.fn().mockReturnValue({
    addDream: mockAddDream,
    applyDreamCategorization: mockApplyDreamCategorization,
    dreams: [],
    analyzeDream: mockAnalyzeDream,
  }),
}));

jest.mock('../useQuota', () => ({
  useQuota: jest.fn(() => ({
    canAnalyzeNow: mockCanAnalyzeNow,
    tier: mockTier,
  })),
}));

jest.mock('../useTranslation', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
    currentLang: 'fr',
  }),
}));

jest.mock('../../services/geminiService', () => ({
  categorizeDream: mockCategorizeDream,
}));

// Import after mocks are set up
const { useDreamSaving } = require('../useDreamSaving');

describe('useDreamSaving', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { id: 'test-user' };
    mockCanAnalyzeNow = true;
    mockTier = 'free';
  });

  it('should initialize with isPersisting false', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(result.current.isPersisting).toBe(false);
  });

  it('should initialize with draftDream null', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(result.current.draftDream).toBeNull();
  });

  it('buildDraftDream should create a dream object from transcript', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    const draft = result.current.buildDraftDream('This is my dream transcript');
    
    expect(draft).toHaveProperty('id');
    expect(draft).toHaveProperty('transcript', 'This is my dream transcript');
    expect(draft).toHaveProperty('title');
    expect(draft).toHaveProperty('dreamType', 'Symbolic Dream');
    expect(draft).toHaveProperty('isAnalyzed', false);
    expect(draft).toHaveProperty('analysisStatus', 'none');
  });

  it('buildDraftDream should truncate long first lines for title', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    const longFirstLine = 'A'.repeat(100);
    const draft = result.current.buildDraftDream(longFirstLine);
    
    expect(draft.title.length).toBeLessThanOrEqual(65); // 64 chars + ellipsis
  });

  it('saveDream should return null for empty transcript', async () => {
    const { result } = renderHook(() => useDreamSaving());
    
    let savedDream;
    await act(async () => {
      savedDream = await result.current.saveDream('   ');
    });
    
    expect(savedDream).toBeNull();
  });

  it('reports persistence while the storage save is pending', async () => {
    let resolveSave: (() => void) | undefined;
    mockAddDream.mockImplementationOnce(
      (dream: unknown) =>
        new Promise((resolve) => {
          resolveSave = () => resolve({ ...(dream as object), id: 42 });
        })
    );
    const { result } = renderHook(() => useDreamSaving());

    let savePromise!: Promise<unknown>;
    await act(async () => {
      savePromise = result.current.saveDream('Test dream');
      await Promise.resolve();
    });

    expect(result.current.isPersisting).toBe(true);

    await act(async () => {
      resolveSave?.();
      await savePromise;
    });

    expect(result.current.isPersisting).toBe(false);
  });

  it('resetDraft should clear draftDream', async () => {
    const { result } = renderHook(() => useDreamSaving());
    
    // Save a dream to set draftDream
    await act(async () => {
      await result.current.saveDream('Test dream');
    });
    
    // Reset
    act(() => {
      result.current.resetDraft();
    });
    
    expect(result.current.draftDream).toBeNull();
  });

  it('should call onSaveComplete callback after successful save', async () => {
    const onSaveComplete = jest.fn();
    const { result } = renderHook(() => useDreamSaving({ onSaveComplete }));
    
    await act(async () => {
      await result.current.saveDream('Test dream');
    });
    
    expect(onSaveComplete).toHaveBeenCalled();
  });

  it('passes current language to quick categorization', async () => {
    const { result } = renderHook(() => useDreamSaving());

    await act(async () => {
      await result.current.saveDream('  Bonjour le monde  ');
    });

    expect(mockCategorizeDream).toHaveBeenCalledWith('Bonjour le monde', 'fr');
  });

  it('persists before quick categorization resolves', async () => {
    let resolveCategorization: ((value: {
      title: string;
      theme: 'surreal';
      dreamType: 'Lucid Dream';
    }) => void) | undefined;
    mockCategorizeDream.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveCategorization = resolve;
      })
    );
    const { result } = renderHook(() => useDreamSaving());

    let savedDream: any;
    await act(async () => {
      savedDream = await result.current.saveDream('Immediate save');
    });

    expect(savedDream).not.toBeNull();
    expect(mockAddDream).toHaveBeenCalledTimes(1);
    expect(mockApplyDreamCategorization).not.toHaveBeenCalled();

    await act(async () => {
      resolveCategorization?.({
        title: 'Later title',
        theme: 'surreal',
        dreamType: 'Lucid Dream',
      });
      await Promise.resolve();
    });

    expect(mockApplyDreamCategorization).toHaveBeenCalledWith(
      savedDream.id,
      expect.objectContaining({ title: 'Later title' })
    );
  });

  it('passes current language to analyzeAndSaveDream', async () => {
    const { result } = renderHook(() => useDreamSaving());
    const draft = result.current.buildDraftDream('Un rêve');

    await act(async () => {
      await result.current.analyzeAndSaveDream(draft);
    });

    expect(mockAnalyzeDream).toHaveBeenCalledWith(draft.id, draft.transcript, {
      lang: 'fr',
      replaceExistingImage: false,
    });
  });

  it('analyzes without requesting illustration', async () => {
    const onProgress = {
      setStep: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
    };
    const { result } = renderHook(() => useDreamSaving());
    const draft = result.current.buildDraftDream('Un rêve');

    await act(async () => {
      await result.current.analyzeAndSaveDream(draft, onProgress);
    });

    expect(mockAnalyzeDream).toHaveBeenCalledWith(draft.id, draft.transcript, {
      lang: 'fr',
      replaceExistingImage: false,
    });
    expect(onProgress.setStep).toHaveBeenCalledWith(1);
    expect(onProgress.setStep).toHaveBeenCalledWith(3);
    expect(onProgress.setStep).not.toHaveBeenCalledWith(2);
  });

  it('still saves dreams when quick categorization fails', async () => {
    mockCategorizeDream.mockRejectedValueOnce(new Error('categorize failed'));
    const { result } = renderHook(() => useDreamSaving());

    let savedDream;
    await act(async () => {
      savedDream = await result.current.saveDream('Test dream');
    });

    expect(mockAddDream).toHaveBeenCalled();
    expect(savedDream).not.toBeNull();
  });

  it('saves guest dreams without consulting a recording limit', async () => {
    mockCurrentUser = null;
    const { result } = renderHook(() => useDreamSaving());

    let savedDream;
    await act(async () => {
      savedDream = await result.current.saveDream('Guest dream');
    });

    expect(mockAddDream).toHaveBeenCalledTimes(1);
    expect(mockAddDream).toHaveBeenCalledWith(expect.objectContaining({
      transcript: 'Guest dream',
    }));
    expect(savedDream).not.toBeNull();
  });

  it('shows analysis limit alert when quota prevents analysis', async () => {
    mockCanAnalyzeNow = false;
    mockTier = 'guest';
    const { result } = renderHook(() => useDreamSaving());
    const draft = result.current.buildDraftDream('Limit dream');

    let analyzed;
    await act(async () => {
      analyzed = await result.current.analyzeAndSaveDream(draft);
    });

    expect(analyzed).toBeNull();
    expect(Alert.alert).toHaveBeenCalled();
  });
});
