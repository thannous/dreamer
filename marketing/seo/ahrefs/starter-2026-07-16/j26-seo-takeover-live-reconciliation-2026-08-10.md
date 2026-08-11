# Noctalia — reprise SEO et réconciliation live J26

Date : 10 août 2026
Projet Ahrefs : `9361004`
Propriété GSC : `sc-domain:noctalia.app`
Relevé : 10 août 2026, 01:09–01:12 UTC
Mode : lecture seule des comptes et documentation locale ; zéro crédit général Ahrefs, zéro nouveau crawl, zéro demande d'indexation et zéro mutation de compte

> **Actualisation du même jour.** Ce document conserve le snapshot initial de 01:09–01:12 UTC. À 16:12 CEST, le crawl planifié s'est achevé ; GSC a ensuite finalisé le 8 août et les Lots Ahrefs A à D ont été exécutés avec autorisation. Les valeurs courantes et décisions qui remplacent ce snapshot pour la suite sont dans [`j26-starter-execution-2026-08-10.md`](./j26-starter-execution-2026-08-10.md).

## Résumé exécutif

La reprise J26 confirme un site en forte progression sur les deux fenêtres GSC complètes, un Rank Tracker intact à 50/50 et un Site Audit sans erreur technique. Elle fait aussi apparaître deux points de surveillance qui ne doivent pas être masqués par les agrégats : une baisse récente sur `traumsymbole a bis z` et 254 URL classées `Explorée, actuellement non indexée` dans GSC.

Depuis la fusion J25, douze commits ont rejoint `master`. Onze portent principalement sur la qualification, l'exécution et la mesure du sprint backlinks. Le commit `366c883b055bb013e180e135d5deed6031737f98` a modifié les sources publiques des pages comparatives et presse ainsi que leur CSV. La version datée du 9 août est confirmée en production ; elle constitue un nouveau facteur confondant pour les pages comparatives et leur linkabilité.

`scuola` reste une expérience séparée non publiée. Les variantes metadata de `casa`, `ragno` et `perro`, publiées le 8 août, ne sont pas mesurables dans le lot GSC courant, dont le dernier jour complet est le 7 août.

## Chronologie depuis J25

- `36216ecf4b388949c40af60625d68bb109ab8dfe` : fusion de l'archive J1–J25.
- Douze commits ultérieurs jusqu'à `7e0dc2f5e37c4bdd669386ea151889cc85ad5223`, pour 33 fichiers modifiés ou ajoutés.
- `366c883b055bb013e180e135d5deed6031737f98` : dataset comparatif enrichi, citations datées du 9 août et pages alternatives/presse localisées mises à jour ; version anglaise vérifiée en production.
- 10 août, 00:40–00:41 CEST : une relance D3A transmise dans chacun des fils KapanLagi, Penzu et AllThingsAI. Les contrôles versionnés à 00:52, 01:11 et 02:37 ne relevaient ni réponse, ni échec, ni publication.
- 10 août, 02:33 CEST : Ahrefs est passé à DR 0,1 et 406 domaines référents. Cette variation d'index n'est attribuable ni aux relances, ni au déploiement, ni à une page précise. Cinq des huit domaines suivis par Ahrefs sont étiquetés `SPAM` ; le vérificateur public reste inchangé à 6 pages suivies, 4 nofollow, 2 sans lien, 3 non indexables, 3 HTTP 403 et 1 HTTP 410.

## Ahrefs live

### Abonnement et limites

| Indicateur | Valeur live |
|---|---:|
| Plan | Starter, facturé mensuellement |
| Prochaine facturation | 16 août 2026 UTC |
| Remise à zéro | 16 août 2026 à 00:00 UTC |
| Crédits généraux utilisés | 63 |
| Projets vérifiés | 4 |
| Projets non vérifiés | 1/1 |
| Rank Tracker | 50/50 |
| Crédits Site Audit du workspace | 1 647/10 000 |

Le connecteur Ahrefs expose séparément `Trial, billed monthly`, zéro unité API utilisée et zéro unité disponible au niveau workspace. Il ne remplace pas le compteur général de l'interface.

### Site Audit Noctalia

Le dernier crawl reste celui du 3 août, affiché de 15:00 à 16:01 dans l'interface :

- Health Score : 100 ;
- 1 596 URL crawlées, dont 1 175 pages facturées ;
- 1 180 URL internes et 414 ressources dans la distribution de l'overview ;
- 0 erreur, 44 avertissements et 1 314 notices ;
- les 44 avertissements techniques visibles se répartissent en 25 titles trop longs, 13 meta descriptions trop courtes, 3 meta descriptions trop longues et 3 redirections 3XX.

La valeur `1 647/10 000` appartient au workspace. Elle ne doit pas être présentée comme le coût du seul crawl Noctalia, dont le journal indique 1 175 pages facturées. Aucun nouveau crawl n'a été lancé.

### Rank Tracker au 10 août

Les 50 couples, emplacements et tags sont inchangés. Le relevé affiché le 10 août, mis à jour environ 18 heures auparavant, donne :

| Appareil | SOV | Position moyenne | Trafic estimé | Top 1–3 | 4–10 | 11–20 | 21–50 | Non classés |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Desktop | 3,2 % | 7,6 | 625 | 15 | 16 | 7 | 4 | 8 |
| Mobile | 3,4 % | 7,3 | 668 | 17 | 13 | 9 | 3 | 8 |

## GSC frais

Dernier jour complet : 7 août 2026. L'interface indiquait une mise à jour six heures auparavant. Les données ont été extraites avec le script versionné `seo:gsc:export`, en lecture seule, vers une archive temporaire hors Git.

### Site entier, fenêtres complètes de 28 jours

| Fenêtre | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 11 juillet–7 août | 4 271 | 481 573 | 0,887 % | 7,32 |
| 13 juin–10 juillet | 2 369 | 307 209 | 0,771 % | 8,52 |

Le lot courant progresse de 1 902 clics et 174 364 impressions. La position moyenne s'améliore d'environ 1,20. Ce signal agrégé est réel mais ne prouve pas l'effet d'une action isolée.

### Shortlist 5+3

| Fenêtre | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 11 juillet–7 août | 328 | 46 117 | 0,711 % | 6,15 |
| 13 juin–10 juillet | 91 | 21 461 | 0,424 % | 7,30 |

La shortlist progresse sans justifier une nouvelle édition globale. `scuola` passe de 3 clics, 1 825 impressions, 0,164 % de CTR et position 6,46 à 7 clics, 1 906 impressions, 0,367 % et position 6,08. Cette progression est entièrement antérieure à toute expérience `scuola` et reste une baseline naturelle.

### Baseline metadata du 8 août

Le lot GSC se terminant le 7 août, les chiffres suivants sont des baselines pré-traitement :

| Page | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| `/it/simboli/casa` | 39 | 5 482 | 0,711 % | 7,50 |
| `/it/simboli/ragno` | 64 | 8 121 | 0,788 % | 6,76 |
| `/es/simbolos/perro` | 42 | 10 604 | 0,396 % | 8,14 |

La première lecture J+7 reste fixée au 15 août. Aucun résultat actuel ne doit être attribué aux metadata publiées le 8 août.

### Trois dérives d'URL Rank Tracker

- `50 sueños y su significado` : GSC attribue 6 clics, 151 impressions et une position moyenne 2,97 à la cible `/es/guides/diccionario-simbolos-suenos`. La homepage vue dans un relevé Rank Tracker ressemble à une dérive ponctuelle ; la cible ne doit pas être changée.
- `traumlexikon` : la cible `/de/guides/traumsymbole-lexikon` domine avec 67 impressions à la position 14,21. `/de/traumlexikon-app` reçoit 13 impressions et la homepage une seule. Il existe une dispersion secondaire, pas une preuve que la cible configurée est mauvaise.
- `sognare acqua sporca` : `/it/simboli/acqua` reçoit 363 impressions à la position 6,18, devant la cible `/it/guides/simboli-sogni-acqua` avec 178 impressions, 1 clic et position 5,53. Cette requête présente une vraie répartition multi-URL à analyser, sans modifier le suivi avant preuve supplémentaire.

### Alerte `traumsymbole a bis z`

GSC compare le 30 juillet–5 août au 23–29 juillet :

- clics : 14 contre 70 ;
- impressions : 70 contre 245 ;
- CTR : 20 % contre 28,6 % ;
- position moyenne : 3,4 contre 1,4 ;
- l'URL reste `/de/guides/traumsymbole-lexikon`.

La baisse est presque entièrement mobile : 13 clics contre 65, soit `-52`, auxquels s'ajoutent 2 clics perdus sur tablette et ordinateur. Elle est également concentrée sur l'Allemagne, 12 clics contre 52, et l'Autriche, 0 contre 10. Ce profil localisé renforce la priorité d'une vérification SERP mobile DE/AT avant toute modification de page.

Sur les fenêtres complètes de 28 jours, la requête reste toutefois en hausse : 180 clics contre 120 et 673 impressions contre 581. Il s'agit donc d'une régression courte à surveiller, pas encore d'une perte structurelle démontrée.

Après autorisation explicite, le micro-lot Rank Tracker a comparé les SERP mobile Allemagne du 2 et du 9 août. Noctalia reste n°1 aux deux dates avec le même title et la même cible `/de/guides/traumsymbole-lexikon`. `traum-deutung.de` reste n°2. Ahrefs affiche une similarité SERP de 84 et neuf changements dans le Top 10, mais ces mouvements concernent les résultats inférieurs, pas les deux premières positions. Le compteur général est resté à `63 → 63`, soit zéro crédit consommé.

La preuve disponible ne justifie donc ni édition, ni changement de cible, ni ajout d'un emplacement Autriche. Le recul GSC peut refléter une volatilité intrasemaine, une baisse temporaire de demande ou des mouvements entre les snapshots hebdomadaires ; il doit être relu avec le prochain jour GSC complet.

## Indexation GSC

Rapport mis à jour le 7 août :

- 990 pages indexées ;
- 275 non indexées ;
- 254 `Explorée, actuellement non indexée`, validation en échec ;
- 12 pages avec redirection ;
- 4 erreurs liées à des redirections ;
- 3 URL 404 ;
- 2 `Détectée, actuellement non indexée` ;
- 0 URL exclue par `noindex`.

Les exemples récents de la catégorie principale mélangent fiches de symboles et articles éditoriaux. Ils doivent être segmentés par valeur et type de contenu avant toute recommandation. Aucune demande d'indexation n'a été envoyée.

## Décision J26 et backlog

1. Ne modifier aucun des 50 suivis.
2. Maintenir `scuola` séparée et non publiée ; sa baseline naturelle s'améliore déjà.
3. Maintenir le gel `casa`–`ragno`–`perro` et attendre le premier jour GSC complet couvrant réellement le traitement.
4. Surveiller la baisse courte de `traumsymbole a bis z` sans édition : les snapshots mobile Allemagne du 2 et du 9 août conservent Noctalia n°1.
5. Segmenter les 254 URL explorées non indexées entre pages attendues, contenu faible/dupliqué et vraies opportunités ; ne pas demander d'indexation en masse.
6. Ne pas rouvrir les quarante rapports concurrents historiques. Un rapport Ahrefs à crédits ne sera proposé que si GSC et Rank Tracker laissent une question décisionnelle précise.
7. Préparer à J27 la recommandation d'abonnement, en séparant la valeur du Rank Tracker et de la continuité de mesure de l'usage très faible des crédits généraux.
8. Continuer à mesurer les relances, publications, backlinks publics, index Ahrefs et résultats GSC comme des états séparés.

## Frontières d'autorisation

Ce relevé n'autorise ni achat, add-on, renouvellement, annulation, demande d'indexation, nouveau crawl, modification des suivis, envoi externe, publication, commit ou push. Toute utilisation d'un rapport Ahrefs susceptible de consommer des crédits généraux doit annoncer le rapport exact, la question et le plafond avant exécution.
