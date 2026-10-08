/**
 * Landing pages load one render-blocking bundle instead of three separate
 * landing-only stylesheets. The shared `styles.min.css` stays separate so it
 * remains cached across the rest of the site.
 *
 * The bundle is generated into `docs/` by `docs:build`; the sources below stay
 * the editable files. Order matches the previous <link> order, so the cascade
 * is unchanged.
 */

const fs = require('fs');
const path = require('path');

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
  fs.writeFileSync(outputPath, buildLandingStylesheet(staticDir), 'utf8');
  return outputPath;
}

module.exports = {
  LANDING_CSS_HREF,
  LANDING_CSS_SOURCES,
  buildLandingStylesheet,
  writeLandingStylesheet,
};
