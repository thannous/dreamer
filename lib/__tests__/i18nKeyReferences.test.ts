import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import enPack from '../i18n/en';

/**
 * Every en key must be read by app code, so the six catalogues (compiled into
 * the app bundle) carry no dead copy. A key counts as read when app code holds
 * it as a string, when a template literal builds it (`${…}` stands for any text
 * within a segment, as in `choice_${option}`), when a template appends a fixed
 * ending to a string held elsewhere (`${prefix}.title`), or when a string ending
 * in a dot prefixes it (`'stats.mood.' + id`). The translator reads `<key>.ios`
 * and `<key>.android` before `<key>` (lib/i18n.ts), so those follow their base key.
 */
const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIRS = ['app', 'components', 'constants', 'context', 'data', 'hooks', 'lib', 'mock-data', 'routes', 'services', 'widgets'];
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx)$/;
const EXCLUDED = /(?:^|\/)(?:__tests__|__mocks__)\/|\.(?:test|spec)\.[jt]sx?$|^lib\/i18n\//;

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (SOURCE_FILE.test(entry.name) && !EXCLUDED.test(relative)) files.push(relative);
    }
  };
  for (const dir of SOURCE_DIRS) if (fs.existsSync(path.join(ROOT, dir))) walk(dir);
  return files;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function collectReferences() {
  const literals = new Set<string>();
  const templates: RegExp[] = [];
  const endings = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of source.matchAll(/'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"/g)) {
      const value = match[1] ?? match[2];
      literals.add(value);
      if (/^[a-z0-9_]+(?:\.[a-z0-9_]+)*\.$/i.test(value)) prefixes.add(value);
    }
    for (const match of source.matchAll(/`((?:\\.|[^`\\])*)`/g)) {
      const template = match[1];
      if (!template.includes('${')) {
        literals.add(template);
        continue;
      }
      // Literal text between interpolations; each interpolation matches within one segment
      // or, when it fills whole segments, any dotted path.
      const parts = template.split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/);
      if (parts.length === 2 && parts[0] === '' && /^\.[a-z0-9_.]+$/i.test(parts[1])) endings.add(parts[1]);
      if (!parts.some((part) => /[a-z]\.[a-z_]/i.test(part))) continue;
      templates.push(new RegExp(`^${parts.map(escapeRegExp).join('[^\\s]*?')}$`));
    }
  }
  return { literals, templates, endings: [...endings], prefixes: [...prefixes] };
}

describe('i18n key references', () => {
  const { literals, templates, endings, prefixes } = collectReferences();
  const isReferenced = (key: string): boolean => {
    const platformBase = /^(.+)\.(?:ios|android)$/.exec(key)?.[1];
    if (platformBase && isReferenced(platformBase)) return true;
    return literals.has(key)
      || prefixes.some((prefix) => key.startsWith(prefix))
      || endings.some((ending) => key.endsWith(ending) && literals.has(key.slice(0, -ending.length)))
      || templates.some((template) => template.test(key));
  };

  it('finds the keys DialogueStory builds from templates', () => {
    for (const key of ['onboarding.story.explore.choice_start', 'onboarding.story.explore.choice_home', 'onboarding.story.explore.followup_home']) {
      expect(isReferenced(key)).toBe(true);
    }
    expect(isReferenced('onboarding.story.explore.never_used_key')).toBe(false);
  });

  it('follows platform variants and endings appended to a held prefix', () => {
    expect(isReferenced('settings.deleteAccount.subscriptionWarning.ios')).toBe(true);
    expect(isReferenced('notifications.inactivity.day7.body')).toBe(true);
  });

  it('ships no en key that app code never reads', () => {
    expect(Object.keys(enPack).filter((key) => !isReferenced(key))).toEqual([]);
  });
});
