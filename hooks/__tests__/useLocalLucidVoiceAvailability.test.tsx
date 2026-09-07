import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLocalLucidVoiceAvailability } from '../useLocalLucidVoiceAvailability';
import { loadLocalLucidVoiceExperimentIds, subscribeLucidMorningVoiceNotes } from '@/services/lucidMorningVoiceNoteStorage';

jest.mock('@/services/lucidMorningVoiceNoteStorage', () => ({
  loadLocalLucidVoiceExperimentIds: jest.fn(),
  subscribeLucidMorningVoiceNotes: jest.fn(),
}));
const load = jest.mocked(loadLocalLucidVoiceExperimentIds);
let notify: (scope: string) => void;
beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue(new Set());
  jest.mocked(subscribeLucidMorningVoiceNotes).mockImplementation(listener => {
    notify = listener;
    return jest.fn();
  });
});
it('refreshes after a local link and deletion, ignoring other scopes', async () => {
  const { result } = renderHook(() => useLocalLucidVoiceAvailability('guest'));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  load.mockResolvedValue(new Set(['experiment']));
  act(() => notify('user:other'));
  expect(load).toHaveBeenCalledTimes(1);
  act(() => notify('guest'));
  await waitFor(() => expect(result.current.has('experiment')).toBe(true));
  load.mockResolvedValue(new Set());
  act(() => notify('guest'));
  await waitFor(() => expect(result.current.size).toBe(0));
});
it('hides the old account immediately and ignores its delayed read', async () => {
  let finish!: (ids: ReadonlySet<string>) => void;
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender } = renderHook<ReadonlySet<string>, { scope: string }>(({ scope }) => useLocalLucidVoiceAvailability(scope), { initialProps: { scope: 'guest' } });
  rerender({ scope: 'user:next' });
  expect(result.current.size).toBe(0);
  await act(async () => finish(new Set(['old-private-note'])));
  expect(result.current.size).toBe(0);
});
it('fails closed after a read failure and discards an older refresh result', async () => {
  let finish!: (ids: ReadonlySet<string>) => void;
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useLocalLucidVoiceAvailability('guest'));
  load.mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => notify('guest'));
  await act(async () => finish(new Set(['stale'])));
  expect(result.current.size).toBe(0);
});
