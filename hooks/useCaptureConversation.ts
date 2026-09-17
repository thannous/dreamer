import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCaptureQuestion } from '@/services/captureConversation';
import { getDreamRecallQuestion } from '@/lib/dreamRecallQuestions';

export const CAPTURE_MAX_QUESTIONS = 3;

type Options = { language: string; t: (key: string) => string; scope?: string };

/** Network results belong to one draft revision. The editor persists answered questions with their answers. */
export function useCaptureConversation({ language, t, scope }: Options) {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [done, setDone] = useState(false);
  const [needsDecision, setNeedsDecision] = useState(false);
  const finished = useRef(false);
  const previous = useRef<string[]>([]);
  const requested = useRef('');
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const cancel = useCallback(() => {
    if (controller.current) requested.current = '';
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    requested.current = '';
    previous.current = [];
    setQuestion(null);
    setLoading(false);
    setUnavailable(false);
    setDone(false);
    setNeedsDecision(false);
    finished.current = false;
  }, []);

  const rememberQuestions = useCallback((text: string) => {
    const label = t('recording.conversation.question_label');
    const restored = text.split(/\r?\n/).filter(line => line.startsWith(label)).map(line => line.slice(label.length).trim()).filter(Boolean);
    if (restored.length > previous.current.length) previous.current = restored;
  }, [t]);

  const invalidateSource = useCallback((transcript: string) => {
    rememberQuestions(transcript);
    cancel();
    requested.current = '';
    setQuestion(null);
    setUnavailable(false);
    if (finished.current || previous.current.length >= CAPTURE_MAX_QUESTIONS) {
      finished.current = true;
      setDone(true);
      setNeedsDecision(false);
    } else {
      setNeedsDecision(true);
    }
  }, [cancel, rememberQuestions]);

  const ask = useCallback(async (transcript: string) => {
    const text = transcript.trim();
    const key = `${language}:${text}`;
    if (finished.current) return true;
    if (!text || requested.current === key) return;
    controller.current?.abort();
    const owner = ++generation.current;
    requested.current = key;
    // Restored drafts already contain their answered questions; reopening must not reset the cap.
    rememberQuestions(text);
    if (previous.current.length >= CAPTURE_MAX_QUESTIONS) {
      setQuestion(null);
      finished.current = true;
      setDone(true);
      setNeedsDecision(false);
      setLoading(false);
      setUnavailable(false);
      return true;
    }
    const abort = new AbortController();
    controller.current = abort;
    setNeedsDecision(false);
    setLoading(true);
    setQuestion(null);
    setUnavailable(false);
    setDone(false);
    try {
      const result = await requestCaptureQuestion(text, language, [...previous.current], abort.signal);
      if (generation.current !== owner) return;
      setQuestion(result.question);
      setDone(result.done);
      finished.current = result.done;
      if (result.question) previous.current.push(result.question);
      return result.done;
    } catch {
      if (generation.current !== owner) return;
      // A general local question keeps capture usable offline, without pretending it was personalized.
      const fallback = getDreamRecallQuestion(previous.current.length, t).text;
      setQuestion(fallback);
      setUnavailable(true);
      previous.current.push(fallback);
    } finally {
      if (generation.current === owner) {
        controller.current = null;
        setLoading(false);
      }
    }
  }, [language, rememberQuestions, t]);

  useEffect(() => {
    // Account identity is external state: cancel its pending request and clear its visible question together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [scope, reset]);
  return { question, loading, unavailable, done, needsDecision, ask, reset, cancel, invalidateSource };
}
