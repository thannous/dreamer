import React, { useCallback, useEffect, useRef, useState } from 'react';

import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import {
  registerOfflineModelPromptHandler,
  type OfflineModelPromptHandler,
} from '@/services/nativeSpeechRecognition';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: () => resolve?.(),
  };
}

export function OfflineModelPromptHost() {
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState('');
  const deferredRef = useRef<Deferred | null>(null);
  const isVisibleRef = useRef(false);

  const resolvePrompt = useCallback(() => {
    const deferred = deferredRef.current;
    deferredRef.current = null;
    deferred?.resolve();
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setLocale('');
    resolvePrompt();
  }, [resolvePrompt]);

  const show = useCallback(async (nextLocale: string) => {
    setLocale(nextLocale);
    setVisible(true);

    if (!deferredRef.current) {
      deferredRef.current = createDeferred();
    }

    await deferredRef.current.promise;
  }, []);

  const handleDownloadComplete = useCallback((_success: boolean) => {
    // ensureOfflineSttModel() checks installation after the sheet closes.
  }, []);

  useEffect(() => {
    isVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const handler: OfflineModelPromptHandler = {
      get isVisible() {
        return isVisibleRef.current;
      },
      show,
    };

    return registerOfflineModelPromptHandler(handler);
  }, [show]);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return (
    <OfflineModelDownloadSheet
      visible={visible}
      onClose={close}
      locale={locale}
      onDownloadComplete={handleDownloadComplete}
    />
  );
}
