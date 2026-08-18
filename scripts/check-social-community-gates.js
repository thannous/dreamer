#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COMMUNITY_DIR = path.join(
  ROOT,
  'doc_web_interne/docs/noctalia-social/community-manager/organic-expansion-2026-08-12-2026-09-10',
);

function validateCommunityGates(mandate, program, register) {
  const required = [
    [mandate, /Reddit reste hors mandat opérationnel tant qu'un compte Noctalia\s+dédié n'a pas été créé/iu, 'mandat Reddit dédié absent'],
    [mandate, /compte\s+Reddit personnel existant ne doit pas être utilisé, renommé ou modifié/iu, 'protection du compte personnel absente'],
    [program, /au moins trois\s+contributions DreamViews publiques et utiles/iu, 'seuil DreamViews 3 contributions absent'],
    [program, /au moins deux ont reçu une réponse organique/iu, 'seuil DreamViews 2 réponses absent'],
    [program, /au moins \*\*14 jours\*\* d'ancienneté et \*\*10 contributions textuelles utiles\*\*/iu, 'seuil Reddit 14 jours et 10 contributions absent'],
    [program, /Le compte personnel `u\/Emergency_Gap_1440` reste hors périmètre/iu, 'compte personnel Reddit non exclu'],
  ];
  for (const [content, pattern, message] of required) {
    if (!pattern.test(content)) throw new Error(message);
  }

  const contributions = register.match(/Contributions publiques utiles \| 3 \| \*\*(\d+)\/3\*\*/u);
  const replies = register.match(/Contributions ayant reçu une réponse organique \| 2 \| \*\*(\d+)\/2\*\*/u);
  if (!contributions) throw new Error('progression DreamViews contributions absente');
  if (!replies) throw new Error('progression DreamViews réponses absente');
  const contributionCount = Number(contributions[1]);
  const replyCount = Number(replies[1]);
  if (contributionCount > 3 || replyCount > 2) {
    throw new Error('progression DreamViews supérieure au seuil documenté');
  }
  const dreamViewsReady = contributionCount === 3 && replyCount === 2;

  const accountState = register.match(/Compte Noctalia dédié, inscrit au mandat \| obligatoire \| \*\*([^*]+)\*\*/u)?.[1];
  if (!accountState) throw new Error('état du compte Reddit dédié absent');
  const redditOpen = /REDDIT OUVERT/iu.test(register);
  if (redditOpen && (!dreamViewsReady || accountState === 'ABSENT')) {
    throw new Error('Reddit ne peut pas être ouvert avant maturation DreamViews et compte dédié inscrit.');
  }
  if (!dreamViewsReady && !/REDDIT GELÉ/iu.test(register)) {
    throw new Error('Reddit doit rester gelé avant 3 contributions DreamViews et 2 réponses organiques.');
  }
  if (accountState === 'ABSENT') {
    for (const [pattern, message] of [
      [/Ancienneté \| 14 jours minimum \| \*\*NON DÉMARRÉ\*\*/u, 'maturation Reddit non marquée non démarrée'],
      [/Contributions textuelles utiles sans lien \| 10 minimum \| \*\*0\/10\*\*/u, 'contributions Reddit non nulles malgré compte absent'],
      [/Communautés pertinentes \| 2 minimum \| \*\*0\/2\*\*/u, 'communautés Reddit non nulles malgré compte absent'],
      [/Échanges organiques \| 3 minimum \| \*\*0\/3\*\*/u, 'échanges Reddit non nuls malgré compte absent'],
    ]) {
      if (!pattern.test(register)) throw new Error(message);
    }
  }
  return { contributions: contributionCount, replies: replyCount, accountState };
}

function main(argv = process.argv.slice(2)) {
  const mandatePath = path.resolve(argv[0] || path.join(
    ROOT,
    'doc_web_interne/docs/noctalia-social/community-manager/ACCOUNTS-AND-MANDATE.md',
  ));
  const programPath = path.resolve(argv[1] || path.join(COMMUNITY_DIR, '03-REDDIT-DREAMVIEWS-PROGRAM.md'));
  const registerPath = path.resolve(argv[2] || path.join(COMMUNITY_DIR, '48-COMMUNITY-MATURITY-REGISTER.md'));
  const result = validateCommunityGates(
    fs.readFileSync(mandatePath, 'utf8'),
    fs.readFileSync(programPath, 'utf8'),
    fs.readFileSync(registerPath, 'utf8'),
  );
  process.stdout.write(`Social community gates valid: DreamViews ${result.contributions}/3, réponses ${result.replies}/2, compte Reddit ${result.accountState}.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateCommunityGates };
