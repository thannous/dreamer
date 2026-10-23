# Dreamer — parcours natifs manquants, 22 octobre 2026

**Android : six parcours couverts par preuve composite.** iOS : cinq parcours validés ; la reconnaissance vocale reste bloquée par l’environnement Apple. Tests courants : `b2b9937aa67c29c914e49b2c5bbc4897ab103db7` ; binaires : `0ee3471fd00361c0df2d90f8cd67aefded4c2d27`. Ces résultats réunissent plusieurs exécutions identifiées ; aucune campagne fraîche « 6/6 » n’est revendiquée.

## Identité du candidat

[Guide et préparation](../../../tools/e2e/native-journeys.md) · [voix](../../../tools/e2e/tests/dreamer-voice.mobile.e2e.ts) · [synchronisation/comptes](../../../tools/e2e/tests/dreamer-sync-account.mobile.e2e.ts) · [analyse/chat](../../../tools/e2e/tests/dreamer-recovery.mobile.e2e.ts).

Release locales `local-backend`, bundle `com.tanuki75.noctalia.qa`, mocks et OTA désactivés. Pile Auth/Postgres locale jetable avec deux comptes synthétiques propres à cette pile. Versions observées : e2e `0.21.2`, mobile `0.12.3`, Node `24.22.1`.

| Build `0ee3471f` réussi | iOS | Android |
| --- | --- | --- |
| Cible | Simulator `Noctalia_Journeys_QA`, `0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD` | AVD `Noctalia_Journeys_QA`, `emulator-5560`, ARM64 |
| Reçu / version | [1792693988368…](../../../tools/e2e/.e2e/dreamer-ios/1792693988368-28877-056cff6f-3f48-40a4-a62f-b4969b578854/release.json), `3.7.0 / 14` | [1792693986956…](../../../tools/e2e/.e2e/dreamer-android/1792693986956-28765-4425541c-565b-4e43-84da-942c64c15078/release.json), `3.7.0 / 83` |
| SHA-256 binaire | `424c5dd677aae3edf472a69985becf8e73b19357f478df589cab28d03c4f4e69` | `1ceefc8918528273d4830d46a9fa54820559f3d9e57622b7ddce0bf97b1fbf58` |
| Dernier rejeu compte | [`b2b9937a` 1792695759038…](../../../tools/e2e/.e2e/dreamer-ios/1792695759038-63159-6dc3fa52-8e6e-430d-baca-eab680f44e50/report.json), passé en 286,45 s | [`b2b9937a` 1792695581671…](../../../tools/e2e/.e2e/dreamer-android/1792695581671-61000-1297010f-057c-4ee6-bc7f-e43605f4dac4/report.json), passé en 146,807 s |

Le binaire Android est **identique octet pour octet** à celui ayant validé la voix au SHA `94c7917ed6a0ab9e5bda31d4fd0f6e0d20681936`. Les derniers changements concernent les tests et leur préparation : visite individuelle des cartes de la liste virtualisée, mesure de leur point de tap face à la barre d’onglets et attente de l’hydratation. `b2b9937a` réinitialise aussi `dream_creation_buckets` pour les deux seuls UUID de fixture, après fermeture/clear de l’app et nettoyage de leurs rêves/crédits. **La limite produit de 50 créations/24 h et ses droits restent inchangés.**

## Résultats par parcours

| Parcours et assertion déterminante | iOS | Android |
| --- | --- | --- |
| Refus/réautorisation microphone : brouillon intact, saisie de secours, sauvegarde unique après redémarrage | Passé `a4d33591`, réutilisé | Passé `94c7917e`, réutilisé |
| Fichier vocal : deux repères avant saisie, pause, correction et sauvegarde unique durable | Bloqué, non qualifié | Passé `94c7917e`, réutilisé |
| Hors ligne : aucune ligne serveur pendant la coupure, modification durable après redémarrage, une ligne après reconnexion | Passé `85007ecf`, réutilisé | Passé `85007ecf`, réutilisé |
| Invité/compte : rêve et brouillon transférés, reconnexion, IDs stables, séparation des comptes | Passé `b2b9937a`, frais | Passé `b2b9937a`, frais |
| Analyse interrompue : job durable avant arrêt, résultat récupéré sans nouvelle analyse ni crédit | Passé `85007ecf`, réutilisé | Passé `85007ecf`, réutilisé |
| Chat : accusé final perdu après commit, même requête, aucune paire ni crédit supplémentaire | Passé `85007ecf`, réutilisé | Passé `85007ecf`, réutilisé |

Cette preuve associe trois parcours `85007ecfff4c072f05560998904f60ccd59c6672` par plateforme, deux parcours vocaux Android `94c7917e`, la permission iOS `a4d3359114a199f7fa9c20224921fb422d03231e` et les comptes Android/iOS `b2b9937a`. Les trois parcours non vocaux réutilisés ne démarrent pas la reconnaissance ; le changement applicatif ultérieur concerne uniquement l’arrêt vocal. Les deltas suivants ne changent que les tests et leur préparation. Android compte six cas validés et iOS cinq, avec le blocage vocal toujours explicite.

## Rapports retenus

- Trois parcours non vocaux : [Android `85007ecf`](../../../tools/e2e/.e2e/dreamer-android/1792691919208-85462-22725a98-1426-46da-ac36-2c05f1410bc7/report.json), run `01a164c3-e286-7385-a254-00a7685c6a4a`, et [iOS `85007ecf`](../../../tools/e2e/.e2e/dreamer-ios/1792692507330-97571-3e48f8ec-ca77-455e-88dc-2e2123db5b15/report.json), run `01a164cc-f62c-7396-971c-69676edd1bd9`. Les rapports globaux restent respectivement 5/6 et 4/5 ; seules leurs trois lignes passées sont réutilisées ici. [Reçu Android](../../../tools/e2e/.e2e/dreamer-android/1792691820600-81374-325012c3-6712-49d1-98d8-3af1f80df2a8/release.json) · [Reçu iOS](../../../tools/e2e/.e2e/dreamer-ios/1792691820181-81170-d2a1e24c-c9c0-4526-b5cd-6827f1109400/release.json).
- Deux parcours vocaux Android : [rapport `94c7917e`](../../../tools/e2e/.e2e/dreamer-android/1792693458816-22973-40ba07db-074a-4fa1-91c6-a5751dae8ed1/report.json), run `01a164db-622a-7ff9-8529-a3681130cbb6`, et [reçu](../../../tools/e2e/.e2e/dreamer-android/1792693409345-22177-a970309f-e887-4761-bbc5-47e311b33fe5/release.json). Le compte de ce même run échoue dans le moteur de saisie : le résultat global est 2/3, sans qualification du compte.
- Permission iOS : [rapport `a4d33591`](../../../tools/e2e/.e2e/dreamer-ios/1792694322696-41119-69f0b0d9-9399-4740-ac12-20800f15e3c3/report.json), run `01a164e8-b15b-777c-b526-a464ede85d52`, sur le binaire `0ee3471f`. Permission passée en 88,940 s ; compte échoué en 297,204 s lors de l’ouverture de la seconde carte, résultat global 1/2. Seule la permission est réutilisée.
- Compte Android : [rapport `b2b9937a`](../../../tools/e2e/.e2e/dreamer-android/1792695581671-61000-1297010f-057c-4ee6-bc7f-e43605f4dac4/report.json), run `01a164fb-c3db-774f-8bd8-ec82f2567675`, 18:59:45–19:02:12 UTC, 1/1 passé. `end.json` confirme exit 0, source propre/stable, sorties stables, `applicationQualified=true`, nettoyage complet et verrous libérés.
- Compte iOS : [rapport `b2b9937a`](../../../tools/e2e/.e2e/dreamer-ios/1792695759038-63159-6dc3fa52-8e6e-430d-baca-eab680f44e50/report.json), run `01a164fe-8fe1-7764-b354-8d2fd21b3ccf`, 19:02:54–19:07:40 UTC, 1/1 passé. La seconde carte était couverte par la barre d’onglets ; un défilement puis une nouvelle mesure libèrent son point de tap. Les assertions finales de contenu, IDs, isolation et brouillon vide passent. `end.json` confirme exit 0, source propre/stable, sorties stables, `applicationQualified=true`, nettoyage complet et verrous libérés.
- Les rapports réutilisés sont stables et nettoyés, mais leur qualification globale reste fausse puisqu’ils contiennent d’autres cas échoués ; seules les lignes passées identifiées ci-dessus sont retenues.

Les E2E ont révélé trois défauts produit corrigés et couverts : résultat d’analyse non récupéré après redémarrage, ancien texte rétabli par un échec tardif de création hors ligne malgré une modification encore en file, et Pause pendant un démarrage vocal en attente. Le diagnostic de fixture a séparément confirmé un compteur de créations arrivé à 50 après les campagnes répétées ; la suppression des rêves ne devait pas abaisser cette protection. Preuves et correction limitée aux deux comptes jetables : `/private/tmp/noctalia-guest-migration-aae-diagnostic/`.

## Limite vocale iOS

Sur iOS `27.0 (24A434)`, un diagnostic séparé par les API publiques Apple Buffer et URL échoue avant reconnaissance : `kLSRErrorDomain 300`, modèle `en_US`, `mini.json` absent. `requiresOnDeviceRecognition=false` autorise le réseau sans forcer un recognizer distant. Preuve : `/private/tmp/noctalia-speech-url-probe/{receipt.json,result.json,recognition.log,RERUN.txt}` ; helper retiré, données Dreamer préservées.

Sur iOS `27.1 (24A94425)`, la cible jetable `6F7347C5-B58E-4FDD-82E1-78BF73DA565A` bloque à la permission TCC : délai de 45 s, deux taps « Autoriser » sans fermeture confirmée, `simctl privacy grant` refusé (`NSPOSIXErrorDomain 1`). **Zéro tentative ASR : aucun modèle 27.1 qualifié ni démontré défaillant.** Reçu `/private/tmp/noctalia-speech-ios271-probe/receipt.json` ; session fermée, helper retiré, seule cette nouvelle cible arrêtée.

## Vérification et rejeu

**`verify:pr 0ee3471f` PASS** : 11 contrôles exécutés, 6 réutilisés, 5 hors périmètre ; preuve `.git/verify-proofs/f981a8491bc026dca48df2f59a3e525107d20ea3.json`, 18:33:33–18:36:50 UTC. Les 49 tests ciblés du correctif Pause et les 165 tests du chargement de l’asset après gardes sont passés. Le résultat `verify:pr` et le SHA du commit contenant ce rapport sont consignés dans la PR de livraison. Revue indépendante des corrections et des preuves : aucun blocage relevé ; la reconnaissance iOS reste non qualifiée.

Depuis le worktree du candidat, après la préparation du [guide natif](../../../tools/e2e/native-journeys.md), garder la même pile vivante et les deux variables communes ci-dessous pendant une campagne. Exécuter les plateformes successivement, un worker par appareil. Une nouvelle pile nécessite de nouveaux builds.

```sh
export E2E_NATIVE_JOURNEYS=1
export E2E_NATIVE_BACKEND_MANIFEST=/private/tmp/noctalia-native-journeys-20261022-stack/manifest.json
adb -s emulator-5560 shell am force-stop com.tanuki75.noctalia.qa
E2E_DEVICE=0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-ios/1792693988368-28877-056cff6f-3f48-40a4-a62f-b4969b578854/release.json mise exec -- npm run test:testerarmy:mobile -- dreamer ios run --tag native-real-account
xcrun simctl terminate 0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD com.tanuki75.noctalia.qa
E2E_DEVICE=emulator-5560 E2E_AVD_NAME=Noctalia_Journeys_QA E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-android/1792693986956-28765-4425541c-565b-4e43-84da-942c64c15078/release.json mise exec -- npm run test:testerarmy:mobile -- dreamer android run --tag native-real-account
```

Conserver rapport, reçu Release, configuration publique embarquée, `end.json` et trace utile. Ces artefacts et les secrets restent privés et ignorés par Git. Stockage natif, HTTP, Auth/Postgres, handlers, worker et quotas réels **locaux** ; fournisseur IA déterministe au transport. Analyse suspendue après admission durable ; chat coupé après le vrai commit. Coupure réseau limitée au backend par proxy, sans mode avion. Le fichier vocal ne qualifie pas l’entrée acoustique ; `native-real-dictation` reste exclu. Aucun déploiement, Store, achat, appareil physique ni donnée personnelle n’est couvert.

Campagne arrêtée après fermeture des runners : API et pile locales terminées, manifeste privé retiré, AVD et Simulators QA arrêtés. Artefacts conservés. Les commandes ci-dessus documentent la pile de cette campagne ; sa recréation exige un nouveau manifeste et de nouveaux reçus de build selon le guide.

## Intégration de master — 23 octobre 2026

La PR #557 intègre `origin/master` au commit `605829bc878a3100c68b6f35998f93ec573aaa50`. Les conflits concernaient `app.config.ts` et `services/journalSyncEngine.ts` : la configuration QA conserve le repli local fermé de master et les gardes vocales locales ; la synchronisation conserve le dernier texte en attente pour une erreur ordinaire et les identifiants serveur récupérés pour un accusé incomplet de notes personnelles. Le contrôle de configuration applique la même source d’environnement aux valeurs et à leurs gardes.

Les tests ciblés couvrent configuration, journal, récupération des notes et reprise d’analyse ; la révision vérifiée et la preuve finale `verify:pr` sont consignées dans la PR. Les résultats natifs ci-dessus restent les preuves historiques du 22 octobre, avec leurs sources et builds d’origine. Aucun nouveau build ni rejeu iOS/Android n’est revendiqué pour cette intégration.
