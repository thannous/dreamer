# Builds Android et démarrage Metro — 18 octobre 2026

Suite de l'[audit CI/site](https://github.com/thannous/dreamer/blob/c0de9eae92b0f4c43220ca07cf690955dc2419c5/doc_web_interne/docs/qa/site-ci-performance-2026-10-18.md).
Les mesures brutes et identifiants des rapports sont dans le
[reçu JSON](mobile-ci-android-metro-2026-10-18.json). Mesures locales,
pas des durées CircleCI ou EAS. Aucun build EAS, déploiement, téléchargement
d'application sur appareil ou changement de données utilisateur.

## Comportement livré

`npm run android:iterate:local -- --abi <ABI>` produit un APK `-iteration.apk`.
Le premier passage, un échec/interruption, un état corrompu ou des entrées
incompatibles imposent une génération native et un build propres. Seul un état
passé correspondant aux fichiers natifs, plugins, patches, versions, manifestes,
ABI, profil et environnement effectif permet `prebuild --no-clean`, sans
`:app:clean`, avec le cache et le daemon Gradle. Un changement inattendu de la
sortie de prebuild déclenche aussi une régénération propre. Un verrou par
checkout et une écriture atomique protègent cet état.

Le bundle JS/assets est toujours régénéré avec
`:app:createBundleReleaseJsAndAssets --rerun` : les entrées déclarées par
React Native couvrent les fichiers JS/TS, sans couvrir tous les assets seuls.
La compilation native reste réutilisable. RN Gradle conserve son option
`--reset-cache` pour l'export natif ; les gains Metro ci-dessous concernent
le démarrage de la validation web, pas cet export Android.
Voir l'[option Gradle par tâche](https://docs.gradle.org/current/userguide/command_line_interface.html#sec:rerun_tasks).

`android:release:local` conserve ses paramètres de qualification : génération
native propre, `:app:clean`, `--no-build-cache`, `--no-daemon`, un seul ABI et
Kotlin dans le processus Gradle. `--incremental` ne se combine pas avec
`--reuse-native-project` et est refusé par le descripteur de preuve TesterArmy
Release. Les gardes d'identité, d'installation, de signature et d'appareil
restent en place. Le lancement des commandes et d'`apkanalyzer.bat` utilise le
même lanceur portable. Le patch Expo transporte son argument JSON en base64
sur tous les OS, évitant la perte des guillemets sous Windows.

Dreamer et Lucid conservent leurs transformations Metro par défaut ;
`E2E_KEEP_METRO_CACHE=0` demande une purge. La clé inclut les entrées publiques,
les variantes natives/router et le choix effectif du stub RevenueCat.
La sonde `/status` attend le serveur, puis chaque parcours ouvre et vérifie
l'interface. Meditation garde sa purge. Le replay SDK reste `off`, avec
zéro retry et les mêmes budgets et sélections de tests. Le serveur devient un
enfant Node direct du SDK, à partir du script déclaré dans `package.json` :
le wrapper `node --run` laissait un serveur Metro vivant après arrêt sous Windows.
Les syntaxes shell non prises en charge échouent avant tout lancement.

Les métadonnées exactes de session WSL, de commande Codex et les libellés npm
sont ignorés dans l'empreinte sur tous les OS. Les variables inconnues de build
restent invalidantes. Deux invocations indépendantes ont retrouvé la même
empreinte sur chaque OS ; aucun secret ni hash individuel d'environnement
n'est conservé dans le reçu suivi.

## Mesures Android

Une paire par OS, après préparation des dépendances et du SDK privé, sur la
révision `5509cfa90e04fc12ba3f005ba470ef4908320411`. Pour une même modification
JavaScript : passage incrémental, puis référence propre avec exactement les
mêmes sources, profil, environnement et outils. Les amorçages, téléchargements
et essais échoués de préparation sont exclus. Ce sont deux comparaisons locales,
pas une médiane de trois builds ni une promesse de durée en CI hébergée.

| Build Android, même modification JS | Windows | Linux / WSL2 |
| --- | ---: | ---: |
| Référence propre → incrémental | 485,564 → 88,842 s (−81,7 %) | 278,879 → 66,249 s (−76,2 %) |
| Deux autres modifications JS, incrémental | 77,456 / 76,012 s | 51,801 / 49,374 s |
| Modification d'asset seule, incrémental | 234,890 s | 133,602 s |
| Changement natif `--profileable`, repli propre | 497,518 s | 302,689 s |

Sur chaque paire, les 1 266 entrées de code/ressources des APK sont identiques ;
seule `assets/app.manifest` diffère, par ses champs `id` et `commitTime`.
Les deux signatures sont valides et utilisent le même certificat. Chaque
modification JS possède son marqueur exact dans le bundle. Le contrôle d'asset
vérifie le SHA-256 exact de la police modifiée dans `res/eX.ttf`, puis restaure
le fichier. Le changement natif vérifie le repli propre et le manifeste réel :
package QA `com.tanuki75.noctalia.qa`, version 3.6.0, build 83, profileable,
non debuggable, ABI x86_64. Aucun APK n'a été installé. Le coût du traitement
des ressources explique que le gain JS ne s'applique pas à tous les changements.

Outils : Node 24.19.0, Temurin JDK 17.0.20.1+1, NDK 27.1.12297006, CMake
3.22.1, [Ninja 1.13.2](https://github.com/ninja-build/ninja/releases/tag/v1.13.2),
quatre workers Gradle au maximum, parallélisme de projets désactivé. Les hashes
des archives Ninja officielles sont dans le reçu. Le SDK partagé n'a pas été
modifié. Sous Windows, les premiers essais ont identifié Ninja 1.10.2 sans
prise en charge des longs chemins, le lancement `.cmd` et l'argument JSON Expo :
la référence propre mesurée bénéficie des mêmes corrections que l'incrémental.

Reproduction dans un checkout natif isolé avec ses propres dépendances, JDK/SDK
et `GRADLE_USER_HOME` : amorcer avec
`npm run android:release:local -- --abi x86_64 --side-by-side-qa`, modifier une
source JS en y ajoutant un marqueur, puis chronométrer
`npm run android:iterate:local -- --abi x86_64 --side-by-side-qa` et, sans changer
ces sources, la commande propre précédente. Archiver les APK avant écrasement,
comparer les hashes des entrées ZIP décompressées et vérifier les signatures.
Répéter les contrôles de fraîcheur JS, asset seul et `--profileable`, restaurer
les fixtures. Les commandes exactes et hashes sont dans le reçu ; les journaux,
scripts de mesure et APK restent dans les dossiers ignorés du benchmark.

## Mesures Metro

Trois paires alternées : purge explicite puis conservation par défaut, six
parcours Lucid complets par exécution, un worker, Chromium headless, services
mockés et cache temporaire réservé à la série. Les deux modes utilisent la
même configuration `/status` : la comparaison isole la conservation du cache ;
le gain de la nouvelle sonde n'est pas mesuré séparément.

| Mesure, médiane de 3 | Windows | Linux / WSL2 |
| --- | ---: | ---: |
| Premier bundle web, purge → conservation | 12,399 → 1,559 s (−87,4 %) | 7,966 → 1,785 s (−77,6 %) |
| Commande complète, six parcours | 83,309 → 69,854 s (−16,1 %) | 79,988 → 60,465 s (−24,4 %) |

Durées complètes, en ms : Windows avant `[102447, 71930, 83309]`, après
`[73098, 69854, 61447]` ; Linux avant `[71428, 79988, 83848]`, après
`[61963, 59917, 60465]`. Le premier démarrage d'un nouveau profil reste froid.
La dispersion et les travaux d'amorçage Android concurrents limitent la
précision de ces mesures de poste partagé. Les OS ne sont pas comparés entre
eux : Windows expose 32 processeurs logiques, WSL2 en expose 24.

Les 12 rapports ont chacun 6 tests découverts, sélectionnés, exécutés et passés,
0 échec, interruption, flaky ou skip. Ils ont le même digest d'identifiants
`8b54defcc0bc42780c44924437763694b4b9aedce809f26d2b56636359ada3c4`
et le même digest de séquence API/statut
`08950f3d348983285dedde4eebd25ed56da692f0ab0374949632ec58366e9f63`.
Les assertions source sont inchangées.

Révisions chronométrées : Windows `74cf4a32890da25f9da1c3c17c1097043bf4642f`,
Linux `19ba5fde71740b111d97c34f59ad8c56c554a2a1`. Les blobs pertinents sont
identiques entre ces révisions : `metro.config.js`
`e0607551eefa17ca2e96f22969ba4049e86b046f`, configuration E2E mesurée
`62bb1e2dc065c5ca0334228682c30efc2593c910`, parcours Lucid
`9f6f88a7b1e3a3fcf7ce2628fe4a9a8782f8b7dd`. Le correctif ultérieur de propriété
du PID modifie cette configuration ; son effet sur la durée n'est pas mesuré
séparément. Ses parcours réels répétés et les assertions de fermeture de port
sont recensés ci-dessous.

Reproduction : définir `E2E_WORKERS=1`, un `E2E_WEB_PORT` libre et un
`EXPO_METRO_CACHE_OUTPUT_DIR` réservé au benchmark ; exécuter
`node tools/e2e/run.mjs lucid web run` avec `E2E_KEEP_METRO_CACHE=0`, puis
sans cette variable, trois fois. Garder le même répertoire de cache et les
mêmes profils, fermer uniquement le serveur appartenant au benchmark entre
les passages, conserver les rapports/qualifications et les lignes `Web Bundled`.
Les scripts de mesure et journaux sont conservés dans le dossier ignoré
`.tmp/ci-performance/` du worktree de l'audit. Les rapports Windows sont dans
la copie `.tmp/an/tools/e2e/.e2e/lucid-web/`, les rapports Linux dans
`~/.cache/noctalia-ci-performance/manual-benchmark-mAIB2i/tools/e2e/.e2e/lucid-web/`.

## Validation et limites

Les contrôles isolés couvrent des échecs qu'un parcours navigateur ne peut pas
fabriquer : état de build interrompu/corrompu, ABI/profil/environnement ou
plugins incompatibles, remplacement atomique refusé, verrou étranger et faux
descripteur Release. Les mêmes cas, assertions et simulations de plateformes
s'exécutent sur les deux OS, sans sélection conditionnée par l'OS hôte :
64 tests Jest Android et 44 contrôles TesterArmy, aucun skip hôte. Le contrôle
de processus démarre réellement un serveur, vérifie son PID et la fermeture de
son port après arrêt.

Après le correctif de propriété du serveur, chaque OS a aussi exécuté deux fois
les six parcours Lucid, deux parcours Dreamer ciblés parmi les 125 découverts
(`guest saves the exact story|free user saves, renames`) et deux fois le parcours
Meditation. Tous les tests sélectionnés passent, sans retry, flaky ni skip ;
chaque port se ferme sans nettoyage externe. Les séquences API/statut et les
comptes de cas sont identiques entre OS, vérifiés automatiquement dans le reçu.

Les mesures identifient leurs révisions antérieures à l'intégration des mises
à jour Expo et du démarrage applicatif arrivées sur `master` pendant l'audit.
La preuve `verify:pr` de la PR identifie le commit livré et ses validations
après intégration ; les APK chronométrés ne qualifient pas ce nouveau binaire.
Les cinq exécutions navigateur par OS ont été rejouées avec les nouveaux
lockfiles sur `451f0943f496c2b7f7fe9a611eeda7e760f96fbf`, toutes passées :
comptes de cas, séquences API/statut et fermeture des ports identiques entre OS
(`integratedLifecycle` du reçu). Le reformatage final du patch Expo produit le
même fichier Kotlin que le candidat Android chronométré.

Les définitions CircleCI et EAS, les suites mobiles et les contrôles de
publication ne sont pas allégés. CircleCI reste limité au benchmark manuel
E2E/Chromium existant. Les preuves navigateur utilisent des services mockés ;
elles ne qualifient ni un appareil Android/iOS, ni les achats ou services réels,
ni la fluidité d'un binaire de distribution.
