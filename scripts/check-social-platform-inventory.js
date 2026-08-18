#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseDebtCard } = require('./check-social-instagram-debt');
const { parseTableRows, urlMatchesAccount } = require('./check-social-public-proof');

const DEFAULT_DEBT_CARD = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/49-INSTAGRAM-PRIMARY-DEBT-CARD.md',
);
const DEFAULT_COVERAGE = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/08-COVERAGE-AND-ROLLING-REFILL.md',
);
const DEFAULT_ACTIVE_CARD = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/07-NEXT-DAY-EXECUTION-CARD.md',
);
const DEFAULT_ARCHIVE_PILOT_CARD = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/30-ARCHIVE-PILOT-CARD-2026-08-23-68-PRAIRIE.md',
);
const DEFAULT_YOUTUBE_REPLACEMENT_CARD = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/25-EXECUTION-CARD-2026-08-30.md',
);
const DEFAULT_YOUTUBE_REPLACEMENT_PROOF = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10/65-PUBLIC-PROOF-2026-08-30.md',
);
const DEFAULT_PROOF_DIRECTORY = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);
const DEFAULT_MAIN_PLAN = path.resolve(
  __dirname,
  '../doc_web_interne/docs/noctalia-social/community-manager/2026-08-us-europe-publication-plan.md',
);

const PLATFORM_COLUMNS = [
  ['TikTok', 4, ['tiktok.com']],
  ['Instagram', 5, ['instagram.com']],
  ['X', 6, ['x.com', 'twitter.com']],
  ['YouTube', 7, ['youtube.com', 'youtu.be']],
  ['Facebook', 8, ['facebook.com']],
  ['Pinterest', 9, ['pinterest.com']],
];

function markdownUrl(cell) {
  const match = cell.match(/\[[^\]]+\]\((https:\/\/[^)]+)\)/);
  return match ? match[1] : '';
}

function hostMatches(url, hosts) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function parseInventoryRows(content) {
  const lines = content.split('\n');
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('| Asset exact | Rôle | Triage archive | Priorité | TikTok | Instagram | X | YouTube | Facebook | Pinterest | Note |'),
  );
  if (headerIndex < 0) throw new Error('En-tête du registre consolidé introuvable.');

  return lines
    .slice(headerIndex + 2)
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function debtTriageDate(triage) {
  const match = triage.match(/À RATTRAPER SUR INSTAGRAM — AFFECTÉ (\d{2}\/\d{2}) À (\d{2}:\d{2})/u);
  return match ? `${match[1]} à ${match[2]}` : '';
}

function markdownSection(content, heading, nextHeading) {
  const start = content.indexOf(heading);
  if (start < 0) return '';
  const end = nextHeading ? content.indexOf(nextHeading, start + heading.length) : -1;
  return content.slice(start, end < 0 ? content.length : end);
}

function parseArchivePriorities(content, heading, assetColumn, priorityColumn, nextHeading) {
  const section = markdownSection(content, heading, nextHeading);
  if (!section) return new Map();
  const priorities = new Map();
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const priority = (cells[priorityColumn] || '').match(/^([ABC])(?:\s|$)/u)?.[1] || '';
    if (!priority) continue;
    const assets = [...(cells[assetColumn] || '').matchAll(/`([^`]+\.mp4)`/gu)].map((match) => match[1]);
    for (const asset of assets) priorities.set(asset, priority);
  }
  return priorities;
}

function validateArchivePriorityConsistency(content) {
  const queue = parseArchivePriorities(
    content,
    '### File opérationnelle complète des archives',
    1,
    0,
    '## Stratégie de rattrapage',
  );
  const detailed = parseArchivePriorities(
    content,
    '### Première vague prioritaire',
    1,
    2,
    '### Packaging natif du pilote archive',
  );
  if (queue.size === 0 || detailed.size === 0) return;

  for (const [asset, priority] of detailed) {
    if (!queue.has(asset)) continue;
    if (queue.get(asset) !== priority) {
      throw new Error(`${asset}: priorité archive incohérente (${priority} au lieu de ${queue.get(asset)}).`);
    }
  }
}

function validateReplacementCoverage(inventory, coverage, relatedSources = '') {
  const rows = parseInventoryRows(inventory);
  const pendingYouTubeReplacement = rows.some((row) =>
    /À EXCLURE.*SUPPLANTÉ/u.test(row[2]) &&
    /PROGRAMMÉ.*À REMPLACER/u.test(row[7])
  );
  if (pendingYouTubeReplacement && /YouTube[^\n]*(?:Programmé jusqu'au|19\/28|dette\s*`?9\/28)/iu.test(coverage)) {
    throw new Error('Couverture YouTube continue ou dette sous-estimée interdite tant qu’un hero reste PROGRAMMÉ — À REMPLACER.');
  }

  const pendingFacebookReplacement = rows.some((row) =>
    /À EXCLURE.*SUPPLANTÉ/u.test(row[2]) &&
    /PROGRAMMÉ.*À REMPLACER/u.test(row[8])
  );
  if (pendingFacebookReplacement && /Facebook[^\n|]*(?:\|[^\n|]*){2}\|[^\n]*(?:28\/28 heroes exacts|Aucune dette de programmation hero)/iu.test(coverage)) {
    throw new Error('Couverture Facebook 28/28 interdite tant qu’un remplacement hero reste PROGRAMMÉ — À REMPLACER.');
  }
  if (!pendingFacebookReplacement && /Facebook[^\n]*`?27\/28`? heroes exacts/iu.test(`${coverage}\n${relatedSources}`)) {
    throw new Error('Couverture Facebook 27/28 obsolète alors qu’aucun remplacement hero ne reste PROGRAMMÉ — À REMPLACER.');
  }

  const pendingXReplacement = rows.some((row) =>
    /À EXCLURE.*SUPPLANTÉ/u.test(row[2]) &&
    /PROGRAMMÉ.*À REMPLACER/u.test(row[6])
  );
  if (pendingXReplacement && /X `@NoctaliaDreams`[^\n]*\|\s*Programmé jusqu'au/iu.test(coverage)) {
    throw new Error('Couverture X continue interdite tant qu’un remplacement C1 reste PROGRAMMÉ — À REMPLACER.');
  }
}

function validateActiveYouTubeOrder(inventory, activeCard) {
  const pendingYouTubeReplacement = parseInventoryRows(inventory).some((row) =>
    /À EXCLURE.*SUPPLANTÉ/u.test(row[2]) &&
    /PROGRAMMÉ.*À REMPLACER/u.test(row[7])
  );
  if (!pendingYouTubeReplacement) return;

  const retryLine = activeCard.split('\n').find((line) => /^\| 10:45 \|/u.test(line)) || '';
  if (!/remplacer d'abord le hero erroné du 30\/08/iu.test(retryLine) ||
      !/reprendre le 02\/09 uniquement après preuve/iu.test(retryLine)) {
    throw new Error('La reprise YouTube active doit remplacer le 30/08 avant toute programmation du 02/09.');
  }
}

function validateMainPlanReplacementState(inventory, mainPlan) {
  const pendingFacebookReplacement = parseInventoryRows(inventory).some((row) =>
    /À EXCLURE.*SUPPLANTÉ/u.test(row[2]) &&
    /PROGRAMMÉ.*À REMPLACER/u.test(row[8])
  );
  if (pendingFacebookReplacement) return;

  const floralRow = mainPlan.split('\n').find((line) =>
    line.startsWith('| 30/08 | 15:30 / 15:45 / 16:15 | `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` |')
  ) || '';
  if (!floralRow) throw new Error('Ligne florale principale du 30/08 absente de la source de vérité.');
  if (/YouTube\s*\/\s*Facebook restent à remplacer/iu.test(floralRow) ||
      !/Facebook est \*\*PROGRAMMÉ — REMPLACEMENT EXACT VÉRIFIÉ DANS LA MÊME LIGNE NATIVE\*\*/u.test(floralRow) ||
      !/sans dette restante/iu.test(floralRow)) {
    throw new Error('Source de vérité 30/08 obsolète : Facebook doit être clos sans dette et seul YouTube reste à remplacer.');
  }
}

function validateYouTubeReplacementProtocol(inventory, executionCard, proofRegister) {
  const rows = parseInventoryRows(inventory);
  const oldRow = rows.find((row) => row[0] === '`DAY_LUNARPUNK_SILVER_LUNAR_02.mp4`');
  const newRow = rows.find((row) => row[0] === '`AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4`');
  if (!oldRow || !newRow) throw new Error('Paire de remplacement YouTube du 30/08 absente de l’inventaire.');

  const pending = /PROGRAMMÉ.*À REMPLACER/u.test(oldRow[7]);
  if (!pending) return;

  const requiredCard = [
    [/ancien Short `8-m-p4qXG_g`/u, 'identifiant de l’ancien Short absent'],
    [/AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01\.mp4/u, 'master floral exact absent'],
    [/229d1f545586ccaa51e363af5fdb100d8e45906892c5b8bdfe08b9509527ced0/u, 'SHA-256 floral absent'],
    [/Would You Fly Through This Flower World\? #Shorts/u, 'titre YouTube exact absent'],
    [/Not made for kids/iu, 'audience YouTube absente'],
    [/label IA/iu, 'contrôle du label IA absent'],
    [/droits/u, 'contrôle des droits absent'],
    [/Seulement ensuite, modifier la visibilité de l'ancien Short vers `Privée`/u, 'ordre transactionnel vers Privée absent'],
    [/Ne jamais utiliser `Supprimer définitivement`/u, 'interdiction de suppression définitive absente'],
    [/une seule occurrence publique future exacte reste à 18:00/u, 'contrôle final d’unicité absent'],
  ];
  for (const [pattern, message] of requiredCard) {
    if (!pattern.test(executionCard)) throw new Error(`Remplacement YouTube 30/08 incomplet : ${message}.`);
  }

  if (!/YouTube `UCQZsVAOggq_meTWYG-4dHfw` \| 18:00 \| `Would You Fly Through This Flower World\? #Shorts` \| \*\*À REMPLACER — NON CONFIRMÉ\*\*/u.test(proofRegister)) {
    throw new Error('Registre public YouTube du 30/08 incohérent avec le remplacement en attente.');
  }
  if (!/elle sera alors passée en `Privée`, jamais supprimée/u.test(proofRegister)) {
    throw new Error('Registre public YouTube sans garantie réversible sur l’ancien Short.');
  }
}

function scheduledHeroDates(directory) {
  const result = new Map([['Pinterest', []], ['YouTube', []], ['Facebook', []]]);
  for (const file of fs.readdirSync(directory).filter((name) => /PUBLIC-PROOF-2026-\d{2}-\d{2}\.md$/u.test(name))) {
    const date = file.match(/2026-\d{2}-\d{2}/u)?.[0] || '';
    if (date < '2026-08-14' || date > '2026-09-10') continue;
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    for (const platform of result.keys()) {
      const line = content.split('\n').find((candidate) => candidate.startsWith(`| ${platform} `)) || '';
      if (/\| \*\*(?:PROGRAMMÉ|PUBLIÉ)(?:\s|\*)/u.test(line)) result.get(platform).push(date);
    }
  }
  for (const dates of result.values()) dates.sort();
  return result;
}

function primaryQueueSlots(directory) {
  const result = new Map([['TikTok', []], ['Instagram', []], ['X', []]]);
  const directInstagram = [];
  const failedInstagram = [];
  for (const file of fs.readdirSync(directory).filter((name) => /PUBLIC-PROOF-2026-\d{2}-\d{2}\.md$/u.test(name))) {
    const date = file.match(/2026-\d{2}-\d{2}/u)?.[0] || '';
    if (date < '2026-08-14' || date > '2026-09-10') continue;
    const rows = parseTableRows(fs.readFileSync(path.join(directory, file), 'utf8')).slice(0, 9);
    for (const row of rows) {
      const platform = ['TikTok', 'Instagram', 'X'].find((name) => (row[1] || '').startsWith(name));
      if (!platform) continue;
      const status = row[row.length - 2] || '';
      const key = `${date}-${row[0]}`;
      if (/^\*\*(?:PROGRAMMÉ|PUBLIÉ)/u.test(status)) result.get(platform).push(key);
      if (platform === 'Instagram' && /^\*\*PRÊT — DIRECT/u.test(status)) directInstagram.push(key);
      if (platform === 'Instagram' && /^\*\*ÉCHEC — NON PUBLIÉ/u.test(status)) failedInstagram.push(key);
    }
  }
  for (const slots of result.values()) slots.sort();
  directInstagram.sort();
  return { exact: result, directInstagram, failedInstagram };
}

function validatePrimaryQueueEvidence(directory, coverage) {
  const allSlots = [];
  for (let date = new Date('2026-08-14T00:00:00Z'); date <= new Date('2026-09-10T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    for (const slot of ['C1', 'C2', 'C3']) allSlots.push(`${day}-${slot}`);
  }
  const { exact, directInstagram, failedInstagram } = primaryQueueSlots(directory);
  const debtClaims = {
    TikTok: Number(coverage.match(/TikTok[^\n]*\*\*(\d+) lignes\*\* à remplir/iu)?.[1]),
    Instagram: Number(coverage.match(/Instagram[^\n]*\*\*(\d+) lignes?\*\* à rattraper/iu)?.[1] || 0),
    X: Number(coverage.match(/X `@NoctaliaDreams`[^\n]*\*\*(\d+) ligne(?:s)? restante(?:s)?\*\*/iu)?.[1]),
  };
  const exactClaims = {
    TikTok: Number(coverage.match(/TikTok[^\n]*\*\*(\d+)\/84 lignes exactes\*\*/iu)?.[1]),
    Instagram: Number(coverage.match(/Instagram[^\n]*\*\*(\d+)\/84 lignes couvertes\*\*/iu)?.[1]),
    X: Number(coverage.match(/X `@NoctaliaDreams`[^\n]*\*\*(\d+)\/84 lignes exactes\*\*/iu)?.[1]),
  };
  for (const [platform, debt] of Object.entries(debtClaims).filter(([name]) => name !== 'Instagram')) {
    if (!Number.isInteger(debt)) throw new Error(`${platform}: dette principale chiffrée absente de la couverture.`);
    const expectedExact = allSlots.length - debt;
    const slots = exact.get(platform);
    if (exactClaims[platform] !== expectedExact) {
      throw new Error(`${platform}: compteur principal déclaré incohérent (${exactClaims[platform]}/84 au lieu de ${expectedExact}/84).`);
    }
    if (slots.length !== expectedExact) {
      throw new Error(`${platform}: couverture principale incohérente (${slots.length}/84 prouvée, ${expectedExact}/84 déclarée).`);
    }
    const exactSet = new Set(slots);
    const furthestIndex = Math.max(...slots.map((slot) => allSlots.indexOf(slot)));
    for (let index = 0; index <= furthestIndex; index += 1) {
      if (!exactSet.has(allSlots[index])) throw new Error(`${platform}: trou principal non justifié sur ${allSlots[index]}.`);
    }
  }

  const instagramCovered = new Set([...exact.get('Instagram'), ...directInstagram]);
  const instagramFailed = new Set(failedInstagram);
  const instagramMissing = new Set(allSlots.filter((slot) => !instagramCovered.has(slot)));
  if (instagramMissing.size !== debtClaims.Instagram || instagramFailed.size !== debtClaims.Instagram ||
      [...instagramMissing].some((slot) => !instagramFailed.has(slot)) ||
      [...instagramFailed].some((slot) => !instagramMissing.has(slot))) {
    throw new Error('Instagram: les lignes non couvertes doivent être explicitement consignées ÉCHEC — NON PUBLIÉ et correspondre à la dette déclarée.');
  }
  if (exactClaims.Instagram !== instagramCovered.size) {
    throw new Error(`Instagram: compteur principal déclaré incohérent (${exactClaims.Instagram}/84 au lieu de ${instagramCovered.size}/84).`);
  }
  return {
    TikTok: exact.get('TikTok').length,
    Instagram: instagramCovered.size,
    X: exact.get('X').length,
  };
}

function validateHeroQueueEvidence(directory, coverage) {
  const exact = scheduledHeroDates(directory);
  const allDates = [];
  for (let date = new Date('2026-08-14T00:00:00Z'); date <= new Date('2026-09-10T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
    allDates.push(date.toISOString().slice(0, 10));
  }
  const pendingReplacementDates = new Map([['Pinterest', new Set()], ['YouTube', new Set()], ['Facebook', new Set()]]);
  for (const file of fs.readdirSync(directory).filter((name) => /PUBLIC-PROOF-2026-\d{2}-\d{2}\.md$/u.test(name))) {
    const date = file.match(/2026-\d{2}-\d{2}/u)?.[0] || '';
    if (!allDates.includes(date)) continue;
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    for (const platform of pendingReplacementDates.keys()) {
      const line = content.split('\n').find((candidate) => candidate.startsWith(`| ${platform} `)) || '';
      if (/À REMPLACER/u.test(line)) pendingReplacementDates.get(platform).add(date);
    }
  }

  for (const platform of exact.keys()) {
    const claim = coverage.match(new RegExp(`${platform}[^\\n]*\\*\\*(\\d+)\\/28 heroes exacts\\*\\*`, 'iu'));
    if (!claim) throw new Error(`${platform}: couverture exacte sur 28 absente.`);
    if (Number(claim[1]) !== exact.get(platform).length) {
      throw new Error(`${platform}: compteur HERO incohérent (${claim[1]}/28 déclaré, ${exact.get(platform).length}/28 prouvé).`);
    }

    const exactSet = new Set(exact.get(platform));
    const furthestIndex = Math.max(...exact.get(platform).map((date) => allDates.indexOf(date)));
    if (furthestIndex < 0) continue;
    for (let index = 0; index <= furthestIndex; index += 1) {
      const date = allDates[index];
      if (!exactSet.has(date) && !pendingReplacementDates.get(platform).has(date)) {
        throw new Error(`${platform}: trou HERO non justifié le ${date}.`);
      }
    }
  }
  return Object.fromEntries([...exact].map(([platform, dates]) => [platform, dates.length]));
}

function validatePlatformInventory(content, options = {}) {
  validateArchivePriorityConsistency(content);
  const rows = parseInventoryRows(content);
  if (rows.length === 0) throw new Error('Aucune ligne vidéo trouvée dans le registre consolidé.');

  const assets = new Set();
  const urls = new Set();
  let publicUrls = 0;
  let scheduledUrls = 0;
  const instagramDebts = new Map();

  for (const [index, row] of rows.entries()) {
    if (row.length !== 11) throw new Error(`Ligne ${index + 1}: 11 colonnes attendues, ${row.length} trouvées.`);
    const asset = row[0].replace(/^`|`$/g, '');
    if (!asset) throw new Error(`Ligne ${index + 1}: asset vide.`);
    if (assets.has(asset)) throw new Error(`Asset dupliqué: ${asset}.`);
    assets.add(asset);

    let rowUrls = 0;
    let rowPublicUrls = 0;
    for (const [platform, column, hosts] of PLATFORM_COLUMNS) {
      const url = markdownUrl(row[column]);
      if (!url) continue;
      if (!hostMatches(url, hosts)) throw new Error(`${asset}: domaine invalide dans la colonne ${platform}.`);
      if (!urlMatchesAccount(url, platform)) {
        throw new Error(`${asset}: URL hors du compte Noctalia exact dans la colonne ${platform}.`);
      }
      if (urls.has(url)) throw new Error(`URL publique dupliquée: ${url}.`);
      urls.add(url);
      rowUrls += 1;
      if (/PROGRAMMÉ/u.test(row[column]) && !/PUBLIÉ/u.test(row[column])) scheduledUrls += 1;
      else {
        publicUrls += 1;
        rowPublicUrls += 1;
      }
    }

    const triage = row[2];
    if (/DÉJÀ PUBLIÉE/u.test(triage) && rowPublicUrls !== 6) {
      throw new Error(`${asset}: DÉJÀ PUBLIÉE exige 6 URL publiques, ${rowPublicUrls} trouvées.`);
    }
    if (/À RATTRAPER/u.test(triage) && rowPublicUrls === 0) {
      throw new Error(`${asset}: À RATTRAPER sans aucune preuve publique source.`);
    }
    const debtDate = debtTriageDate(triage);
    if (debtDate) {
      if (!markdownUrl(row[4]) || !markdownUrl(row[6]) ||
          [row[4], row[6]].some((cell) => /PROGRAMMÉ/u.test(cell) && !/PUBLIÉ/u.test(cell))) {
        throw new Error(`${asset}: dette Instagram sans preuves publiques TikTok et X.`);
      }
      if (markdownUrl(row[5]) || !/PRÊT/u.test(row[5]) || !/NON PUBLIÉ/u.test(row[5])) {
        throw new Error(`${asset}: dette Instagram exige une cellule Instagram PRÊT — NON PUBLIÉ sans URL.`);
      }
      if (row.slice(7, 10).some((cell) => markdownUrl(cell))) {
        throw new Error(`${asset}: extension secondaire interdite tant que la dette Instagram reste ouverte.`);
      }
      instagramDebts.set(asset, debtDate);
    }
    if (/À EXCLURE/u.test(triage) && /PROGRAMMÉ|PUBLIÉ/u.test(row.slice(4, 10).join(' ')) && rowUrls === 0) {
      throw new Error(`${asset}: exclusion incohérente avec un statut externe sans URL.`);
    }
  }

  if (options.expectedInstagramDebts) {
    const expected = new Map(options.expectedInstagramDebts.map((row) => [row.asset, row.date]));
    for (const [asset, date] of expected) {
      if (!instagramDebts.has(asset)) throw new Error(`${asset}: dette Instagram absente du registre consolidé.`);
      if (instagramDebts.get(asset) !== date) {
        throw new Error(`${asset}: date de dette Instagram incohérente (${instagramDebts.get(asset)} au lieu de ${date}).`);
      }
    }
    for (const asset of instagramDebts.keys()) {
      if (!expected.has(asset)) throw new Error(`${asset}: dette Instagram absente de la fiche d'exécution.`);
    }
  }

  return { assets: rows.length, publicUrls, scheduledUrls, instagramDebts: instagramDebts.size };
}

function main(argv = process.argv.slice(2)) {
  const file = argv[0] || 'doc_web_interne/docs/noctalia-social/PLATFORM-VIDEO-INVENTORY.md';
  const debtCard = argv[1] ? path.resolve(argv[1]) : DEFAULT_DEBT_CARD;
  const coverage = argv[2] ? path.resolve(argv[2]) : DEFAULT_COVERAGE;
  const activeCard = argv[3] ? path.resolve(argv[3]) : DEFAULT_ACTIVE_CARD;
  const archivePilotCard = argv[4] ? path.resolve(argv[4]) : DEFAULT_ARCHIVE_PILOT_CARD;
  const youtubeReplacementCard = argv[5] ? path.resolve(argv[5]) : DEFAULT_YOUTUBE_REPLACEMENT_CARD;
  const youtubeReplacementProof = argv[6] ? path.resolve(argv[6]) : DEFAULT_YOUTUBE_REPLACEMENT_PROOF;
  const proofDirectory = argv[7] ? path.resolve(argv[7]) : DEFAULT_PROOF_DIRECTORY;
  const mainPlan = argv[8] ? path.resolve(argv[8]) : DEFAULT_MAIN_PLAN;
  const inventory = fs.readFileSync(path.resolve(file), 'utf8');
  const expectedInstagramDebts = parseDebtCard(fs.readFileSync(debtCard, 'utf8'));
  validateReplacementCoverage(
    inventory,
    fs.readFileSync(coverage, 'utf8'),
    fs.readFileSync(archivePilotCard, 'utf8'),
  );
  validateActiveYouTubeOrder(inventory, fs.readFileSync(activeCard, 'utf8'));
  validateMainPlanReplacementState(inventory, fs.readFileSync(mainPlan, 'utf8'));
  validateYouTubeReplacementProtocol(
    inventory,
    fs.readFileSync(youtubeReplacementCard, 'utf8'),
    fs.readFileSync(youtubeReplacementProof, 'utf8'),
  );
  validateHeroQueueEvidence(proofDirectory, fs.readFileSync(coverage, 'utf8'));
  validatePrimaryQueueEvidence(proofDirectory, fs.readFileSync(coverage, 'utf8'));
  const result = validatePlatformInventory(inventory, { expectedInstagramDebts });
  process.stdout.write(
    `Social platform inventory valid: ${result.assets} asset(s), ${result.publicUrls} URL publique(s), ${result.scheduledUrls} lien(s) natif(s) programmé(s), ${result.instagramDebts} dette(s) Instagram réconciliée(s).\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  debtTriageDate,
  parseArchivePriorities,
  parseInventoryRows,
  primaryQueueSlots,
  validateArchivePriorityConsistency,
  validateActiveYouTubeOrder,
  validateMainPlanReplacementState,
  scheduledHeroDates,
  validateHeroQueueEvidence,
  validatePrimaryQueueEvidence,
  validateYouTubeReplacementProtocol,
  validatePlatformInventory,
  validateReplacementCoverage,
};
