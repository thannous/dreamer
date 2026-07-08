#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { ROOT_DIR, siteConfig } = require('./lib/docs-site-config');

const SYMBOL_DATASETS = [
  {
    label: 'primary',
    filePath: path.join(ROOT_DIR, 'data', 'dream-symbols-extended.json'),
    getSymbols: (data) => data.symbols || {},
  },
  {
    label: 'tier3',
    filePath: path.join(ROOT_DIR, 'data', 'dream-symbols-extended-tier3.json'),
    getSymbols: (data) => data || {},
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function imageSignature(illustration) {
  return [
    illustration.src || '',
    illustration.width || '',
    illustration.height || '',
  ].join('|');
}

function assertSymbolIllustrationParity() {
  const errors = [];

  for (const dataset of SYMBOL_DATASETS) {
    if (!fs.existsSync(dataset.filePath)) continue;

    const symbols = dataset.getSymbols(readJson(dataset.filePath));

    for (const [symbolId, translations] of Object.entries(symbols)) {
      const illustratedLocales = siteConfig.languages.filter(
        (lang) => Boolean(translations?.[lang]?.illustration?.src)
      );

      if (illustratedLocales.length === 0) continue;

      const missingLocales = siteConfig.languages.filter(
        (lang) => !translations?.[lang]?.illustration?.src
      );

      if (missingLocales.length > 0) {
        errors.push(
          `[symbol illustration missing locale] dataset=${dataset.label} symbol=${symbolId} illustrated=${illustratedLocales.join(',')} missing=${missingLocales.join(',')}`
        );
        continue;
      }

      const signatures = new Map();
      for (const lang of siteConfig.languages) {
        const illustration = translations[lang].illustration;
        const signature = imageSignature(illustration);
        if (!signatures.has(signature)) signatures.set(signature, []);
        signatures.get(signature).push(lang);

        if (!illustration.alt || !illustration.caption) {
          errors.push(
            `[symbol illustration missing text] dataset=${dataset.label} symbol=${symbolId} language=${lang}`
          );
        }
      }

      if (signatures.size > 1) {
        const details = [...signatures.entries()]
          .map(([signature, langs]) => `${langs.join(',')}=${signature}`)
          .join(' ');
        errors.push(
          `[symbol illustration mismatch] dataset=${dataset.label} symbol=${symbolId} ${details}`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

try {
  assertSymbolIllustrationParity();
  console.log('[symbol-illustration-parity] All illustrated symbols are localized consistently.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
