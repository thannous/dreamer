Google Auth Setup — Current Status

- App scheme configured: `app.json`:8 (`scheme: "dreamapp"`) ✅
- Google Sign-In plugin present: `app.json`:58 (with iOS scheme at 60) ✅
- Native Google Sign-In library installed: `@react-native-google-signin/google-signin` in `package.json`:22 ✅
- Initialize Google Sign-In on app startup: `app/_layout.tsx`:56 ✅
- Settings screen initializes + listens for auth: `app/(tabs)/settings.tsx`:16 ✅
- Web sign-in via Supabase OAuth added: `lib/auth.ts`:109 and `components/auth/GoogleSignInButton.tsx`:13 ✅
- Env template for Google IDs: `.env.google.template`:1 ✅

Pending (requires your credentials/actions)

- Fill `.env.local` with your real Google Client IDs (web, Android, iOS). See `.env.google.template` and `GOOGLE_CONFIG_GUIDE.md`.
- In Supabase: enable Google provider, paste Web Client ID/Secret, add Authorized Client IDs (Web + Android), and enable “Skip nonce check”. See `GOOGLE_CONFIG_GUIDE.md`.
- Android: add both development and production SHA-1 to the Android OAuth client in Google Cloud Console.
- iOS: replace `YOUR-IOS-CLIENT-ID-REVERSED` in `app.json` plugin with your reversed iOS Client ID.
- EAS: prefer storing Google client IDs as EAS project secrets for production builds.
- Build a dev client via EAS and test sign-in on device (Expo Go won’t work for native Google Sign-In).

Quick test paths

- Web (Expo Web): Button now triggers Supabase OAuth popup. Requires Supabase Google provider configured with Web Client ID/Secret and allowed origins/redirects.
- Android/iOS (Dev Client): Button uses native Google Sign-In, exchanges ID token with Supabase (`signInWithIdToken`). Requires Web Client ID in `.env.local` and Supabase provider configured with “Skip nonce check”.

Files touched

- app/_layout.tsx:24, 56 — initialize Google Sign-In at startup
- lib/auth.ts:109 — add `signInWithGoogleWeb()` OAuth flow for web
- components/auth/GoogleSignInButton.tsx:4, 13 — call web or native sign-in based on platform

Notes

- `app.json` already has `scheme: "dreamapp"`; keep Supabase redirect URL `dreamapp://google-auth` in your Supabase settings.
- If you only target Android initially, you can keep the iOS URL scheme placeholder as-is.
