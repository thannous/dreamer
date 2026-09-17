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

Un second passage après commit/fusion ne remonte pas la version : les changements de version seuls sont exclus du calcul. Une nouvelle modification applicative depuis la préparation nécessite un nouveau plan. La préparation désigne une version de release, pas la preuve de sa publication sur un Store.

## Construire la release préparée

Depuis le checkout propre de la release validée :

```bash
npm run release:check -- --app noctalia
npm run release:build -- --app noctalia --platform android
# ou --platform ios ; ou --app lucid / --app meditation
```

`release:build` vérifie que les changements mobiles ont une version préparée, puis lance réellement EAS Build avec le profil production de l'app choisie. Cette commande requiert l'autorisation habituelle de build EAS. Elle n'effectue aucune soumission aux Stores. `release:plan`, `release:check` et `verify` ne lancent aucun build.

Le hook `eas-build-pre-install` et la CI contrôlent la cohérence des versions entre registre, Expo, package et lockfile. Le hook fonctionne sans dossier `.git` sur le builder : il vérifie la cohérence, pas l'absence de nouveaux changements. Passer directement par `eas build` contourne donc le contrôle d'historique du wrapper ; utiliser `release:build` comme entrée de release.

## Codes techniques et builds locaux

Les champs locaux `android.versionCode` servent de miroirs/bootstrap pour les builds de développement. Noctalia est aligné sur **68**, valeur distante EAS vérifiée le 17 septembre 2026 ; le prochain build `production` EAS passera normalement à **69**, sauf build concurrent. EAS est l'autorité pour la distribution, pas ce miroir local. Le profil historique `release` (AAB) incrémente lui aussi le compteur ; le wrapper utilise les profils production.

Méditation passe de la source locale à la source distante, avec incrémentation sur `production`. Au moment de la migration, son compteur Android distant n'était pas initialisé (`build:version:get` renvoyait `{}`). Son code local **3** sert de valeur initiale ; vérifier le code attribué au premier build avant soumission. Aucune valeur de Store Méditation n'a été inventée ou déduite de Noctalia.

Les APK locaux directs ne réservent pas de code EAS et ne sont pas des artefacts de mise à jour Play. Le runner synchronise les versions depuis la variante Expo résolue et refuse de réécrire un projet natif qui porte l'identité d'une autre app. Régénérer le projet natif lors d'un changement de variante.

Pour comparer un binaire distribué à un build EAS précis, le garde `check-android-release-ref.js` utilise `BUILT_ANDROID_VERSION_CODE` et `EXPECTED_ANDROID_VERSION_CODE` (valeur tirée des métadonnées de **ce build**, et non du compteur global après d'autres builds). Un code attendu distant manquant ou incohérent bloque la vérification.

## Point de départ

- Noctalia `3.1.0` : snapshot du build EAS 68, `285f4363-10bf-4b2b-8833-54a028f9b2dd`, commit `e9c8d647c601b05e5b68e31c2ac8db8c22bdab9a`. Cette branche n'est pas un ancêtre direct de master : le plan compare les contenus des snapshots et examine les commits ajoutés, sans supposer une filiation. Si nécessaire, récupérer ce commit depuis origin avant de calculer le plan.
- Lucid `1.0.0` et Méditation `0.1.0` : adoption du snapshot `bc4911f711ac0dccc3e7f9247434bb6e6fb9470b`. Ce n'est pas une affirmation de publication antérieure. Les changements antérieurs à cette adoption ne sont pas reclassifiés.
- Sur le snapshot Expo fusionné, Noctalia propose **3.2.0**, car des fonctionnalités ont été ajoutées depuis le build 68. Le mécanisme ne change pas cette version tant que `release:prepare` n'est pas exécuté.

Références : [versions EAS](https://docs.expo.dev/build-reference/app-versions/), [hooks EAS](https://docs.expo.dev/build-reference/npm-hooks/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
