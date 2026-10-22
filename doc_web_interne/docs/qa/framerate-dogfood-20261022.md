# Dogfooding de fluidité Dreamer et noctalia.app — 22 octobre 2026

## Résultat

Le correctif conserve les illustrations, couleurs, géométries et équations d'animation. Il réduit le travail de styles mobiles une fois les animations bornées et regroupe les lectures de géométrie des comètes du site avant leurs écritures DOM.

Sur Android Release, les trois séries ont moins d'échéances manquées, mais les P95 varient de −1,46 % à +1,48 % avec des étendues qui se recouvrent : **gain de framerate indéterminé**, sans promesse de disparition de toutes les saccades. Les résultats du site figurent ci-dessous. La preuve mobile concerne un émulateur Android possédé ; iOS et téléphone physique restent non qualifiés par cette campagne.

## Source et limites de livraison

Référence : `origin/master` récupéré à `5a46fcdefb0b293c1d1a1f743cdd1fe0bc483273`. Travail isolé sur `codex/framerate-dogfood-20261022`. Le checkout principal et ses changements préexistants sont préservés. Le site public a été inspecté en lecture seule ; les mesures comparables portent sur le site reconstruit localement depuis cette référence, puis depuis le correctif. Aucun résultat public n'est attribué à une version locale non déployée.

Aucun déploiement, build EAS, publication Store, achat ou changement de compte. Les deux caches précisément validés pour 3,7 Gio ont été supprimés ; le reçu privé `cleanup-native-receipt.json` identifie les deux entrées de Corbeille par inode. Les autres éléments sont préservés. Une hausse ultérieure de l'espace libre n'est pas attribuée à ce lot.

## Causes et corrections

| Chemin | Constat et changement |
| --- | --- |
| `components/ui/headerStretch.ts` | Les styles de fondu, profondeur et étirement dépendaient directement de chaque offset de scroll, même après saturation. Des valeurs dérivées scalaires bornées filtrent maintenant ces mises à jour avant les styles. Le code installé Reanimated 4.7.1 ignore une publication scalaire identique. Les coefficients, clamps, durées, opacités et règles de mouvement réduit restent identiques. Aucun changement des flags de rendu ou de rasterisation. |
| `docs-src/experience/starmap-steps.js` | Le scroll au-dessus et au-dessous de la carte répétait les mêmes mises à jour. Le couple progression/activité sert de garde ; un resize invalide la garde pour recalculer les coordonnées même à progression constante. |
| `docs-src/experience/dream-symbol-flight.js` | Chaque comète alternait lectures de rectangles et écritures de classes/styles, provoquant des recalculs synchrones pour la suivante. Toutes les positions utiles sont maintenant lues avant les écritures ; l'image cible est retenue à la création. Trajectoires, naissance des étoiles, inversion et mouvement réduit sont conservés. |
| Garde d'identité APK | Le parseur OTA lisait le préfixe `0x0` de l'identifiant d'attribut `android:value(0x01010024)`, ce qui pouvait certifier faussement une APK avec Updates activées. Il lit maintenant le booléen typé complet du seul élément `ENABLED` et refuse les valeurs absentes/inconnues/vraies. Les deux APK comparées passent cette garde corrigée. |

Les bundles suivis du site ont été régénérés depuis les sources. Les chunks Lenis et Motion mini renommés sont identiques en contenu à leurs anciens noms. Les recommandations officielles [Reanimated sur les performances](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) et [les valeurs dérivées](https://docs.swmansion.com/react-native-reanimated/docs/core/useDerivedValue/) ont été confrontées aux API installées ; aucune mise à jour de dépendance n'est incluse.

## Android : identité et protocole

| Champ | Avant | Après |
| --- | --- | --- |
| Source applicative | Master `5a46fcdef` | Même arbre avec le seul changement applicatif `headerStretch.ts` |
| Digest des entrées app | `45a1d47bc9fd802c6486fdd46918c7685621a46c0b350d1544f6289adb1f972c` | `d4e5482e055a8dbe04628090ee5728aa1e6c9b102278aed420c49b8edbd1519a` |
| APK SHA-256 | `e5f04a4c0f8c3b890a0a257298802a687503aaabf78f84bcc5c8582e63e2bec5` | `1f4dbc883c2ad931b9d2f55911dd1712fe6de20e159671f205023b86e8029c04` |
| Binaire | Release local arm64-v8a, 3.7.0 (83), profil `production-apk`, profileable, non debuggable | Identique |
| Entrées natives | Digest `47c03b5b9550ad6b965647860de0458c12742bc3cf76579a21ba4f3c85be0d99` | Identique |
| Runtime | Updates désactivées, sans Metro, `updateId=null`, runtime vide, origine Expo `unknown` | Identique |

La provenance vient du hash de l'APK installé, de son manifeste et des reçus, sans inventer une origine Expo absente. Signature locale compatible identique, installation conservatrice sans désinstallation. La génération Android isolée ajoute `profileable` et désactive OTA pour les deux versions ; elle ne modifie pas le projet natif du checkout principal. Les modifications ultérieures de tests et du rapport sont distinctes de la compilation.

Outils : Node 24.22.1, Java 17, Expo 58.0.14, React Native 0.88.0, Reanimated 4.7.1 ; e2e 0.21.2, mobile 0.12.3, web 0.15.2 et agent-device 0.21.28. Dépendances complètes réutilisées depuis un worktree compatible, avec lockfiles root/E2E identiques ; validation Expo hors ligne passée (elle ne remplace pas un contrôle de compatibilité en ligne).

Banc : AVD possédé `Noctalia_JournalPerf_QA_20261020`, Android 17 / API 37, GPU hôte, portrait 1080 × 2424, densité 420, texte 1.0, cible 60 Hz, quatre cœurs et 2 Gio. Profil invité, vraie SQLite, fixture possédée de 200 rêves et deux illustrations locales répétées. Cela ne simule pas 200 images uniques ou un compte synchronisé. Tendances est mesuré sur sa période initiale de 30 nuits (26 rêves de cette fixture), identique avant/après.

Un pilote par écran et version précède cinq passages fixés à l'avance. Quatre swipes identiques (deux aller, deux retour), coordonnées/durées conservées, stabilisation 1 800 ms. Aucun build, test UI navigateur ou profilage concurrent aux séries retenues. Trente traces finales valides, sans erreur Perfetto, mêmes scénarios et runner SHA-256 `5484052b995e7692d535d40b57c38711cf9ea5fe6cd08b4325951a51a0386d78`. Température émulée 25 °C et statut thermique 0 ; aucune qualification thermique physique.

Le P95 est une durée de surface FrameTimeline ; il ne se convertit pas en FPS moyen. Les manqués sont les surfaces portant `App Deadline Missed`. Le comparateur existant exige ≥3 passages, mêmes conditions/scénario, température comparable, P95 amélioré d'au moins 10 %, étendues sans recouvrement et manqués sans aggravation >0,2 point pour annoncer un gain.

| Écran | P95 avant → après | Étendue avant → après | Échéances manquées avant → après | Verdict |
| --- | --- | --- | --- | --- |
| Journal | 20,49 → 20,19 ms (−1,46 %) | 20,28–21,17 → 19,61–20,49 ms | 13/913 (1,42 %) → 10/907 (1,10 %) | Indéterminé |
| Accueil | 19,62 → 19,91 ms (+1,48 %) | 19,41–20,12 → 18,64–19,97 ms | 18/1 149 (1,57 %) → 10/1 174 (0,85 %) | Indéterminé |
| Tendances | 20,38 → 20,25 ms (−0,64 %) | 19,99–20,87 → 20,14–21,23 ms | 20/926 (2,16 %) → 10/936 (1,07 %) | Indéterminé |

Les baisses de manqués sont des observations sur ces séries, sans conclusion statistique universelle. La réduction du travail est établie dans le code ; un gain perceptible mobile n'est pas démontré. Pas de mélange avec les anciens résultats de téléphone ou avec les pilotes.

## Site : comparaison contrôlée

Chromium 156.0.8078.4, cinq contextes neufs par format (390 × 844 et 1 440 × 900, DPR 1), CPU ralenti ×4, médias réels et animations actives, visiteur de retour sans intro, consentement de mesure non accordé (bannière encore présente dans les captures de contrôle des deux formats et versions). Le format mobile utilise le tier `light` et le desktop `full`, avec les mêmes indications matérielles simulées et graine aléatoire. Quatre fenêtres de défilement programmé de quatre secondes par contexte ; mêmes positions initiales/finales vérifiées avant/après. Soit **40 fenêtres par version**, sans build ni autre parcours UI concurrent.

Les intervalles `requestAnimationFrame` mesurent la continuité des callbacks JavaScript dans ce laboratoire headless ; ils ne prouvent pas toutes les images compositées ou perçues sur un téléphone. Les autres colonnes sont les durées CDP cumulées dans chaque fenêtre, puis leur médiane sur cinq passages. Elles ne sont pas des latences de clic.

| Format et fenêtre | P95 rAF avant → après (ms) | Script avant → après (ms) | Layout avant → après (ms) | Tâches avant → après (ms) |
| --- | ---: | ---: | ---: | ---: |
| Mobile · galerie | 16,80 → 16,70 | 114,83 → 105,17 | 0,00 → 0,00 | 515,09 → 502,49 |
| Mobile · analyse | 16,70 → 16,80 | 70,46 → 67,84 | 22,28 → 26,07 | 433,77 → 422,46 |
| Mobile · constellation | 16,80 → 16,80 | 127,99 → 123,53 | 73,87 → 68,72 | 1249,69 → 1248,82 |
| Mobile · bas de page | 16,80 → 16,70 | 47,34 → 38,76 | 1,07 → 0,76 | 347,59 → 358,88 |
| Desktop · galerie | 16,70 → 16,70 | 161,85 → 149,04 | 0,08 → 0,07 | 806,29 → 774,72 |
| Desktop · analyse | 16,70 → 16,80 | 105,39 → 100,55 | 22,06 → 20,78 | 535,84 → 529,68 |
| Desktop · constellation | 16,70 → 16,70 | 148,27 → 142,35 | 74,91 → 73,25 | 1367,40 → 1387,97 |
| Desktop · bas de page | 16,80 → 16,80 | 110,79 → 95,78 | 1,03 → 0,52 | 922,71 → 953,83 |

Aucun intervalle rAF >25 ms dans les séries retenues, avant comme après. Les médianes de ScriptDuration diminuent de 3,48 à 18,11 % ; celles de la galerie de 8,42 % sur mobile et 7,91 % sur desktop. Ces baisses descriptives ne sont pas une estimation statistique d'un gain physique. **Aucun gain de FPS démontré** sur un banc déjà proche de 16,7 ms.

Le travail de layout n'est pas annoncé comme supprimé : la constellation compte encore 224/223 layouts par fenêtre mobile/desktop, comme avant. Le LayoutDuration mobile de l'analyse augmente de 22,28 à 26,07 ms (+17 %) avec 45 layouts inchangés ; les tâches du bas de page augmentent d'environ 3 %. Ces variations et les coûts restants sont conservés dans le résultat. Cette campagne ne mesure pas le démarrage froid, la latence réseau, la mémoire ou le GPU.


## Parcours et non-régression

| Contrôle frais | Résultat et artefact |
| --- | --- |
| Android, candidat Release et fixture 200 | **1/1**, sans retry/skip, APK `1f4dbc883c2a…`, journal → détail/titre → retour, défilement accueil/Tendances/Explorer, « Tous » = 200, guides/dictionnaire, lien sons désactivés → accueil, relance et paysage/portrait. `tools/e2e/.e2e/dreamer-android/1792673923897-24804-19afde86-6912-4c0e-8e6e-cba14eb59567`. Source et APK installée stables, `applicationQualified=true`. |
| Site, navigation réelle | **3/3**, sans retry/skip : destination interne anglaise et comètes actives, resize pendant le vol, retour au clavier, absence de débordement, mode réduit statique à 390/1 440 px (resize 320/1 100). `tools/e2e/.e2e/site-web/1792673022099-18525-0d86ce0a-ddc5-4f65-92bc-0d85179cc680`, sources stables, `applicationQualified=true`. |
| Garde de provenance APK | **10/10** dans `ota-guards-qualified.log`. Le cas ENABLED=true suivi d'un autre false, l'absence et la valeur non reconnue sont refusés ; false réel est accepté. L'UI E2E ne peut pas exercer ces métadonnées malformées sans reconstruire chaque APK, ce qui motive ce contrôle isolé. |
| Types et lint ciblés | `test:testerarmy:typecheck` passe sur les tests finaux (`e2e-types-qualified.log`). Lint Expo : zéro erreur, cinq avertissements préexistants de syntaxe Array dans le fichier site (`focused-lint-qualified.log`). Types app passent ; le contrôle canonique du commit livré reste `verify:pr`. |
| Site généré | `docs:build` et `docs:check` passent, zéro erreur/avertissement site (`site-candidate-build-final.log`, `site-candidate-check.log`). |

Les smoke Android exploratoires (mock et profil réel vide) restent des preuves distinctes, pas des mesures de framerate ni des tests de synchronisation serveur. Les preuves fraîches du tableau ne réutilisent aucun résultat historique de téléphone ou d'iPhone.


Les captures Android avant/après ont été inspectées : les mêmes peintures, contrastes, textes et dock sont présents. Les captures après un geste ne sont pas une égalité pixel à pixel de scroll. Le nouveau scénario a été ajusté sur trois préconditions observées : le détail ouvre sur sa peinture/titre, les chiffres de Tendances nécessitent de sélectionner « Tous » pour attendre 200, et le profil production laisse les sons de sommeil désactivés avec retour attendu à l'accueil. Les premières erreurs de scénario restent archivées ; aucune assertion produit n'est désactivée pour obtenir un passage.

Revue indépendante : aucun défaut actionnable dans le diff applicatif ou les conclusions ; une variable manquante dans la commande de reproduction a été explicitée. La revue est en lecture seule, sans nouvelle exécution de tests ; le SHA relu est consigné dans la PR. Les échantillons ou installations exploratoires ne remplacent pas les résultats complets.

## Preuves et reproduction

Dossier privé canonique : `/private/tmp/noctalia-framerate-20261022`. Il contient les reçus de nettoyage, scénarios, traces Perfetto, captures, scripts de fixture, logs et rapports. Les données UI brutes restent hors de Git.

- Référence native : `tools/e2e/.e2e/dreamer-android/1792671494775-11062-3f6bca3d-35b3-4656-a087-0fec02218a16/release.json`.
- Candidat natif : `tools/e2e/.e2e/dreamer-android/1792673019114-18369-a0a69266-98e2-4589-89f7-7d6dfa978885/release.json`.
- Rapports natifs : `native-{before,after}-{journal,home,trends}/report.json` dans le dossier canonique ; chaque fichier identifie ses traces, scénario, conditions et APK installé.
- Site avant/après : `baseline-final-serial/report.json` et `candidate-final-serial/report.json`. Collecteur SHA-256 `eed4d77e5b0a6e41805630266768ffbec93d11c627b953fb5d69d29471d9c36d`. Une première série interrompue pendant une activité UI est exclue ; elle n'est pas fusionnée avec les résultats retenus. Les pilotes restent distincts.

Depuis le worktree, après identification du binaire installé et préparation de la même fixture possédée, avec `EVIDENCE=/private/tmp/noctalia-framerate-20261022`, `QA_DEVICE=emulator-5558`, Java 17 et le SDK Android résolus :

```sh
TRACE_PROCESSOR=/Users/timax/.local/share/perfetto/prebuilts/trace_processor_shell-d29864d1ba3b3685
# Rejeu natif avec le scénario et la référence retenus ; sortie fraîche requise.
PATH="$ANDROID_HOME/platform-tools:$PATH" mise exec -- node scripts/android-device-lock.js wrap --owner dreamer --device "$QA_DEVICE" -- npm run android:perf:measure -- --mode reading --device "$QA_DEVICE" --scenario "$EVIDENCE/scenario-journal.json" --trace-processor "$TRACE_PROCESSOR" --phases journal-scroll --runs 5 --baseline "$EVIDENCE/native-before-journal/report.json" --output "$EVIDENCE/replay-journal"
# Accueil/Tendances : scénario home/trends et phase screen-scroll, pilote puis cinq passages.

# Parcours natif sur la même APK déjà installée et la fixture synthétique 200.
E2E_SCROLL_DOGFOOD=synthetic200 E2E_DEVICE="$QA_DEVICE" E2E_AVD_NAME=Noctalia_JournalPerf_QA_20261020 E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-android/1792673019114-18369-a0a69266-98e2-4589-89f7-7d6dfa978885/release.json mise exec -- npm run test:testerarmy:mobile -- dreamer android run --tag framerate

# Collecteur web immuable de cette campagne, site local déjà reconstruit/servi à 8172.
mise exec -- node "$EVIDENCE/site-scroll-lab.cjs" replay-site 5 4

# Navigation du site : même commande que la campagne locale, port libre.
E2E_WEB_PORT=8173 E2E_WORKERS=1 E2E_WEB_LOCALE=en-US mise exec -- npm run test:testerarmy:site -- run --grep 'landing scroll dogfood|generated English homepage'
```

Les reçus de build conservent la commande Gradle développée et les profils effectifs. Les builds mock exploratoires sont exclus des mesures SQLite réelles. Le dernier `verify:pr` et son SHA vérifié figurent dans le bloc canonique de la PR ; ils ne prétendent pas à une qualification iOS, Play, TestFlight ou production.
