import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { DEFAULT_SCHEDULE, type ReminderSchedule } from '@/lib/reminders';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

/** The local profile. No account exists in v1 — this never leaves the device. */
export type LocalProfile = {
  displayName: string;
  avatarUri: string | null;
};

const INITIAL_PROFILE: LocalProfile = { displayName: '', avatarUri: null };

type SettingsContextValue = {
  profile: LocalProfile;
  reminders: ReminderSchedule;
  loaded: boolean;
  setProfile: (patch: Partial<LocalProfile>) => Promise<void>;
  setReminders: (patch: Partial<ReminderSchedule>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [profile, setProfileState] = useState<LocalProfile>(INITIAL_PROFILE);
  const [reminders, setRemindersState] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);

  // Same synchronous mirror as the other providers: two edits in one tick must
  // both land rather than the second overwriting the first.
  const profileRef = useRef(profile);
  const remindersRef = useRef(reminders);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      readJson<LocalProfile>(StorageKey.profile, INITIAL_PROFILE),
      readJson<ReminderSchedule>(StorageKey.reminders, DEFAULT_SCHEDULE),
    ])
      .then(([storedProfile, storedReminders]) => {
        if (!mounted) return;
        const mergedProfile = { ...INITIAL_PROFILE, ...storedProfile };
        const mergedReminders = { ...DEFAULT_SCHEDULE, ...storedReminders };
        profileRef.current = mergedProfile;
        remindersRef.current = mergedReminders;
        setProfileState(mergedProfile);
        setRemindersState(mergedReminders);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setProfile = useCallback(async (patch: Partial<LocalProfile>) => {
    const next = { ...profileRef.current, ...patch };
    profileRef.current = next;
    setProfileState(next);
    await writeJson(StorageKey.profile, next);
  }, []);

  const setReminders = useCallback(async (patch: Partial<ReminderSchedule>) => {
    const next = { ...remindersRef.current, ...patch };
    remindersRef.current = next;
    setRemindersState(next);
    await writeJson(StorageKey.reminders, next);
  }, []);

  const value = useMemo(
    () => ({ profile, reminders, loaded, setProfile, setReminders }),
    [profile, reminders, loaded, setProfile, setReminders]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);

  return (
    ctx ?? {
      profile: INITIAL_PROFILE,
      reminders: DEFAULT_SCHEDULE,
      loaded: false,
      setProfile: async () => {},
      setReminders: async () => {},
    }
  );
};
