import type { UserTier } from '@/constants/limits';
import { isAnalysisRequestId } from '@/lib/analysisRequest';
import type { AnalysisStatus, ImageJobStatus } from '@/lib/types';

export type JournalIllustrationAccessReason =
  | 'allowed'
  | 'guest_image_quota'
  | 'free_bundle_required';

export type JournalIllustrationAccess = {
  allowed: boolean;
  bundledRequestId?: string;
  reason: JournalIllustrationAccessReason;
};

export type JournalAnalysisImageIntent = 'first' | 'keep' | 'replace' | 'regenerate';

export type JournalIllustrationSidecar = 'image' | 'pending' | 'failed' | 'empty';

export type JournalIllustrationCta = 'illustrate' | 'retry' | 'quota' | 'upgrade' | 'none';

const hasImageUrl = (imageUrl?: string | null): boolean => Boolean(imageUrl?.trim());

export function shouldReplaceExistingImage(intent: JournalAnalysisImageIntent): boolean {
  return intent === 'replace' || intent === 'regenerate';
}

/**
 * Journal-detail illustration permission, independent from analysis remaining.
 * Plus is always allowed. Guest follows the image pool (`canGenerateImageNow`).
 * Authenticated free is allowed only with a valid bundled analysis request on an
 * analyzed dream that still has no image. The server remains the authority.
 */
export function resolveJournalIllustrationAccess(input: {
  tier: UserTier;
  canGenerateImageNow: boolean;
  isAnalyzed: boolean;
  imageUrl?: string | null;
  analysisRequestId?: string | null;
}): JournalIllustrationAccess {
  const bundledRequestId =
    input.isAnalyzed
    && !hasImageUrl(input.imageUrl)
    && isAnalysisRequestId(input.analysisRequestId)
      ? input.analysisRequestId
      : undefined;

  if (input.tier === 'plus') {
    return { allowed: true, bundledRequestId, reason: 'allowed' };
  }

  if (input.tier === 'guest') {
    if (input.canGenerateImageNow) {
      return { allowed: true, bundledRequestId, reason: 'allowed' };
    }
    return { allowed: false, bundledRequestId, reason: 'guest_image_quota' };
  }

  if (bundledRequestId) {
    return { allowed: true, bundledRequestId, reason: 'allowed' };
  }

  return { allowed: false, bundledRequestId: undefined, reason: 'free_bundle_required' };
}

export function resolveJournalIllustrationSidecar(input: {
  imageUrl?: string | null;
  imageGenerationFailed?: boolean;
  imageJobStatus?: ImageJobStatus | null;
}): JournalIllustrationSidecar {
  if (hasImageUrl(input.imageUrl)) return 'image';
  if (input.imageJobStatus === 'queued' || input.imageJobStatus === 'running') return 'pending';
  if (input.imageGenerationFailed) return 'failed';
  return 'empty';
}

export function shouldShowCompletedJournalReading(
  analysisStatus: AnalysisStatus | undefined,
  isAnalyzed: boolean
): boolean {
  return analysisStatus === 'done' || isAnalyzed;
}

export function resolveJournalIllustrationCta(input: {
  sidecar: JournalIllustrationSidecar;
  isAnalyzed: boolean;
  allowed: boolean;
  reason: JournalIllustrationAccessReason;
  tier: UserTier;
}): JournalIllustrationCta {
  if (input.sidecar === 'image' || input.sidecar === 'pending') {
    return 'none';
  }

  if (input.sidecar === 'failed') {
    if (input.allowed) return 'retry';
    if (input.reason === 'guest_image_quota' || input.tier === 'guest') return 'quota';
    return 'upgrade';
  }

  if (!input.isAnalyzed) return 'none';
  if (input.allowed) return 'illustrate';
  if (input.reason === 'guest_image_quota' || input.tier === 'guest') return 'quota';
  return 'upgrade';
}
