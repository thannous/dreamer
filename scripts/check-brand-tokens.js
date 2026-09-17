#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '..');

// These are semantic mappings within each product, not a shared colour palette.
const JOURNAL = {
  ink: 'backgroundDark', 'ink-panel': 'backgroundSecondary', 'ink-solid': 'backgroundCard',
  ivory: 'textPrimary', 'ivory-muted': 'textSecondary', 'ivory-faint': 'textTertiary',
  champagne: 'accent', 'champagne-on': 'accentText', 'champagne-deep': 'accentDark',
  'champagne-soft': 'accentLight', 'on-champagne': 'textOnAccentSurface',
  line: 'divider', timeline: 'timeline', 'ink-nav': 'navbarBg', 'line-nav': 'navbarBorder',
  'nav-active': 'navbarTextActive', 'nav-inactive': 'navbarTextInactive',
  'tag-surreal': 'tags.surreal', 'tag-mystical': 'tags.mystical',
  'tag-calm': 'tags.calm', 'tag-noir': 'tags.noir',
};
const DESIGN = {
  'ink-card': 'surface.base', 'ink-raised': 'surface.raised', 'ink-active': 'surface.active',
  'ink-soft': 'surface.soft', 'ink-overlay': 'surface.overlay', 'line-strong': 'surface.borderStrong',
  'champagne-dim': 'action.disabled', 'champagne-dim-line': 'action.disabledBorder',
  'ivory-disabled': 'action.disabledText',
  ...Object.fromEntries(['danger', 'success', 'warning'].flatMap(status => [
    [status, `status.${status}.background`], [`${status}-line`, `status.${status}.border`],
    [`${status}-on`, `status.${status}.text`], [`${status}-icon`, `status.${status}.icon`],
  ])),
  ...Object.fromEntries(['particle', 'star', 'veil', 'orbit', 'horizon'].map(key => [key, `atmosphere.${key}`])),
};
const MEDITATION = {
  ink: 'background', 'ink-card': 'backgroundCard', 'ink-panel': 'backgroundSecondary',
  'ink-raised': 'backgroundRaised', ivory: 'textPrimary', 'ivory-muted': 'textSecondary',
  'ivory-faint': 'textTertiary', champagne: 'accent', 'champagne-text': 'accentText',
  'champagne-deep': 'accentDark', 'champagne-soft': 'accentLight', 'champagne-on': 'textOnAccent',
  hairline: 'divider', navbar: 'navbarBg', 'navbar-border': 'navbarBorder',
};

function normalizeColor(value) {
  const text = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return '#' + [...text.slice(1)].map(c => c + c).join('');
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)$/.exec(text);
  if (rgba && rgba.slice(1, 4).every(n => Number(n) <= 255) && Number(rgba[4]) <= 1) {
    return `rgba(${rgba.slice(1).map(Number).join(',')})`;
  }
  throw new Error(`Unsupported colour expression: ${value}`);
}

// Scope extraction is deliberately narrow: token blocks contain declarations only.
// Unexpected nesting, duplicates or expressions fail instead of hiding a drift.
function cssBlocks(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = {};
  // Track structural scopes, ignoring delimiters inside CSS strings.
  const stack = [];
  let start = 0;
  let quote = null;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === ';') { start = index + 1; continue; }
    if (char === '{') {
      stack.push({ selector: clean.slice(start, index).trim().replace(/\s+/g, ' '), start: index + 1 });
      start = index + 1;
      continue;
    }
    if (char !== '}') continue;
    const scope = stack.pop();
    if (!scope) throw new Error('Unbalanced CSS closing brace');
    start = index + 1;
    const variant = /^@variant ([\w-]+)$/.exec(scope.selector);
    const isPalette = variant && stack.length === 2 &&
      stack[0].selector === '@layer theme' && stack[1].selector === ':root';
    const isDefault = scope.selector === '@theme' && stack.length === 0;
    if (!isPalette && !isDefault) continue;
    const name = isDefault ? 'default' : variant[1];
    const body = clean.slice(scope.start, index);
    if (body.includes('{')) throw new Error(`Unsupported nested CSS block ${name}`);
    if (Object.hasOwn(blocks, name)) throw new Error(`Duplicate CSS block ${name}`);
    const tokens = {};
    for (const declaration of body.split(';')) {
      if (!declaration.trim()) continue;
      const token = /^\s*(--[\w-]+)\s*:\s*([^]+?)\s*$/.exec(declaration);
      if (!token) throw new Error(`Unsupported CSS declaration in ${name}: ${declaration.trim()}`);
      if (Object.hasOwn(tokens, token[1])) throw new Error(`Duplicate CSS token ${name}.${token[1]}`);
      tokens[token[1]] = token[2];
    }
    blocks[name] = tokens;
  }
  if (stack.length || quote) throw new Error('Unclosed CSS block or string');
  return blocks;
}

// Read only the AST paths participating in the contract. Never execute theme files
// (they import native modules and contain unrelated runtime functions).
function typescriptReader(source, filename, ts) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error(`Invalid TypeScript: ${filename}`);
  const declarations = new Map();
  const functions = new Map();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, declaration.initializer);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement);
  }
  function read(node, keys, env = {}, seen = new Set()) {
    if (!node) throw new Error(`Missing TypeScript token ${filename}: ${keys.join('.')}`);
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
      return read(node.expression, keys, env, seen);
    }
    if (ts.isIdentifier(node)) {
      if (Object.hasOwn(env, node.text)) {
        return keys.reduce((value, key) => value?.[key], env[node.text]);
      }
      if (seen.has(node.text)) throw new Error(`Cyclic token reference: ${node.text}`);
      return read(declarations.get(node.text), keys, env, new Set([...seen, node.text]));
    }
    if (ts.isPropertyAccessExpression(node)) return read(node.expression, [node.name.text, ...keys], env, seen);
    if (ts.isConditionalExpression(node) && ts.isIdentifier(node.condition) && ['isDark', 'isMorning', 'isAfterglow'].includes(node.condition.text) && typeof env[node.condition.text] === 'boolean') {
      return read(env[node.condition.text] ? node.whenTrue : node.whenFalse, keys, env, seen);
    }
    if (ts.isObjectLiteralExpression(node) && keys.length) {
      const [key, ...remaining] = keys;
      for (const property of [...node.properties].reverse()) {
        if (ts.isSpreadAssignment(property)) {
          try { return read(property.expression, keys, env, seen); } catch (error) {
            if (!error.message.startsWith('Missing TypeScript token')) throw error;
          }
        } else if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)) {
          if (property.name.text === key) return read(property.initializer, remaining, env, seen);
        } else {
          throw new Error(`Unsupported TypeScript property in ${filename}: ${property.getText(file)}`);
        }
      }
      throw new Error(`Missing TypeScript token ${filename}: ${keys.join('.')}`);
    }
    if (ts.isStringLiteral(node) && !keys.length) return node.text;
    throw new Error(`Unsupported TypeScript expression in ${filename}: ${node.getText(file)}`);
  }
  return {
    token: (name, key) => read(declarations.get(name), key.split('.')),
    design: (key, colors, mode) => {
      const fn = functions.get('getNoctaliaDesignTokens');
      const statements = fn?.body?.statements;
      const guards = [['isDark', 'mode', 'dark'], ['isMorning', 'colors.ambience', 'morning'],
        ['isAfterglow', 'colors.ambience', 'afterglow']];
      const validGuards = guards.every(([name, left, right], index) => {
        const statement = statements?.[index];
        const declaration = statement && ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.length === 1 && statement.declarationList.declarations[0];
        const condition = declaration?.initializer;
        return declaration?.name.getText(file) === name && condition &&
          ts.isBinaryExpression(condition) && condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
          condition.left.getText(file) === left && ts.isStringLiteral(condition.right) && condition.right.text === right;
      });
      if (fn?.parameters.length !== 2 || fn.parameters[0].name.getText(file) !== 'colors' ||
          fn.parameters[1].name.getText(file) !== 'mode' || statements?.length !== 4 ||
          !validGuards || !ts.isReturnStatement(statements[3])) throw new Error('Unsupported getNoctaliaDesignTokens structure');
      return read(statements[3].expression, key.split('.'), {
        colors, isDark: mode === 'dark', isMorning: colors.ambience === 'morning', isAfterglow: colors.ambience === 'afterglow',
      });
    },
  };
}

function checkBrandTokens({ root = ROOT, product = 'journal', ts } = {}) {
  ts ||= createRequire(path.join(root, product === 'meditation' ? 'apps/meditation/package.json' : 'package.json'))('typescript');
  const errors = [];
  let checked = 0;
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  function rejectUnmapped(blocks, mapping, productName, emptyDefaults = false) {
    for (const [mode, block] of Object.entries(blocks)) {
      for (const name of Object.keys(block)) {
        if (name.startsWith('--color-') &&
            ((emptyDefaults && mode === 'default') || !Object.hasOwn(mapping, name.slice(8)))) {
          errors.push(`${productName} ${mode} ${name}: Unmapped CSS colour token`);
        }
      }
    }
  }
  function compare(label, block, mapping, token) {
    for (const [css, property] of Object.entries(mapping)) {
      const name = `--color-${css}`;
      try {
        if (!block || !Object.hasOwn(block, name)) throw new Error('Missing CSS token');
        const expected = token(property);
        if (normalizeColor(block[name]) !== normalizeColor(expected)) throw new Error(`CSS ${block[name]} != TypeScript ${expected}`);
        checked++;
      } catch (error) { errors.push(`${label} ${name} ↔ ${property}: ${error.message}`); }
    }
  }
  if (product === 'all' || product === 'journal') {
    const blocks = cssBlocks(read('global.css'));
    rejectUnmapped(blocks, { ...JOURNAL, ...DESIGN }, 'Journal/Lucid', true);
    const theme = typescriptReader(read('constants/journalTheme.ts'), 'constants/journalTheme.ts', ts);
    const design = typescriptReader(read('constants/noctaliaDesign.ts'), 'constants/noctaliaDesign.ts', ts);
    for (const [mode, name] of Object.entries({ dark: 'DarkTheme', light: 'LightTheme', morning: 'MorningTheme', afterglow: 'AfterglowTheme' })) {
      compare(`Journal/Lucid ${mode}`, blocks[mode], JOURNAL, key => theme.token(name, key));
      const colors = Object.fromEntries(Object.values(JOURNAL).filter(key => !key.includes('.')).map(key => [key, theme.token(name, key)]));
      colors.overlay = theme.token(name, 'overlay');
      colors.ambience = theme.token(name, 'ambience');
      compare(`Journal/Lucid design ${mode}`, blocks[mode], DESIGN, key => design.design(key, colors,
        mode === 'dark' || mode === 'afterglow' ? 'dark' : 'light'));
    }
  }
  if (product === 'all' || product === 'meditation') {
    const blocks = cssBlocks(read('apps/meditation/global.css'));
    rejectUnmapped(blocks, MEDITATION, 'Meditation');
    const theme = typescriptReader(read('apps/meditation/constants/theme.ts'), 'apps/meditation/constants/theme.ts', ts);
    for (const [mode, name] of Object.entries({ dark: 'NightTheme', light: 'PaperTheme', default: 'PaperTheme' })) {
      compare(`Meditation ${mode}`, blocks[mode], MEDITATION, key => theme.token(name, key));
    }
  }
  return { checked, errors };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => !['--journal', '--meditation', '--all'].includes(arg))) throw new Error('Usage: node scripts/check-brand-tokens.js [--journal|--meditation|--all]');
    const result = checkBrandTokens({ product: args[0]?.slice(2) || 'journal' });
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    console.log(`Brand token contract: ${result.checked} CSS/TypeScript comparisons passed.`);
  } catch (error) {
    console.error(`Brand token contract failed:\n${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { checkBrandTokens, normalizeColor, cssBlocks };
