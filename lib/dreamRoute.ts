import type { DreamAnalysis } from './types';
import { resolveDreamTarget, type DreamTarget } from './dreamIdentity';

export type DreamRouteParams = { id: string; remoteId?: string; clientRequestId?: string };
type IncomingDreamRouteParams = {
  id?: string | string[];
  remoteId?: string | string[];
  clientRequestId?: string | string[];
};

/** Dates remain URL labels; stable identity disambiguates dreams created together. */
export function getDreamRouteParams(target: DreamTarget): DreamRouteParams {
  if (typeof target === 'number') return { id: String(target) };
  return {
    id: String(target.id),
    ...(target.remoteId != null ? { remoteId: String(target.remoteId) } : {}),
    ...(target.clientRequestId ? { clientRequestId: target.clientRequestId } : {}),
  };
}

/** Malformed or ambiguous legacy links must not select an arbitrary dream. */
export function resolveDreamRoute(dreams: DreamAnalysis[], params: IncomingDreamRouteParams): DreamAnalysis | undefined {
  if (typeof params.id !== 'string' || !params.id.trim() || !Number.isFinite(Number(params.id))) return undefined;
  const id = Number(params.id);
  if (params.remoteId !== undefined && (typeof params.remoteId !== 'string' || !/^\d+$/.test(params.remoteId) || !Number.isSafeInteger(Number(params.remoteId)) || Number(params.remoteId) <= 0)) return undefined;
  if (params.clientRequestId !== undefined && (typeof params.clientRequestId !== 'string' || !params.clientRequestId.trim())) return undefined;
  return resolveDreamTarget(dreams, params.remoteId === undefined && params.clientRequestId === undefined ? id : {
    id,
    ...(params.remoteId !== undefined ? { remoteId: Number(params.remoteId) } : {}),
    ...(params.clientRequestId !== undefined ? { clientRequestId: params.clientRequestId as string } : {}),
  });
}
