# J44 — alignement du propriétaire IT « incendio / fuoco »

Date d'exécution locale : 28 août 2026

Propriété GSC : `sc-domain:noctalia.app`

URL propriétaire : `/it/simboli/fuoco`

## Plan et verdict

Le levier J44 est un alignement lexical borné du propriétaire italien existant
sur les deux formulations réellement exposées dans GSC : `incendio` et
`fuoco`. La page se classe déjà près du haut de la première page, mais son CTR
reste faible. Une nouvelle route `/it/simboli/incendio` diviserait les signaux
d'un même concept et créerait une cannibalisation inutile.

Le plan exécuté est donc :

1. faire commencer le title par `Sognare un incendio` tout en conservant
   `fuoco` ;
2. aligner le H1, la première description, la première FAQ et la première
   phrase éditoriale ;
3. ne modifier ni route, canonical, hreflang, image, maillage ni autre langue ;
4. valider le site généré puis mesurer après une publication distinctement
   autorisée.

## Preuves GSC fraîches

Export officiel Search Console en lecture seule, fenêtre complète du 30 juillet
au 26 août 2026 :

| Périmètre | Clics | Impressions | CTR | Position moyenne |
| --- | ---: | ---: | ---: | ---: |
| Site | 5 258 | 672 239 | 0,78 % | 7,4 |
| `/it/simboli/fuoco` | 145 | 18 696 | 0,78 % | 4,6 |

Requêtes visibles qui motivent l'alignement :

| Requête | Clics | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `sognare incendio` | 3 | 532 | 0,56 % | 3,5 |
| `sognare un incendio` | 1 | 462 | 0,22 % | 2,8 |
| `sognare fuoco` | 0 | 406 | 0 % | 5,1 |
| `sognare fuoco significato` | 4 | 340 | 1,18 % | 3,6 |
| `sognare il fuoco` | 0 | 346 | 0 % | 4,3 |
| `sognare il fuoco significato` | 1 | 315 | 0,32 % | 3,6 |

Les lignes de requêtes exposées par GSC sont bornées et ne doivent pas être
additionnées au total de page. Elles montrent néanmoins que la page couvre déjà
les deux formulations, sans les présenter dans l'ordre le plus utile dans son
snippet.

## Modification locale J44

Deux catalogues canoniques sont modifiés :

- `data/dream-symbols.json` : nom `Incendio / Fuoco`, title ciblé sur
  `un incendio o il fuoco`, première description, première FAQ et date
  éditoriale au 28 août ;
- `data/dream-symbols-extended.json` : première phrase réordonnée pour répondre
  immédiatement à `incendio` et `fuoco`.

Title attendu :
`Sognare un incendio o il fuoco: significato | Noctalia` (54 caractères).

La route `/it/simboli/fuoco`, le canonical, l'image, les traductions, les
hreflang et les relations internes restent inchangés. Aucune nouvelle page ni
redirection n'est créée.

## Garde-fous et séparation des états

- `scuola` reste une expérience séparée ; `casa`, `ragno` et `perro` restent
  gelés jusqu'au 5 septembre ;
- le changement J43 `mare / oceano` reste local et identifiable séparément ;
  son `modifiedAt` est normalisé au 28 août parce que le garde-fou du catalogue
  impose une date unique aux deux changements encore en attente de commit ;
- les 50 couples Rank Tracker, leurs tags et emplacements sont inchangés ;
- aucun rapport Ahrefs payant, crédit général, crawl, changement d'abonnement
  ou demande d'indexation n'a été déclenché ;
- l'API Ahrefs n'a facturé aucune unité lors du contrôle J44 ; son compteur
  d'unités n'est pas le compteur général Starter ;
- observation GSC : terminée en lecture seule ;
- modification locale : terminée ;
- commit et push : non réalisés ;
- publication et preuve publique : non réalisées ;
- mesure : baseline au jour d'une publication autorisée, contrôle J+7 puis
  comparaison sur 28 jours complets à J+28.

## Validation locale

- le premier `npm run docs:build` a correctement bloqué la date J43 restée au
  27 août dans le catalogue partagé ; après normalisation documentée au 28 août,
  le build final est vert ;
- `npm run docs:check` : vert, `0` erreur et `0` avertissement ;
- contrat d'URL : `1 256` chemins manifest, pages canoniques et entrées sitemap
  inchangés ;
- liens internes : `0` cassé ;
- page générée : title de `54` caractères, meta description de `157`
  caractères, canonical `https://noctalia.app/it/simboli/fuoco`, données
  structurées en italien et date de modification au 28 août ;
- sitemap : `lastmod` au 28 août et hreflang réciproques conservés ;
- profondeur : `1 256` pages indexables, `0` avertissement ;
- surface de déploiement : verte, `3 870` fichiers autorisés et aucun fichier
  source ou d'audit exposé ;
- `origin/master` vérifié après fetch : branche locale à `0` commit devant et
  `0` derrière avant tout commit J43/J44.
