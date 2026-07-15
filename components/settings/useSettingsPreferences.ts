import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useJournalLayoutPreference } from '@/hooks/useJournalLayoutPreference';
import { useTranslation } from '@/hooks/useTranslation';
import { updateLanguagePreference } from '@/lib/languagePreference';
import { TID } from '@/lib/testIDs';
import type {
  JournalLayoutPreference,
  LanguagePreference,
  ThemePreference,
} from '@/lib/types';
import { ensureOfflineSttModel } from '@/services/nativeSpeechRecognition';

export type SettingsPreferenceOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  current: boolean;
  testID?: string;
};

export type SettingsPreferenceController<T extends string> = {
  title: string;
  description: string;
  value: T;
  currentLabel: string;
  options: SettingsPreferenceOption<T>[];
  loading: boolean;
  saving: boolean;
  error: boolean;
  set: (value: T) => Promise<void>;
  select: (value: T) => Promise<void>;
};

type RecordingGuideActionController = {
  title: string;
  description: string;
  actionLabel: string;
  actionHint: string;
  testID: string;
  loading: false;
  saving: boolean;
  error: boolean;
  restart: () => Promise<void>;
  replay: () => Promise<void>;
};

const THEME_VALUES: ThemePreference[] = ['auto', 'light', 'dark'];
const LANGUAGE_VALUES: LanguagePreference[] = ['auto', 'en', 'fr', 'es', 'de', 'it'];
const JOURNAL_LAYOUT_VALUES: JournalLayoutPreference[] = ['cards', 'compact'];

export function useThemeSettingsPreference(): SettingsPreferenceController<ThemePreference> {
  const { loaded, preference, setPreference, systemMode } = useTheme();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const options = useMemo(
    () => THEME_VALUES.map((value) => ({
      value,
      label: t(`settings.theme.option.${value}.label`),
      description: value === 'auto'
        ? `${t('settings.theme.option.auto.description')}\n${t('settings.theme.option.auto.system_hint', {
            theme: t(`settings.theme.option.${systemMode}.label`),
          })}`
        : t(`settings.theme.option.${value}.description`),
      current: preference === value,
    })),
    [preference, systemMode, t],
  );

  const select = useCallback(async (value: ThemePreference) => {
    setSaving(true);
    setError(false);
    try {
      await setPreference(value);
    } catch (cause) {
      setError(true);
      if (__DEV__) {
        console.error('Failed to update theme preference:', cause);
      }
    } finally {
      setSaving(false);
    }
  }, [setPreference]);

  return {
    title: t('settings.theme.title'),
    description: t('settings.theme.description'),
    value: preference,
    currentLabel: options.find((option) => option.current)?.label ?? '',
    options,
    loading: !loaded,
    saving,
    error,
    set: select,
    select,
  };
}

export function useLanguageSettingsPreference(): SettingsPreferenceController<LanguagePreference> {
  const { loaded, preference, setPreference, systemLanguage } = useLanguage();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const options = useMemo(
    () => LANGUAGE_VALUES.map((value) => ({
      value,
      label: t(`settings.language.option.${value}.label`),
      description: value === 'auto'
        ? `${t('settings.language.option.auto.description')}\n${t(
            'settings.language.option.auto.system_hint',
            { language: t(`settings.language.option.${systemLanguage}.label`) },
          )}`
        : t(`settings.language.option.${value}.description`),
      current: preference === value,
    })),
    [preference, systemLanguage, t],
  );

  const select = useCallback(async (value: LanguagePreference) => {
    setSaving(true);
    setError(false);
    try {
      await updateLanguagePreference({
        preference: value,
        systemLanguage,
        setPreference,
        ensureOfflineModel: ensureOfflineSttModel,
      });
    } catch (cause) {
      setError(true);
      if (__DEV__) {
        console.error('Failed to update language preference:', cause);
      }
    } finally {
      setSaving(false);
    }
  }, [setPreference, systemLanguage]);

  return {
    title: t('settings.language.title'),
    description: t('settings.language.description'),
    value: preference,
    currentLabel: options.find((option) => option.current)?.label ?? '',
    options,
    loading: !loaded,
    saving,
    error,
    set: select,
    select,
  };
}

export function useJournalLayoutSettingsPreference(): SettingsPreferenceController<JournalLayoutPreference> {
  const { loaded, preference, setPreference } = useJournalLayoutPreference();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const options = useMemo(
    () => JOURNAL_LAYOUT_VALUES.map((value) => ({
      value,
      label: t(`settings.journal_layout.option.${value}.label`),
      description: t(`settings.journal_layout.option.${value}.description`),
      current: preference === value,
      testID: value === 'cards'
        ? TID.Button.JournalLayoutCards
        : TID.Button.JournalLayoutCompact,
    })),
    [preference, t],
  );

  const select = useCallback(async (value: JournalLayoutPreference) => {
    setSaving(true);
    setError(false);
    try {
      await setPreference(value);
    } catch (cause) {
      setError(true);
      if (__DEV__) {
        console.error('Failed to update journal layout preference:', cause);
      }
    } finally {
      setSaving(false);
    }
  }, [setPreference]);

  return {
    title: t('settings.journal_layout.title'),
    description: t('settings.journal_layout.description'),
    value: preference,
    currentLabel: options.find((option) => option.current)?.label ?? '',
    options,
    loading: !loaded,
    saving,
    error,
    set: select,
    select,
  };
}

export function useRecordingGuideAction(): RecordingGuideActionController {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const replay = useCallback(async () => {
    setSaving(true);
    setError(false);
    try {
      router.push({ pathname: '/recording', params: { replayGuide: '1' } });
    } catch (cause) {
      setError(true);
      if (__DEV__) {
        console.error('Failed to restart recording onboarding:', cause);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    title: t('settings.onboarding.title'),
    description: t('settings.onboarding.description'),
    actionLabel: t('settings.onboarding.restart'),
    actionHint: t('settings.onboarding.restart_hint'),
    testID: TID.Button.RecordingOnboardingRestart,
    loading: false,
    saving,
    error,
    restart: replay,
    replay,
  };
}

export function useSettingsPreferences() {
  const theme = useThemeSettingsPreference();
  const language = useLanguageSettingsPreference();
  const journalLayout = useJournalLayoutSettingsPreference();
  const recording = useRecordingGuideAction();

  return { theme, language, journalLayout, recording };
}

export default useSettingsPreferences;
