// Native-only stand-in for `character-entities` behind micromark (see
// scripts/metro-native-stubs.js). Only the Markdown policy pass decodes named
// references in JS; md4c renders every entity itself, and
// components/journal/JournalBook.tsx sends text with entities to Markdown.
export const characterEntities = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};
