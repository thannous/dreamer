import { createContext, useContext } from 'react';

// In-flight dream analysis surfaced app-wide (in-memory only, resets on
// relaunch). Lives in its own dependency-free module so leaf components
// (bottom navigations, indicators) can subscribe without pulling the whole
// dream-journal graph into their bundles and tests.
export type AnalysisActivityValue = {
  activeAnalysis: { dreamId: number } | null;
  lastAnalysisOutcome: { dreamId: number; status: 'done' | 'failed'; completedAt: number } | null;
};

const AnalysisActivityContext = createContext<AnalysisActivityValue>({
  activeAnalysis: null,
  lastAnalysisOutcome: null,
});

export const AnalysisActivityProvider = AnalysisActivityContext.Provider;

/**
 * Hook to observe the in-flight dream analysis (and its latest outcome).
 * Safe to use outside DreamsProvider: falls back to "nothing running".
 */
export const useAnalysisActivity = (): AnalysisActivityValue =>
  useContext(AnalysisActivityContext);
