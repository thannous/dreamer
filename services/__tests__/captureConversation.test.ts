import { requestCaptureQuestion } from '../captureConversation';
import { fetchJSONWithSession } from '@/lib/apiSession';

jest.mock('@/lib/apiSession', () => ({ fetchJSONWithSession: jest.fn() }));
jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
const fetch = jest.mocked(fetchJSONWithSession);

beforeEach(() => fetch.mockReset());

it('sends only the narrative and question history through the authenticated API with cancellation', async () => {
  fetch.mockResolvedValue({ question: 'Que te revient-il du jardin ?', done: false });
  const controller = new AbortController();
  const result = await requestCaptureQuestion('Un jardin.', 'fr', ['Où étais-tu ?'], controller.signal);
  expect(result.question).toBe('Que te revient-il du jardin ?');
  expect(fetch).toHaveBeenCalledWith('https://api.example.test/recall-question', expect.objectContaining({
    method: 'POST', body: { transcript: 'Un jardin.', lang: 'fr', previousQuestions: ['Où étais-tu ?'] },
    signal: controller.signal,
  }));
});

it.each([
  {}, { done: false, question: null }, { done: true, question: 'Une question ?' },
  { done: false, question: '' }, { done: false, question: 123 },
])('rejects a malformed conversation response: %j', async response => {
  fetch.mockResolvedValue(response);
  await expect(requestCaptureQuestion('Un jardin.', 'fr', [])).rejects.toThrow('Invalid recall response');
});
