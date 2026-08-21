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
- [`j28-actionable-levers-execution-2026-08-12.md`](./j28-actionable-levers-execution-2026-08-12.md) : exécution de l'optimisation `coche`, validation GSC/Ahrefs et préparation des cinq propriétaires `scorpion`, avec coût et stop-gates.
- [`j29-authority-recovery-2026-08-13.md`](./j29-authority-recovery-2026-08-13.md) : collecte durable nouveaux/perdus, pages par liens et ancres, séparation du spam et backlog d'autorité externe avec portes D2–D10A.
- [`j29-gsc-ahrefs-cluster-validation-2026-08-13.md`](./j29-gsc-ahrefs-cluster-validation-2026-08-13.md) : validation GSC 28 jours et fenêtre disponible des clusters guêpe/cimetière, micro-lot Ahrefs initial à cinq crédits, complément UI à quatre crédits et ordre `cemetery` puis `wasp` après la porte J+7.
- [`j29-gsc-ahrefs-cluster-backlog-2026-08-13.csv`](./j29-gsc-ahrefs-cluster-backlog-2026-08-13.csv) : backlog pays exploitable des huit requêtes vérifiées, avec métriques Ahrefs, état GSC et prochaine action sans export brut.
- [`j29-j31-cemetery-implementation-brief-2026-08-13.md`](./j29-j31-cemetery-implementation-brief-2026-08-13.md) : brief multilingue prêt à implémenter pour les cinq propriétaires `cemetery` EN/FR/ES/DE/IT, GSC revalidé, quatre SERP Starter UI (`4` crédits), route EN singulière confirmée et critères GO/HOLD à la porte du 15 août.
- [`j32-catch-up-2026-08-16.md`](./j32-catch-up-2026-08-16.md) : rattrapage du checkpoint J+7, reset Starter confirmé, lecture Rank Tracker/Site Audit et implémentation locale des cinq propriétaires `cemetery`, avec séparation du contrat URL et de la publication.
- [`j34-execution-2026-08-18.md`](./j34-execution-2026-08-18.md) : reprise J34, preuve publique des 15 URL du lot rentrée/guêpes, baseline GSC à 0/0, nouveau cycle Starter et raccourcissement ciblé de trois titles FR (`porte`, `voiture`, `foret`).
- [`j35-exact-query-matching-2026-08-18.md`](./j35-exact-query-matching-2026-08-18.md) : vérification GSC d'une proposition externe (sept URL, trois titles), courbe CTR du site par position, inspection URL de `alluvione` et lot d'appariement des requêtes exactes ES/IT sur les pages existantes, sans nouvelle URL ni changement de title.
- [`j36-plan-2026-08-20.md`](./j36-plan-2026-08-20.md) : plan J36 depuis le `master` synchronisé, réconciliation gratuite, gate metadata `scuola`, contrôle d'indexation `alluvione` et micro-lot Starter plafonné pour qualifier `bread` puis `eggs`.
- [`j36-execution-2026-08-20.md`](./j36-execution-2026-08-20.md) : exécution J36, coupure GSC au 18 août, compteurs Ahrefs 2 → 7, verdicts `scuola`/`alluvione`/`bread` et levier metadata local limité à la fiche ES `escaleras`.
- [`j36-bread-implementation-brief-2026-08-20.md`](./j36-bread-implementation-brief-2026-08-20.md) : brief durable `bread`, contrat proposé à cinq marchés, scénarios communs et gates à satisfaire avant toute création de route.
- [`j37-plan-2026-08-21.md`](./j37-plan-2026-08-21.md) : plan J37 avec fermeture séparée du lot local `escaleras`, lectures GSC gratuites, micro-lot Starter `eggs` plafonné à 8 crédits et préparation sans envoi d'un dossier d'autorité externe.
- [`j37-execution-2026-08-21.md`](./j37-execution-2026-08-21.md) : exécution J37, fermeture locale J36 sur `master` frais, coupure GSC au 19 août, compteur Ahrefs 7 → 12, verdict `eggs` HOLD et dossier Marika Pech prêt sans envoi.
- [`j27-misabueso-gsc-ownership-2026-08-11.md`](./j27-misabueso-gsc-ownership-2026-08-11.md) : baseline GSC espagnole après l'analyse Misabueso, propriétaires confirmés et plus petit lot d'ancre justifié.
- [`j27-misabueso-gsc-ownership-matrix-2026-08-11.csv`](./j27-misabueso-gsc-ownership-matrix-2026-08-11.csv) : matrice GO / ADJUST / HOLD des URL et clusters espagnols sur deux fenêtres comparables de 28 jours.
- [`drive-archive-2026-08-11.md`](./drive-archive-2026-08-11.md) : emplacements Drive des lots J25–J27, Misabueso GSC et preuves brutes, périmètres synchronisés et règles de conservation.
- [`drive-sync-manifest-2026-08-11.csv`](./drive-sync-manifest-2026-08-11.csv) : correspondance vérifiable entre les 18 fichiers Git, leurs identifiants Drive et leurs empreintes SHA-256.
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
- Le propriétaire ES `coche` est optimisé sans changer URL, canonical ou corps ; le commit `240689ebc` est poussé et les nouvelles balises sont vérifiées sur l'alias public.
- Le cluster `scorpion` est absent de GSC sur 28 jours et sur toute la fenêtre disponible depuis le 5 décembre 2025. Ahrefs confirme quatre KD de 0 à 1 et des volumes pays de 60 à 450 ; le marché DE conserve un KD non disponible faute de mise à jour Starter.
- Le compteur général Ahrefs passe de 119 à 126 crédits utilisés. Les 50 suivis et le workspace Site Audit `3 627/10 000` restent inchangés.

## Actualisation J29 au 13 août 2026

- Ahrefs affiche DR `0.1`, UR `5`, 477 backlinks et 421 domaines référents ;
  seuls 10 liens et 10 domaines sont suivis, et la majorité des nouveaux
  signaux suivis reste du spam ou du PBN.
- Le lot nouveaux/perdus, Best by links et ancres ne fait pas bouger le compteur
  général : `126/200` avant et après. Rank Tracker reste à `50/50` et Site Audit
  à `3 627/10 000`.
- Aucun lien suivi perdu n'est visible sur le dernier mois. Les rapports Broken
  backlinks et Link intersect restent verrouillés derrière un boost ; aucun
  achat ou changement de plan n'est effectué.
- GSC, complet au 11 août, affiche sur 28 jours `4.23K` clics, `501K`
  impressions, CTR `0.8 %` et position `7.4`. Le rapport Links contient 148
  liens externes vers quatre destinations ; la petite baisse ne prouve pas une
  perte récupérable.
- `D2` Marika Pech et `D5` DreamWell restent les deux actions externes
  prioritaires, préparées mais non envoyées sans autorisation indépendante.
  `D7` Atlas et ILTY a déjà reçu une relance autorisée dans un lot séparé et
  passe en surveillance passive.
- La validation complémentaire guêpe/cimetière conserve GSC complet au 11 août :
  guêpe affiche `0` impression sur 28 jours et sur toute la fenêtre disponible ;
  cimetière affiche `0` impression sur 28 jours et une seule impression
  historique, issue d'une longue requête anglaise sur un chien.
- Trois rapports Keyword Explorer groupés et deux SERP ciblées font passer le
  compteur général de `126/200` à `131/200`. Il reste `69` crédits généraux ;
  Rank Tracker reste à `50/50` et Site Audit à `3 627/10 000`.
- `cemetery` devient le prochain concept recommandé après la lecture J+7 du
  15 août, mené par l'Italie (`600` recherches, KD `0`, TP `600`). `wasp` suit,
  mené par l'Espagne (`600` recherches, KD `0`, TP `250`). Aucun nouveau
  propriétaire n'est publié à J29.
- Le lot J29–J31 `cemetery` a produit le brief multilingue des cinq
  propriétaires EN/FR/ES/DE/IT et requalifié les lignes `cemetery` des deux
  backlogs en attente de la porte J+7. Après deux appels API ES refusés et
  gratuits, les quatre SERP autorisées ont été lues dans l'interface Starter :
  ES, DE, FR et US/EN. Elles montrent notamment des résultats DR `0` en
  positions 5, 7 et 6 sur les trois premiers marchés et confirment le synonyme
  `graveyard` pour l'anglais. Le compteur passe exactement de `131/200` à
  `135/200`, soit `65` crédits restants avant la remise à zéro du 16 août 2026
  à 00:00 UTC ; Rank Tracker `50/50` et Site Audit `3 627/10 000` restent
  inchangés.
- La route EN préparée est corrigée en `/en/symbols/cemetery` : les 24
  propriétaires de lieux existants sont singuliers sauf le pluriel lexical
  `stairs`, et `scripts/lib/site-manifest.js` respecte le slug déclaré. Une
  seule page couvre `cemetery` et `graveyard`; aucune page synonyme ni
  redirection d'une route jamais publiée n'est créée.
- GSC a été relu avec une regex élargie aux pluriels et synonymes : `0` clic et
  `0` impression sur 28 jours ; `0` clic, `1` impression, position `51` sur la
  fenêtre disponible du 5 décembre 2025 au 11 août 2026. L'unique requête est
  le long-tail chien/cimetière déjà identifié, hors intention. Aucune page,
  route ou image n'a été créée.

## Actualisation J32 au 16 août 2026

- Le checkpoint J+7 manqué le 15 août est rattrapé sur deux fenêtres complètes
  de sept jours. `ragno` progresse nettement, `perro` progresse à position
  stable et `casa` gagne en visibilité et en position malgré un CTR en baisse :
  aucun incident ne justifie une retouche ou un rollback.
- `casa`, `ragno` et `perro` restent gelés jusqu'au 5 septembre ; `scuola`
  reste séparée et non démarrée.
- Le reset Starter est visible : compteur général `0`, Rank Tracker `50/50`,
  Site Audit mensuel `0/10 000`, prochaine remise à zéro le 16 septembre à
  00:00 UTC. La décision de facturation reste à l'utilisateur.
- Le lot `cemetery` est implémenté localement dans cinq langues avec 159
  concepts au total, contenu développé, maillage, curation lieux et actif
  éditorial responsive. Il n'est ni poussé ni publié.
- Le contenu est figé au commit local `001ad3a94`; le contrat URL est étendu
  additivement depuis ce HEAD et `docs:check` passe sans erreur ni avertissement.

## Actualisation J34 au 18 août 2026 — lot école, cauchemars de rentrée et guêpes

- Le lot validé J29 (contenu figé le 16 août) est exécuté dans l'ordre recommandé : article école, article cauchemars de rentrée, symbole guêpes, puis intégré le 18 août par-dessus le lot `cemetery` déjà fusionné sur `master`, sans toucher à l'expérience metadata `scuola` (l'entrée `school` n'a reçu ni metadata, ni `relatedArticles`, ni `modifiedAt`).
- L'article `blog.back-to-school-dreams` est publié en cinq langues et possède l'intention longue « retourner à l'école » : ancienne école à l'âge adulte, premier jour et nouvelle classe, couloirs perdus, retard, camarades et professeurs, lien transition/évaluation/stress de rentrée. La page symbole `school` conserve la requête générique et l'article examen conserve l'intention examen, échec et préparation ; le maillage interne explicite cette séparation. Slugs : `sognare-tornare-scuola` (IT, marché prioritaire), `rever-retourner-ecole` (FR), `sonar-volver-escuela` (ES), `traum-zurueck-in-die-schule` (DE), `back-to-school-dreams-meaning` (EN).
- L'article `blog.back-to-school-nightmares-children` est publié en cinq langues, strictement saisonnier et destiné aux parents : transitions dans les rêves, distinction cauchemar/mauvais rêve/terreur nocturne, changements d'horaires et dette de sommeil, routine du soir avant la rentrée, questions simples à poser, seuils de consultation. Il ne refait ni le guide général enfants ni l'article examens. Confiance SEO moyenne consignée : les volumes et KD exacts de la longue traîne saisonnière n'ont pas été collectés ; un contrôle GSC gratuit doit précéder tout élargissement.
- Le symbole `wasp` rejoint les catalogues canoniques (160 symboles après `cemetery`) avec interprétation étendue et six scénarios couvrant piqûre, attaque ou poursuite, nid, essaim, guêpe calme et distinction abeille/guêpe. Routes : `/es/simbolos/avispas` (marché prioritaire, volume 600, KD 0), `/it/simboli/vespe`, `/fr/symboles/guepes`, `/de/traumsymbole/wespen`, `/en/symbols/wasps`. Le cluster reste sans propriétaire GSC à la création.
- L'image éditoriale `wasp-v1.webp` est composée localement en SVG dans la charte lune/violet, faute de session Higgsfield authentifiée ; une régénération AI reste possible ultérieurement sans changer l'URL publique.
- Maillage : `blog.index` ×5 (ItemList 47 → 49, cartes « Nouveau »), `content-hubs.json` (deux spokes `dream-meanings` avec trois relations chacun), guide animaux enrichi de `wasp`.
- Validation : `docs:build` vert (1 254 pages par langue après intégration du lot `cemetery`, 53 articles × 5 langues) et tous les contrôles `docs:check` passent ; `check-public-url-stability` a reçu l'extension intentionnelle de la baseline (+15 routes, `1241 → 1256` chemins manifest) après le commit du lot.
- Le lot est intégré par-dessus `origin/master` (lot `cemetery` fusionné entre-temps) et publié sur `master` au commit `60580f34e` ; le contrat URL est étendu au commit `c04c4f92f` ; la vérification `docs:check` complète est verte après extension.
- Aucun crédit Ahrefs, crawl, changement Rank Tracker, déploiement manuel ni demande d'indexation n'a été consommé par ce traitement.
- La reprise opérationnelle J34 confirme publiquement les 15 URL du lot, pose
  leur baseline GSC à `0/0` avant données post-publication, relève le nouveau
  cycle Starter (`1` crédit général, Rank Tracker `50/50`, Site Audit
  `500/10 000`) et le crawl automatique du 17 août (Health Score `100`,
  `0` erreur). Le croisement des 21 titres trop longs avec GSC retient seulement
  `/fr/symboles/porte`, `/fr/symboles/voiture` et `/fr/symboles/foret` pour un
  raccourcissement ciblé, sans toucher aux URL, canonicals ni expériences
  gelées. Détails : `j34-execution-2026-08-18.md`.

## Actualisation J35 au 18 août 2026 — requêtes exactes ES/IT sur les pages existantes

- Une proposition externe (sept nouvelles URL ES/IT/FR, trois titles à retoucher)
  est vérifiée sur un export GSC de 28 jours. Les chiffres sont exacts ; la
  lecture « CTR 5–10× trop bas » ne l'est pas : la courbe CTR pondérée du site
  est écrasée en ES/IT (ES pos 4-5 : 0,33 %, IT pos 4-5 : 0,90 %) et
  `suenos-de-agua` (1,00 %, pos 5,1), `arbol` (0,58 %, pos 6,7) et `cane`
  (1,58 %, pos 4,6) sont au niveau ou au-dessus. Aucun title n'est retouché ;
  aucune URL n'est créée (cinq des sept auraient doublonné un propriétaire déjà
  en position 2-6 : décisions J26 inondation/loup/feu confirmées).
- Exécuté sur `master` : six H3 égaux aux requêtes et H2 ancrées renommées
  sur `/es/blog/suenos-de-agua` (93 % de ses impressions sont « inundación » ;
  les ancres `#estado`, `#tipos`, `#simbolismo`, `#interpretaciones` font
  16,4 k impressions chacune à 0 clic en liens de saut), deux FAQ ajoutées ;
  scénarios « Lobos que te atacan o te quieren atacar » (`lobo` ES) et « Un
  bambino maschio sconosciuto » (`bambino` IT).
- `/it/simboli/alluvione` est « Explorée, actuellement non indexée », dernier
  crawl le 11 mai, seule référente connue le sitemap, 0 impression en 28 jours
  alors que « acqua in casa / casa allagata » se disperse sur quatre pages
  (dont `casa`, gelée). Décision : `alluvione` devient le propriétaire de ce
  cluster ; scénario renommé « Acqua in casa o casa allagata », `it.modifiedAt`
  rafraîchi, deux liens contextuels depuis l'article IT sur l'eau (qui ne la
  liait jamais). `casa`, `ragno`, `perro` restent gelés jusqu'au 5 septembre.
- Validation : `docs:build` et `docs:check` verts (0 erreur, 0
  avertissement), tests node 88/88, contrat URL inchangé. Aucun crédit
  Ahrefs, changement Rank Tracker ni demande d'indexation. Lecture prévue à
  partir du 16 septembre. Détails : `j35-exact-query-matching-2026-08-18.md`.
