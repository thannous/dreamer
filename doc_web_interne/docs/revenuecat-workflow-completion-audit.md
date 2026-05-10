# RevenueCat Workflow Completion Audit

Date: 2026-05-10

Objectif utilisateur: tester et finaliser le workflow RevenueCat avec differents profils utilisateurs et abonnements, du mock valide au Test Store puis Play autant que possible localement.

## Criteres de succes

| Critere | Artefact | Preuve actuelle | Statut |
| --- | --- | --- | --- |
| Visualiser les profils utilisateur subscription | `components/subscription/SubscriptionQALab.tsx` | QA Lab expose guest, new free, existing free, plus user, mode, user, tier, product, renews, quota, auth | Fait |
| Tester les profils mock | `maestro/subscription-qa-lab.yml` | Flow couvre guest, new free, plus user, existing free | Fait |
| Tester les etats mock abonnement | `maestro/subscription-qa-lab.yml` | Flow couvre monthly, annual, cancelled, expired et paywall | Fait |
| Valider les packages Test Store sans achat | `maestro/subscription-teststore-readiness.yml` | Flow `Probe SDK` attend `packages 2`, `$rc_monthly`, `$rc_annual` | Fait |
| Revalider l'entitlement RevenueCat live | MCP RevenueCat via nouveau `codex exec` | `Noctalia Plus` = `entla0745c9b44`, attache `monthly`, `yearly`, `noctalia_plus:monthly`, `noctalia_plus:annual` | Fait |
| Proteger tout achat Test Store | `scripts/run-subscription-teststore-purchase.js` | Refuse sans `REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE` | Fait |
| Preflight achat sans Store | `test:e2e:subscription-teststore:purchase:preflight` | Valide plan, credentials et args Maestro sans lancer Maestro ni achat | Fait |
| Preparer le flow achat Test Store | `maestro/subscription-teststore-purchase-manual.yml` | Sign-in test account, probe SDK, achat monthly/annual, refresh | Pret, non execute |
| Capturer les preuves manuelles | `scripts/update-subscription-qa-evidence.js` | Helper remplit `revenuecat-qa-evidence.local.json` avec `testedAt`, `tester`, `appUserId`, `evidence`; `appUserId` et les gates `play_*` `easBuildId` doivent etre des UUID; le texte du template, les dates invalides, les identites vides ou en espaces et les ids invalides sont refuses | Fait |
| Bloquer release sans preuve complete | `scripts/subscription-qa-report.js --require-full` | `npm run subscription:qa:release-gate` reste rouge sans preuves; une preuve identique au texte du template reste aussi bloquee | Fait |
| Revalider le harnais local sans Store | `npm run subscription:qa:verify-local` | Lance les checks syntaxiques, les tests du harnais QA, `subscription:qa:report`, une verification que la release gate bloque sans preuve pour la bonne raison, et les preflights d'achat monthly/annual avec compte factice sans achat ni Metro; le verificateur a ses propres tests et `subscription:qa:report` verifie aussi que cette commande existe | Fait |
| Diagnostiquer les preuves invalides | `scripts/subscription-qa-report.js` | Si un fichier de preuve locale est present, le rapport affiche `Evidence Diagnostics` pour les gates mal remplies | Fait |
| Bloquer un fichier de preuve illisible | `scripts/subscription-qa-report.js` | Un JSON local invalide ne crashe pas le rapport; il bloque sur `Local evidence file parses` | Fait |
| Valider achat Test Store monthly | `test:e2e:subscription-teststore:purchase -- --plan monthly` | Necessite accord explicite et compte test | Manquant |
| Valider achat Test Store annual | `test:e2e:subscription-teststore:purchase -- --plan annual` | Necessite accord explicite et compte test | Manquant |
| Valider restore apres achat | QA Lab Restore + evidence gate `restore_after_reinstall` | Necessite achat deja realise | Manquant |
| Valider switch compte apres achat | QA Lab + evidence gate `account_switch` | Necessite deux comptes reels | Manquant |
| Valider Play Internal Testing | Build Play installe, achat Play, backend/webhook | Necessite build installe via Play Internal Testing | Manquant |
| Revalider le dashboard RevenueCat live | MCP RevenueCat OAuth via nouveau `codex exec` le 2026-05-10 | Projet `Noctalia` = `proje6db7596`; offering `default` actif avec packages Test Store et Play | Fait |
| Verifier les builds EAS Android disponibles | Expo MCP `build_list` / `build_info` | Dernier build Store Android `310244ed-027b-4028-8522-70c0f676a0e9`, production AAB, version 1.2.0 build 20, commit SEO du 2026-05-04; ne couvre pas les changements QA actuels | Info, non suffisant |
| Verifier les preuves locales manuelles | `doc_web_interne/docs/revenuecat-qa-evidence.local.json` | Fichier absent au 2026-05-09; aucune preuve manuelle/externe n'a encore ete enregistree | Manquant |

## Prompt-to-artifact checklist

| Exigence explicite | Fichier / commande | Verification |
| --- | --- | --- |
| Differents profils utilisateur | `maestro/subscription-qa-lab.yml` | `npm run test:e2e:subscription-qa -- --device emulator-5554 --retries 0` a passe apres durcissement du flow et reload Metro |
| Differents abonnements | `services/mocks/subscriptionServiceMock.ts`, `SubscriptionQALab.tsx`, `subscription-qa-lab.yml` | Mock monthly/annual/cancelled/expired couverts |
| Test Store | `.env.teststore`, `eas.json`, `subscription-teststore-readiness.yml` | `npm run test:e2e:subscription-teststore -- --device emulator-5554 --retries 0` a repasse le 2026-05-10 avec packages 2 apres reload Metro `.env.teststore` |
| Google Play | `.env.playstore`, `eas.json`, `constants/subscription.ts` | Config presente; `subscription:qa:report` verifie `release`, `preview`, `production`, `production-apk`; achat Play non execute |
| Entitlement live | MCP RevenueCat `list_entitlements` via nouveau `codex exec` | `Noctalia Plus` existe et attache les produits Test Store `monthly`/`yearly` et Play `noctalia_plus:monthly`/`noctalia_plus:annual` |
| Visualiser les workflows | `SubscriptionQALab.tsx` | Surface Settings affiche mode, SDK key, packages, user, tier, product, renews, quota, auth, actions |
| Etre sur que tout fonctionne | `subscription:qa:release-gate` | Gate bloque tant que les preuves manuelles/externes sont absentes |
| Ne pas confondre mock et reel | `subscription-qa-report.js`, `revenuecat-qa-workflow.md` | Matrice separe Automated, Manual purchase gate, External store gate |
| Enregistrer les preuves | `revenuecat-qa-evidence.example.json`, `update-subscription-qa-evidence.js` | Tests prouvent evidence -> report -> gate count; les gates Play sans `easBuildId` UUID et les preuves sans `appUserId` UUID restent bloquees; les textes de preuve restes au template, les dates invalides, les identites en espaces et les JSON invalides ne comptent pas |
| Revalidation live RevenueCat | MCP RevenueCat `list_projects` puis offerings/packages via nouveau `codex exec` | `Noctalia` = `proje6db7596`; offering `default` actif; `$rc_monthly` -> `monthly` + `noctalia_plus:monthly`; `$rc_annual` -> `yearly` + `noctalia_plus:annual` |
| Preflight achat | `npm run test:e2e:subscription-teststore:purchase:preflight -- --plan monthly --device emulator-5554` | Ne necessite pas `REVENUECAT_QA_APPROVAL`, ne lance pas Maestro, valide les prerequisites locaux |
| Verification locale rapide | `npm run subscription:qa:verify-local` | Regroupe syntax checks, tests scripts QA, rapport de couverture, blocage attendu de la release gate sans preuve pour la bonne raison et preflights d'achat monthly/annual sans ouvrir le Store |
| Build EAS Android existant | Expo MCP `build_info 310244ed-027b-4028-8522-70c0f676a0e9` | Build fini, STORE, production, AAB disponible, mais date/commit avant le workflow QA RevenueCat courant |
| Build EAS Android utilisable pour Play | Expo MCP `build_list @tanuki75/noctalia --platform ANDROID` + Git local | Aucun build Store ne contient les changements QA RevenueCat locaux; HEAD local `e25b8bb6cc275c4fefa29255244dcc78e37676e9`, dernier build Store `310244ed-027b-4028-8522-70c0f676a0e9` sur commit `e347120bc0beb02e90c0df37df78deb0ce5e1925` |
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

Resultat attendu au 2026-05-10:

- `subscription:qa:report`: passe
- `subscription:qa:verify-local`: passe
- `subscription:qa:release-gate`: echoue volontairement avec 7 portes restantes
- tests scripts QA: passent, dont le refus des preuves qui gardent le texte du template, une date invalide, une identite vide/en espaces, un `appUserId` non UUID ou un `easBuildId` non UUID dans le report et le helper d'ecriture
- tests cibles abonnement: `services/__tests__/revenuecatUI.test.ts`, `services/__tests__/subscriptionService.test.ts`, `services/subscriptionSyncService.test.ts`, `services/mocks/subscriptionServiceMock.test.ts`, `hooks/useSubscription.test.tsx`, `lib/__tests__/revenuecat.test.ts`, `lib/__tests__/revenuecatSubscriber.test.ts`, `tests/app-routes/settingsScreen.test.tsx` passent (8 suites, 90 tests)
- lint/typecheck app: passent
- `typecheck:tests`: echoue actuellement sur des tests legacy hors perimetre RevenueCat (`DreamMutation`, mocks non types, parametres implicites `any`); ne pas l'utiliser comme preuve de completion du workflow abonnement tant que ces tests globaux ne sont pas remis a niveau
- EAS Play Store profiles: `release`, `preview`, `production`, `production-apk` utilisent la cle `goog_`
- canari mock QA Lab Android: passe sur `emulator-5554`
- canari Test Store readiness Android: repasse le 2026-05-10 sur `emulator-5554`; `SDK probe completed`, `packages 2`, `$rc_monthly`, `$rc_annual`
- garde achat Test Store: `npm run test:e2e:subscription-teststore:purchase -- --plan monthly --device emulator-5554` refuse sans approbation explicite
- MCP RevenueCat live: la session courante renvoie `403 access token has been revoked`, mais un nouveau `codex exec` le 2026-05-10 voit `Noctalia` (`proje6db7596`) et confirme l'offering `default` actif
- MCP RevenueCat entitlement: `Noctalia Plus` (`entla0745c9b44`) attache les quatre produits attendus
- Expo MCP build Android: verification relancee le 2026-05-10; dernier Store build fini `310244ed-027b-4028-8522-70c0f676a0e9`, mais insuffisant pour valider Play Internal Testing du workflow actuel
- Play Internal Testing: aucun build Android Store actuel ne contient les changements QA RevenueCat locaux; il faut commit/push les changements concernes puis lancer un nouveau build Store avant les gates `play_*`
- scope de commit Play: `git add --dry-run` sur la liste du runbook passe; `git diff --cached --name-only` reste vide apres verification
- preuve locale: `doc_web_interne/docs/revenuecat-qa-evidence.local.json` absent; `subscription:qa:release-gate` doit donc rester rouge avec 7 portes restantes

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
