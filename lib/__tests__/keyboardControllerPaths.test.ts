/**
 * The app requires react-native-keyboard-controller's source files directly so
 * the native bundle skips the package index and every keyboard component it
 * re-exports. These paths are not public API: re-check them on upgrade.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const PACKAGE = path.join(ROOT, 'node_modules/react-native-keyboard-controller');

function resolveSource(request: string, platformExtensions: string[]): string {
  const base = path.join(PACKAGE, request);
  for (const candidate of platformExtensions.flatMap((ext) => [`${base}${ext}`, path.join(base, `index${ext}`)])) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
  }
  throw new Error(`Missing ${request}`);
}

describe('react-native-keyboard-controller deep requires', () => {
  it('stays on the version these paths were checked against', () => {
    const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as { version: string; exports?: unknown };
    expect(version).toBe('1.22.8');
  });

  it.each([
    ['app/_layout.tsx', 'src/animated', /export const KeyboardProvider\b/],
    ['components/lucid/LucidRootLayout.tsx', 'src/animated', /export const KeyboardProvider\b/],
    ['components/chat/Composer.tsx', 'src/components/KeyboardStickyView', /export default KeyboardStickyView\b/],
    ['hooks/useChatList.ts', 'src/bindings', /export const KeyboardEvents\b/],
  ])('%s requires %s, which exports what it reads', (file, request, exported) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).toContain(`require('react-native-keyboard-controller/${request}')`);
    // Type-only `typeof import(...)` is fine; a runtime load of the index is not.
    expect(source).not.toMatch(/(?<!typeof )\b(?:require|import)\(\s*'react-native-keyboard-controller'\s*\)|from 'react-native-keyboard-controller'/);
    for (const extensions of [['.native.ts', '.native.tsx', '.ts', '.tsx'], ['.ios.ts', '.ios.tsx', '.ts', '.tsx']]) {
      expect(resolveSource(request, extensions)).toMatch(exported);
    }
  });
});
