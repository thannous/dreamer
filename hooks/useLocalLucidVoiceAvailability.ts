import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { loadLocalLucidVoiceExperimentIds, subscribeLucidMorningVoiceNotes } from '@/services/lucidMorningVoiceNoteStorage';

const EMPTY: ReadonlySet<string> = new Set();
export function useLocalLucidVoiceAvailability(scope: string): ReadonlySet<string> {
  const [snapshot, setSnapshot] = useState<{ scope: string; ids: ReadonlySet<string> }>();
  useEffect(() => {
    let disposed = false;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      setSnapshot({ scope, ids: EMPTY });
      void loadLocalLucidVoiceExperimentIds(scope).then(ids => {
        if (!disposed && request === revision) setSnapshot({ scope, ids });
      }).catch(() => {
        if (!disposed && request === revision) setSnapshot({ scope, ids: EMPTY });
      });
    };
    const unsubscribe = subscribeLucidMorningVoiceNotes(changedScope => {
      if (changedScope === scope) refresh();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => { disposed = true; unsubscribe(); appState.remove(); };
  }, [scope]);
  return snapshot?.scope === scope ? snapshot.ids : EMPTY;
}
