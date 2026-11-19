import React, { useCallback, useEffect, useRef, useState } from 'react';

import { OfflineModelCheckContext } from '@/context/OfflineModelCheckContext';
import { ensureOfflineSttModel } from '@/services/nativeSpeechRecognition';
import { OfflineModelDownloadSheet } from './OfflineModelDownloadSheet';

type DownloadPrompt = { selection: number; locale: string; visible: boolean; close: () => void };

export function OfflineModelPromptProvider({ children }: React.PropsWithChildren) {
  const mounted = useRef(false);
  const selection = useRef(0);
  const dismiss = useRef<(() => void) | null>(null);
  const [prompt, setPrompt] = useState<DownloadPrompt | null>(null);

  const check = useCallback(async (locale: string) => {
    if (!mounted.current) return false;
    const ticket = ++selection.current;
    dismiss.current?.();

    return ensureOfflineSttModel(locale, () => {
      // Another settings surface can change language while Android probes its installed packs.
      if (!mounted.current || ticket !== selection.current) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const close = () => {
          resolve();
          if (dismiss.current !== close) return;
          dismiss.current = null;
          if (mounted.current) {
            setPrompt((current) => current && { ...current, visible: false });
          }
        };
        dismiss.current = close;
        setPrompt({ selection: ticket, locale, visible: true, close });
      });
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    selection.current++;
    return () => {
      mounted.current = false;
      dismiss.current?.();
    };
  }, []);

  return (
    <OfflineModelCheckContext.Provider value={check}>
      {children}
      {prompt && (
        <OfflineModelDownloadSheet
          key={prompt.selection}
          locale={prompt.locale}
          visible={prompt.visible}
          onClose={prompt.close}
        />
      )}
    </OfflineModelCheckContext.Provider>
  );
}
