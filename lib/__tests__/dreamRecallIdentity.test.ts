import { getDreamRecallStorageId } from '../dreamRecallIdentity';

it('keeps the client key stable when remote identity is assigned or the date changes', () => {
  const dream = { id: 42, clientRequestId: 'original-request' };
  const key = getDreamRecallStorageId(dream, 'account-a');
  expect(getDreamRecallStorageId({ ...dream, id: 43, remoteId: 2501 }, 'account-a')).toBe(key);
  expect(key).toBe('account-a:client:original-request');
});
it('separates accounts and equal-date remote dreams', () => {
  expect(getDreamRecallStorageId({ id: 42, remoteId: 17 }, 'account-a')).not.toBe(getDreamRecallStorageId({ id: 42, remoteId: 2501 }, 'account-a'));
  expect(getDreamRecallStorageId({ id: 42, clientRequestId: 'same' }, 'account-a')).not.toBe(getDreamRecallStorageId({ id: 42, clientRequestId: 'same' }, 'account-b'));
});
it('retains numeric storage only for identityless legacy dreams', () => {
  expect(getDreamRecallStorageId({ id: 42 }, null)).toBe('42');
  expect(getDreamRecallStorageId({ id: 42, remoteId: 17 }, null)).toBe('guest:remote:17');
});
