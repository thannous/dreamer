import type { Href } from 'expo-router';

import type { PaywallTrigger } from '@/lib/analytics';
import { getDreamRouteParams, type DreamRouteParams } from '@/lib/dreamRoute';
import type { DreamAnalysis } from '@/lib/types';

export type AnalysisPaywallParams = {
  dreamId?: string;
  dreamRemoteId?: string;
  dreamClientRequestId?: string;
  dreamOwnerId?: string;
};

export function buildAnalysisPaywallHref(dream: DreamAnalysis, ownerId: string): Href {
  const route = getDreamRouteParams(dream);
  return {
    pathname: '/paywall',
    params: {
      trigger: 'analysis_cta',
      dreamId: route.id,
      dreamRemoteId: route.remoteId,
      dreamClientRequestId: route.clientRequestId,
      dreamOwnerId: ownerId,
    },
  } as Href;
}

/** Only resume the saved dream for the account that opened this offer. */
export function getAnalysisReturnRoute(params: AnalysisPaywallParams, ownerId?: string): Href | null {
  if (!ownerId || params.dreamOwnerId !== ownerId
    || typeof params.dreamId !== 'string' || !params.dreamId.trim()
    || !Number.isFinite(Number(params.dreamId))) return null;
  const route: DreamRouteParams = { id: params.dreamId };
  if (params.dreamRemoteId !== undefined) {
    if (typeof params.dreamRemoteId !== 'string' || !/^\d+$/.test(params.dreamRemoteId)
      || !Number.isSafeInteger(Number(params.dreamRemoteId)) || Number(params.dreamRemoteId) <= 0) return null;
    route.remoteId = params.dreamRemoteId;
  }
  if (params.dreamClientRequestId !== undefined) {
    if (typeof params.dreamClientRequestId !== 'string' || !params.dreamClientRequestId.trim()) return null;
    route.clientRequestId = params.dreamClientRequestId;
  }
  return {
    pathname: '/journal/[id]',
    params: { ...route, analyzeAfterPurchase: '1', analysisOwnerId: ownerId },
  } as Href;
}

export function buildPaywallHref(trigger: PaywallTrigger): Href {
  return {
    pathname: '/paywall',
    params: { trigger },
  } as Href;
}
