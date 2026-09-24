# Android — correction de la rétention des écrans — 24 septembre 2026

## Résultat et périmètre

Le parcours Capture → Journal → Capture ne recrée plus un navigateur d’onglets à chaque cycle. La barre de Capture utilise `router.dismissTo` avec les destinations explicites `/(tabs)`, `/(tabs)/journal`, `/(tabs)/statistics` et `/(tabs)/explore`. L’onglet existant est réutilisé, Capture est démontée et son brouillon utilise la sauvegarde/restauration déjà présente. L’ouverture de Capture depuis les onglets conserve son `push` : elle ajoute l’écran qui sera ensuite retiré. Les routes de fiches, ressources, authentification et notifications ne sont pas modifiées.

La documentation Expo décrit le dépilage vers une destination existante et le remplacement si elle n’existe pas : [Stack / dismissTo](https://docs.expo.dev/router/advanced/stack/#dismissto-action). Le comportement a aussi été vérifié dans Expo Router 57.0.21 installé, puis dans le binaire Release.

## Provenance

- Code testé : `542c230e38f77dfb6486b33e97c4e20eee6ae3d3`, basé sur `17312e7ec82e88228f13ea0dc16d6a5d13cd8185`.
- SHA-256 de `components/navigation/NoctaliaBottomNav.tsx` compilé : `60c7250ab16e7ab0a882bd12e664ebbb7c6a1ab52a0e85f1c669c237356576dc`.
- Les mesures ont démarré avant la création du commit : le champ `source_head` du runner indique encore la base. `source-build.json` relie les octets du correctif au commit ci-dessus et à l’APK. Aucun changement applicatif après compilation.
- Pixel_9_API_37, `emulator-5554`, Android 17/API 37 ARM64, 1080 × 2424, font scale 1, application en anglais, invité, onboarding terminé, journal et brouillon vides.
- Noctalia 3.4.3 (68), Release non débogable, profilable, signature de développement locale SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- APK SHA-256 : `55d2fb7becfc3a56dab8fdb6289a5341d515393877e9ab547adce579cc8ad1ed`.
- Bundle embarqué vérifié : updateId `cc060a07-ccd7-4164-829a-9e487698e83f`, runtimeVersion `a1fba2dbc07f5a6295a4a493995073d16d953905`, `isEmbeddedLaunch=true`, aucun lancement d’urgence.
- Build canonique `npm run android:release:local -- --profile production-apk --abi arm64-v8a --profileable`, Node 24.21.0 et Temurin 17.0.20.1. Build réussi en 3 min 17 s.
- Mise à jour locale avec `adb install -r`, même signature et version. Snapshot complet `noctalia-before-navigation-fix-20260924` enregistré, listé et restauré avec succès avant installation. Aucun effacement des données.

## Régression E2E et mémoire

Un pilote d’un cycle valide les sélecteurs et Retour ; puis une série fixée à dix cycles. Chaque série commence après arrêt du processus, relance et un aller-retour de préchauffage. Le runner conserve chaque arbre UI et vérifie les écrans, les compteurs mémoire et la sortie par Retour. Les dumps UI ajoutent du temps entre les actions : la comparaison PSS reste descriptive, pas une mesure statistique de gain.

| État | PSS après correction | Vues Android |
| --- | ---: | ---: |
| Après préchauffage | 186,86 Mio | 304 |
| Après 5 cycles | 214,07 Mio | 370 |
| Après 10 cycles | 215,04 Mio | 238 |
| Après 20 s de repos | 196,25 Mio | 238 |

Sur cette série : **+9,40 Mio et −66 vues**, une activité. Le pilote revient de 238 à 238 vues après repos (+0,79 Mio). L’audit initial sur le même émulateur observait **+96,73 Mio et +1 590 vues** après dix cycles. La mémoire n’est pas supposée revenir exactement au point de départ : allocateurs, caches et GC varient.

Retour après la série : **Journal → Today → sortie**, sans ancienne Capture. Toutes les assertions passent. La tolérance de 100 vues supplémentaires du runner est un garde de régression pour ces mêmes écrans préchauffés ; le PSS est enregistré sans seuil arbitraire. Les snapshots ne constituent pas une preuve de racine GC ou d’absence de toute fuite.

Commande de reproduction, depuis le dépôt avec Node 24 et adb dans `PATH`, sur l’APK déjà installé et un dossier de sortie neuf :

```sh
node scripts/android-device-lock.js wrap --owner dreamer --device emulator-5554 -- \
  python3 tests/android/navigation-retention.py --device emulator-5554 --runs 10 \
  --output /private/tmp/noctalia-navigation-retention-new-run
```

Pour le pilote, utiliser `--runs 1` et un autre dossier. Le runner ne réinstalle pas l’app, ne vide pas ses données et n’écrit aucun rêve. Il arrête et relance le processus ; il conserve les arbres UI et les logs localement.

## Parcours complémentaires

Seize assertions ADB passent sur le même APK : brouillon synthétique créé uniquement après vérification de zéro caractère ; conservation après Journal/Capture, Explorer/dictionnaire/Retour/Capture, Trends et Today ; retour de la ressource vers Explorer ; liens profonds `noctalia://journal`, `noctalia://explore`, `noctalia://recording` ; conservation après mort du processus. Seul le texte synthétique exact est ensuite effacé et le retour au brouillon vide est vérifié. Captures d’écran de la restauration et du retour de ressource inspectées.

Le protocole complémentaire et les arbres de chaque étape sont dans `check-journeys.py`, `journeys/report.json` et `journeys/*.xml` du dossier de preuves. Aucun compte, achat ou appel de génération n’est utilisé. Une notification système réelle, une dictée active, un journal rempli et un téléphone physique ne sont pas qualifiés par ces parcours.

## Fluidité après correction

Cinq ouvertures préchauffées Capture → Journal, dans une collecte Perfetto séparée, donnent 31 images applicatives chacune : **0 App Deadline Missed sur 155 images**. P95 par passage : 4,53 / 4,87 / 4,25 / 4,97 / 3,97 ms ; médiane **4,53 ms**. Aucun compteur d’erreur de trace positif. Les fenêtres durent 1,05–1,06 s ; les dumps UI et retours à Capture sont hors fenêtre. Cette durée d’image n’est pas une latence clic → contenu. L’audit initial donnait 5,55 ms sur des fenêtres légèrement plus longues ; aucun pourcentage de gain statistique n’est revendiqué.

Le premier lancement de Perfetto a échoué avant mesure parce qu’Android refusait la lecture du fichier de configuration dans `/data/local/tmp`. Le passage par l’entrée standard a permis la collecte ; l’échec reste dans `frames.log`. La trace valide, les cinq fenêtres, les CSV et le résumé sont sous `frames-final/`.

## Vérifications et preuves

- `npm run test:prepush` sur le commit propre `542c230e` et une base distante fraîche : types application/tests OK, **3 suites / 118 tests affectés passent**, y compris Capture et hydratation du brouillon.
- Lint ciblé des deux fichiers TSX et `git diff --check` : OK.
- Le test existant de la barre est adapté à l’action de sortie ; la preuve de dépilage vient du parcours Android réel, pas du mock de routeur.
- Buffer crash vide à la fin de la série. Pas de modification des seuils CI ou des dépendances.
- `npm run docs:build-impact -- --base 17312e7e --head 542c230e` : `build=false`, `excluded-inputs-only` selon la configuration Pages suivie dans le dépôt.

Preuves brutes locales : `/private/tmp/noctalia-navigation-fix-20260924/` (`source-build.json`, `build.log`, manifeste/signature APK, snapshot/restauration, `pilot/`, `final/`, `journeys/`, `prepush.log`). Référence avant correction : `/private/tmp/noctalia-android-perf-20260924-jhk4_zlq/rapport-performance.md` et ses snapshots. Les traces et captures temporaires ne sont pas commitées.

Le démarrage de l’audit précédent (médiane 1,22 s et attentes graphiques sur émulateur) reste hors de ce correctif : aucun hotspot applicatif précis n’y était démontré. Aucun gain de démarrage ni résultat Play/téléphone n’est revendiqué.
