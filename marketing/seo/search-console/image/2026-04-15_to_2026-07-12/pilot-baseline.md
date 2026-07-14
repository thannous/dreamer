# Pilote Image SEO — référence avant publication

Date de capture : 14 juillet 2026
Propriété : `sc-domain:noctalia.app`
Type Search Console : `image`
Période : 15 avril au 12 juillet 2026

## Référence Search Console

- Impressions : 25 044
- Clics : 9
- CTR : 0,036 %
- Position moyenne : 38,66
- Part des 10 pages pilotes : 16 290 impressions, soit 65,05 % du total

| Rang | Page | Impressions |
| ---: | --- | ---: |
| 1 | `/en/blog/lucid-dreaming-beginners-guide` | 3 692 |
| 2 | `/en/blog/dream-journal-guide` | 2 614 |
| 3 | `/en/blog/dream-interpretation-history` | 2 565 |
| 4 | `/en/blog/pregnancy-dreams-meaning` | 1 783 |
| 5 | `/es/blog/suenos-de-agua` | 1 378 |
| 6 | `/en/blog/flying-dreams-meaning` | 1 312 |
| 7 | `/es/blog/guia-diario-suenos` | 850 |
| 8 | `/en/guides/dream-symbols-dictionary` | 813 |
| 9 | `/es/blog/guia-suenos-lucidos-principiantes` | 674 |
| 10 | `/es/blog/suenos-de-volar` | 609 |

Les exports détaillés `pages.csv`, `queries.csv` et `page-query.csv` dans ce dossier constituent la référence avant publication.

## Contrôle Lighthouse mobile

Trois mesures Lighthouse 13.4.0 ont été réalisées par gabarit, sur la même machine et avec le même profil mobile simulé. La référence est le build propre du commit précédent ; le candidat est le build contenant le pilote.

| Gabarit | LCP référence, médiane | LCP candidat, médiane | Évolution | CLS candidat maximal |
| --- | ---: | ---: | ---: | ---: |
| Article | 3 174 ms | 2 552 ms | -19,6 % | 0,0006 |
| Dictionnaire | 6 151 ms | 4 428 ms | -28,0 % | 0,0006 |
| Symbole illustré | 3 751 ms | 2 703 ms | -27,9 % | 0 |

Les trois gabarits respectent le seuil : aucun CLS supérieur à 0,1 et aucune hausse médiane du LCP supérieure à 10 %.

## Calendrier de mesure

- Chaque semaine : exporter `--type image`, exclure les pages déjà couvertes, puis sélectionner le prochain lot de 10 selon impressions, position, intention visuelle et qualité des images existantes.
- Ne publier le lot suivant que si `docs:check`, le contrat Image SEO, le contrôle navigateur mobile/desktop et les seuils Lighthouse restent verts.
- Première comparaison formelle à J+28 : 11 août 2026, dès que les données Search Console couvrant la période sont consolidées.
- Conserver le modèle si les impressions ou les clics progressent et si la position moyenne ne se dégrade pas de plus de 10 %. Sinon, suspendre l’extension, corriger le visuel ou son contexte, puis relancer la mesure.

Le CTR reste directionnel tant que le volume de clics est faible. Ce pilote ne garantit ni gain de classement ni accès à Discover.
