# RevenueCat QA Workflow

Ce runbook sert a valider les parcours d'abonnement Noctalia sans confondre les trois couches de preuve.

## 1. Mock Lab

Objectif: verifier l'UI, les profils, les quotas et les transitions sans Store externe.

Commandes:

```bash
npm run start:mock
npm run subscription:qa:verify-local
npm run subscription:qa:report
npm run test:e2e:subscription-qa -- --no-restart-metro --retries 0
```

Si Metro vient d'etre lance avec un autre fichier d'environnement, ne pas utiliser
`--no-restart-metro` pour le premier run. Redemarrer Metro charge le bon bundle
mock/Test Store; `--no-restart-metro` sert ensuite aux relances rapides dans la
meme couche.

Dans l'app: `Settings -> Subscription QA Lab`.

Scenarios couverts:

- guest sans compte
- new free
- existing free
- plus mensuel mock
- plus annuel mock
- annule mais actif jusqu'a expiration
- expire et revenu en free
- switch compte plus -> free

Preuve attendue:

- `Tier` change correctement
- `Product` change entre `mock_monthly` et `mock_annual`
- `Renews` passe a `no` sur le scenario cancelled
- les quotas passent illimites en `plus`, puis reviennent limites en `free`
- l'ouverture du paywall garde la meme lecture d'etat

Le mode release gate doit rester rouge tant que les achats reels n'ont pas ete preuves:

```bash
npm run subscription:qa:release-gate
```

Pour revalider uniquement le harnais local sans demarrer Metro ni toucher au Store:

```bash
npm run subscription:qa:verify-local
```

Cette commande inclut les preflights d'achat monthly et annual avec un compte factice. Elle valide
le chemin CLI garde, mais ne lance pas Maestro et ne peut pas ouvrir le Store sans
`REVENUECAT_QA_APPROVAL`. Elle verifie aussi, avec un chemin de preuve isole, que la release gate
reste bloquee quand aucune preuve manuelle n'est fournie, et que ce blocage vient bien des preuves
manquantes, pas d'un check local casse.

`npm run subscription:qa:report` affiche aussi `Current Session Readiness`. Cette section est le
premier diagnostic a lire avant de reprendre les tests reels: elle indique si les variables
`REVENUECAT_QA_EMAIL` / `REVENUECAT_QA_PASSWORD` sont presentes, si l'approbation d'achat Test Store
est definie, rappelle d'extraire l'app user id device avant d'enregistrer une preuve, rappelle de
verifier `npm run android:device` jusqu'a `ADB: READY`, et bloque mentalement `play_monthly` tant
que RevenueCat/Play ne renvoie pas un base plan mensuel `P1M` pour `prodfce10ef2a8`.

Apres chaque relecture live RevenueCat MCP de l'etat store Play, enregistrer le JSON compact dans le
snapshot local gitignore. Le rapport QA le relit ensuite et garde `play_monthly` bloque si le
produit mensuel live contredit la preuve manuelle:

```bash
npm run subscription:qa:play-state -- --input revenuecat-store-state.json
npm run subscription:qa:report
```

La commande accepte aussi le JSON en stdin et normalise les deux produits Play attendus
(`prodfce10ef2a8` et `prod98337b31be`) dans
`doc_web_interne/docs/revenuecat-play-store-state.local.json`.

La route Google Play Developer API directe n'est exploitable que si une authentification locale porte
le scope `https://www.googleapis.com/auth/androidpublisher`, comme demande par l'endpoint officiel
`monetization.subscriptions.get`. Au dernier essai local du 2026-05-14, `gcloud auth print-access-token`
refuse ce scope pour le compte utilisateur configure, et l'ADC locale atteint l'endpoint mais renvoie
`403 PERMISSION_DENIED` / `insufficient authentication scopes` pour `noctalia_plus:monthly` et
`noctalia_plus:annual`. Sans service account Play Developer ou reauth ADC avec ce scope, la correction
`P1M` reste a faire/verifier via Play Console puis RevenueCat MCP.

Verification UI Play Console du 2026-05-14: le compte developpeur `TiMax group` ouvre l'app
`Noctalia: Smart Dream Journal` (`com.tanuki75.noctalia`). La page `Monetiser avec Play ->
Abonnements -> Noctalia Plus` liste `annual` (`Annuel, renouvellement automatique`) et `monthly`
(`Mensuel, renouvellement automatique`) comme forfaits actifs, tous deux mis a jour le
`26 nov. 2025`; elle affiche aussi `Probleme concernant votre profil de paiement`. Cette lecture
confirme que le forfait mensuel existe cote Play Console, mais il faut encore corriger/resynchroniser
RevenueCat ou relire via MCP/API apres correction, car le snapshot RevenueCat actuel lit toujours
`prodfce10ef2a8` comme `annual/P1Y`.

Quand une preuve manuelle existe, copier `doc_web_interne/docs/revenuecat-qa-evidence.example.json`
vers `doc_web_interne/docs/revenuecat-qa-evidence.local.json`, puis passer le gate concerne a
`"status": "passed"` avec un `testedAt` valide, `tester`, `appUserId` et une preuve courte. La
preuve doit etre specifique au test realise: le texte d'exemple du template ne suffit pas et reste
bloque par `subscription:qa:release-gate`. Le fichier `.local.json` est ignore par git pour eviter
de committer des emails, ids testeur ou chemins de captures.
`appUserId` doit etre l'UUID Supabase/RevenueCat du compte teste, pas l'email du testeur.

Helper recommande apres un test manuel:

```bash
npm run subscription:qa:device-app-user-id -- --device emulator-5554 --env-file .env.teststore
```

Cette commande lit les preferences RevenueCat du build debug via `adb shell run-as`, masque la cle
SDK et imprime l'UUID a utiliser comme `--app-user-id` dans la preuve locale. Elle ne modifie pas
l'app ni RevenueCat.

```bash
npm run subscription:qa:evidence -- \
  --gate test_store_monthly \
  --tester tester@example.com \
  --app-user-id 00000000-0000-4000-8000-000000000000 \
  --evidence "monthly purchase completed, plus active, quotas unlimited"
```

Pour une gate `play_*`, ajouter aussi le build EAS installe depuis Play Internal Testing:

```bash
npm run subscription:qa:evidence -- \
  --gate play_monthly \
  --tester tester@example.com \
  --app-user-id 00000000-0000-4000-8000-000000000000 \
  --eas-build-id 310244ed-027b-4028-8522-70c0f676a0e9 \
  --evidence "Play purchase completed, product noctalia_plus:monthly, base plan P1M confirmed, backend converged"
```

`--eas-build-id` doit etre l'UUID EAS du build installe, pas seulement le numero de build Android.

Si un fichier de preuve locale existe mais ne passe pas la gate, `npm run subscription:qa:report`
affiche une section `Evidence Diagnostics` avec le premier champ a corriger pour chaque scenario.
Si le fichier JSON est mal forme, le rapport reste lisible et bloque sur `Local evidence file parses`.

## 2. RevenueCat Test Store

Objectif: tester le vrai SDK RevenueCat sans Google Play Billing.

Commandes:

```bash
npm run start:teststore
npm run test:e2e:subscription-teststore -- --retries 0
npx eas build -p android --profile revenuecat-teststore
```

Pour passer de mock a Test Store, redemarrer Metro ou lancer le test sans
`--no-restart-metro`. Un Metro encore charge avec `.env.mock` affichera
`Mock services` meme si `.env.local` vient d'etre remplace par `.env.teststore`.

Configuration attendue:

- `.env.teststore` utilise la cle Test Store `test_zqltcBoDiTWPWmuyXTXTbYkJPrz`
- `eas build --profile revenuecat-teststore` active `EXPO_PUBLIC_SUBSCRIPTION_QA_LAB=true`
- entitlement RevenueCat: `Noctalia Plus`
- offering: `default`
- packages: `$rc_monthly`, `$rc_annual`
- produits Test Store: `monthly`, `yearly`

Couverture automatisee:

- readiness SDK sans achat: `Probe SDK` charge les packages Test Store

Scenarios manuels a valider avec accord explicite d'achat:

- achat mensuel Test Store: valide localement le 2026-05-14 sur `Pixel_7_Play_API_36`
- achat annuel Test Store: valide localement le 2026-05-14 sur `Pixel_7_Play_API_36`
- restore sur le meme utilisateur: valide localement le 2026-05-14 apres reinstall debug
- refresh apres changement externe RevenueCat: valide via refresh QA Lab pendant les achats/restores
- switch compte apres achat: encore a valider avec un deuxieme compte reel non abonne

Preuve attendue:

- le lab affiche `RevenueCat Test Store`
- `Probe SDK` affiche `SDK probe completed` et `packages 2`
- `Tier` passe a `plus / active`
- `Server version` augmente apres refresh serveur
- les quotas deviennent illimites

Preuve locale actuelle:

- `test_store_monthly`, `test_store_annual` et `restore_after_reinstall` sont passes dans
  `doc_web_interne/docs/revenuecat-qa-evidence.local.json`.
- L'app user id observe sur device est `1239729f-7468-48c9-b26a-7aa8b4a82591`.
- `subscription:qa:report` affiche 3 scenarios manuels verifies et 4 gates restantes.

Checklist d'achat Test Store:

| Etape | Preuve a capturer | Statut |
| --- | --- | --- |
| Compte test connecte | `User` affiche l'id/email du testeur et `Auth` affiche `ready` | manuel |
| Probe SDK | `SDK probe completed`, `packages 2`, `$rc_monthly`, `$rc_annual` | automatise |
| Achat mensuel | action `monthly purchase completed`, `Product` mensuel, `Tier plus / active` | valide localement |
| Refresh serveur | `Server version` augmente et les quotas deviennent illimites | valide localement |
| Restore | action `Restore completed` avec le meme app user id | valide localement |
| Switch compte | un second compte reste `free / inactive` apres logout/login | bloque: second compte reel requis |

Flow d'achat garde par approbation explicite:

Preflight sans achat, utile avant de demander l'approbation:

```bash
REVENUECAT_QA_EMAIL=tester@example.com \
REVENUECAT_QA_PASSWORD='password' \
npm run test:e2e:subscription-teststore:purchase:preflight -- --plan monthly --device emulator-5554
```

Le preflight valide le plan, les identifiants et les arguments Maestro, affiche le compte test masque,
puis s'arrete sans lancer Maestro ni ouvrir le Store.

```bash
REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE \
REVENUECAT_QA_EMAIL=tester@example.com \
REVENUECAT_QA_PASSWORD='password' \
npm run test:e2e:subscription-teststore:purchase -- --plan monthly --device emulator-5554
```

Changer `--plan monthly` en `--plan annual` pour le second abonnement. Le wrapper refuse de lancer
le flow si `REVENUECAT_QA_APPROVAL` n'est pas exactement `I_APPROVE_TEST_STORE_PURCHASE`.

## 3. Google Play Internal Testing

Objectif: valider le chemin release reel.

Prealable avant build Play: les changements QA RevenueCat doivent etre dans un commit pousse. Le
dernier build Android Store verifie le 2026-05-10 (`310244ed-027b-4028-8522-70c0f676a0e9`) date du
2026-05-04 et ne contient pas ce workflow QA.

Scope de commit recommande pour eviter de melanger les changements SEO/docs non lies:

```bash
git add \
  .env.mock .env.teststore .env.playstore .gitignore app.json \
  'app/(tabs)/settings.tsx' constants/subscription.ts eas.json lib/env.ts lib/testIDs.ts \
  package.json package-lock.json \
  components/subscription/SubscriptionQALab.tsx \
  maestro/subscription-qa-lab.yml \
  maestro/subscription-teststore-readiness.yml \
  maestro/subscription-teststore-purchase-manual.yml \
  scripts/subscription-qa-report.js \
  scripts/subscription-qa-report.test.js \
  scripts/run-subscription-teststore-purchase.js \
  scripts/run-subscription-teststore-purchase.test.js \
  scripts/update-subscription-qa-evidence.js \
  scripts/update-subscription-qa-evidence.test.js \
  scripts/verify-subscription-qa-local.js \
  scripts/verify-subscription-qa-local.test.js \
  doc_web_interne/docs/revenuecat-qa-evidence.example.json \
  doc_web_interne/docs/revenuecat-qa-workflow.md \
  doc_web_interne/docs/revenuecat-workflow-completion-audit.md \
  services/mocks/subscriptionServiceMock.ts \
  services/mocks/subscriptionServiceMock.test.ts \
  tests/app-routes/settingsScreen.test.tsx
git commit -m "test(revenuecat): add subscription QA workflow"
git push
```

Commandes:

```bash
npm run start:playstore
npm run android:gates:strict
npx eas build -p android --profile preview
```

`npm run android:gates:strict` est volontairement bloquant avant release Android: il execute
`subscription:qa:release-gate` et echoue tant que les gates RevenueCat manuelles/externes ne sont
pas toutes fermees. Au 2026-05-14, il echoue encore sur `RevenueCat subscription QA release gate`
avec 4 gates restantes.

Pour generer un build Store installable via Google Play Internal Testing, utiliser plutot:

```bash
npx eas build -p android --profile production --auto-submit-with-profile internal --non-interactive
```

Si `npx` echoue localement sur le cache `~/.npm`, utiliser un cache workspace sans toucher aux
permissions globales:

```bash
npm_config_cache=.npm-cache npx eas-cli build -p android --profile production --auto-submit-with-profile internal --non-interactive
```

ou via Expo MCP apres push:

```text
build_run appFullName=@tanuki75/noctalia platform=ANDROID buildProfile=production gitRef=<branch>
build_submit platform=ANDROID track=internal buildId=<new-build-id>
```

Configuration attendue:

- `.env.playstore` utilise la cle Android `goog_BFWJqTqAtQUnwYisczZcZrnsanw`
- les profils EAS `release`, `preview`, `production-apk`, `production` utilisent la cle Google Play
- produits Google Play RevenueCat:
  - `noctalia_plus:monthly`
  - `noctalia_plus:annual`
- etat Store live attendu avant achat:
  - monthly: base plan mensuel, periode `P1M`
  - annual: base plan annuel, periode `P1Y`

Le 2026-05-11, RevenueCat MCP a confirme `status=ok` pour les deux produits Play, mais
`prodfce10ef2a8` (`noctalia_plus:monthly`) renvoie encore `base_plan_id=annual` et
`billing_period=P1Y`. Ne pas valider `play_monthly` tant que ce produit n'a pas ete corrige
cote Play Console/RevenueCat. L'app utilise `product.subscriptionPeriod` comme garde locale
pour eviter d'afficher un produit `P1Y` comme mensuel, mais cette garde ne remplace pas la
configuration Store correcte.

Correction Play Console a faire avant de reprendre `play_monthly`:

1. Ouvrir Play Console -> `Monetize with Play` -> `Products` -> `Subscriptions`.
2. Ouvrir la subscription correspondant a `noctalia_plus:monthly`.
3. Verifier les `Base plans and offers`.
4. Le base plan utilise par `noctalia_plus:monthly` doit etre auto-renewing avec billing period mensuel (`P1M` cote API/RevenueCat), pas `annual`/`P1Y`.
5. Si le base plan active est deja `annual`, creer ou selectionner un base plan mensuel dedie, verifier disponibilite regionale/prix, puis reactiver/sauvegarder.
6. Relancer une lecture RevenueCat MCP `get_product_store_state` sur `prodfce10ef2a8` et ne continuer que si `billing_period=P1M`.

References officielles Google Play: `Create and manage subscriptions` explique que les base plan IDs
doivent etre planifies car ils ne peuvent plus etre changes/reutilises apres activation, et
`Understanding subscriptions` rappelle qu'un base plan definit la periode de facturation, le type de
renouvellement et le prix.

Scenarios a valider sur un build installe via Play Internal Testing:

- achat mensuel
- achat annuel
- restore apres reinstall
- annulation depuis Play
- expiration / renouvellement de test
- grace period / paiement refuse si disponible dans Play Console
- switch compte apres achat

Preuve attendue:

- RevenueCat Customer affiche le meme app user id que Supabase `auth.users.id`
- la preuve locale de chaque gate Play contient l'id du build EAS installe
- `subscription_state` contient `tier=plus`, `is_active=true`, `product_id` correct
- `subscription_events` contient un evenement `purchase`, `restore`, `webhook` ou `subscription_refresh`
- `app_metadata.subscription_version` correspond au retour `/subscription/refresh`
- les quotas backend acceptent les usages plus sans 429

Diagnostic local utile si Play Store affiche `Your device isn't compatible with this version`:

```bash
bundletool build-apks \
  --bundle=/private/tmp/noctalia-ddbc756d.aab \
  --output=/private/tmp/noctalia-ddbc756d-signed.apks \
  --device-spec=/private/tmp/noctalia-device-spec.json \
  --ks=/private/tmp/noctalia-debug.keystore \
  --ks-key-alias=androiddebugkey \
  --ks-pass=pass:android \
  --key-pass=pass:android
bundletool install-apks --apks=/private/tmp/noctalia-ddbc756d-signed.apks --device-id=emulator-5554
adb shell dumpsys package com.tanuki75.noctalia | rg -n "versionName|versionCode|installerPackageName"
adb shell am start -n com.tanuki75.noctalia/.MainActivity
```

Le 2026-05-11, ce diagnostic a installe et lance le build 24 sur `Pixel_8_Play_API_36`
avec `installerPackageName=null`. C'est une preuve que le binaire se lance sur l'emulateur,
mais pas une preuve Play Billing: les gates Play exigent toujours une installation dont
`installerPackageName` vaut `com.android.vending`.

## Garde-fous

- Ne jamais publier un build store avec la cle `test_`.
- Les tests mock prouvent l'UI, pas Google Play Billing.
- Le Test Store prouve le SDK RevenueCat, pas les produits Play.
- Play Internal Testing reste la preuve finale pour achat, restore et webhook reels.

## Etat de couverture actuel

Automatise localement:

- mock lab: profils, monthly, annual, cancelled, expired, paywall
- Test Store readiness: SDK configure, offering chargee, deux packages visibles

Encore manuel ou externe:

- switch de compte apres achat avec un deuxieme compte reel non abonne
- build installe via Google Play Internal Testing
- annulation, expiration, grace period et webhook reels

Commande de garde:

```bash
npm run subscription:qa:release-gate
npm run android:gates:strict
```

Ces commandes doivent echouer jusqu'a ce que chaque porte manuelle ou externe ci-dessus ait une preuve de switch compte, achat Play, restore Play et convergence backend/store.
