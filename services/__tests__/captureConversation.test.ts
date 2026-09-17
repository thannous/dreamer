import { requestCaptureQuestion, formatCaptureNarrative } from '../captureConversation';
import { fetchJSONWithSession } from '@/lib/apiSession';

jest.mock('@/lib/apiSession', () => ({ fetchJSONWithSession: jest.fn() }));
let mockBaseUrl = 'https://api.example.test';
jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => mockBaseUrl }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
const fetch = jest.mocked(fetchJSONWithSession);

beforeEach(() => { fetch.mockReset(); mockBaseUrl = 'https://api.example.test'; });

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

it.each([
  ['https://project.supabase.co/functions/v1/api', 'https://project.supabase.co/functions/v1/capture-recall/recall-question'],
  ['https://project.functions.supabase.co/api', 'https://project.functions.supabase.co/capture-recall/recall-question'],
])('uses the isolated recall function for the hosted base %s', async (base, endpoint) => {
  mockBaseUrl = base;
  fetch.mockResolvedValue({ question: null, done: true });
  await requestCaptureQuestion('Un jardin.', 'fr', []);
  expect(fetch).toHaveBeenCalledWith(endpoint, expect.any(Object));
});

it('formats through the isolated route without automatic retries and rejects unusable proposals', async () => {
  mockBaseUrl = 'https://project.supabase.co/functions/v1/api';
  fetch.mockResolvedValueOnce({ transcript: ' Une plage noire. ' });
  expect(await formatCaptureNarrative('Une plage. Question : couleur ? Réponse : noire.', 'fr')).toBe('Une plage noire.');
  expect(fetch).toHaveBeenLastCalledWith('https://project.supabase.co/functions/v1/capture-recall/format-recall', expect.objectContaining({ retries: 0, timeoutMs: 45000 }));
  for (const response of [{}, { transcript: '' }, { transcript: 'a'.repeat(20001) }]) {
    fetch.mockResolvedValueOnce(response);
    await expect(formatCaptureNarrative('Une plage.', 'fr')).rejects.toThrow('Invalid formatted narrative');
  }
});
