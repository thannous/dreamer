import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCaptureQuestion } from '@/services/captureConversation';
import { getCaptureFallbackQuestion } from '@/lib/dreamRecallQuestions';
import { hasAiConsent } from '@/lib/aiConsent';

export const CAPTURE_MAX_QUESTIONS = 3;

type Options = {
  language: string;
  t: (key: string) => string;
  scope?: string;
  /** Asks the narrator for AI consent. Called at most once per account scope, when the first question is due. */
  requestConsent?: () => Promise<boolean>;
};

/** Network results belong to one draft revision. The editor persists answered questions with their answers. */
export function useCaptureConversation({ language, t, scope, requestConsent }: Options) {
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
  const consentRequest = useRef<Promise<boolean> | null>(null);

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
    const askLocally = (failed: boolean) => {
      // A general local question keeps capture usable, without pretending it was personalized.
      // Only a failed request says help is unavailable: without consent nothing has failed.
      const fallback = getCaptureFallbackQuestion(text, previous.current.length, t).text;
      setQuestion(fallback);
      setUnavailable(failed);
      previous.current.push(fallback);
    };
    try {
      // The transcript goes to the AI provider: without consent stay local. A question is only
      // due once the microphone has stopped, so asking here interrupts no capture. Ask once:
      // a narrator who declines keeps the general questions without being asked again, and a
      // revision arriving while the dialog is open waits for the same answer.
      let consented = await hasAiConsent();
      if (!consented && requestConsent && generation.current === owner) {
        consentRequest.current ??= requestConsent().catch(() => false);
        consented = await consentRequest.current;
      }
      if (!consented) {
        if (generation.current !== owner) return;
        askLocally(false);
        return;
      }
      if (generation.current !== owner || abort.signal.aborted) return;
      const result = await requestCaptureQuestion(text, language, [...previous.current], abort.signal);
      if (generation.current !== owner) return;
      setQuestion(result.question);
      setDone(result.done);
      finished.current = result.done;
      if (result.question) previous.current.push(result.question);
      return result.done;
    } catch {
      if (generation.current !== owner) return;
      askLocally(true);
    } finally {
      if (generation.current === owner) {
        controller.current = null;
        setLoading(false);
      }
    }
  }, [language, rememberQuestions, requestConsent, t]);

  useEffect(() => {
    // Account identity is external state: cancel its pending request and clear its visible question together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
    consentRequest.current = null;
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [scope, reset]);
  return { question, loading, unavailable, done, needsDecision, ask, reset, cancel, invalidateSource };
}
