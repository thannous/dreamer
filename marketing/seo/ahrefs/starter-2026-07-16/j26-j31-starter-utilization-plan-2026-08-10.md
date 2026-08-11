# Noctalia — plan d'exploitation Ahrefs Starter J26–J31

Date de préparation : 10 août 2026

Projet Ahrefs : `9361004`

Période : J26 le 10 août à J31 le 15 août 2026, avant la remise à zéro du 16 août à 00:00 UTC

Mode de cette préparation : vérifications live sans crédit général, plan local uniquement, aucune mutation Ahrefs/GSC, aucun crawl manuel, aucune demande d'indexation, aucun achat et aucune décision de facturation

## Actualisation après exécution J26

Les Lots A à D ont été exécutés le 10 août avec les avertissements préalables prévus. Le crawl planifié s'est achevé sans déclenchement manuel. Le compteur général visible est resté à `63`, le Rank Tracker à `50/50` et le compteur Site Audit est passé à `2 843/10 000` sous l'effet du crawl automatique.

Les résultats, limites payantes, concurrents retenus et sous-lots J27 sont consolidés dans [`j26-starter-execution-2026-08-10.md`](./j26-starter-execution-2026-08-10.md). La stabilité du compteur général ne prouve pas une consommation nulle, car le quota additionnel du projet vérifié n'est pas exposé.

### Checkpoint concurrentiel additionnel

Content Gap a ensuite été testé sur le lot Italie et s'est révélé verrouillé derrière `See pricing`, sans donnée ni crédit ajouté. Sept rapports Organic Keywords concurrents ont été exécutés à la place sur IT, DE, FR et ES. Le compteur général est passé de `63` à `70`, exactement un crédit par rapport exploitable. Le Rank Tracker est resté à `50/50` et le Site Audit workspace à `3 627/10 000` au dernier relevé.

La preuve et le backlog sont conservés dans [`j26-competitive-keyword-gap-2026-08-10.md`](./j26-competitive-keyword-gap-2026-08-10.md) et [`j26-competitive-gap-backlog-2026-08-10.csv`](./j26-competitive-gap-backlog-2026-08-10.csv). Le gap chaussures est prioritaire pour une validation GSC, pas pour une création immédiate.

## État live vérifié avant planification

| Indicateur | Valeur vérifiée le 10 août |
|---|---:|
| Plan interface | Starter, facturé mensuellement |
| Crédits généraux utilisés | 63 |
| Plafond mensuel Starter documenté | 200 |
| Crédits additionnels documentés pour projets vérifiés | 500 |
| Plafond potentiel restant pour Noctalia | jusqu'à 637 |
| Projets vérifiés | 4 |
| Rank Tracker | 50/50 |
| Crédits de crawl restants dans le workspace | 7 157 ; 2 843/10 000 utilisés |
| Dernier crawl Noctalia | 10 août, Health Score 100, 1 201 URL internes, 0 erreur |
| Prochain crawl Noctalia affiché | 17 août, fenêtre 15:00–16:00 |
| Remise à zéro | 16 août 2026 à 00:00 UTC |

Le chiffre de 637 est un maximum théorique issu de `200 + 500 - 63`. L'interface ne détaille pas la ventilation instantanée entre crédits généraux et crédits réservés aux projets vérifiés. Le compteur live reste donc l'autorité après chaque lot.

## Objectif

Maximiser la valeur durable de Starter, pas le nombre de clics dans l'interface :

1. collecter avant la fin de J27 les preuves impossibles ou fortement réduites après retour à Free ;
2. transformer chaque rapport payant en décision, backlog ou baseline conservée ;
3. utiliser les jours J28–J31 pour combler les trous prouvés et non pour rouvrir aveuglément des rapports ;
4. produire une recommandation d'abonnement fondée sur l'utilité réelle des résultats obtenus.

## Gouvernance des crédits

- Avant chaque sous-lot facturable, annoncer l'outil, les rapports, la question décisionnelle et le plafond.
- Sous-lots de 15 à 35 crédits maximum.
- Relever `Limits & Usage` avant et après chaque sous-lot.
- Arrêter immédiatement si le coût réel dépasse le plafond annoncé ou si le compteur ne permet pas d'identifier la consommation.
- Enregistrer uniquement des agrégats, URL, décisions et preuves utiles ; ne pas versionner les exports contenant la longue traîne brute.
- Ne modifier aucun des 50 suivis, emplacements ou tags.
- Ne pas déclencher manuellement le crawl prévu aujourd'hui. Lire le crawl programmé seulement après son achèvement.
- Ne pas modifier `casa`, `ragno`, `perro`, `scuola`, l'anglais gelé ou le lot italien eau pendant la collecte.

## Budget opérationnel

| Jour | Plafond additionnel | Finalité dominante | Cumul maximal |
|---|---:|---|---:|
| J26 — 10 août | 100 | empreinte Noctalia, liens, concurrents et baseline technique | 100 |
| J27 — 11 août | 300 | collecte durable principale par locale, page et cluster | 400 |
| J28 — 12 août | 100 | Keyword Explorer et content gaps confirmés par GSC | 500 |
| J29 — 13 août | 70 | backlinks, pertes, ancres et opportunités récupérables | 570 |
| J30 — 14 août | 40 | validations et trous de preuve uniquement | 610 |
| J31 — 15 août | jusqu'au solde utile | mesure J+7, réconciliation et dernier complément ciblé | jusqu'à 637 |

La cible raisonnable est d'obtenir au moins 600 crédits de preuves utiles, puis d'utiliser le reliquat uniquement sur des questions encore ouvertes. Un solde non consommé vaut mieux qu'un rapport sans décision ni conservation durable.

## J26 — plan d'exécution aujourd'hui

### Préflight sans crédit général — terminé

- `Limits & Usage` : 63 crédits utilisés, reset confirmé le 16 août UTC.
- Couche API : zéro unité consommée ; elle ne remplace pas le compteur de l'interface.
- Rank Tracker : 50/50 inchangé.
- Site Audit : 8 353 crédits de crawl restants ; dernier crawl Noctalia du 3 août, crawl programmé aujourd'hui.
- GSC : dernier jour complet du lot courant au 7 août ; 254 URL explorées mais non indexées à segmenter, sans demande d'indexation.

### Lot A — empreinte organique par locale — plafond 35 crédits

Outil : Site Explorer sur le projet vérifié Noctalia.

Rapports ciblés :

- Organic keywords et Top pages pour `US/en`, `FR/fr`, `DE/de`, `ES/es`, `IT/it` ;
- comparaison sur le mois historique disponible ;
- buckets de position `1–3`, `4–10`, `11–20`, `21–50` ;
- URL gagnantes, perdantes et changeant de propriétaire.

Décisions attendues : protéger, optimiser l'existant, traiter une répartition multi-URL ou ignorer. Aucune nouvelle page n'est validée depuis ce lot seul.

Livrable durable : tableau synthétique par locale avec requête, URL, position, trafic estimé, mouvement, propriétaire et action.

### Lot B — architecture interne et indexation — plafond 25 crédits

Outil : Site Explorer sur Noctalia.

Rapports ciblés :

- Best by internal links ;
- internal anchors ;
- pages avec liens internes faibles ou incohérents ;
- rapprochement avec un échantillon à forte valeur des 254 URL GSC explorées non indexées.

Décisions attendues : pages orphelines ou sous-liées, ancres ambiguës, hubs légitimes, pages faibles à ne pas pousser. Aucun cross-canonical ni demande d'indexation en masse.

Livrable durable : backlog `URL → source de lien → ancre → action → preuve GSC/Ahrefs`.

### Lot C — backlinks récupérables — plafond 25 crédits

Outil : Site Explorer sur Noctalia.

Rapports ciblés :

- nouveaux et perdus referring domains ;
- broken backlinks ;
- best pages by links ;
- ancres externes et pages receveuses.

Décisions attendues : récupération d'un lien réellement perdu, correction d'une destination cassée, consolidation d'une page linkable ou rejet du spam. Une ligne Ahrefs n'est pas une preuve de publication ou d'indexation externe.

Livrable durable : shortlist vérifiée avec domaine, page source, destination, statut HTTP, type de lien et prochaine action.

### Lot D — concurrents organiques — plafond 15 crédits

Outil : Site Explorer, rapports Organic competitors et Competing pages.

Marchés : Allemagne, Italie, Espagne, France et États-Unis.

Décisions attendues : sélectionner au maximum deux concurrents utiles par marché et les questions précises à approfondir à J27. Ne pas rouvrir les quarante rapports historiques.

Livrable durable : matrice `marché → concurrent → chevauchement → écart → rapport J27 justifié`.

### Après le crawl programmé

Lire sans nouveau crawl : Health Score, URL internes, erreurs, avertissements, changements depuis le 3 août et causes de la hausse `1 147 → 1 647` au niveau workspace. Séparer le coût workspace du coût du crawl Noctalia.

## J27 — collecte durable principale

Plafond : 300 crédits, répartis en sous-lots de 25 à 35.

1. Les sept rapports Organic Keywords concurrents qualifiés ont été anticipés et sont terminés ; ne pas les rouvrir sans question nouvelle.
2. Valider dans GSC les clusters chaussures, crocodile puis les absences italiennes, en séparant langue, requête et page.
3. Construire les content gaps uniquement à partir des absences confirmées dans GSC, jamais à partir d'un mot-clé concurrent isolé.
4. Conserver les SERP et pages concurrentes qui expliquent une décision éditoriale ou de maillage.
5. Archiver une baseline Rank Tracker mobile et desktop sans changer le portefeuille.
6. Produire avant la fin de la journée un backlog utilisable après retour à Free.

## J28–J30 — compléments conditionnels

### J28 — Keywords Explorer et content gaps

- approfondir les clusters absents confirmés par `page × query` ;
- séparer chaque langue et pays ;
- conserver volume, difficulté, potentiel de trafic, intention, SERP et URL Noctalia existante ;
- exclure les doublons, le bruit, les pages gelées et les sujets sans valeur métier.

### J29 — autorité et récupération de liens

- valider les nouveaux/perdus, broken backlinks, intersections et ancres ;
- privilégier les liens récupérables et les pages déjà capables de convertir ;
- séparer publication, indexabilité, dofollow/nofollow, trafic réel et présence dans l'index Ahrefs.

### J30 — contrôle des trous de preuve

- ne dépenser que sur les décisions encore ambiguës ;
- confronter Ahrefs à GSC, au dépôt et au HTTP public ;
- préparer la grille de valeur Starter vs Free.

## J31 — clôture avant reset

1. Lire le checkpoint GSC J+7 de `casa`, `ragno`, `perro` sans casser leur gel J+28.
2. Garder `scuola` séparée et non publiée.
3. Relever une dernière fois Limits & Usage, Rank Tracker et Site Audit.
4. Utiliser le reliquat uniquement pour une question décisionnelle listée dans le backlog.
5. Produire la recommandation d'abonnement ; la décision de facturation reste à l'utilisateur.

## Critères de recommandation d'abonnement

Recommander le renouvellement seulement si Starter apporte de façon répétable au moins deux des bénéfices suivants :

- Rank Tracker hebdomadaire nécessaire à des décisions que GSC ne permet pas de prendre ;
- Site Explorer ou Keywords Explorer produit des actions validées et non accessibles avec les outils gratuits ;
- preuves concurrentielles ou backlinks ayant une valeur opérationnelle récurrente ;
- besoin mensuel réel de l'historique, des filtres et des rapports payants.

Recommander le retour à Free si la collecte intensive confirme que l'essentiel des décisions vient de GSC, du dépôt, du site public et des outils gratuits, et que les rapports payants servent surtout à confirmer sans changer l'action.

## Point d'arrêt

Ce document autorise la préparation et la priorisation. Avant le premier rapport facturable, annoncer le lot exact et son plafond. Les achats, add-ons, changements d'abonnement, publication, commit, push et demandes d'indexation restent hors périmètre.
