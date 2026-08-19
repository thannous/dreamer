import type { Category, CategorySlug } from '@/lib/types';

/**
 * Six categories. `dream-prep` is the editorial bridge to the Noctalia dream
 * journal — it is the one category with no free session.
 *
 * The accent pairs stay inside the brand: each is a Noctalia tag colour
 * descending into the card ink, so artwork reads as night, never as a stock
 * gradient.
 */
export const CATEGORIES: Category[] = [
  { slug: 'sleep', accent: ['#31354F', '#0D0B1C'] },
  { slug: 'stress', accent: ['#446B8C', '#0D0B1C'] },
  { slug: 'focus', accent: ['#6C568F', '#0D0B1C'] },
  { slug: 'anxiety', accent: ['#7F6FA8', '#0D0B1C'] },
  { slug: 'gratitude', accent: ['#9A6332', '#0D0B1C'] },
  { slug: 'dream-prep', accent: ['#4F3D6B', '#0D0B1C'] },
];

export const CATEGORY_BY_SLUG: Record<CategorySlug, Category> = CATEGORIES.reduce(
  (acc, category) => ({ ...acc, [category.slug]: category }),
  {} as Record<CategorySlug, Category>
);

export const isCategorySlug = (value: string): value is CategorySlug =>
  CATEGORIES.some((category) => category.slug === value);
