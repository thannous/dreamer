# Performance native Dreamer — 18–19 octobre 2026

Campagne locale sur les **vraies apps Noctalia** (`com.tanuki75.noctalia`) du
Motorola edge 60 fusion (Android 16) et de l’iPhone 17 Pro Max (iOS 27.0.1).
Expo 58.0.14, React Native 0.88.0, Hermes et New Architecture ; Release embarquées,
Android profileable, aucune session Metro. Aucune qualification Play/TestFlight.

## Candidats et données

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

## Défaut reproduit et correction

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

## Mesures de démarrage

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

## Preuves et limites

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

## Relancer

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
