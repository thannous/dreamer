import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLucidJournalImport } from '../useLucidJournalImport';
import type { LucidJournalImportRuntimeState } from '@/services/lucidJournalImportRuntime';

let mockUser: { id: string } | null = null;
let mockScope = 'guest';
const mockFactory = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/context/LucidTrainerContext', () => ({ useLucidTrainer: () => ({ userScope: mockScope }) }));
jest.mock('@/lib/supabase', () => ({ getSupabasePublicConfiguration: () => null }));
jest.mock('@/services/lucidJournalImportRuntime', () => ({ createNativeLucidJournalImportRuntime: (...args: unknown[]) => mockFactory(...args) }));
function runtime() {
  const state: LucidJournalImportRuntimeState = { status: 'idle', preparation: null, snapshot: null, progress: null, errorCode: null };
  return { canPrepare: () => false, getState: () => state, subscribe: jest.fn(() => jest.fn()), inspectLocal: jest.fn(async () => undefined),
    prepare: jest.fn(async () => undefined), confirmStart: jest.fn(async () => undefined), updateCopy: jest.fn(async () => undefined),
    deleteAll: jest.fn(async () => undefined), cancel: jest.fn(async () => undefined), ownerChanged: jest.fn(async () => undefined), dispose: jest.fn(async (): Promise<void> => undefined) };
}
beforeEach(() => { jest.clearAllMocks(); mockScope = 'guest'; mockUser = null; });
it('inspects local storage on mount and requires a user action before remote preparation', async () => {
  const engine = runtime(); mockFactory.mockResolvedValue(engine);
  const { result, unmount } = renderHook(useLucidJournalImport);
  await waitFor(() => expect(engine.inspectLocal).toHaveBeenCalledTimes(1));
  expect(engine.prepare).not.toHaveBeenCalled();
  expect(mockFactory.mock.calls[0][0].getOwner()).toBeNull();
  expect(engine.confirmStart).not.toHaveBeenCalled();
  await act(() => result.current.prepare('recent30'));
  expect(engine.prepare).toHaveBeenCalledWith('recent30');
  unmount();
  await waitFor(() => expect(engine.dispose).toHaveBeenCalledTimes(1));
});
it('invalidates the previous owner synchronously and cleans up on transition', async () => {
  mockUser = { id: '11111111-1111-4111-8111-111111111111' };
  mockScope = `user:${mockUser.id}`;
  const first = runtime(); const second = runtime();
  mockFactory.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const { result, rerender } = renderHook(useLucidJournalImport);
  await waitFor(() => expect(result.current.available).toBe(true));
  const oldPrepare = result.current.prepare;
  const deps = mockFactory.mock.calls[0][0];
  const oldGeneration = deps.getOwnerGeneration();
  expect(deps.getOwner()).toBe('11111111-1111-4111-8111-111111111111');
  mockUser = { id: '22222222-2222-4222-8222-222222222222' };
  mockScope = `user:${mockUser.id}`;
  rerender({});
  expect(deps.getOwnerGeneration()).not.toBe(oldGeneration);
  expect(deps.getOwner()).toBe('22222222-2222-4222-8222-222222222222');
  await act(() => oldPrepare('all'));
  expect(first.prepare).not.toHaveBeenCalled();
  await waitFor(() => expect(second.inspectLocal).toHaveBeenCalledTimes(1));
  expect(first.ownerChanged).not.toHaveBeenCalled();
  expect(first.dispose).toHaveBeenCalledTimes(1);
});
it('disposes a factory completing after unmount without inspecting storage', async () => {
  let resolve!: (value: ReturnType<typeof runtime>) => void;
  mockFactory.mockReturnValue(new Promise(done => { resolve = done; }));
  const { unmount } = renderHook(useLucidJournalImport);
  await act(async () => {});
  unmount();
  const engine = runtime();
  await act(async () => resolve(engine));
  await waitFor(() => expect(engine.dispose).toHaveBeenCalledTimes(1));
  expect(engine.inspectLocal).not.toHaveBeenCalled();
});

it('waits for previous credential teardown before creating the next owner runtime', async () => {
 const first=runtime(), second=runtime();let finish!:()=>void;
 first.dispose.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 mockFactory.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
 const {rerender}=renderHook(useLucidJournalImport);
 await waitFor(()=>expect(first.inspectLocal).toHaveBeenCalled());
 mockUser={id:'11111111-1111-4111-8111-111111111111'};mockScope=`user:${mockUser.id}`;
 rerender({});await act(async()=>{});
 expect(mockFactory).toHaveBeenCalledTimes(1);
 await act(async()=>finish());
 await waitFor(()=>expect(second.inspectLocal).toHaveBeenCalled());
});

it('also waits for credential teardown across route remounts', async () => {
 const first=runtime(), second=runtime();let finish!:()=>void;
 first.dispose.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 mockFactory.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
 const initial=renderHook(useLucidJournalImport);
 await waitFor(()=>expect(first.inspectLocal).toHaveBeenCalled());initial.unmount();
 renderHook(useLucidJournalImport);await act(async()=>{});
 expect(mockFactory).toHaveBeenCalledTimes(1);
 await act(async()=>finish());
 await waitFor(()=>expect(second.inspectLocal).toHaveBeenCalled());
});
