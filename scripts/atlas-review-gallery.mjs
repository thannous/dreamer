#!/usr/bin/env node
// One review page for a batch of atlas pages: a choice per page, each published language of the
// symbols, the real site sizes (2560×1440 and 390×844) in an iframe scaled to fit, and the three places
// to look at (top, side illustration, scenes).
// It replaces a hand-copied gallery per batch; it is a local review file, never a site page.
//
//   node scripts/atlas-review-gallery.mjs --pages <pages.json> --out <review.html>
//     [--site-url http://localhost:8000] [--manifest <assets manifest>] [--title <text>] [--repo-root <dir>]
//
// pages.json: [{ "id": "moon", "slug": "lune", "name": "Lune", "mood": "brume basse, scintillements" }]
// Each id must be a catalogue symbol with that French slug; the page of each other language is the
// catalogue's slug under that language's symbols path (site.config.json). The manifest (default: the
// shared symbol-atlas-six-assets.json) tells which of the eight roles each page already has.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, PILOTS_CONFIG, SHARED_MANIFEST, rolesOf } from './lib/atlas-pack-contract.mjs';
import { inside, realTarget } from './lib/atlas-paths.mjs';

const require = createRequire(import.meta.url);
const { catalogKey } = require('./lib/symbol-locales.js');
const SITE_CONFIG = 'docs-src/config/site.config.json';

const SCRIPT = fileURLToPath(import.meta.url);
const fromCaller = (file) => path.resolve(process.env.INIT_CWD || process.cwd(), file);
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

class GalleryError extends Error {}

function parseArgs(argv) {
  const options = { siteUrl: 'http://localhost:8000', title: 'Revue des pages atlas' };
  const valued = { '--pages': 'pages', '--out': 'out', '--site-url': 'siteUrl', '--manifest': 'manifest', '--title': 'title', '--repo-root': 'repoRoot' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = valued[argv[index]];
    if (!key || !argv[index + 1]) throw new GalleryError(`unknown or incomplete argument ${argv[index]}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  if (!options.pages || !options.out) throw new GalleryError('--pages <pages.json> and --out <review.html> are required');
  if (!/^https?:\/\/[^\s"'<>]+$/.test(options.siteUrl)) throw new GalleryError('--site-url must be an http(s) URL');
  return options;
}

export function buildGallery(options) {
  const repoRoot = fs.realpathSync(options.repoRoot ? fromCaller(options.repoRoot) : path.join(path.dirname(SCRIPT), '..'));
  // The page is written at its real path, checked against the real site folders: a folder link,
  // junction or alias on the way is resolved first, so it cannot carry the write into the site.
  const requested = fromCaller(options.out);
  const out = realTarget(requested);
  if (!out) throw new GalleryError(`${requested} goes through a broken link`);
  for (const site of ['docs', 'docs-src']) {
    const real = realTarget(path.join(repoRoot, site)) ?? path.join(repoRoot, site);
    if (inside(real, out)) throw new GalleryError(`the review page must stay outside ${site}/ (it is never a site page); ${requested} lands in ${out}`);
  }
  // The file itself: a link or a hard link (another name of a file elsewhere) is never written through.
  let existing = null;
  try { existing = fs.lstatSync(requested); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && (existing.isSymbolicLink() || !existing.isFile() || existing.nlink > 1)) throw new GalleryError(`${requested} must be a new or plain file, not a link, a hard link or a folder`);
  const pages = JSON.parse(fs.readFileSync(fromCaller(options.pages), 'utf8'));
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 24) throw new GalleryError('pages.json must list 1 to 24 pages');
  const siteConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, SITE_CONFIG), 'utf8'));
  const languages = siteConfig.collections.symbols.languages;
  const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, CATALOG), 'utf8')).symbols;
  const pilots = JSON.parse(fs.readFileSync(path.join(repoRoot, PILOTS_CONFIG), 'utf8'));
  const manifestFile = options.manifest ? fromCaller(options.manifest) : path.join(repoRoot, SHARED_MANIFEST);
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  const rows = pages.map((page, index) => {
    const keys = Object.keys(page ?? {}).sort().join();
    if (keys !== 'id,mood,name,slug' || Object.values(page).some((value) => typeof value !== 'string' || !value.trim())) throw new GalleryError(`pages[${index}] must be { id, slug, name, mood } strings`);
    const symbol = catalog.find((item) => item.id === page.id);
    if (!symbol) throw new GalleryError(`pages[${index}]: ${page.id} is not in ${CATALOG}`);
    if (symbol.fr?.slug !== page.slug) throw new GalleryError(`pages[${index}]: the French slug of ${page.id} is ${symbol.fr?.slug}, not ${page.slug}`);
    const scenes = pilots[page.id]?.scenes.map((scene) => scene.id);
    const present = Object.keys(manifest[page.id] ?? {});
    const missing = scenes ? rolesOf(scenes).filter((role) => !present.includes(role)) : null;
    const localized = Object.fromEntries(languages.map((lang) => [lang, symbol[catalogKey(lang)]]));
    return { ...page, localized, active: Boolean(pilots[page.id]), roles: scenes ? `${8 - missing.length}/8 rôles` : `${present.length} rôle(s), page non inscrite`, missing };
  });
  const site = options.siteUrl.replace(/\/+$/, '');
  const data = JSON.stringify(rows.map((row) => Object.fromEntries(languages.map((lang) => [lang, {
    name: row.localized[lang].name,
    url: `${site}/${lang}/${siteConfig.symbolsPath[lang]}/${row.localized[lang].slug}.html`,
  }])))).replace(/</g, '\\u003c');
  const languageButtons = languages.map((lang) => `
  <button type="button" data-lang="${escape(lang)}" aria-pressed="${lang === 'fr'}">${escape(lang.toUpperCase())}</button>`).join('');
  const choices = rows.map((row, index) => `
      <button type="button" class="choice" data-index="${index}" aria-pressed="${index === 0}">
        <strong>${escape(row.name)}</strong><span>${escape(row.mood)}</span>
        <em>${row.active ? 'page active' : 'page non active'} · ${escape(row.roles)}${row.missing?.length ? ` (manque ${escape(row.missing.join(', '))})` : ''}</em>
      </button>`).join('');
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(options.title)}</title>
<style>
  :root { --ground: #03040d; --card: #14131a; --text: #fff9ef; --muted: #b7aec9; --accent: #ead4b4; }
  * { box-sizing: border-box; }
  html { overflow-y: scroll; }
  body { margin: 0; background: var(--ground); color: var(--text); font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  header { padding: 20px 24px 8px; }
  h1 { margin: 0; font: 600 24px/1.2 ui-serif, Georgia, serif; }
  header p { margin: 4px 0 0; color: var(--muted); }
  .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; padding: 12px 24px; }
  .choice { display: grid; gap: 2px; text-align: left; padding: 12px 14px; border: 1px solid rgba(255, 249, 239, 0.14); border-radius: 6px; background: var(--card); color: var(--text); font: inherit; cursor: pointer; }
  .choice span, .choice em { color: var(--muted); font-size: 13px; font-style: normal; }
  .choice[aria-pressed="true"] { border-color: var(--accent); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 24px 12px; }
  .controls button { padding: 8px 14px; border: 1px solid rgba(255, 249, 239, 0.24); border-radius: 999px; background: transparent; color: var(--text); font: inherit; cursor: pointer; }
  .controls button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--ground); }
  .controls button:disabled { opacity: 0.35; cursor: not-allowed; }
  .controls a { margin-left: auto; color: var(--accent); }
  .controls .note { color: var(--muted); font-size: 13px; }
  .stage { padding: 0 24px 24px; }
  .frame { position: relative; overflow: hidden; margin: 0 auto; border: 1px solid rgba(255, 249, 239, 0.14); background: #000; }
  .frame iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
</head>
<body>
<header>
  <h1>${escape(options.title)}</h1>
  <p>Pages servies par ${escape(site)} · tailles réelles du site, réduites pour tenir à l’écran · fichier de revue, hors site.</p>
</header>
<nav class="choices" aria-label="Pages">${choices}
</nav>
<div class="controls" role="group" aria-label="Affichage">${languageButtons}
  <span aria-hidden="true">·</span>
  <button type="button" data-size="2560x1440" aria-pressed="true">2560 × 1440</button>
  <button type="button" data-size="390x844" aria-pressed="false">390 × 844</button>
  <span aria-hidden="true">·</span>
  <button type="button" data-place="" aria-pressed="true">Haut</button>
  <button type="button" data-place="#meaning" aria-pressed="false">Latérale</button>
  <button type="button" data-place="#scenes" aria-pressed="false">Scènes</button>
  <span class="note" id="note"></span>
  <a id="open" href="#" target="_blank" rel="noopener">Ouvrir la page</a>
</div>
<main class="stage"><div class="frame" id="frame"></div></main>
<script>
  const pages = ${data};
  const state = { page: 0, lang: 'fr', size: [2560, 1440], place: '' };
  const frame = document.getElementById('frame');
  let view = null;
  const press = (selector, match) => document.querySelectorAll(selector).forEach((button) => button.setAttribute('aria-pressed', String(match(button))));
  // The scaled page fills the frame's inside: the stage's width without its paddings, minus the
  // frame's borders (the frame's size includes them). The scrollbar is always reserved (html), so
  // showing a taller frame never narrows the stage after the fit.
  function fit() {
    const [width, height] = state.size;
    const stage = getComputedStyle(document.querySelector('.stage'));
    const edge = getComputedStyle(frame);
    const across = parseFloat(edge.borderLeftWidth) + parseFloat(edge.borderRightWidth);
    const down = parseFloat(edge.borderTopWidth) + parseFloat(edge.borderBottomWidth);
    const room = document.querySelector('.stage').clientWidth - parseFloat(stage.paddingLeft) - parseFloat(stage.paddingRight) - across;
    const inner = Math.max(1, Math.min(width, Math.floor(room)));
    const scale = inner / width;
    view.style.width = width + 'px';
    view.style.height = height + 'px';
    view.style.transform = 'scale(' + scale + ')';
    frame.style.width = inner + across + 'px';
    frame.style.height = Math.ceil(height * scale) + down + 'px';
  }
  function show() {
    const phone = state.size[0] < 768;
    const side = document.querySelector('[data-place="#meaning"]');
    side.disabled = phone;
    if (phone && state.place === '#meaning') state.place = '';
    document.getElementById('note').textContent = phone ? 'Latérale indisponible sur mobile (affichée à partir de 1440 px).' : '';
    press('.choice', (button) => Number(button.dataset.index) === state.page);
    press('[data-lang]', (button) => button.dataset.lang === state.lang);
    press('[data-size]', (button) => button.dataset.size === state.size.join('x'));
    press('[data-place]', (button) => button.dataset.place === state.place);
    const page = pages[state.page][state.lang];
    const url = page.url + state.place;
    document.getElementById('open').href = url;
    // Each change opens the page in a new frame, titled, sized and pointed at its section before it
    // is inserted: a reused frame keeps the scroll, history and layout of what it showed before, and
    // a fragment change alone does not reliably bring the section into view.
    const next = document.createElement('iframe');
    next.id = 'view';
    next.title = page.name;
    view = next;
    fit();
    next.src = url;
    frame.replaceChildren(next);
  }
  document.querySelectorAll('.choice').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.index); show(); }));
  document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => { state.lang = button.dataset.lang; show(); }));
  document.querySelectorAll('[data-size]').forEach((button) => button.addEventListener('click', () => { state.size = button.dataset.size.split('x').map(Number); show(); }));
  document.querySelectorAll('[data-place]').forEach((button) => button.addEventListener('click', () => { state.place = button.dataset.place; show(); }));
  window.addEventListener('resize', fit);
  show();
</script>
</body>
</html>
`;
  return { html, out, rows };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { html, out, rows } = buildGallery(options);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log(`atlas-review-gallery: ${out} (${rows.length} page(s): ${rows.map((row) => `${row.id} ${row.roles}`).join('; ')})`);
  } catch (error) {
    if (!(error instanceof GalleryError) && !(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error;
    console.error(`atlas-review-gallery: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main();
