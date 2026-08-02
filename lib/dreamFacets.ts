/**
 * Shared ranking for dream facets (types, themes, fragments, periods).
 *
 * Every surface that shows a "top" facet must use this ordering. The free
 * "Popular themes" section and the paid "Theme" profile signal previously
 * sorted with different tiebreaks and disagreed whenever two facets had the
 * same count (stats screen audit §7.2).
 *
 * Ties are broken on the raw value using code-unit order rather than
 * `localeCompare`, so the ranking never depends on the device locale.
 */
export function compareDreamFacets(
  aCount: number,
  aValue: string,
  bCount: number,
  bValue: string
): number {
  if (bCount !== aCount) return bCount - aCount;
  if (aValue === bValue) return 0;
  return aValue < bValue ? -1 : 1;
}
