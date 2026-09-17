# J47 - Optimisation locale de l owner EN work dreams

Date: 2026-09-01
Statut: `GO PUBLISH RECU / PREUVE EN ATTENTE`
Owner: `/en/blog/stress-dreams-work`

## Decision

Optimiser l URL existante, sans creer de page concurrente. Le signal GSC est assez fort pour tester un meilleur snippet et une couverture plus precise, mais pas pour promettre un gain avant publication et mesure.

## Baseline GSC finale

Periode: 2026-08-02 -> 2026-08-29, donnees `final`.

- 2 clics, 2 243 impressions, CTR 0,09 %, position 13,5.
- Periode precedente comparable: 4 clics, 1 058 impressions, CTR 0,38 %, position 15,6.
- Requetes visibles: `dreaming about work every night` (31 impressions, position 9,5) et `is dreaming about work a sign of burnout` (28 impressions, position 8,3).
- La source etait stable depuis le 10 juillet 2026: le changement peut etre mesure comme un lot editorial separe apres publication.

## Modification locale

- Nouveau title: `Dreaming About Work Every Night? Stress Dreams | Noctalia` (57 caracteres).
- Nouvelle meta description: 152 caracteres, sans promesse de diagnostic ni de resultat garanti.
- H1, quick answer, sections scientifiques, burnout, aide professionnelle, FAQ et CTA rendus plus factuels.
- Retrait des chiffres ou causalites non verifies, notamment `65 %`, `3,2x` et les affirmations directes sur cortisol ou burnout.
- Alignement exact des FAQ visibles et JSON-LD; dates `dateModified` et visible mises au 1er septembre 2026.
- Deux liens entrants contextuels depuis les guides EN sur les reves recurrents et le journal de reves.
- Aucune nouvelle URL, aucun canonical, hreflang, slug ou suivi Rank Tracker modifie.

## Sources de prudence editoriale

- WHO: burnout comme phenomene professionnel, pas comme diagnostic produit par un reve; trois dimensions de vie eveillee.
- NIMH: stress, sommeil, gene quotidienne et recours a une aide professionnelle en cas de symptomes persistants ou invalidants.
- PubMed: associations de groupe entre stress professionnel, rumination avant le sommeil, contenu des reves et humeur du lendemain.
- AASM: imagery rehearsal therapy parmi les options recommandees pour le trouble cauchemar chez l adulte.

## Preuves separees

| Couche | Etat | Preuve |
| --- | --- | --- |
| GSC | Verifie | Baseline finale ci-dessus, avant modification. |
| Ahrefs | Verifie sans depense | Aucun credit general consomme par ce lot. |
| Git/local | Valide | Quatre sources `docs-src/` modifiees; `git diff --check` passe. |
| Build | Valide | `npm run docs:build` passe; 1 261 URL sitemap. |
| Contrats SEO | Valide | `npm run docs:check`: 0 lien casse, 0 erreur, 0 avertissement; 21 tests cibles passes. |
| Publication | Autorisee | `GO publication J47` recu le 1er septembre; commit, push et CI restent a prouver. |
| HTTP public | Non encore verifie | Ne pas conclure avant la fin de la CI et le controle de la reponse servie. |

## Gate suivant

1. Relecture finale du diff focalise: terminee.
2. Publication J47 autorisee: commit du seul lot, synchronisation prudente avec `origin/master`, push, CI et preuve HTTP publique.
3. Prochaine etape recommandee apres preuve publique: enregistrer la date effective puis mesurer GSC a J+7 et J+28 sur l URL et les deux requetes cibles.
4. Ensuite seulement, garder le diagnostic du backlink DE perdu dans un lot Ahrefs separe, plafonne a 1 credit et soumis a une nouvelle autorisation.
