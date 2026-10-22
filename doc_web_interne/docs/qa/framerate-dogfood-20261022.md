# Dogfooding de fluidité Dreamer et noctalia.app — 22 octobre 2026

## Suivi Moto physique : journal et longue lecture

**Candidat écarté : aucun nouveau gain mobile livré.** Un effet ciblé est observé à l'ouverture, sans gain global de framerate qualifié. Après la première seconde, les quatre surfaces >50 ms de master passent à zéro sur les cinq passages du candidat. Les maxima de cette fenêtre passent de 48,95–63,41 à 20,66–30,65 ms, sans recouvrement. Leur médiane passe de 59,27 à 27,31 ms. Le journal donne toutefois davantage d'échéances manquées dans cette paire : le critère secondaire global fixé avant mesure **n'est pas rempli**. Ce résultat reste visible ; il n'est pas transformé en réussite par un contrôle ultérieur.

Le contrôle supplémentaire A5/B3 répète la dégradation des échéances du journal. **Les essais applicatifs sont donc retirés et l’APK QA master `3541d95c3` est réinstallée avec ses données conservées.** Le lot final ne garde que ce rapport et un parcours E2E de changement de page dans les deux sens. L’objectif d’un vrai gain global de fluidité sur ce Moto reste non atteint ; le bénéfice isolé d’ouverture n’est pas présenté comme une amélioration livrée.

### Identité et protocole du Moto

Master récupéré : `3541d95c3dc8ab7626cbdea6fd171688919a3ae3` (PR #551 déjà intégrée). Suivi isolé sur `codex/moto-framerate-20261022`, sans modifier le WIP du checkout principal. Le candidat couvrait ce master avec les seuls changements applicatifs de décor décrits ci-dessous ; les reçus conservent leurs entrées exactes. Après retrait de ces changements, le digest source revient à celui de la référence.

Pendant la campagne, `origin/master` a avancé à `4403a8b1655ac8adb092aac7f39ecffd0e4ad2ad` (collection de badges, PR #552), qui modifie notamment journal, détail et Tendances. La branche du rapport est synchronisée pour la livraison, **mais les mesures et parcours physiques de cette section restent ceux du binaire `3541d95c3`**. Ils ne qualifient pas ce nouveau master ; il faudrait un nouveau build et une nouvelle référence pour le comparer.

| Champ | Master A4 | Candidat B2 |
| --- | --- | --- |
| Digest des entrées app | `d4e5482e055a8dbe04628090ee5728aa1e6c9b102278aed420c49b8edbd1519a` | `94b8be9767d4a8007b713e3186057d1ade29d04085ce09623163c146d78081b4` |
| APK SHA-256 | `00b0152b919f0d5b52ee78c7209d42993d65501b390e90608aa57f280d918300` | `d72a2086a0080e4d1e0935eb16b431704b707089ca4f086b96b2abea60484fe4` |
| Binaire et installation | Release locale arm64-v8a, 3.7.0 (83), `production-apk`, profileable, non debuggable ; installation QA conservatrice | Identique |
| Entrées natives | `7aae9ca02d51a82bcca812088cbf1fe24f7b3281baab9222e87cbcbdbb26adcb` | Identiques |
| Signature SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` | Identique |
| Runtime | Updates désactivées, sans Metro, runtime vide, `updateId=null`, origine Expo `unknown` | Identique |

Cible : Motorola edge 60 fusion, Android 16 / API 36, portrait 1 220 × 2 712, densité 450, texte 1.0, thème sombre. Réglage maximal 120 Hz, minimum non fixé : cela ne signifie pas 120 FPS continus. Batterie 79 %, température **24,0–24,2 °C pour A4, contre 24,9 °C pour B2**, statut thermique 0. Outils : Node 24.22.1, Java 17, Expo 58.0.14, React Native 0.88.0, Reanimated 4.7.1 ; SDK E2E 0.21.2, mobile 0.12.3 et agent-device 0.21.28. Dépendances propres au worktree ; `base64-js` 1.5.1 devenait direct pour B2, sans changer sa version transitive ; cette modification a ensuite été retirée.

Cinq passages A4 puis cinq B2 par scénario, fixés avant leur lancement. Journal : premier rêve synthétique 001 ; détail : recherche du même rêve 013 puis ouverture et lecture. Quatre swipes verticaux identiques, 600 ms, x=610, y=2 150 ↔ 650 ; stabilisation 2 800 ms. Aucun build, profil CPU, SDK E2E ou autre parcours UI pendant les fenêtres retenues. **20 traces et 30 fenêtres valides** dans cette paire ; runner inchangé `5484052b995e7692d535d40b57c38711cf9ea5fe6cd08b4325951a51a0386d78`.

Les P95 sont les médianes des P95 par passage de durée de surface FrameTimeline, pas des FPS moyens ou des latences de clic. Les manqués agrègent les surfaces `App Deadline Missed`. Le comparateur conserve ses conditions : ≥3 passages, scénario/réglages comparables, amélioration P95 ≥10 %, étendues sans recouvrement et manqués sans aggravation >0,2 point.

### Comparaison A4/B2 complète

| Phase | P95 médian avant → après | Étendues par passage | Échéances manquées | Verdict du comparateur |
| --- | --- | --- | --- | --- |
| Journal | 14,27 → 15,68 ms (9,88 %) | 14,01–16,19 → 14,27–17,52 ms | 64/2587 (2,47 %) → 83/2590 (3,20 %) | Indéterminé |
| Ouverture du long rêve | 26,81 → 24,29 ms (-9,40 %) | 18,89–35,75 → 21,00–28,14 ms | 47/648 (7,25 %) → 40/668 (5,99 %) | Indéterminé |
| Défilement du long rêve | 15,51 → 14,84 ms (-4,32 %) | 14,43–17,28 → 11,56–16,12 ms | 136/2716 (5,01 %) → 119/2727 (4,36 %) | Indéterminé |

Le critère exploratoire des pauses restantes a été fixé avant la capture : fenêtre d'ouverture après 1 000 ms, cinq maxima <50 ms, étendues des maxima séparées, baisse d'au moins moitié des surfaces tardives >50 ms, sans hausse globale de P95 >10 % ou des manqués >0,2 point. Les conditions de pauses tardives passent ; **le garde-fou des manqués du journal échoue** (+0,73 point). Aucun seuil n'est modifié après résultat.

| Sur les cinq ouvertures | Master A4 | Candidat B2 |
| --- | ---: | ---: |
| Surfaces >25 ms, ouverture entière | 46 | 34 |
| Surfaces >50 ms, ouverture entière | 15 | 6 |
| Surfaces >100 ms, ouverture entière | 1 | 0 |
| Plus longue surface, ouverture entière | 111,35 ms | 94,72 ms |
| P99 médian, ouverture entière | 57,99 ms | 38,58 ms |
| Surfaces >50 ms après la première seconde | 4 | 0 |
| Maxima tardifs, passage 1 → 5 | 61,28 ; 63,41 ; 58,51 ; 48,95 ; 59,27 ms | 25,07 ; 29,83 ; 20,66 ; 30,65 ; 27,31 ms |

Les six surfaces initiales >50 ms restent dans le résultat. Ce candidat ne supprime pas toutes les saccades de première ouverture. La séparation avant/après la première seconde ne sert pas à cacher ces coûts : ouverture entière et fenêtre tardive sont toutes deux publiées.

### Contrôle supplémentaire du journal

Le journal s'est dégradé dans A4/B2. L’absence des éléments modifiés dans son rendu ordinaire ne suffit pas à exclure des effets indirects des caches et de la mémoire après un détail. Un unique contrôle de renversement A5/B3 a été fixé avant exécution : cinq journaux master, puis cinq avec **le même APK B2**, sans changement de code. Ces dix passages sont une preuve distincte, jamais fusionnée avec A4/B2 et sans requalifier rétroactivement son échec global.

| Journal, cinq passages séparés | Master A5 | Même candidat, B3 |
| --- | ---: | ---: |
| P95 médian | 14,30 ms | 14,61 ms (+2,17 %) |
| Étendue des P95 | 13,73–14,45 ms | 14,01–17,41 ms |
| Échéances manquées | 70/2591 (2,70 %) | 92/2573 (3,58 %) |
| Température | 24,0–24,2 °C | 24,0 °C |

Batterie 79 % et statut thermique 0 pour les dix passages. Le P95 reste indéterminé, avec recouvrement des étendues. L’augmentation des manqués (+0,87 point) répète le signal défavorable et dépasse la garde de 0,2 point. Ce constat ne prouve pas à lui seul le mécanisme causal, mais interdit de promouvoir ce candidat comme un gain sans contrepartie. Reçu distinct : `journal-reversal-control-summary.json`.

### Variante de décor rejetée et contreparties

`JournalPaper` conserve le grain, son échelle physique, son origine, son tint et son opacité. Un atlas 3 × 3 remplace plusieurs petites vues par une texture partagée. Les neuf sous-tuiles décodées RGBA sont identiques à l'original 512 × 512 ; l'atlas 1 536 × 1 536 pèse 68 232 octets. L'original est conservé pour calculer l'échelle et pour iOS/web. Hash source `35d49c5f016b7d0b16748f1feb1f4255808df06e125d171e5ce3685d0f720976`, atlas `50e0a557c85a986f75aaa7048967ad4afb7a97b8ada7594fe6169ef6e5976b9a`.

`JournalPageEdges` confie le même SVG masqué à Expo Image sur Android, avec les mêmes chemins, gradients, couleurs et dimensions et le SVG initial en repli. L'URI contient uniquement la géométrie et les couleurs contrôlées. Son `SVGPictureDrawable` est préparé hors du thread UI ; un cache matériel est limité à sa marge de 33 dp sur le Moto pour éviter de rejouer le dessin pendant l'animation. Il n'y a pas de cache plein écran. Un changement de thème ou de dimensions invalide la source. L'arrivée asynchrone du décor doit être distinguée du rendu statique comparé.

L'atlas et le cache ne sont pas gratuits en mémoire. L'écart théorique de taille de texture n'est pas une borne de mémoire réelle.

À titre diagnostique seulement, master A3 donne une médiane PSS de 379 281 Kio et Graphics de 120 259 Kio dans trois processus frais, sur le même détail après cinq secondes. Aucun comparatif mémoire final B2 ni test de fuite prolongé n’est qualifié. La baisse ponctuelle de vues ne vaut pas preuve de fluidité ou d’économie mémoire. L’atlas, le nouveau chemin SVG et sa dépendance directe ont été retirés du diff final.

### Parcours, design et restauration finale

Sur la Release master restaurée `00b0152b919f…`, le SDK final passe **6/6**, sans retry, skip ni filtre : navigation des pages principales ; Tendances et « Tous » = 200 ; longue lecture 013 avec trois retours ; 013 → 012 → 013 puis lecture/retour ; lien direct ; détail illustré 002, dock et retour. Les trois retours retrouvent exactement le même rectangle de carte `{x:45,y:1992,width:1130,height:720}` avant/après chaque boucle.

Artefact frais : `tools/e2e/.e2e/moto-framerate-restored-master-20261022`, run `01a164b3-cbe1-73ba-ab2e-53b825f31cae`, 375,64 s, traces et captures par test, reçu `restored-master-ui-receipt.json`. Le test ajouté a le blob Git `12b3538b4ee49f7678116692af0051ccfacb4018`, identique à celui livré. L’APK QA finale est relue et égale à la référence ; l’identité installée du package personnel est inchangée. Thème sombre confirmé, rotation initiale `accelerometer_rotation=1` / `user_rotation=0` restaurée et relue, taille du texte et réglages de rafraîchissement inchangés (`device-final.json`, `final-theme-inspect.log`).

Avant rejet, les captures sombres B2 donnent zéro pixel différent sur le journal et hors marge droite du détail dans le rectangle de contenu `(0,130)-(1220,2642)`, barres système exclues. La marge conserve 45 232 différences faibles d’anticrénelage, dont 35 pixels avec un canal >3 et deux >10 ; ce n’est pas une égalité intégrale du détail. Le thème clair et le paysage/portrait ont été vérifiés sur master A3, avec thème sombre et réglages de rotation restaurés. **Ils n’ont pas été requalifiés sur B2**, retiré avant cette étape ; son arrivée asynchrone et un éventuel clignotement ne sont pas déclarés validés. Aucun changement de design ou de comportement applicatif de ce suivi n’est conservé.

Les builds locaux et les types/lint ciblés des essais passaient avant leur retrait. Les types E2E passent sur le test final. Ces contrôles ne transforment pas les mesures de performance en réussite.

### Artefacts et rejeu du suivi Moto

Dossier privé canonique : `/private/tmp/noctalia-moto-framerate-20261022`. Reçus `baseline/release.json` et `paper-edge-layer/release.json` ; rapports `final-{a4,b2}-{journal,detail013}-five/report.json` ; synthèse immuable `paper-edge-layer-final-summary.json`. La décision de rejet est `candidate-decision.json` ; la source rejetée est conservée dans `rejected-b2-source.patch` avec `rejected-b2-journal-paper-atlas.webp`. La restauration source est `restored-master-source.json` et la réinstallation `final-master-install.log`. Les séries B1 et A3 restent dans `paper-edge-final-summary.json`. Le plan du contrôle supplémentaire est `journal-reversal-control-plan.json`. Captures, traces, profils, XML et données UI brutes restent hors de Git.

Après installation conservatrice de l'APK QA identifié, sur la même QA et sa fixture préservée :

```sh
EVIDENCE=/private/tmp/noctalia-moto-framerate-20261022
# Helpers privés de cette campagne : préparation exacte + runner canonique et verrou.
zsh "$EVIDENCE/measure.sh" journal replay-journal 5 final-a4-journal-five
zsh "$EVIDENCE/measure.sh" detail013 replay-detail013 5 final-a4-detail013-five
# Nouvelle sortie nécessaire pour chaque rejeu. Les pilotes ne sont pas ajoutés aux cinq.
```

Le parcours natif final est rejouable depuis `tools/e2e/`, sur cette APK QA déjà identifiée et sa fixture préservée :

```sh
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_SCOPE=main-pages \
E2E_PERF_PLATFORM=android E2E_PERF_DEVICE="motorola edge 60 fusion" \
E2E_PERF_FIXTURE_COUNT=200 E2E_PERF_FIXTURE_UI=framerate \
E2E_OUTPUT=.e2e/moto-framerate-replay PATH="$ANDROID_HOME/platform-tools:$PATH" \
mise exec -- node ../../scripts/android-device-lock.js wrap \
  --owner dreamer --device 192.168.1.176:36041 -- \
  node node_modules/e2e/dist/cli/bin.js run --config e2e.native-performance.config.ts
```

Ce rejeu vérifie les parcours, pas les durées FrameTimeline. La revue indépendante du diff de test et des conclusions n’a relevé aucun défaut matériel ; elle est en lecture seule, sans nouvelle exécution. La livraison conserve le bloc `verify:pr` et son commit vérifié dans la PR.

### Diagnostic et essais écartés

Les traces diagnostiques isolent deux coûts à l'arrivée des pages voisines, vers 1,5 s après le tap : une frame UI de 52,2 ms contient environ 36,7 ms de `Record View#draw()`, puis une autre consacre 23,3 ms au montage, dont des lots de 18 vues Image pour le papier. Ces durées imbriquées sont des durées murales d'une trace diagnostique ; elles ne s'additionnent pas comme du CPU exclusif et ne remplacent pas les séries FrameTimeline.

Le profil Simpleperf de référence échantillonne 2 293 ms de CPU sur quatre secondes : `RenderThread` représente 30,22 % et le dessin SVG environ 4,54 % (104 ms échantillonnées). Ce n'est ni de l'utilisation GPU ni une mesure de latence de clic. Les coûts de montage, de dessin et de composition doivent être distingués.

Un atlas papier lossless 3 × 3 réduit les vues du détail de 731 à 635 dans un snapshot, mais conserve un `Record View#draw()` de 36,62 ms. La variante qui confie les bords SVG à Expo Image réduit le dessin tardif `draw-VRI` à 2,21 ms dans son diagnostic, tout en conservant une frame de montage de 25,98 ms. Ces deux diagnostics ont motivé leur combinaison ; ils ne prouvent pas à eux seuls un gain de fluidité.

La première combinaison complète est **écartée en l'état** : cinq passages master A3 puis cinq passages B1, à 24,9 °C et statut thermique 0, donnent 20,82 → 25,86 ms au P95 d'ouverture (+24,2 %), malgré 16,72 → 9,39 % d'échéances manquées. Les surfaces >25 ms passent de 28 à 72. Après la première seconde, les surfaces >50 ms passent de 4 à 3 ; une pause atteint encore 96,66 ms. La médiane des maxima tardifs baisse de 59,07 à 27,94 ms, mais elle ne justifie pas de masquer ces deux passages encore saccadés ni la hausse du P95. Le critère secondaire fixé avant cette capture échoue.

| Essai | Preuve et décision |
| --- | --- |
| Caches des pages/viewport, puis caches des cartes | Pilotes sans bénéfice convaincant ; retirés. Ils n'ont pas été ajoutés aux séries retenues. |
| Styles scalaires supplémentaires | Cinq passages : journal 14,21 ms, ouverture 28,19 ms, lecture 16,35 ms ; pas de gain qualifié. Retirés. |
| Glyphe de sceau sans wrapper | Cinq passages : journal 14,39 ms, ouverture 21,93 ms, lecture 14,37 ms ; pas de gain qualifié. Retiré. |
| Halo SVG via image | A1/B consécutifs : journal 14,18 → 14,26 ms ; ouverture 25,98 → 25,18 ms ; lecture 15,08 → 15,11 ms. Étendues superposées. Le CPU SVG local passe d'environ 104 à 83 ms échantillonnées ; aucun gain global établi. Retiré. |
| Montage échelonné des pages voisines | Les pauses tardives diminuent, mais l'ouverture reste à 25,72 ms contre 20,62 ms lors du retour à master A2 ; les manqués augmentent de 6,57 à 7,90 %. Retiré. |
| Masque SVG découpé, bords via image seuls, atlas seul | Pilotes et diagnostics exploratoires. Ils ne qualifient aucun gain statistique et ne sont pas fusionnés avec les séries finales. |
| Première combinaison papier + image SVG | Séries A3/B1 complètes décrites ci-dessus, résultat défavorable conservé. APK B1 `79a7d9470532…`, rapports `final-{a3,b}-*-five`. |

Le retour à master A2 et les références fraîches évitent de choisir la meilleure ancienne référence : l'ouverture varie déjà entre 20,06, 25,98 et 20,62 ms selon les séries de master. Les pilotes ont en outre un préflight Simpleperf d'une seconde ; les comparaisons finales emploient les mêmes cinq passages sans ce probe. Aucune série n'est fusionnée ou prolongée pour améliorer un résultat.

### Périmètre des preuves physiques

Le Moto exécute la Release QA séparée `com.tanuki75.noctalia.qa`, avec la SQLite invitée existante de 200 rêves synthétiques, deux illustrations répétées et le long rêve 013 de 3 511 caractères. Le package personnel `com.tanuki75.noctalia`, installé en Debug 3.7.0 (83), n'a été ni remplacé, ni désinstallé, ni vidé. Aucun compte n'a été créé et aucune fixture réinitialisée. Les installations QA `-r` conservent les données et utilisent la même signature vérifiée.

Les résultats ne qualifient pas les données personnelles, un compte synchronisé, 200 images uniques, la version Play, iOS, ni un usage prolongé. Les gestes sont injectés par ADB/SDK sur le matériel physique ; ils ne constituent pas une observation de gestes au doigt. Le retour au journal est vérifié fonctionnellement et par la position de liste ; sa latence et son framerate ne sont pas mesurés séparément.

Les entrées natives restent identiques, sans OTA ni Metro. Aucun flag global de rendu ou de geste, thème, couleur, équation d'animation ou navigation n'est modifié. Le contrôle de compatibilité Expo hors ligne et les builds passent ; le contrôle en ligne signale des patches SDK disponibles, non appliqués. Aucun déploiement, build EAS, achat ou publication Store n'a été effectué. Les résultats web de la première campagne ci-dessous sont réutilisés, sans nouvelle mesure du site public dans ce suivi Moto.

## Campagne initiale : émulateur et site

Les résultats ci-dessous sont conservés de la première campagne, intégrée par la PR #551. Le « correctif » y désigne ce lot initial ; les essais Moto rejetés ci-dessus n’en font pas partie. Ces mesures web et émulateur sont réutilisées, sans nouvelle exécution dans le suivi physique.

### Résultat

Le correctif conserve les illustrations, couleurs, géométries et équations d'animation. Il réduit le travail de styles mobiles une fois les animations bornées et regroupe les lectures de géométrie des comètes du site avant leurs écritures DOM.

Sur Android Release, les trois séries ont moins d'échéances manquées, mais les P95 varient de −1,46 % à +1,48 % avec des étendues qui se recouvrent : **gain de framerate indéterminé**, sans promesse de disparition de toutes les saccades. Les résultats du site figurent ci-dessous. La preuve mobile concerne un émulateur Android possédé ; iOS et téléphone physique restent non qualifiés par cette campagne.

### Source et limites de livraison

Référence : `origin/master` récupéré à `5a46fcdefb0b293c1d1a1f743cdd1fe0bc483273`. Travail isolé sur `codex/framerate-dogfood-20261022`. Le checkout principal et ses changements préexistants sont préservés. Le site public a été inspecté en lecture seule ; les mesures comparables portent sur le site reconstruit localement depuis cette référence, puis depuis le correctif. Aucun résultat public n'est attribué à une version locale non déployée.

Aucun déploiement, build EAS, publication Store, achat ou changement de compte. Les deux caches précisément validés pour 3,7 Gio ont été supprimés ; le reçu privé `cleanup-native-receipt.json` identifie les deux entrées de Corbeille par inode. Les autres éléments sont préservés. Une hausse ultérieure de l'espace libre n'est pas attribuée à ce lot.

### Causes et corrections

| Chemin | Constat et changement |
| --- | --- |
| `components/ui/headerStretch.ts` | Les styles de fondu, profondeur et étirement dépendaient directement de chaque offset de scroll, même après saturation. Des valeurs dérivées scalaires bornées filtrent maintenant ces mises à jour avant les styles. Le code installé Reanimated 4.7.1 ignore une publication scalaire identique. Les coefficients, clamps, durées, opacités et règles de mouvement réduit restent identiques. Aucun changement des flags de rendu ou de rasterisation. |
| `docs-src/experience/starmap-steps.js` | Le scroll au-dessus et au-dessous de la carte répétait les mêmes mises à jour. Le couple progression/activité sert de garde ; un resize invalide la garde pour recalculer les coordonnées même à progression constante. |
| `docs-src/experience/dream-symbol-flight.js` | Chaque comète alternait lectures de rectangles et écritures de classes/styles, provoquant des recalculs synchrones pour la suivante. Toutes les positions utiles sont maintenant lues avant les écritures ; l'image cible est retenue à la création. Trajectoires, naissance des étoiles, inversion et mouvement réduit sont conservés. |
| Garde d'identité APK | Le parseur OTA lisait le préfixe `0x0` de l'identifiant d'attribut `android:value(0x01010024)`, ce qui pouvait certifier faussement une APK avec Updates activées. Il lit maintenant le booléen typé complet du seul élément `ENABLED` et refuse les valeurs absentes/inconnues/vraies. Les deux APK comparées passent cette garde corrigée. |

Les bundles suivis du site ont été régénérés depuis les sources. Les chunks Lenis et Motion mini renommés sont identiques en contenu à leurs anciens noms. Les recommandations officielles [Reanimated sur les performances](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) et [les valeurs dérivées](https://docs.swmansion.com/react-native-reanimated/docs/core/useDerivedValue/) ont été confrontées aux API installées ; aucune mise à jour de dépendance n'est incluse.

### Android : identité et protocole

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

### Site : comparaison contrôlée

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


### Parcours et non-régression

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

### Preuves et reproduction

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
