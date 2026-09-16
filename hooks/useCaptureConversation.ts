import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCaptureQuestion } from '@/services/captureConversation';
import { getDreamRecallQuestion, DREAM_RECALL_MAX_QUESTIONS } from '@/lib/dreamRecallQuestions';

type Options = { language: string; t: (key: string) => string; scope?: string };

/** Network results belong to one draft revision. The editor persists answered questions with their answers. */
export function useCaptureConversation({ language, t, scope }: Options) {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [done, setDone] = useState(false);
  const previous = useRef<string[]>([]);
  const requested = useRef('');
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    requested.current = '';
    previous.current = [];
    setQuestion(null);
    setLoading(false);
    setUnavailable(false);
    setDone(false);
  }, []);

  const ask = useCallback(async (transcript: string) => {
    const text = transcript.trim();
    const key = `${language}:${text}`;
    if (!text || requested.current === key) return;
    controller.current?.abort();
    const owner = ++generation.current;
    requested.current = key;
    if (previous.current.length >= DREAM_RECALL_MAX_QUESTIONS) {
      setQuestion(null);
      setDone(true);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setQuestion(null);
    setUnavailable(false);
    setDone(false);
    try {
      const result = await requestCaptureQuestion(text, language, [...previous.current], abort.signal);
      if (generation.current !== owner) return;
      setQuestion(result.question);
      setDone(result.done);
      if (result.question) previous.current.push(result.question);
    } catch {
      if (generation.current !== owner) return;
      // A general local question keeps capture usable offline, without pretending it was personalized.
      const fallback = getDreamRecallQuestion(previous.current.length, t).text;
      setQuestion(fallback);
      setUnavailable(true);
      previous.current.push(fallback);
    } finally {
      if (generation.current === owner) setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    // Account identity is external state: cancel its pending request and clear its visible question together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [scope, reset]);
  return { question, loading, unavailable, done, ask, reset };
}
