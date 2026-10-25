import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isRefundableTextAnalysisFailure, REFUNDABLE_TEXT_ANALYSIS_FAILURE_CODES } from './textAnalysisRefund.ts';
import { ClaudeConfigurationError, ClaudeRequestError, textAnalysisFailureCode } from '../services/claude.ts';

Deno.test('only explicit service failure codes authorize a text-analysis refund', () => {
  for (const code of REFUNDABLE_TEXT_ANALYSIS_FAILURE_CODES) assertEquals(isRefundableTextAnalysisFailure(code), true);
  for (const code of [null, undefined, '', 'ANALYSIS_TRANSIENT', 'ANALYSIS_JOB_FAILED', 'UNKNOWN_FUTURE_FAILURE',
    'ANALYSIS_TRANSCRIPT_CHANGED', 'ANALYSIS_STATE_CONFLICT', 'ANALYSIS_REQUEST_STALE', 'DREAM_NOT_FOUND',
    'ANALYSIS_CLIENT_CANCELLED', 'INVALID_TRANSCRIPT']) assertEquals(isRefundableTextAnalysisFailure(code), false);
});

Deno.test('transport errors keep explicit state/refusal codes rather than trusting the generic HTTP presentation', () => {
  assertEquals(textAnalysisFailureCode(new ClaudeConfigurationError()), 'ANALYSIS_CONFIGURATION_ERROR');
  assertEquals(textAnalysisFailureCode(new ClaudeRequestError(504)), 'ANALYSIS_TIMEOUT');
  assertEquals(textAnalysisFailureCode(new Error('Internal server failure')), 'ANALYSIS_SERVER_ERROR');
  assertEquals(textAnalysisFailureCode({ status: 503 }), 'ANALYSIS_SERVER_ERROR');
  assertEquals(textAnalysisFailureCode({ status: 409 }), 'ANALYSIS_REQUEST_REJECTED');
  assertEquals(textAnalysisFailureCode({ name: 'AbortError' }), 'ANALYSIS_CLIENT_CANCELLED');
  assertEquals(isRefundableTextAnalysisFailure(textAnalysisFailureCode(null)), true);
  for (const code of ['ANALYSIS_TRANSCRIPT_CHANGED', 'DREAM_NOT_FOUND']) {
    assertEquals(textAnalysisFailureCode({ code, status: 500 }), code);
    assertEquals(isRefundableTextAnalysisFailure(textAnalysisFailureCode({ code, status: 500 })), false);
  }
});

Deno.test('PostgREST and unstructured gateway errors become retryable service failures', () => {
  for (const error of [null, { code: '', message: 'fetch failed' }, { code: '57014' },
    { code: '40P01' }, { code: 'PGRST000' }, { code: 'PGRST000', status: 400 }, { code: 'P0001' },
    { code: 'UNKNOWN_FUTURE_FAILURE' }, { message: '<html>Bad Gateway</html>' }]) {
    assertEquals(textAnalysisFailureCode(error), 'ANALYSIS_SERVER_ERROR');
  }
});
