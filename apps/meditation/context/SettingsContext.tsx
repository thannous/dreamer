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
  /** Video backgrounds on the immersive screens. On by default. */
  videoBackgrounds: boolean;
  loaded: boolean;
  setProfile: (patch: Partial<LocalProfile>) => Promise<void>;
  setReminders: (patch: Partial<ReminderSchedule>) => Promise<void>;
  setVideoBackgrounds: (enabled: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [profile, setProfileState] = useState<LocalProfile>(INITIAL_PROFILE);
  const [reminders, setRemindersState] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);
  const [videoBackgrounds, setVideoBackgroundsState] = useState(true);
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
      readJson<boolean>(StorageKey.playerPrefs, true),
    ])
      .then(([storedProfile, storedReminders, storedVideo]) => {
        if (!mounted) return;
        setVideoBackgroundsState(storedVideo !== false);
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

  const setVideoBackgrounds = useCallback(async (enabled: boolean) => {
    setVideoBackgroundsState(enabled);
    await writeJson(StorageKey.playerPrefs, enabled);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      reminders,
      videoBackgrounds,
      loaded,
      setProfile,
      setReminders,
      setVideoBackgrounds,
    }),
    [profile, reminders, videoBackgrounds, loaded, setProfile, setReminders, setVideoBackgrounds]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);

  return (
    ctx ?? {
      profile: INITIAL_PROFILE,
      reminders: DEFAULT_SCHEDULE,
      videoBackgrounds: true,
      loaded: false,
      setProfile: async () => {},
      setReminders: async () => {},
      setVideoBackgrounds: async () => {},
    }
  );
};
