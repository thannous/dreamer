# Noctalia – Préparation production

## Marque & assets
- Nom public: **Noctalia** (`app.json`, `strings.xml`).
- Icônes: `assets/images/icon.png`, `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `favicon.png` (générées).
- Splash: `assets/images/splash-icon.png` actuel; remplacer si besoin de visuel final.
- Fournir screenshots Play Store + favicon/maskable pour le web si requis par l’hébergeur.

## Secrets / env à injecter (EAS)
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `EXPO_PUBLIC_API_URL` (fonction Supabase).
- Google OAuth: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (+ iOS si nécessaire).
- RevenueCat: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_WEB_KEY` (+ iOS).
- Optionnel notif: `EXPO_PUBLIC_MOCK_MODE=false` en prod (défaut).

## Sécurité & conformité
- Keystore Android présent dans le repo (`@tanuki75__dream-app.jks`) — à déplacer hors git et gérer via EAS credentials pour éviter l’exfiltration.
- Manifest inclut encore `READ/WRITE_EXTERNAL_STORAGE` et `SYSTEM_ALERT_WINDOW`; supprimer via config/plugin avant soumission Play. Ajouter `POST_NOTIFICATIONS` pour Android 13+.
- Données sensibles: micro + transcripts envoyés au backend → prévoir Privacy Policy + fiche Data Safety (collecte audio/texte, identifiants supabase, analytics si ajoutés).
- Mises à jour OTA: `runtimeVersion` appVersion, `updates.url` configuré (expo-owner tanuki75). Utiliser le même compte Expo pour les builds de prod.

## Tests / validation
- Lancer `npm run lint`, `npm test` (Vitest), Maestro flows (`npm run test:e2e*`), puis `eas build --platform android --profile production` (AAB).
- Vérifier web export: `npx expo export --platform web` + navigation directe vers routes dynamiques (`/journal/…`, `/dream-chat/…`).
- Tester Google Sign-In et RevenueCat sur device réel (newArch activée).

## Publier
- Build AAB: `eas build --platform android --profile production` (ou `--auto-submit` si service account configuré).
- Soumettre: `eas submit --platform android --profile production` ou via Play Console internal track.
- Préparer listing: titre, description, screenshots, icône 512px, bannière 1024x500, politique de confidentialité (URL).


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