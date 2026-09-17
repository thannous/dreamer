import { ANALYSIS_SYSTEM_INSTRUCTIONS, buildAnalysisPrompt } from './baseline.ts';
import { ANALYZE_DREAM_SCHEMA } from './baseline-schema.ts';
import * as v1 from './followup-baseline.ts';
import { ANALYZE_DREAM_SCHEMA as v1Schema } from './followup-baseline-schema.ts';

/** Fixed experiments, each with its own receipt directory and twelve-request budget. */
export function selectSuite(name: string = 'initial') {
  if (name === 'initial') return {
    name: 'initial' as const, fixtures: './fixtures.json', output: '/private/tmp/ti559-evaluation-run',
    baseline: 'd2bc25936', beforeVersion: 'analysis-2026-08-20.1',
    beforePrompt: buildAnalysisPrompt, beforeSystem: ANALYSIS_SYSTEM_INSTRUCTIONS,
    beforePolicy: '', beforeSchema: ANALYZE_DREAM_SCHEMA, expectedAfterVersion: null,
  };
  if (name === 'followup') return {
    name: 'followup' as const, fixtures: './followup-fixtures.json', output: '/private/tmp/ti559-followup-evaluation-run',
    baseline: 'd0791edb3', beforeVersion: 'analysis-2026-09-08.1',
    beforePrompt: v1.buildAnalysisPrompt, beforeSystem: v1.ANALYSIS_SYSTEM_INSTRUCTIONS,
    beforePolicy: v1.REFLECTION_POLICY, beforeSchema: v1Schema, expectedAfterVersion: 'analysis-2026-09-09.1',
  };
  throw new Error('Unknown evaluation suite.');
}
