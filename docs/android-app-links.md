# Android App Links (Digital Asset Links)

Objectif : ouvrir automatiquement l’app Noctalia quand l’utilisateur clique sur une URL du type `https://dream.noctalia.app/...` (plutôt qu’un `noctalia://...`).

## 1) Côté domaine (Web → App)

Le fichier de vérification Android doit être servi par le domaine, en HTTPS, à l’URL :

`https://dream.noctalia.app/.well-known/assetlinks.json`

Dans ce repo, il est déjà présent ici :

`public/.well-known/assetlinks.json`

Vérification rapide :

`curl -i https://dream.noctalia.app/.well-known/assetlinks.json`

Points importants :

- Réponse en `200` (pas de redirection) et `Content-Type: application/json`.
- Le fichier doit contenir `package_name` = `com.tanuki75.noctalia` et les `sha256_cert_fingerprints` correspondant à la signature de l’app.

### Empreintes SHA-256 (cert fingerprints)

Selon la façon dont l’app est installée, la signature peut changer :

- **Build Play Store** : utiliser l’empreinte “App signing key certificate” de Google Play Console.
- **Build preview / internal (EAS)** : utiliser l’empreinte du keystore EAS (page “Credentials” ou `eas credentials -p android`).

Si vous voulez que les App Links soient “vérifiés” pour plusieurs signatures, ajoutez **plusieurs empreintes** dans `sha256_cert_fingerprints`.

## 2) Côté app (App → Web)

L’app doit déclarer un intent-filter `https` avec `autoVerify=true` pour `dream.noctalia.app`.

- Source de vérité (Expo config) : `app.json` (`expo.android.intentFilters`)
- Projet Android natif (effectivement buildé) : `android/app/src/main/AndroidManifest.xml`

> Si `android/` est commité, les changements dans `app.json` ne sont pas automatiquement appliqués au manifest : il faut re-générer via prebuild ou modifier le manifest.

## 3) Test

- Sur l’appareil : “App info” → “Open by default” doit afficher un lien vérifié.
- Via ADB :

`adb shell am start -a android.intent.action.VIEW -d "https://dream.noctalia.app/recording" com.tanuki75.noctalia`

## Bonus iOS (Universal Links)

Le domaine doit aussi servir `apple-app-site-association` (déjà présent dans `public/.well-known/apple-app-site-association`) mais il faut remplacer `<APPLE_TEAM_ID>` par le Team ID Apple réel.
