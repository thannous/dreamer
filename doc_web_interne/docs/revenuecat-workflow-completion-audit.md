# RevenueCat Workflow Completion Audit

Date: 2026-05-12

Derniere mise a jour locale: 2026-05-14

Objectif utilisateur: tester et finaliser le workflow RevenueCat avec differents profils utilisateurs et abonnements, du mock valide au Test Store puis Play autant que possible localement.

## Criteres de succes

| Critere | Artefact | Preuve actuelle | Statut |
| --- | --- | --- | --- |
| Visualiser les profils utilisateur subscription | `components/subscription/SubscriptionQALab.tsx` | QA Lab expose guest, new free, existing free, plus user, mode, user, tier, product, renews, quota, auth | Fait |
| Tester les profils mock | `maestro/subscription-qa-lab.yml` | Flow couvre guest, new free, plus user, existing free | Fait |
| Tester les etats mock abonnement | `maestro/subscription-qa-lab.yml` | Flow couvre monthly, annual, cancelled, expired et paywall | Fait |
| Valider les packages Test Store sans achat | `maestro/subscription-teststore-readiness.yml` | Relancee le 2026-05-14 sur `Pixel_7_Play_API_36`: mode `RevenueCat Test Store`, `PACKAGES=2`, offres `Buy monthly`/`Buy annual` et prix `$9.99`/`$79.98` visibles | Fait |
| Revalider l'entitlement RevenueCat live | MCP RevenueCat via nouveau `codex exec` | `Noctalia Plus` = `entla0745c9b44`, attache `monthly`, `yearly`, `noctalia_plus:monthly`, `noctalia_plus:annual` | Fait |
| Proteger tout achat Test Store | `scripts/run-subscription-teststore-purchase.js` | Refuse sans `REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE` | Fait |
| Preflight achat sans Store | `test:e2e:subscription-teststore:purchase:preflight` | Valide plan, credentials et args Maestro sans lancer Maestro ni achat | Fait |
| Preparer le flow achat Test Store | `maestro/subscription-teststore-purchase-manual.yml`, `maestro/subscription-teststore-purchase-google-manual.yml` | Le runner accepte `REVENUECAT_QA_AUTH=email` ou `google`; le flow Google gere `Continue with Google`, le compte deja connecte, la confirmation `TEST VALID PURCHASE`, puis refresh | Fait |
| Capturer les preuves manuelles | `scripts/update-subscription-qa-evidence.js` | Helper remplit `revenuecat-qa-evidence.local.json` avec `testedAt`, `tester`, `appUserId`, `evidence`; `appUserId` et les gates `play_*` `easBuildId` doivent etre des UUID; le texte du template, les dates invalides, les identites vides ou en espaces et les ids invalides sont refuses | Fait |
| Bloquer release sans preuve complete | `scripts/subscription-qa-report.js --require-full` | `npm run subscription:qa:release-gate` reste rouge sans preuves; une preuve identique au texte du template reste aussi bloquee | Fait |
| Revalider le harnais local sans Store | `npm run subscription:qa:verify-local` | Lance les checks syntaxiques, les tests du harnais QA, `subscription:qa:report`, une verification que la release gate bloque sans preuve pour la bonne raison, et les preflights d'achat monthly/annual avec compte factice sans achat ni Metro; le verificateur a ses propres tests et `subscription:qa:report` verifie aussi que cette commande existe | Fait |
| Diagnostiquer les preuves invalides | `scripts/subscription-qa-report.js` | Si un fichier de preuve locale est present, le rapport affiche `Evidence Diagnostics` pour les gates mal remplies | Fait |
| Bloquer un fichier de preuve illisible | `scripts/subscription-qa-report.js` | Un JSON local invalide ne crashe pas le rapport; il bloque sur `Local evidence file parses` | Fait |
| Surfacer les pre-requis de session | `scripts/subscription-qa-report.js` | Le rapport affiche `Current Session Readiness`: variables Test Store presentes/manquantes, approbation d'achat, besoin `ADB: READY`, et correction `P1M` pour `prodfce10ef2a8` | Fait |
| Verrouiller le signal readiness dans le verificateur | `scripts/verify-subscription-qa-local.js` | `npm run subscription:qa:verify-local` echoue si `subscription:qa:report` n'affiche plus `Current Session Readiness`, le compte Test Store env ou le rappel `P1M` | Fait |
| Diagnostiquer l'appareil Android physique | `npm run android:device` | Dernier check le 2026-05-12: `ADB: MISSING` et `USB: NOT VISIBLE`; macOS ne voit pas de device Android/POCO, donc les flows sur telephone reel restent bloques avant meme RevenueCat/Play | Bloque appareil |
| Valider achat Test Store monthly | `REVENUECAT_QA_AUTH=google ... npm run test:e2e:subscription-teststore:purchase -- --plan monthly --device emulator-5554 --retries 0 --no-restart-metro` | Passe le 2026-05-14 sur `Pixel_7_Play_API_36` avec le compte Google testeur: readiness OK, `TEST VALID PURCHASE`, `monthly purchase completed`, `Refresh completed`, `plus / active` | Fait local Test Store |
| Valider achat Test Store annual | `REVENUECAT_QA_AUTH=google ... npm run test:e2e:subscription-teststore:purchase -- --plan annual --device emulator-5554 --retries 0 --no-restart-metro` | Passe le 2026-05-14 sur `Pixel_7_Play_API_36` avec le compte Google testeur: `annual purchase completed`, `Refresh completed`, `plus / active`; snapshot observe `product yearly`, `renews yes` | Fait local Test Store |
| Valider restore apres achat | `maestro/subscription-teststore-restore-google-manual.yml` + QA Lab Restore | Passe le 2026-05-14 sur `Pixel_7_Play_API_36` apres `adb uninstall com.tanuki75.noctalia` puis reinstall debug Test Store: Google Sign-In refait, `Restore completed`, `Refresh completed`, `plus / active`, snapshot `product yearly`, `renews yes` | Fait local Test Store |
| Valider switch compte apres achat | QA Lab + evidence gate `account_switch` | Necessite deux comptes reels | Manquant |
| Valider Play Internal Testing | Build Play installe, achat Play, backend/webhook | Necessite build installe via Play Internal Testing | Manquant |
| Revalider le dashboard RevenueCat live | MCP RevenueCat OAuth via nouveau `codex exec` le 2026-05-10 | Projet `Noctalia` = `proje6db7596`; offering `default` actif avec packages Test Store et Play | Fait |
| Verifier les builds EAS Android disponibles | Expo MCP `build_list` / `build_info` | Dernier build Store Android `310244ed-027b-4028-8522-70c0f676a0e9`, production AAB, version 1.2.0 build 20, commit SEO du 2026-05-04; ne couvre pas les changements QA actuels | Info, non suffisant |
| Verifier l'inscription Play Testing | Chrome `https://play.google.com/apps/testing/com.tanuki75.noctalia` | Le compte Google `thannous@gmail.com` affiche `You are a tester` pour `Noctalia: Smart Dream Journal` | Fait |
| Preparer un emulateur Google Play | Android SDK + AVD `Pixel_8_Play_API_36` | Image `system-images;android-36;google_apis_playstore;arm64-v8a` installee, AVD cree, `adb shell pm list packages com.android.vending` confirme `package:com.android.vending` | Fait |
| Connecter le compte Play dans l'emulateur | Google sign-in sur `Pixel_8_Play_API_36` | `adb shell dumpsys account` confirme `Account {name=thannous@gmail.com, type=com.google}` | Fait |
| Installer Noctalia depuis Play Internal Testing | Google Play sur `Pixel_8_Play_API_36` | La fiche Play affiche `Noctalia: Smart Dream Journal (Beta)`, `You're a beta tester for this app`, mais bloque l'installation avec `Your device isn't compatible with this version` | Bloque Play/device catalog |
| Verifier la compatibilite technique du bundle avec l'emulateur | `bundletool get-device-spec` + `bundletool build-apks` | L'AAB `cbbf745a-0e76-4488-a365-ba180a903e90` genere `/private/tmp/noctalia-cbbf745a.apks` pour `emulator-5554`: `base-arm64_v8a.apk`, `base-en.apk`, `base-master.apk`, `base-xxhdpi.apk`; aucun `uses-feature`, `supports-screens` ou `compatible-screens` bloquant n'a ete trouve dans le manifest dump | Fait |
| Reduire les filtres hardware Play inutiles | `plugins/withOptionalAndroidHardwareFeatures.js`, `app.json` | Le config plugin declare `android.hardware.camera`, `android.hardware.camera.any` et `android.hardware.microphone` avec `android:required="false"` dans le manifest genere; verification locale via `@expo/config-plugins` OK | Corrige localement, nouveau build requis |
| Rebuild Store apres correctif hardware | EAS CLI depuis worktree propre `/private/tmp/noctalia-eas-c19bf249` | Build Android Store `ddbc756d-8db6-4337-80fa-68cc86f8b62a` fini le 2026-05-11, versionCode 24, commit `c19bf249141f443b84d232bb1c5d9708cbb5caae`, AAB `https://expo.dev/artifacts/eas/to6rt1WLAABVH7Ca3o4mBm.aab`; soumission Internal Testing `99d2a4b1-3eac-4479-850f-bf179c13af91` = `FINISHED`, track `internal`, release `COMPLETED`, sans erreur | Fait |
| Revalider Play apres build 24 | Google Play sur `Pixel_8_Play_API_36` + `adb exec-out uiautomator dump /dev/tty` | La fiche Play affiche toujours `Your device isn't compatible with this version` et `You're a beta tester for this app`; recheck de propagation relance le 2026-05-11 avec le meme resultat; Noctalia n'est pas installee | Bloque Play/device catalog |
| Verifier le lancement local du build 24 hors Play | `bundletool build-apks` signe avec `/private/tmp/noctalia-debug.keystore`, puis `bundletool install-apks --device-id=emulator-5554` | Installation locale OK; `dumpsys package` affiche `versionCode=24`, `versionName=1.2.0`, `installerPackageName=null`; `adb shell am start -n com.tanuki75.noctalia/.MainActivity` affiche l'ecran d'accueil Noctalia. Cette preuve isole le binaire comme installable/lancable, mais ne valide pas Play Billing car l'app n'est pas installee par `com.android.vending` | Info, non suffisant |
| Verifier l'etat store live des produits Play | RevenueCat MCP `get_product_store_state` via `codex exec` frais | `prod98337b31be` annual renvoie `base_plan_id=annual`, `billing_period=P1Y`, `status=ok`; `prodfce10ef2a8` monthly renvoie aussi `base_plan_id=annual`, `billing_period=P1Y`, `status=ok`, ce qui indique une incoherence Play/RevenueCat a corriger avant de valider l'achat mensuel reel | Bloque configuration Play monthly |
| Eviter un mauvais libelle si le Store contredit le package | `lib/revenuecat.ts`, `lib/__tests__/revenuecat.test.ts` | Le mapping utilise maintenant `product.subscriptionPeriod` (`P1M`/`P1Y`) avant `packageType`/id; si le produit `monthly` revient en `P1Y`, l'app ne le presente plus comme mensuel | Corrige localement, config live encore a corriger |
| Verifier les preuves locales manuelles | `doc_web_interne/docs/revenuecat-qa-evidence.local.json` | Fichier absent au 2026-05-09; aucune preuve manuelle/externe n'a encore ete enregistree | Manquant |

## Prompt-to-artifact checklist

| Exigence explicite | Fichier / commande | Verification |
| --- | --- | --- |
| Differents profils utilisateur | `maestro/subscription-qa-lab.yml` | `npm run test:e2e:subscription-qa -- --device emulator-5554 --retries 0` a passe apres durcissement du flow et reload Metro |
| Differents abonnements | `services/mocks/subscriptionServiceMock.ts`, `SubscriptionQALab.tsx`, `subscription-qa-lab.yml` | Mock monthly/annual/cancelled/expired couverts |
| Test Store | `.env.teststore`, `eas.json`, `subscription-teststore-readiness.yml` | `node ./scripts/run-maestro-android.js --suite store --env-file .env.teststore --device emulator-5554 --retries 0 --no-restart-metro` passe le 2026-05-14 avec packages 2 et les deux offres visibles |
| Google Play | `.env.playstore`, `eas.json`, `constants/subscription.ts` | Config presente; `subscription:qa:report` verifie `release`, `preview`, `production`, `production-apk`; achat Play non execute |
| Entitlement live | MCP RevenueCat `list_entitlements` via nouveau `codex exec` | `Noctalia Plus` existe et attache les produits Test Store `monthly`/`yearly` et Play `noctalia_plus:monthly`/`noctalia_plus:annual` |
| Visualiser les workflows | `SubscriptionQALab.tsx` | Surface Settings affiche mode, SDK key, packages, user, tier, product, renews, quota, auth, actions |
| Etre sur que tout fonctionne | `subscription:qa:release-gate` | Gate bloque tant que les preuves manuelles/externes sont absentes |
| Ne pas confondre mock et reel | `subscription-qa-report.js`, `revenuecat-qa-workflow.md` | Matrice separe Automated, Manual purchase gate, External store gate |
| Enregistrer les preuves | `revenuecat-qa-evidence.example.json`, `update-subscription-qa-evidence.js` | Tests prouvent evidence -> report -> gate count; les gates Play sans `easBuildId` UUID et les preuves sans `appUserId` UUID restent bloquees; les textes de preuve restes au template, les dates invalides, les identites en espaces et les JSON invalides ne comptent pas. Le restore local est observe mais pas encore inscrit dans le fichier local gitignore faute d'extraction `appUserId` UUID dans cette session |
| Revalidation live RevenueCat | MCP RevenueCat `list_projects` puis offerings/packages via nouveau `codex exec` | `Noctalia` = `proje6db7596`; offering `default` actif; `$rc_monthly` -> `monthly` + `noctalia_plus:monthly`; `$rc_annual` -> `yearly` + `noctalia_plus:annual` |
| Preflight achat | `npm run test:e2e:subscription-teststore:purchase:preflight -- --plan monthly --device emulator-5554` | Ne necessite pas `REVENUECAT_QA_APPROVAL`, ne lance pas Maestro, valide les prerequisites locaux |
| Verification locale rapide | `npm run subscription:qa:verify-local` | Regroupe syntax checks, tests scripts QA, rapport de couverture, blocage attendu de la release gate sans preuve pour la bonne raison et preflights d'achat monthly/annual sans ouvrir le Store |
| Readiness de la session courante | `npm run subscription:qa:report` | Section `Current Session Readiness` affiche actuellement `REVENUECAT_QA_EMAIL=missing`, `REVENUECAT_QA_PASSWORD=missing`, approbation Test Store `NOT SET`, besoin `ADB: READY`, et besoin RevenueCat/Play `P1M` pour le mensuel |
| Appareil physique Android | `npm run android:device` | `ADB: MISSING`, `USB: NOT VISIBLE`; aucun achat Test Store/Play sur appareil physique ne peut etre execute tant que le POCO n'est pas reconnecte en mode transfert de fichiers avec USB debugging/RSA |
| Build EAS Android existant | Expo MCP `build_info 310244ed-027b-4028-8522-70c0f676a0e9` | Build fini, STORE, production, AAB disponible, mais date/commit avant le workflow QA RevenueCat courant |
| Build EAS Android utilisable pour Play | EAS CLI depuis worktree propre + Expo MCP `build_info cbbf745a-0e76-4488-a365-ba180a903e90` + page Expo Submission Details | Build Store Android `cbbf745a-0e76-4488-a365-ba180a903e90` fini le 2026-05-10, versionCode 22, commit `723e6deb0524e3b49e33045d2298da918404e40f`, AAB `https://expo.dev/artifacts/eas/rag5GTaMLdJ4HAYpS4vqDo.aab`; auto-submit Internal Testing `6d4630b0-33e1-48d7-a8f1-687206b2fe8f` confirme `Success` sur Expo, soumis le 2026-05-10 a 23:29 | Fait |
| Inscription Play Testing | Chrome avec `thannous@gmail.com` sur `play.google.com/apps/testing/com.tanuki75.noctalia/join?hl=en-US` | Page affiche `You are a tester`; la fiche Play sur l'emulateur affiche aussi Noctalia Beta et `You're a beta tester for this app` | Fait |
| Emulateur Google Play local | `sdkmanager`, `avdmanager`, `adb`, `bundletool` | `Pixel_8_Play_API_36` utilise `google_apis_playstore`, boote sur `emulator-5554`, expose `com.android.vending`, contient le compte Google `thannous@gmail.com`; Play bloque l'installation par compatibilite alors que bundletool genere des APKs adaptes au device spec | Bloque Play/device catalog |
| Emulateur Play alternatif | `Pixel_7_Play_API_36`, `adb`, Play Store | AVD cree le 2026-05-14 avec la meme image `google_apis_playstore`; il boote, expose `com.android.vending`, compte `thannous@gmail.com` connecte apres 2FA POCO. La fiche Play affiche `Noctalia: Smart Dream Journal (Beta)`, `You're a beta tester for this app`, puis `This app is available only for your other devices`; le Pixel 7 emulateur est donc aussi filtre par le catalogue Play. | Bloque Play/device catalog |
| Filtrage hardware Play | `withOptionalAndroidHardwareFeatures`, AAB `ddbc756d-8db6-4337-80fa-68cc86f8b62a` | Manifest du build 24 contient `uses-feature` camera, camera.any et microphone en `android:required="false"`; `bundletool build-apks` genere encore les splits `base-arm64_v8a`, `base-en`, `base-master`, `base-xxhdpi` pour `emulator-5554`; Play Store continue de filtrer l'AVD | Corrige, blocage Play persistant |
| Lancement hors Play du build 24 | `bundletool install-apks` + `adb shell am start` | Les splits signes localement s'installent sur `Pixel_8_Play_API_36` et l'app affiche l'ecran de capture de reve; `installerPackageName=null`, donc cette preuve ne ferme aucune gate Play | Info, non suffisant |
| Produit Play mensuel live | RevenueCat MCP `get_product_store_state(project_id=proje6db7596, product_id=prodfce10ef2a8)` | Status `ok`, store `play_store`, mais `base_plan_id=annual`, `billing_period=P1Y`; le mensuel doit etre corrige dans Play Console/RevenueCat avant achat | Bloque Play monthly |
| Mapping intervalle SDK | `mapIntervalFromId(..., subscriptionPeriod)` | `P1Y` force `annual`, `P1M` force `monthly`; tests couvrent les conflits `packageType` vs periode Store | Fait |
| Scope commit pour build Play | `git add --dry-run ...` sur la liste du runbook | Valide le 2026-05-10; tous les chemins RevenueCat QA existent et aucun fichier n'a ete stage pendant le dry-run |

## Commandes de verification actuelles

```bash
npm run subscription:qa:report
npm run subscription:qa:verify-local
npm run subscription:qa:release-gate
npm test -- scripts/update-subscription-qa-evidence.test.js scripts/subscription-qa-report.test.js scripts/run-subscription-teststore-purchase.test.js --runInBand --watchman=false
npm run lint
npm run typecheck:app
```

Resultat attendu au 2026-05-12:

- `subscription:qa:report`: passe
- `subscription:qa:report`: affiche `Current Session Readiness`; au dernier check, les variables Test Store sont absentes, l'approbation d'achat n'est pas definie, l'appareil doit encore etre `ADB: READY`, et le mensuel Play doit encore exposer `P1M`
- `subscription:qa:verify-local`: passe, avec 5 suites et 34 tests du harnais QA scripts
- `subscription:qa:release-gate`: echoue volontairement avec 7 portes restantes
- tests scripts QA: passent, dont le refus des preuves qui gardent le texte du template, une date invalide, une identite vide/en espaces, un `appUserId` non UUID ou un `easBuildId` non UUID dans le report et le helper d'ecriture
- tests cibles abonnement: `services/__tests__/revenuecatUI.test.ts`, `services/__tests__/subscriptionService.test.ts`, `services/subscriptionSyncService.test.ts`, `services/mocks/subscriptionServiceMock.test.ts`, `hooks/useSubscription.test.tsx`, `lib/__tests__/revenuecat.test.ts`, `lib/__tests__/revenuecatSubscriber.test.ts`, `tests/app-routes/settingsScreen.test.tsx` passent (8 suites, 90 tests)
- lint/typecheck app: passent
- `typecheck:tests`: echoue actuellement sur des tests legacy hors perimetre RevenueCat (`DreamMutation`, mocks non types, parametres implicites `any`); ne pas l'utiliser comme preuve de completion du workflow abonnement tant que ces tests globaux ne sont pas remis a niveau
- EAS Play Store profiles: `release`, `preview`, `production`, `production-apk` utilisent la cle `goog_`
- canari mock QA Lab Android: passe sur `emulator-5554`
- canari Test Store readiness Android: repasse le 2026-05-14 sur `emulator-5554`; `RevenueCat Test Store`, `PACKAGES=2`, `Buy monthly`, `Buy annual`, `$9.99`, `$79.98`
- garde achat Test Store: `npm run test:e2e:subscription-teststore:purchase -- --plan monthly --device emulator-5554` refuse sans approbation explicite
- achat Test Store monthly local: passe le 2026-05-14 avec `REVENUECAT_QA_AUTH=google`, `REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE`, `--plan monthly`, `--device emulator-5554`; le flow confirme `TEST VALID PURCHASE`, `monthly purchase completed`, `Refresh completed`, `plus / active`
- achat Test Store annual local: passe le 2026-05-14 avec `REVENUECAT_QA_AUTH=google`, `REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE`, `--plan annual`, `--device emulator-5554`; le flow confirme `TEST VALID PURCHASE`, `annual purchase completed`, `Refresh completed`, `plus / active`, et le snapshot affiche `product yearly`, `renews yes`
- restore Test Store apres reinstall local: passe le 2026-05-14 apres `adb uninstall com.tanuki75.noctalia` puis `ANDROID_SERIAL=emulator-5554 npx expo run:android`; `env QA_EMAIL=... node ./scripts/run-maestro-android.js --flow maestro/subscription-teststore-restore-google-manual.yml --env-file .env.teststore --device emulator-5554 --retries 0 --no-restart-metro` confirme Google Sign-In, `Restore completed`, `Refresh completed`, `plus / active`, snapshot `product yearly`, `renews yes`
- MCP RevenueCat live: la session courante renvoie `403 access token has been revoked`, mais un nouveau `codex exec` le 2026-05-10 voit `Noctalia` (`proje6db7596`) et confirme l'offering `default` actif
- MCP RevenueCat entitlement: `Noctalia Plus` (`entla0745c9b44`) attache les quatre produits attendus
- Expo MCP build Android: verification relancee le 2026-05-10; dernier Store build fini `310244ed-027b-4028-8522-70c0f676a0e9`, mais insuffisant pour valider Play Internal Testing du workflow actuel
- Play Internal Testing: build Android Store `ddbc756d-8db6-4337-80fa-68cc86f8b62a` cree depuis `c19bf249` avec la cle `goog_`; auto-submit Internal Testing `99d2a4b1-3eac-4479-850f-bf179c13af91` confirme `FINISHED`, track `internal`, release `COMPLETED`; le manifest du build 24 marque camera/micro optionnels et bundletool genere des splits APK pour l'emulateur, mais Google Play affiche encore `Your device isn't compatible with this version` sur `Pixel_8_Play_API_36`, y compris apres recheck de propagation le 2026-05-11; le blocage restant est donc cote Play/device catalog et la validation Play doit passer par un appareil physique compatible ou par correction Play Console device catalog si un filtre y apparait
- Emulateur alternatif: `Pixel_7_Play_API_36` cree et boote le 2026-05-14 avec Play Store present; compte `thannous@gmail.com` connecte apres validation 2FA sur POCO. La fiche Play Noctalia affiche l'app Beta et le statut testeur, mais indique `This app is available only for your other devices`; le modele Pixel 7 ne contourne pas le filtrage Play.
- Sideload build 24: les splits generes depuis l'AAB `ddbc756d-8db6-4337-80fa-68cc86f8b62a` doivent etre signes pour un sideload local; avec une keystore debug temporaire, `bundletool install-apks --apks=/private/tmp/noctalia-ddbc756d-signed.apks --device-id=emulator-5554` installe l'app, `dumpsys package` confirme `versionCode=24`, et `am start` affiche l'ecran Noctalia. Cette preuve confirme le lancement du binaire, pas l'installation Play ni les achats Play.
- Android physique: `npm run android:device` relance le 2026-05-12 renvoie `ADB: MISSING` et `USB: NOT VISIBLE`; le Mac ne voit pas le POCO en USB, donc il faut rebrancher/changer cable ou port, choisir `Transfert de fichiers / Android Auto`, activer USB debugging et accepter la popup RSA avant de reprendre les validations appareil.
- RevenueCat MCP store state: lecture fraiche le 2026-05-12 avec `get_product_store_state` sur `prodfce10ef2a8`; le produit mensuel renvoie toujours `store=play_store`, `status=ok`, `base_plan_id=annual`, `billing_period=P1Y`, `grace_period=P14D`. Le produit mensuel est donc incoherent cote store live; le code local evite de l'afficher comme mensuel si `subscriptionPeriod=P1Y`, mais la configuration Play/RevenueCat doit etre corrigee avant de valider `play_monthly`.
- scope de commit Play: `git add --dry-run` sur la liste du runbook passe; `git diff --cached --name-only` reste vide apres verification
- preuve locale: `doc_web_interne/docs/revenuecat-qa-evidence.local.json` absent; malgre les achats Test Store locaux et le restore local passes, `subscription:qa:release-gate` doit rester rouge tant que les preuves structurees avec `appUserId` et les gates account-switch/Play ne sont pas renseignees

Note: la session Codex deja ouverte peut conserver l'ancien token MCP jusqu'a reload. Pour une
verification RevenueCat live apres reauth, utiliser un nouveau `codex exec` ou redemarrer la session.

## Conditions pour declarer l'objectif complet

Ne pas declarer l'objectif complet tant que ces sept portes ne sont pas passees dans `revenuecat-qa-evidence.local.json`:

- `test_store_monthly`
- `test_store_annual`
- `restore_after_reinstall`
- `account_switch`
- `play_monthly`
- `play_annual`
- `play_cancellation_and_expiry`

Chaque porte doit contenir `status: "passed"`, un `testedAt` valide, `tester`, un `appUserId` UUID et
`evidence`. Le champ `evidence` doit decrire le test reel observe, pas reprendre le texte d'exemple.
Les portes `play_*` doivent aussi contenir un `easBuildId` UUID pour lier la preuve au build installe
via Play Internal Testing. Le release gate doit ensuite passer:

```bash
npm run subscription:qa:release-gate
```
