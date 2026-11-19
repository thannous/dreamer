import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { canDictate } from '@/lib/speechCapability';
import { resolveDeviceSpeechCapability } from '@/services/nativeSpeechRecognition';

export function useDictationAvailability(locale: string, onUnavailable?: () => void): boolean {
  const [probe, setProbe] = useState<{ locale: string; supported: boolean } | null>(null);

  useEffect(() => {
    // Web checks its recognizer when dictation starts. A failed native probe must
    // also leave the control available until a real recording attempt settles it.
    if (Platform.OS === 'web') return;
    let active = true;
    void resolveDeviceSpeechCapability(locale).then((capability) => {
      if (!active) return;
      const supported = canDictate(capability);
      setProbe({ locale, supported });
      if (!supported) onUnavailable?.();
    }).catch(() => {
      if (active) setProbe({ locale, supported: true });
    });
    return () => { active = false; };
  }, [locale, onUnavailable]);

  return probe?.locale === locale ? probe.supported : true;
}
