# Noctalia Android Release Checklist

Dernière mise à jour: 2026-05-04.

Cette checklist concentre les gates Android avant Google Play Internal Testing.
Elle complète `PRODUCTION_CONSTANTS.md` et `PRODUCTION_PREP.md`.

## 1. Variables EAS publiques

Les variables `EXPO_PUBLIC_*` sont incluses dans le bundle client. Elles doivent
être en `plaintext` ou `sensitive`, pas en `secret`, pour être lisibles au moment
du bundle JavaScript. Référence: Expo EAS Environment Variables
<https://docs.expo.dev/eas/environment-variables/>.

- [x] `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=359653779023` visible dans `eas.json` pour `preview`, `release`, `production`, `production-apk`.
- [ ] Confirmer dans Expo Dashboard que la même variable existe aussi dans les environnements EAS `preview` et `production`, ou conserver la valeur du profil `env` comme source de vérité.
- [x] Confirmer via `gcloud projects list --filter='PROJECT_NUMBER=359653779023' --format=json` que `359653779023` est bien le **Project number** du projet `gen-lang-client-0336445544` / `dreamweaver` (`ACTIVE`).
- [ ] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- [x] `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_BFWJqTqAtQUnwYisczZcZrnsanw` visible dans `.env.playstore` et `eas.json` pour `preview`, `release`, `production`, `production-apk`.
- [x] RevenueCat Test Store séparé : `.env.teststore` et `eas build --profile revenuecat-teststore` utilisent `test_zqltcBoDiTWPWmuyXTXTbYkJPrz` avec `EXPO_PUBLIC_SUBSCRIPTION_QA_LAB=true`.
- [x] RevenueCat Play Store app confirmée via MCP : `Noctalia (Play Store)`, package `com.tanuki75.noctalia`, produits `noctalia_plus:monthly` et `noctalia_plus:annual`.
- [ ] `EXPO_PUBLIC_API_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `EXPO_PUBLIC_SUPABASE_FUNCTION_JWT` si les Edge Functions exigent encore le JWT anon legacy.
- [ ] `EXPO_PUBLIC_ANALYTICS_DEBUG=false` en release; mettre `true` seulement sur une build debug contrôlée pour vérifier les événements dans les logs.

## 2. Secrets Supabase Functions

- [ ] `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`
- [ ] `PLAY_INTEGRITY_PACKAGE_NAME=com.tanuki75.noctalia`
- [ ] `GUEST_SESSION_SECRET`
- [ ] `ALLOW_INSECURE_GUEST_SESSION=true` seulement pour la v1 si iOS reste sans App Attest.

## 3. Build et upload

```bash
npm run subscription:qa:verify-local
npm run subscription:qa:release-gate
npm run android:gates:strict
npx expo install --check
npx expo-doctor
npm run typecheck:app
npm run lint
npm test -- --runInBand --watch=false --no-watchman
npx eas-cli@latest build -p android --profile production
```

`npm run android:gates` est un préflight non bloquant qui imprime les gates
locales, bloquées et manuelles sans exposer les valeurs sensibles. Utiliser
`npm run android:gates:strict` en CI ou avant release pour échouer tant que
`adb`, un device/emulator Android, Maestro, ou une config locale requise manque.

- [ ] Uploader l'AAB signé sur Google Play Internal Testing.
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
- [ ] Achat test et restore.
- [ ] Enregistrer les preuves `play_monthly`, `play_annual` et `play_cancellation_and_expiry` avec `npm run subscription:qa:evidence -- --device-id <adb-id> --installer-package-name com.android.vending --version-code <installed-version-code>`.
- [ ] Relancer `npm run subscription:qa:release-gate` puis `npm run android:gates:strict`.
- [ ] Limite quota vers paywall.
- [ ] Enregistrement audio et fallback texte.
- [ ] App Links `https://dream.noctalia.app`.

## 5. Play Console

- [ ] Privacy Policy publique.
- [ ] Data Safety pour audio, texte/transcripts, auth, achats et analytics.
- [ ] Screenshots Play Store réels: recording, journal, AI analysis, paywall, privacy/offline reliability.
- [ ] Icône 512px et feature graphic 1024x500.
