export const SMOKE_TAG: string;
export const BUGBASH_TAG: string;
export const UNTOUCHED: string;
export const DECISION_KEY_ENV: string;
export const DECISION_MODEL: string;
export const DECISION_PRODUCTS: readonly ('dreamer' | 'lucid')[];
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
export const UNZONED: Readonly<Record<string, string>>;

export function sourceMatches(source: string, file: string): boolean;
export function zonesForFiles(files: readonly string[]): Zone[];
export function isDreamerAppPath(file: string): boolean;
export function isNativeJourney(file: string): boolean;
export function isUnitTestPath(file: string): boolean;
export function isUnzonedJourney(file: string): boolean;
export const SHARED_JOURNEY_STEPS: Readonly<Record<string, readonly string[]>>;
export function journeysOfChange(file: string): readonly string[];
export const SMOKE_STACK: readonly string[];
export function isSmokeStackPath(file: string): boolean;

export function filterIsActive(context: { changes?: { files?: readonly string[] } } | undefined): boolean;

export function parcoursExclude(
  tests: readonly { id: string; tags: readonly string[]; file: string }[],
  files: readonly string[],
  locale?: string,
): { exclude: Record<string, string>; relevance: Record<string, number>; note?: string };

export function decisionEnabled(env: Record<string, string | undefined>): boolean;
export function sentToDecisionModel(file: string): boolean;

export function widenWithDecision(
  zones: { exclude: Record<string, string>; relevance?: Readonly<Record<string, number>>; note?: string },
  verdict: { exclude: Readonly<Record<string, string>>; relevance?: Readonly<Record<string, number>>; note?: string },
): { exclude: Record<string, string>; relevance: Record<string, number>; note: string };
export const RELEVANCE_CHANGED_TEST: number;
export const RELEVANCE_ZONE: number;
export const RELEVANCE_UNSCORED: number;
