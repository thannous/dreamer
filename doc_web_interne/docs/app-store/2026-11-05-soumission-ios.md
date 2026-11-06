# Soumission App Store iOS — Noctalia, première version

Préparé le 5 novembre 2026 à partir de l'audit App Store du même jour. Rien n'a été écrit dans App Store Connect, aucune build EAS n'a été lancée, aucun secret ni déploiement Supabase n'a été touché. Remplace [la préparation 3.5.0 du 8 octobre](2026-10-08-soumission-ios.md), dont les notes de revue étaient fausses (Gemini pour le texte, HealthKit).

## Verdict

**NOT READY TO SUBMIT.** La partie code est faite (ci-dessous) ; la soumission attend tes actions, dans l'ordre de la [liste](#tes-actions-dans-lordre). Reste une bloquante : Sign in with Apple en production (B1). La version est tranchée (B2, 3.8.0) et les variables EAS de production sont vérifiées (B3, 2026-11-06).

## Ce que le code règle déjà

| Point de l'audit | Changement | Où |
| --- | --- | --- |
| B4 Textes d'autorisation | Micro et reconnaissance vocale disent pourquoi, en six langues (`locales` d'app.json, `pt-BR` comme les phrases Siri) ; plus de texte Face ID inutile (`expo-secure-store` avec `faceIDPermission: false`) | `app.json` |
| S1 Barre d'état | `UIViewControllerBasedStatusBarAppearance` à `true` : avec le SDK iOS 27, `StatusBar` ne faisait plus rien (texte sombre sur l'onboarding sombre) | `app.json` |
| S2 Manifeste de confidentialité | `ios.privacyManifests` (UserDefaults CA92.1 + 1C8F.1, horodatage de fichiers C617.1, démarrage système 35F9.1, espace disque E174.1, aucun pistage) et un manifeste propre au widget (1C8F.1), vérifié par un prebuild iOS | `app.json`, `plugins/withWidgetPrivacyManifest.js` |
| S3 Restaurer les achats | Visible aussi pour un invité : il se connecte, revient sur l'offre et la restauration part seule | `app/paywall.tsx` |
| B1 (code) Suppression d'un compte Apple | La révocation Apple passe avant toute suppression : un refus n'efface plus rien. Sans jeton gardé à la connexion, l'app redemande Apple une fois et envoie ce code ; le serveur l'échange puis révoque | `supabase/functions/api/routes/account.ts`, `services/accountDeletionService.ts` |
| B3 (code) Clés de build iOS | Le hook EAS `eas-build-pre-install` arrête une build iOS `production` sans clé RevenueCat `appl_…` ou sans les deux identifiants Google | `scripts/mobile-release.js` |
| S6 Préflight | `check-eas-build-inputs` refuse de tourner à côté d'un dossier `ios/` (ou `android/`) local, qu'EAS n'envoie pas | `scripts/check-eas-build-inputs.js` |
| S8 « Noter l'app » | Masqué sur iOS tant que la page App Store n'existe pas (`IOS_APP_STORE_PAGE_LIVE` dans `lib/storeReview.ts`, à passer à `true` dans la version qui suit l'acceptation). Les clés réseau local d'`expo-dev-client` sont déjà retirées des builds Release par le plugin `expo-dev-launcher` (SDK 58) : rien à ajouter | `lib/storeReview.ts` |
| B5 Fiche | Fiche FR/EN corrigée : Anthropic (Claude) pour le texte, Google (Gemini) pour les images, URL d'assistance avec contact, widgets, Siri, sons pour dormir | `marketing/aso/app-store-listing-2026-11-05.json` |

Ces changements modifient l'empreinte native : une nouvelle build est nécessaire (elle l'était déjà).

## Tes actions, dans l'ordre

### Décisions

1. **B2 Version : 3.8.0, tranché le 2026-11-06.** 3.8.0 n'a jamais été publiée : depuis `2d097c846`, elle garde son numéro et `release:prepare` la ré-épingle sur le dernier `origin/master` (`"action": "pin"`), sans toucher `app.json` ni les lockfiles. Quand un build part en review App Store, enregistrer son commit : `npm run release:published -- --app noctalia --ref <gitCommitHash du build>` ([MOBILE_VERSIONING.md](../MOBILE_VERSIONING.md)).
2. **S5 Crise et automutilation.** La conversation IA ne traite pas ces sujets à part. À décider : une réponse fixe et localisée avec des ressources d'aide (3114 en France, 988 aux États-Unis, findahelpline.com) quand un rêve ou un message en parle, au lieu d'une réponse du modèle. Tes réponses au questionnaire d'âge en dépendent.
3. **S7 « Échanges illimités ».** Le paywall vend Plus « illimité » alors que `constants/limits.ts` plafonne à 100 messages par rêve. Soit écrire « jusqu'à 100 échanges par rêve » dans les six langues, soit confirmer que le serveur n'a pas de plafond Plus et retirer la constante.
4. **S4 Icône.** `assets/images/icon.png` fait 512 × 512 : l'icône App Store 1024 est agrandie, donc floue. Exporter un PNG 1024 × 1024 sans transparence et remplacer le fichier (nouvelle build native).

### Sign in with Apple en production (B1)

La production n'a aucune identité Apple et aucun secret `APPLE_*` : chaque connexion Apple échoue à garder son jeton, et la suppression d'un compte Apple renvoyait 503. Le code gère maintenant l'absence de jeton, mais il lui faut les secrets pour échanger et révoquer.

1. Supabase Dashboard → Authentication → Providers → Apple : activé, avec `com.tanuki75.noctalia` parmi les Client IDs.
2. Apple Developer → Keys : une clé « Sign in with Apple » rattachée à l'App ID principal `com.tanuki75.noctalia`.
3. Secrets de la fonction (le fichier `.p8` ne va jamais dans le dépôt) :
   ```bash
   npx --no-install supabase secrets set --project-ref usuyppgsmmowzizhaoqj \
     APPLE_CLIENT_ID=com.tanuki75.noctalia APPLE_TEAM_ID=27BLU7U28W \
     APPLE_KEY_ID=<KID> APPLE_PRIVATE_KEY="$(cat AuthKey_<KID>.p8)"
   ```
4. Déployer la fonction `api` de ce lot (nouvelle réponse 409 `apple_authorization_required` et révocation avant suppression).
5. Sur TestFlight : connexion Apple, puis suppression du compte ; vérifier que l'identité a disparu.

### Variables EAS (B3)

En lecture seule : `npx eas-cli@25.1.1 env:list --environment production`. Doivent y figurer :

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…` (sans elle, le paywall n'a aucun produit) ;
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=359653779023-d3ddevr4qepqa13uqlv1ckd0th6k79gf.apps.googleusercontent.com` (le même que l'`iosUrlScheme` d'app.json) ;
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

La build s'arrête désormais dès `eas-build-pre-install` s'il en manque une. **Vérifié le 2026-11-06** sur l'environnement EAS `production` ; la ligne iOS de [PRODUCTION_CONSTANTS.md](../PRODUCTION_CONSTANTS.md) est cochée.

### App Store Connect (O1, O2)

1. Accords, taxes et banque : contrat « Paid Apps » actif.
2. Statut de commerçant (DSA) déclaré, sinon l'app est retirée des vitrines de l'UE.
3. Questionnaire d'âge (format actuel), après la décision S5.
4. Confidentialité de l'app : [tableau plus bas](#confidentialité-de-lapp-proposition-à-vérifier).
5. Droits sur le contenu : oui, contenu tiers (réponses d'IA, sons pour dormir) dont les droits sont détenus.
6. Catégorie (Style de vie ; Santé et forme en secondaire à confirmer), copyright « 2026 TiMax », prix et disponibilité.
7. URL de confidentialité : https://noctalia.app/en/privacy-policy (FR : https://noctalia.app/fr/politique-confidentialite).
8. Abonnements : groupe « Noctalia Plus » avec `noctalia_plus_monthly` et `noctalia_plus_annual`, noms et descriptions FR/EN, prix, offre d'essai identique au texte du paywall, capture de revue du paywall pour chaque produit, état « Prêt à être soumis » et **rattachés à la version** (un premier abonnement part avec une build).
9. RevenueCat : app App Store avec la clé In-App Purchase (`.p8`) ; URL des notifications App Store Server V2 renseignée dans App Store Connect ; l'offre courante contient les deux produits iOS. Tester achat et restauration en sandbox depuis TestFlight, pas depuis le dev client.

### Comptes de démonstration (O3)

Créer deux comptes e-mail/mot de passe dédiés (jamais ton compte) : un gratuit, un Plus via un droit promotionnel RevenueCat. Les inscrire dans « Informations de connexion », avec ton nom, ton téléphone et contact@noctalia.app, puis remplacer les `<…>` des notes ci-dessous.

### Captures (O4)

Les captures et vidéos du 8 octobre ne sont pas dans le dépôt et l'interface a changé (capture en conversation, widgets). Les refaire depuis une build Release simulateur en mode démo : `EXPO_PUBLIC_MOCK_MODE=true`, `EXPO_PUBLIC_MOCK_SHOWCASE=fr` (ou `en`), profil mock Plus, barre mock « H J S G » masquée. Au moins 3 par langue en 1320 × 2868 (iPhone 6,9"). iPhone uniquement : pas de capture iPad. Suivre les règles de stockage du Mac mini (`/Users/timax/Projects/infra-ops/storage-guard/AGENT_RULES.md`).

### Build, envoi et contrôle (O5)

Depuis un checkout propre du SHA préparé (sans dossier `ios/` : le préflight refuse désormais d'en lire un) :

```bash
npm ci
npm run verify:release            # jamais avec VERIFY_LOCAL_KEEP_FAILED=1
mise exec -- npm run release:simulators -- --ref <sha> --suites all   # app.json et le serveur ont changé
npm run release:check -- --app noctalia
npm run release:build -- --app noctalia --platform ios
node scripts/mobile-release.js submit-internal --app noctalia --platform ios --id <EAS_UUID> --dry-run
node scripts/mobile-release.js submit-internal --app noctalia --platform ios --id <EAS_UUID>
```

Dans l'IPA : textes d'autorisation de `Info.plist` (et `fr.lproj/InfoPlist.strings`), aucune clé `NSHealth*`, `otool -L` sans HealthKit, `PrivacyInfo.xcprivacy` dans l'app et dans `ExpoWidgetsTarget.appex`, versions de l'`.appex` égales à celles de l'app (ITMS-90473). Après l'envoi : Xcode Organizer → Generate Privacy Report sur l'archive, et les e-mails d'App Store Connect (ITMS-91053).

Sur un iPhone réel, depuis TestFlight : analyse en invité (App Attest production), connexions Apple et Google, achat puis restauration sandbox (aussi en partant invité : Restaurer → connexion → restauration), suppression d'un compte Apple, widgets, raccourci Siri, minuterie des sons en Live Activity, dictée en français, barre d'état en mode clair sur l'onboarding.

Puis soumettre la version avec ses abonnements.

## Fiche App Store

Source unique : [`marketing/aso/app-store-listing-2026-11-05.json`](../../../marketing/aso/app-store-listing-2026-11-05.json). Limites Apple respectées :

| Champ | FR | EN | Limite |
| --- | --- | --- | --- |
| Nom | 27 | 23 | 30 |
| Sous-titre | 28 | 28 | 30 |
| Texte promotionnel | 164 | 152 | 170 |
| Mots-clés | 95 | 90 | 100 |
| Description | 2 238 | 2 016 | 4 000 |

- URL d'assistance : https://noctalia.app/fr/a-propos et https://noctalia.app/en/about, qui donnent contact@noctalia.app (règle 1.5).
- URL marketing : https://noctalia.app/
- « Nouveautés » n'est pas demandé pour une première version ; le texte du fichier sert à la mise à jour suivante.
- La description nomme les fournisseurs d'IA comme la boîte d'accord de l'app et la politique de confidentialité, et garde les conditions de l'abonnement (règle 3.1.2).

## Notes pour l'équipe de vérification (à coller en anglais)

> Noctalia is a dream journal. No account is needed to try it: on the introduction, tap "Skip", then write or dictate a dream on the Capture screen. A guest gets two free AI analyses with their illustrations.
>
> AI: dream analyses and the guided conversation are written by Anthropic (Claude); dream illustrations are made by Google (Gemini). Before the first AI request the app asks for permission in a dialog that names both providers ("Bring your dream to life?"). Declining keeps the journal fully usable without AI. Each analysis has a "Report generated content" action.
>
> Noctalia Plus is an optional auto-renewable subscription (monthly or annual): Settings → Subscription, or the offer shown when the free analyses are used up. Plus belongs to a Noctalia account because its benefits are AI quotas kept on our server and shared across iPhone, Android and the web app (dream.noctalia.app). A guest who taps Subscribe or Restore Purchases is asked to sign in first; Sign in with Apple takes one tap. Restore Purchases is on the paywall for everyone and runs right after sign-in. The paywall shows the price, the billing period, the renewal terms, the Terms of Use (https://noctalia.app/en/terms, which incorporate Apple's standard EULA) and the Privacy Policy.
>
> Demo accounts (Settings → Account → Sign in, then email and password):
> - Free: `<free account email>` / `<password>`
> - Plus: `<Plus account email>` / `<password>`
>
> Account deletion: Settings → Legal → Delete account, then confirm twice. It deletes the account and its data on our server. For an account created with Sign in with Apple, Apple may ask once more so that we can revoke the Apple token.
>
> Background audio (UIBackgroundModes audio) is used only by Sleep sounds (Explore → Sleep sounds): a sound keeps playing with the screen locked until its timer ends, and the timer shows as a Live Activity.
>
> Widgets: "Tell my dream" (Lock Screen and Home Screen) opens the capture screen; "Last painted dream" (Home Screen) shows the latest dream illustration. Siri and Shortcuts: "Note a dream in Noctalia".
>
> The microphone and speech recognition are used only for optional dictation. Speech is turned into text by Apple's speech recognition; Noctalia keeps no recording.
>
> This version does not use HealthKit: the binary does not link it and asks for no Health data.
>
> Noctalia offers prompts for reflection. It does not provide medical or psychological diagnosis.

## Confidentialité de l'app (proposition à vérifier)

Aucun pistage, aucune publicité, aucun SDK de pistage : pas de demande ATT.

| Donnée Apple | Liée à l'utilisateur | Finalité |
| --- | --- | --- |
| Coordonnées → Adresse e-mail (compte) ; Nom si Apple ou Google le fournit | Oui | Fonctionnalité de l'app |
| Contenu utilisateur → Autre contenu (rêves, analyses, conversations, illustrations) | Oui | Fonctionnalité de l'app |
| Contenu utilisateur → Photos ou vidéos (photo de la bibliothèque donnée à un rêve, envoyée vers Supabase Storage) | Oui | Fonctionnalité de l'app |
| Achats (RevenueCat) | Oui | Fonctionnalité de l'app |
| Identifiants → Identifiant utilisateur | Oui | Fonctionnalité de l'app |
| Identifiants → Identifiant d'appareil (quotas invités ; Expo Observe) | Non | Fonctionnalité de l'app, analyse |
| Diagnostics → Plantages, performances, autres diagnostics (Expo Observe, désactivable dans Paramètres) | Non | Fonctionnalité de l'app, analyse |
| Utilisation → Interactions avec le produit (mesure d'usage facultative) | Non | Analyse |

L'audio n'est pas collecté : la dictée passe par la reconnaissance vocale d'Apple et aucun enregistrement n'est envoyé à Noctalia (le client n'appelle pas la route serveur `/transcribe`).

## Risques de refus et état

- **4.8 / 5.1.1(v) Sign in with Apple et suppression** : code prêt ; secrets et test TestFlight à faire (B1).
- **3.1.1 Restaurer les achats** : visible pour tous sur le paywall.
- **5.1.1 Textes d'autorisation** : spécifiques, traduits, sans Face ID.
- **2.1 Paywall sans produit** : la build s'arrête sans clé `appl_` (B3) ; clé présente dans EAS `production`, vérifiée le 2026-11-06.
- **2.3 Métadonnées** : fournisseurs d'IA et URL d'assistance corrigés ; « illimité » à trancher (S7).
- **Confidentialité des API** : manifestes de l'app et du widget déclarés ; rapport Xcode à vérifier après l'archive.
- **Sécurité de l'IA et classement d'âge** : décision S5 avant le questionnaire.
- **2.1 Lien mort** : « Noter l'app » masqué sur iOS avant la publication.

## Vérifications faites pour cette préparation

- `expo config --type introspect` (profil `production`, sans dossier `ios/`) : textes micro et dictée de l'app, pas de `NSFaceIDUsageDescription`, `UIViewControllerBasedStatusBarAppearance` à `true`, `ios.privacyManifests` présent, aucune clé `NSHealth*`.
- Prebuild iOS dans un dossier temporaire : `PrivacyInfo.xcprivacy` de l'app (5 raisons) et du widget (1C8F.1) chacun dans les ressources de sa cible, six `InfoPlist.strings`, projet lu par `xcodebuild -list`, second prebuild sans doublon.
- Tests Jest, Deno (`api/routes/account.test.ts`) et du script de release liés à ces changements ; parcours web du paywall invité.
- Non vérifié : contenu réel de l'environnement EAS, build EAS, iPhone réel, TestFlight.
