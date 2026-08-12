# Noctalia — archive opérationnelle Ahrefs Starter

Archive initiale : J1 à J17, du 16 juillet au 1er août 2026

Contrôles additionnels : J18 à J28, du 2 au 12 août 2026

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
- [`j26-gsc-content-opportunities-2026-08-10.md`](./j26-gsc-content-opportunities-2026-08-10.md) : analyse GSC `page × query` et arbitrage chef SEO ; IT en mesure, correction DE séparée, architecture DE et EN en HOLD.
- [`j26-content-opportunity-backlog-2026-08-10.csv`](./j26-content-opportunity-backlog-2026-08-10.csv) : backlog agrégé et priorisé, avec statuts `HOLD_MESURE`, `GO_SEPARE`, `HOLD_ARCHITECTURE` et `HOLD_POST_DEPLOIEMENT`, sans export longue traîne brut.
- [`j26-new-content-summary-2026-08-10.md`](./j26-new-content-summary-2026-08-10.md) : synthèse séparée confirmant zéro nouvelle page immédiate et une seule candidate IT conditionnelle.
- [`j26-seo-takeover-live-reconciliation-2026-08-10.md`](./j26-seo-takeover-live-reconciliation-2026-08-10.md) : reprise des comptes Ahrefs et GSC, chronologie depuis J25, réconciliation live et backlog de clôture.
- [`j26-evidence-register-2026-08-10.csv`](./j26-evidence-register-2026-08-10.csv) : registre compact des preuves live, facteurs confondants et portes d'autorisation J26.
- [`j26-j31-starter-utilization-plan-2026-08-10.md`](./j26-j31-starter-utilization-plan-2026-08-10.md) : plan de consommation contrôlée avant le reset du 16 août, avec statut d'exécution J26.
- [`j26-starter-execution-2026-08-10.md`](./j26-starter-execution-2026-08-10.md) : résultats des Lots A à D, crawl planifié, compteurs finaux, concurrents retenus, backlog J27 et recommandation provisoire Free vs Starter.
- [`j26-competitive-keyword-gap-2026-08-10.md`](./j26-competitive-keyword-gap-2026-08-10.md) : collecte Organic Keywords ciblée sur sept concurrents IT/DE/FR/ES, coût réel, exclusions et hypothèses à valider dans GSC.
- [`j26-competitive-gap-backlog-2026-08-10.csv`](./j26-competitive-gap-backlog-2026-08-10.csv) : backlog exploitable après Starter, séparant actifs existants, absences locales non confirmées et facteurs confondants.
- [`j27-gsc-keyword-validation-2026-08-11.md`](./j27-gsc-keyword-validation-2026-08-11.md) : validation GSC 28 jours et fenêtre disponible « 12 mois », six rapports Keyword Explorer/SERP et décisions chaussures/crocodile.
- [`j27-content-validation-backlog-2026-08-11.csv`](./j27-content-validation-backlog-2026-08-11.csv) : backlog post-Starter des propriétaires prospectifs, preuves, conflits et portes d'implémentation.
- [`j27-ranking-expansion-2026-08-11.md`](./j27-ranking-expansion-2026-08-11.md) : extension J27 autorisée, croisement de 80 requêtes Ahrefs avec GSC, lot de 20 routes localisées et quatre quick wins de titres existants.
- [`j27-ranking-expansion-backlog-2026-08-11.csv`](./j27-ranking-expansion-backlog-2026-08-11.csv) : matrice pays de 80 requêtes pour les vagues suivantes, avec métriques observées, statut et porte d'ownership.
- [`j27-ranking-expansion-execution-2026-08-11.md`](./j27-ranking-expansion-execution-2026-08-11.md) : journal du chantier `turtle` → `crocodile` → `lice`, séparation des états Git/publics et portes d'autorisation des leviers différés.
- [`j28-gsc-indexation-triage-2026-08-12.md`](./j28-gsc-indexation-triage-2026-08-12.md) : tri du premier cas parmi les 254 URL, contradiction couverture/performance GSC, lien contextuel DE publié et preuves Git/CI/Cloudflare/HTTP.
- [`j27-misabueso-gsc-ownership-2026-08-11.md`](./j27-misabueso-gsc-ownership-2026-08-11.md) : baseline GSC espagnole après l'analyse Misabueso, propriétaires confirmés et plus petit lot d'ancre justifié.
- [`j27-misabueso-gsc-ownership-matrix-2026-08-11.csv`](./j27-misabueso-gsc-ownership-matrix-2026-08-11.csv) : matrice GO / ADJUST / HOLD des URL et clusters espagnols sur deux fenêtres comparables de 28 jours.
- [`drive-archive-2026-08-11.md`](./drive-archive-2026-08-11.md) : emplacements Drive des lots J25–J27, Misabueso GSC et preuves brutes, périmètres synchronisés et règles de conservation.
- [`drive-sync-manifest-2026-08-11.csv`](./drive-sync-manifest-2026-08-11.csv) : correspondance vérifiable entre les 16 fichiers Git, leurs identifiants Drive et leurs empreintes SHA-256.
- [`drive-sync-manifest-misabueso-2026-08-11.csv`](./drive-sync-manifest-misabueso-2026-08-11.csv) : correspondance vérifiable des deux rapports Misabueso GSC archivés dans leur sous-dossier dédié.
- [`rank-tracker-portfolio-50-2026-07-16.csv`](./rank-tracker-portfolio-50-2026-07-16.csv) : portefeuille validé des 50 couples, assaini des métriques brutes.
- [`rank-tracker-target-map-2026-08-01.csv`](./rank-tracker-target-map-2026-08-01.csv) : correspondance durable entre chaque tag `target-*` et l'URL cible voulue.
- [`j10-prioritization-2026-07-25.md`](./j10-prioritization-2026-07-25.md) et [`j10-priorities-2026-07-25.csv`](./j10-priorities-2026-07-25.csv) : première consolidation versionnée du portefeuille 5 + 3.

## Décision J26 après revue chef SEO

| Lot | Statut | Décision durable |
|---|---|---|
| IT `acqua sporca/torbida` | `HOLD_MESURE` | conserver fiche = intention courte et guide = scénarios larges ; aucune édition immédiate, aucune troisième page, aucun cross-canonical |
| DE `traumlexikon` | `GO_SEPARE` | ancre produit renommée en `Traumlexikon-App für Android` et présente sur `master` ; déploiement public et effet SEO restent à vérifier séparément |
| DE `Traumdeutung` | `HOLD_ARCHITECTURE` | comparer quatre URL, dont le hub existant `/de/blog/traumbedeutungen-interpretation-symbole`, avant toute redistribution de rôle |
| EN `dream journal app` | `HOLD_POST_DEPLOIEMENT` | attendre 28 jours complets depuis le dernier déploiement public vérifié ; les données arrêtées au 7 août ne mesurent pas les modifications du 8 au 10 août |
| Nouveau contenu | `AUCUNE_NOUVELLE_PAGE` | 0 nouvelle page maintenant ; page IT eau sale uniquement conditionnelle après mesure et preuve d'une valeur incrémentale |

Pour l'Italie, les 1 349 impressions du cluster au niveau requête/propriété restent distinctes des 1 433 impressions cumulées au niveau page. Le page-level passe de fiche 94 / guide 578 à fiche 909 / guide 506 ; ce basculement doit être mesuré sur une fenêtre entièrement postérieure au 16 juillet avant une nouvelle action.

Cette revue reste documentaire à l'exception de l'ancre allemande `Traumlexikon-App für Android`, autorisée puis modifiée dans `docs-src/` dans un lot chirurgical séparé. La source est désormais présente sur `master`, sans que cela prouve encore le déploiement public ni un effet SEO.

## Autorités et précautions

1. Les compteurs live Ahrefs, la facturation et les données GSC fraîches priment toujours sur cette archive.
2. Les preuves brutes J1–J3 citées dans les réconciliations historiques ne sont plus présentes dans les archives accessibles. Leurs décisions sont conservées, mais aucune donnée absente n'a été recréée.
3. Le dernier compteur général vérifié dans l'interface est `113/200 crédits utilisés` au 11 août, après les Lots A à D, les rapports Organic Keywords concurrentiels, les collectes Keyword Explorer groupées et huit SERP ciblées, avec une prochaine facturation et remise à zéro le 16 août 2026 UTC.
4. Les 50 suivis, leurs emplacements et leurs tags ne doivent pas être modifiés sans décision explicite. Un changement d'emplacement détruirait l'historique du couple concerné.
5. Les pages et expériences restent soumises à leurs gels respectifs. Une prévalidation n'autorise ni édition, ni commit, ni publication.
6. Le connecteur Ahrefs et l'interface web n'exposent pas les mêmes compteurs. Le relevé API `Trial, billed monthly` du 9 août décrit la couche API ; il ne remplace ni le plan Starter observé dans l'interface ni son compteur de crédits généraux.

## État au 9 août 2026

- Rank Tracker : `50/50`, allocation et géolocalisations inchangées.
- Dernier snapshot hebdomadaire réellement disponible : 9 août 2026, avec 42 couples classés et 8 non classés sur chaque appareil et aucun mot-clé gelé.
- Site Audit : `1 147/10 000` crédits de crawl observés ; dernier crawl visible daté du 3 août, Health Score 100.
- À J25, la dernière fenêtre GSC conservée était le 10 juillet–6 août, comparée au 12 juin–9 juillet. L'analyse J26 la remplace pour cette décision par le 11 juillet–7 août, comparé au 13 juin–10 juillet.
- Le gel commun des cinq priorités est arrivé à son terme ; chaque expérience conserve désormais son propre contrat et son propre point d'autorisation.
- `scuola` a reçu le verdict `GO_TO_IMPLEMENTATION_GATE`, puis une autorisation locale limitée, mais aucune variante `scuola` n'est présente sur `master` ou en production au 9 août. `ascensor` reste le second candidat.
- Le support générique metadata-only et une vague distincte sur `casa`, `ragno` et `perro` ont été publiés le 8 août par le commit `3bac9c1f6`. Ces trois URL sont gelées jusqu'au 5 septembre, avec lecture J+7 le 15 août.
- Cinq articles de la vague éditoriale 2 sont gelés jusqu'au 25 août, avec première lecture GSC le 4 août.
- L'article allemand sur le bruit nocturne est passé de `frozen` à `monitor_only` le 1er août ; l'échantillon GSC reste insuffisant pour justifier une édition.
- Les onze URL de décision contrôlées à J23 répondaient HTTP 200, étaient indexables, auto-canoniques et inchangées dans leurs sources depuis la clôture J10.
- La vague metadata du 8 août constitue un facteur confondant séparé ; elle ne doit pas être attribuée au test `scuola`, qui n'a pas commencé.
- Aucun nouveau crawl, achat, dépense générale Ahrefs ou changement des 50 suivis n'a été effectué par la réconciliation J25.

## Actualisation J26 au 10 août 2026

- Lots Ahrefs A à D exécutés sans mutation externe : empreinte organique, architecture interne, backlinks et concurrents.
- Compteur général visible : `63 → 63` ; Rank Tracker : `50/50` inchangé.
- Crawl planifié terminé à Health Score 100, 0 erreur, 1 201 URL internes et `2 843/10 000` crédits workspace utilisés.
- Deux descriptions légales PT-BR trop courtes sont la seule hausse des warnings `44 → 46`. Les deux notices `x-default` PT-BR-only sont conformes au contrat du dépôt et restent acceptées.
- Un lien éditorial dofollow DR 55 vers l'article italien de rappel des rêves est confirmé publiquement ; le reste du profil reste fortement pollué par le spam.
- Le détail décisionnel et la shortlist J27 sont dans `j26-starter-execution-2026-08-10.md`.
- Content Gap est verrouillé derrière la tarification sur le plan observé. Sept rapports Organic Keywords ciblés ont été utilisés à la place : compteur général `63 → 70`, Rank Tracker `50/50` inchangé et Site Audit workspace `3 627/10 000` au dernier relevé.
- Le signal concurrentiel principal est un gap multilingue chaussures, absent des trois inventaires de symboles mais encore soumis à validation GSC. Aucune nouvelle page n'est autorisée depuis cette preuve seule.

## Actualisation J27 au 11 août 2026

- La dernière journée GSC complète est le 9 août ; la fenêtre 28 jours du 13 juillet au 9 août affiche 4 273 clics, 491 150 impressions, un CTR arrondi à 0,9 % et une position arrondie à 7,3.
- Le filtre GSC `scarpe|schuhe|chaussures|zapatos` renvoie 0 clic et 0 impression sur 28 jours et sur la fenêtre « 12 mois » disponible depuis le 5 décembre 2025.
- Six rapports Keyword Explorer/SERP ont coûté exactement six crédits : compteur général `70 → 76`, Rank Tracker `50/50` et Site Audit workspace `3 627/10 000` inchangés.
- Chaussures passe à `GO_CONTENT_BRIEF` pour IT, DE, FR et ES ; aucune page n'est encore créée ni publiée.
- Crocodile reste `HOLD_OWNER_REVIEW` : trois impressions historiques sont déjà réparties entre les guides animaux DE et IT, et aucune impression n'est visible sur 28 jours.
- `casa`, `ragno`, `perro`, `scuola`, le lot italien eau et l'anglais restent dans leurs contrats de mesure respectifs.
- La recommandation d'abonnement reste provisoirement `LEAN_FREE` ; la décision de facturation appartient à l'utilisateur.
- Une autorisation ultérieure a ouvert un lot d'expansion distinct : caca/excréments, vers, cafard et chaussures sont préparés comme quatre propriétaires canoniques dans cinq langues, soit 20 routes, sans toucher aux expériences gelées.
- Dix rapports pays groupés ont validé 80 requêtes additionnelles pour seulement dix crédits ; tortue, crocodile et poux forment la prochaine vague prioritaire, tandis que les conflits d'ownership restent en HOLD.
- Huit SERP exactes ont confirmé que des pages à faible autorité se classent déjà sur les requêtes du lot ; compteur final `113/200`, soit 87 crédits nominaux encore disponibles avant la remise à zéro.
- Quatre titres trop longs à fort volume GSC sont raccourcis dans les sources : `pioggia`, `automobile`, `verfolgung` et `maison`. Les six URL candidates totalisaient 159 clics et 20 250 impressions sur 28 jours ; le lot retenu en représente 144 et 19 024.

## Actualisation J28 au 12 août 2026

- Le premier cas des 254 URL, l'article DE sur la poursuite, génère déjà 1 clic et 83 impressions à position 8,9 sur les 28 jours complets au 9 août. Son ancien statut « explorée, actuellement non indexée » est traité comme retardé ou transitoire, pas comme un blocage actuel.
- La page DE sur les rêves récurrents, forte de 41 clics et 5,34 k impressions à position 6,7 sur 28 jours, porte désormais un seul lien contextuel vers l'article détaillé sur la poursuite. L'ancre reste distincte de la fiche symbole A–Z.
- Le lot est publié sur `master` au commit `130cd0af1`; GitHub Actions `Quality`, Cloudflare Pages et les contrôles HTTP publics sont verts.
- Aucun crédit Ahrefs, changement Rank Tracker, redéploiement manuel ni demande d'indexation n'a été consommé par ce traitement.
