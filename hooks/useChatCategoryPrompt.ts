import { useEffect, useRef } from 'react';

type CategoryPromptOptions = {
  scopeKey: string;
  promptKey: string | null;
  enabled: boolean;
  onSend: () => void;
};

/** Send one category question after its current dream/history/quota inputs settle. */
export function useChatCategoryPrompt({ scopeKey, promptKey, enabled, onSend }: CategoryPromptOptions) {
  const lastSentKey = useRef<string | null>(null);

  useEffect(() => {
    lastSentKey.current = null;
  }, [scopeKey]);

  useEffect(() => {
    if (!enabled || !promptKey || lastSentKey.current === promptKey) return;
    // A cancelled timer has not sent anything. Reserve the key only when dispatch
    // starts, so refreshed dream/history/quota inputs can schedule their question.
    const timer = setTimeout(() => {
      lastSentKey.current = promptKey;
      onSend();
    }, 500);
    return () => clearTimeout(timer);
  }, [scopeKey, enabled, promptKey, onSend]);
}
