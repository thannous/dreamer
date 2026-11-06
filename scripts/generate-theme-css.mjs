import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { createNoctaliaTheme, getNoctaliaCSSVariables, getNoctaliaPalette, getNoctaliaDesignTokens } = createRequire(import.meta.url)('../constants/noctaliaPalette.ts');

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

// Meditation is an independent Expo package. Generate its adapter locally so its
// native/web bundles need neither the Dreamer runtime nor a second authored palette.
function meditationColors(mode) {
  const p = getNoctaliaPalette(mode);
  return {
    background: p.background, backgroundCard: p.raisedTranslucent,
    backgroundSecondary: p.surface, backgroundRaised: p.navGlass.solid,
    glassTint: p.raised, textPrimary: p.title, textSecondary: p.muted,
    textTertiary: p.muted, accent: p.accent, accentText: p.accent,
    accentDark: p.accent, accentLight: p.accent, accentBorder: p.line, textOnAccent: p.onAccent,
    divider: p.line, navbarBg: p.navGlass.solid, navbarBorder: p.navGlass.rim,
  };
}
const meditationMapping = {
  ink: 'background', 'ink-card': 'backgroundCard', 'ink-panel': 'backgroundSecondary',
  'ink-raised': 'backgroundRaised', ivory: 'textPrimary', 'ivory-muted': 'textSecondary',
  'ivory-faint': 'textTertiary', champagne: 'accent', 'champagne-text': 'accentText',
  'champagne-deep': 'accentDark', 'champagne-soft': 'accentBorder', 'champagne-on': 'textOnAccent',
  hairline: 'divider', navbar: 'navbarBg', 'navbar-border': 'navbarBorder',
};
const declaration = (mode, indent) => {
  const p = meditationColors(mode);
  return Object.entries(meditationMapping).map(([css, key]) => `${indent}--color-${css}: ${p[key]};`).join('\n');
};
function writeGenerated(path, transform) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const before = fs.readFileSync(filename, 'utf8');
  const after = transform(before);
  if (before === after) return;
  if (process.argv.includes('--check')) {
    console.error(`${path} is stale. Run npm run theme:generate.`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(filename, after);
    console.log(`Updated ${path}.`);
  }
}
writeGenerated('../apps/meditation/global.css', source => {
  const start = source.indexOf('  /* Declared so the utilities exist;');
  if (start < 0) throw new Error('Missing Meditation CSS generation boundary');
  return source.slice(0, start) + `  /* Declared so the utilities exist; generated from constants/noctaliaPalette.ts. */\n${declaration('light', '  ')}\n}\n\n@layer theme {\n  :root {\n${['light', 'dark'].map(mode => `    @variant ${mode} {\n${declaration(mode, '      ')}\n    }`).join('\n\n')}\n  }\n}\n`;
});
const serialize = value => JSON.stringify(value, null, 2)
  .replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, '$1:')
  .replace(/"([^"\n]*)"/g, "'$1'");
writeGenerated('../apps/meditation/constants/theme.ts', source => {
  const start = source.indexOf('export const NightTheme:');
  const end = source.indexOf('/** Opacity of the glass card fill');
  if (start < 0 || end < start) throw new Error('Missing Meditation native token boundaries');
  const navigation = Object.fromEntries(['dark', 'light'].map(mode => {
    const p = getNoctaliaPalette(mode);
    return [mode, { glass: p.navGlass, active: p.navActive }];
  }));
  const atmosphere = Object.fromEntries(['dark', 'light'].map(mode => {
    const p = getNoctaliaPalette(mode);
    const t = getNoctaliaDesignTokens(createNoctaliaTheme(mode, mode), mode);
    return [mode, {
      ...t.atmosphere,
      gradient: [p.background, p.background, p.background],
      gradientLocations: [0, 0.55, 1],
    }];
  }));
  return source.slice(0, start) + `export const NightTheme: ThemeColors = ${serialize(meditationColors('dark'))};\n\nexport const PaperTheme: ThemeColors = ${serialize(meditationColors('light'))};\n\nexport const Themes: Record<ThemeMode, ThemeColors> = { dark: NightTheme, light: PaperTheme };\n\n/** Generated from constants/noctaliaPalette.ts by npm run theme:generate. */\nexport const NavigationMaterial = ${serialize(navigation)} as const;\n\n/** Noctalia's atmosphere; paintings carry the colour, without a second aurora palette. */\nexport const Atmosphere = ${serialize(atmosphere)} as const;\n\n` + source.slice(end);
});
