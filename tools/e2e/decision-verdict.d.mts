import type { TestFilter, TestFilterCandidate, TestFilterContext } from 'e2e';

export function verdictKey(input: {
  model: string;
  base: string;
  head: string;
  files: readonly string[];
  tests: readonly string[];
}): string;

export function decisionVerdict(
  asked: readonly TestFilterCandidate[],
  context: TestFilterContext,
  options?: {
    load?: () => Promise<TestFilter>;
    git?: (file: string, args: readonly string[], options: { cwd: string; encoding: 'utf8' }) => string;
  },
): Promise<{ exclude: Record<string, string>; note?: string }>;
