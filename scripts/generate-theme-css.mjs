import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { createNoctaliaTheme, getNoctaliaCSSVariables } = createRequire(import.meta.url)('../constants/noctaliaPalette.ts');

const cssPath = fileURLToPath(new URL('../global.css', import.meta.url));
const themes = [ ['dark', 'dark'], ['light', 'light'], ['morning', 'light'], ['afterglow', 'dark'] ];
const blocks = themes.map(([ambience, mode]) => {
  const variables = getNoctaliaCSSVariables(createNoctaliaTheme(mode, ambience), mode);
  return `    @variant ${ambience} {\n${Object.entries(variables).map(([key, value]) => `      ${key}: ${value};`).join('\n')}\n    }`;
});
const generated = `/* Generated from constants/noctaliaPalette.ts. Run npm run theme:generate. */\n@layer theme {\n  :root {\n${blocks.join('\n\n')}\n  }\n}\n\n`;
const current = fs.readFileSync(cssPath, 'utf8');
const start = current.includes('/* Generated from constants/noctaliaPalette.ts.')
  ? current.indexOf('/* Generated from constants/noctaliaPalette.ts.')
  : current.indexOf('@layer theme {');
const end = current.indexOf('/* ==========================================================================\n   Composite utilities', start);
if (start < 0 || end < 0) throw new Error('Missing theme block boundaries in global.css');
const next = current.slice(0, start) + generated + current.slice(end);
if (process.argv.includes('--check')) {
  if (current !== next) {
    console.error('Theme CSS is stale. Run npm run theme:generate.');
    process.exitCode = 1;
  } else {
    console.log('Theme CSS matches canonical tokens.');
  }
} else if (current !== next) {
  fs.writeFileSync(cssPath, next);
  console.log('Updated generated theme CSS.');
}
