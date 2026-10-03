# Noctalia Android Release Checklist

Guide opérationnel actualisé le 2 octobre 2026. Cette checklist couvre la
qualification Android avant Google Play Internal Testing. Le
[guide de release mobile](MOBILE_VERSIONING.md) est l'entrée pour préparer les
versions, construire et envoyer un build précis ; la
[validation proportionnée](validation-proportionnee.md) choisit les contrôles
selon le changement. Les commandes de build et d'envoi exigent leurs autorisations.

Relire l'identité du candidat et les métadonnées Play/EAS pour chaque release.
Les cases ci-dessous sont à requalifier ; elles ne déclarent pas l'état courant
des services ou du Store. Le relevé du 18 août est conservé en fin de document.

## 1. Variables EAS publiques

Les variables `EXPO_PUBLIC_*` sont incluses dans le bundle client. Elles doivent
être en `plaintext` ou `sensitive`, pas en `secret`, pour être lisibles au moment
du bundle JavaScript. Référence: Expo EAS Environment Variables
<https://docs.expo.dev/eas/environment-variables/>.

- [ ] Vérifier `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` dans le profil `eas.json` du candidat.
- [ ] Confirmer dans Expo Dashboard que la même variable existe aussi dans les environnements EAS `preview` et `production`, ou conserver la valeur du profil `env` comme source de vérité.
- [ ] Confirmer dans Google Cloud que le numéro désigne le projet Play Integrity attendu.
- [ ] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- [ ] Vérifier la clé publique RevenueCat Android `goog_` du profil Play du candidat.
- [ ] Pour la QA Test Store, vérifier le profil séparé, sa clé `test_` et `EXPO_PUBLIC_SUBSCRIPTION_QA_LAB=true` selon le [guide RevenueCat](revenuecat-qa-workflow.md).
- [ ] Vérifier dans RevenueCat le package `com.tanuki75.noctalia`, les produits et les offres du candidat.
- [ ] `EXPO_PUBLIC_API_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `EXPO_PUBLIC_SUPABASE_FUNCTION_JWT` si les Edge Functions exigent encore le JWT anon legacy.
- [ ] `EXPO_PUBLIC_ANALYTICS_DEBUG=false` en release; mettre `true` seulement sur une build debug contrôlée pour vérifier les événements dans les logs.

## 2. Secrets Supabase Functions

- [ ] `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`
- [ ] `PLAY_INTEGRITY_PACKAGE_NAME=com.tanuki75.noctalia`
- [ ] `GUEST_SESSION_SECRET`

## 3. Préparation du build et envoi interne

Suivre [MOBILE_VERSIONING.md](MOBILE_VERSIONING.md) depuis un checkout isolé,
propre et actualisé. Préparer la version avec `release:plan` / `release:prepare`,
commiter les manifests, puis exécuter les contrôles adaptés au changement. Une PR
fonctionnelle ou d'outillage termine sa sélection de tests par `test:prepush` ;
ne pas lui ajouter une suite complète manuelle systématique.

Avant le build Android autorisé :

```bash
mise exec -- npm run subscription:qa:verify-local
mise exec -- npm run subscription:qa:report
mise exec -- npm run android:gates:prebuild
mise exec -- npm run release:check -- --app noctalia
mise exec -- npm run release:build -- --app noctalia --platform android
```

`release:build` utilise la version EAS CLI épinglée par le dépôt et vérifie les
sources natives/fingerprint du checkout avant le lancement distant. En cas de
changement de dépendance ou de configuration, vérifier aussi la compatibilité
Expo avec `npx expo install --check` et `npx expo-doctor`. Les builds APK locaux
ont leurs [prérequis Java 17](../../scripts/README.md#local-android-prerequisites).

`android:gates` imprime les gates locales, bloquées et manuelles sans exposer les
valeurs sensibles. Le gate strict final suit l'installation du candidat depuis
Play Internal Testing.

Relever l'ID du build terminé, puis vérifier l'envoi sans le déclencher :

```bash
mise exec -- node scripts/mobile-release.js submit-internal --app noctalia --platform android --id <ID_BUILD_ANDROID> --dry-run
```

Après autorisation de soumission, retirer `--dry-run`. Le runner sélectionne
`submit.internal` ; `submit.production.android` cible la production. Un envoi
EAS terminé ne prouve ni la disponibilité pour les testeurs ni l'installation.

- [ ] Vérifier la release sur la piste Test interne et son accès aux testeurs.
- [ ] Copier le SHA-1 Play App Signing depuis Play Console → App Integrity.
- [ ] Ajouter ce SHA-1 au client OAuth Android dans Google Cloud Console.

## 4. Test Play-installed uniquement

Installer depuis la piste Internal Testing, pas en sideload.

- [ ] Verifier qu'un telephone Android physique est visible: `npm run android:device:physical`.
- [ ] Verifier l'origine Play de l'installation: `npm run android:play-install-source -- --device <adb-id>` doit afficher `installerPackageName: com.android.vending`.
- [ ] Lancer le preflight compose: `npm run android:play-qa-device -- --device <adb-id>` et recopier les `evidenceArgs` affichés.
- [ ] Guest session bootstrap sans warning `Missing EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`.
- [ ] Google Sign-In.
- [ ] RevenueCat offering load.
- [ ] Restaurer le compte payant sur le candidat Play et enregistrer `restore_after_reinstall` avec le `versionCode` installé.
- [ ] Passer du compte payant au second compte et enregistrer `account_switch`; le second compte doit rester `free / inactive`.
- [ ] Lancer le verdict unique:

  ```bash
  npm run subscription:qa:release-smoke -- \
    --device <adb-id> \
    --version-code <installed-version-code>
  ```

- [ ] Exiger `3/3` puis relancer `npm run android:gates:strict`.
- [ ] Si les produits/forfaits, le paywall/achat, les clés ou le SDK RevenueCat, ou le webhook ont changé, exécuter aussi `npm run subscription:qa:full-gate` et requalifier les sept scénarios.
- [ ] Limite quota vers paywall.
- [ ] Enregistrement audio et fallback texte.
- [ ] App Links `https://dream.noctalia.app`.

## 5. Play Console

- [ ] Privacy Policy publique.
- [ ] Data Safety pour audio, texte/transcripts, auth, achats et analytics.
- [ ] Screenshots Play Store réels: recording, journal, AI analysis, paywall, privacy/offline reliability.
- [ ] Icône 512px et feature graphic 1024x500.

## Relevé historique du 18 août 2026

Play Console affichait Production **54 (3.1.0)** et un candidat **57** créé,
non envoyé pour examen. Ce relevé est daté et ne décrit pas le Store actuel.
Voir [les anciennes notes Play](noctalia-3.1.0-google-play-patch-notes.md).
