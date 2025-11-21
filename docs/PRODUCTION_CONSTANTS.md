# Noctalia – Check-list des constantes / secrets (prod)

- [x] `EXPO_PUBLIC_SUPABASE_URL`  
  - Pourquoi : URL Supabase pour auth et sync des rêves.  
  - Où récupérer : Supabase Dashboard → Settings → API → Project URL.  
  - Valeur prod : `https://usuyppgsmmowzizhaoqj.supabase.co`.  
  - Où placer : secrets EAS (`eas secret:create --scope-project --name EXPO_PUBLIC_SUPABASE_URL --value https://usuyppgsmmowzizhaoqj.supabase.co`).
- [x] `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
  - Pourquoi : clé publique Supabase pour les appels client.  
  - Où récupérer : Supabase Dashboard → Settings → API → anon public.  
  - Valeur prod : `sb_publishable_MpacCRXT8NJRcx6q_ww_pw_L_TQWi3n`.  
  - Où placer : secret EAS `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [x] `SUPABASE_PROJECT_REF`  
  - Pourquoi : référence du projet Supabase (utile pour outils/script).  
  - Où récupérer : Supabase Dashboard → Settings → API → Project reference.  
  - Valeur prod : `usuyppgsmmowzizhaoqj`.  
  - Où placer : secret EAS `SUPABASE_PROJECT_REF` (si utilisé par les scripts/CI).
- [x] `EXPO_PUBLIC_API_URL`  
  - Pourquoi : endpoint des fonctions (transcription/analyses).  
  - Où récupérer : Supabase Dashboard → Project ref → `https://<ref>.functions.supabase.co/api`.  
  - Valeur prod : `https://usuyppgsmmowzizhaoqj.functions.supabase.co/api`.  
  - Où placer : variable EAS en `plaintext` (`eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_API_URL --value https://usuyppgsmmowzizhaoqj.functions.supabase.co/api`).
- [ ] `EXPO_PUBLIC_MOCK_MODE=false`  
  - Pourquoi : s’assurer que les services réels sont utilisés en prod.  
  - Valeur prod : `false`.  
  - Où placer : variable EAS en `plaintext` (`eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_MOCK_MODE --value false`) ou dans le profil `env` si besoin.

## Google OAuth (auth)
- [x] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`  
  - Pourquoi : OAuth web + échange d’ID token pour Supabase.  
  - Où récupérer : Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Web client (https://console.cloud.google.com/apis/credentials).  
  - Valeur : `359653779023-6hivlgk9tpgq9g8ng5qpoipjjs780m8h.apps.googleusercontent.com`.  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value 359653779023-6hivlgk9tpgq9g8ng5qpoipjjs780m8h.apps.googleusercontent.com`) + config Supabase provider (Authorized client IDs, Skip nonce).
- [x] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  
  - Pourquoi : client natif Android pour Google Sign-In (doit inclure SHA-1 Play).  
  - Où récupérer : Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Android client (https://console.cloud.google.com/apis/credentials) avec SHA-1 Play + dev.  
  - Valeur : `359653779023-b2ehl3qp5eas6b8ncu4cenjbtb3ivqfp.apps.googleusercontent.com`.  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value 359653779023-b2ehl3qp5eas6b8ncu4cenjbtb3ivqfp.apps.googleusercontent.com`).
- [x] `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (si iOS)  
  - Pourquoi : client natif iOS pour Google Sign-In.  
  - Où récupérer : Google Cloud Console → Credentials → OAuth 2.0 Client IDs → iOS client (https://console.cloud.google.com/apis/credentials).  
  - Valeur : `359653779023-d3ddevr4qepqa13uqlv1ckd0th6k79gf.apps.googleusercontent.com`.  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value 359653779023-d3ddevr4qepqa13uqlv1ckd0th6k79gf.apps.googleusercontent.com`) + plugin config (reversed ID si nécessaire).

## RevenueCat (abonnements)
- [ ] `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`  
  - Pourquoi : clé SDK RevenueCat côté Android pour les achats In-App.  
  - Où récupérer : RevenueCat Dashboard → Project → API Keys → Public SDK Key (Android) (https://app.revenuecat.com/projects).  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <public_sdk_key_android>`).
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (si iOS)  
  - Pourquoi : clé SDK RevenueCat côté iOS.  
  - Où récupérer : RevenueCat Dashboard → Public SDK Key (iOS) (https://app.revenuecat.com/projects).  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <public_sdk_key_ios>`).
- [ ] `EXPO_PUBLIC_REVENUECAT_WEB_KEY`  
  - Pourquoi : clé SDK RevenueCat côté web (si paywall web).  
  - Où récupérer : RevenueCat Dashboard → Public SDK Key (web) (https://app.revenuecat.com/projects).  
  - Où placer : variable EAS en `plaintext` (ex : `eas env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_WEB_KEY --value <public_sdk_key_web>`).

## Expo / EAS
- [ ] Creds Android (keystore ou Play App Signing via EAS)  
  - Pourquoi : signature requise pour publier sur Play.  
  - Où récupérer : soit générer via `eas credentials`, soit exporter le keystore prod.  
  - Où placer : EAS credentials (dashboard ou `eas credentials --platform android`).
- [ ] Service account Google Play (JSON)  
  - Pourquoi : pour `eas submit` / `--auto-submit`.  
  - Où récupérer : Google Play Console → Paramètres développeur → Comptes de service → créer clé JSON.  
  - Où placer : EAS credentials (dashboard) ou upload via `eas credentials`.

## Hébergement web (si export)
- [ ] URL hébergement + HTTPS actif  
  - Pourquoi : micro web exige HTTPS et OAuth a besoin des origines/redirects finales.  
  - Où récupérer : URL finale de l’hébergeur.  
  - Où placer : Google OAuth (Authorized origins/redirects) + config Supabase si nécessaire.

## Documents légaux / store
- [ ] URL Privacy Policy  
  - Pourquoi : exigée par Play + fiche Data Safety (collecte audio/texte + identifiants).  
  - Où récupérer : page hébergée (site ou CMS).  
  - Où placer : Google Play listing + éventuel lien dans l’app/website.

Notes pratiques
- Stocker tous ces secrets dans EAS (Commandes : `eas secret:create --scope-project --name ... --value ...`).
- Vérifier la cohérence des IDs client Google avec les SHA-1 Play et la config Supabase (Google provider “Skip nonce check” activé, Authorized Client IDs renseignés).
