#!/usr/bin/env node
/* global __dirname, fetch */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.tanuki75.noctalia';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const DEFAULT_FILE = path.join(
  ROOT_DIR,
  'doc_web_interne',
  'docs',
  'google-play-listing-state.local.json'
);

function parseArgs(argv) {
  const args = { packageName: PACKAGE_NAME, language: 'fr-FR', file: DEFAULT_FILE };
  const names = new Set(['package-name', 'edit-id', 'language', 'file', 'checked-at']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (!arg.startsWith('--') || !names.has(arg.slice(2))) throw new Error(`Option inconnue : ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
    index += 1;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    args[key] = key === 'file' ? path.resolve(ROOT_DIR, value) : value;
  }
  if (!args.help && !args.editId) {
    throw new Error('--edit-id est requis. Le script refuse de créer un edit, afin de rester en lecture seule.');
  }
  return args;
}

function getAccessToken(environment = process.env, execFile = execFileSync) {
  if (environment.GOOGLE_PLAY_ANDROID_PUBLISHER_ACCESS_TOKEN) {
    return environment.GOOGLE_PLAY_ANDROID_PUBLISHER_ACCESS_TOKEN.trim();
  }
  try {
    return String(
      execFile('gcloud', ['auth', 'application-default', 'print-access-token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    ).trim();
  } catch (_error) {
    throw new Error(
      `Authentification absente. Définissez GOOGLE_PLAY_ANDROID_PUBLISHER_ACCESS_TOKEN ou des ADC avec ${ANDROID_PUBLISHER_SCOPE}.`
    );
  }
}

function listingUrl({ packageName, editId, language }) {
  return `${API_ROOT}/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(language)}`;
}

async function exportListing(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const accessToken = dependencies.accessToken || getAccessToken();
  const response = await fetchImpl(listingUrl(options), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  let listing = {};
  try {
    listing = text ? JSON.parse(text) : {};
  } catch (_error) {
    throw new Error(`Réponse Android Publisher non JSON (${response.status}).`);
  }
  if (!response.ok) {
    const message = listing.error?.message || response.statusText || 'requête refusée';
    throw new Error(`Android Publisher ${response.status}: ${message}.`);
  }
  return {
    schema_version: 1,
    package_name: options.packageName,
    language: options.language,
    generated_at: options.checkedAt || new Date().toISOString(),
    read_only: true,
    source: 'android_publisher_edits_listings_get',
    listing: {
      title: listing.title || '',
      short_description: listing.shortDescription || '',
      full_description: listing.fullDescription || '',
      video: listing.video || null,
    },
    limitations: [
      'Android Publisher n’expose la fiche que dans le contexte d’un edit.',
      'Ce script exige un editId existant et ne peut ni créer, ni modifier, ni valider un edit.',
    ],
  };
}

function writeJson(file, document) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function printHelp() {
  console.log(`
Usage:
  npm run aso:google-play:listing -- --edit-id <editId-existant> [--language fr-FR]

Le script exécute uniquement edits.listings.get. Il ne crée et ne valide jamais d’edit.
Auth : GOOGLE_PLAY_ANDROID_PUBLISHER_ACCESS_TOKEN ou ADC avec ${ANDROID_PUBLISHER_SCOPE}
`);
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) return printHelp();
    const document = await exportListing(args);
    writeJson(args.file, document);
    console.log(`Fiche Google Play lue : ${path.relative(ROOT_DIR, args.file)}`);
  } catch (error) {
    console.error(`Erreur fiche Google Play : ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ANDROID_PUBLISHER_SCOPE,
  API_ROOT,
  exportListing,
  getAccessToken,
  listingUrl,
  parseArgs,
  writeJson,
};
