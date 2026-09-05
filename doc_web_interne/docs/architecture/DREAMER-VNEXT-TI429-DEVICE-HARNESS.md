# Dreamer VNext TI-429 device harness

Executable matrix for TI-429. This file is a contract, not device proof.
Unexecuted automated rows stay **blocked**. Human rows stay **manual**.

## Runtimes

- `release-native`: installed base Release binary `com.tanuki75.noctalia` / scheme `noctalia`, current Motorola/device when authorized elsewhere and under the inter-app device lock (Dreamer/Lucid/Meditation : un seul proprietaire a la fois). Each proof records `binary_source` (local build vs Play) plus version/signature. That is local device proof, not Store, Play install-source or purchase proof. (Anterieur au 2026-09-04 : side-by-side `com.tanuki75.noctalia.qa` / `noctalia-qa` retire.)
- `mock-native`: mock fixtures. Failed analysis, quota and Plus/guest switching live here. They do not prove the installed Release binary.
- `manual`: TalkBack, contrast, large text, reduce motion, localization, mobile and tablet formats.
- `web`: applicable web format. Outside `:local`.

`npm run test:e2e:release:ti429:local` runs **only** the `release-ti429` suite. Every other automated row keeps the command written in the matrix.
Device commands run with no flag against the base package: defaults stay `com.tanuki75.noctalia` / `noctalia`.
Release YAML uses Maestro JS fallbacks (`${APP_ID || "com.tanuki75.noctalia"}`, `${DEEP_LINK_SCHEME || "noctalia"}://...`) so EAS can still execute `release-smoke.yml` without `-e`. The runner injects `APP_ID` / `DEEP_LINK_SCHEME` for the target package (historique : l'injection specifique QA est anterieure).

## Base binary (side-by-side QA : anterieur)

Build-only réellement supporté sur la base, jamais de second package QA :

```bash
npm run android:release:local -- --profile production-apk --abi arm64-v8a
```

Installation compatible à vérifier : le script de build local ne constitue pas une autorisation d'écraser la base Play ; la signature/version et la source doivent être contrôlées par la QA indépendante. La piste Google Play interne est autorisée par l'utilisateur, mais cette autorisation ne prouve ni upload ni installation. Ne jamais désinstaller ni effacer les données pour forcer. Do not run purchase or Test Store flows against a local binary. Auth-credential evidence stays separately blocked when credentials are missing.

Historique anterieur (ne plus utiliser) : side-by-side `com.tanuki75.noctalia.qa` / `noctalia-qa` avec `--side-by-side-qa`.

Validation statique, sans appareil :

```bash
npm run test:e2e:release:ti429:validate
```

Sélectionner ensuite **un scénario** après contrôle du binaire, du verrou et de
ses prérequis. Ne pas lancer la suite complète par défaut : elle inclut l'analyse
réelle et exige une session invitée pour le scénario guest-unlimited.
Les autres suites Release (offline, auth, permissions notamment) contiennent
encore des resets ; le garde physique les refuse. Leur présence dans la matrice
ne les rend pas exécutables sur la base.

## Préservation des données — huit scénarios TI-429

- Le lancement utilise uniquement `stopApp: false`. Aucun reset, effacement de
  brouillon, changement de permissions/réseau ni déconnexion.
- Immédiatement avant chaque saisie synthétique, le sous-scénario
  `ti429-ready-empty-editor.yml` exige un éditeur hydraté (contrôle de mode
  activé) et **zéro caractère brut**, espaces compris, sur le même écran.
  Brouillon présent, restauration en erreur ou preuve d'interface introuvable :
  arrêt bloquant. Ne pas effacer le brouillon pour faire passer le test.
- Le scénario kill/relaunch attend le statut de sauvegarde locale et vérifie
  son propre texte avant l'arrêt du processus. Après reprise, il conserve ce
  rêve synthétique en l'enregistrant dans le Journal.
- Les recherches/filtres existants du Journal ne sont pas modifiés. Si l'entrée
  synthétique n'est pas accessible, le scénario échoue ; ne pas ouvrir un rêve
  arbitraire. Les deux scénarios qui rouvrent une fiche depuis le Journal
  génèrent un identifiant unique dans leur en-tête, réutilisé dans toutes les
  saisies et preuves : une ancienne entrée ne peut pas valider l'exécution
  courante. Les fragments exacts de TI-413 restent inchangés.
- Guest-unlimited exige une session déjà invitée : aucune déconnexion forcée.
  L'analyse interrompue exige une identité éligible vérifiée et l'autorisation
  de session IA payante avant exécution. Le clic CTA ne prouve pas à lui seul
  le démarrage d'une analyse ; la QA doit documenter cet état.
- Les rêves synthétiques enregistrés restent présents. Ce n'est pas une QA
  sans mutation. Les captures et rapports d'échec Maestro peuvent contenir des
  données personnelles : inspection locale, pas de publication brute.

Le validateur analyse les YAML et leurs dépendances pour empêcher la régression
de ce contrat. Ce contrôle statique ne remplace pas le garde d'exécution physique,
ni une validation de l'accessibilité réelle sur le binaire installé.

Gated (restent bloquées malgré le retrait du flag, ne pas exécuter sans déblocage explicite) :

```bash
npm run test:e2e:release:analysis:local -- --device <serial>
npm run test:e2e:release:voice-analysis:local -- --device <serial>
```

`analysis-success` reste `blocked` sans commande ; les rows voice-live TI-428 restent manuelles ou bloquées.

## Commands that never launch Maestro

```bash
npm run test:e2e:release:ti429:plan
npm run test:e2e:release:ti429:validate
npm run test:e2e:release:ti429:record
```

## Coverage

Machine-readable source: [`maestro/dreamer-vnext-ti429-matrix.json`](../../../maestro/dreamer-vnext-ti429-matrix.json).

| Criterion | Runtime | Mode | Source / command |
| --- | --- | --- | --- |
| Write <-> Tell | release-native | automated | `release-ti429` / `maestro/release-write-tell.yml` |
| Kill / relaunch draft | release-native | automated | `release-ti429` / `maestro/release-draft-kill-relaunch.yml` |
| Short fragment | release-native | automated | matrix command / `maestro/release-short-fragments.yml` |
| Long story >600 with sentinels | release-native | automated | `release-ti429` / `maestro/release-long-fragment.yml` |
| 10k paste | manual | manual | human paste |
| Offline local | release-native | automated | matrix command / `maestro/release-offline-local.yml` |
| Auth offline + sync | release-native | automated | matrix command / `maestro/release-auth-offline-sync.yml` |
| Analysis success | release-native | blocked | `maestro/release-analysis.yml`, sans commande (bloque, voir invité réel) |
| Analysis failed | mock-native | automated | `maestro/journal-dream-cta-labels.yml` |
| Analysis interrupted | release-native | automated | `release-ti429` / `maestro/release-analysis-interrupt.yml` |
| Analysis quota | mock-native | automated | `npm run test:e2e:quotas` |
| Independent image CTA after save | release-native | automated | `release-ti429` / `maestro/release-image-independent.yml` |
| Journal list / Trends / weekly-recap / recording links | release-native | automated | `release-ti429` / `maestro/release-journal-trends-deeplinks.yml` |
| analysis-ready `${DEEP_LINK_SCHEME || "noctalia"}://journal/{id}` | release-native | blocked | no flow: no stable fixture id; needs a real device id. Base scheme is local device proof only (anterieur : QA scheme) |
| Guest / free / Plus without purchase | mock-native | automated | `npm run test:e2e:subscription-qa` |
| Notifications | release-native | automated | matrix command / `maestro/release-notification-permission.yml` |
| TalkBack, contrast, large text, reduce motion | manual | manual | human device checks |
| Localization | manual | manual | FR/EN screenshots, unproven |
| Mobile / tablet / web formats | manual or web | manual | separate screenshots, unproven |

## Evidence

`npm run test:e2e:release:ti429:record` writes `maestro-results/android/ti429/<stamp>/{automated,manual,blocked}` plus `doc_web_interne/docs/android-ti429-evidence.local.json`. Le receipt initialise seulement un plan non exécuté : il ne contient ni `binary_source`, ni version, ni signature. Chaque preuve appareil collectée ensuite doit être accompagnée d'un relevé d'identité/signature (binaire local vs Play, version, signature) ; un sideload n'est jamais présumé integrity-valide par son package name.

A planned `blocked` row means the check has not been executed. It is not a pass, a fail, or Store/Linear proof.
