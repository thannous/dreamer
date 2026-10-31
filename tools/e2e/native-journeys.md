# Dreamer : parcours natifs et reconnaissance depuis un fichier QA

Ce lot ajoute sept cas TesterArmy dans trois fichiers. La sélection sans injection microphone comprend six cas ; dans la campagne actuelle, le fichier vocal iOS reste aussi exclu et non qualifié, soit **six cas sur Android et cinq sur iOS**. Un cas sélectionné, listé ou ignoré ne constitue pas une réussite. Une liste de tests, un build ou le pilote API ne constituent pas une réussite native. Le [rapport de campagne](../../doc_web_interne/docs/qa/dreamer-native-missing-journeys-20261022.md) associe chaque résultat à ses sources, son Release et son run, en distinguant exécution fraîche, preuve réutilisée et limite non qualifiée.

| Parcours | Preuve attendue | Sélection |
| --- | --- | --- |
| Permission microphone refusée puis réautorisée | Brouillon intact, saisie de secours, sauvegarde unique après redémarrage | `--tag native-microphone-permission` |
| Reconnaissance vocale native depuis un fichier QA | Deux repères reconnus dans l’ordre, au début et à la fin du fichier, avant toute saisie ; correction et sauvegarde durable unique | `--tag native-speech-file` |
| Création et modification hors ligne | Aucune ligne serveur hors ligne ; redémarrage, reconnexion puis une seule ligne avec le texte modifié | `--tag native-real-sync` |
| Invité, connexion et séparation des comptes | Rêve et brouillon transférés, reconnexion, autre compte sans accès, identifiants serveur stables | `--tag native-real-account` |
| Analyse interrompue | Job réel admis et en attente pendant l’arrêt du processus, reprise avec un seul résultat et crédit | `--tag native-recovery` (premier cas) |
| Chat avec accusé final perdu | Paire déjà enregistrée, nouvelle tentative avec le même identifiant, aucun doublon ni crédit supplémentaire | `--tag native-recovery` (second cas) |

Sources : [voix](tests/dreamer-voice.mobile.e2e.ts), [synchronisation et comptes](tests/dreamer-sync-account.mobile.e2e.ts), [reprise analyse et chat](tests/dreamer-recovery.mobile.e2e.ts).

La configuration native exige le correctif `079ea1cbd` ou un descendant : les accès directs `process.env.EXPO_PUBLIC_*` sont intégrés par Expo dans le bundle, alors que les anciens alias et accès `process?.env` conservaient silencieusement le fallback. Le profil QA inscrit aussi explicitement le backend local dans `expo.extra`, sans reprendre le fallback hébergé. Les anciens binaires antérieurs à cette correction ne qualifient pas ce lot.

L’application utilise le stockage natif, HTTP et Auth/Postgres réels. Le scénario hors ligne coupe réellement les connexions de l’app vers son backend via le proxy local ; il ne change pas la connectivité système ni le mode avion. Le serveur local importe les vrais handlers, worker et RPC de quotas/jobs/chat. Seul le transport du fournisseur IA retourne des réponses déterministes ; la panne chat retire l’accusé final après le véritable commit. L’analyse est interrompue **après admission durable, avant démarrage du worker**, sans simuler un résultat enregistré. Cette preuve ne couvre pas la qualité IA, un déploiement Edge complet, la production, les Stores ou un appareil physique.

Le cas vocal fournit un fichier QA au recognizer système réel et passe par les événements vocaux de l’application. Ses assertions exigent les repères « blue lighthouse » puis « seven windows » (ou « 7 windows »), situés au début et à la fin du fichier, **avant toute saisie**, puis une correction du texte réellement reconnu et une seule sauvegarde persistante après redémarrage. Le recognizer Android a rendu « boat » par l’homophone « bowed » : ce mot intermédiaire ne sert pas de seuil de réussite. La correction utilisateur remplace « blue lighthouse » par « green lighthouse » et ajoute une phrase ; elle ne remplace pas la reconnaissance préalable. Une réussite de ce cas qualifie la reconnaissance du fichier et ce parcours applicatif ; elle ne qualifie ni l’entrée acoustique du microphone, ni une dictée en direct, ni un microphone physique. Le cas de permission vérifie le refus, la conservation du brouillon, la réautorisation et la saisie de secours ; la réautorisation seule ne prouve pas une capture audio réussie.

## Préparation locale

Depuis un worktree isolé, avec les dépendances correspondant aux lockfiles :

```sh
mise exec -- npm ci
mise exec -- npm run test:testerarmy:setup
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npm run test:testerarmy:guards
EXPO_OFFLINE=1 mise exec -- npx expo install --check
```

Cette campagne utilise `EXPO_OFFLINE=1` pour le contrôle Expo et les builds : la compatibilité est évaluée avec les métadonnées du SDK Expo épinglé. Le contrôle en ligne proposait 22 mises à jour de correctifs qui ne sont pas une condition de cette campagne ; aucune mise à jour implicite n’est effectuée.

Utiliser un Simulator et un AVD dédiés et disponibles ; jamais une installation personnelle. Le profil porte le bundle distinct `com.tanuki75.noctalia.qa`, les services mock sont désactivés et les OTA sont désactivées. Android exige Java 17 et le SDK Android ; iOS exige Xcode et CocoaPods. Ne pas définir `E2E_WORKERS` : un seul worker pilote chaque appareil.

Le serveur et les deux comptes synthétiques sont partagés par la campagne : **exécuter iOS puis Android, jamais simultanément**. Le runner prend un verrou par appareil **et un verrou par identifiant de pile** (`native-backend-lock`), puis les libère après fermeture du SDK ; une seconde exécution sur la même pile est refusée. Le pilote API ne prend pas ce verrou : le lancer uniquement en dehors des runs natifs.

Avant **chaque** run, fermer l’app `com.tanuki75.noctalia.qa` sur l’autre plateforme partageant cette pile : le verrou bloque les runners concurrents, mais ne termine pas une app restée vivante, dont une ancienne file peut encore synchroniser.

La fixture déconnecte puis efface l’état de l’app QA courante avec `app.clearState()` avant de supprimer les rêves, crédits et compteurs de création des deux seuls comptes jetables `owner` et `other`. Les UUID authentifiés du manifeste bornent chaque suppression. Le compteur de création est réinitialisé par une requête PostgreSQL paramétrée sur la base loopback validée ; la limite produit, les permissions et les autres comptes restent inchangés. Supprimer les rêves seuls ne remet volontairement pas ce compteur à zéro.

Choisir un répertoire privé neuf ; le démarreur refuse un dossier existant. Garder le terminal A actif jusqu’à la fin de tous les runs :

```sh
export NOCTALIA_NATIVE_QA_DIR=/private/tmp/noctalia-native-journeys-rerun-20261022
mise exec -- node tools/e2e/native-backend-stack.mjs \
  --output "$NOCTALIA_NATIVE_QA_DIR" \
  --port 31283 --functions-origin http://127.0.0.1:31284
```

Attendre la ligne JSON `ready: true`. Dans les autres terminaux, reprendre **le même** chemin :

```sh
export NOCTALIA_NATIVE_QA_DIR=/private/tmp/noctalia-native-journeys-rerun-20261022
export E2E_NATIVE_BACKEND_MANIFEST="$NOCTALIA_NATIVE_QA_DIR/manifest.json"
export E2E_NATIVE_JOURNEYS=1
```

Terminal B, après la disponibilité de la pile :

```sh
mise exec -- deno cache --no-config tools/e2e/test-support/native-recovery-api.ts
mise exec -- deno run --no-config --cached-only \
  --allow-net=127.0.0.1,deno.land:443 --allow-read --allow-env \
  tools/e2e/test-support/native-recovery-api.ts
```

L’import ImageScript initialise son WASM épinglé depuis `deno.land`. Le serveur révoque cette permission avant d’accepter des requêtes ; l’exécution des parcours reste limitée au backend local et au fournisseur déterministe en mémoire. Attendre `Native recovery API ready on loopback:31284` et conserver ce terminal actif. Ne pas démarrer deux serveurs sur le même port.

Pilote préalable, sans appareil et sans le compter comme validation native :

```sh
E2E_NATIVE_RECOVERY_PILOT_OUTPUT="$NOCTALIA_NATIVE_QA_DIR/recovery-pilot-result.json" \
  mise exec -- node tools/e2e/test-support/native-recovery-pilot.mjs
```

Le pilote vérifie réellement admission, complétion, idempotence et quotas, écrit un reçu avec l’identité des sources et retire seulement ses propres lignes de fixture.

## Génération et builds identifiés

Générer uniquement dans ce worktree si les projets natifs compatibles n’existent pas. Charger le profil public local avant la génération :

```sh
set -a
. "$NOCTALIA_NATIVE_QA_DIR/expo.env"
set +a
export NOCTALIA_DREAMER_QA_BUILD=1
export EXPO_PUBLIC_NATIVE_QA_AUDIO=true
export NOCTALIA_APP_VARIANT=noctalia
export EXPO_PUBLIC_APP_VARIANT=noctalia
mise exec -- npx expo prebuild --no-install --platform all
(cd ios && pod install)
```

Un problème de téléchargement des dépendances binaires CocoaPods a été constaté sur cette machine. Des caches locaux correspondant exactement aux versions verrouillées peuvent permettre une reprise ; conserver ce diagnostic dans le rapport de build. Aucun chemin de cache privé ni substitution de version n’est requis par ce runbook.

Le runner charge lui-même `expo.env` depuis le manifeste pour le build `local-backend`. Ne pas ajouter `E2E_BUILD_ENV_FILE`. Garder la même pile vivante pendant les deux builds et leurs runs : un reçu lie le binaire à son identifiant de pile et à sa clé publique ; une nouvelle pile demande de nouveaux builds.

Android, pour l’AVD ARM64 de cette campagne. Le JDK 17 est installé par mise sur cette machine ; adapter ce chemin à son propre JDK 17 installé, sans supposer que `java_home` le répertorie :

```sh
export JAVA_HOME='/Users/timax/.local/share/mise/installs/java/temurin-17.0.20+101'
EXPO_OFFLINE=1 E2E_BUILD_PROFILE=local-backend \
  E2E_BUILD_COMMAND='["./gradlew",":app:assembleRelease","--no-daemon","--max-workers=2","-PreactNativeArchitectures=arm64-v8a"]' \
  E2E_RELEASE_BINARY=android/app/build/outputs/apk/release/app-release.apk \
  mise exec -- npm run test:testerarmy:mobile -- dreamer android build
```

iOS, avec l’UDID alloué à cette campagne ; adapter l’UDID si la cible dédiée a changé :

```sh
EXPO_OFFLINE=1 E2E_BUILD_PROFILE=local-backend \
  E2E_BUILD_COMMAND='["xcodebuild","-workspace","ios/NoctaliaQA.xcworkspace","-scheme","NoctaliaQA","-configuration","Release","-sdk","iphonesimulator","-destination","id=0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD","-derivedDataPath","ios/build/journeys","-jobs","2","CODE_SIGNING_ALLOWED=YES","CODE_SIGN_IDENTITY=-","build"]' \
  E2E_RELEASE_BINARY=ios/build/journeys/Build/Products/Release-iphonesimulator/NoctaliaQA.app \
  mise exec -- npm run test:testerarmy:mobile -- dreamer ios build
```

Conserver `ios/build/journeys` : les sorties y sont exclues des entrées natives, contrairement à un dossier voisin nommé `ios/build-journeys`. Chaque build réussi affiche son chemin exact `release.json`. Le binaire est archivé dans le dossier immuable du build. Ne pas modifier les sources pendant une exécution ; les identités de source et de binaire restent celles du reçu et du run.

## Exécution séquentielle des parcours

Remplacer `IOS_BUILD_RUN` et `ANDROID_BUILD_RUN` par les dossiers exacts affichés par les builds. Ces variables ne désignent jamais un fichier « latest » :

```sh
export NOCTALIA_IOS_RELEASE=tools/e2e/.e2e/dreamer-ios/IOS_BUILD_RUN/release.json
export NOCTALIA_ANDROID_RELEASE=tools/e2e/.e2e/dreamer-android/ANDROID_BUILD_RUN/release.json
```

Les commandes de fermeture ci-dessous visent uniquement le bundle QA sur les deux cibles dédiées de cette campagne, jamais une installation personnelle. Attendre la fin complète du runner précédent. Si l’autre cible est arrêtée, confirmer cet état ; si elle est active, terminer son app QA avant de poursuivre. Ne pas remplacer cette fermeture par une désinstallation ou un effacement d’une app personnelle.

D’abord, fermer l’app QA Android, puis lancer les cinq cas iOS sur le Simulator `Noctalia_Journeys_QA` ; la reconnaissance du fichier iOS reste hors qualification :

```sh
adb -s emulator-5560 shell am force-stop com.tanuki75.noctalia.qa

E2E_DEVICE=0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD \
  E2E_RELEASE_RECEIPT="$NOCTALIA_IOS_RELEASE" \
  mise exec -- npm run test:testerarmy:mobile -- dreamer ios run \
  --install-release --exclude-tag native-real-dictation --exclude-tag native-speech-file
```

Après fermeture complète du runner iOS, **terminer aussi son processus QA** avant que la fixture Android nettoie les comptes partagés. Lancer ensuite les six cas Android sur l’AVD dédié :

```sh
xcrun simctl terminate 0220EB9F-6117-4F95-BAF6-D2D9BAF2C6FD com.tanuki75.noctalia.qa

E2E_DEVICE=emulator-5560 E2E_AVD_NAME=Noctalia_Journeys_QA \
  E2E_RELEASE_RECEIPT="$NOCTALIA_ANDROID_RELEASE" \
  mise exec -- npm run test:testerarmy:mobile -- dreamer android run \
  --install-release --exclude-tag native-real-dictation
```

Avant de revenir à iOS, refaire la fermeture ciblée Android :

```sh
adb -s emulator-5560 shell am force-stop com.tanuki75.noctalia.qa
```

Ces commandes ne doivent pas être lancées pendant un run actif. Si `simctl terminate` indique que l’app QA est déjà arrêtée, conserver ce constat ; une autre erreur doit être résolue avant le run suivant. Le runner crée puis retire son propre `adb reverse` pour le port 31283 ; ne pas en créer un manuellement. Un mapping existant est refusé. Il vérifie le profil, les empreintes des entrées et du binaire, ainsi que l’installation avant et après le run. Il lit aussi la configuration publique réellement embarquée dans l’APK ou le bundle EXConstants iOS et refuse une origine distante, une clé publique différente ou des clés Store actives avant l’interface. Le reçu `embedded-public-config.json` ne conserve que les comparaisons et empreintes, liées au binaire. Ces diagnostics d’installation et de configuration restent distincts du résultat fonctionnel.

Pour une reprise ciblée sur la même plateforme et le même reçu, remplacer les options `--exclude-tag` de l’exemple par l’un des tags du tableau. Fermer auparavant l’app QA de l’autre plateforme, comme ci-dessus. Une tentative `--tag native-speech-file` sur iOS produit sa propre preuve ; son exclusion de la sélection courante reste explicite jusqu’à qualification. `--tag native-recovery` sélectionne deux cas ; ajouter `--grep 'queued real analysis'` ou `--grep 'real chat retries'` pour n’en exécuter qu’un. Omettre `--install-release` si le binaire identifié est déjà installé. Garder `E2E_NATIVE_JOURNEYS=1` et le manifeste dans l’environnement.

Le cas `native-real-dictation` reste hors sélection : le build actuel fournit un fichier au moteur vocal et ne peut pas qualifier l’injection microphone. Son exclusion n’est pas un succès.

## Résultats et arrêt

Conserver les rapports immuables des runs utiles sous `tools/e2e/.e2e/dreamer-<platform>/<RUN>/`, puis un seul [rapport de synthèse](../../doc_web_interne/docs/qa/dreamer-native-missing-journeys-20261022.md) : pour chaque parcours et plateforme, résultat, première erreur éventuelle, trace/log utile, reçu Release, révisions des tests et du binaire, identité du backend et commande exacte. Une campagne fraîche « 6/6 » exige un même run identifié avec les six cas attendus réussis et les contrôles d’identité/cleanup ; six cas réussis répartis entre plusieurs runs constituent une **preuve composite**, pas une campagne fraîche 6/6.

Une preuve antérieure peut être réutilisée si les changements ultérieurs laissent le comportement, les entrées et la configuration concernés inchangés, avec justification du périmètre dans la synthèse. Conserver son ancienne révision et son run : ne jamais les réétiqueter comme exécutés sur le nouveau head. Les cas affectés sont rejoués sur le candidat identifié ; un échec, une exclusion ou une absence de replay restent visibles. Les cinq cas de la sélection iOS ne qualifient pas le sixième cas vocal. Ne pas déduire un succès d’un code SDK seul, d’un test listé ou ignoré. Les parcours avec connexion utilisent des secrets gérés par TesterArmy. Depuis e2e 0.21.3, `app.screenshot()` et les captures d'assertion ou d'échec continuent après la saisie d'un secret, champs sécurisés masqués. Depuis e2e 0.22.0, le modèle reçoit aussi l'écran après la saisie : ces parcours n'appellent aucun modèle, et un parcours avec modèle qui se connecte doit utiliser un compte de test jetable.

Les manifestes, mots de passe, clés, jetons de contrôle, profils locaux, logs et artefacts restent hors Git. `expo.env` ne contient que la configuration publique client ; la clé service-role et le jeton de contrôle ne doivent jamais devenir des variables `EXPO_PUBLIC_*`. Les ports sont locaux et la pile ne vise aucun compte hébergé.

Après fermeture des runners, arrêter d’abord l’API (terminal B), puis le démarreur de pile (terminal A) avec Ctrl-C. Le démarreur détruit uniquement sa propre pile jetable et retire ses manifestes/profils privés. Ne pas arrêter une pile encore nécessaire à une reprise du binaire identifié.
