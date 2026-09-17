/* @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useCaptureConversation } from '../useCaptureConversation';
import { requestCaptureQuestion } from '@/services/captureConversation';
jest.mock('@/services/captureConversation', () => ({ requestCaptureQuestion: jest.fn() }));
const request = jest.mocked(requestCaptureQuestion);
const t = () => 'De quoi d’autre te souviens-tu ?';
beforeEach(() => request.mockReset());

it('requests a grounded question once per completed transcript revision', async () => {
  request.mockResolvedValue({ question: 'Que voyais-tu dans ce jardin ?', done: false });
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  await act(async () => { await result.current.ask('Un jardin.'); });
  await act(async () => { await result.current.ask('Un jardin.'); });
  expect(request).toHaveBeenCalledTimes(1);
  expect(result.current.question).toBe('Que voyais-tu dans ce jardin ?');
  await act(async () => { await result.current.ask('Un jardin. Une porte ouverte.'); });
  expect(request.mock.calls[1][2]).toEqual(['Que voyais-tu dans ce jardin ?']);
});

it('keeps capture usable with an explicitly general question on network failure', async () => {
  request.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  await act(async () => { await result.current.ask('Un jardin.'); });
  expect(result.current).toMatchObject({ question: t(), loading: false, unavailable: true });
});

it('discards a stale question after the draft is cleared', async () => {
  let resolve!: (value: { question: string; done: boolean }) => void;
  request.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  let pending!: ReturnType<typeof result.current.ask>;
  act(() => { pending = result.current.ask('Ancien rêve'); });
  act(() => result.current.reset());
  await act(async () => { resolve({ question: 'Ancienne question ?', done: false }); await pending; });
  expect(result.current).toMatchObject({ question: null, loading: false, done: false });
});

it('ends the conversation when the provider has no useful further question', async () => {
  request.mockResolvedValue({ question: null, done: true });
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  await act(async () => { await result.current.ask('Je ne me souviens plus.'); });
  expect(result.current).toMatchObject({ question: null, done: true, unavailable: false });
});

it('stops after three questions and discards a response when the account scope changes', async () => {
  request.mockResolvedValue({ question: 'Une question ?', done: false });
  const { result, rerender } = renderHook(({ scope }) => useCaptureConversation({ language: 'fr', t, scope }), { initialProps: { scope: 'guest' } });
  for (let revision = 0; revision < 4; revision++) {
    await act(async () => { await result.current.ask(`Récit ${revision}`); });
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(result.current.done).toBe(true);
  rerender({ scope: 'user-one' });
  let resolve!: (value: { question: string; done: boolean }) => void;
  request.mockImplementation(() => new Promise(r => { resolve = r; }));
  let pending!: ReturnType<typeof result.current.ask>;
  act(() => { pending = result.current.ask('Un autre rêve'); });
  const signal = request.mock.calls.at(-1)![3];
  rerender({ scope: 'user-two' });
  expect(signal?.aborted).toBe(true);
  await act(async () => { resolve({ question: 'Ancienne question ?', done: false }); await pending; });
  expect(result.current.question).toBeNull();
});

it('does not restart the three-question allowance on a restored draft', async () => {
  const translate = (key: string) => key === 'recording.conversation.question_label' ? 'Question :' : 'Autre chose ?';
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t: translate }));
  await act(async () => { await result.current.ask('Une plage.\nQuestion : Un ?\nRéponse : oui\nQuestion : Deux ?\nRéponse : non\nQuestion : Trois ?\nRéponse : peut-être'); });
  expect(request).not.toHaveBeenCalled();
  expect(result.current.done).toBe(true);
});

it('invalidates an edited question without requesting another and retains the question budget', async () => {
  request.mockResolvedValue({ question: 'Que cherchais-tu ?', done: false });
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  await act(async () => { await result.current.ask('Je cherchais.'); });
  act(() => result.current.invalidateSource('Je cherchais.'));
  expect(result.current).toMatchObject({ question: null, needsDecision: true, loading: false });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.ask('Je cherchais une valise.'); });
  expect(request.mock.calls[1][2]).toEqual(['Que cherchais-tu ?']);
  expect(result.current.needsDecision).toBe(false);
  await act(async () => { await result.current.ask('Une valise rouge.'); });
  act(() => result.current.invalidateSource('Une valise rouge.'));
  expect(result.current).toMatchObject({ question: null, done: true, needsDecision: false });
  await act(async () => { await result.current.ask('Une valise bleue.'); });
  expect(request).toHaveBeenCalledTimes(3);
});

it('preserves an early finished state after editing and never asks again', async () => {
  request.mockResolvedValue({ question: null, done: true });
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  await act(async () => { await result.current.ask('Une image.'); });
  act(() => result.current.invalidateSource('Une image.'));
  await act(async () => { await result.current.ask('Une image bleue.'); });
  expect(result.current).toMatchObject({ done: true, needsDecision: false, question: null });
  expect(request).toHaveBeenCalledTimes(1);
});

it('discards a pending question when its source is edited', async () => {
  let resolve!: (value: { question: string; done: boolean }) => void;
  request.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { result } = renderHook(() => useCaptureConversation({ language: 'fr', t }));
  let pending!: ReturnType<typeof result.current.ask>;
  act(() => { pending = result.current.ask('Je cherchais.'); });
  act(() => result.current.invalidateSource('Je cherchais.'));
  expect(request.mock.calls[0][3]?.aborted).toBe(true);
  await act(async () => { resolve({ question: 'Que cherchais-tu ?', done: false }); await pending; });
  expect(result.current).toMatchObject({ question: null, needsDecision: true, loading: false });
});
