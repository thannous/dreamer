# Noctalia — archive opérationnelle Ahrefs Starter

Archive initiale : J1 à J17, du 16 juillet au 1er août 2026

Contrôles additionnels : J18 à J25, du 2 au 9 août 2026

Projet Ahrefs : `9361004`

Plan : Starter mensuel, prochaine facturation et remise à zéro observées le 16 août 2026 UTC

## Objet

Ce dossier conserve dans Git les décisions et synthèses nécessaires pour reprendre le mois Starter sans dépendre des captures, exports GSC ou classeurs privés d'une machine.

Il ne contient volontairement pas :

- les exports bruts Ahrefs, GSC, Web Analytics ou Site Audit ;
- les captures d'écran ;
- les données susceptibles de contenir des requêtes utilisateur détaillées ;
- les journaux techniques complets ou les classeurs de travail privés.

Ces éléments restent dans l'archive privée ignorée par Git. Les valeurs reprises ici sont soit confirmées par un livrable daté, soit explicitement qualifiées de reconstruction.

## Fichiers

- [`j1-j17-operational-history-2026-08-01.md`](./j1-j17-operational-history-2026-08-01.md) : historique complet, résultats, limites et points d'arrêt.
- [`j1-j17-decisions-2026-08-01.md`](./j1-j17-decisions-2026-08-01.md) : état opérationnel à reprendre à J18.
- [`j1-j17-evidence-register-2026-08-01.csv`](./j1-j17-evidence-register-2026-08-01.csv) : registre compact par journée.
- [`j18-confounder-control-2026-08-02.md`](./j18-confounder-control-2026-08-02.md) : contrôle des changements, production et facteurs confondants avant les prochaines mesures.
- [`j19-j23-operational-update-2026-08-07.md`](./j19-j23-operational-update-2026-08-07.md) : synthèse durable des relevés Rank Tracker, GSC, Site Audit, maillage interne et préparation du point de décision J24.
- [`j19-j23-evidence-register-2026-08-07.csv`](./j19-j23-evidence-register-2026-08-07.csv) : registre compact des cinq journées, avec niveau de preuve et prochaine action.
- [`j24-decision-2026-08-08.md`](./j24-decision-2026-08-08.md) : verdict documenté après actualisation GSC et contrôles d'intégrité.
- [`j24-evidence-2026-08-08.csv`](./j24-evidence-2026-08-08.csv) : registre compact des preuves et du point d'autorisation J24.
- [`j25-master-reconciliation-2026-08-09.md`](./j25-master-reconciliation-2026-08-09.md) : réconciliation entre l'archive Starter, le `master` courant, la vague metadata publiée et le snapshot Rank Tracker du 9 août.
- [`j25-evidence-register-2026-08-09.csv`](./j25-evidence-register-2026-08-09.csv) : registre compact des preuves, anomalies d'URL et points d'arrêt J25.
- [`rank-tracker-portfolio-50-2026-07-16.csv`](./rank-tracker-portfolio-50-2026-07-16.csv) : portefeuille validé des 50 couples, assaini des métriques brutes.
- [`rank-tracker-target-map-2026-08-01.csv`](./rank-tracker-target-map-2026-08-01.csv) : correspondance durable entre chaque tag `target-*` et l'URL cible voulue.
- [`j10-prioritization-2026-07-25.md`](./j10-prioritization-2026-07-25.md) et [`j10-priorities-2026-07-25.csv`](./j10-priorities-2026-07-25.csv) : première consolidation versionnée du portefeuille 5 + 3.

## Autorités et précautions

1. Les compteurs live Ahrefs, la facturation et les données GSC fraîches priment toujours sur cette archive.
2. Les preuves brutes J1–J3 citées dans les réconciliations historiques ne sont plus présentes dans les archives accessibles. Leurs décisions sont conservées, mais aucune donnée absente n'a été recréée.
3. Le dernier compteur général vérifié dans l'interface est `63 crédits utilisés` au 8 août, avec une prochaine facturation et remise à zéro le 16 août 2026 UTC. Le passage antérieur de 62 à 63 n'est pas attribué à un lot précis ; J19 à J24 ont consommé zéro crédit général confirmé.
4. Les 50 suivis, leurs emplacements et leurs tags ne doivent pas être modifiés sans décision explicite. Un changement d'emplacement détruirait l'historique du couple concerné.
5. Les pages et expériences restent soumises à leurs gels respectifs. Une prévalidation n'autorise ni édition, ni commit, ni publication.
6. Le connecteur Ahrefs et l'interface web n'exposent pas les mêmes compteurs. Le relevé API `Trial, billed monthly` du 9 août décrit la couche API ; il ne remplace ni le plan Starter observé dans l'interface ni son compteur de crédits généraux.

## État au 9 août 2026

- Rank Tracker : `50/50`, allocation et géolocalisations inchangées.
- Dernier snapshot hebdomadaire réellement disponible : 9 août 2026, avec 42 couples classés et 8 non classés sur chaque appareil et aucun mot-clé gelé.
- Site Audit : `1 147/10 000` crédits de crawl observés ; dernier crawl visible daté du 3 août, Health Score 100.
- Dernière fenêtre GSC complète conservée : 10 juillet au 6 août 2026, comparée au 12 juin–9 juillet.
- Le gel commun des cinq priorités est arrivé à son terme ; chaque expérience conserve désormais son propre contrat et son propre point d'autorisation.
- `scuola` a reçu le verdict `GO_TO_IMPLEMENTATION_GATE`, puis une autorisation locale limitée, mais aucune variante `scuola` n'est présente sur `master` ou en production au 9 août. `ascensor` reste le second candidat.
- Le support générique metadata-only et une vague distincte sur `casa`, `ragno` et `perro` ont été publiés le 8 août par le commit `3bac9c1f6`. Ces trois URL sont gelées jusqu'au 5 septembre, avec lecture J+7 le 15 août.
- Cinq articles de la vague éditoriale 2 sont gelés jusqu'au 25 août, avec première lecture GSC le 4 août.
- L'article allemand sur le bruit nocturne est passé de `frozen` à `monitor_only` le 1er août ; l'échantillon GSC reste insuffisant pour justifier une édition.
- Les onze URL de décision contrôlées à J23 répondaient HTTP 200, étaient indexables, auto-canoniques et inchangées dans leurs sources depuis la clôture J10.
- La vague metadata du 8 août constitue un facteur confondant séparé ; elle ne doit pas être attribuée au test `scuola`, qui n'a pas commencé.
- Aucun nouveau crawl, achat, dépense générale Ahrefs ou changement des 50 suivis n'a été effectué par la réconciliation J25.
