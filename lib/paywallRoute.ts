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
let pendingPurchasedAnalysis: { key: string; createdAt: number } | null = null;
const PURCHASE_RETURN_TTL_MS = 10 * 60 * 1000;

function analysisReturnKey(route: DreamRouteParams, ownerId: string): string {
  const identity = route.clientRequestId ? ['client', route.clientRequestId]
    : route.remoteId ? ['remote', route.remoteId] : ['local', route.id];
  return JSON.stringify([ownerId, identity]);
}

/** A route flag alone is not consent to launch an analysis. Consume the purchase once. */
export function consumePurchasedAnalysisReturn(route: DreamRouteParams, ownerId: string): boolean {
  if (!pendingPurchasedAnalysis) return false;
  const intent = pendingPurchasedAnalysis;
  if (Date.now() - intent.createdAt > PURCHASE_RETURN_TTL_MS) {
    pendingPurchasedAnalysis = null;
    return false;
  }
  if (intent.key !== analysisReturnKey(route, ownerId)) return false;
  pendingPurchasedAnalysis = null;
  return true;
}

/** Call only after the store confirms active access from this contextual offer. */
export function requestAnalysisReturnRoute(params: AnalysisPaywallParams, ownerId?: string): Href | null {
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
  pendingPurchasedAnalysis = { key: analysisReturnKey(route, ownerId), createdAt: Date.now() };
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
