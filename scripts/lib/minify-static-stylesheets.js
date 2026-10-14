/**
 * Stylesheets that are linked as-is (not bundled) ship minified. The sources in
 * docs-src/static/css stay readable; only the copies in docs/ are rewritten.
 * esbuild gets no target, so no syntax is lowered, as for the landing bundle.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('../../apps/site/dependencies')('esbuild');

const MINIFIED_STYLESHEETS = [
  'css/alternatives-table.css',
  'css/blog-article.css',
  'css/language-dropdown.css',
];

function minifyStaticStylesheets(outputDir) {
  for (const relativePath of MINIFIED_STYLESHEETS) {
    const filePath = path.join(outputDir, relativePath);
    const { code } = esbuild.transformSync(fs.readFileSync(filePath, 'utf8'), {
      loader: 'css',
      minify: true,
      legalComments: 'none',
    });
    fs.writeFileSync(filePath, code, 'utf8');
  }
}

module.exports = { MINIFIED_STYLESHEETS, minifyStaticStylesheets };
