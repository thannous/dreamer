# RevenueCat — parcours natifs Android locaux du 16 octobre 2026

**7 parcours distincts passés**, en deux sélections finales vertes (3 + 4), avec zéro échec, saut, flaky, retry automatique ou appel modèle. Le [reçu expurgé](revenuecat-android-native-qa-20261016.receipt.json) conserve les identités et empreintes des rapports canoniques. Les artefacts bruts restent locaux : **7 traces et 11 captures**.

## Candidat et environnement

- Application : `225aafa07de3215d923e81596aa3bc84d37776de` (inclut les PR #371 et #375), sans modification du code applicatif pour ce lot.
- APK **Release 3.5.0 (83)**, `com.tanuki75.noctalia`, construit et installé localement, architecture `arm64-v8a`, OTA désactivée, signature locale de test ; aucun compteur EAS/Store modifié.
- SHA256 APK : `c33bdb98136db2412bf87f40bcfc3d182edc8c550d90187e19e0a2168e60539e`. Empreinte installée identique avant et après chaque sélection finale.
- Cible dédiée : `Pixel_9_API_37`, `emulator-5588`, **Android 17 / API 37**. État initial conservé dans le snapshot local `before-native-billing-20261016` avant installation et remise à zéro des fixtures.
- Profil compilé `mock-persistent` : comptes, reçus, opérations Store et confirmation d’accès simulés ; audio mock, feature sheets OFF, QA Lab activé. Aucun paiement réel ni compte Store utilisé.
- Node **24.19.0**, e2e **0.21.1**, mobile **0.12.1**, agent-device **0.21.25**, Temurin **17.0.20.1+1**. Un worker, `app.open()` en premier, aucune inférence.
- [Tests exécutés](../../../tools/e2e/tests/dreamer.mobile.e2e.ts), alors non commités : SHA256 `952d8c295b436bb95e219d9ceab6b58cb9dbc8f9a99a168ae4fca0564a580c97`, identique dans les deux sélections finales et dans le checkout principal après copie.

## Résultats observés

| Parcours | Assertions | Achats / restaurations simulés |
| --- | --- | --- |
| Achat mensuel | Succès, Plus actif, analyses illimitées | 1 / 0 |
| Restauration avec reçu | Plus actif et analyses illimitées sans achat | 0 / 1 |
| Restauration vide | Information « No active subscription », aucun succès, quota Free `5 / 3` conservé | 0 / 1 |
| Achat avec activation différée | Attente sans faux succès, fermeture/réouverture, relance d’activation, puis Plus | 1 / 0 au total |
| Restauration avec activation différée | Même attente et reprise, puis Plus | 0 / 1 au total |
| Connexion profil existant | Retour à l’offre, achat disponible, fermeture, Home puis arrière-plan/premier plan vers Capture sans réouverture de l’offre, quota `5 / 3` | 0 / 0 |
| Connexion nouveau profil | Même retour et reprise, quota `0 / 3` | 0 / 0 |

La réouverture après attente conserve le message d’activation en cours. La relance ne déclenche aucune seconde opération Store simulée. Après connexion, les assertions contrôlent l’offre réellement affichée, la disponibilité de l’achat, sa fermeture, l’absence d’offre au premier plan et le quota du compte concerné.

| Sélection finale | Run SDK | Résultat |
| --- | --- | --- |
| Restauration vide + deux connexions | `01a144b5-1eac-7620-93f5-b337c42a2210` | 3/3 |
| Achat, restauration avec reçu, deux activations différées | `01a144b7-6cd3-7da6-98fb-3abbf93c550b` | 4/4 |

Les deux `end.json` portent `applicationQualified: true`, sources et sorties stables, identité installée validée avant/après, nettoyage complet, verrou libéré et aucune erreur secondaire. Le reçu contient leurs chemins relatifs au worktree et les empreintes déjà produites par les manifests canoniques.

## Adaptations et premiers diagnostics

Le premier pilote d’achat était vert. La sélection suivante avait trois succès et trois échecs d’attentes reprises d’iOS ; elle reste conservée comme diagnostic, sans qualification globale :

- Le header Close de l’offre Free était partiellement masqué sous la barre système Android tout en étant déclaré visible. Après restauration vide, le test utilise désormais le footer visible « Continue free », relié au même [handleClose](../../../app/paywall.tsx). L’assertion exige toujours la disparition effective de l’offre, puis le quota Free et les compteurs exacts. Cela ne qualifie pas le ciblage du header masqué.
- Au retour au premier plan, Android applique la destination Capture prévue par [navigateForForeground](../../../app/_layout.tsx) et le [fallback de démarrage](../../../lib/onboardingState.ts). Les deux tests attendaient Home. L’assertion Android exige maintenant Capture et maintient l’absence de paywall ; une intention de retour à l’offre non consommée ferait toujours échouer le test. La branche iOS conserve son attente antérieure et n’a pas été rejouée ici.
- Le SDK mobile ne projette pas l’état d’expansion Android comme la valeur UIKit. Les compteurs se lisent après réouverture des réglages et expansion explicite du panneau QA.

Les trois cas corrigés, puis les quatre autres, ont été rejoués sur le même fichier final et le même APK. TypeScript e2e et ESLint du fichier passent. Aucune modification applicative n’a été nécessaire.

Le projet Android a été généré uniquement dans le nouveau worktree avec `expo prebuild --platform android --no-install`, après le contrôle de compatibilité Expo. OTA a été désactivée et les architectures limitées à arm64 dans ce projet isolé. Gradle termine avec le code 0 et produit le reçu Release. Le wrapper de build termine à 3 car les helpers de tests ont été édités pendant la compilation (`SOURCE_OR_OUTPUT_CHANGED`) ; ses entrées applicatives/natives sont restées identiques. Ce build n’est pas présenté comme un test fonctionnel vert. Les deux exécutions finales valident séparément le reçu, les entrées et l’installation, avec le code 0.

## Relance locale

Le worktree natif conservé est `/Users/timax/.codex/worktrees/android-billing-qa/noctalia`. Émulateur démarré, commande complète pour rejouer les sept tests :

```sh
cd /Users/timax/.codex/worktrees/android-billing-qa/noctalia
E2E_DEVICE=emulator-5588 E2E_AVD_NAME=Pixel_9_API_37 \
  E2E_RELEASE_RECEIPT="$PWD/tools/e2e/.e2e/dreamer-android/1792153430675-61897-18bfddd9-cffd-4bca-b00a-4b35c7fe29e3/release.json" \
  mise exec -- node tools/e2e/run.mjs dreamer android run --install-release --tag native-billing
```

Les sélections réellement exécutées après les corrections remplacent `--install-release --tag native-billing` par `--tag native-billing --grep 'empty restore|guest returns'`, puis `--tag native-billing --grep-invert 'empty restore|guest returns'`. L’installation avait été effectuée par le pilote ; l’identité installée est revalidée à chaque run. De nouvelles entrées applicatives/natives nécessitent un nouveau build via le [runner canonique](../../../tools/e2e/README.md).

## Portée et livraison

Preuve d’interface **native Android sur émulateur**, avec auth, reçus et convergence simulés. Elle ne qualifie pas le checkout Play Store/RevenueCat réel, OAuth, les webhooks ou le backend réel, un appareil physique, la restauration après réinstallation ou la reprise après mort du processus. Le [rapport iOS antérieur](revenuecat-native-qa-20261016.md) conserve sa propre révision et ses résultats.

Ce lot livre les tests Android, la matrice et le rapport expurgé. Les validations natives ci-dessus sont réutilisées sur leur révision et leur APK d’origine ; aucun nouveau passage natif sur le commit de livraison n’est revendiqué. La branche de livraison part de `0b9551f7576ddd86104f6a7064bf62cbaeedfcc1`, qui ajoute depuis les tests des changements du chat Plus, de sa copie et des services IA. Les corps de tests livrés restent exactement ceux des deux sélections Android finales ; `verify:pr` qualifie séparément le commit de livraison. Aucun EAS build, paiement réel, envoi Store ou déploiement ; WIP du checkout principal préservé. L’état QA et les artefacts restent disponibles dans le worktree pour une relance.
