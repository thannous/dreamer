# Search Console Noctalia - plan SEO hebdomadaire

Generation: 2026-07-14T18:09:23.436Z
Propriete: `sc-domain:noctalia.app`
Periode: 2026-04-15 -> 2026-07-12
Type de recherche: `image`

## Synthese

- Clics: 9
- Impressions: 25 044
- CTR moyen: 0.04%
- Position moyenne: 38,7

Les fichiers CSV source sont dans `marketing/seo/search-console/image/2026-04-15_to_2026-07-12`. Les lignes `sourceFile` pointent vers `docs-src` quand l'URL Search Console correspond au manifeste local.

## Actions prioritaires

1. **Ameliorer les pages a fortes impressions et CTR faible.** Recrire title/meta description, clarifier l'intention de recherche dans l'intro, ajouter FAQ/schema si pertinent.
2. **Renforcer les requetes en positions 4-20.** Ajouter des sections qui repondent explicitement aux requetes, puis mailler depuis les pages proches.
3. **Rafraichir les pages en positions 10-30.** Completer le contenu, ajouter exemples, sources et liens internes depuis les hubs.
4. **Suivre chaque semaine les deltas.** Comparer le rapport courant avec le precedent et ne modifier qu'un lot de pages a la fois.

## Requetes a fort potentiel

_Aucune ligne dans cette categorie pour cette periode._

## Pages a CTR faible

| Page |Source |Impr. |CTR |Pos. |
| --- |--- |--- |--- |--- |
| https://noctalia.app/es/simbolos/puente |data/dream-symbols.json |254 |0.00% |12,9 |
| https://noctalia.app/fr/blog/reves-eau |docs-src/content/blog/blog.water-dreams-meaning/fr.md |246 |0.00% |18,1 |
| https://noctalia.app/it/simboli/cane |data/dream-symbols.json |200 |0.00% |12,3 |
| https://noctalia.app/it/simboli/fuoco |data/dream-symbols.json |148 |0.68% |12,8 |

## Pages a rafraichir

| Page |Source |Impr. |CTR |Pos. |
| --- |--- |--- |--- |--- |
| https://noctalia.app/es/blog/suenos-de-agua |docs-src/content/blog/blog.water-dreams-meaning/es.md |1 378 |0.00% |28,1 |
| https://noctalia.app/es/blog/historia-interpretacion-suenos |docs-src/content/blog/blog.dream-interpretation-history/es.md |368 |0.27% |28,9 |
| https://noctalia.app/es/blog/suenos-ser-perseguido |docs-src/content/blog/blog.being-chased-dreams/es.md |358 |0.00% |22,5 |
| https://noctalia.app/es/simbolos/puente |data/dream-symbols.json |254 |0.00% |12,9 |
| https://noctalia.app/fr/blog/reves-eau |docs-src/content/blog/blog.water-dreams-meaning/fr.md |246 |0.00% |18,1 |
| https://noctalia.app/es/simbolos/puerta |data/dream-symbols.json |239 |0.00% |21,1 |
| https://noctalia.app/it/simboli/cane |data/dream-symbols.json |200 |0.00% |12,3 |
| https://noctalia.app/es/blog/como-recordar-suenos |docs-src/content/blog/blog.how-to-remember-dreams/es.md |194 |0.00% |27,9 |
| https://noctalia.app/en/symbols/dog |data/dream-symbols.json |191 |0.00% |20,1 |
| https://noctalia.app/it/simboli/fuoco |data/dream-symbols.json |148 |0.68% |12,8 |
| https://noctalia.app/fr/blog/reves-de-voler |docs-src/content/blog/blog.flying-dreams-meaning/fr.md |101 |1.98% |21,1 |
| https://noctalia.app/es/blog/suenos-de-muerte |docs-src/content/blog/blog.death-dreams-meaning/es.md |101 |0.00% |27,5 |

## Couples page + requete a traiter

| Requete |Page |Source |Impr. |Pos. |
| --- |--- |--- |--- |--- |
| dream interpretation concept |https://noctalia.app/en/blog/dream-interpretation-history |docs-src/content/blog/blog.dream-interpretation-history/en.md |65 |10,7 |

## Rituel de travail

- Lundi: lancer l'export, choisir 3 a 5 pages dans les sections ci-dessus.
- Mardi/mercredi: modifier les contenus `docs-src`, titles, descriptions, FAQ et liens internes.
- Jeudi: lancer `npm run docs:release-check`.
- Vendredi: publier, puis annoter les changements dans ce rapport ou dans un changelog SEO.
- Semaine suivante: comparer impressions, CTR et position moyenne avant de refaire le meme type de changements.

## Rappel methodologique

- Une position 4-20 avec beaucoup d'impressions est souvent le meilleur levier court terme.
- Une page avec impressions fortes et CTR faible doit d'abord travailler son extrait SERP.
- Les donnees Search Console peuvent etre retardees de quelques jours et bornees par Google; garder les comparaisons sur des periodes coherentes.
