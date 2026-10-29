export const SMOKE_TAG: string;
export const BUGBASH_TAG: string;
export const DREAMER_APP_ROOTS: readonly string[];

export interface Zone {
  id: string;
  tags: string[];
  product: 'dreamer' | 'lucid' | 'meditation';
  platform: 'web';
  sources: string[];
  tests: string[];
}

export const ZONES: readonly Zone[];

export function sourceMatches(source: string, file: string): boolean;
export function zonesForFiles(files: readonly string[]): Zone[];
export function isDreamerAppPath(file: string): boolean;
export function isNativeJourney(file: string): boolean;

export function filterIsActive(context: { changes?: { files?: readonly string[] } } | undefined): boolean;

export function parcoursExclude(
  tests: readonly { id: string; tags: readonly string[]; file: string }[],
  files: readonly string[],
): { exclude: Record<string, string>; note?: string };
