/**
 * Sorts a list of items ensuring the selected item appears first.
 * @param items List of all available items
 * @param selectedItem The currently selected item (persisted value)
 * @returns A new array with the selected item first, followed by the rest
 */
export function sortWithSelectionFirst<T>(items: T[], selectedItem?: T): T[] {
  if (!selectedItem) return [...items];
  const set = new Set([selectedItem, ...items]);
  return Array.from(set);
}
