# J42 — refonte factuelle du propriétaire EN « flying dreams »

Date de construction : 26 août 2026

Propriété GSC : `sc-domain:noctalia.app`

URL propriétaire : `/en/blog/flying-dreams-meaning`

## Verdict

Le levier J42 est une refonte éditoriale ciblée de l'URL anglaise existante.
La fenêtre postérieure à la modification du 28 juillet est désormais complète :
la page reçoit des impressions, mais les requêtes génériques principales restent
majoritairement en deuxième ou troisième page. Une nouvelle URL créerait un
risque de cannibalisation ; une retouche cosmétique du title ne corrigerait pas
les affirmations non sourcées de la version actuelle.

## Preuves GSC

Fenêtre complète disponible au 24 août 2026 : 28 jours, du 28 juillet au
24 août.

| Clics | Impressions | CTR calculé | Position moyenne |
| ---: | ---: | ---: | ---: |
| 31 | 5 723 | 0,542 % | 11,9 |

Requêtes génériques qui motivent le maintien et le renforcement du propriétaire :

| Requête | Clics | Impressions | Position |
| --- | ---: | ---: | ---: |
| `flying dreams` | 0 | 118 | 21,2 |
| `flying dreams meaning` | 0 | 80 | 23,6 |
| `dreaming of flying` | 0 | 76 | 22,9 |
| `dream of flying` | 0 | 66 | 23,7 |
| `flying dream meaning` | 0 | 44 | 23,5 |
| `dreams about flying` | 0 | 34 | 16,9 |
| `flying dream` | 0 | 30 | 19,8 |
| `dreaming you can fly` | 0 | 23 | 15,1 |
| `why do we dream of flying` | 0 | 9 | 5,1 |

La requête atypique `flying above a town in the desert dream article` apporte
234 impressions à une position de 10,1. Elle est conservée comme preuve de
longue traîne, mais la page n'est pas réécrite autour de cette formulation.

## Vérification scientifique

La réécriture s'appuie sur trois sources primaires :

- Schredl et Piel (2007), deux échantillons allemands représentatifs totalisant
  5 941 personnes : 7,5 % déclarent un rêve de vol dans les derniers mois ;
- Schredl (2011), série individuelle de 6 701 rêves : 115 rêves de vol sans
  assistance, soit 1,72 %, avec une forte variation des caractéristiques et un
  appel explicite à des études de journaux à plus grande échelle ;
- Picard-Deland et al. (2020), expérience VR auprès de 137 personnes : les
  images de vol sans assistance passent de 1,3 % dans la baseline à 7,1 % lors
  de la sieste en laboratoire et 10,6 % la nuit suivante.

Ces études documentent fréquence, variation et incorporation d'une expérience
éveillée. Elles ne démontrent aucune signification symbolique universelle.

## Modification locale J42

Une seule page source est modifiée :
`docs-src/content/blog/blog.flying-dreams-meaning/en.md`.

- Title : `Flying Dreams Meaning: Science and 6 Scenarios | Noctalia`
  (57 caractères).
- Description : réponse directe, six scénarios, émotions et trois études
  (143 caractères).
- H1 : `Flying Dreams Meaning: What Science and Context Can Show`.
- Quick answer : aucune signification fixe ; liberté, fuite, confiance et perte
  de contrôle deviennent des pistes, jamais des diagnostics.
- Tableau de preuves : fréquence en population, série de journal et expérience
  d'incorporation VR, avec limites explicites.
- Six scénarios reformulés autour de questions contextuelles : vol facile,
  difficulté à rester en l'air, hauteur, vol bas, fuite et perte de contrôle.
- Suppression du taux non étayé de 33 %, de l'explication neurologique
  spéculative, des significations universelles et des « 6 proven techniques ».
- Section lucide : conscience du rêve et contrôle sont distingués ; aucun
  résultat n'est garanti.
- FAQ et CTA alignés sur une promesse de journalisation et d'exploration, sans
  interprétation certaine.
- JSON-LD généré depuis le contenu visible : `wordCount` 1 630,
  `timeRequired` `PT8M`, cinq questions FAQ, date de modification au 26 août.

La route, le canonical, le hreflang, l'image principale et le sitemap restent
inchangés.

## Garde-fous

- Aucune nouvelle page.
- Aucun changement des 50 couples Rank Tracker, de leurs emplacements ou tags.
- `scuola` reste une expérience séparée.
- `casa`, `ragno` et `perro` restent gelés jusqu'au 5 septembre.
- Aucun crédit Ahrefs général consommé.
- Aucune demande d'indexation, mutation GSC, action d'autorité externe ou
  changement d'abonnement.

## Validation

- `git diff --check` : vert avant validation complète.
- `npm run docs:build` : vert, 1 256 URL dans le sitemap.
- `npm run docs:check` : vert, 0 erreur et 0 avertissement ; 1 256 routes
  canonical, sitemap et manifeste inchangées.
- `npm run docs:release-check` : garde-fou propre déclenché comme prévu avant
  commit. Le mode `--allow-dirty` ne valide que le `HEAD` commité et est donc
  explicitement exclu des preuves J42 ; les contrôles équivalents sont exécutés
  directement sur l'artefact local J42 ci-dessous.
- `node scripts/check-docs-deploy-surface.js` : vert, 3 870 fichiers autorisés
  et aucun artefact source ou d'audit exposé.
- `node scripts/check-docs-links.js --external` : vert, 0 lien cassé sur 414 URL
  externes ; une erreur réseau transitoire ignorée par le contrôleur.
- `node docs/scripts/check-content-depth.js` : vert, 0 avertissement sur 1 256
  pages indexables.

## Séparation des états

- Observation GSC : terminée en lecture seule.
- Vérification des sources : terminée.
- Modification locale : réalisée dans `docs-src/` uniquement.
- Commit et push : non réalisés.
- Publication : non réalisée.
- Mesure : établir une nouvelle baseline au jour de publication éventuelle,
  contrôler les requêtes génériques à J+7 et comparer sur 28 jours complets à
  J+28. Ne pas mélanger la fenêtre prépublication avec la fenêtre de décision.
