# Versions mobiles

La version visible et le numéro technique ont des responsabilités différentes.

- **Version visible** : préparée une fois par release depuis les changements Git. `fix` → patch, `feat` → mineure, `!` ou `BREAKING CHANGE:` → majeure. Le niveau le plus élevé gagne. Un changement de runtime sans titre conventionnel compte comme un patch ; le script ne prétend pas comprendre sémantiquement le code.
- **Numéro technique** : EAS distant et `autoIncrement: true` sur les profils `production` et `lucid-production`. Chaque build distribué reçoit son propre code Android/build iOS. Ne pas utiliser le numéro du SDK Expo comme code de build.
- **Trois versions indépendantes** : Noctalia, Lucid et Méditation. Le code partagé du runtime peut faire évoluer Noctalia et Lucid ensemble. Les docs et tests seuls ne déclenchent rien.

## Préparer une release

Depuis un checkout propre basé sur le dernier `origin/master`, créer une branche de travail puis :

```bash
npm run release:plan -- --app noctalia
npm run release:prepare -- --app noctalia
```

`plan` analyse les **changements commités**. `prepare` calcule la nouvelle version, met à jour les manifests et lockfiles ensemble, puis mémorise le commit source dans `release/mobile-versions.json`. Aucun commit, tag, build, compteur EAS ou Store n'est modifié automatiquement. Relire et commiter les fichiers produits, puis faire valider/fusionner la PR de préparation.

Utiliser `--app lucid`, `--app meditation` ou `--app all` pour les autres périmètres. Une majeure exige `--allow-major` après lecture du plan. Un historique absent, un checkout sale ou une préparation depuis un commit différent du dernier `origin/master` connu sont refusés. Exécuter `git fetch origin master` avant la préparation ; le script ne devine pas un historique manquant et ne fait pas de fetch implicite.

Un second passage après commit/fusion ne remonte pas la version : les changements de version seuls sont exclus du calcul. Une nouvelle modification applicative depuis la préparation nécessite un nouveau plan. La préparation désigne une version de release, pas la preuve de sa publication sur un Store. Conserver le commit référencé par `sourceRef` dans l'historique fusionné ; si une correction de release a ajouté ce commit sur la branche, utiliser un merge commit plutôt qu'un squash qui le rendrait introuvable.

## Construire la release préparée

Depuis le checkout propre de la release validée, installer les dépendances **dans ce checkout** puis :

```bash
npm ci
npm run release:check -- --app noctalia
npm run release:build -- --app noctalia --platform android
# ou --platform ios ; ou --app lucid / --app meditation
```

Pour Méditation, exécuter aussi `npm ci` dans `apps/meditation/` : ce sous-projet possède son propre lockfile et ses dépendances.

`release:build` vérifie que les changements mobiles ont une version préparée. Avant de lancer EAS, il calcule le fingerprint de la plateforme et refuse toute source native résolue hors du checkout. Pour Noctalia/Lucid, il vérifie aussi l'identité du package Android ou du bundle iOS ; sur iOS, il contrôle les deux mentions HealthKit dans l'`Info.plist` résolu par Expo. Une dépendance liée à un autre dossier ou un plugin qui retire une mention bloque ainsi le build localement. Cette commande requiert l'autorisation habituelle de build EAS. Elle n'effectue aucune soumission aux Stores. `release:plan`, `release:check` et `verify` ne lancent aucun build.

Le hook `eas-build-pre-install` et la CI contrôlent la cohérence des versions entre registre, Expo, package et lockfile. Il refuse aussi une configuration HealthKit sans les deux mentions de base. Le hook fonctionne sans dossier `.git` ni dépendances installées sur le builder : il ne peut vérifier ni l'historique, ni le fingerprint de la machine qui a lancé EAS, ni l'`Info.plist` final. Passer directement par `eas build` contourne ces contrôles locaux ; utiliser `release:build` comme entrée de release.

## Envoyer en test interne

Utiliser un build **terminé**, de profil `production` et de distribution `STORE` : IPA pour TestFlight, AAB pour Google Play. Les profils `preview` et `development` servent à l'installation directe et ne produisent pas les artefacts attendus par ces Stores. Relever l'ID exact du build EAS ; ne pas utiliser « le dernier build » implicitement.

```bash
node scripts/mobile-release.js submit-internal --app noctalia --platform ios --id <ID_BUILD_IOS> --dry-run
node scripts/mobile-release.js submit-internal --app noctalia --platform android --id <ID_BUILD_ANDROID> --dry-run
# Retirer --dry-run pour effectuer l'envoi après vérification.
```

La commande inspecte le build distant et refuse un statut autre que `FINISHED`, une mauvaise plateforme, un autre projet/version, un profil `preview`, une distribution non `STORE` ou un artefact absent. Sur iOS, elle refuse aussi un build antérieur à des changements mobiles toujours présents dans le checkout. Elle choisit `submit.production` pour iOS (TestFlight) et **`submit.internal` pour Android** (track Play Internal). Elle n'ajoute pas `--what-to-test` : ce paramètre a été refusé par le plan Expo Starter du compte le 24 septembre 2026. `submit.production.android` pointe vers le track **production** et ne doit pas servir aux tests internes.

Après l'envoi iOS, vérifier l'upload dans **App Store Connect → TestFlight → Build Uploads**, puis le traitement du build et son accès dans le groupe interne. Une commande EAS Submit `ERRORED` sans détail n'établit pas à elle seule si Apple a reçu le fichier : lire le statut Apple avant toute nouvelle tentative. Après l'envoi Android, vérifier la release sur le track **Test interne** de Google Play. `FINISHED` côté EAS atteste l'envoi, pas l'installation ni la validation sur appareil.

La configuration Expo résolue est un contrôle avant compilation. Avant un nouvel envoi iOS après un changement natif ou de plugin, vérifier aussi l'`Info.plist` de l'IPA produit : ses deux valeurs `NSHealthShareUsageDescription` et `NSHealthUpdateUsageDescription` doivent être des textes non vides. La build 3.4.4 (10) a passé ce contrôle et le traitement TestFlight ; une future IPA doit être requalifiée.

## Risques de distribution interne constatés le 24 septembre 2026

Les builds Android 70, 71, 73 et 77 ont échoué dans `CONFIGURE_EXPO_UPDATES` : le fingerprint local incluait des chemins de modules hors du checkout (`../../../Users/tanuki/Documents/dreamer/node_modules/...`), alors que le builder EAS utilisait `node_modules/...`. Un build lancé depuis des dépendances liées à un autre dossier peut donc consommer un numéro EAS et échouer avant la compilation. Les builds récents issus d'un checkout isolé ont réussi, mais ce résultat ne protège pas les futurs checkouts.

Le build iOS 3.4.4 (9) a compilé ; trois transferts ont ensuite été rejetés par Apple (90683) car l'`Info.plist` final ne déclarait pas les deux descriptions HealthKit. Un EAS Submit `ERRORED` sans message peut correspondre à un transfert effectivement reçu puis rejeté par Apple. Une autre tentative avec `--what-to-test` a été refusée avant transfert, car le compte Expo Starter ne permettait pas ce paramètre. Les parcours E2E de l'application ne vérifient ni le fingerprint de la machine qui lance EAS, ni le contenu de l'IPA accepté par App Store Connect, ni la sélection du track Play : ces contrôles doivent précéder le build ou accompagner l'envoi.

## Codes techniques et builds locaux

Les champs locaux `android.versionCode` servent de miroirs/bootstrap pour les builds de développement. Le miroir local Noctalia a été initialement aligné sur **68** le 17 septembre 2026. Les builds distants ultérieurs ont fait évoluer ce compteur ; lire le code attribué à chaque build EAS avant un envoi au Store, sans déduire le prochain code du miroir local. EAS est l'autorité pour la distribution, pas ce miroir local. Le profil historique `release` (AAB) incrémente lui aussi le compteur ; le wrapper utilise les profils production.

Méditation passe de la source locale à la source distante, avec incrémentation sur `production`. Au moment de la migration, son compteur Android distant n'était pas initialisé (`build:version:get` renvoyait `{}`). Son code local **3** sert de valeur initiale ; vérifier le code attribué au premier build avant soumission. Aucune valeur de Store Méditation n'a été inventée ou déduite de Noctalia.

Les APK locaux directs ne réservent pas de code EAS et ne sont pas des artefacts de mise à jour Play. Le runner synchronise les versions depuis la variante Expo résolue et refuse de réécrire un projet natif qui porte l'identité d'une autre app. Régénérer le projet natif lors d'un changement de variante.

Pour comparer un binaire distribué à un build EAS précis, le garde `check-android-release-ref.js` utilise `BUILT_ANDROID_VERSION_CODE` et `EXPECTED_ANDROID_VERSION_CODE` (valeur tirée des métadonnées de **ce build**, et non du compteur global après d'autres builds). Un code attendu distant manquant ou incohérent bloque la vérification.

## Point de départ

- Noctalia `3.1.0` : snapshot du build EAS 68, `285f4363-10bf-4b2b-8833-54a028f9b2dd`, commit `e9c8d647c601b05e5b68e31c2ac8db8c22bdab9a`. Cette branche n'est pas un ancêtre direct de master : le plan compare les contenus des snapshots et examine les commits ajoutés, sans supposer une filiation. Si nécessaire, récupérer ce commit depuis origin avant de calculer le plan.
- Lucid `1.0.0` et Méditation `0.1.0` : adoption du snapshot `bc4911f711ac0dccc3e7f9247434bb6e6fb9470b`. Ce n'est pas une affirmation de publication antérieure. Les changements antérieurs à cette adoption ne sont pas reclassifiés.
- Sur le snapshot Expo fusionné, Noctalia propose **3.2.0**, car des fonctionnalités ont été ajoutées depuis le build 68. Le mécanisme ne change pas cette version tant que `release:prepare` n'est pas exécuté.

Références : [versions EAS](https://docs.expo.dev/build-reference/app-versions/), [hooks EAS](https://docs.expo.dev/build-reference/npm-hooks/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
