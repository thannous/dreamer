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
