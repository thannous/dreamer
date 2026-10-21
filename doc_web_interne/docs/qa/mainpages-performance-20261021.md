# Fluidité des pages principales — 21 octobre 2026

## Résultat et intégration

Branche de livraison : `codex/dreamer-performance-mainpages-20261021`.

La PR [#518](https://github.com/thannous/dreamer/pull/518) était déjà fusionnée au contrôle de cette demande, le 20 octobre à 21:11:43 UTC (`ec7a6c940`). Ses deux revues ne portaient aucun constat bloquant. La suite est partie de master `364ea3794`, comprenant aussi #519 (ouverture et changement de page du journal), puis a intégré master `f53ad3360` (#520, SQL et contrôles de migrations) et `82a527088` (#521, privilèges SQL).

Le nouveau correctif conserve les peintures, couleurs, dispositions, gestes et animations. Dans Tendances, le défilement natif ne transmet plus un callback JavaScript par événement pour chercher les sections basses. Le runtime UI mémorise leurs positions après layout, compare l'offset au même seuil de 80 points et ne réveille JavaScript que lorsqu'une section s'allume. Les positions sont invalidées après les changements de layout, de taille du contenu et de fenêtre. Les sections déjà allumées le restent après changement de période ou retour sur l'onglet. Le web garde ses mesures en coordonnées de fenêtre.

Le binaire et les parcours qualifient l'application QA possédée `com.tanuki75.noctalia.qa`. L'application personnelle du Moto, ses rêves et ses réglages ne sont pas modifiés. La QA était sur l'onboarding puis sur un journal invité vide : chargement local de 200 rêves synthétiques, avec un helper signé qui refuse les données inconnues et ne modifie aucun autre scope. Pas de compte créé, de paiement, de backend déployé, de build EAS ni de publication.

## Leviers classés par importance

Le rang est une priorité technique pour ce problème, pas une estimation de pourcentage de FPS gagné.

| Rang | Levier | Impact et preuve | État |
| --- | --- | --- | --- |
| 1 | Réduire le travail multiplié par les cartes pendant le scroll du journal | Impact structurel élevé lorsque plusieurs cartes illustrées sont montées : mesures de parallaxe et mappers retirés, mesure invisible du texte bornée, nouveaux préchargements reportés après le geste. | Déjà livré par #518 ; [preuve et limites initiales](journal-performance-20261020.md). Les nouvelles mesures Moto portent sur l'ensemble de master, pas sur #518 isolée. |
| 2 | Réduire les redessins et la composition sans changer le rendu | Plus grand poste observé dans le profil CPU Moto : pile du RenderThread à 56,66 % des échantillons inclusifs, avec CanvasContext, Skia et le pilote Mali. Ce pourcentage n'est ni une occupation GPU ni un gain disponible. | Piste prioritaire restante : isoler le calque/élément qui redessine avant toute mise en cache matérielle ou modification de SVG. Le profil ne justifie pas de supprimer le flou, les peintures ou des animations. |
| 3 | Éliminer les allers-retours UI → JS pendant le scroll de Tendances | Coût évitable établi : jusqu'à trois `measureInWindow` par événement tant qu'une section reste hors écran. Désormais positions mises en cache sur UI et au plus un réveil par nouvelle section. | Corrigé dans ce lot ; comparaison physique ci-dessous. Les durées et la présentation des animations restent celles du produit. |
| 4 | Éviter les décodages et résolutions d'images pendant le geste | Impact potentiellement élevé à froid : disque/réseau/décodage peuvent concurrencer la lecture et le scroll. | Garde asynchrone corrigée dans #518. Le banc utilise des images locales ; il ne mesure pas le réseau ni les URLs froides. Ne pas diminuer la qualité pour améliorer artificiellement le score. |
| 5 | Borner les calculs sur les grands historiques tout en recherchant partout | Le cache de texte normalisé, le rétrécissement des résultats, les mémos et la fenêtre de présentation de 40 entrées existent déjà. Le filtrage précède la fenêtre. | Conservé. La preuve à 5 000 entrées de #518 reste une preuve fonctionnelle historique explicitement réutilisée ; aucune nouvelle mesure de framerate à 5 000 n'est revendiquée ici. |
| 6 | Arrêter le travail hors écran et au repos | Les peintures d'en-tête arrivent une fois puis reposent ; les capteurs sont déjà bornés à la peinture visible et au premier plan. Les onglets ne glissent pas. | Protections actuelles conservées. Aucun flag natif risqué, changement de clipping ou suppression visuelle n'a été ajouté. |

Le deuxième levier décrit le plus gros poste CPU observé ; le premier évite un coût qui croît avec les cartes. Les séries ne permettent pas de chiffrer une part de gain pour chacun. Une optimisation JavaScript seule ne démontre pas la suppression des retards de rendu restants.

## Identité des versions et méthode

| Champ | Référence | Candidat |
| --- | --- | --- |
| Source compilée | `364ea37943776f371aca59491d4ee297a0f84c34` | `8f856a04deaa8f42ac115841b195eedaac552a66` |
| APK SHA-256 | `ebfcd0fb9031fa024e99d4fc42bc80c08816f7b14584b49319807b1ca016b7a9` | `9b2d4e8e5fa2cfae7a4031370fad5ec207f80876b77da7f27badb3273e4a2f1e` |
| Configuration | Android Release local, `production-apk`, arm64-v8a, profileable, QA séparée | Identique |
| Version | 3.7.0 (83), non debuggable, OTA désactivées | Identique |
| Entrées natives | `7aae9ca02d51a82bcca812088cbf1fe24f7b3281baab9222e87cbcbdbb26adcb` | Identiques |

Les deux builds canoniques `android:release:local` passent : référence en 9 min 1 s, candidat avec `--reuse-native-project` en 2 min 16 s. Ce sont des builds Release propres ; pas des APK du mode itération. Génération Android uniquement dans le worktree isolé. Installation compatible par `adb install -r`, certificat local identique et hash installé relu par `verifyInstalledRelease`. Les commits ultérieurs ne changent pas les sources applicatives du binaire ; ils corrigent le protocole, étendent les tests, intègrent #520/#521 et écrivent ce rapport. Le changement `package.json` de #520 ajoute seulement deux commandes de contrôle SQL. Cette réutilisation est explicite, sans prétendre à une recompilation du dernier commit documentaire.

Outils : Node 24.19.0, Deno 2.7.14, Java 17, Expo 58.0.14, React Native 0.88.0, Reanimated 4.7.1 ; e2e 0.21.2, mobile 0.12.3, web 0.15.2, agent-device 0.21.28. Compatibilité Expo installée vérifiée hors ligne. Les API UI ont été lues dans la version installée et dans les références officielles [measure](https://docs.swmansion.com/react-native-reanimated/docs/advanced/measure/) et [useAnimatedReaction](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useAnimatedReaction/).

Banc physique : Motorola edge 60 fusion, Android 16, portrait 1220 × 2712, densité 450, texte 1.0, réglage maximal 120 Hz. Ce réglage ne signifie pas que toutes les frames sont effectivement présentées à 120 Hz. Même fixture synthétique de 200 entrées et mêmes images locales, deux swipes aller puis deux retour, coordonnées et durée conservées. Un pilote précède cinq passages fixés à l'avance par écran et par version. Le pilote réchauffe le scénario ; il n'est pas ajouté aux cinq passages. Les dumps UI et la préparation sont hors fenêtre. Pas de build, de campagne web ou de capture CPU concurrente aux séries finales.

Le runner final `5484052b995e7692d535d40b57c38711cf9ea5fe6cd08b4325951a51a0386d78` est identique pour les deux versions. Il refuse un premier plan ou une cible hors du package sélectionné, un changement de PID, de police, de rafraîchissement, de provenance et toute trace Perfetto malsaine. Un échec de parcours invalide la trace avant son analyse ; la reprise rejoue la phase échouée. Les deux contre-exemples dangereux sont simulés au niveau des interfaces, sans piloter l'application personnelle.

## Mesures physiques finales

| Écran / version | Runs valides | Frames | Échéances manquées | Médiane des P95 | Étendue des P95 par run |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tendances — référence | 5 | 2644 | 56/2644 (2.12 %) | 14.74 ms | 14.19–15.39 ms |
| Tendances — candidat | 5 | 2641 | 43/2641 (1.63 %) | 14.50 ms | 14.05–14.60 ms |
| Journal — référence | 5 | 2570 | 82/2570 (3.19 %) | 14.74 ms | 13.87–16.27 ms |
| Journal — candidat | 5 | 2605 | 65/2605 (2.50 %) | 14.29 ms | 13.91–15.47 ms |

Les deux comparaisons sont comparables et leur verdict est **indéterminé**. Tendances : P95 −1,63 %, échéances manquées −0,49 point. Journal : P95 −3,05 %, échéances manquées −0,70 point. Les étendues se recouvrent et le seuil de 10 % n’est pas atteint : aucun gain de FPS démontré, aucune extrapolation à tous les téléphones. Les vingt traces finales sont saines ; température 21,9 °C à chaque passage et statut thermique 0. Le journal sert aussi de contrôle sur une page dont ce nouveau lot ne modifie pas le code applicatif.

Le P95 porte sur la durée des surfaces de l'application dans [FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline), et les échéances manquées sur `App Deadline Missed`. Ce n'est ni un FPS moyen ni une latence de clic. Critère conservateur du comparateur : au moins trois runs, mêmes conditions et scénario, température médiane à moins de 2 °C, P95 amélioré d'au moins 10 %, étendues des P95 sans recouvrement et taux de manqués ne s'aggravant pas de plus de 0,2 point pour annoncer un gain. Ce sont des règles de comparaison, pas une promesse de 60/120 FPS sur tous les appareils.

Les premières séries, prises avant la correction des deux gardes de mesure, restent dans `baseline-trends-moto-five` (14,52 ms, 42/2 545) et `baseline-journal-moto-five` (14,51 ms, 75/2 501). Elles ne sont pas mélangées aux séries finales ni choisies pour embellir la comparaison. Les éventuels gains de ce lot ne doivent pas être attribués rétroactivement à #518.

Profil CPU exploratoire séparé : 12,0073 s, 7 238 échantillons, zéro perdu, huit gestes fixes dans Tendances sur la référence. `RenderThread::threadLoop` est à 56,66 % inclusifs, `CanvasContext::draw` à 48,26 % et `NodesManager.onEventDispatch` visible à 4,31 %. Ces piles se recouvrent et ne s'additionnent pas. Le flou Skia est visible mais ce profil seul n'en fait pas la cause dominante. Il localise des postes CPU ; il ne mesure pas la durée GPU ou un gain statistique. Un second échantillonnage exploratoire identique sur le candidat donne 6 972 échantillons, zéro perdu en 12,0167 s ; RenderThread reste le premier poste à 57,79 % inclusifs, CanvasContext à 49,00 % et onEventDispatch à 4,09 %. Une capture par version ne suffit pas à annoncer un gain CPU : les pourcentages sont relatifs et les piles se recouvrent.

## Non-régression et revue

| Vérification | Résultat et preuve |
| --- | --- |
| Moto, Release candidate, fixture 200 | **4/4**, zéro retry/skip, runner `4273de061`, APK `8f856a04d`. Deux cycles entre cinq pages, tous les secteurs de Tendances, périodes toutes/7 nuits, lecture intégrale, trois retours avec bounding boxes strictement identiques, lien direct et retour. `tools/e2e/.e2e/mainpages-candidate-moto-final`, run `01a15d4b-eae3-7cc7-b5cd-e80247514f3c`. L’intégration SQL pendant la fin du run ne change ni les tests ni l’application compilée. |
| Émulateur, Release candidate, fixture 200 | **2/2**, même APK, runner `2d3fab2d0`, navigation et layout de Tendances. `tools/e2e/.e2e/mainpages-candidate-emulator-trends`. Preuve réutilisée pour le code applicatif inchangé ; le titre de test et son attente de séparateur à 5 000 ont évolué ensuite, sans changement du cas 200. |
| Émulateur, texte natif 150 % | **1/1** sélectionné, runner `703bd95db`, même APK, périodes et sections de Tendances. `tools/e2e/.e2e/mainpages-candidate-emulator-font150`. Le helper lit 1.0 avant, applique 1.5, restaure 1.0 en `finally` et le relit (`native-large-font-settings.json`). Ce résultat n’est pas un contrôle Dynamic Type iPhone ou de la police du Moto. |
| Web anglais, captures corrigées | **6/6**, zéro retry/skip, runner `4273de061`, services simulés : brouillon et capture, thèmes et images de l’accueil, état vide de Tendances, chiffres et périodes, portes exactes vers le journal. `tools/e2e/.e2e/dreamer-web/1792566608021-12005-dd382215-5094-4bda-b08a-8ebca7fb0704`. Source stable, applicationQualified=true. |
| Web français, captures corrigées | **3/3**, zéro retry/skip, runner `4273de061`, services simulés : Explorer clair/sombre/automatique, navigation symboles/guides, annulation/sélection/retour de rituel, 320 px et texte navigateur 200 %. `tools/e2e/.e2e/dreamer-web/1792566663285-13066-14cbc576-c915-403c-886d-8c221542500f`. Source stable, applicationQualified=true. |
| Gardes du protocole | **13/13** Python : package exact, premier plan étranger refusé avant input, parcours échoué conservé invalide et rejoué après reprise, PID/runtime et traces. `runner-guards-tests-final.log`. Les cas dangereux ne sont pas tentés sur une app personnelle. |
| Types, contrôles et livraison | Types E2E passent. **verify:pr passe sur `703bd95db` : 13 contrôles**, dont types app/tests, lint, 24 tests Jest liés au diff, 33 contrats de base et contrôles du site (1 919 pages, zéro erreur/avertissement). `verify-code.log`. Le contrôle sur le dernier commit documentaire réutilise les entrées applicatives inchangées ; son bloc de preuve canonique figure dans la PR. |

Le web utilise les services simulés habituels. Les captures natives sont synthétiques ; les vues des sections ont été inspectées, y compris les barres et étoiles après changement de période. Les captures prises pendant une animation ne sont pas annoncées comme une égalité pixel à pixel. Aucun changement de couleur, asset, typo, géométrie ou durée d'animation n'est présent dans le correctif applicatif.

Une première capture d'Explorer sombre montrait encore le tiroir de réglages : les tests attendent maintenant la sortie de la ligne de profil, aux dimensions réelles, avant de photographier. Le container de tiroir pouvait avoir une hauteur nulle pendant la sortie ; les premières captures masquées restent archivées. Les parcours et captures corrigés ont été rejoués.

Revue indépendante : deux P2 trouvés dans l'outil de mesure (reprise d'une phase UI échouée et entrée possible hors QA), corrigés puis delta approuvé. Aucun défaut applicatif établi dans le correctif de révélation. Les premiers tests DOM sélectionnaient le fichier `.native` via jest-expo alors que leurs composants modélisent le web ; la fixture cible désormais explicitement le hook web réel, sans modifier les stubs globaux ni les assertions produit.

## Preuves et reproduction

Dossier privé canonique : `/private/tmp/noctalia-mainpages-performance-20261021`. Recettes binaires dans `baseline/release.json` et `candidate/release.json`, identités d'installation, scénarios, fixtures, traces, profil CPU et logs. Les titres synthétiques, arbres UI, numéros de cible et données appareil restent privés. Les sous-dossiers E2E référencés ci-dessus contiennent assertions, médias et rapports. Les résultats avant/après sont conservés séparément.

Depuis le worktree, avec `QA_DEVICE` (serial adb), `QA_SDK_DEVICE` (nom de la cible pour le SDK), `EVIDENCE`, `TRENDS_SCENARIO` (fichier privé indiqué dans les reçus), `TRACE_PROCESSOR`, `JAVA_HOME` et `ANDROID_HOME` résolus selon le dossier privé :

```sh
# Build local compatible, dans le seul projet Android QA déjà généré :
EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 TMPDIR=/private/tmp mise exec -- npm run android:release:local -- --profile production-apk --abi arm64-v8a --profileable --side-by-side-qa --reuse-native-project

# Après identification de l'APK installé, scénario déjà inspecté et pilote :
ADB_BIN="$ANDROID_HOME/platform-tools/adb" mise exec -- node scripts/android-device-lock.js wrap --owner dreamer --device "$QA_DEVICE" -- npm run android:perf:measure -- --mode reading --device "$QA_DEVICE" --package com.tanuki75.noctalia.qa --scenario "$TRENDS_SCENARIO" --trace-processor "$TRACE_PROCESSOR" --phases screen-scroll --runs 5 --baseline "$EVIDENCE/reference-guarded-trends-moto-five/report.json" --output "$EVIDENCE/replay-trends-five"
# Journal : scénario journal et phase journal-scroll, même procédure pilote + cinq passages.

# Depuis tools/e2e, après préparation possédée explicitement identifiée :
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_SCOPE=main-pages E2E_PERF_PLATFORM=android E2E_PERF_DEVICE="$QA_SDK_DEVICE" E2E_PERF_FIXTURE_COUNT=200 E2E_OUTPUT=.e2e/mainpages-replay TMPDIR=/private/tmp mise exec -- node ../../scripts/android-device-lock.js wrap --owner dreamer --device "$QA_DEVICE" -- npx e2e run --config e2e.native-performance.config.ts

TMPDIR=/private/tmp E2E_WEB_PORT=4538 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'an empty journal offers|30 nights read honestly|each door opens the journal|home prioritizes the saved draft|home keeps the dream image unchanged|home recovers from a failed illustration'
TMPDIR=/private/tmp E2E_WEB_PORT=4538 E2E_WORKERS=1 E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- run --tag locale-fr-FR --grep 'compact resources keep their descriptions|resource navigation and ritual cancellation|narrow windows and doubled web text'

PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/android -p 'test_reading_performance.py'
TMPDIR=/private/tmp mise exec -- npm run verify:pr
```

Les versions compilées, les conditions exactes et les commandes développées sont consignées dans les reçus et les logs, pas déduites du numéro 3.7.0/83 commun. `verify:pr` qualifie le commit livré ; ces parcours QA ne sont pas une publication Play, une qualification de l'application personnelle ou une mesure iPhone. Le comportement des services distants et les framerates iOS restent non qualifiés par ce lot.
