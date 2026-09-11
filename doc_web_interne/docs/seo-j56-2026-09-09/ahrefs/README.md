# Ahrefs Noctalia — J56, 9 septembre 2026

Lecture authentifiée du projet **9361004**, achevée vers 09:56 UTC. Données API brutes sauvegardées à côté. Les résultats web ci-dessous sont des transcriptions des états accessibles de l'interface Ahrefs consultés pendant ce lot ; aucune capture brute complète du navigateur n'est archivée.

## Résultat et budget vérifiés

- [Limits & usage web](https://app.ahrefs.com/account/limits-and-usage/web) : **33 crédits utilisateur avant, 33 après** les lectures. Aucun crédit général supplémentaire observé. Starter, facturation mensuelle ; prochaine facturation le 16 septembre 2026, reset le 16 à 00:00 UTC. Crawl credits 2 737/10 000 ; Rank Tracker **50/50**.
- API Limits : « Trial, billed monthly », unités workspace 0/0, usage clé 0. Chaque réponse exécutée porte un coût effectif de zéro unité. Le libellé API ne décrit pas l'abonnement web et les unités API ne sont pas les crédits généraux.
- Les 50 couples mot-clé/localisation et leurs tags ont été récupérés par `management-project-keywords`, sans mutation. Répartition : US9, IT10, MX8, ES5, DE9, FR9. Pas d'ajout/suppression, pas de changement de suivi, abonnement ou facturation ; aucun crawl lancé.

## Site Audit

[Historique](https://app.ahrefs.com/site-audit/9361004/project-history) : dernier crawl **7 septembre, Completed**, durée 1h14 ; le suivant antérieur est le 31 août. Planification affichée : lundi 15:00–15:59 GMT+02, soit prochain créneau attendu le 14 septembre. Cette date est une déduction de la règle, pas une exécution confirmée.

[Audit du 7 septembre](https://app.ahrefs.com/site-audit/9361004/overview?current=07-09-2026T161532P0200) : **HS100**, 1 709 URL crawled, dont 1 267 internes et 442 ressources ; **1 erreur, 42 avertissements, 212 notices**. Même crawl et mêmes compteurs que J52, donc aucun nouveau résultat de crawl J56. La table bulk inclut 1 712 URL internes avec non-200 et ressources : ne pas mélanger ce périmètre avec les 1 267 internes de la distribution principale.

Zéro lien vers 4xx, zéro référence d'image sans alt et zéro lien bloqué robots dans les tableaux de cet audit. Ce constat Ahrefs ne prouve ni les accès Googlebot ni l'indexation Google.

[All issues](https://app.ahrefs.com/site-audit/9361004/issues?current=07-09-2026T161532P0200) : 24 catégories actives, zéro nouvelle catégorie. Sélection utile à J56 :

| Problème | Nombre d'URL affiché |
|---|---:|
| Page and SERP titles do not match | 127 |
| Title too long | 18 |
| Meta description too short | 13 |
| Meta description too long | 2 |
| Meta description tag missing or empty | 1 |
| H1 tag missing or empty | 1 |
| Page has no outgoing links | 1 |
| Low word count | 1 |
| Indexable page not in sitemap | 1 |
| X-default hreflang annotation missing | 2 |
| Slow server response for AI crawlers | 2 |
| Changed pages not submitted to IndexNow | 34 |
| Organic traffic dropped | 16 |
| Pages dropped from Top 10 | 2 |

L'API `site-audit-projects` renvoie encore `healthscores: []` alors que le site web affiche le projet et ses résultats. L'interface constitue ici la preuve. L'identité des URL individuelles n'a pas été rouverte : l'attribution J52 de plusieurs alertes à dream.noctalia.app reste une information historique, pas une revérification J56.

## Rank Tracker

[Vue consultée](https://app.ahrefs.com/rank-tracker/overview/9361004) : **desktop, toutes localisations, 9 septembre contre 9 août, volumes mensuels**. 50 lignes ; chacune affiche une mise à jour « 3 d ago ». Le relevé du jour ne constitue donc pas une observation SERP du 9 septembre.

| Indicateur | Affichage actuel | Écart affiché vs 9 août |
|---|---:|---:|
| Share of Voice | 1,8 % | −1,5 point |
| Trafic estimé mensuel du suivi | 335 | −272 |
| Positions 1–3 | 15 | — |
| Positions 4–10 | 5 | −11 |
| Positions 11–20 | 1 | −5 |
| Positions 21–50 | 2 | −2 |
| Positions 51+ | 0 | — |
| No rank | 27 | +18 |

**Incident Ahrefs toujours affiché et ouvert pour lecture** : « Google keyword ranking data disruption ». Ahrefs signale que les changements introduits par Google peuvent perturber temporairement ses données ; une part significative a été corrigée, le travail continue. Les pertes de positions ne permettent pas de conclure à une dégradation réelle du SEO, ni d'attribuer un effet à une expérience.

Signaux ciblés :

- `soñar con hospital` Espagne : position 1 affichée ; Mexique : transition 5→1 affichée. `que significa soñar con un hospital` Mexique : position1. Propriétaire principal affiché `/es/simbolos/hospital`. Pas une preuve que le patch en préparation améliore quoi que ce soit.
- `dreaming about work` US et `history of dream analysis` US : **Lost**, ancienne position23 dans la comparaison ; `flying dream meaning` US : Lost, ancienne21. Ce sont des signaux à rapprocher de GSC, pas des verdicts.
- `sognare ragni` IT : Lost, ancienne11 ; `soñar con perros que atacan a otra persona` MX : Lost, ancienne17. Maintenir les gels décidés, aucune retouche sur cette seule alerte.
- `rêver d'une maison inconnue` FR : position1 ; cela concerne la page FR maison, **pas casa IT**. Casa n'est pas suivie par un mot-clé dédié dans les 50 paires.
- Aucun suivi exact dédié arbol/pidocchi/false-awakening dans cette liste ; leurs premiers résultats doivent être lus dans GSC. Aucun couple ajouté pour combler ce manque.

## Ce que cela change au J56

1. Hospital reste une préparation metadata bornée, décidée avec GSC ; Rank Tracker n'apporte aucun motif de réécriture plus large.
2. Rentrée exige les inspections GSC et traces Googlebot/Cloudflare ; HS100 n'explique pas la non-indexation.
3. Casa doit garder une baseline GSC avant le8août et des cohortes stables ; aucune preuve Ahrefs dédiée ne remplace ce diagnostic.
4. Histoire EN reste une révision d'affirmations et de sources. Son statut Lost n'établit pas un besoin de nouveaux contenus.
5. Les nouveaux sujets pain/œufs/tiques conservent les mesures et gates J52, datés7septembre : aucun rapport Keywords Explorer ou Site Explorer n'a été ouvert pour les rafraîchir et aucune dépense nouvelle n'a été engagée. Ne pas présenter leurs volumes/KD/TP comme revérifiés J56.

Référence historique : [plan J52 récupéré](../../seo-recovery-2026-09-09/j52-plan-editorial-2026-09-07.md). J56 est un relevé de continuité ; l'audit inchangé et l'incident de données empêchent d'en faire une validation de gains SEO.
