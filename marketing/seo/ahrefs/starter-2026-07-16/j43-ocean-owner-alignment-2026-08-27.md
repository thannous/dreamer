# J43 — alignement du propriétaire IT « mare / oceano »

Date d'exécution locale : 27 août 2026

Propriété GSC : `sc-domain:noctalia.app`

URL propriétaire : `/it/simboli/oceano`

## Verdict

Le levier J43 est un alignement limité du propriétaire italien existant sur
l'intention majoritaire `mare`. L'URL, le canonical et les hreflang sont
conservés : créer une route `/it/simboli/mare` diviserait les signaux d'un même
concept et introduirait une seconde page concurrente.

## Preuves GSC

Fenêtre complète disponible au 25 août 2026 : 28 jours, du 29 juillet au
25 août.

| Clics | Impressions | CTR | Position moyenne |
| ---: | ---: | ---: | ---: |
| 11 | 5 371 | 0,2 % | 8,0 |

Requêtes visibles qui justifient l'alignement lexical :

| Requête | Clics | Impressions | Position |
| --- | ---: | ---: | ---: |
| `sognare il mare significato` | 0 | 289 | 7,3 |
| `sognare il mare` | 1 | 186 | 8,7 |
| `sognare mare agitato` | 0 | 98 | 8,2 |
| `sognare il mare agitato` | 0 | 40 | 8,5 |
| `sognare mare calmo` | 0 | 38 | 14,5 |

La page était stable depuis juillet. Son nom et son title donnaient la priorité
à `oceano`, alors que les requêtes visibles donnent la priorité à `mare`.

## Modification locale J43

Deux catalogues canoniques sont modifiés :

- `data/dream-symbols.json` : `Mare / Oceano`, title ciblé sur le mare calme,
  agitato ou avec des vagues hautes, première description et première FAQ
  réordonnées. Le `modifiedAt` local est normalisé au 28 août par le catalogue
  partagé avec J44 avant toute publication ;
- `data/dream-symbols-extended.json` : première phrase et quatre scénarios
  réordonnés pour utiliser `mare` avant `oceano`.

Title généré :
`Sognare il mare calmo o agitato: significato | Noctalia` (55 caractères).

La route `/it/simboli/oceano`, le canonical, l'image, les cinq traductions,
les hreflang et les relations internes restent inchangés. Aucune nouvelle page
ni redirection n'est créée.

## Validation locale

- `npm run docs:build` : vert ;
- `npm run docs:check` : vert, `0` erreur, `0` avertissement ;
- contrat d'URL : `1 256` chemins manifest, pages canoniques et entrées sitemap
  inchangés ;
- liens internes : `0` cassé ; liens externes : `0` cassé, une erreur réseau
  transitoire ignorée par le contrôleur ;
- profondeur : `1 256` pages indexables, `0` avertissement ;
- surface de déploiement : verte, aucun fichier source ou d'audit exposé ;
- page générée : title de 55 caractères avec la marque, canonical
  `https://noctalia.app/it/simboli/oceano`, `article:modified_time` et sitemap
  `lastmod` au 28 août dans le lot local partagé, hreflang réciproques
  conservés.

## Garde-fous et séparation des états

- `scuola` reste une expérience séparée ; `casa`, `ragno` et `perro` restent
  gelés jusqu'au 5 septembre ;
- les 50 couples Rank Tracker, leurs tags et emplacements sont inchangés ;
- aucun crédit Ahrefs général, crawl, changement d'abonnement ou demande
  d'indexation n'a été déclenché ;
- modification locale : terminée et validée ;
- commit et push : non réalisés ;
- publication et preuve publique : non réalisées ;
- mesure : baseline le jour d'une publication autorisée, contrôle J+7 puis
  décision sur 28 jours complets.

Le compteur général Ahrefs n'a pas été revalidé : la session web a été fermée
car le compte était utilisé sur un autre appareil. L'API confirme seulement la
prochaine remise à zéro au 16 septembre 2026 UTC ; son compteur d'unités API ne
constitue pas le compteur général Starter.
