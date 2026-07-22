'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const card = fs.readFileSync(path.join(root, 'components', 'quota', 'QuotaStatusCard.tsx'), 'utf8');
const french = fs.readFileSync(path.join(root, 'lib', 'i18n', 'fr.ts'), 'utf8');

describe('quota card product vocabulary', () => {
  it('presents interpretations as the only commercial unit', () => {
    expect(card).toContain("key: 'analysis'");
    expect(card).not.toContain("key: 'exploration'");
    expect(card).not.toContain("key: 'recordings'");
    expect(french).toContain("'settings.quota.title': 'Interprétations offertes'");
    expect(french).toContain("'settings.quota.analysis_label': 'Interprétations offertes'");
    expect(french).toContain("'recording.quota.unlimited': 'Illimitées'");
  });

  it('describes chat as included instead of a separate credit', () => {
    expect(french).toContain('Le chat est inclus dans chaque interprétation.');
  });
});
