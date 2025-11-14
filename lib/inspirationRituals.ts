export type RitualId = 'starter' | 'memory' | 'lucid';

export type RitualStepConfig = {
  id: string;
  titleKey: string;
  bodyKey: string;
};

export type RitualConfig = {
  id: RitualId;
  labelKey: string;
  descriptionKey: string;
  steps: RitualStepConfig[];
};

export const RITUALS: RitualConfig[] = [
  {
    id: 'starter',
    labelKey: 'inspiration.ritual.variant.starter',
    descriptionKey: 'inspiration.ritual.variant.starter.description',
    steps: [
      {
        id: 'evening',
        titleKey: 'inspiration.ritual.step.evening.title',
        bodyKey: 'inspiration.ritual.step.evening.body',
      },
      {
        id: 'morning',
        titleKey: 'inspiration.ritual.step.morning.title',
        bodyKey: 'inspiration.ritual.step.morning.body',
      },
      {
        id: 'day',
        titleKey: 'inspiration.ritual.step.day.title',
        bodyKey: 'inspiration.ritual.step.day.body',
      },
      {
        id: 'intent',
        titleKey: 'inspiration.ritual.step.intent.title',
        bodyKey: 'inspiration.ritual.step.intent.body',
      },
    ],
  },
  {
    id: 'memory',
    labelKey: 'inspiration.ritual.variant.memory',
    descriptionKey: 'inspiration.ritual.variant.memory.description',
    steps: [
      {
        id: 'evening',
        titleKey: 'inspiration.ritual.memory.step.evening.title',
        bodyKey: 'inspiration.ritual.memory.step.evening.body',
      },
      {
        id: 'morning',
        titleKey: 'inspiration.ritual.memory.step.morning.title',
        bodyKey: 'inspiration.ritual.memory.step.morning.body',
      },
      {
        id: 'day',
        titleKey: 'inspiration.ritual.memory.step.day.title',
        bodyKey: 'inspiration.ritual.memory.step.day.body',
      },
      {
        id: 'extra',
        titleKey: 'inspiration.ritual.memory.step.extra.title',
        bodyKey: 'inspiration.ritual.memory.step.extra.body',
      },
    ],
  },
  {
    id: 'lucid',
    labelKey: 'inspiration.ritual.variant.lucid',
    descriptionKey: 'inspiration.ritual.variant.lucid.description',
    steps: [
      {
        id: 'evening',
        titleKey: 'inspiration.ritual.lucid.step.evening.title',
        bodyKey: 'inspiration.ritual.lucid.step.evening.body',
      },
      {
        id: 'morning',
        titleKey: 'inspiration.ritual.lucid.step.morning.title',
        bodyKey: 'inspiration.ritual.lucid.step.morning.body',
      },
      {
        id: 'day',
        titleKey: 'inspiration.ritual.lucid.step.day.title',
        bodyKey: 'inspiration.ritual.lucid.step.day.body',
      },
      {
        id: 'extra',
        titleKey: 'inspiration.ritual.lucid.step.extra.title',
        bodyKey: 'inspiration.ritual.lucid.step.extra.body',
      },
    ],
  },
];

