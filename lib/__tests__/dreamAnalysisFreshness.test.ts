import { describe, expect, it } from '@jest/globals';

import {
  getDreamAnalysisFreshness,
  hashDreamTranscript,
  stampDreamAnalysisTranscript,
} from '../dreamAnalysisFreshness';
import type { DreamAnalysis } from '../types';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1,
  transcript: 'I flew over a quiet city',
  title: 'Flight',
  interpretation: 'A first reading of the flight.',
  shareableQuote: 'I flew.',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: 1_700_000_000_000,
  ...overrides,
});

describe('dreamAnalysisFreshness', () => {
  it('hashes a trimmed transcript deterministically and ignores CRLF vs LF', () => {
    const hash = hashDreamTranscript('  hello\r\nworld  ');

    expect(hash).toMatch(/^v1:[0-9a-f]{8}$/);
    expect(hash).toBe(hashDreamTranscript('hello\nworld'));
    expect(hash).toBe(hashDreamTranscript('hello\rworld'));
    expect(hash).not.toBe(hashDreamTranscript('hello world'));
  });

  it('stamps the transcript hash without dropping existing analysis details', () => {
    const dream = buildDream({
      analysisDetails: {
        symbols: [{ name: 'City', meaning: 'Context' }],
        customSignal: 'keep-me',
      },
    });

    const stamped = stampDreamAnalysisTranscript(dream, dream.transcript);

    expect(stamped.analysisTranscriptHash).toBe(hashDreamTranscript(dream.transcript));
    expect(stamped.analysisDetails).toEqual({
      symbols: [{ name: 'City', meaning: 'Context' }],
      customSignal: 'keep-me',
      analysisTranscriptHash: stamped.analysisTranscriptHash,
    });
    expect(stamped.interpretation).toBe(dream.interpretation);
  });

  it('returns not_analyzed when no completed analysis exists', () => {
    expect(
      getDreamAnalysisFreshness(
        buildDream({
          interpretation: '',
          isAnalyzed: false,
          analysisStatus: 'none',
        })
      )
    ).toBe('not_analyzed');
  });

  it('does not mark legacy analyses without a hash as stale', () => {
    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analysisStatus: undefined,
          analysisTranscriptHash: undefined,
          analysisDetails: undefined,
        })
      )
    ).toBe('legacy_unknown');
  });

  it('treats pending, failed, and partial analysis flags as not_analyzed', () => {
    const hash = hashDreamTranscript('I flew over a quiet city');

    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analysisStatus: 'pending',
          isAnalyzed: false,
          analyzedAt: undefined,
          interpretation: '',
          analysisTranscriptHash: hash,
        })
      )
    ).toBe('not_analyzed');
    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analysisStatus: 'failed',
          isAnalyzed: false,
          interpretation: 'A first reading of the flight.',
          analysisTranscriptHash: hash,
        })
      )
    ).toBe('not_analyzed');
    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analyzedAt: undefined,
          analysisTranscriptHash: hash,
        })
      )
    ).toBe('not_analyzed');
    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analysisStatus: undefined,
          interpretation: '',
          analysisTranscriptHash: hash,
        })
      )
    ).toBe('not_analyzed');
  });

  it('marks a stamped analysis stale only after the transcript changes', () => {
    const stamped = stampDreamAnalysisTranscript(buildDream(), 'I flew over a quiet city');

    expect(getDreamAnalysisFreshness(stamped)).toBe('fresh');
    expect(
      getDreamAnalysisFreshness({
        ...stamped,
        transcript: 'I flew over a quieter city',
      })
    ).toBe('stale');
  });

  it('reads a hash stored only in analysisDetails', () => {
    const hash = hashDreamTranscript('I flew over a quiet city');

    expect(
      getDreamAnalysisFreshness(
        buildDream({
          analysisTranscriptHash: undefined,
          analysisDetails: { analysisTranscriptHash: hash },
        })
      )
    ).toBe('fresh');
  });
});
