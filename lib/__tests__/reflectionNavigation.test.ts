import { describe, expect, it } from '@jest/globals';

import {
  buildReflectionResumeHref,
  getJournalDetailPrimaryFamily,
} from '../dreamUsage';
import type {
  JournalDetailPrimaryFamily,
  ReflectionPrimaryKind,
  ReflectionResumeHref,
  ReflectionResumeTarget,
} from '../dreamUsage';

const DREAM_ID = 42;

const PRIMARY_KINDS: readonly ReflectionPrimaryKind[] = [
  'analyze',
  'wait',
  'retry_analysis',
  'start_approfondir',
  'continue_axis',
  'synthesize',
  'open_conversation',
  'continue_chat',
  'retry_chat',
];

const KIND_FAMILY: Record<ReflectionPrimaryKind, JournalDetailPrimaryFamily> = {
  analyze: 'analyze',
  wait: 'analyze',
  retry_analysis: 'analyze',
  start_approfondir: 'explore',
  continue_axis: 'continue',
  synthesize: 'continue',
  open_conversation: 'continue',
  continue_chat: 'continue',
  retry_chat: 'continue',
};

const KIND_RESUME: Record<ReflectionPrimaryKind, ReflectionResumeTarget> = {
  analyze: { kind: 'detail' },
  wait: { kind: 'detail' },
  retry_analysis: { kind: 'detail' },
  start_approfondir: { kind: 'categories' },
  continue_axis: { kind: 'chat', category: 'emotions' },
  synthesize: { kind: 'chat', mode: 'synthesis' },
  open_conversation: { kind: 'chat' },
  continue_chat: { kind: 'chat' },
  retry_chat: { kind: 'chat', messageId: 'err-last' },
};

const KIND_HREF: Record<ReflectionPrimaryKind, ReflectionResumeHref | null> = {
  analyze: null,
  wait: null,
  retry_analysis: null,
  start_approfondir: {
    pathname: '/dream-categories/[id]',
    params: { id: '42' },
  },
  continue_axis: {
    pathname: '/dream-chat/[id]',
    params: { id: '42', category: 'emotions' },
  },
  synthesize: {
    pathname: '/dream-chat/[id]',
    params: { id: '42', mode: 'synthesis' },
  },
  open_conversation: {
    pathname: '/dream-chat/[id]',
    params: { id: '42' },
  },
  continue_chat: {
    pathname: '/dream-chat/[id]',
    params: { id: '42' },
  },
  retry_chat: {
    pathname: '/dream-chat/[id]',
    params: { id: '42', messageId: 'err-last' },
  },
};

describe('getJournalDetailPrimaryFamily', () => {
  it.each(PRIMARY_KINDS)('maps %s onto the Journal CTA family', (kind: ReflectionPrimaryKind) => {
    expect(getJournalDetailPrimaryFamily(kind)).toBe(KIND_FAMILY[kind]);
  });
});

describe('buildReflectionResumeHref', () => {
  it.each(PRIMARY_KINDS)('routes %s from its canonical resume', (kind: ReflectionPrimaryKind) => {
    expect(buildReflectionResumeHref(DREAM_ID, KIND_RESUME[kind])).toEqual(
      KIND_HREF[kind]
    );
  });

  it('encodes a numeric dream id as a string param', () => {
    expect(buildReflectionResumeHref(7, { kind: 'categories' })).toEqual({
      pathname: '/dream-categories/[id]',
      params: { id: '7' },
    });
    expect(buildReflectionResumeHref(7, { kind: 'chat' })?.params.id).toBe('7');
  });

  it('forwards every chat resume param when present', () => {
    expect(
      buildReflectionResumeHref(DREAM_ID, {
        kind: 'chat',
        category: 'symbols',
        mode: 'synthesis',
        messageId: 'm-9',
      })
    ).toEqual({
      pathname: '/dream-chat/[id]',
      params: {
        id: '42',
        category: 'symbols',
        mode: 'synthesis',
        messageId: 'm-9',
      },
    });
  });

  it('stays on the dream detail for a detail resume', () => {
    expect(buildReflectionResumeHref(DREAM_ID, { kind: 'detail' })).toBeNull();
  });
});
