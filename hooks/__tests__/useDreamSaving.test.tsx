import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDreamSaving } from '../useDreamSaving';

const mockCategorizeDream = vi.fn().mockResolvedValue({
  title: 'Test Dream',
  theme: 'surreal',
  dreamType: 'Lucid Dream',
});

const mockAnalyzeDream = vi.fn().mockResolvedValue({ id: 1, isAnalyzed: true });
const mockAddDream = vi.fn().mockImplementation((dream) => Promise.resolve({ ...dream, id: Date.now() }));

// Mock all dependencies
vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
  Platform: {
    OS: 'web',
    select: (spec: Record<string, unknown>) => spec.web ?? spec.default,
  },
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'test-user' },
  }),
}));

vi.mock('@/context/DreamsContext', () => ({
  useDreams: vi.fn().mockReturnValue({
    addDream: mockAddDream,
    dreams: [],
    analyzeDream: mockAnalyzeDream,
  }),
}));

vi.mock('@/hooks/useQuota', () => ({
  useQuota: vi.fn().mockReturnValue({
    canAnalyzeNow: true,
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: vi.fn().mockReturnValue({
    t: (key: string) => key,
    currentLang: 'fr',
  }),
}));

vi.mock('@/services/geminiService', () => ({
  categorizeDream: mockCategorizeDream,
}));

describe('useDreamSaving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isPersisting false', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(result.current.isPersisting).toBe(false);
  });

  it('should initialize with draftDream null', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(result.current.draftDream).toBeNull();
  });

  it('should provide saveDream function', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(typeof result.current.saveDream).toBe('function');
  });

  it('should provide analyzeAndSaveDream function', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(typeof result.current.analyzeAndSaveDream).toBe('function');
  });

  it('should provide buildDraftDream function', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(typeof result.current.buildDraftDream).toBe('function');
  });

  it('should provide resetDraft function', () => {
    const { result } = renderHook(() => useDreamSaving());
    
    expect(typeof result.current.resetDraft).toBe('function');
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

  it('saveDream should set isPersisting during save', async () => {
    const { result } = renderHook(() => useDreamSaving());
    
    // Start saving
    const savePromise = act(async () => {
      await result.current.saveDream('Test dream');
    });
    
    // isPersisting should be true during save
    await savePromise;
    
    // After save, isPersisting should be false
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
    const onSaveComplete = vi.fn();
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

  it('passes current language to analyzeAndSaveDream', async () => {
    const { result } = renderHook(() => useDreamSaving());
    const draft = result.current.buildDraftDream('Un rêve');

    await act(async () => {
      await result.current.analyzeAndSaveDream(draft);
    });

    expect(mockAnalyzeDream).toHaveBeenCalledWith(draft.id, draft.transcript, { lang: 'fr' });
  });
});
