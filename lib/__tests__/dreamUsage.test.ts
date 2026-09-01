import { describe, expect, it } from '@jest/globals';

import { PENDING_ANALYSIS_RECOVERY_DELAY_MS } from '../analysisRequest';
import {
  getAnalyzedDreamCount,
  getDreamAnalysisState,
  getDreamDetailAction,
  getExploredDreamCount,
  getReflectionJourney,
  getUserChatMessageCount,
  isDreamAnalyzed,
  isDreamExplored,
  isOriginalTranscriptMessage,
} from '../dreamUsage';
import type { DreamAnalysis } from '../types';

const buildDream = (overrides: Partial<DreamAnalysis> & { id?: number } = {}): DreamAnalysis => ({
  id: overrides.id ?? Date.now(),
  transcript: overrides.transcript ?? '',
  title: overrides.title ?? 'Test Dream',
  interpretation: overrides.interpretation ?? '',
  shareableQuote: overrides.shareableQuote ?? '',
  imageUrl: overrides.imageUrl ?? 'https://example.com/image.jpg',
  thumbnailUrl: overrides.thumbnailUrl,
  dreamType: overrides.dreamType ?? 'Symbolic Dream',
  theme: overrides.theme,
  chatHistory: overrides.chatHistory ?? [],
  isFavorite: overrides.isFavorite,
  isAnalyzed: overrides.isAnalyzed,
  analyzedAt: overrides.analyzedAt,
  analysisStatus: overrides.analysisStatus,
  analysisRequestId: overrides.analysisRequestId,
  updatedAt: overrides.updatedAt,
  clientUpdatedAt: overrides.clientUpdatedAt,
  explorationStartedAt: overrides.explorationStartedAt,
  pendingSync: overrides.pendingSync,
  imageGenerationFailed: overrides.imageGenerationFailed,
});

describe('dreamUsage helpers', () => {
  it('only treats dreams as analyzed when the done state is complete', () => {
    const partial = buildDream({ id: 1, isAnalyzed: true, analysisStatus: 'done' });
    const complete = buildDream({
      id: 2,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1234,
      interpretation: 'A complete reading.',
    });

    expect(isDreamAnalyzed(partial)).toBe(false);
    expect(isDreamAnalyzed(complete)).toBe(true);
    expect(getAnalyzedDreamCount([partial, complete, buildDream({ id: 3 })])).toBe(1);
  });

  it('lets pending and failed states dominate old completed content', () => {
    const failedRerun = buildDream({
      id: 4,
      isAnalyzed: true,
      analysisStatus: 'failed',
      analyzedAt: 1234,
      interpretation: 'Old reading.',
    });

    const state = getDreamAnalysisState(failedRerun);

    expect(state.status).toBe('failed');
    expect(state.isAnalyzed).toBe(false);
    expect(getDreamDetailAction(failedRerun)).toBe('analyze');
  });

  it('keeps legacy analyzed dreams valid when analysisStatus is missing', () => {
    const legacyAnalyzed = buildDream({
      id: 5,
      isAnalyzed: true,
      analyzedAt: 4321,
      interpretation: 'A saved reading from an older app version.',
    });

    const state = getDreamAnalysisState(legacyAnalyzed);

    expect(state.status).toBe('done');
    expect(state.isAnalyzed).toBe(true);
    expect(getDreamDetailAction(legacyAnalyzed)).toBe('explore');
  });

  it('counts explored dreams using exploration timestamps', () => {
    const explored = buildDream({ id: 10, explorationStartedAt: 5000 });
    const untouched = buildDream({ id: 11 });

    expect(isDreamExplored(explored)).toBe(true);
    expect(isDreamExplored(untouched)).toBe(false);
    expect(getExploredDreamCount([explored, untouched])).toBe(1);
  });

  it('counts explored dreams when chat history exists', () => {
    const exploredByChat = buildDream({
      id: 12,
      chatHistory: [
        { id: 'm1', role: 'user', text: 'hello' },
        { id: 'm2', role: 'model', text: 'hi' },
      ],
    });
    const untouched = buildDream({ id: 13 });

    expect(isDreamExplored(exploredByChat)).toBe(true);
    expect(getExploredDreamCount([exploredByChat, untouched])).toBe(1);
  });

  it('does not treat dreams with only the transcript message as explored', () => {
    const transcriptOnly = buildDream({
      id: 14,
      chatHistory: [{ id: 'm1', role: 'user', text: 'Here is my dream: ...' }],
    });

    expect(isDreamExplored(transcriptOnly)).toBe(false);
  });

  it('does not treat a model greeting alone as explored', () => {
    const greetingOnly = buildDream({
      id: 15,
      chatHistory: [{ id: 'm-greet', role: 'model', text: 'Hello, I am ready to listen.' }],
    });

    expect(isDreamExplored(greetingOnly)).toBe(false);
    expect(getDreamAnalysisState(greetingOnly).isExplored).toBe(false);
    expect(getExploredDreamCount([greetingOnly])).toBe(0);
  });

  it('does not treat a legacy transcript plus model reply as explored', () => {
    const transcript = 'A quiet city at night.';
    const transcriptWithModelReply = buildDream({
      id: 16,
      transcript,
      chatHistory: [
        { id: 'u-legacy', role: 'user', text: `Here is my dream: ${transcript}` },
        { id: 'm-legacy', role: 'model', text: 'The city may represent memory.' },
      ],
    });

    expect(isDreamExplored(transcriptWithModelReply)).toBe(false);
    expect(getDreamAnalysisState(transcriptWithModelReply).isExplored).toBe(false);
    expect(getExploredDreamCount([transcriptWithModelReply])).toBe(0);
  });

  it('counts only user chat messages for quota usage', () => {
    const dreamWithChat = buildDream({
      id: 20,
      chatHistory: [
        { id: 'm1', role: 'user', text: 'hello' },
        { id: 'm2', role: 'model', text: 'hi there' },
        { id: 'm3', role: 'user', text: 'thanks' },
      ],
    });

    expect(getUserChatMessageCount(dreamWithChat)).toBe(2);
    expect(getUserChatMessageCount(buildDream({ id: 21 }))).toBe(0);
  });

  it('derives detail CTA state based on analyzed and explored flags', () => {
    const notTaggedAnalyzed = buildDream({ id: 30, isAnalyzed: true, analysisStatus: 'done' });
    const analyzed = buildDream({
      id: 31,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 5555,
      interpretation: 'A complete reading.',
    });
    const exploredByTimestamp = buildDream({
      id: 32,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 6666,
      interpretation: 'A complete reading.',
      explorationStartedAt: 7777,
    });
    const exploredByChat = buildDream({
      id: 33,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 8888,
      interpretation: 'A complete reading.',
      chatHistory: [
        { id: 'm1', role: 'user', text: 'hi' },
        { id: 'm2', role: 'model', text: 'hello' },
      ],
    });

    expect(getDreamDetailAction(notTaggedAnalyzed)).toBe('analyze');
    expect(getDreamDetailAction(analyzed)).toBe('explore');
    expect(getDreamDetailAction(exploredByTimestamp)).toBe('continue');
    expect(getDreamDetailAction(exploredByChat)).toBe('continue');
  });

  it('does not count original or legacy transcript messages as conversation usage', () => {
    const transcript = 'I was flying over a quiet city.';
    const dream = buildDream({
      id: 22,
      transcript,
      chatHistory: [
        { id: 'm1', role: 'user', text: `Here is my dream: ${transcript}` },
        { id: 'm2', role: 'user', text: transcript },
        { id: 'm3', role: 'user', text: 'What does the city mean?' },
        { id: 'm4', role: 'model', text: 'It may represent movement.' },
      ],
    });

    expect(isOriginalTranscriptMessage(dream.chatHistory[0], dream)).toBe(true);
    expect(isOriginalTranscriptMessage(dream.chatHistory[1], dream)).toBe(true);
    expect(getUserChatMessageCount(dream)).toBe(1);
  });

  it('counts a legacy-prefixed message when its suffix is not the dream transcript', () => {
    const transcript = 'I was flying over a quiet city.';
    const dream = buildDream({
      id: 23,
      transcript,
      chatHistory: [
        { id: 'm1', role: 'user', text: 'Voici mon rêve… et une autre question' },
        { id: 'm2', role: 'user', text: `Voici mon rêve : ${transcript} What does the city mean?` },
        { id: 'm3', role: 'user', text: `Voici mon rêve : ${transcript}` },
        { id: 'm4', role: 'user', text: 'What does the city mean?' },
      ],
    });

    expect(isOriginalTranscriptMessage(dream.chatHistory[0], dream)).toBe(false);
    expect(isOriginalTranscriptMessage(dream.chatHistory[1], dream)).toBe(false);
    expect(isOriginalTranscriptMessage(dream.chatHistory[2], dream)).toBe(true);
    expect(getUserChatMessageCount(dream)).toBe(3);
  });

  it('treats whitespace-normalized legacy prefixes as the bootstrap transcript only', () => {
    const transcript = 'A quiet city at night.';
    const dream = buildDream({
      id: 24,
      transcript: `  ${transcript}  `,
      chatHistory: [
        { id: 'm1', role: 'user', text: `Here is my dream:   ${transcript}` },
        { id: 'm2', role: 'user', text: `Voici mon rêve :\n${transcript}` },
        { id: 'm3', role: 'user', text: `Here is my dream: ${transcript}!` },
        { id: 'm4', role: 'user', text: `HERE IS MY DREAM: ${transcript}` },
      ],
    });

    expect(isOriginalTranscriptMessage(dream.chatHistory[0], dream)).toBe(true);
    expect(isOriginalTranscriptMessage(dream.chatHistory[1], dream)).toBe(true);
    expect(isOriginalTranscriptMessage(dream.chatHistory[2], dream)).toBe(false);
    expect(isOriginalTranscriptMessage(dream.chatHistory[3], dream)).toBe(false);
    expect(getUserChatMessageCount(dream)).toBe(2);
  });

  it('keeps a legacy-prefixed bootstrap excluded when the dream has no transcript', () => {
    const dream = buildDream({
      id: 25,
      transcript: '   ',
      chatHistory: [
        { id: 'm1', role: 'user', text: 'Voici mon rêve : A quiet city at night.' },
        { id: 'm2', role: 'user', text: 'What does the city mean?' },
      ],
    });

    expect(isOriginalTranscriptMessage(dream.chatHistory[0], dream)).toBe(true);
    expect(isOriginalTranscriptMessage(dream.chatHistory[1], dream)).toBe(false);
    expect(getUserChatMessageCount(dream)).toBe(1);
  });

  it('still counts ordinary chat that does not copy the transcript', () => {
    const transcript = 'A quiet city at night.';
    const dream = buildDream({
      id: 26,
      transcript,
      chatHistory: [
        { id: 'm1', role: 'user', text: 'hello' },
        { id: 'm2', role: 'model', text: 'hi there' },
        { id: 'm3', role: 'user', text: 'thanks' },
      ],
    });

    expect(isOriginalTranscriptMessage(dream.chatHistory[0], dream)).toBe(false);
    expect(getUserChatMessageCount(dream)).toBe(2);
  });
});

describe('getReflectionJourney', () => {
  const now = 1_000_000;
  const analyzed = {
    isAnalyzed: true as const,
    analysisStatus: 'done' as const,
    analyzedAt: 5555,
    interpretation: 'A complete reading.',
  };

  const axisReply = (
    axis: 'symbols' | 'emotions' | 'growth',
    prefix: string
  ): DreamAnalysis['chatHistory'] => [
    { id: `${prefix}-u`, role: 'user', text: axis, meta: { category: axis } },
    { id: `${prefix}-m`, role: 'model', text: `${axis} reply` },
  ];

  it('keeps a fresh pending analysis on lecture wait without consuming quota', () => {
    const dream = buildDream({
      id: now - 10_000,
      analysisStatus: 'pending',
      analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
      updatedAt: now - 10_000,
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('lecture');
    expect(journey.isPendingFresh).toBe(true);
    expect(journey.isResumableAnalysis).toBe(true);
    expect(journey.primary).toEqual({
      kind: 'wait',
      consumesQuota: 'none',
      resume: { kind: 'detail' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('analyze');
  });

  it('retries a stale pending analysis with the existing request id', () => {
    const pendingSince = now - PENDING_ANALYSIS_RECOVERY_DELAY_MS - 1;
    const dream = buildDream({
      id: pendingSince,
      analysisStatus: 'pending',
      analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
      updatedAt: pendingSince,
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('lecture');
    expect(journey.isPendingFresh).toBe(false);
    expect(journey.isResumableAnalysis).toBe(true);
    expect(journey.primary).toEqual({
      kind: 'retry_analysis',
      consumesQuota: 'none',
      resume: { kind: 'detail' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('analyze');
  });

  it('retries a failed analysis and still wraps as analyze', () => {
    const dream = buildDream({
      id: 40,
      isAnalyzed: true,
      analysisStatus: 'failed',
      analyzedAt: 1234,
      interpretation: 'Old reading.',
      analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('lecture');
    expect(journey.isAnalyzed).toBe(false);
    expect(journey.analysisStatus).toBe('failed');
    expect(journey.primary.kind).toBe('retry_analysis');
    expect(getDreamDetailAction(dream, now)).toBe('analyze');
  });

  it('starts approfondir after a complete lecture with no axes', () => {
    const dream = buildDream({ id: 41, ...analyzed });
    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('approfondir');
    expect(journey.nextAxis).toBe('symbols');
    expect(journey.exploredAxes).toEqual([]);
    expect(journey.hasOpenChat).toBe(false);
    expect(journey.primary).toEqual({
      kind: 'start_approfondir',
      consumesQuota: 'none',
      resume: { kind: 'categories' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('explore');
  });

  it('does not treat a legacy transcript as open conversation or explored axes', () => {
    const transcript = 'A quiet city at night.';
    const dream = buildDream({
      id: 42,
      ...analyzed,
      transcript,
      chatHistory: [{ id: 'm1', role: 'user', text: `Here is my dream: ${transcript}` }],
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.hasOpenChat).toBe(false);
    expect(journey.exploredAxes).toEqual([]);
    expect(journey.nextAxis).toBe('symbols');
    expect(journey.primary.kind).toBe('start_approfondir');
    expect(getDreamDetailAction(dream, now)).toBe('explore');
    expect(isDreamExplored(dream)).toBe(false);
  });

  it('continues the next incomplete axis after a successful symbols reply', () => {
    const dream = buildDream({
      id: 43,
      ...analyzed,
      chatHistory: axisReply('symbols', 's'),
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('approfondir');
    expect(journey.exploredAxes).toEqual(['symbols']);
    expect(journey.nextAxis).toBe('emotions');
    expect(journey.hasOpenChat).toBe(true);
    expect(journey.primary).toEqual({
      kind: 'continue_axis',
      consumesQuota: 'message',
      resume: { kind: 'chat', category: 'emotions' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('continue');
  });

  it('offers 360 synthesis to Plus once all axes are complete', () => {
    const dream = buildDream({
      id: 44,
      ...analyzed,
      chatHistory: [
        ...axisReply('symbols', 's'),
        ...axisReply('emotions', 'e'),
        ...axisReply('growth', 'g'),
      ],
    });

    const journey = getReflectionJourney(dream, now, { tier: 'plus' });

    expect(journey.stage).toBe('approfondir');
    expect(journey.nextAxis).toBeNull();
    expect(journey.hasSynthesis).toBe(false);
    expect(journey.primary).toEqual({
      kind: 'synthesize',
      consumesQuota: 'synthesis360',
      resume: { kind: 'chat', mode: 'synthesis' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('continue');
  });

  it('opens conversation instead of synthesis for free and guest', () => {
    const dream = buildDream({
      id: 45,
      ...analyzed,
      chatHistory: [
        ...axisReply('symbols', 's'),
        ...axisReply('emotions', 'e'),
        ...axisReply('growth', 'g'),
      ],
    });

    expect(getReflectionJourney(dream, now, { tier: 'free' }).primary.kind).toBe('open_conversation');
    expect(getReflectionJourney(dream, now, { tier: 'guest' }).primary.kind).toBe('open_conversation');
  });

  it('retries the last failed chat message after synthesis exists', () => {
    const dream = buildDream({
      id: 46,
      ...analyzed,
      chatHistory: [
        ...axisReply('symbols', 's'),
        ...axisReply('emotions', 'e'),
        ...axisReply('growth', 'g'),
        { id: 'syn-u', role: 'user', text: 'Synthesis', meta: { exploration360Synthesis: true } },
        { id: 'syn-m', role: 'model', text: 'Final synthesis' },
        { id: 'u-last', role: 'user', text: 'Can you go deeper?' },
        {
          id: 'err-last',
          role: 'model',
          text: 'Sorry',
          meta: {
            isError: true,
            retry: { messageText: 'Can you go deeper?', clientRequestId: 'u-last' },
          },
        },
      ],
    });

    const journey = getReflectionJourney(dream, now, { tier: 'plus' });

    expect(journey.stage).toBe('conversation');
    expect(journey.hasSynthesis).toBe(true);
    expect(journey.lastFailedChatMessageId).toBe('err-last');
    expect(journey.primary).toEqual({
      kind: 'retry_chat',
      consumesQuota: 'none',
      resume: { kind: 'chat', messageId: 'err-last' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('continue');
  });

  it('ignores transcript retries when locating a failed chat message', () => {
    const transcript = 'I was flying.';
    const dream = buildDream({
      id: 47,
      ...analyzed,
      transcript,
      chatHistory: [
        ...axisReply('symbols', 's'),
        ...axisReply('emotions', 'e'),
        ...axisReply('growth', 'g'),
        { id: 'syn-u', role: 'user', text: 'Synthesis', meta: { exploration360Synthesis: true } },
        { id: 'syn-m', role: 'model', text: 'Final synthesis' },
        {
          id: 'err-transcript',
          role: 'model',
          text: 'Sorry',
          meta: {
            isError: true,
            retry: { messageText: `Here is my dream: ${transcript}` },
          },
        },
      ],
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.lastFailedChatMessageId).toBeNull();
    expect(journey.primary.kind).toBe('continue_chat');
  });

  it('does not treat a model greeting or transcript reply as an open conversation', () => {
    const greetingOnly = buildDream({
      id: 48,
      ...analyzed,
      chatHistory: [{ id: 'm-greet', role: 'model', text: 'Hello, I am ready to listen.' }],
    });
    const transcriptWithModelReply = buildDream({
      id: 49,
      ...analyzed,
      transcript: 'A quiet city at night.',
      chatHistory: [
        { id: 'u-legacy', role: 'user', text: 'Here is my dream: A quiet city at night.' },
        { id: 'm-legacy', role: 'model', text: 'The city may represent memory.' },
      ],
    });

    const greetingJourney = getReflectionJourney(greetingOnly, now);
    const transcriptJourney = getReflectionJourney(transcriptWithModelReply, now);

    expect(greetingJourney.hasOpenChat).toBe(false);
    expect(greetingJourney.primary.kind).toBe('start_approfondir');
    expect(getDreamDetailAction(greetingOnly, now)).toBe('explore');
    expect(isDreamExplored(greetingOnly)).toBe(false);

    expect(transcriptJourney.hasOpenChat).toBe(false);
    expect(transcriptJourney.exploredAxes).toEqual([]);
    expect(transcriptJourney.primary.kind).toBe('start_approfondir');
    expect(getDreamDetailAction(transcriptWithModelReply, now)).toBe('explore');
    expect(isDreamExplored(transcriptWithModelReply)).toBe(false);
  });

  it('retries a failed chat message before proposing the next incomplete axis', () => {
    const dream = buildDream({
      id: 50,
      ...analyzed,
      chatHistory: [
        { id: 's-u', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        {
          id: 's-err',
          role: 'model',
          text: 'Sorry, I encountered an error. Please try again.',
          meta: {
            isError: true,
            retry: { messageText: 'symbols', clientRequestId: 's-u' },
          },
        },
      ],
    });

    const journey = getReflectionJourney(dream, now);

    expect(journey.stage).toBe('conversation');
    expect(journey.nextAxis).toBe('symbols');
    expect(journey.exploredAxes).toEqual([]);
    expect(journey.lastFailedChatMessageId).toBe('s-err');
    expect(journey.primary).toEqual({
      kind: 'retry_chat',
      consumesQuota: 'none',
      resume: { kind: 'chat', messageId: 's-err' },
    });
    expect(getDreamDetailAction(dream, now)).toBe('continue');
  });
});
