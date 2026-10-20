# Fluidité du journal Dreamer — 20 octobre 2026

## Résultat et périmètre

Le journal ne mesure plus la position native de chaque illustration à chaque événement de défilement. Les images restent fixes dans leur carte ; la parallaxe de la page de lecture est conservée. Le préchargement anticipé des miniatures attend désormais la fin du geste, y compris lorsqu’une résolution asynchrone commencée au repos se termine pendant ce geste. La mesure invisible du texte replié s’arrête à quatre lignes, suffisantes pour décider si le bouton de dépliage est nécessaire.

Ces changements suppriment des travaux établis dans le code et corrigent une course reproduite. Les mesures FrameTimeline et leurs limites sont ci-dessous. Une garantie de 60/120 images/s sur tous les téléphones ne découle pas d’un émulateur.

Intégration : branche `codex/journal-performance-20261020`, issue de `origin/master` récupéré à `77e63b5ff33f7c9d31a317096eb37c1761c2acfe`, puis intégrant `5880e47285055c3f619436c82584157934bbae08` (#517, éclairage de l’onboarding). Le checkout principal et ses modifications préexistantes n’ont pas été modifiés. Aucun déploiement, EAS, Store, achat ou changement de compte n’a été effectué.

## Diagnostic des chemins coûteux

| Chemin inspecté | Constat et décision |
| --- | --- |
| `DreamCard` → `useFrameParallax` | Chaque carte illustrée montée, y compris dans le pool de recyclage, suivait la valeur de scroll et appelait `measure(frame)` dans un worklet. L’arrondi limitait les commits de style mais ne supprimait pas ces mesures. La liste déplace déjà les illustrations avec le doigt : suppression de ce travail décoratif et des deux wrappers animés. L’image conserve `pointerEvents="none"`. |
| `journal.tsx` → `prefetchDreamMedia` | Le garde de repos n’existait que dans l’appelant différé. L’échauffement au focus et une résolution disque/URL déjà en attente pouvaient lancer `preloadImage` pendant un drag. Ajout de gardes avant la résolution et avant chaque nouveau décodage. Les décodages déjà lancés peuvent finir ; ils ne sont pas annoncés comme annulés. |
| Texte de carte | L’aperçu est déjà borné en caractères selon la largeur ; le texte de mesure invisible n’avait pas de limite de lignes. `numberOfLines={4}` suffit au seuil « plus de trois lignes ». Le texte intégral reste disponible au dépliage et sur la page de lecture. |
| Scroll JS/UI | Master transmet déjà les offsets natifs continus sur le runtime UI et garde l’état de drag dans une ref. Pas d’ajout de state React ni de `runOnJS` par frame. Les transformations de l’en-tête restent inchangées. |
| Recyclage, stockage et recherche | FlashList possède des clés stables, des types de recyclage et des callbacks mémorisés. La fenêtre de présentation commence à 40 entrées ; le filtrage précède cette fenêtre et porte sur tout le journal connu. La recherche différée utilise son cache de texte normalisé et le rétrécissement des résultats. Ces protections de master sont conservées ; le contre-exemple natif à 5 000 entrées est vérifié séparément. |
| Configuration graphique du banc | L’émulateur initial utilisait SwiftShader avec le GPU désactivé. Ses résultats ne représentaient pas un téléphone ni un rendu matériel. Une nouvelle cible QA isolée, Android 17 / Pixel 9 / GPU hôte Apple M5 Pro, a permis une seconde comparaison complète, sans modifier la cible initiale. |

Le choix suit les recommandations de [Reanimated sur les coûts du scroll et des vues animées](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) et de [FlashList sur les mesures en Release et le recyclage](https://shopify.github.io/flash-list/docs/fundamentals/performance/). Aucune modification opportuniste des flags synchrones, de la virtualisation, du clipping ou des versions n’a été ajoutée pour obtenir un score.

## Identité des candidats

| Champ | Référence | Candidat final |
| --- | --- | --- |
| Source du binaire | `77e63b5ff33f7c9d31a317096eb37c1761c2acfe` | `2c23269ccd971bbe2a9f995dbf12f281158d24cd` |
| Android | Release local, arm64-v8a, 3.7.0 (83) | Identique |
| APK SHA-256 | `61970ae2bcb7ad866f78ee6d2a12801f59c41e2e907f1f9411b0ce392f205e44` | `60788423496f816cf81fc512393c996dcb334216d6d7c9e9bb2dd95fb5b45bc7` |
| Profil | `production-apk`, services réels, journal invité local synthétique | Identique |
| OTA / Metro | Updates désactivées, pas de Metro ; APK installé vérifié par hash | Identique |
| Entrées natives générées | Digest `93d1d1793376299d5f9692edccc2654fe07015c64e80e5c4b6d31863aa50d597` | Identique |

La génération native est ignorée par Git, effectuée uniquement dans le worktree isolé ; elle ajoute `profileable` et désactive OTA pour la mesure. Signature locale de debug identique, application compatible installée par `adb install -r`, sans désinstallation ni effacement. Le vérificateur existant `verifyInstalledRelease` a relu le binaire installé. Les logs déclarent `development=false`, version 3.7.0/83 et `updatesEnabled=false` ; `launchSource=unknown`, l’origine APK étant établie séparément par le hash. Cette preuve n’est pas une qualification Play/TestFlight.

Runtime : Node 24.19.0, Deno 2.7.14, Expo 58.0.14, React Native 0.88.0, Reanimated 4.7.1. Outils : e2e 0.21.2, mobile 0.12.3, web 0.15.2, agent-device 0.21.28. Les dépendances ont été installées depuis le lockfile de cette branche. La vérification Expo hors ligne passe ; les suggestions de mises à jour de maintenance en ligne n’ont pas été assimilées à une incompatibilité imposant un changement de dépendances.

## Mesure avant/après

Protocole existant `android:perf:measure`, verrou de cible, pilote puis cinq exécutions déterminées à l’avance. Même fixture possédée de 200 rêves (SHA-256 `11c230bac1aca223d3850cf468c73b201700a533b403eae8567ee211c1642beb`), mêmes illustrations locales, quatre swipes (deux aller, deux retour), mêmes coordonnées/durée, portrait 1080×2424, texte 1.0, cible 60 Hz, quatre cœurs et 2 Gio. Aucun build, test navigateur ou capture CPU concurrent pendant les séries FrameTimeline. Les fenêtres excluent le dump d’accessibilité. Chaque trace doit être saine et conserver PID, police, version, certificat et runtime attendus.

Les « frames manquées » désignent les surfaces de l’application dont FrameTimeline porte `App Deadline Missed`. Le P95 est une durée de surface ; ce n’est ni un FPS moyen, ni une latence de clic, ni une mesure du thread JavaScript. Les séries froides d’installation et les pilotes restent distincts des séries comparées.

| Banc et source | Exécutions valides | Frames | Deadline manquée | Médiane des P95 | Étendue des P95 par run |
| --- | ---: | ---: | ---: | ---: | ---: |
| SwiftShader — référence `77e63b5f` | 5 | 650 | 269/650 (41.38 %) | 61.47 ms | 59.46–63.78 ms |
| SwiftShader — premier candidat `904382128` | 5 | 640 | 319/640 (49.84 %) | 64.11 ms | 62.83–70.62 ms |
| GPU hôte — référence `77e63b5f` | 5 | 778 | 7/778 (0.90 %) | 20.60 ms | 19.65–21.03 ms |
| GPU hôte — candidat final `2c23269cc` | 5 | 786 | 6/786 (0.76 %) | 19.86 ms | 17.70–20.58 ms |

Sur GPU hôte, le P95 baisse de 20,60 à 19,86 ms (−3,59 %) et le taux de frames manquées de 0,90 à 0,76 %. Le verdict du comparateur reste **indéterminé** : le seuil de 10 % n’est pas atteint et les étendues se recouvrent. Le banc avait déjà peu de frames manquées en référence. Ce résultat ne démontre pas un gain perceptible de framerate sur un téléphone.

Sur SwiftShader, le premier candidat a un P95 légèrement plus élevé et le taux de frames manquées augmente de 41,38 à 49,84 %. Le verdict P95 est aussi **indéterminé** avec recouvrement des étendues ; cette série ne prouve aucun gain ni aucune non-régression de framerate. La dernière correction `pointerEvents` n’a pas été remesurée sur ce banc ; sa série finale est celle du GPU hôte. Les deux comparaisons restent publiées, avec leurs sources distinctes. Dix traces de chaque banc sont valides et sans erreur Perfetto. Les températures émulées restent à 25 °C ; elles ne qualifient aucune tenue thermique physique.


Le seuil de gain retenu par le protocole est au moins trois exécutions valides, conditions comparables, P95 réduit d’au moins 10 %, intervalles des P95 sans recouvrement et taux de frames manquées ne s’aggravant pas de plus de 0,2 point. Un résultat « indéterminé » ne prouve ni un gain ni une régression universelle. La différence SwiftShader/GPU hôte décrit deux bancs différents et ne doit jamais être présentée comme un gain du correctif.

Deux captures CPU exploratoires de 12 s sur SwiftShader, sans échantillon perdu : 664 échantillons pour la référence, 554 pour le premier candidat `904382128`. La part inclusive de `NodesManager.onEventDispatch` passe de 12,50 % à 8,12 %. Les piles worklets restent visibles. Un seul échantillonnage de chaque version ne suffit pas à conclure à un gain CPU statistique ; les pourcentages inclusifs se recouvrent et ne s’additionnent pas. Cette piste concorde avec la suppression de mappers dans le code, sans quantifier un gain physique.

## Vérifications fonctionnelles et revue

| Vérification | Résultat et preuve |
| --- | --- |
| Test de course + cartes | 2 suites / 33 tests passent (`focused-tests.log`). Régression négative conservée dans `prefetch-before.log`. Ces entrées sont inchangées depuis le correctif, hors prop passive de l’image vérifiée ensuite en types et parcours réels. |
| Types et lint ciblés | `typecheck:app`, `typecheck:tests`, `test:testerarmy:typecheck` et lint Expo des trois fichiers applicatifs/test affectés passent. |
| Native, fixture 200 | 3/3, sans retry ni skip, runner `3d5870f43`, APK final `2c23269cc`. Lecture jusqu’à la fin du récit 013, trois retours avec bounding boxes strictement identiques, lien direct, lecture illustrée 002 et dock interactif. Artefact `tools/e2e/.e2e/journal-perf-hardware-final-200-headings`. |
| Native, fixture 5 000 | 1/1, sans retry ni skip, runner `55fe0b76f`, même APK final. Recherche non accentuée dans le dernier récit, ouverture du titre 05000, dernière ligne visible au-dessus du dock (géométrie + capture), requête retenue au retour puis effacement rétablissant la liste. Artefact `tools/e2e/.e2e/journal-perf-hardware-final-5000-visible`. Fixture SHA-256 `c12695c6ce83f0f55e6946f8d57996567ae7127514d042b5145fa1212cb0034f`. |
| Web anglais | 5/5, sans skip, source `b27953a84`. Cartes claires/sombres, dépliage, 200 % de texte navigateur, largeurs 320/768/1440, souvenir sauvegardé, miniature en échec puis original, puis sceau lorsque tout échoue. Artefact `tools/e2e/.e2e/dreamer-web/1792529379042-42395-d9fb0a80-e6cf-4726-8ed2-0d7852e17bad`. |
| Web français | 2/2, sans skip, source `b27953a84`. Filtres à 393/320 px, recherche/réglages accessibles et requête conservée lors des changements de largeur et du contrôle de mouvement réduit. Artefact `tools/e2e/.e2e/dreamer-web/1792529452082-42897-8f272312-311a-405d-b08f-af7e8f33edae`. |
| Livraison | `npm run verify:pr` porte sur le commit livré ; le bloc de preuve de la PR indique son SHA et le résultat canonique du moteur. Le rapport et les derniers contrôles de capture ne changent pas l’application compilée. |

Les 7 parcours web constituent l’union explicite de deux campagnes locales simulées, pas une exécution native ni un test de services réels. Les deux cas français ignorés par une campagne anglaise exploratoire ont été exécutés dans la campagne française ci-dessus. La qualification native finale réutilise le même APK sur deux fixtures distinctes, 200 pour le scroll/lecture et 5 000 pour la recherche ; la fixture 5 000 n’est pas présentée comme une mesure de framerate.


Le test isolé de la résolution tardive répond à un manque précis du parcours UI : retenir puis libérer une promesse de résolution disque/URL exactement après le début du drag n’est pas pilotable de manière déterministe depuis l’interface native. Artefact négatif : `prefetch-before.log` ; preuve positive : `focused-tests.log`, dans le dossier privé. Le contre-exemple échoue sur l’ancien code (un préchargement pendant le geste), puis passe avec la garde et vérifie la reprise après l’arrêt. Aucune nouvelle batterie de tests reflétant la forme du code n’a été ajoutée.

Une revue indépendante du diff a trouvé la perte de `pointerEvents="none"` lors de la suppression des wrappers. Correction intégrée et delta approuvé. Les contrôles de position, d’abord seulement enregistrés, sont maintenant des assertions exactes. Sur GPU hôte, la première exécution a rencontré un titre ambigu entre carte et page : le test cible désormais le heading de la page. Les artefacts d’échec sont conservés ; ils ne sont pas comptés comme des succès. Un ancien échec sur les fins de récit a été corrigé dans la fixture synthétique en créant des blocs Markdown séparés, sans changer le contrat produit.

Les premières captures web pouvaient montrer le panneau de réglages fermé au-dessus des cartes, surtout en thème clair, alors que les assertions de géométrie passaient. Un premier garde sur le conteneur n’était pas suffisant : son contenu pouvait encore couvrir les cartes. Le helper et les captures contrôlent désormais la ligne de profil, de taille réelle, hors du viewport. Les captures canoniques claires et sombres sont inspectées, ainsi que le texte navigateur doublé ; elles montrent le journal dégagé. Aucun changement produit n’a été nécessaire pour ce contrôle de capture.

## Rejouer et retrouver les preuves

Dossier privé canonique sur le Mac : `/private/tmp/noctalia-journal-performance-20261020`. Il contient les fixtures synthétiques, helper signé, identités installées, logs, traces et rapports JSON. Aucun contenu de rêve personnel ni secret n’est ajouté à Git. Les traces ne sont pas dupliquées dans ce rapport.

Recettes de build sous `tools/e2e/.e2e/dreamer-android/` : référence `1792526733408-21612-44137d73-1ff7-480b-9f74-728317a01efb/release.json`, candidat final `1792528865145-36565-6ba69d9a-80ba-4edf-96d0-d01cf2ff2d05/release.json`. Le build final est terminé avec succès. La comparaison de sources comprend également #517, limité à l’onboarding et hors scénario ; le runner des trois parcours natifs est à `3d5870f43`, celui du dernier contrôle de recherche à `55fe0b76f`. Les commits ultérieurs modifiant uniquement les tests et le rapport réutilisent explicitement ce binaire, sans se présenter comme une recompilation.

Depuis le worktree, avec `QA_DEVICE`, `ANDROID_HOME`, `JAVA_HOME`, `TRACE_PROCESSOR` et `EVIDENCE` pointant sur la cible possédée et le dossier ci-dessus :

```sh
TMPDIR=/private/tmp mise exec -- npm run test:file -- tests/app-routes/journalCompactLayout.test.tsx components/journal/__tests__/DreamCard.test.tsx --watchman=false

ADB_BIN="$ANDROID_HOME/platform-tools/adb" mise exec -- node scripts/android-device-lock.js wrap --owner dreamer --device "$QA_DEVICE" -- npm run android:perf:measure -- --mode reading --device "$QA_DEVICE" --scenario "$EVIDENCE/scenario-hardware-final.json" --trace-processor "$TRACE_PROCESSOR" --phases journal-scroll --pilot --output "$EVIDENCE/replay-pilot"
ADB_BIN="$ANDROID_HOME/platform-tools/adb" mise exec -- node scripts/android-device-lock.js wrap --owner dreamer --device "$QA_DEVICE" -- npm run android:perf:measure -- --mode reading --device "$QA_DEVICE" --scenario "$EVIDENCE/scenario-hardware-final.json" --trace-processor "$TRACE_PROCESSOR" --phases journal-scroll --runs 5 --baseline "$EVIDENCE/hardware-baseline-series/report.json" --output "$EVIDENCE/replay-series"

TMPDIR=/private/tmp E2E_WEB_PORT=4537 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'journal shows each painting whole|saved remembered dream keeps its indication|failed thumbnail falls back|failed illustration leaves'
TMPDIR=/private/tmp E2E_WEB_PORT=4537 E2E_WORKERS=1 E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- run --tag locale-fr-FR --grep 'quick filters fit at393px|journal search and settings remain reachable'

# Depuis tools/e2e, après installation vérifiée et chargement contrôlé de la fixture 200 :
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_PLATFORM=android E2E_PERF_DEVICE="$QA_DEVICE" E2E_PERF_FIXTURE_UI=framerate E2E_OUTPUT=.e2e/journal-perf-replay-200 TMPDIR=/private/tmp mise exec -- npx e2e run --config e2e.native-performance.config.ts
# Après remplacement contrôlé de la seule fixture possédée par la variante 5000 :
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_PLATFORM=android E2E_PERF_DEVICE="$QA_DEVICE" E2E_PERF_FIXTURE_COUNT=5000 E2E_OUTPUT=.e2e/journal-perf-replay-5000 TMPDIR=/private/tmp mise exec -- npx e2e run --config e2e.native-performance.config.ts --grep 'native journal searches'
```

La recette exacte du build figure dans `release.json` et son log ; elle utilise `expo prebuild --platform android --no-install` en isolation, puis `:app:assembleRelease`, deux workers et arm64-v8a. Les scénarios de mesure exigent le hash du libellé visible et l’identité runtime ; relancer le script de préparation privé après un redémarrage. Ne pas appliquer le helper de fixture à une app personnelle : il est réservé à cette cible possédée et refuse les données inconnues.

## Limites et suite utile

Les illustrations du banc sont locales : le réseau, les URLs distantes froides et les services de génération ne sont pas qualifiés par ces mesures. La garde asynchrone dispose de sa preuve isolée. Aucune nouvelle mesure physique Android, iPhone, Dynamic Type natif, 120 Hz, restauration après mort du processus, paiement ou production n’est revendiquée. L’état des appareils personnels et leurs rêves est préservé.

Pour qualifier le ressenti signalé sur un téléphone précis, l’étape utile est le même parcours sur son candidat Release identifié et ses données préservées, avec le protocole FrameTimeline Android ou Instruments iOS. Les résultats de ce rapport décrivent les travaux superflus supprimés, la course corrigée et ce qui est effectivement mesuré ; ils ne masquent pas une preuve manquante derrière des tests unitaires ou un compteur FPS de développement.
