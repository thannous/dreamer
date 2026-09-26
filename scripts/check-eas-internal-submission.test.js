'use strict';
/* global describe, expect, it, jest */

const { findConflictingSubmission } = require('./check-eas-internal-submission');

const BUILD_ID = '3273c3cd-b5c4-4381-aaf5-025d124533fd';

describe('EAS internal submission preflight', () => {
  it('finds a completed submission on a later page before allowing another upload', async () => {
    const queryPage = jest.fn(async ({ offset }) => offset === 0
      ? [
          { id: 'other-1', status: 'FINISHED', submittedBuild: { id: 'other-build-1' } },
          { id: 'other-2', status: 'ERRORED', submittedBuild: { id: 'other-build-2' } },
        ]
      : [{ id: 'duplicate', status: 'FINISHED', submittedBuild: { id: BUILD_ID }, androidConfig: { track: 'internal' } }]);

    await expect(findConflictingSubmission(queryPage, BUILD_ID, 'android', 2))
      .resolves.toEqual(expect.objectContaining({ id: 'duplicate', status: 'FINISHED' }));
    expect(queryPage).toHaveBeenCalledWith({ platform: 'ANDROID', offset: 2, limit: 2 });
    expect(queryPage.mock.calls.every(([args]) => !Object.hasOwn(args, 'status'))).toBe(true);
  });

  it.each(['FINISHED', 'IN_PROGRESS', 'IN_QUEUE', 'AWAITING_BUILD'])
    ('blocks an existing %s submission of the same build', async status => {
      const queryPage = jest.fn(async () => [{ id: 'existing', status, submittedBuild: { id: BUILD_ID } }]);

      await expect(findConflictingSubmission(queryPage, BUILD_ID, 'android'))
        .resolves.toEqual(expect.objectContaining({ id: 'existing', status }));
    });

  it('allows a retry after errors or cancellations and ignores other builds', async () => {
    const queryPage = jest.fn(async () => [
      { id: 'failed', status: 'ERRORED', submittedBuild: { id: BUILD_ID } },
      { id: 'canceled', status: 'CANCELED', submittedBuild: { id: BUILD_ID } },
      { id: 'other', status: 'FINISHED', submittedBuild: { id: 'different-build' } },
    ]);

    await expect(findConflictingSubmission(queryPage, BUILD_ID, 'ios')).resolves.toBeNull();
    expect(queryPage).toHaveBeenCalledWith({ platform: 'IOS', offset: 0, limit: 50 });
  });

  it('does not lose a submission that finishes while the history is being read', async () => {
    let status = 'IN_PROGRESS';
    const queryPage = jest.fn(async ({ status: requestedStatus }) => {
      const observed = status;
      status = 'FINISHED';
      return requestedStatus && requestedStatus !== observed
        ? []
        : [{ id: 'transitioning', status: observed, submittedBuild: { id: BUILD_ID } }];
    });

    await expect(findConflictingSubmission(queryPage, BUILD_ID, 'android'))
      .resolves.toEqual(expect.objectContaining({ id: 'transitioning' }));
  });

  it('fails closed when EAS lookup fails or returns malformed data', async () => {
    await expect(findConflictingSubmission(async () => { throw new Error('EAS unavailable'); }, BUILD_ID, 'android'))
      .rejects.toThrow('EAS unavailable');
    await expect(findConflictingSubmission(async () => null, BUILD_ID, 'android'))
      .rejects.toThrow('Invalid EAS submission response');
  });
});
