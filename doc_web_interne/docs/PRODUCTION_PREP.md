# Noctalia – Préparation production

Dernière revue locale: 2026-05-04.

Statut actuel: **pas prêt pour publication production**. Le projet peut entrer en phase
**release candidate / Google Play Internal Testing** après configuration des secrets
production, génération d'un AAB signé, et validation sur un appareil installé depuis
la piste Internal Testing.

## Feu vert store
- [x] TypeScript app: `npm run typecheck:app`.
- [x] Lint: `npm run lint` sans erreur bloquante.
- [x] Tests Jest: `npm test -- --runInBand --watchman=false`.
- [x] Expo SDK/deps: `npx expo install --check`.
- [x] Expo Doctor: `npx expo-doctor`.
- [ ] Worktree release propre: commit/tag de release sans changements non relus.
- [ ] EAS env/secrets production complets, voir `PRODUCTION_CONSTANTS.md`.
- [ ] Build store réel: `eas build --platform android --profile production` (AAB).
- [ ] Installation depuis Google Play Internal Testing, pas un sideload.
- [ ] Smoke tests device réel: Google Sign-In, achat/restauration RevenueCat, quotas,
  enregistrement audio, navigation, notifications si activées, Play Integrity.
- [ ] Listing/compliance Play Console: Privacy Policy, Data Safety, screenshots,
  icône 512px, bannière 1024x500, description, support/contact.

## Marque & assets
- Nom public: **Noctalia** (`app.json`, `strings.xml`).
- Icônes: `assets/images/icon.png`, `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `favicon.png` (générées).
- Splash: `assets/images/splash-icon-flat.png` configuré via `expo-splash-screen`; remplacer seulement si le visuel final change.
- Fournir screenshots Play Store + favicon/maskable pour le web si requis par l’hébergeur.

## Secrets / env à injecter (EAS)
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `EXPO_PUBLIC_API_URL` (fonction Supabase).
- Google OAuth: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (+ iOS si nécessaire).
- RevenueCat: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_WEB_KEY` (+ iOS si publication App Store).
- Guest sessions Android: `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` côté app, puis `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`, `PLAY_INTEGRITY_PACKAGE_NAME`, `GUEST_SESSION_SECRET` côté Supabase Functions.
- Obligatoire prod: `EXPO_PUBLIC_MOCK_MODE=false` pour éviter un build store en mode mock.

## Sécurité & conformité
- Aucun fichier `.jks` / `.keystore` n'est actuellement tracké par git, et `.gitignore` couvre ces extensions. Avant release, confirmer que les credentials Android prod sont bien gérés par EAS remote credentials ou Play App Signing.
- `app.json` ne déclare actuellement que `RECORD_AUDIO` et `MODIFY_AUDIO_SETTINGS` côté Android. Avant soumission, vérifier l'AAB/manifest généré pour confirmer l'absence de permissions legacy (`READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`) ajoutées par un plugin. Ajouter/justifier `POST_NOTIFICATIONS` seulement si le produit demande réellement la permission notifications en production.
- Données sensibles: micro + transcripts envoyés au backend → prévoir Privacy Policy + fiche Data Safety (collecte audio/texte, identifiants supabase, analytics si ajoutés).
- Mises à jour OTA: `runtimeVersion` appVersion, `updates.url` configuré (expo-owner tanuki75). Utiliser le même compte Expo pour les builds de prod.

## Tests / validation
- Lancer `npm run typecheck:app`, `npm run lint`, `npm test -- --runInBand --watchman=false`, Maestro flows (`npm run test:e2e*` selon périmètre), puis `eas build --platform android --profile production` (AAB).
- Traiter `npm run typecheck:tests` comme gate à corriger ou waiver explicite avant release si la dette TypeScript tests existe encore.
- Vérifier web export: `npx expo export --platform web` + navigation directe vers routes dynamiques (`/journal/…`, `/dream-chat/…`).
- Tester Google Sign-In, RevenueCat, Play Integrity et notifications sur device réel installé depuis Google Play Internal Testing (newArch activée).

## Publier
- Build AAB: `eas build --platform android --profile production` (ou `--auto-submit` si service account configuré).
- Soumettre: `eas submit --platform android --profile production` ou via Play Console internal track.
- Préparer listing: titre, description, screenshots, icône 512px, bannière 1024x500, politique de confidentialité (URL).
- Site public: `docs-src/content/pages/page.home/*` et certains CTA blog pointent déjà vers Google Play. Ne pas déployer ces liens publics tant que la fiche Play n'est pas accessible; basculer temporairement vers waitlist/landing si nécessaire.
- iOS/App Store: non couvert par le feu vert Android tant que les clés RevenueCat iOS, credentials Apple, profil submit iOS et validation TestFlight ne sont pas terminés.


Tests de Validation Post-Implémentation
✅ Test 1 : Impossible de Bypass Tier
Ouvrir console navigateur
Exécuter : supabase.auth.updateUser({ data: { tier: 'premium' } })
Attendu : Tier reste 'free' dans app_metadata, quotas toujours appliqués
Vérifier via : supabase.auth.getUser() → user.app_metadata.tier ne change pas
✅ Test 2 : Quota Chat Strictement Appliqué
Créer utilisateur free
Créer un rêve, démarrer chat
Envoyer 20 messages → OK
Envoyer 21ème message → 429 QUOTA_MESSAGE_LIMIT_REACHED
Vérifier console backend : log quota_events avec blocked=true
✅ Test 3 : Ownership Chat
Utilisateur A crée rêve avec ID=123
Utilisateur B essaie /chat avec dreamId=123
Attendu : 403 Unauthorized
✅ Test 4 : Expiration d'Abonnement
Créer abonnement test RevenueCat
Annuler/laisser expirer
Attendre 5 minutes (TTL cache)
Recharger app
Attendu : Tier passe de 'premium' à 'free', quotas affichés "X / Y"
✅ Test 5 : RevenueCat Webhook
Simuler webhook EXPIRATION avec payload RevenueCat
Attendu : app_metadata.tier passe à 'free'
Vérifier logs webhook : "Tier changed from premium to free"
