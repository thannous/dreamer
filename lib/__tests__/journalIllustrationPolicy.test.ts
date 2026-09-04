import { describe, expect, it } from '@jest/globals';

import {
  resolveJournalIllustrationAccess,
  resolveJournalIllustrationCta,
  resolveJournalIllustrationSidecar,
  shouldReplaceExistingImage,
  shouldShowCompletedJournalReading,
} from '../journalIllustrationPolicy';

const BUNDLED_REQUEST_ID = '3f73ab45-9a14-4db9-94a3-d24724457d9e';

describe('shouldReplaceExistingImage', () => {
  it('keeps first analysis and keep-image reanalysis from replacing the image', () => {
    expect(shouldReplaceExistingImage('first')).toBe(false);
    expect(shouldReplaceExistingImage('keep')).toBe(false);
  });

  it('replaces the image only for an explicit regenerate or replace', () => {
    expect(shouldReplaceExistingImage('replace')).toBe(true);
    expect(shouldReplaceExistingImage('regenerate')).toBe(true);
  });
});

describe('resolveJournalIllustrationAccess', () => {
  it('lets guests illustrate from the image pool even when analysis is exhausted', () => {
    const access = resolveJournalIllustrationAccess({
      tier: 'guest',
      canGenerateImageNow: true,
      isAnalyzed: true,
      imageUrl: '',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });

    expect(access).toEqual({
      allowed: true,
      bundledRequestId: BUNDLED_REQUEST_ID,
      reason: 'allowed',
    });
  });

  it('blocks guests with the image quota reason when the image pool is exhausted', () => {
    const access = resolveJournalIllustrationAccess({
      tier: 'guest',
      canGenerateImageNow: false,
      isAnalyzed: true,
      imageUrl: '',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('guest_image_quota');
  });

  it('always allows plus illustrations', () => {
    const access = resolveJournalIllustrationAccess({
      tier: 'plus',
      canGenerateImageNow: false,
      isAnalyzed: true,
      imageUrl: '',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });

    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('allowed');
    expect(access.bundledRequestId).toBe(BUNDLED_REQUEST_ID);
  });

  it('allows authenticated free when a valid bundle exists even if analysis remaining is zero', () => {
    const access = resolveJournalIllustrationAccess({
      tier: 'free',
      canGenerateImageNow: false,
      isAnalyzed: true,
      imageUrl: '   ',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });

    expect(access).toEqual({
      allowed: true,
      bundledRequestId: BUNDLED_REQUEST_ID,
      reason: 'allowed',
    });
  });

  it('blocks standalone free illustration without a valid analyzed bundle', () => {
    const missingBundle = resolveJournalIllustrationAccess({
      tier: 'free',
      canGenerateImageNow: true,
      isAnalyzed: true,
      imageUrl: '',
    });
    const invalidBundle = resolveJournalIllustrationAccess({
      tier: 'free',
      canGenerateImageNow: false,
      isAnalyzed: true,
      imageUrl: '',
      analysisRequestId: 'not-a-uuid',
    });
    const unanalyzed = resolveJournalIllustrationAccess({
      tier: 'free',
      canGenerateImageNow: false,
      isAnalyzed: false,
      imageUrl: '',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });
    const alreadyIllustrated = resolveJournalIllustrationAccess({
      tier: 'free',
      canGenerateImageNow: false,
      isAnalyzed: true,
      imageUrl: 'https://example.com/dream.png',
      analysisRequestId: BUNDLED_REQUEST_ID,
    });

    expect(missingBundle).toEqual({
      allowed: false,
      bundledRequestId: undefined,
      reason: 'free_bundle_required',
    });
    expect(invalidBundle.reason).toBe('free_bundle_required');
    expect(unanalyzed.allowed).toBe(false);
    expect(alreadyIllustrated.allowed).toBe(false);
  });
});

describe('journal illustration sidecar and reading visibility', () => {
  it('treats pending, failed, and empty image as independent sidecar states', () => {
    expect(resolveJournalIllustrationSidecar({
      imageUrl: 'https://example.com/dream.png',
      imageGenerationFailed: true,
      imageJobStatus: 'running',
    })).toBe('image');
    expect(resolveJournalIllustrationSidecar({
      imageJobStatus: 'queued',
      imageGenerationFailed: true,
    })).toBe('pending');
    expect(resolveJournalIllustrationSidecar({
      imageJobStatus: 'running',
    })).toBe('pending');
    expect(resolveJournalIllustrationSidecar({
      imageGenerationFailed: true,
    })).toBe('failed');
    expect(resolveJournalIllustrationSidecar({})).toBe('empty');
  });

  it('keeps a completed reading visible regardless of pending or failed image', () => {
    expect(shouldShowCompletedJournalReading('done', true)).toBe(true);
    expect(shouldShowCompletedJournalReading('done', false)).toBe(true);
    expect(shouldShowCompletedJournalReading('pending', false)).toBe(false);
    expect(shouldShowCompletedJournalReading('failed', false)).toBe(false);
    expect(shouldShowCompletedJournalReading(undefined, true)).toBe(true);
  });

  it('shows Illustrate after text analysis when no image exists and access is allowed', () => {
    expect(resolveJournalIllustrationCta({
      sidecar: 'empty',
      isAnalyzed: true,
      allowed: true,
      reason: 'allowed',
      tier: 'guest',
    })).toBe('illustrate');
  });

  it('does not show the independent illustration CTA before analysis is done', () => {
    expect(resolveJournalIllustrationCta({
      sidecar: 'empty',
      isAnalyzed: false,
      allowed: true,
      reason: 'allowed',
      tier: 'guest',
    })).toBe('none');
  });

  it('keeps retry available after a failed job when illustration is allowed', () => {
    expect(resolveJournalIllustrationCta({
      sidecar: 'failed',
      isAnalyzed: true,
      allowed: true,
      reason: 'allowed',
      tier: 'free',
    })).toBe('retry');
  });

  it('uses image-quota copy when a guest image pool is exhausted', () => {
    expect(resolveJournalIllustrationCta({
      sidecar: 'empty',
      isAnalyzed: true,
      allowed: false,
      reason: 'guest_image_quota',
      tier: 'guest',
    })).toBe('quota');
    expect(resolveJournalIllustrationCta({
      sidecar: 'failed',
      isAnalyzed: true,
      allowed: false,
      reason: 'guest_image_quota',
      tier: 'guest',
    })).toBe('quota');
  });
});
