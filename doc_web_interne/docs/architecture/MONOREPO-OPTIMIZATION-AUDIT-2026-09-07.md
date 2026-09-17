# Noctalia — audit et plan progressif du monorepo

Audit du 7 septembre 2026. Proposition pour discussion, pas une décision d'architecture acceptée. Aucun code produit, pipeline, réglage fournisseur, identifiant natif ou environnement de production modifié. Aucun commit, push ou déploiement effectué.

## 1. Recommandation

Conserver le monorepo et viser trois applications autonomes sous Noctalia. Commencer par les déclenchements et le calcul des images du site, où le gaspillage est observable. Séparer ensuite les dépendances du site, puis les graphes applicatifs Journal/Lucid. Introduire les workspaces après préparation des versions natives et des frontières ; ne pas cumuler déplacement de dossiers, changement de gestionnaire de paquets et migration RevenueCat dans un même lot.

La marque commune porte le langage et des primitives visuelles. Chaque application conserve sa promesse, ses données, son état, ses droits et sa livraison. Le contrat du lot B décrit Journal, Lucid et Meditation comme des noms de travail, sans autoriser de renommage public ni de changement de domaine.

## 2. Périmètre et état vérifié

- Worktree isolé : `/Users/tanuki/.codex/worktrees/0f55/dreamer`, initialement propre, HEAD détachée `795878a76881732fd1f9c449b679839667bb2089`.
- `git ls-remote origin refs/heads/master` confirme ce même SHA ; aucun déplacement de branche ni fetch nécessaire pour comparer les objets déjà présents.
- [PR #114](https://github.com/thannous/dreamer/pull/114), tête initialement auditée `70336985fe13c3fbca61cdce7753d80f65a429cd` : Cloudflare, encore en cours au début, est passé SUCCESS à **01:09:44 UTC / 03:09:44 Paris**, avec CircleCI et statuts Vercel verts sur ce SHA. Sa fusion reste gérée dans la tâche d'origine.
- **Actualisation finale à 01:16 UTC / 03:16 Paris** : la PR est toujours ouverte, mais sa tête est devenue `49cfe2b2941ecc455f6b586fd3b17d511eb288cf`. CircleCI qualité et Cloudflare sont de nouveau en cours ; classification et statuts Vercel sont verts. Le delta depuis `70336985` porte sur 11 fichiers Lucid (+204 / −13), sans changement de `.circleci`, manifest ou configuration Vercel. Les chiffres, replays et observations d'autonomie détaillées de ce rapport restent attachés à `70336985` ; ils ne qualifient pas les nouvelles corrections produit. Le master distant reste `795878a7`.
- Comparaison immuable master → tête auditée `70336985` : 57 fichiers, +1 712 / −317 lignes. Aucun lockfile modifié. L'audit distingue donc le master actuel et le lot B en attente de fusion.
- Projet Cloudflare `noctalia` : production sur `master`, racine du dépôt, `npm run docs:build && npm run docs:check`, sortie `docs`. Déploiement canonique au moment de lecture : `09e372b1-6244-4337-b7b5-2f468bbe0374`, SHA `795878a7`. Ceci prouve l'association fournisseur/SHA, pas un nouveau contrôle HTTP du site public.
- Le connecteur Vercel retrouve l'équipe mais retourne une liste de projets vide et des 404 sur le projet/déploiement attendu. Le statut GitHub SUCCESS est vérifié ; le détail « build exécuté ou ignoré », les durées, domaines et réglages Vercel live restent **non vérifiés par cet audit**. L'hébergement de l'ancienne application web sur Vercel est le contexte fourni par l'utilisateur.

Sources live : `gh pr view 114 --repo thannous/dreamer --json ...`, `git ls-remote`, API CircleCI v1.1 par numéro de job, API Cloudflare Pages GET project/deployments/history/logs. Les lectures ne contiennent ici ni secrets ni données utilisateur.

## 3. Organisation et couplages actuels

| Domaine | Faits vérifiés | Conséquence |
| --- | --- | --- |
| Journal + Lucid | Package racine, `expo-router/entry`, routes `app/` et `app/lucid/`, mêmes dépendances installées | Identités natives distinctes possibles, mais graphe de build partagé |
| Meditation | `apps/meditation/` possède manifest, lockfile, Metro, TS, Jest et EAS | Autonomie d'installation déjà réelle ; ne pas la perdre avec un hoisting aveugle |
| Site marketing | Sources `docs-src/`, générateurs `scripts/`, contenus partagés `data/`, dépendances dans le manifest racine | Un changement de dépendance mobile peut affecter installation, validation et build du site |
| Site interne | Troisième package dans `doc_web_interne/docs/`, trois dépendances de développement, Tailwind 3 | Ce package n'est pas le générateur marketing ; statut d'usage à clarifier avant archivage |
| Backend | Historique Supabase partagé, tables/RLS Lucid propres, contrats Node et fonctions Deno | L'autonomie des applications ne demande pas de scinder la base ni de dupliquer les comptes |

Inventaire des manifests : racine **69 dépendances + 33 devDependencies**, Meditation **40 + 12**, package interne **3 devDependencies**. Aucun workspace npm/pnpm/Yarn/Bun ni Turborepo déclaré. Racine et Meditation partagent 36 noms de dépendances runtime et 10 de développement ; ce n'est pas une mesure du nombre d'octets déduplicables.

Exemples de divergences déclarées : Expo `~57.0.17` / `~57.0.15`, React Native `0.86.3` / `0.86.2`, RevenueCat `^9.6.7` / `^10.7.1`. React `19.2.3` est commun. Les lockfiles résolvent notamment RevenueCat `9.15.2` / `10.7.1`. Aligner ces versions relève d'une qualification applicative, particulièrement pour les achats.

Inventaire de fichiers suivis, somme des tailles locales non compressées : **5 643 fichiers / environ 351,5 Mo**, dont `docs-src/` **3 059 / 239,0 Mo** et Meditation **368 / 10,94 Mo**. Ces valeurs ne mesurent ni un clone compressé, ni le bundle, ni l'archive EAS. Elles justifient d'inspecter les entrées d'archives, pas de réécrire l'historique Git ou d'adopter LFS immédiatement.

Points précis d'autonomie :

- `app.config.ts:153` configure déjà l'identité Lucid ; `:236` documente Google Sign-In encore autolinké via les dépendances communes. `:244` neutralise les clés RevenueCat héritées. Une factorisation de marque ne doit pas réintroduire ces paramètres commerciaux.
- Au master, `app/_layout.tsx:729` monte le provider Journal. Le lot B conditionne sa composition (`JournalRuntime`) et protège les routes : progrès fonctionnel réel, sans preuve de réduction du bundle ou de l'autolinking.
- `services/lucidTrainerStorage.ts:38` et `:127` définissent namespace/version/scopes Lucid. Les migrations Lucid possèdent leurs politiques d'accès ; un compte commun n'autorise pas un transfert de récits.
- `metro.config.js:10` exclut actuellement Meditation pour éviter des collisions. Toute adoption de workspaces doit requalifier cette résolution.
- Le contrôle AST du lot B bloque certaines dépendances directes. Il ne calcule pas une fermeture transitive complète et ne démontre pas à lui seul l'absence de code Journal dans un binaire Lucid.
- Meditation garde un fonctionnement local et des profils EAS sans comptes/abonnements activés. Mutualiser aujourd'hui les providers d'auth, de paiement ou de lecture audio élargirait inutilement son runtime.

## 4. Mesures CI et déploiement

Mesures d'un même SHA, `70336985`, via les jobs CircleCI réussis. Les temps de steps ne sont pas tous strictement additifs au temps total du job.

| Job / étape | Durée observée |
| --- | ---: |
| [481 — classify-and-continue](https://circleci.com/gh/thannous/dreamer/481) | 15,45 s |
| [482 — noctalia-quality](https://circleci.com/gh/thannous/dreamer/482) | 278,51 s |
| Restauration cache / installation racine | 3,34 s / 42,50 s |
| Typecheck app / tests | 26,68 s / 21,97 s |
| Lint général / scripts strict | 80,58 s / 3,16 s |
| Jest sélectionné depuis la base | 80,70 s |
| [483 — meditation-quality](https://circleci.com/gh/thannous/dreamer/483) | 131,40 s |
| Restauration cache / installation Meditation | 3,40 s / 25,54 s |
| Typecheck / lint / Jest Meditation | 6,91 s / 13,98 s / 69,62 s |

Ce n'est pas une baseline p50/p95. À titre de variabilité, le job Noctalia 478, sur un autre diff, prend 163,05 s : seulement 8,05 s de tests sélectionnés mais 66,23 s de lint. Ne pas comparer deux durées de tests sans comparer le portefeuille exécuté.

Cloudflare final pour la PR : déploiement `22547e0b-bc36-46d1-a75e-31f08486c9aa`, **211 s de queue, 12 s de clone, 657 s de build, 10 s de déploiement**. Le build englobe installation et commande utilisateur. Les trois previews antérieures du lot B terminées dans l'échantillon prennent 595, 622 et 656 s de build. Ce sont des observations, pas une projection mensuelle de dépenses.

Décomposition des logs de production `09e372b1`, au SHA master :

| Segment | Fenêtre UTC | Observation |
| --- | --- | --- |
| Installation npm | 22:48:59 → 22:50:01 | ~62 s ; 1 840 packages ajoutés |
| Images SEO | 22:50:03 → 22:58:08 | ~485 s ; 340 variantes régénérées, 290 déjà à jour |
| Images symboles responsives | 22:58:08 → 22:59:18 | ~70 s ; boucle de 640 variantes |
| Build total fournisseur | 22:48:44 → 22:59:53 | ~669 s |

La génération SEO seule représente environ **72 %** de cette étape fournisseur. Le build d'images est donc prioritaire par rapport à un simple changement de cache npm. Les horodatages de logs bornent ces segments ; ce ne sont pas des profils CPU.

## 5. Pourquoi des builds inutiles subsistent

**Cloudflare reçoit chaque changement.** L'API confirme `preview_deployment_setting=all`, `preview_branch_includes=["*"]`, `path_includes=["*"]`, aucun chemin exclu. La sélection CircleCI ne contrôle pas l'intégration Git Cloudflare. `docs-src/config/cloudflare-pages.json` documente commande et branche, sans porter aujourd'hui ces filtres.

**Les dates des images rendent le recalcul fragile.** `scripts/generate-image-seo-assets.js:176-205` considère un dérivé frais si son mtime est postérieur aux configurations et au master. `scripts/generate-symbol-responsive-images.js:144-158` utilise aussi les mtimes. Un checkout Git ne préserve pas les dates historiques ; elles ne prouvent pas l'identité des entrées. La régénération massive est observée ; l'explication précise de chaque invalidation Cloudflare demanderait un log des raisons ou une reproduction instrumentée. Autre limite statique : ces predicates n'incluent pas directement le code du générateur ni la version d'encodeur, donc peuvent aussi conserver un résultat devenu obsolète.

**Le site installe le graphe mobile.** `site-build`, `edge-functions` et `edge-contracts` appellent l'installation racine. L'Edge utilise notamment Expo pour le lint. Avec tous les gates sélectionnés, quatre jobs installent la racine et un Meditation ; le cache npm évite des téléchargements, pas ces installations.

**La CI conservatrice est en partie nécessaire.** Une suppression, un renommage ou chemin inconnu élargit la sélection ; un diff inexploitable exécute aussi Jest complet. Les données de symboles, la curation, certains contrats d'analytics et le verrou d'appareil ont plusieurs consommateurs. Les retirer d'un filtre sans substitut crée de la couverture manquante.

Le lot B réduit déjà cette propagation. Rejeu local du même diff master → `70336985`, sans modifier la PR :

| Classificateur exécuté | Noctalia | Meditation | Site | Edge | Contrats DB |
| --- | --- | --- | --- | --- | --- |
| Master | oui | oui | oui | oui | oui |
| PR114 | oui | oui | non | non | non |

Le résultat correspond aux deux jobs qualité live de la PR. Sa table `dependency-consumers.tsv` comprend aussi correctement les fonctions Edge comme consommatrices de l'installation racine.

**Un simple filtre Cloudflare ne suffira pas pour cette PR précise.** Elle touche `package.json`. Une liste sûre de chemins doit encore inclure ce fichier tant que le site consomme son installation. Pour distinguer un script mobile d'une dépendance partagée, il faut une classification sémantique avant le build, ou extraire réellement le package site. Ne pas exclure le manifest racine pour obtenir artificiellement zéro build.

**Vercel a un autre contrat.** Le `vercel.json` du lot B ignore les previews par `VERCEL_ENV`, et laisse les autres environnements construire. Il ne filtre pas les changements de production selon les consommateurs. Ce fichier n'est pas encore dans le master audité. Un statut SUCCESS ne prouve pas une compilation ; les builds annulés par Ignored Build Step peuvent encore occuper des slots. Le mécanisme natif « skip unaffected projects » requiert des workspaces et des dépendances déclarées, absents actuellement.

## 6. Cible proposée et choix de gestionnaire

```text
apps/
  journal/       # routes, providers, stockage et configuration Journal
  lucid/         # routes, observations, entraînement et configuration Lucid
  meditation/    # package existant, lecture et état propres
  site/          # outils/manifest marketing ; sources déplacées ultérieurement
packages/
  brand-tokens/  # couleurs sémantiques/typo, sans état métier ni droits
  contracts/     # formats et schémas explicitement partagés
  dream-content/ # catalogues réellement consommés par Journal et site
tooling/         # futurs outils communs, dont sélection CI
supabase/        # backend et migrations conservés ensemble
```

Cette arborescence est une cible, pas un déplacement à exécuter en bloc. Conserver `docs-src/` et la sortie ignorée `docs/` durant le découplage du package site. Ne créer un package supplémentaire que lorsqu'il a plusieurs consommateurs vérifiés ; éviter un grand `shared` ou `core` fourre-tout. Un package UI React Native commun éventuel utilisera des peerDependencies pour React/RN et laissera les thèmes/contextes produit dans les apps.

Préférence initiale : **npm workspaces**, pour conserver le gestionnaire et limiter le nombre de changements. D'abord aligner et qualifier React Native/Expo là où nécessaire, rendre toutes les dépendances directes explicites, puis adopter un lockfile d'installation unique dans un lot dédié. Tant que cette condition n'est pas satisfaite, conserver les installations séparées plutôt que prétendre que plusieurs lockfiles imbriqués sont tous actifs dans un même `npm ci` de workspace.

pnpm reste une alternative si des mesures d'installation/espace le justifient ; Expo supporte les installations isolées mais toutes les bibliothèques natives ne les tolèrent pas. Aucun gain garanti par le nom du gestionnaire. Turborepo/Nx est une étape optionnelle après existence d'un graphe de tâches correct ; la configuration dynamique CircleCI répond déjà à la sélection grossière.

## 7. Lots priorisés et critères d'acceptation

Tailles relatives : S = changement circonscrit ; M = plusieurs outils/contrats ; L = migration native. Ce ne sont pas des engagements calendaires. Chaque lot se valide et se revient indépendamment.

| Priorité / lot | Action proposée | Gain attendu, à mesurer | Risque et validation |
| --- | --- | --- | --- |
| P0-A / S–M | Documenter le graphe des entrées site et préparer les watch paths Cloudflare ; mesurer en simulation les derniers diffs | Supprimer les builds sur changements strictement sans consommateur site | Garder manifests, Node, scripts et contenus partagés ; zéro faux négatif sur ajouts/suppressions/renommages et cas inconnus ; snapshot fournisseur avant tout changement autorisé |
| P0-B / M | Remplacer les predicates mtime par une empreinte des sources, paramètres, générateur, fontes et encodeur ; réutiliser les dérivés valides | Attaquer les ~485 s SEO et ~70 s symboles observés | Vérifier dérivés existants et empreinte de sortie ; reconstruire sur absence/corruption/changement ; deux checkouts frais identiques doivent éviter les encodages tout en passant docs:check |
| P1-A / M | Donner au site son package d'outillage et ses dépendances explicites ; garder les sources à leur emplacement initial | Installation plus petite et suppression du couplage aux dépendances mobiles | Build depuis environnement propre sans dépendances racine implicites ; mêmes URLs, canonicals, hreflang, fichiers, tailles et contrats de contenu |
| P1-B / M | Étendre le registre des consommateurs aux outils, lectures de fichiers et tests de contrats ; préparer le graphe inverse des tests | Moins de gates globaux sur outils clairement attribués ; aucune perte de consommateurs | Rejouer un corpus de diffs et comparer sélection/portefeuille à une exécution complète ; conserver le repli large pour l'inconnu |
| P1-C / S–M | Mesurer puis ajuster lint, Jest et cache sur 20–30 pipelines comparables | Réduire surtout le lint global et les répétitions ; éviter d'ajouter de l'installation avec trop de jobs | Cache lint par contenu/config/toolchain testé à froid et à chaud ; mêmes diagnostics ; p50/p95 et minutes-machine, pas uniquement temps du chemin critique |
| P2-A / M | Préparer tokens/contrats/contenus partagés puis workspaces ; alignement natif qualifié séparément | Frontières explicites et installation reproductible | Une seule résolution React/RN attendue, autolinking et tests de chaque consommateur ; ne pas forcer un changement RevenueCat dans ce lot |
| P2-B / L | Extraire Lucid vers `apps/lucid` après le lot B | Bundle, modules natifs et livraison autonomes ; gain de taille/démarrage encore inconnu | Config native/EAS/OTA inchangée, données conservées après upgrade, preuves de routes/modules exclus, QA native indépendante au SHA |
| P2-C / L | Déplacer Journal vers `apps/journal` ; racine dédiée à l'orchestration | Suppression du rôle ambigu du package racine | Tous les scripts, chemins assets, Metro, TS, Jest, EAS et CI fonctionnent depuis les nouvelles racines |
| P3 / M | Évaluer cache de tâches et production d'un artefact site unique réutilisable ; traiter le web historique Vercel | Éviter des calculs identiques sur un même SHA | Décider le propriétaire de publication ; artefact lié au SHA et aux entrées ; ne pas supprimer une validation pré-merge tant que Pages déploie directement sur push |

P0-A et P0-B sont indépendants. P1-A peut précéder la migration mobile. P2-B dépend de l'acceptation du lot B et des frontières ; P2-C suit l'extraction Lucid. Les modifications fournisseur, déploiements et builds natifs restent de futurs travaux avec leur autorisation propre.

Pour les watch paths, commencer par une matrice lisible et conservatrice couvrant au moins `docs-src/*`, `data/*`, les scripts site et leurs bibliothèques, `package.json`, `package-lock.json`, `.nvmrc` et toute configuration d'installation/build effectivement consommée. Ce n'est pas une allowlist exhaustive approuvée : les lectures dynamiques doivent être inventoriées avant application. Les règles fournisseur diffèrent du shell ; Cloudflare inclut des replis automatiques sur gros pushes.

Pour P0-B, deux options restent à chiffrer : dérivés suivis + manifeste d'empreintes, ou cache de dérivés récupéré par empreinte. Le dépôt suit déjà de nombreux dérivés : vérifier leur fraîcheur avant de choisir. Le cache natif Pages documente npm et certains frameworks ; il ne faut pas supposer qu'il persiste arbitrairement le répertoire de ce générateur maison. Sans sortie réutilisable, une empreinte seule ne réduit pas un premier build à froid.

## 8. Politique CI cible sans sacrifier les consommateurs

| Changement | Validation cible |
| --- | --- |
| Routes/état Journal | Journal + contrats/consommateurs identifiés ; aujourd'hui gate racine Journal/Lucid |
| Domaine Lucid | Lucid + ponts explicites ; aujourd'hui gate racine |
| Meditation | Meditation ; autres gates seulement pour une dépendance réelle |
| Tokens communs | Tests du package + toutes les apps qui les importent ; site uniquement s'il les consomme |
| Catalogue de rêves | Journal + site et tout futur consommateur déclaré |
| Auth/contrat partagé | Tests de contrat + intégrations des applications réellement concernées |
| Script de verrou appareil | Journal/Lucid + Meditation, comme le registre B |
| Migration / fonctions Edge | Deno, contrats Node pertinents et compatibilité consommateurs ; pas un déploiement automatique |
| Manifest/lock commun | Tous les consommateurs dont l'installation ou tâche change ; repli large si l'analyse n'est pas fiable |
| Documentation interne seule | Classification/no-op ; aucune génération produit |
| Inconnu, diff inexploitable | Repli conservateur ; suite complète pour base inexploitable, selon le contrat actuel |

Jest `--changedSince` n'est pas un graphe universel : les tests qui lisent des migrations, JSON, `.easignore` ou fichiers de configuration via `fs` peuvent nécessiter une liste explicite de dépendances. `--passWithNoTests` doit être accompagné d'un portefeuille attendu pour les changements de configuration partagés. Conserver une comparaison complète pour releases et validations de migration, et proposer une exécution complète périodique dédiée ; aucun scheduler n'est créé ici.

Caches actuels à conserver d'abord : `.npm` avec checksum du lockfile, séparation Meditation, cache Deno versionné. Pas de cache `node_modules` à restaurer avant `npm ci`, qui le nettoie. Pas de workspace transféré sans consommateur mesuré. Le cache Jest avec `epoch` contient un historique de baseline, pas des dépendances : ne pas le remplacer mécaniquement par un checksum de lockfile. Contrôler plutôt fraîcheur, toolchain, portefeuille et politique d'absence ; la configuration actuelle autorise explicitement une baseline absente.

La double exécution site CircleCI/Cloudflare fournit aujourd'hui deux preuves distinctes : validation CI et publication. Chercher une production unique d'artefact n'autorise pas à supprimer le gate CI avant d'avoir défini la promotion, l'intégrité et l'identité exacte du SHA déployé.

## 9. Validation et limites de l'audit

Exécuté ici : inventaire Git/manifests/configurations, lectures live ci-dessus, test existant `bash .circleci/tests/classify-changes.test.sh` **PASS**, rejeu comparatif du classificateur master et PR sur le diff réel **PASS** avec paramètres attendus. Les scripts de la PR ont été extraits dans un répertoire temporaire ; aucun checkout ou fichier de la PR modifié.

Pas d'installation de dépendances ni de build produit lancé. Une tentative de charger le module du générateur pour compter localement ses invalidations s'arrête sur `Cannot find module 'sharp'` dans ce worktree sans installation ; aucun comptage local par variante n'est revendiqué. Les timings d'images viennent des logs fournisseur. Les suites applicatives complètes, les exports comparés, les bundles natifs, la QA appareil, les caches live Vercel/Pages et les coûts mensuels ne sont pas mesurés ici.

Avant acceptation d'une migration : conserver package/bundle IDs, schémas, domaines de liens, EAS project IDs, versions, politique OTA, scopes de stockage et identités d'achats. Tester upgrade sans effacer les données, auth/déconnexion, achats/restauration, liens entrants, écoute et notifications pour chaque produit. Attribuer les preuves locales, CI, binaires, appareil, Store et production séparément.

Prochaine décision proposée : engager P0-A/P0-B en lots séparés, puis P1-A. Le choix de workspace et l'extraction Lucid restent à arbitrer sur les mesures et la qualification native ; aucun gain en euros, taille de bundle ou démarrage n'est encore défendable.

## 10. Références techniques consultées

- [Cloudflare Pages — build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/) : chemins inclus/exclus et replis sur pushes volumineux.
- [Cloudflare Pages — build caching](https://developers.cloudflare.com/pages/configuration/build-caching/) : répertoires npm/frameworks pris en charge.
- [Vercel — monorepos](https://vercel.com/docs/monorepos) : dépendances déclarées, workspaces, différence entre skip et Ignored Build Step.
- [Expo — monorepos](https://docs.expo.dev/guides/monorepos/) : résolution automatique, installations isolées et incompatibilités de modules natifs dupliqués.
- [CircleCI — caching](https://circleci.com/docs/guides/optimize/caching/) et [dynamic configuration](https://circleci.com/docs/guides/orchestrate/using-dynamic-configuration/) : maintien du modèle dynamique existant.
- Sources de code : `.circleci/{config.yml,continue.yml,scripts/classify-changes.sh}`, `scripts/{docs-build.js,run-jest-changed.js,check-jest-duration-regression.js}`, les manifests et configurations Metro/EAS de chaque app. Pour le lot B : [arbre immuable 70336985](https://github.com/thannous/dreamer/tree/70336985fe13c3fbca61cdce7753d80f65a429cd), ses ADR d'autonomie/frontières et `specs/noctalia-brand-contract.md`.
