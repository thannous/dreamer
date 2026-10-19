# Performance native Dreamer — 18–19 octobre 2026

Campagne locale sur les **vraies apps Noctalia** (`com.tanuki75.noctalia`) du
Motorola edge 60 fusion (Android 16) et de l’iPhone 17 Pro Max (iOS 27.0.1).
Expo 58.0.14, React Native 0.88.0, Hermes et New Architecture ; Release embarquées,
Android profileable, aucune session Metro. Aucune qualification Play/TestFlight.

## Première campagne : retour au journal

### Candidats et données

- Référence : `353c400cf1dc0e6eb8c76ea4d8276d414a4fae73`, après fusion de #437.
- Correctif applicatif : `5deef6dd8ba9c233518c4d085dd65015c175c379`, qui intègre
  aussi les trois commits master suivants concernant Today. Les parcours mesurés
  portent sur le journal et le détail. L’intégration ultérieure de #438
  (`d80d27b44`) change les outils de build, le cache Metro et le transport portable
  des paramètres d’autolinking, sans changer le code applicatif de ce correctif ni
  les versions mobiles. Les preuves physiques restent celles des binaires
  `5deef6dd8` ; aucun nouveau build natif après cette intégration n’est revendiqué.
- Android : 3.6.0 (83), Release arm64-v8a, certificat identique avant/après.
  SHA-256 APK : `6d177576a5a440677965db3db7122c598969b6c4a42f71ba5e8bd3b2895990f1`
  puis `f490e0698b06684ba31db32d8a05f53e7ca0deeee9b5c84475123f8a8e6e72f5`.
- iOS : Release locale 3.6.0 (15) puis (16), même équipe de signature ; mises à
  jour distantes désactivées dans le seul projet natif isolé pour tester le bundle
  embarqué. Aucun compteur Store/EAS modifié.
- Le propriétaire a explicitement autorisé la remise à zéro **locale**. Sur iOS,
  la session du trousseau a d’abord resynchronisé le journal ; déconnexion locale
  par l’interface avant toute fixture. Aucun compte ni rêve serveur supprimé.
- Fixture privée v2 : 200 rêves synthétiques identiques sur les deux plateformes,
  invité déconnecté, sans images distantes. Le pilote a corrigé un `analyzedAt`
  manquant dans cette fixture ; ce défaut de préparation n’était pas un bug app.
  La lecture de référence est « Noctalia performance 013 ». Aucun appel d’analyse,
  achat, nouveau compte ou seed de production.

Après les mesures, les 200 valeurs de chaque journal ont été comparées à la
fixture avant suppression. Les bases recopiées/probées sur les téléphones sont
vides, réglages conservés ; le helper Android privé est désinstallé. Sur iOS,
le wrapper de Xcode 27.1 attendait `-runFirstLaunch` pour actualiser CoreDevice.
Le CoreDevice 642.16 déjà installé a permis les copies et leur vérification sans
changer Xcode, la sécurité ni les permissions de l’iPhone.

### Défaut reproduit et correction

Après une lecture longue depuis le treizième rêve, Retour recréait le journal au
premier rêve sur **les deux Release physiques**. Les deux assertions TesterArmy
échouaient après le retour. `handleBackPress` utilisait `router.replace`, qui
recréait l’écran au lieu de réutiliser la liste et ses filtres.

`router.dismissTo('/(tabs)/journal')` retrouve le journal présent dans la pile ;
Expo Router gère aussi l’ouverture du journal lorsque la cible n’existe pas.
Le chemin de confirmation facultative de l’onboarding garde son nettoyage
asynchrone et emploie le même retour. Le correctif évite ce remontage et le
redéfilement nécessaire pour retrouver la lecture, sans promesse de gain FPS.

Le test natif opt-in, un worker par téléphone, vérifie la lecture jusqu’à son
dernier paragraphe, trois retours au même rêve et le retour depuis un lien direct.
Il ne charge aucune fixture et n’installe ni ne réinitialise aucune application.

Trois corrections de types sans effet runtime permettent également la vérification
avec les dépendances RN 0.88 réellement installées : styles littéraux vérifiés par
`satisfies ViewStyle`, et adaptation ciblée à la signature générée de
`StyleSheet.flatten`. Les 90 tests existants de confirmation et les deux tests de
mémoïsation Markdown passent.

### Mesures de démarrage

Cinq répétitions fixées avant chaque série, même fixture et mêmes téléphones.
Le `TTI` natif Observe, le temps ActivityManager Android et la durée
`root_mounted → interactive` JS ont des origines différentes : ne pas les confondre.
La durée bundle est celle de son évaluation native, pas un téléchargement.

| Mesure | Référence | Correctif |
| --- | ---: | ---: |
| Android lancement de l’activité à froid, médiane | 595 ms | 666 ms |
| Android retour après 250 ms en arrière-plan, médiane ActivityManager | 51 ms | 43 ms |
| Android reprise après 5 s en arrière-plan, médiane ActivityManager | 42 ms | 43 ms |
| Android TTI natif des cinq essais froids, médiane | 771 ms | 875 ms |
| Android évaluation bundle, médiane | 200 ms | 237 ms |
| iOS TTI natif des cinq relancements du processus, médiane | 274,47 ms | 276,20 ms |
| iOS évaluation bundle, médiane | 14,45 ms | 15,21 ms |

Sur iOS, ces cinq relancements bénéficient de caches système chauds. Le SDK
classe séparément le lancement froid suivant un changement de build/boot ; premier
lancement de la Release 16 : **248,29 ms** pour son initialisation native et
**318,14 ms** pour son TTI natif depuis `didFinishLaunching`. Ces deux métriques
ne commencent pas au même instant. La série après correctif
varie de 275,63 à 286,27 ms en TTI. Aucune attribution du gain à la seule migration
SDK 58 : les deux candidats utilisent déjà ce SDK. Le TTI Android augmente de
104 ms dans la série finale (température batterie 23,9 °C contre 21,9 °C et trois
commits Today intégrés). Ces séries ne permettent pas d’attribuer cet écart au
changement de retour ; **aucun gain de démarrage n’est revendiqué**. Les cibles restent
des objectifs de travail, pas un nouveau seuil de livraison.

### Preuves et limites

Les rapports canoniques privés, identités binaires, traces et commandes se trouvent
dans le dossier local de cette campagne. Ils restent hors Git : pas de contenu
personnel, identifiant appareil, compte ou trace système dans cette synthèse.
Les sorties TesterArmy sont ignorées sous `tools/e2e/.e2e/`.

- Échecs de référence conservés : `native-performance-android-master-v2` et
  `native-performance-ios-master-v2-accessible`.
- iOS corrigé : `native-performance-ios-fix-5deef6dd8`, **2/2 passent** ; position
  y=812 avant et après chacun des trois retours, lien direct validé.
- Android corrigé : `native-performance-android-fix-5deef6dd8`, **2/2 passent** ;
  position y=1455 avant et après les trois retours, lien direct validé.
- FrameTimeline Android : pilote puis cinq passages par phase. Le dump
  UIAutomator ne trouvait pas l’immobilité ; un adaptateur privé utilise le driver
  agent-device 0.21.28 pour observer l’arbre, hors fenêtres mesurées. Contrôles de
  binaire/runtime et calculs Perfetto du runner existant conservés. Une première
  série interrompue à la préparation du quatrième passage n’est pas une série
  validée ; la série finale attend la fin des transitions avant les vérifications.
  Les deux séries finales sont complètes : cinq essais par phase, même scénario,
  réglage 120 Hz, températures 22,9 puis 23,9 °C. Verdict conservateur :
  **indéterminé** pour les trois phases, aucune amélioration FPS revendiquée.

  | P95 de frame, médiane des cinq essais | Référence | Correctif |
  | --- | ---: | ---: |
  | Défilement du journal | 15,51 ms | 15,80 ms |
  | Ouverture du détail | 23,16 ms | 24,32 ms |
  | Défilement du détail | 15,69 ms | 16,52 ms |

  Les taux App Deadline Missed sont respectivement 6,73/8,22/2,78 % avant et
  7,62/7,67/2,64 % après. Les plages P95 par essai se recouvrent. Le P95 est une
  durée de frame de surface, pas une latence clic-vers-contenu.
- Instruments iOS : `--attach` ne trouve pas le processus ; `--all-processes`
  fonctionne. Filtrer les lignes Noctalia ; les tables de surfaces globales ne
  donnent pas un dénominateur de frames attribuable à l’app. Aucun FPS app déduit
  de ces tables ni d’un succès de commande sans métrique disponible. Sur la
  fenêtre de lecture de 60 s, 25 hitches attribués à Noctalia ont des retards de
  8,33 à 25,00 ms. Dans le profil CPU, 75,25 % des 17 558 échantillons Noctalia
  passent par l’accessibilité, notamment `_accessibilityUserTestingSnapshot...`.
  **Le coût des snapshots du driver domine cette trace** ; il ne justifie pas
  une optimisation aveugle de Yoga ou des re-renders pour l’utilisateur. Les
  groupes se recouvrent (Hermes 6,99 %, montage React 6,55 %, Yoga 1,13 %).
- Mémoire : observations dans le même processus, sans GC forcé ; une montée de
  caches au premier détail n’est pas une fuite. Sur iOS, RSS du journal puis après
  chaque lecture/retour : 213 456, 298 384, 305 648, 281 504 kB. Le dernier retour
  a nécessité un scroll jusqu’en haut : le driver avait touché le bouton partiellement
  masqué par la barre d’état. Aucun redémarrage entre échantillons. Cette courte
  série ne montre pas une croissance continue, sans exclure une fuite à long terme.
  Sur Android, le processus suivi en lecture reste à 890 vues, une activité et
  environ 472–480 MiB de PSS, avec un pic à 568 MiB lors d’une transition.
  Le PSS Android et le RSS iOS ne sont pas des mesures interchangeables.
- Fixture sans images et sans synchronisation authentifiée : ni décodage/cache
  des images distantes, ni latence réseau de synchronisation qualifiés. La lecture
  de données locales et les retours depuis l’arrière-plan sont exercés. Cinq reprises
  iPhone depuis l’écran d’accueil conservent le même PID et le même rêve visible.
  Leur roundtrip d’automatisation n’est pas une mesure de latence native.
- Aucun build EAS : `uploadSourceMaps` déjà fusionné dans #437, mais aucun upload
  de source maps prouvé par cette campagne. Noxcturnal concerne le bundling, pas
  une amélioration runtime déduite de ces mesures.

### Relancer la première campagne

Préparer le même journal synthétique, vérifier l’identité Release et l’autorisation
du téléphone avant de relancer. Ne pas injecter une fixture dans un compte connecté.

```sh
# Depuis tools/e2e ; versions effectives : e2e 0.21.2, mobile 0.12.3,
# agent-device 0.21.28. Réutiliser le runner iOS signé et son profil privé.
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_PLATFORM=ios \
E2E_PERF_DEVICE="$PHONE_NAME" E2E_OUTPUT=.e2e/performance-rerun \
mise exec -- npx e2e run --config e2e.native-performance.config.ts
# Android : E2E_PERF_PLATFORM=android et nom exact du Motorola ; envelopper
# la commande dans scripts/android-device-lock.js wrap --owner dreamer.

# Depuis la racine ; ADB_BIN/JAVA_HOME et SDK configurés.
mise exec -- node scripts/android-device-lock.js wrap --owner dreamer \
  --device "$PHONE_SERIAL" -- npm run android:perf:measure -- \
  --device "$PHONE_SERIAL" --mode all --runs 5 --output "$PRIVATE_OUTPUT"
```

`npm run verify:pr` passe sur `5deef6dd8` : 6 contrôles exécutés, 4 réutilisés à
entrées identiques. La preuve finale du commit de PR est enregistrée dans sa
description. Aucun déploiement ni nouvelle fusion autorisés par cette campagne.


## Goal suivant : cinq leviers de performance

Cette deuxième campagne poursuit #439 sur les mêmes téléphones et reste locale.
Les constats précédents gardent leur identité source ; ils ne représentent pas
une nouvelle exécution sur le candidat final. Aucun merge, build EAS, upload de
source maps, déploiement ni publication Store n’est effectué.

### Lecture : borner les bitmaps plutôt que mémoïser à l’aveugle

Le profil natif Android attribue les grosses allocations au `TilePostprocessor`
de React Native 0.88 : `Image resizeMode="repeat"` crée un bitmap aux dimensions
de toute la vue. Le papier est réutilisé sur plusieurs pages conservées. Un autre
ensemble d’allocations vient du canvas plein écran de `react-native-svg`, alors
que les bords dessinés occupent uniquement la marge droite.

`JournalPaper` utilise désormais sur Android de petites tuiles partageant la
même source, à la même échelle physique et avec la même origine. Le SVG des bords
ne dessine que sa marge, en conservant les coordonnées des chemins et dégradés.
Le papier iOS/web conserve `repeat` et une taille explicite de 100 % du parent.
La revue a détecté que `absoluteFill` seul laisse les dimensions intrinsèques
512 × 512 injectées par `Image` iOS : ce défaut du candidat intermédiaire a été
corrigé avant livraison. **La mesure initiale de −12,35 % sur iOS est invalidée** ;
elle ne prouve pas un gain à surface constante.

Android : trois démarrages de processus par candidat, caches système chauds,
même rêve illustré existant du compte de développement autorisé, huit secondes
sur le journal puis huit sur le détail. Aucun snapshot d’accessibilité ni profileur
pendant ces fenêtres. Référence `5deef6dd8`, candidat `456cf360d`.

| Médiane en lecture, Android | Référence | Candidat |
| --- | ---: | ---: |
| PSS | 552 120 KiB | 360 568 KiB |
| Bitmaps | 140 779 KiB | 40 810 KiB |
| Graphics | 192 031 KiB | 83 295 KiB |
| Vues | 1 062 | 1 152 |

Le PSS diminue de **34,7 %**, avec 90 vues de tuiles supplémentaires. La région
papier comparée pixel à pixel reste identique ; les bords présentent de faibles
écarts d’anticrénelage. Ce n’est pas un test de fuite à long terme. Les volumes
agrégés d’allocation du profil heapprofd ne sont pas une mesure de mémoire vive.

La contre-vérification FrameTimeline utilise 5 000 rêves synthétiques sans images,
un lancement frais puis une ouverture de lecture de chauffe avant chaque série.
Trois passages par phase, 120 Hz, batterie 22 °C avant/après. Même adaptateur SDK
privé et runner Perfetto canonique, **aucun snapshot dans les fenêtres mesurées**.
Les contrôles de scénario, APK, certificat et runtime passent.

| Phase Android | P95 médian avant / après | App Deadline Missed avant / après | Verdict |
| --- | ---: | ---: | --- |
| Ouverture du détail | 21,95 / 20,11 ms | 1,89 / 2,39 % | Indéterminé |
| Défilement du détail | 16,05 / 13,99 ms | 2,46 / 1,76 % | Gain observé |

Le P95 du défilement diminue de 12,8 % ; plages par essai 14,19–16,98 ms puis
13,74–14,06 ms, sans recouvrement. Le verdict suit les critères conservateurs du
runner existant. L’ouverture n’établit aucun gain ; son taux de frames manquées
augmente de 0,50 point. Ce résultat n’est ni une qualification universelle à
120 FPS ni une mesure de latence clic-vers-contenu.

La série iOS corrigée compare la Release 16 (`5deef6dd8`) à la Release 18
(`eb0b83cbe`), même fixture de 200 rêves sans images, même référence 013 et
huit secondes après chaque route, trois processus frais avec caches système
chauds. Les échantillons Activity Monitor restent hors snapshots UI.

| Mémoire résidente iOS, médiane rapportée par le SDK | Référence | Candidat final |
| --- | ---: | ---: |
| Journal | 189 888 kB | 190 032 kB |
| Lecture | 304 688 kB | 262 128 kB |

La lecture diminue de **14,0 %** à surface papier complète ; le journal est stable.
Essais du détail : 299 792 / 304 688 / 319 872 avant, puis
261 056 / 262 128 / 266 752 après. Ces valeurs résidentes ne se comparent pas
directement au PSS Android et ne démontrent pas l’absence de fuite à long terme.

### Gros journaux : conserver le contrat complet pour l’instant

Pilote natif Android sur le candidat `456cf360d`, invité, trois processus frais
par taille ; insertion hors mesure, caches fichiers système chauds. L’intervalle
commence au marqueur JS `root_mounted` et finit au premier contenu utile du journal.
Il ne mesure pas tout le cold start natif, ni uniquement SQLite.

| Rêves locaux | Premier contenu utile, médiane | PSS médian |
| --- | ---: | ---: |
| 200 | 492,9 ms | 242 580 KiB |
| 1 000 | 578,5 ms | 256 810 KiB |
| 5 000 | 906,2 ms | 314 909 KiB |

Le 5 000e rêve est recherché par une phrase située dans son transcript, ouvert,
lu puis retrouvé avec la requête conservée au retour, sur **les deux Release
physiques**. Effacer la recherche rend les autres rêves accessibles. Le test
constitue un contre-exemple à une pagination qui limiterait la recherche à la
fenêtre de présentation de 40 rêves.

Décision : ne pas introduire de projections/pagination du stockage dans ce lot.
Le pilote reste sous une seconde entre la racine JS et le contenu utile à 5 000
rêves, sans troncature observée. Modifier maintenant l’autorité commune à la
recherche, aux statistiques et à la synchronisation ajouterait un risque que ces
mesures ne justifient pas. Une pagination reste pertinente si des journaux réels
beaucoup plus volumineux ou des appareils plus limités montrent un blocage.
L’index SQLite `(scope, position)` et l’écriture par lots existent déjà.

Le contrôle du vrai store sous SQLite/Node sur Mac donne 1,44 / 6,36 / 31,15 ms
pour 200 / 1 000 / 5 000 rêves, avec environ 65 Mo de heap à 5 000. C’est un
contrepoint algorithmique, **pas une mesure du bridge natif ou de Hermes**.

### Images : ne demander l’original qu’au bon moment

Le préchargement et les cartes résolvaient miniature **et** original. Le mode
`variant: 'thumbnail'` réserve désormais la lecture du cache et la signature à la
miniature quand elle existe. Le détail garde l’original ; une carte le demande
explicitement si la miniature échoue, y compris si la signature échoue avant
qu’un composant Image puisse recevoir `onError`. Sans miniature, l’original reste
le repli normal. Les identités compte/URI/version empêchent les réponses tardives
ou le recyclage d’une carte de réutiliser l’état d’un autre compte.

Sur 20 cartes, le vrai résolveur et son ordonnanceur demandent **20 chemins à
signer au lieu de 40**. Il peut s’agir de requêtes groupées : ce résultat ne signifie
pas 40 appels HTTP devenus 20. Une miniature déjà sur disque ne demande plus la
signature inutile de l’original. Le endpoint de signature est simulé dans ce
pilote ; aucun gain de latence réseau de production n’en est déduit.

La revue a également corrigé un repli hors ligne : la préservation d’une miniature
signée non expirée écrasait un original nouvellement retrouvé sur disque. Les
variantes sont maintenant fusionnées indépendamment et gardent l’échéance la plus
courte. Le contre-exemple isolé couvre cette transition, inaccessible au parcours
web qui ne dispose pas du cache natif. Les parcours web miniature absente →
original et deux sources absentes → entrée compacte lisible passent **2/2**.

### React et données dérivées

Les objets de rêves inchangés sont déjà stabilisés ; les contextes données et
statut sont séparés. Huit contrats existants passent, dont le consommateur de
données qui ne re-render pas lors de `ready → saving → ready`. Le même tableau
partage déjà l’index des symboles par `WeakMap`.

Sur Mac/Node, le vrai moteur avec six symboles par rêve construit l’index de
5 000 rêves en 15,89 ms, puis réutilise le snapshot en environ 0,00067 ms. Une
modification de favori republie bien une référence fraîche dans les occurrences.
Aucun cache supplémentaire n’est ajouté : cacher uniquement par identifiants
risquerait de rendre titres/favoris obsolètes. Ces temps ne sont pas des FPS natifs.

### Bundle, polices et SDK 58

Les candidats utilisent tous Expo 58.0.14 / RN 0.88.0 : la campagne ne mesure pas
un passage depuis un ancien SDK. Les gains annoncés de compilation native et
d’appels Expo Modules ne peuvent pas être attribués à ces changements.

`expo-atlas` 0.5.0 est épinglé en dépendance de développement. La référence compte
3 587 modules, 17 987 642 octets transformés et 12 472 813 octets Hermes. Les
851 788 octets du dictionnaire, 456 051 du CSS et 914 475 des six traductions sont
des poids **transformés Atlas**, pas leurs contributions nettes au bytecode.
Les contenus étendus du dictionnaire sont déjà différés. Les imports dynamiques
natifs diffèrent l’exécution ; ils ne constituent pas un découpage réseau du bundle.

Pilote froid alterné sur les mêmes sources : Babel 13 504 / 13 827 ms,
Noxcturnal 11 367 / 11 101 ms, soit **17,8 % de bundling en moins**. En contrepartie,
le bytecode augmente de 199 807 octets (environ 1,6 %) et le transformeur conserve
408 replis Babel pour 3 105 transformations terminées. Des worklets et quatre
fichiers rejetés par le parseur React Compiler passent par le repli prévu.

Le drapeau local `NOCTALIA_METRO_NOXCTURNAL=1` active le pilote via la configuration
Expo installée ; il est ignoré pour `EAS_BUILD=true`. L’export réel avec ce drapeau
passe en 10 805 ms. Les binaires physiques de cette campagne gardent Babel.
**Noxcturnal reste expérimental et facultatif** : aucun gain runtime revendiqué.
Voir [le mode d’emploi](../../../scripts/android/README-performance.md).

Les onze fontes utilisées pèsent 1 097 088 octets. Sur les neuf lancements Android
du pilote volumétrique, leur attente médiane vaut 23 ms, maximum 73 ms. Aucun
retrait de graisse ni changement de police de marque ne se justifie ici.

### Identité et preuves du goal

Les données et traces privées restent dans le dossier canonique local du goal,
sans identifiant de compte ni de téléphone dans Git. Les fixtures ne sont insérées
que dans le journal invité, hors connexion de compte ; chaque remplacement ou
nettoyage compare toutes les lignes aux valeurs synthétiques attendues et conserve
les autres scopes. Le compte de développement autorisé n’est jamais supprimé.

Les mesures Android ci-dessus portent sur `456cf360d`, APK
`722c3295300a99ad876786742c2c9130399b7cde742f07371f83ec7ec1ecb00e`, comparé à
l’APK `f490…` de `5deef6dd8`. Les deux corrections issues de revue sont dans
`eb0b83cbe` : repli hors ligne et dimensions explicites iOS. La branche Android du
papier n’a pas changé ; les mesures papier/frames Android sont réutilisées dans
ce périmètre, sans les présenter comme une nouvelle série du dernier build.

Les preuves de navigation/recherche sont une **union de parcours réussis sur les
mêmes binaires `456cf360d`**, et non une exécution unique de six tests :

- Trois lectures/retours : iOS `performance-native-20261019-ios-return-reveal` ;
  Android premier test de `performance-native-20261019-android-5000-reveal`.
  Les bounding boxes avant/après sont identiques à chaque retour.
- Recherche complète : `performance-native-20261019-android-5000-short-return`
  et `performance-native-20261019-ios-5000-keyboard`, **1/1 chacun**.
- Lien direct : tests réussis inchangés de `performance-native-20261019-ios-source456`
  et `performance-native-20261019-android-5000-source456`.

Les tentatives initiales et leurs échecs sont conservés. Les corrections du test
révèlent le retour contextuel après un geste vers le haut, rendent le running head
entièrement visible sous la barre d’état et utilisent Retour du clavier iOS pour
éviter que le geste générique de masquage active une carte. Elles ne retirent pas
les assertions de lecture, requête préservée ou retour.

```sh
# Après préparation vérifiée de la fixture privée ; depuis tools/e2e.
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_PLATFORM=ios \
E2E_PERF_DEVICE="$PHONE_NAME" E2E_PERF_FIXTURE_COUNT=5000 \
E2E_OUTPUT=.e2e/performance-large-rerun E2E_WORKERS=1 \
mise exec -- npx e2e run --config e2e.native-performance.config.ts \
  --grep 'native journal searches'
```


Les deux Release finales sont construites depuis les entrées applicatives
`eb0b83cbe` avec Babel : Android 3.6.0(83), APK
`6ff0a531bd4f5fafb275b965408b7d683f25b2c066efc723076d2935f8888ae4`,
certificat inchangé, non debuggable et profileable ; iOS 3.6.0(18), bundle
`12b60fa4650478ed033a45c63a2362b9c90b660016d17966b194114de5b2d707`, Release
locale signée développement, mises à jour désactivées. Un entitlement de débogage
lié à cette signature locale ne transforme pas la configuration en client Metro.
Le marqueur Android confirme le lancement embarqué, runtime
`da2d14f780f85ae3fbfdb315adcd6bed90d46ce0`, update
`32c060d0-7b9f-45cc-9182-ce716acd1b56`.

La fixture illustrée privée emploie deux fichiers du dépôt, visuellement distincts,
et deux URI volontairement absentes, sans serveur ni modification ATS/cleartext.
Elle exerce quatre cas : miniature valide, miniature absente avec original valide,
deux sources absentes avec entrée compacte toujours lisible, et original seul.
Les assertions exactes couvrent l’entrée, sa lecture et l’ouverture de l’illustration
valide en plein écran ; les captures sont inspectées pour confirmer le contenu
décodé, la seule présence d’une cover ne suffisant pas. Le même original local est
réaffiché sur plusieurs entrées. Cela qualifie le décodage/repli natif et le retour
chaud, **pas le cache HTTP hors ligne, sa latence, ni une déconnexion réseau réelle**.

Android : `performance-native-20261019-android-media-final`, un parcours contenant
les quatre cas, **1/1 passe** sur l’APK final. Sur iOS, la première tentative montre
que le driver conserve un suffixe lors du remplacement d’une recherche non vide.
Le test utilise ensuite le bouton d’effacement réel et vérifie la valeur exacte
avant chaque recherche ; cette correction n’altère pas le code applicatif.

La relance `performance-native-20261019-ios-media-global` passe **1/1**, quatre
cas, 108,55 s sur la Release 18 ; le sélecteur d’effacement tient compte de l’arbre
AX aplati. Les captures Android et iOS confirment la miniature sombre au premier
cas, l’original clair aux deuxième/quatrième cas et l’entrée compacte au troisième.
La commande correspondante reprend la configuration native ci-dessus avec
`E2E_PERF_FIXTURE_MEDIA=local` et `--grep 'native journal illustrates'`.

Les deux défauts issus de la revue indépendante sont corrigés dans `eb0b83cbe`,
revue du delta sans nouveau défaut bloquant. Les 18 tests du hook, les types app,
tests et runner natif, ainsi que le lint ciblé passent après correction.

Après qualification, les 200 valeurs de la fixture illustrée de chaque plateforme
sont comparées aux valeurs attendues avant retrait. Android : zéro rêve invité,
196 lignes des autres scopes conservées au nettoyage, fichiers de médias et helper
privés retirés ; reconnexion par Google au seul compte de développement autorisé,
identité vérifiée dans les réglages. iOS : zéro rêve invité, intégrité SQLite
confirmée par recopie, autres bases et réglages conservés. Aucun compte supprimé.

`origin/master` a ensuite été intégré depuis `967fe81f0` (#440/#441) : site et
textes de dictionnaire, dont contenus étendus portugais/espagnols/italiens et deux
métadescriptions portugaises. Le code des parcours français et des optimisations
reste identique. Les binaires testés n’embarquent pas ces textes plus récents :
preuves natives réutilisées pour leur périmètre français et leurs sources exactes,
pas de nouveau build physique revendiqué pour cette intégration documentaire.
La preuve `verify:pr` de la tête finale figure dans la description de #439.
