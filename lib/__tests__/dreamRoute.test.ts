import { getDreamRouteParams, resolveDreamRoute } from '../dreamRoute';
import { buildReflectionResumeHref } from '../dreamUsage';
import type { DreamAnalysis } from '../types';

const dreams = Array.from({ length: 2501 }, (_, index) => ({
  id: 1234, remoteId: index + 1, clientRequestId: `request-${index + 1}`, title: `Dream ${index + 1}`,
})) as DreamAnalysis[];

it.each([17, 2501])('routes dream %i without conflating equal creation dates', remoteId => {
  const selected = dreams[remoteId - 1];
  expect(resolveDreamRoute(dreams, getDreamRouteParams(selected))).toBe(selected);
  expect(getDreamRouteParams(selected)).toEqual({ id: '1234', remoteId: String(remoteId), clientRequestId: `request-${remoteId}` });
});
it('fails closed for ambiguous legacy routes, unknown identities, or malformed parameters', () => {
  for (const params of [{ id: '1234' }, { id: '1234', remoteId: '2502' }, { id: '1234', remoteId: 'bad' }, { id: '1234', remoteId: ['17', '2501'] }, { id: '1234', clientRequestId: '' }]) {
    expect(resolveDreamRoute(dreams, params)).toBeUndefined();
  }
  expect(resolveDreamRoute([dreams[0]], { id: '1234' })).toBe(dreams[0]);
});
it('retains identity through reflection resume links', () => {
  expect(buildReflectionResumeHref(dreams[2500], { kind: 'categories' })).toEqual({
    pathname: '/dream-categories/[id]', params: getDreamRouteParams(dreams[2500]),
  });
});
