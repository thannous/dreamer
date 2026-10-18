# Validation locale et boucle site — 18 octobre 2026

Intégration : branche `codex/site-ci-performance`, base initiale `9e92fe947`,
puis `401d71579` intégré après les fusions mobiles des autres sessions.
Implémentation du moteur et du serveur : `be47327b8`. Le bloc de preuve de la PR
identifie le commit final vérifié. Publication, builds EAS et fusion restent hors
de ce lot. Le checkout principal et ses six fichiers déjà modifiés sont préservés.

## Comportement implémenté

- Les quatre contrôles type/lint optent pour `parallel: true`. Ils partagent
  une étape et un verrou de machine sous Linux ; chacun conserve son
  environnement, sa durée, son résultat et sa possibilité de réutilisation.
  Les autres étapes sont séquentielles. Un échec bloque l'étape suivante.
- Les types de routes Dreamer/Lucid sont écrits dans un fichier temporaire
  unique puis remplacés atomiquement. Un lecteur ne voit jamais une déclaration
  tronquée. Le SHA256 du moteur est mis à jour dans sa configuration.
- `import/namespace` est désactivé uniquement pour TypeScript, qui vérifie déjà
  ces accès (Deno pour les Edge Functions). JavaScript garde cette règle, et les
  règles du React Compiler sont conservées. Référence :
  [typescript-eslint](https://typescript-eslint.io/troubleshooting/typed-linting/performance/#eslint-plugin-import).
- `npm run docs:dev -- --symbol=tiger --lang=fr` fait une construction complète
  initiale, puis régénère les symboles choisis après modification du seul
  générateur. Toute autre source impose une construction complète. Les événements
  simultanés et reçus pendant une construction sont conservés ensemble. Un
  événement de dossier Windows émis par le bundle généré ne relance plus une
  construction en boucle ; le parcours réel le vérifie.
- Une prévisualisation partielle est explicitement refusée par les contrôles
  globaux jusqu'à une nouvelle construction complète. Les choix de symboles et
  de langues invalides échouent avant écriture, y compris dans le générateur CLI.
- Le contrôle complet a reproduit un défaut préexistant sous Git Windows : GNU
  tar traite `C:\...` comme un hôte distant. La copie de publication choisit
  désormais le tar natif Windows par chemin absolu ; les commandes et gardes de
  publication sont conservées. Les attentes des tests distinguent `USERPROFILE`
  et les capacités POSIX. Corrections : `1cc639f4e`, puis `140bbf49a`.
  Deux tests des gardes de comptes utilisent aussi les chemins natifs Windows
  et réservent leurs assertions de permissions POSIX à Linux (`b785129d3`) ;
  aucun script de compte ni garde de cible n'est modifié.

## Mesures

Windows, Node `24.19.0`, 32 processeurs logiques disponibles. Installation isolée
par `npm ci` selon le lockfile ; les premières tentatives avec les dépendances
incomplètes du checkout principal sont exclues des mesures. ESLint est exécuté
avec `--no-cache`, `TIMING=50`, et `EXPO_OFFLINE=1`. Ce sont des mesures des quatre
contrôles, pas du temps total de `verify:pr` ni d'une CI distante.

Comparaisons répétées sur les mêmes sources `f9806af5a`, sans autre validation
lourde concurrente. Avant : quatre commandes séquentielles et configuration
ESLint initiale de `9e92fe947`. Après : mêmes commandes dans le lot parallèle,
avec la règle redondante retirée. Le cache ESLint est désactivé ; le cache de
fichiers du système est déjà réchauffé.

| Quatre contrôles | Avant | Après |
| --- | ---: | ---: |
| Répétition 1 | 63,05 s | 35,00 s |
| Répétition 2 | 71,38 s | 42,09 s |
| Médiane | **67,21 s** | **38,55 s** |

Gain médian : **42,6 %**. Le reçu canonique est
`repeated-measurements-qualified.json` ; les journaux et exports bruts sont
conservés. La révision réelle est celle du coordinateur de mesure : les exports
sériels bruts avaient conservé une étiquette de base initiale, corrigée
explicitement dans le reçu canonique sans changer les durées ou résultats.

Sur le parcours final du serveur réel : construction initiale 13,86 s,
régénération du tigre FR 148 ms, reconstruction complète après changements
mixtes 14,29 s, puis absence de nouvelle construction non demandée. Les reçus
identifient le commit et les empreintes des sources.
Ces observations ne prédisent pas un gain identique sur une machine à quatre
cœurs et n'incluent pas le délai de regroupement des événements.

## Preuves et limites

Les contrôles isolés ajoutés couvrent des défauts que le navigateur ne peut pas
observer : une déclaration lue pendant son écriture, une preuve de validation
réutilisée sur du code mobile modifié, les signaux de processus et les résultats
individuels d'un lot parallèle. Les assertions du parcours CLI/HTTP couvrent le
comportement visible du serveur et du générateur.

- Moteur Linux : 83 tests réussis, zéro ignoré, dont les six scénarios du
  parallèle (recouvrement réel, environnements distincts, échec et réutilisation,
  signal, lanceur perdu et nettoyage des enfants avant libération du verrou).
- `verify:pr` passe sur `f9806af5a` intégré à `401d71579` : huit contrôles
  exécutés, trois réutilisés, cinq hors périmètre. Les quatre contrôles type/lint
  ont été recalculés après les modifications mobiles amont. Le commit source
  suivant du générateur est vérifié séparément pour constater leur réutilisation ;
  le bloc de preuve final de la PR consigne sa révision et son résultat.
- Les résultats initiaux Windows/POSIX ont été remplacés par la comparaison
  des mêmes cas communs décrite ci-dessous. Les anciens `skip`, filtres SIGQUIT
  et assertions de modes conditionnelles ne constituent plus la couverture.
- Parcours HTTP : page FR modifiée, page EN inchangée en mode ciblé, événements
  de rechargement reçus, contrôle global refusé après prévisualisation partielle,
  reconstruction complète et page EN actualisée après un changement CSS et un
  changement du générateur dans la même fenêtre de regroupement.
- Parcours CLI : sortie ciblée du tigre FR identique octet par octet à la
  génération FR complète ; sélection partiellement invalide et langue inconnue
  refusées sans modifier la page existante.
- Contrôle d'import : une propriété absente échoue toujours en JavaScript via
  ESLint, et en TypeScript via `TS2339`. `react-hooks/static-components` reste
  une erreur.
- Contrats EAS/release mobiles : 192 tests réussis ; versions Dreamer, Lucid et
  Meditation cohérentes. Aucun workflow CircleCI/EAS, profil mobile, manifeste,
  compteur ou lockfile modifié. Aucun build natif ou parcours sur appareil réalisé.
- Contrats CircleCI : classificateur réussi sous Linux et Git Windows, y compris
  le remplacement d'une source mobile par un lien. La fixture construit le mode
  Git `120000` directement, indépendamment des droits de création de liens du
  système. Les 12 tests Python, 360 combinaisons de déclenchement et six tests
  du repli Jest restent les contrôles de non-régression du routage.

Artefacts privés : `.tmp/ci-performance/` dans le checkout de cette branche,
avec les journaux, reçus JSON et commandes de mesure. Reruns :

```sh
npm run test:verify-local
npm run test:tooling:native # Linux, avec flock/setsid
npm run test:file -- scripts/docs-dev.test.ts scripts/lib/docs-check-helpers.test.ts scripts/generate-shared-route-types.test.js scripts/verify-local-config.test.js --runInBand --watchman=false
npm run test:file -- scripts/android-release-smoke-workflow.test.js scripts/check-android-release-ref.test.js scripts/check-android-release-gates.test.js --runInBand --watchman=false
node scripts/mobile-release.js verify --app all
npm run verify:pr
```

Le moteur est portable mais seul Dreamer est modifié ici. Son adoption dans un
autre dépôt nécessite d'y reporter le moteur et ses tests, d'actualiser son pin
et de revérifier sa configuration ; aucune preuve d'un autre dépôt n'est revendiquée.

## Parité des tests communs Windows/Linux

Périmètre : moteur de preuve, publication site/app web, gardes hors réseau des
comptes et prérequis du build Android. L'inventaire des tests du dépôt ne trouve
plus de sélection de cas par `process.platform` dans ces suites communes. Les
tests TI-528 qui demandent un environnement local restent un périmètre distinct,
conditionné à cet environnement et non au système d'exploitation.

Les différences sont injectées aux frontières : exécution de processus, plateforme,
écriture de fichiers. La sélection du shell Windows utilise de vrais arbres de
fichiers et des réponses Git simulées, sans lancer des scripts POSIX portant le
nom `git.exe`. Le superviseur réel est exécuté avec des processus, pipes et horloges
simulés : signaux, perte du parent, délai de grâce, arrêt des descendants puis
libération du verrou. Les tests de publication exécutent Linux/macOS/Windows sur
chaque hôte ; les cas SIGQUIT sont exécutés avec une plateforme POSIX simulée.

Les essais natifs sont conservés dans des fichiers séparés, sans faux succès par
retour anticipé. Le moteur Linux les exécute après les contrats communs ; la suite
native de publication se lance explicitement. Une simulation ne prouve ni les
ACL Windows ni l'exécution native sur macOS.

Les révisions et empreintes des sources comparées figurent dans le reçu du lot.
L'inventaire correspond exactement sur les deux OS, tous les cas passent et aucun
n'est ignoré :

| Suite commune | Windows | Linux |
| --- | ---: | ---: |
| Moteur et plateformes simulées | 153 | 153 |
| Garde de preuve avant publication | 16 | 16 |
| Publication et prérequis Android | 239 | 239 |
| Comptes, sessions et refus hors réseau | 36 | 36 |
| Routage CI Python | 12 | 12 |
| Remplacement atomique et générateurs concurrents | 12 | 12 |
| Total par OS | 468 | 468 |

La qualification native Linux ajoute 14 cas moteur/permissions et 7 cas de
publication, tous réussis. Les 192 contrats de release mobile repassent également ;
les métadonnées des trois applications sont cohérentes. Cette preuve ne remplace
pas une qualification du binaire Android/iOS.

Deux défauts Windows supplémentaires ont été reproduits et corrigés : Python
pouvait lancer le `bash.exe` WSL de System32 et perdre les chemins Windows ; le
test résout maintenant l'exécutable Bash et transmet des chemins portables sur
les deux OS. L'alias Microsoft Store `python3` de cette machine a été remplacé
dans le PATH du run par un shim temporaire vers Python 3.11 déjà installé,
sans changement global. Le run Linux utilise son Python 3 existant.

La contention de remplacement des types a réellement produit `EPERM` sous
Windows, sans lecture partielle. Le remplacement borne son attente cumulée de
reprise à 980 ms et accepte une déclaration complète déjà installée par un pair seulement
si les octets sont identiques. Une erreur persistante reste bloquante. Les mêmes
erreurs transitoires/persistantes sont simulées sur chaque OS. Après correction,
60 tours / 240 générateurs Windows concurrents avec lecteur continu passent.

Artefacts : section moteur de `verify-pr-platform.log` (Windows, runner par défaut),
`platform-common-linux.tap`, `publish-proof-linux.tap`, `auth-{windows,linux}.tap`,
`portable-jest-{windows,linux}.json`, `platform-native-linux.tap`,
`native-publish-linux.json`, `classifier-{windows,linux}.log` et `platform-parity.json`
dans `.tmp/ci-performance/`. Les sources TypeScript des tests de publication sont
transpilées sans changer les cas pour la fixture Linux ; Node `24.19.0` et Jest
`30.5.2` sont identiques sur les deux hôtes. Les modes natifs 0600/0700 sont
vérifiés sous Linux ; aucune connexion réelle ni publication n'est effectuée.
Les journaux `python-contracts-{windows,linux}.log`, `atomic-{windows,linux}.json`
et `atomic-stress-fixed.log` complètent la comparaison.

```sh
node --test scripts/test-verify-local.mjs scripts/test-platform-contracts.mjs
node --test scripts/test-check-site-publish-proof.mjs
node --test scripts/test-test-supabase-guard.mjs scripts/test-test-seed-auth.mjs
npm run test:file -- scripts/web-deploy.test.ts scripts/docs-deploy.test.ts scripts/build-android-release-local.test.js --runInBand --watchman=false
npm run test:file -- scripts/generate-shared-route-types.test.js scripts/lib/replace-file.test.js --runInBand --watchman=false
python3 .circleci/tests/shared-build-impact.test.py -v
bash .circleci/tests/classify-changes.test.sh
```

## Audit des CI des applications mobiles

État constaté dans ce checkout : `noctalia-quality` couvre Dreamer et Lucid,
`meditation-quality` couvre le package Meditation. Les parcours `testerarmy-web`
valident les versions navigateur de ces produits ; ils ne constituent pas une
preuve Android/iOS native. Deux workflows EAS Android, smoke et qualification,
restent manuels avec une identité de tag contrôlée. Aucun workflow iOS natif n'est
présent dans ce checkout. Aucun lancement distant ni build payant n'a été demandé.
Les API GitHub de statut/checks du master consulté ne donnent pas de mesure
CircleCI récente ; les durées historiques du guide ne sont pas une baseline actuelle.

| Priorité | Observation et changement proposé | Validation avant généralisation |
| --- | --- | --- |
| 1 | Les quatre contrôles communs profitent déjà du parallèle local et de la réutilisation ; le benchmark précédent est local, sur 32 processeurs logiques. `noctalia-quality` les lance encore en série sur un conteneur `medium` à deux vCPU. | Comparer série/parallèle sur ce même conteneur, avec pic mémoire, puis sur une classe plus grande seulement avec autorisation du coût. Conserver chaque code de sortie et l'arrêt de l'étape suivante. Aucun gain distant chiffré aujourd'hui. |
| 1 | Les 8 shards Dreamer, 3 contextes secondaires, Lucid et Meditation réinstallent chacun `tools/e2e`. Le cache npm racine est sauvé avant ces installations et aucune clé propre au lockfile E2E n'existe. Ajouter un cache du store npm E2E, indexé par Node et `tools/e2e/package-lock.json`, avec un seul écrivain. | Deux lancements manuels comparables : froid/chaud, temps d'installation, transferts et union exacte des IDs de parcours. Garder `npm ci` et les lockfiles. Le collecteur a aussi cette installation à mesurer. |
| 2 | Chaque conteneur installe Chromium et ses dépendances Linux. Une image de test contenant les versions verrouillées du navigateur et de Node pourrait réduire cette préparation répétée. | Comparer préparation/transfert et vérifier la version effective de Chromium ; ne pas ajouter aveuglément un cache navigateur. Playwright déconseille ce cache quand sa restauration coûte autant que le téléchargement et ne couvre pas les paquets système. |
| 2 | Chaque shard reconstruit son bundle Metro. La réutilisation des transforms est déjà présente. Étudier un bundle produit une fois par produit/contexte, transmis aux shards par workspace. | Mesurer la part Metro restante et prouver que l'exécution depuis cet export garde les mêmes services mock, variables, contextes et assertions. Aucun bundle commun à des contextes différents sans preuve d'équivalence. |
| 2 | Le runner Android local impose `:app:clean`, `--no-build-cache` et `--no-daemon` : chaque itération repart à froid. Préparer un mode d'itération incrémental explicite, séparé de la qualification Release actuelle. | Comparer deux changements représentatifs ; invalider sur profil, ABI, dépendances, entrées natives et environnement. Garder l'identification du binaire, la signature et les verrous d'appareil. Ne pas changer silencieusement le mode Release. |
| 3 | Aucun cache C/C++ explicite dans les profils EAS. EAS propose aujourd'hui `EAS_USE_CACHE`/ccache et les étapes `restore_build_cache`/`save_build_cache`. | Pilote preview autorisé avec un seul profil, mesures avant/après et identité de build ; décider séparément pour production, notamment si le compte de build est partagé. Les caches npm/Maven EAS sont déjà fournis par le service. |

La sélection par chemins garde un repli complet pour les fichiers inconnus,
supprimés, renommés ou partagés. Une future séparation Dreamer/Lucid nécessitera
un graphe de dépendances testé ; le flag Noctalia commun reste conservateur.
Les déclencheurs manuels, gardes de publication et de release, couverture native,
profils, compteurs et budgets ne sont pas modifiés par cet audit.

Références officielles consultées : [caches CircleCI](https://circleci.com/docs/guides/optimize/caching/),
[caches EAS](https://docs.expo.dev/build-reference/caching/),
[navigateurs Playwright en CI](https://playwright.dev/docs/ci#caching-browsers).
