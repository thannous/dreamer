# Réponse à la revue App Store du 25 novembre 2026 — Noctalia 4.0.1 (27)

Préparé le 26 novembre 2026. Soumission `d9d312b7-c59d-4167-9dd4-fd924bf94269`, revue sur iPad Pro 11 pouces (M4). Rien n'a été écrit dans App Store Connect, Supabase ou RevenueCat, aucune build n'a été lancée, rien n'est déployé. Complète [la préparation du 5 novembre](2026-11-05-soumission-ios.md) : ses notes de revue disaient qu'un invité se connecte avant d'acheter, ce qui n'est plus vrai (texte à jour [plus bas](#notes-pour-léquipe-de-vérification-à-coller-en-anglais)).

## Les trois refus et ce qui change

| Règle | Refus | Changement |
| --- | --- | --- |
| 2.3.10 Métadonnées | La description cite Android | La phrase sur l'abonnement ne nomme plus aucune autre plateforme, dans les six langues. Elle dit aussi qu'aucun compte n'est requis pour s'abonner. Fichiers : `marketing/aso/app-store-listing-2026-11-05.json` (FR, EN), `marketing/aso/4.0.0/app-store-listing-es-de-it-pt-2026-11-18.json` et `textes-fiches-store-4.0.0.md` (ES, DE, IT, PT). Les fiches Google Play ne changent pas. |
| 5.1.1(iv) Micro | Bouton « Autoriser le micro », et « Pas maintenant » qui repousse la demande | Le message avant la demande n'a plus qu'un bouton « Continuer ». Il ne se ferme pas autrement, et la demande du système le suit toujours. « Utiliser le texte » et « Pas maintenant » sont retirés ; écrire reste possible depuis l'écran de capture. |
| 5.1.1(v) Compte | Un invité doit se connecter avant d'acheter Plus | Un invité achète sans rien renseigner. Détail ci-dessous. |

## Acheter Plus sans compte

Voie retenue le 26 novembre 2026 parmi trois (compte silencieux, Plus porté par l'appareil, contestation sans code) : le « compte silencieux ».

1. Un invité touche « S'abonner » : la feuille d'achat de l'App Store s'ouvre, sans écran de connexion. L'achat se fait sur le client anonyme de RevenueCat.
2. Quand le store confirme, l'app crée un compte sans e-mail ni nom (un utilisateur anonyme Supabase) et l'y connecte. RevenueCat rattache l'achat à ce compte, le serveur accorde Plus comme à tout compte.
3. Les rêves de l'invité sont alors copiés vers ce compte, comme à toute création de compte.
4. Créer un vrai compte reste facultatif, à tout moment, dans Réglages → Compte :
   - Apple ou Google : l'identité s'ajoute au compte silencieux. Même compte, même journal, même abonnement.
   - E-mail et mot de passe : pareil, après confirmation de l'adresse.
   - Connexion à un compte qui existe déjà : la session change de compte. Plus suit : dès la connexion, l'app demande au store de le transférer vers ce compte ; les rêves notés sous le compte silencieux restent sur celui-ci et ne sont pas déplacés. Réglages le dit avant.
5. « Restaurer les achats » fonctionne sans compte : un achat retrouvé crée le compte silencieux de la même façon.
6. Un compte silencieux n'a pas de bouton « Se déconnecter » : il n'aurait rien pour se reconnecter. Supprimer le compte reste possible.

Gardes :

- **Pas de paiement sans compte possible.** Avant d'ouvrir l'achat à un invité, l'app vérifie que le serveur accepte les comptes anonymes (`/auth/v1/settings`). Sinon elle garde l'ancien parcours (se connecter d'abord).
- **Paiement passé, compte pas créé** (réseau coupé, app fermée) : l'achat reste « en attente d'activation », l'app réessaie seule au retour au premier plan et au lancement suivant, et le bouton du paywall réessaie sans second paiement.
- **Abus.** N'importe qui peut créer un utilisateur anonyme sur le point d'accès public de Supabase. Le routeur de la fonction `api` refuse donc à un compte silencieux sans Plus actif toutes les routes qui coûtent de l'IA (403 `SILENT_ACCOUNT_PLUS_REQUIRED`). Un compte silencieux dont l'abonnement a expiré doit créer un compte gratuit pour retrouver les analyses mensuelles gratuites.
- Lucid ne change pas : la connexion y précède toujours l'achat.
- Android et le web suivent le même code. Le web ne vend rien aujourd'hui.

## Tes actions, dans l'ordre

Aucune n'est faite. L'ordre compte : la configuration et la fonction d'abord, la build ensuite.

1. **Supabase, projet de production → Authentication.** Activer « Allow anonymous sign-ins » et « Manual linking ». Le fichier `supabase/config.toml` ne règle que l'environnement local. Vérifier la limite « anonymous sign-ins per hour » (30 par IP par défaut).
2. **RevenueCat → Project settings → Transfer behavior.** Doit être « Transfer to new App User ID » (réglage par défaut), sinon Plus ne suit pas vers un compte existant.
3. **Déployer la fonction `api`** depuis le SHA fusionné (garde des comptes silencieux). À faire avant ou avec l'étape 1 : l'étape 1 seule ouvrirait les analyses gratuites aux comptes anonymes.
4. **Build iOS 4.0.1 (28)** depuis le SHA fusionné, puis TestFlight (`release:prepare`, `verify:release`, `release:simulators -- --suites all`, `release:build`).
5. **Sur un iPhone, depuis TestFlight** (achat sandbox) : invité → S'abonner → feuille Apple sans connexion → Plus actif ; Réglages → Compte affiche « Sans compte » ; ajouter Apple garde Plus et le journal ; « Restaurer les achats » en invité après réinstallation ; dictée : message, « Continuer », demande du système.
6. **App Store Connect** : coller les six descriptions ; remplacer les notes de revue ; rattacher la build 28 ; répondre à la revue (texte ci-dessous) ; soumettre.

## Notes pour l'équipe de vérification (à coller en anglais)

Remplacent le paragraphe « Noctalia Plus » et le paragraphe du micro des notes du 5 novembre ; le reste de ces notes ne change pas.

> Noctalia Plus is an optional auto-renewable subscription (monthly or annual): Settings → Subscription, or the offer shown when the free analyses are used up. No account is needed to buy it: as a guest, tap the purchase button and the App Store purchase sheet opens directly. Plus is then active on the device. Creating an account stays optional, at any time, in Settings → Account (Sign in with Apple, Google or email); the app explains that it lets Plus and the journal follow the user to their other devices. Restore Purchases is on the paywall for everyone and needs no sign-in. The paywall shows the price, the billing period, the renewal terms, the Terms of Use (https://noctalia.app/en/terms, which incorporate Apple's standard EULA) and the Privacy Policy.
>
> The microphone and speech recognition are used only for optional dictation. The first time, a short message explains what the microphone is for, with a single Continue button; the system permission request always follows it. Speech is turned into text by Apple's speech recognition; Noctalia keeps no recording.

## Réponse à App Review (en anglais)

> Hello,
>
> Thank you for the review. Version 4.0.1 (28) addresses the three points.
>
> 2.3.10: the description no longer refers to any other platform, in every language.
>
> 5.1.1(v): registration is no longer required to purchase. A guest taps the purchase button on the paywall and the App Store purchase sheet opens directly; Noctalia Plus is then active on the device. Restore Purchases also works without signing in. Creating an account is optional and offered in Settings → Account, with the explanation that it lets the subscription follow the user to their other devices.
>
> 5.1.1(iv): the message shown before the microphone request now has a single "Continue" button and can no longer be dismissed or postponed; the system permission request always follows it.
>
> Best regards

## Vérifié et non vérifié

Vérifié sur ce poste, branche `fix/app-review-compliance` :

- Types (app et tests) et lint : propres.
- Jest : 582 suites, 6 876 tests, tous passés. Deno (`api`, `revenuecat-webhook`) : 442 passés.
- Parcours TesterArmy sur l'app web simulée (store et comptes simulés) : un invité achète Plus sans compte puis voit « Sans compte » et l'offre de créer un compte ; un achat annulé ne crée rien ; une restauration vide ne crée rien, une restauration avec achat active Plus ; les parcours existants du paywall invité, de l'offre en allemand à 320 px et des limites invité, mis à jour.

Non vérifié :

- Un vrai achat sandbox sur iPhone, et le rattachement RevenueCat anonyme → compte.
- Supabase réel : création du compte anonyme, ajout d'Apple, de Google et d'un e-mail (confirmation de type « changement d'adresse »), avec la configuration de production.
- La feuille du micro sur un iPhone (le parcours natif `dreamer-voice` est mis à jour, pas rejoué).
- Android : le parcours natif de facturation est mis à jour, pas rejoué.

## Limites connues

- Se connecter à un compte existant depuis un compte silencieux ne déplace pas les rêves notés entre l'achat et la connexion.
- Si « Manual linking » reste désactivé en production, Apple ou Google crée un compte séparé au lieu de compléter le compte silencieux : Plus suit, le journal non.
- Un invité qui restaure un achat fait sous un compte Noctalia existant le transfère vers un compte silencieux ; se connecter à son compte puis restaurer le ramène. Le paywall propose « J'ai déjà un compte » pour éviter ce détour.
