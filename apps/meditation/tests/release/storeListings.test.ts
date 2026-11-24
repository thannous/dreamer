import fs from 'node:fs';
import path from 'node:path';

import { isAppLanguage } from '@/lib/i18n';

const appRoot = path.resolve(__dirname, '../..');
const directory = path.join(appRoot, 'store');
const { expo } = JSON.parse(fs.readFileSync(path.join(appRoot, 'app.json'), 'utf8'));
const languages = Object.keys(expo.locales).sort();

function expectText(text: string, limit: number, unit: 'characters' | 'bytes' = 'characters') {
  expect(typeof text).toBe('string');
  expect(text.trim()).not.toBe('');
  expect(unit === 'bytes' ? Buffer.byteLength(text, 'utf8') : [...text].length).toBeLessThanOrEqual(limit);
}

describe('Store listings', () => {
  it('covers each configured app language with a metadata file', () => {
    expect(languages.length).toBeGreaterThan(0);
    expect(languages.every(isAppLanguage)).toBe(true);
    expect(fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()).toEqual(
      languages.map((language) => `${language}.json`)
    );
  });

  it.each(languages)('%s fits App Store and Google Play field limits', (language) => {
    const listing = JSON.parse(fs.readFileSync(path.join(directory, `${language}.json`), 'utf8'));
    expectText(listing.name, 30);
    expectText(listing.description, 4000);
    expectText(listing.releaseNotes, 500);
    expectText(listing.appStore.subtitle, 30);
    expectText(listing.appStore.keywords, 100, 'bytes');
    expectText(listing.appStore.promotionalText, 170);
    expectText(listing.googlePlay.shortDescription, 80);
  });
});
