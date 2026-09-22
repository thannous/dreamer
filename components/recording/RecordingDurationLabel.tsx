import React, { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

/** Mount inside a Text only while listening; ticks do not rerender the capture screen. */
export function RecordingDurationLabel({ startedAtRef }: { startedAtRef: RefObject<number | null> }) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => {
      const start = startedAtRef.current;
      setSeconds(start === null ? 0 : Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAtRef]);
  const duration = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <>{t('recording.status.duration', { duration })}</>;
}
