/**
 * Landing pages load one render-blocking bundle instead of three separate
 * landing-only stylesheets. The shared `styles.min.css` stays separate so it
 * remains cached across the rest of the site.
 *
 * The bundle is generated into `docs/` by `docs:build`; the sources below stay
 * the editable files. Order matches the previous <link> order, so the cascade
 * is unchanged. The written bundle is minified because it blocks rendering of
 * the landing; esbuild gets no target, so no syntax is lowered.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('../../apps/site/dependencies')('esbuild');

const LANDING_CSS_HREF = '/css/landing.css';
const LANDING_CSS_SOURCES = [
  'css/language-dropdown.css',
  'css/observatory.css',
  'css/experience.css',
];

function buildLandingStylesheet(staticDir) {
  return LANDING_CSS_SOURCES.map((relativePath) => {
    const css = fs.readFileSync(path.join(staticDir, relativePath), 'utf8');
    return `/* ${relativePath} */\n${css.trimEnd()}\n`;
  }).join('\n');
}

function writeLandingStylesheet(staticDir, outputDir) {
  const outputPath = path.join(outputDir, LANDING_CSS_HREF);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const { code } = esbuild.transformSync(buildLandingStylesheet(staticDir), {
    loader: 'css',
    minify: true,
    legalComments: 'none',
  });
  fs.writeFileSync(outputPath, code, 'utf8');
  return outputPath;
}

module.exports = {
  LANDING_CSS_HREF,
  LANDING_CSS_SOURCES,
  buildLandingStylesheet,
  writeLandingStylesheet,
};
