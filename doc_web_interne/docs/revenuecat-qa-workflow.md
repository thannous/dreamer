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
verifier `npm run android:device` jusqu'a `ADB: READY`, puis distingue les snapshots Google Play
directs des snapshots RevenueCat store-state pour monthly et annual. Si Google Play direct est
`monthly/P1M/ACTIVE` mais RevenueCat lit encore `prodfce10ef2a8` en `annual/P1Y`, le rapport affiche
`LAGGING`; `play_annual` doit de son cote rester `annual/P1Y`. Sans preuve Google Play directe
prete, une contradiction store-state reste bloquante pour la gate concernee.

Pour les gates Google Play, l'emulateur ne suffit pas. Avant de reprendre `play_monthly`,
`play_annual` ou `play_cancellation_and_expiry`, verifier qu'un vrai telephone Android est visible:

```bash
npm run android:device:physical
```

Cette commande echoue volontairement si seuls des AVD `emulator-*` sont visibles, meme si ADB est
pret pour les tests mock/Test Store. Elle affiche aussi l'etat USB macOS et les services ADB
Wireless Debugging visibles via mDNS; les services mDNS d'emulateur sont ignores pour les preuves
Play. Si `WIRELESS: VISIBLE` apparait, utiliser la commande
`adb pair <host>:<pair-port> <pair-code>` affichee par Android, puis `adb connect
<host>:<connect-port>` avant de relancer `npm run android:device:physical`. Si `WIRELESS: NOT
VISIBLE` apparait, ouvrir Developer options -> Wireless debugging sur le telephone et garder l'ecran
d'appairage ouvert pendant le diagnostic.

Interpretation rapide du diagnostic appareil:

- `USB: NOT VISIBLE` veut dire que macOS ne voit pas de telephone Android-like au niveau USB: changer
  de cable/port, deverrouiller le telephone, choisir `Transfert de fichiers / Android Auto`, puis
  accepter la popup RSA de debogage USB.
- `USB: VISIBLE` avec `ADB DEVICE: MISSING` ou `ADB DEVICE: UNAUTHORIZED` veut dire que le cable est bon mais que
  le debogage USB n'est pas encore autorise: deverrouiller le telephone et accepter l'empreinte RSA.
- `USB: VISIBLE` avec `Android debug interface signature present` mais `ADB DEVICE: MISSING`
  isole le probleme sur l'autorisation/transport ADB: macOS voit l'interface debug, mais
  `adb devices -l` ne liste encore aucun transport. Sur le POCO/HyperOS, refaire le cycle cote
  telephone: Developer options -> `Revoke USB debugging authorizations`, desactiver/reactiver
  `USB debugging`, reconnecter en `Transfert de fichiers / Android Auto`, puis accepter la popup
  RSA. Si la popup ne revient pas, utiliser Developer options -> `Wireless debugging` et garder
  l'ecran d'appairage ouvert pendant `npm run android:device:physical`.
- `WIRELESS: VISIBLE` veut dire que le telephone publie Wireless Debugging: lancer les commandes
  `adb pair` / `adb connect` affichees, puis relancer le preflight.
- `USB: NOT VISIBLE` et `WIRELESS: NOT VISIBLE` ensemble bloquent totalement les preuves Play
  locales: le Mac n'a aucun chemin ADB pour verifier `installerPackageName=com.android.vending`.
- Une ligne `emulator service(s) ignored` veut dire que seul un AVD publie mDNS; cela ne compte pas
  comme telephone Play QA et ne peut pas fermer les gates `play_*`.

Quand le telephone est visible et que l'app est installee depuis la piste Internal Testing, utiliser
le helper d'attente pendant la connexion. Si un seul telephone physique est visible, il peut etre
lance sans `--device`; ajouter `--device <adb-id>` seulement quand plusieurs devices sont prets:

```bash
npm run android:play-qa-device:wait
npm run android:play-qa-device:wait -- --device <adb-id>
npm run android:play-qa-device -- --device <adb-id>
```

Ces commandes verifient a la fois que `<adb-id>` est un telephone physique et que
`installerPackageName` vaut `com.android.vending`. Quand les deux checks passent, elles impriment
aussi des `evidenceArgs` a recopier dans les commandes `npm run subscription:qa:evidence` des gates
`play_*`.

Sur une build Play non-debuggable, `adb shell run-as com.tanuki75.noctalia ...` echoue normalement
avec `package not debuggable`; ne pas utiliser cet echec comme signal RevenueCat. Pour extraire
l'appUserId a reporter dans une preuve Play, vider les logs, declencher une action non payante comme
`Restaurer les achats` ou `Refresh`, puis lire le dernier `userId` loggue par le parcours
subscription:

```bash
adb -s <adb-id> logcat -c
# Dans l'app Play installee: Settings -> paywall -> Restaurer les achats, ou QA Lab -> Refresh
npm run subscription:qa:device-app-user-id -- --device <adb-id> --source logcat --json
```

L'appUserId attendu est le UUID Supabase passe a `Purchases.logIn(...)`; c'est l'identite RevenueCat
utilisee pour l'achat, le restore, la convergence webhook et la preuve `subscription:qa:evidence`.

Le preflight non destructif de la feuille Google Play peut etre pousse jusqu'a l'ecran de
confirmation, mais il ne ferme pas les gates `play_*` tant que le bouton final `S'abonner` n'est pas
appuye. Sur le POCO Play-installe le 2026-05-15, les feuilles mensuelle et annuelle ont confirme:

- app `Noctalia Plus` / package app `Noctalia: Smart Dream Journal`
- prix mensuel `3,59 EUR/5 min`
- prix annuel `22,99 EUR/30 min`
- moyen de paiement `Carte test, toujours approuvee`
- message Google Play: `Il s'agit d'un abonnement test ... Il ne vous sera pas facture`
- fermeture volontaire des feuilles, avec logs RevenueCat `PurchaseCancelledError` pour
  `$rc_monthly` et `$rc_annual`

Ce preflight prouve que le compte testeur peut ouvrir Play Billing et que l'achat est une transaction
test non facturee. Les preuves `play_monthly` et `play_annual` doivent toutefois attendre une
validation effective du bouton `S'abonner`, puis un refresh/convergence backend observee.

Apres chaque relecture live RevenueCat MCP de l'etat store Play, enregistrer le JSON compact dans le
snapshot local gitignore. Le rapport QA le relit ensuite pour signaler si le produit mensuel
RevenueCat expose bien `P1M`, si le produit annuel expose bien `P1Y`, ou si monthly est seulement
`LAGGING` alors que Google Play direct est pret:

```bash
npm run subscription:qa:play-state -- --input revenuecat-store-state.json
npm run subscription:qa:report
```

La commande accepte aussi le JSON en stdin et normalise les deux produits Play attendus
(`prodfce10ef2a8` et `prod98337b31be`) dans
`doc_web_interne/docs/revenuecat-play-store-state.local.json`.

La route Google Play Developer API directe est exploitable avec l'ADC locale si elle porte le scope
`https://www.googleapis.com/auth/androidpublisher` et le quota project `gen-lang-client-0336445544`.
Au dernier refresh du 2026-05-14T15:21:48Z, l'endpoint officiel
`/androidpublisher/v3/applications/com.tanuki75.noctalia/subscriptions/noctalia_plus` confirme
`monthly/P1M/ACTIVE` et `annual/P1Y/ACTIVE`. Cette preuve confirme Google Play directement, mais ne
remplace pas la relecture RevenueCat MCP ni une installation Play Internal Testing sur telephone.

Pour rafraichir le snapshot Google Play local:

```bash
TOKEN=$(gcloud auth application-default print-access-token)
curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-goog-user-project: gen-lang-client-0336445544" \
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tanuki75.noctalia/subscriptions/noctalia_plus" \
  -o /private/tmp/noctalia-google-play-subscription.json
npm run subscription:qa:google-play-state -- --input /private/tmp/noctalia-google-play-subscription.json
```

Verification UI Play Console du 2026-05-14: le compte developpeur `TiMax group` ouvre l'app
`Noctalia: Smart Dream Journal` (`com.tanuki75.noctalia`). La page `Monetiser avec Play ->
Abonnements -> Noctalia Plus` liste `annual` (`Annuel, renouvellement automatique`) et `monthly`
(`Mensuel, renouvellement automatique`) comme forfaits actifs, tous deux mis a jour le
`26 nov. 2025`; elle affiche aussi `Probleme concernant votre profil de paiement`. Cette lecture
confirme que le forfait mensuel existe cote Play Console, mais il faut encore corriger/resynchroniser
RevenueCat ou relire via MCP/API apres correction, car le snapshot RevenueCat actuel lit toujours
`prodfce10ef2a8` comme `annual/P1Y`.

Verification profil de paiement Play Console du 2026-05-14: le centre de notifications affiche
`Un probleme urgent requiert votre attention concernant votre compte de paiement`. La page
`Profil de paiement` demande encore les informations fiscales, un mode de paiement valide pour
recevoir les paiements, et les informations fiscales pour l'Irlande. Le snapshot local gitignore
`doc_web_interne/docs/google-play-payments-profile-state.local.json` enregistre ces trois exigences
ouvertes, et `android:gates:strict` bloque `Play payments profile for Billing` tant que ce snapshot
ne revient pas sans exigence ouverte.

Actions UI exactes vues en lecture seule sur `Profil de paiement`:

- `Mettez a jour vos informations fiscales` -> bouton `Mettre a jour`
- `Ajouter un mode de paiement` -> bouton `Mettre a jour`
- `Envoyer vos informations fiscales (Irlande)` -> bouton `Ajouter des infos fiscales`

Ne pas utiliser le bouton `Fermer` de l'alerte Irlande comme preuve de resolution: il masque le
message mais ne prouve pas que le statut fiscal est complet.

Pour rafraichir le snapshot profil de paiement apres correction Play Console:

```bash
npm run android:google-play-payments-profile-state -- \
  --account-name "Google Wallet Merchant Account - <email>" \
  --developer-name Cloudtech \
  --currency EUR \
  --monthly-payout-threshold 1.00 \
  --current-period-earnings <amount> \
  --tax-information complete \
  --payout-method complete \
  --ireland-tax-information complete \
  --source "Google Play Console payments profile read-only check"
```

Le CLI Supabase local n'est pas authentifie actuellement: `npx supabase secrets list --project-ref
usuyppgsmmowzizhaoqj` repond `Access token not provided`. Apres connexion Supabase ou verification
dashboard, enregistrer uniquement la presence des secrets attendus, jamais leurs valeurs:

```bash
npm run android:supabase-play-integrity-secrets-state -- \
  --project-ref usuyppgsmmowzizhaoqj \
  --PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64 present \
  --PLAY_INTEGRITY_PACKAGE_NAME present \
  --PLAY_INTEGRITY_PACKAGE_NAME-value com.tanuki75.noctalia \
  --GUEST_SESSION_SECRET present \
  --source "Supabase dashboard or CLI secrets read-only check"
```

Cette commande ecrit `doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json`
(gitignore). `android:gates:strict` peut passer le gate `Supabase Play Integrity secrets`
uniquement si les trois secrets sont marques `present` et si `PLAY_INTEGRITY_PACKAGE_NAME` vaut
`com.tanuki75.noctalia`.

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

Pour une gate `play_*`, ajouter aussi le build EAS installe depuis Play Internal Testing et l'id ADB
du telephone physique qui a passe `npm run android:device:physical`:

```bash
npm run subscription:qa:evidence -- \
  --gate play_monthly \
  --tester tester@example.com \
  --app-user-id 00000000-0000-4000-8000-000000000000 \
  --eas-build-id 00000000-0000-4000-8000-000000000000 \
  --device-id 57275d36 \
  --installer-package-name com.android.vending \
  --evidence "Play purchase completed after installed from Play (com.android.vending), product noctalia_plus:monthly, base plan P1M confirmed, backend converged"
```

`--eas-build-id` doit etre l'UUID EAS du build installe, pas seulement le numero de build Android.
Sur le POCO `192.168.1.116:41183`, l'installation Play observee le 2026-05-15 est
`versionCode=12`, `versionName=1.1.0`; `eas build:list` la rattache au build EAS
`9df05e30-0569-4f7c-8af9-62c692fa4c3a` (`appBuildVersion=12`). Cette valeur peut servir pour
une preuve Play si l'achat est effectue sur ce build, mais le build Internal Testing le plus recent
documente est `ddbc756d-8db6-4337-80fa-68cc86f8b62a` (`versionCode=24`, `versionName=1.2.0`).
Pour une validation de release robuste, preferer mettre a jour l'app depuis Play avant d'appuyer sur
`S'abonner`, puis re-verifier `dumpsys package` et l'`easBuildId` correspondant.
`--device-id` doit etre l'id ADB d'un telephone physique, pas un AVD `emulator-*`.
La preuve Play doit confirmer la source d'installation Play Internal Testing: le champ structure
`--installer-package-name` doit valoir `com.android.vending`, et le texte de preuve doit contenir
explicitement `installed from Play` ou `com.android.vending`. Pour `play_monthly`, le texte doit
aussi confirmer `P1M`; pour `play_annual`, il doit confirmer `P1Y`.

Si un fichier de preuve locale existe mais ne passe pas la gate, `npm run subscription:qa:report`
affiche une section `Evidence Diagnostics` avec le premier champ a corriger pour chaque scenario.
Quand des gates restent ouvertes, le rapport affiche aussi `Evidence Commands` avec les commandes
`npm run subscription:qa:evidence -- ...` pre-remplies pour `account_switch` et les gates Play.
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
  scripts/update-google-play-payments-profile-state.js \
  scripts/update-google-play-payments-profile-state.test.js \
  scripts/update-supabase-play-integrity-secrets-state.js \
  scripts/update-supabase-play-integrity-secrets-state.test.js \
  scripts/verify-subscription-qa-local.js \
  scripts/verify-subscription-qa-local.test.js \
  doc_web_interne/docs/google-play-payments-profile-state.example.json \
  doc_web_interne/docs/supabase-play-integrity-secrets-state.example.json \
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
avec 3 gates RevenueCat/Play restantes. Il bloque aussi le profil de paiement Play si
`doc_web_interne/docs/google-play-payments-profile-state.local.json` contient des exigences ouvertes.

Pour rafraichir la preuve locale du project number Google Cloud utilise par Play Integrity:

```bash
gcloud projects list --filter='PROJECT_NUMBER=359653779023' --format=json \
  | npm run android:google-cloud-project-state
```

Cette commande ecrit `doc_web_interne/docs/google-cloud-project-state.local.json` (gitignore).
`android:gates:strict` lit ce snapshot pour passer le gate `Google Cloud project number confirmation`
sans relancer `gcloud` a chaque preflight.

Pour rafraichir la preuve locale que le SHA-1 Play App Signing est bien dans le client OAuth Android
Google Cloud:

```bash
npm run android:google-oauth-android-client-state -- \
  --client-id 359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com \
  --name "Noctalia Android Production" \
  --package-name com.tanuki75.noctalia \
  --sha1 BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59
```

Cette commande ecrit `doc_web_interne/docs/google-oauth-android-client-state.local.json`
(gitignore). Elle doit rester une copie de la lecture Google Cloud Console; elle ne modifie pas
Google Cloud.

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

Le 2026-05-14T15:36Z, un `codex exec` frais a relu RevenueCat MCP en lecture seule:
`prodfce10ef2a8` (`noctalia_plus:monthly`) renvoie encore `base_plan_id=annual`,
`billing_period=P1Y`, `state=ACTIVE`, tandis que `prod98337b31be` renvoie aussi `annual/P1Y/ACTIVE`.
Depuis le refresh Google Play direct du 2026-05-14T15:21:48Z, l'API officielle confirme pourtant
`monthly/P1M/ACTIVE`; le rapport QA signale donc RevenueCat comme `LAGGING` et peut accepter une
preuve `play_monthly` seulement si elle vient d'une vraie installation Play Internal Testing,
confirme `P1M`, et montre que le backend converge. L'app utilise `product.subscriptionPeriod` comme
garde locale pour eviter d'afficher un produit `P1Y` comme mensuel, mais cette garde ne remplace pas
la preuve d'achat Play reelle.

Correction Play Console a faire avant de reprendre `play_monthly`:

1. Ouvrir Play Console -> `Monetize with Play` -> `Products` -> `Subscriptions`.
2. Ouvrir la subscription correspondant a `noctalia_plus:monthly`.
3. Verifier les `Base plans and offers`.
4. Le base plan utilise par `noctalia_plus:monthly` doit etre auto-renewing avec billing period mensuel (`P1M` cote API/RevenueCat), pas `annual`/`P1Y`.
5. Si le base plan active est deja `annual`, creer ou selectionner un base plan mensuel dedie, verifier disponibilite regionale/prix, puis reactiver/sauvegarder.
6. Relancer une lecture RevenueCat MCP `get_product_store_state` sur `prodfce10ef2a8`; si RevenueCat
   reste en retard mais que Google Play direct est toujours `monthly/P1M/ACTIVE`, continuer seulement
   avec une preuve Play-installed + backend convergee.

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

- avant toute preuve Play, `npm run android:device:physical` doit voir un telephone Android reel
  connecte en USB ou via ADB Wireless Debugging
- avant toute preuve Play, `npm run android:play-install-source -- --device <adb-id>` doit afficher
  `installerPackageName: com.android.vending`
- `npm run android:play-qa-device:wait` peut attendre l'unique telephone Play visible pendant la
  connexion et imprimer les commandes d'evidence quand il est pret; ajouter `-- --device <adb-id>`
  quand plusieurs devices sont prets
- `npm run android:play-qa-device -- --device <adb-id>` doit passer pour le telephone teste
- `subscription:qa:evidence` doit recevoir `--device-id <adb-id>` pour lier la preuve Play au
  telephone physique utilise
- RevenueCat Customer affiche le meme app user id que Supabase `auth.users.id`
- la preuve locale de chaque gate Play contient l'id du build EAS installe
- `subscription_state` contient `tier=plus`, `is_active=true`, `product_id` correct
- `subscription_events` contient un evenement `purchase`, `restore`, `webhook` ou `subscription_refresh`
- pour `play_cancellation_and_expiry`, la preuve doit mentionner l'annulation ou l'expiration
  observee, le webhook RevenueCat et la convergence backend
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

Sources officielles recoupees le 2026-05-14 pour interpreter le blocage emulateur:

- Android Developers documente `adb devices -l` comme la source de verite des transports ADB et
  liste les etats `device`, `offline` et `no device`:
  https://developer.android.com/tools/adb
- Android Studio / Android Developers rappelle que le test sur appareil physique exige les options
  developpeur et `USB debugging` active sur le device:
  https://developer.android.com/studio/run/device
- Google Play Billing classe `BILLING_UNAVAILABLE` comme un cas ou la facturation n'est pas
  disponible pour l'appareil, le compte, la region, le Play Store ou le moyen de paiement:
  https://developer.android.com/google/play/billing/errors
- Google Play Console exige une app publiee sur une piste test/prod, des testeurs eligibles et des
  produits publies pour tester les abonnements:
  https://support.google.com/googleplay/android-developer/answer/6062777
- RevenueCat recommande, pour les erreurs de Store ou de produits vides sur Android, un appareil ou
  emulateur avec Google Play installe, un compte Google connecte, et precise que le test sur device
  reel reste plus fiable:
  https://www.revenuecat.com/docs/test-and-launch/errors
- Le Device Catalog Play Console est la source de verite pour voir quels modeles Google Play juge
  compatibles avec l'app:
  https://support.google.com/googleplay/android-developer/answer/7353455

Complement Play Console du 2026-05-14: dans `Catalogue d'appareils`, `emu64a` retourne
`0 modele d'appareil` meme avec le filtre `Tous les appareils`, alors que `emu64xa` retourne
un seul modele compatible, `google emu64xa` / `Google emulator`, Android `16 Beta`, SoC
`Intel 3215U`. Sur ce Mac Apple Silicon, les AVD Play exposent `sdk_gphone64_arm64` /
`device:emu64a`; le message `Your device isn't compatible with this version` vient donc tres
probablement du catalogue Play qui ne cible pas ce modele AVD arm64. Ne pas utiliser ce
blocage comme signal RevenueCat: il faut finir les gates `play_*` sur un telephone Android
physique visible par ADB et installe depuis Play Internal Testing.

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
