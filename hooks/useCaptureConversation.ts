import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCaptureQuestion } from '@/services/captureConversation';
import { getCaptureFallbackQuestion } from '@/lib/dreamRecallQuestions';
import { hasAiConsent } from '@/lib/aiConsent';

export const CAPTURE_MAX_QUESTIONS = 3;

type ConversationState =
  | { status: 'idle' | 'asking' | 'decision' }
  | { status: 'question'; question: string | null; unavailable: boolean }
  | { status: 'done'; question: string | null };

// One shared idle snapshot: resetting an idle conversation does not re-render the screen.
const IDLE: ConversationState = { status: 'idle' };

type Options = {
  language: string;
  t: (key: string) => string;
  scope?: string;
  /** Asks the narrator for AI consent. Called at most once per account scope, when the first question is due. */
  requestConsent?: () => Promise<boolean>;
};

/** Network results belong to one draft revision. The editor persists answered questions with their answers. */
export function useCaptureConversation({ language, t, scope, requestConsent }: Options) {
  const [state, setState] = useState<ConversationState>(IDLE);
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
    setState(current => current.status === 'asking' ? IDLE : current);
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    requested.current = '';
    previous.current = [];
    setState(IDLE);
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
    if (finished.current || previous.current.length >= CAPTURE_MAX_QUESTIONS) {
      finished.current = true;
      setState({ status: 'done', question: null });
    } else {
      setState({ status: 'decision' });
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
      finished.current = true;
      setState({ status: 'done', question: null });
      return true;
    }
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'asking' });
    const askLocally = (failed: boolean) => {
      // A general local question keeps capture usable, without pretending it was personalized.
      // Only a failed request says help is unavailable: without consent nothing has failed.
      const fallback = getCaptureFallbackQuestion(text, previous.current.length, t).text;
      setState({ status: 'question', question: fallback, unavailable: failed });
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
        const request = consentRequest.current;
        consented = await request;
        // Only a refusal is remembered: a grant withdrawn in Settings later must be asked again.
        if (consented && consentRequest.current === request) consentRequest.current = null;
      }
      if (!consented) {
        if (generation.current !== owner) return;
        askLocally(false);
        return;
      }
      if (generation.current !== owner || abort.signal.aborted) return;
      const result = await requestCaptureQuestion(text, language, [...previous.current], abort.signal);
      if (generation.current !== owner) return;
      setState(result.done
        ? { status: 'done', question: result.question }
        : { status: 'question', question: result.question, unavailable: false });
      finished.current = result.done;
      if (result.question) previous.current.push(result.question);
      return result.done;
    } catch {
      if (generation.current !== owner) return;
      askLocally(true);
    } finally {
      if (generation.current === owner) {
        controller.current = null;
        setState(current => current.status === 'asking' ? IDLE : current);
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
  return {
    question: 'question' in state ? state.question : null,
    loading: state.status === 'asking',
    unavailable: state.status === 'question' && state.unavailable,
    done: state.status === 'done',
    needsDecision: state.status === 'decision',
    ask, reset, cancel, invalidateSource,
  };
}
