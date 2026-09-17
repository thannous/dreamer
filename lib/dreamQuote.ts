import type { DreamAnalysis } from './types';

/** Only server-stamped poetic generations receive a Noctalia authorship label. */
export const isPoeticDreamQuote = (dream: Pick<DreamAnalysis, 'promptVersion'>): boolean =>
  /^analysis-\d{4}-\d{2}-\d{2}\.poetic\d+$/.test(dream.promptVersion ?? '');
