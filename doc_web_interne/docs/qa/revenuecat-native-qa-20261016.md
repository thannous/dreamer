# RevenueCat — parcours natifs locaux du 16 octobre 2026

**7 parcours distincts passés sur iOS Simulator**, en deux sélections finales vertes (5 + 2), avec zéro échec, saut, flaky, retry automatique ou appel modèle. Le [reçu expurgé](revenuecat-native-qa-20261016.receipt.json) conserve les identités, compteurs, identifiants de run et empreintes des preuves d’origine. Les rapports SDK, traces, captures et binaires restent des artefacts locaux hors Git.

## Révision réellement testée

- Application : `c9dea5ef7911316f41f46d5837c35143994c15e8` (PR #371), sans modification applicative dans ce lot.
- Binaire : Noctalia **3.5.0 (11)**, Release Simulator local, `com.tanuki75.noctalia`. Ce compteur décrit le build local ; aucun compteur EAS/Store modifié.
- Cible dédiée : `Noctalia_Native_QA`, iOS 27.0. Un worker, `app.open()` en premier, données exclusivement synthétiques.
- Profil compilé : `mock-persistent`, auth/reçus/confirmation d’accès simulés, audio mock, feature sheets OFF, OTA désactivée. Aucun paiement réel.
- Runtime : Node 24.19.0, e2e **0.21.1**, `@e2e-dev/mobile` **0.12.1**, agent-device **0.21.25**.
- Binaire SHA256 : `7bee7746ebcb22f3f51762cfea353909b49e57d7571fdf8291296603524e5a54`. Identité installée identique avant/après chaque sélection ; nettoyage complet, verrou libéré, aucune erreur secondaire.
- Fichier de tests exécuté : [dreamer.mobile.e2e.ts](../../../tools/e2e/tests/dreamer.mobile.e2e.ts), SHA256 `1ca4b97998dc8ffa458b7367f34f5d5fa6ac9bcec22e64d266c0e205db2ef162`, sur le parent applicatif ci-dessus avec des tests alors non commités. Sources/sorties stables pendant chaque run.

## Parcours observés

| Parcours | Assertions | Achat / restauration simulés |
| --- | --- | --- |
| Achat mensuel | Succès, Plus actif, analyses illimitées | 1 / 0 |
| Restauration avec reçu | Plus actif et analyses illimitées sans achat | 0 / 1 |
| Restauration vide | Information « No active subscription », aucun succès, quota Free `5 / 3` conservé | 0 / 1 |
| Achat avec activation différée | Attente sans faux succès, fermeture/réouverture, relance d’activation, puis Plus | 1 / 0 au total |
| Restauration avec activation différée | Même attente et reprise, puis Plus | 0 / 1 au total |
| Connexion profil existant | Retour à l’offre, achat disponible, fermeture via « Continue free », arrière-plan/premier plan sans réouverture, quota `5 / 3` | 0 / 0 |
| Connexion nouveau profil | Même retour et reprise, quota `0 / 3` | 0 / 0 |

Les compteurs proviennent du Store simulé. Les assertions utilisent les libellés accessibles iOS complets, l’état accessible du panneau QA et l’enfant texte du toast. Après connexion, le footer visible utilise le même handler que Close : un ancien tap d’en-tête hors écran n’avait fait que défiler et ne compte pas comme une fermeture réussie.

## Identité des preuves

| Sélection | Run SDK | Résultat |
| --- | --- | --- |
| Achat/restauration | `01a143f1-7637-780b-ac99-6423233072f7` | 5/5 |
| Retour après connexion | `01a143ef-6bd8-7cef-b940-ae30863b5189` | 2/2 |

Le reçu référence les répertoires relatifs du worktree natif conservé. Il contient les empreintes déjà produites par les manifests canoniques, sans recopier les données brutes. Total : **7 traces et 11 captures**. Les premiers runs rouges de diagnostic restent séparés dans l’archive locale ; ils ne sont pas requalifiés en succès.

## Livraison des tests

La livraison ajoute uniquement `platforms: ['ios']` aux options de ces sept tests : la lecture de l’expansion du panneau QA utilise une valeur UIKit. Les corps exécutés et leurs helpers sont inchangés, ce qui est vérifié en retrouvant exactement le SHA256 d’origine après retrait de cette seule ligne. Les autres tests Android restent inchangés ; le filtre déclare une absence de qualification Android et ne la compte pas comme une réussite.

SHA256 du fichier livré : `777443b74ca6a49ff2ba463d645146e1bba08ff9ad6c6992292d87f4eb64e6c1`. La preuve native est réutilisée pour les mêmes corps de tests, sans présenter ce changement de métadonnées comme une nouvelle exécution native. `master` a depuis reçu des modifications du Journal et de la CLI Supabase ; cette preuve conserve la révision applicative d’origine et ne qualifie pas ces ajouts. La vérification du commit de livraison par `npm run verify:pr` est indiquée dans la PR.

## Rejouer

Depuis le checkout natif de la **révision applicative testée**, conservant ses entrées natives et son binaire archivé :

```sh
E2E_DEVICE=Noctalia_Native_QA \
  E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-ios/1792139806309-61913-77fadd6f-fb0c-4083-ac42-b31869609928/release.json \
  mise exec -- node tools/e2e/run.mjs dreamer ios run --tag native-billing
```

Sélections réellement exécutées : même commande avec `--tag native-billing --grep-invert '^Dreamer native billing guest returns'` (5), ou `--grep '^Dreamer native billing guest returns'` (2). Le changement de sélection iOS conserve ces sept cas ; une collecte iOS/Android et le typage vérifient cette modification de déclaration.

Pour une autre révision applicative, produire son propre reçu Release avec le [runner natif](../../../tools/e2e/README.md#native-release-provenance-and-diagnostic-handoff). Le garde refuse un reçu dont les entrées applicatives/natives diffèrent. Le projet iOS obsolète avait été régénéré uniquement dans le worktree natif (`expo prebuild --platform ios --no-install`, puis `pod install`). Le premier build a préparé les frameworks Release ; le garde a refusé ce changement d’entrées. Le build suivant, sur entrées stables, a produit le reçu référencé. Sa commande `xcodebuild` et ses empreintes restent dans le reçu d’origine.

## Portée

Ces preuves couvrent l’interface native iOS et les parcours simulés. Elles ne qualifient pas le checkout RevenueCat/Store réel, les reçus Store, les webhooks, le backend réel ou OAuth Google/Apple. Android, appareil physique, installation Store, restauration après réinstallation et reprise après mort du processus restent hors de ce run. Aucun déploiement ou paiement réel ; données personnelles et WIP préservés.
