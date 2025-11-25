import type { DreamTheme, DreamType } from './types';

type Translator = (key: string, replacements?: { [k: string]: string | number }) => string;

const DREAM_TYPE_LABEL_KEYS: Record<DreamType, string> = {
  'Lucid Dream': 'dream.type.lucid',
  'Recurring Dream': 'dream.type.recurring',
  Nightmare: 'dream.type.nightmare',
  'Symbolic Dream': 'dream.type.symbolic',
};

const DREAM_THEME_LABEL_KEYS: Record<DreamTheme, string> = {
  surreal: 'dream.theme.surreal',
  mystical: 'dream.theme.mystical',
  calm: 'dream.theme.calm',
  noir: 'dream.theme.noir',
};

export function getDreamTypeLabel(dreamType: DreamType | null | undefined, t: Translator): string | undefined {
  if (!dreamType) return undefined;
  const key = DREAM_TYPE_LABEL_KEYS[dreamType];
  return key ? t(key) : dreamType;
}

export function getDreamThemeLabel(theme: DreamTheme | null | undefined, t: Translator): string | undefined {
  if (!theme) return undefined;
  const key = DREAM_THEME_LABEL_KEYS[theme];
  return key ? t(key) : theme;
}
