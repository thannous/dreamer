# Noctalia — J35 : appariement des requêtes exactes ES/IT sur les pages existantes

Date : 18 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

Branche de travail : `master`

## Origine

Une proposition externe listait sept nouvelles URL (ES inondation, ES lobos
que atacan, IT incendio, IT acqua in casa, IT cane che morde, IT bambino
maschio sconosciuto, FR inondation) et trois titles à retoucher
(`/es/blog/suenos-de-agua`, `/es/simbolos/arbol`, `/it/simboli/cane`), au motif
d'un CTR « 5 à 10× trop bas ». Ce document consigne la vérification GSC, la
décision et le lot réellement exécuté.

## Vérification GSC (28 jours, 19 juillet → 15 août, export `seo:gsc:export`)

Les chiffres cités sont exacts. La lecture ne l'est pas : le CTR pondéré du
site par tranche de position montre une courbe écrasée en ES et IT (SERP
« qué significa soñar con… » saturées de modules), et les trois pages sont au
niveau ou au-dessus de cette norme.

| Page | Clics | Impr. | CTR | Pos. | Norme du site à cette position |
|---|---:|---:|---:|---:|---|
| `/es/blog/suenos-de-agua` | 688 | 68 803 | 1,00 % | 5,1 | ES pos 4-5 : 0,33 % ; pos 3-4 : 0,92 % |
| `/es/simbolos/arbol` | 136 | 23 450 | 0,58 % | 6,7 | ES pos 5-7 : 0,44 % |
| `/it/simboli/cane` | 344 | 21 781 | 1,58 % | 4,6 | IT pos 4-5 : 0,90 % |

Courbe CTR pondérée (couples page+requête visibles) : ES `1-2` 2,33 % ·
`2-3` 1,95 % · `3-4` 0,92 % · `4-5` 0,33 % · `5-7` 0,44 % ; IT `2-3` 1,87 % ·
`3-4` 1,05 % · `4-5` 0,90 % · `5-7` 0,55 %.

Les titles visés matchent déjà leur requête dominante : 93 % des impressions de
`suenos-de-agua` sont des requêtes « inundación » (49 650 / 53 259 visibles) et
son title l'annonce ; `cane` titre déjà « cane che morde o attacca » ; `fuoco`
titre déjà « fuoco o incendio in casa ». Aucun title n'est retouché.

### Clusters proposés et pages qui les captent

| Cluster | Clics / impr. / pos. | Page(s) captant | Décision |
|---|---|---|---|
| ES inundación (nouvelle URL) | ~50 k impr. visibles, pos 2-5 | `suenos-de-agua` seul ; fiche `inundacion` 504 impr., pos 17 (référence courte volontaire) | Refus : doublon d'un propriétaire qui gagne ; décision J26 inchangée |
| ES agua sucia / calle / casa / agua limpia | 43 / 9 135 / 4,8 (« agua sucia que corre e inunda » 546 impr., pos 5,7) | `suenos-de-agua` | **Exécuté** : H3 par sous-intention sur l'article existant |
| ES lobos que (te) atacan | 17 / 1 502 / 6,0 | fiche `lobo` (15 k impr.) | Refus d'URL ; **exécuté** : scénario renommé « Lobos que te atacan o te quieren atacar » |
| IT incendio | 16 / 2 626 / 3,5 | fiche `fuoco` (title déjà « incendio ») | Refus (J26 : feu = fiche dédiée, pas de page manquante) |
| IT acqua in casa / casa allagata / acqua che allaga | 10 / 1 974 / 6-9 | blog eau 692 · fiche `acqua` 544 · fiche `casa` 464 (gelée) · guide eau 259 ; fiche `alluvione` **0 impression** | **Exécuté** : propriétaire unique = `alluvione`, voir ci-dessous |
| IT cane che morde | 39 / 2 506 / 3,0 (1,56 %) | fiche `cane` | Refus : la fiche possède déjà l'intention dans son title |
| IT bambino maschio sconosciuto | 4 / 572 / 7,8 | fiche `bambino` | Refus d'URL ; **exécuté** : scénario ajouté |
| FR inondation | 16 / 2 037 / 9,2 | `/fr/blog/reves-eau` | Refus d'URL ; volume 25× inférieur à l'ES, à revoir plus tard |

## Inspection URL Search Console

`/it/simboli/alluvione` : verdict `NEUTRAL`, couverture « Explorée,
actuellement non indexée », robots autorisé, fetch réussi, canonical Google =
canonical déclaré, **dernier crawl 11 mai 2026** (avant l'enrichissement de la
fiche du 14 juillet), seule URL référente connue : le sitemap. Comparaison :
`/it/simboli/acqua` « Envoyée et indexée », crawlée le 16 août.

Cause probable : la fiche est atteinte par le sitemap et par des blocs de
symboles associés, mais aucune page IT indexée et fréquentée ne pointait vers
elle avec une ancre descriptive ; l'article IT sur l'eau (7 634 impr.) liait
`acqua` ×4, `oceano` ×3, `pioggia` ×2, jamais `alluvione`.

## Lot exécuté

1. `blog.water-dreams-meaning/es.md` — la section « Variantes » devient six H3
   égaux aux requêtes : agua sucia ; se inunda mi casa con agua limpia o de
   lluvia ; inundación en la calle ; agua sucia que corre e inunda ; agua de mar
   o el mar se sale ; inundación y escapar. Les H2 ancrées `#simbolismo`,
   `#tipos`, `#estado`, `#interpretaciones` (16,4 k impressions chacune en liens
   de saut, 0 clic) sont renommées avec les termes de requête, ids inchangés ;
   la table des matières et la réponse rapide suivent ; deux FAQ ajoutées
   (calle, agua sucia que corre) dans le visible et le `FAQPage` ;
   `modifiedTime` / `dateModified` / « Actualizado » au 18 août ; `wordCount`
   1 814 → 2 134, `timeRequired` PT10M. URL, canonical, title, description et
   H1 inchangés.
2. `flood.it` — scénario « Un'alluvione che entra in casa » renommé « Acqua in
   casa o casa allagata » et développé ; `it.modifiedAt` = 2026-08-18 pour
   rafraîchir `lastmod`. L'article IT sur l'eau lie désormais la fiche deux
   fois avec des ancres « acqua in casa », « casa allagata ». Le mapping J26
   est amendé : `alluvione` possède « acqua in casa / casa allagata / acqua
   che allaga » ; `acqua` garde l'intention courte « acqua sporca/torbida » ;
   le guide garde eau propre, mer et mouvement ; `casa` n'est pas touchée
   (gel jusqu'au 5 septembre).
3. `wolf.es` — scénario « Lobo atacando » renommé « Lobos que te atacan o te
   quieren atacar » et développé ; `es.modifiedAt` = 2026-08-18.
4. `child.it` — scénario « Un bambino maschio sconosciuto » ajouté ;
   `it.modifiedAt` = 2026-08-18.

Aucune nouvelle URL, aucun changement de title, canonical ou contrat URL ;
aucun crédit Ahrefs, changement Rank Tracker ni demande d'indexation.

## Mesure

Fenêtre de lecture : 28 jours complets après déploiement public vérifié, soit
à partir du 16 septembre 2026, sur quatre couples page+requête :
`suenos-de-agua` × sous-clusters agua sucia / casa / calle ; `alluvione` ×
acqua in casa / casa allagata (indexation d'abord, puis impressions) ;
`lobo` × lobos que te atacan ; `bambino` × bambino maschio sconosciuto.
