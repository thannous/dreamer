import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Keep package.json as the source of truth, with the server as the SDK's direct
// child. Killing a `node --run` wrapper leaves its Metro child alive on Windows.
export function managedAppCommand(packageRoot: string, scriptName: string,
  resolveExpo: (root: string) => string = root => createRequire(join(root, 'package.json')).resolve('expo/bin/cli')) {
  const script: unknown = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).scripts?.[scriptName];
  if (typeof script !== 'string') throw new Error(`Missing managed app script: ${scriptName}`);
  const words = script.trim().split(/\s+/);
  const executable = words.shift();
  if (!words.length || !words.every(word => /^[\p{L}\p{N}_./:@=-]+$/u.test(word))
    || !['node', 'expo'].includes(executable ?? '')
    || (executable === 'node' && (!/\.(?:c|m)?js$/.test(words[0]) || words[0].startsWith('-'))))
    throw new Error(`Managed app script must be a direct Node or Expo command without shell syntax: ${scriptName}`);
  return { executable: process.execPath, args: executable === 'node' ? words : [resolveExpo(packageRoot), ...words] };
}
