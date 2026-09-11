# J56 — GSC finalisé et diagnostic casa

Relevé : 9 septembre 2026, environ 09:48–09:52 UTC. Propriété `sc-domain:noctalia.app`, recherche `web`. Lecture seule ; aucune publication, demande d’indexation ou dépense Ahrefs.

## Décisions

- **Reporter le verdict J+7 des quatre propriétaires** : la dernière journée finalisée est le **6 septembre**, et `metadata.firstIncompleteDate` vaut **2026-09-07**. Arbol/pidocchi disposent de 4 journées complètes après publication, travail EN/false-awakening de 5.
- **Conserver casa sans nouvelle modification**. Le CTR diminue aussi sur les mêmes requêtes/pays/appareils, mais ce sous-ensemble contient seulement 9 puis 7 clics, couvre environ un cinquième des impressions de la page et ne permet pas d’attribuer la baisse au title. L’expansion des requêtes eau/inondation est visible et doit rester distinguée du sujet maison inconnue.
- Prochain contrôle informatif : données finalisées jusqu’au **8 septembre** pour travail/false-awakening et jusqu’au **9 septembre** pour arbol/pidocchi. La date calendaire du checkpoint ne remplace pas la disponibilité GSC. Aucun nouveau test krokodil déclenché par ces données.

## Fraîcheur et protocole

Les exports non filtrés `daily-final.json` et `daily-all.json` interrogent les 25 août–9 septembre avec la dimension `date`. Les lignes finalisées vont jusqu’au 6 septembre inclus ; les 7–8 septembre présents dans `all` sont incomplets et exclus des comparaisons. Le fuseau des dates Search Console est America/Los_Angeles, pas Europe/Paris. [Contrat officiel Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Chaque JSON conserve l’heure du relevé, la requête sans authentification, les réponses API et les lignes retournées ; chaque CSV est son équivalent tabulaire. Aucun credential n’est écrit. `refresh.cjs` réutilise en mémoire le helper d’authentification du script canonique et son en-tête de quota ; il conserve les résultats existants pour éviter d’écraser ce relevé. Pour une autre journée, utiliser un nouveau dossier et une nouvelle date de borne. `analyze.py` reconstruit les cohortes et agrégats dérivés.

## Site — deux fenêtres de 28 jours

| Fenêtre | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 13 juillet–9 août | 4 273 | 491 150 | 0,870 % | 7,32 |
| 10 août–6 septembre | 6 885 | 822 858 | 0,837 % | 7,09 |

Clics **+61,1 %**, impressions **+67,5 %**. Il s’agit du site entier, sans attribution aux expériences de septembre. Ces fenêtres sont distinctes de la baseline casa.

## Expériences de septembre — signaux partiels

Le jour de publication déclaré est exclu ; la fenêtre avant est décalée d’exactement sept jours et a la même durée et les mêmes jours de semaine. Toutes les valeurs viennent des agrégats de page, jamais de la somme des requêtes visibles.

| Propriétaire | Fenêtre avant → après | Jours post complets | Clics avant → après | Impressions avant → après | CTR avant → après | Position avant → après | Lecture |
|---|---|---:|---:|---:|---:|---:|---|
| [Arbol ES](https://noctalia.app/es/simbolos/arbol) | 27–30 août → 3–6 septembre | 4/7 | 43 → 46 | 4 979 → 4 752 | 0,864 → 0,968 % | 5,83 → 5,65 | Petit mouvement favorable, pas de verdict |
| [Pidocchi IT](https://noctalia.app/it/simboli/pidocchi) | 27–30 août → 3–6 septembre | 4/7 | 2 → 2 | 807 → 823 | 0,248 → 0,243 % | 7,95 → 7,98 | Pratiquement stable, deux clics seulement |
| [Travail EN](https://noctalia.app/en/blog/stress-dreams-work) | 26–30 août → 2–6 septembre | 5/7 | 0 → 0 | 189 → 172 | 0 → 0 % | 13,05 → 12,10 | Position meilleure, aucun signal de clic |
| [False awakening EN](https://noctalia.app/en/blog/false-awakening-dreams) | 26–30 août → 2–6 septembre | 5/7 | 0 → 0 | 0 → 0 | n/a → n/a | n/a → n/a | Aucune visibilité retournée ; pas une preuve d’absence de demande ou d’un statut d’indexation |

Pour false-awakening, la période avant précède la création publiée de l’URL : c’est un état de référence nul, **pas un test CTR avant/après comparable à une page existante**. L’API renvoie `ctr=0,position=0` pour une ligne sans impressions ; le rapport les affiche `n/a`.

Le [relevé J52](../../seo-recovery-2026-09-09/j52-plan-editorial-2026-09-07.md) fixe les publications opérationnelles au 1er septembre (travail EN/false-awakening) et au 2 septembre (arbol/pidocchi). Historique Git retrouvé :

| Propriétaire | Commit | Date Git |
|---|---|---|
| Arbol | `843e17ebc821a61262b806134847a136c2632eb4` | 2 septembre, 21:06 +02:00 |
| Pidocchi | `965b3f74c9ce80800bb932984904f1056b3a1b6d` | 2 septembre, 21:30 +02:00 |
| Travail EN | `eecf7d55961b95abb742ca83f5dd694c1334e538` | 1er septembre, 14:09 +02:00 |
| False-awakening EN | `19e26926ef49461972229edc1da6357597cb3336` | 1er septembre, 07:36 +02:00 |

Les quatre URL ont été revérifiées **HTTP 200 et auto-canoniques** le 9 septembre, avec les titres attendus (`live-url-check.json`). Les dates opérationnelles reprises du journal sont cohérentes avec Git ; l’historique exact du déploiement Cloudflare n’a pas été reconstitué dans ce sous-lot. La date éditoriale `publishedTime=2026-08-30` de false-awakening n’est pas utilisée comme date de mise en production. Les comptes GSC ne prouvent pas que Google montrait déjà le nouveau title.

## Casa — baseline corrigée et cohortes identiques

URL : [casa IT](https://noctalia.app/it/simboli/casa). La vague metadata du 8 août est documentée dans `marketing/seo/search-console/2026-08-08-low-visibility-wave-3-freeze.md` et le commit `3bac9c1f6b29918e98189090d4e5c658363529e8`. **Avant : 11 juillet–7 août** (28 jours strictement antérieurs au 8 août). **Après : 9 août–5 septembre** (28 jours, jour de transition exclu). Chaque fenêtre contient quatre occurrences de chaque jour de semaine.

| Périmètre | Clics avant → après | Impressions avant → après | CTR avant → après | Position avant → après |
|---|---:|---:|---:|---:|
| Page entière | 39 → 32 | 5 482 → 9 588 | 0,711 → 0,334 % | 7,50 → 7,14 |
| Toutes requêtes visibles | 9 → 9 | 1 221 → 1 801 | 0,737 → 0,500 % | 7,71 → 7,24 |
| 72 requêtes présentes avant et après | 9 → 8 | 1 172 → 1 738 | 0,768 → 0,460 % | 7,68 → 7,30 |
| 6 couples pays/appareil présents avant et après | 9 → 9 | 1 210 → 1 787 | 0,744 → 0,504 % | 7,68 → 7,23 |
| **99 triplets requête/pays/appareil identiques** | **9 → 7** | **1 133 → 1 656** | **0,794 → 0,423 %** | **7,63 → 7,35** |

Le chiffre avant du J52 (42 clics/5 579 impressions) est remplacé pour cette décision par **39/5 482**, car l’ancienne fenêtre incluait le jour du changement. Sur la page entière, clics −17,9 %, impressions +74,9 %. Aucune dégradation globale de position n’est visible.

La cohorte commune reste un mélange dont les poids changent. En conservant **les poids d’impressions avant de chacun des 99 triplets**, le CTR après devient **0,409 %**, contre 0,794 % avant ; la position après pondérée de la même façon vaut **6,75**, contre 7,63 avant. Formule : somme du CTR après de chaque triplet × sa part d’impressions avant, sur les seuls triplets communs. Ainsi, la baisse du CTR visible **ne se réduit pas au changement de mix**. Cette standardisation ne contrôle ni les changements SERP, ni la saisonnalité, ni les impressions individuelles et ne constitue pas un effet causal du title.

### Couverture et faible effectif

Les données détaillées ne couvrent que **22,27 % des impressions avant et 18,78 % après**, et **9/39 puis 9/32 clics** de la page. Les 99 triplets communs couvrent 20,67 % puis 17,27 % des impressions. Le reste est **non observable dans ces exports détaillés** : anonymisation et limites internes possibles ; il ne faut pas attribuer tout l’écart à l’anonymisation seule. La ventilation pays/appareil présente aussi cet écart face aux agrégats page/date, sans saturation de la limite de lignes (17 lignes sur 25 000). Les totaux quotidiens se réconcilient exactement avec les agrégats de page. Aucun complément de pagination n’est nécessaire pour ces réponses, mais l’API ne garantit pas toutes les lignes. [Limites de détail GSC](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).

Exemple dominant observable : Italie/mobile, 9 → 7 clics, 1 074 → 1 613 impressions, CTR 0,838 → 0,434 %, position 7,30 → 6,57. Le sous-ensemble est trop petit pour déclencher un rollback ; un seul clic change sensiblement le CTR d’une requête.

### Intention maison inconnue / eau

Classement descriptif des seules requêtes visibles, règles reproductibles dans `analyze.py` ; priorité à eau/inondation si une requête recouvre plusieurs catégories. Ce classement ne décide pas à lui seul de l’ownership éditorial.

| Sous-thème visible | Impressions avant → après | Clics avant → après | CTR avant → après |
|---|---:|---:|---:|
| Eau / inondation | 226 → 849 | 0 → 3 | 0 → 0,353 % |
| Maison inconnue | 309 → 279 | 2 → 3 | 0,647 → 1,075 % |
| Autres maisons | 686 → 673 | 7 → 3 | 1,020 → 0,446 % |

La part eau/inondation dans les impressions visibles augmente de **18,5 % à 47,1 %**. Cela explique une partie du changement de composition ; le sujet maison inconnue ne présente pas de baisse de CTR dans ce regroupement. Le journal antérieur attribue le cluster « acqua in casa / casa allagata » à **alluvione** : conserver ce contrat, et ne pas transformer casa en concurrent de cette page sur la base de ces seules impressions. Ce sous-lot n’a pas réaudité toutes les pages concurrentes du cluster, donc ne conclut pas à une cannibalisation mesurée.

### Suite précise

1. Maintenir les metadata casa actuelles ; aucun rollback validé.
2. Au prochain relevé, réutiliser la baseline strictement pré-8 août et présenter séparément la fenêtre expérimentale de 28 jours et toute extension ; ne pas substituer une baseline glissante contaminée.
3. Suivre les 99 triplets déjà identifiés sans transformer une ligne absente en zéro certain ; publier à nouveau leur couverture et les agrégats complets.
4. Avant toute nouvelle correction, confronter le title réellement affiché dans les SERP aux intentions maison/maison inconnue et aux propriétaires eau, puis exiger une baisse persistante sur davantage de clics. Le diagnostic présent justifie une surveillance ciblée, pas une réécriture.

## Fichiers de preuve

- `freshness.json`, `daily-final.*`, `daily-all.*` : fin de données et journées incomplètes.
- `site-current-28d.*`, `site-previous-28d.*` : site entier.
- `experiments.json`, `{arbol,pidocchi,work-en,false-awakening-en}-{before,after}*` : fenêtres, agrégats, séries et requêtes visibles.
- `casa-{before,after}-*` : réponses brutes agrégées et détaillées.
- `casa-cohorts-*.csv`, `casa-cohort-summary.json`, `casa-clusters.csv` : cohortes identiques, pondération et regroupements d’intention.
- `publication-git-evidence.json`, `live-url-check.json` : Git et état HTTP actuel, distincts du déploiement historique.

Validation locale : exécution réelle des deux scripts ; réconciliation des 28 totaux journaliers casa avec les agrégats de page ; contrôle du nombre de journées des fenêtres ; aucun fichier produit ni secret modifié.
