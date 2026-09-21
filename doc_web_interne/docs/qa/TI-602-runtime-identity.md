# TI-602 — Identité du runtime Android exécuté

## Résultat vérifié — 21 septembre 2026

**Objectif TI-602 atteint sur le Motorola Edge 60 Fusion, Android 16.** Noctalia
3.3.0 (72), package `com.tanuki75.noctalia`, installateur et initiateur
`com.android.vending`, certificat Play SHA-256
`6a8cb2e2cdd2c1fdd7c5cfcf00d7c3cc5861c2cd3faf49f69a312535a44fee0f`.

Après autorisation explicite de publication, le diagnostic a été livré par OTA
Android sur le canal `production`, uniquement pour le runtime
`bb6007193f94371a51eec34f32439d2c9012fb05`.

| Preuve | Valeur |
| --- | --- |
| Update exécutée | `01a0c458-8e30-70d0-8b76-8f208cad6bfd` |
| Groupe EAS publié | `e2f3e2eb-c3ba-4a55-a12b-1499cadf3595` |
| Runtime exécuté | `bb6007193f94371a51eec34f32439d2c9012fb05` |
| Origine | `isEmbeddedLaunch=false`, `launchSource=ota` |
| Mode | `development=false`, `updatesEnabled=true` |
| Secours | `isEmergencyLaunch=false` |
| Heure du diagnostic | `2026-09-21T14:25:54.538Z` |
| Processus frais | PID `13948`, absence vérifiée avant lancement, Android `LaunchState: COLD` |

La [preuve JSON expurgée](TI-602-play72-runtime-proof.json) contient la ligne
observée dans ce PID après le début de la fenêtre, la provenance Play et le résultat
du démarrage. L’identifiant observé correspond exactement à l’update publiée.
L’écran d’accueil « Tes rêves ont une histoire » / « Commencer » reste accessible.

Les étapes antérieures ont établi le téléchargement au premier lancement, puis
le chargement OTA au second. Android ayant indiqué `WARM` pour cette seconde
activité malgré un nouveau processus, un dernier `am start -S -W` a levé cette
ambiguïté avec un démarrage `COLD` et la même identité OTA.

### Code et compatibilité de la livraison

- Build EAS 72 : `695c5c2e-8786-439c-acf8-2cceb85725e0`, source
  `2b06816d85d0e8c59746b642415c444e806d8262`.
- Candidat publié : `e846564cd54d4699717eef07b5964470003bacea`, branche
  `codex/ti602-play72-delivery` : source exacte Play 72 et seul patch TI-602 de la
  PR #196, sans les modifications ultérieures du dictionnaire ou du site.
- `npm ci` isolé ; fingerprint strictement égal à l’APK et à EAS, également avec
  l’environnement de publication. Aucune surcharge forcée de runtime.
- `npm run test:prepush` du candidat : 1553 tests / 155 suites et types app/tests
  réussis. La sélection large vient du merge-base antérieur au lot Play 72 ; elle
  ne signifie pas que tous ces fichiers ont été modifiés pour ce diagnostic.
- Export Hermes Android de production réussi, marqueur du diagnostic présent.
  SHA-256 : `118fe205d216424f99e85befdeaf6eceb8f8dd7f01dc71c8d626ea295c365cf2`.
- L’export a repris les variables du profil de build 72, dont les différences avec
  l’environnement EAS : HD désactivé, images de référence désactivées, mode test
  RevenueCat non débogable, SHARP_IGNORE_GLOBAL_LIBVIPS=1. Aucun secret consigné.
- Publication avec `--platform android --channel production --environment production
  --skip-bundler`, sans nouveau build natif ni soumission Store.

### Données et limites

L’installation précédente était une version de développement signée différemment.
L’utilisateur l’a désinstallée lui-même puis a explicitement autorisé la suppression
et l’installation Play. Aucune restauration de ses anciennes données n’est revendiquée.
Le test OTA s’est déroulé sur le nouvel écran d’accueil, sans compte connecté ni saisie
active ; aucune désinstallation, suppression de données ou réinstallation pendant
la mise à jour et sa qualification. Aucun contenu du journal ou identifiant utilisateur
n’a été exporté. Les permissions/consentements de l’onboarding n’ont pas été sélectionnés.

Le manifeste embarqué `45064c4f-e1ae-4571-bef6-0ce464bbb48e` et le runtime natif
ont été relevés séparément dans l’APK ; ils ne sont pas la preuve d’exécution.
La preuve d’exécution est la ligne `[NoctaliaRuntime]` issue de l’app.
Ce contrôle ne constitue pas une qualification complète des parcours de la release.
La PR #196 reste ouverte ; la publication OTA et la fusion Git sont distinctes.

## Diagnostic préparé

Le premier montage du layout Journal Android charge paresseusement
`lib/runtimeIdentity.ts`. Une seule ligne `[NoctaliaRuntime]` est émise par runtime
JavaScript, y compris en release. Un remontage ne produit pas une nouvelle preuve
de démarrage. Un rechargement JS peut produire une nouvelle ligne : seul le
protocole avec arrêt/redémarrage du processus établit le démarrage à froid.

La ligne contient uniquement : version de schéma, heure d’observation UTC,
identifiant d’application, version/build natifs, mode développement, activation
Expo Updates, `updateId`, `runtimeVersion`, `isEmbeddedLaunch`, origine du lancement,
indicateur de lancement de secours et canal configuré.

- `updateId` vient de l’update en cours d’exécution, jamais d’un manifeste téléchargé.
- La version et le build viennent d’`expo-application`, sans repli sur `app.json`.
- `launchSource` vaut `embedded` ou `ota` seulement hors développement, avec Updates
  actif, un identifiant et un runtime non vides. Sinon il vaut `unknown` : le `false`
  par défaut d’Expo ne prouve pas un lancement OTA.
- `isEmergencyLaunch` garde la preuve d’un éventuel repli, sans son message d’erreur.
- Le canal est une configuration de build, pas la preuve qu’une mise à jour est disponible.

Aucun manifeste, compte, identifiant d’appareil, récit, brouillon, URL, jeton ou
message d’erreur n’est sérialisé. Aucun accès au stockage applicatif, requête réseau,
vérification/téléchargement de mise à jour ou rechargement n’est ajouté. Le
chargement et la journalisation sont sans effet bloquant sur la navigation. Les
branches web/iOS/Lucid ne chargent pas ce diagnostic.

Contrats vérifiés dans la dépendance installée `expo-updates` et la
[documentation officielle Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/).
La dépendance React Native conserve le pont console vers les logs natifs en release ;
sa visibilité effective sur le binaire Play reste à vérifier.

## Protocole Motorola / Play

1. Connecter le Motorola et sélectionner son transport ADB courant. Employer le
   verrou `scripts/android-device-lock.js wrap --owner dreamer --device ...` pendant
   les opérations sur l’appareil. Ne pas voler un verrou détenu par une autre tâche.
2. Vérifier modèle/OS, package, versionCode, installateur Play (`com.android.vending`)
   et certificat de l’APK installé. `npm run android:play-qa-device -- --device ...`
   fournit la première vérification ; compléter par le certificat SHA-256 de l’APK
   effectivement installé. Ne pas déduire la provenance Play de la seule version.
3. Vérifier que toute saisie en cours est sauvegardée avant le démarrage à froid.
   Ne pas fermer brutalement une dictée ou une saisie non persistée.
4. Sous le verrou, relever l’heure du téléphone, arrêter uniquement le package de
   base, confirmer l’absence de PID, puis lancer son activité principale résolue
   depuis le package installé. Aucun lien profond de diagnostic n’est ajouté.
5. Relever le nouveau PID, puis ne conserver que la ligne JSON `[NoctaliaRuntime]`
   de ce PID, postérieure à l’heure de départ. Exemple de lecture après lancement :

```sh
# Variables renseignées à partir de l’appareil et du démarrage observés.
# TI602_START : heure du téléphone avant l’arrêt, format MM-DD HH:MM:SS.000.
# TI602_PID : résultat non vide de adb -s "$TI602_DEVICE" shell pidof com.tanuki75.noctalia.
adb -s "$TI602_DEVICE" logcat -d -v threadtime --pid="$TI602_PID" -T "$TI602_START" 'ReactNativeJS:I' '*:S' |
  sed -n 's/^.*ReactNativeJS *: \(\[NoctaliaRuntime\] {.*}\)$/\1/p'
```

6. Vérifier que `applicationId`, version et build correspondent au package inspecté,
   `development=false`, `updatesEnabled=true`, et que `updateId`/`runtimeVersion`
   sont renseignés. Conserver le PID et la fenêtre temporelle séparément comme
   contexte du démarrage. `unknown`, aucune ligne ou plusieurs runtimes inattendus
   dans la même fenêtre ne constituent pas une qualification réussie.
7. Comparer séparément la configuration native et le manifeste embarqué si nécessaire.
   Une mise à jour disponible ou `NoUpdatesAvailable` ne remplace jamais les valeurs
   observées du runtime chargé. Consigner la preuve expurgée dans TI-602.
8. Confirmer la préservation du compte, du journal et du brouillon, sans exporter
   leur contenu. Libérer uniquement le verrou de cette tâche.

Une version Play qui n’embarque pas ce diagnostic ne peut pas l’acquérir par une
simple commande ADB. Si les diagnostics existants ne suffisent pas, une livraison
autorisée séparément est nécessaire avant de rejouer ce protocole. Ne jamais
remplacer Play par un APK local pour simuler la preuve demandée.

## Validation locale

Les tests couvrent les origines embarquée/OTA, les cas indéterminés, le repli de
secours, l’absence de données privées et d’appels de mise à jour, l’unicité par runtime,
les versions natives indisponibles, l’échec de journalisation et l’intégration au
layout limitée au Journal Android. La qualification finale utilise
`npm run test:prepush` sur le worktree propre et commité ; les résultats sont
consignés dans la PR et le ticket. Cette validation locale ne vaut pas preuve Play.

### Validation initiale du patch

Le commit de code original `a0c6405b83ef65f73a1e47d45649eef35d287aa5` a passé
31 tests / 2 suites et les types app/tests via `test:prepush`, puis CircleCI
`noctalia-quality` sur la PR. Lint ciblé : aucune erreur, quatre avertissements
préexistants hors des lignes modifiées. La nouvelle preuve documentaire ne modifie
pas le code du diagnostic. Le WIP initial de `AnalysisReadingModal.tsx` sur master
est resté exclu.
