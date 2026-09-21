# TI-602 — Identité du runtime Android exécuté

## Périmètre et état au 21 septembre 2026

Diagnostic préparé pour le Journal Noctalia Android, package de base
`com.tanuki75.noctalia`. Base source : `a00dbf3eb`. Le changement préexistant de
`components/analysis/AnalysisReadingModal.tsx` sur master est exclu.

**La preuve Motorola / Play reste à obtenir.** ADB ne voit aucun appareil ; la
connexion à l’adresse de débogage fournie échoue avec `No route to host`, y compris
hors sandbox. Aucun démarrage, arrêt, remplacement d’application, effacement,
publication OTA, build EAS ou soumission Store n’a été effectué.

Le ticket conserve son état en cours tant que l’identité du runtime effectivement
exécuté sur une installation Play vérifiée n’est pas relevée. Les anciennes valeurs
Play 65 du ticket ne sont pas présentées comme celles de l’installation actuelle.

## Diagnostic préparé

Le premier montage du layout Journal Android charge paresseusement
`lib/runtimeIdentity.ts`. Une seule ligne `[NoctaliaRuntime]` est émise par runtime
JavaScript, y compris en release. Un remontage ne produit pas une nouvelle preuve
de démarrage. Un rechargement JS peut produire une nouvelle ligne : seul le
protocole avec arrêt/redémarrage du processus établit le démarrage à froid.

La ligne contient uniquement : version de schéma, heure d’observation UTC,
identifiant d’application, version/build natifs, mode développement, activation
Expo Updates, `updateId`, `runtimeVersion`, `isEmbeddedLaunch`, origine du lancement,
indicateur de lancement de secours et canal configuré.

- `updateId` vient de l’update en cours d’exécution, jamais d’un manifeste téléchargé.
- La version et le build viennent d’`expo-application`, sans repli sur `app.json`.
- `launchSource` vaut `embedded` ou `ota` seulement hors développement, avec Updates
  actif, un identifiant et un runtime non vides. Sinon il vaut `unknown` : le `false`
  par défaut d’Expo ne prouve pas un lancement OTA.
- `isEmergencyLaunch` garde la preuve d’un éventuel repli, sans son message d’erreur.
- Le canal est une configuration de build, pas la preuve qu’une mise à jour est disponible.

Aucun manifeste, compte, identifiant d’appareil, récit, brouillon, URL, jeton ou
message d’erreur n’est sérialisé. Aucun accès au stockage applicatif, requête réseau,
vérification/téléchargement de mise à jour ou rechargement n’est ajouté. Le
chargement et la journalisation sont sans effet bloquant sur la navigation. Les
branches web/iOS/Lucid ne chargent pas ce diagnostic.

Contrats vérifiés dans la dépendance installée `expo-updates` et la
[documentation officielle Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/).
La dépendance React Native conserve le pont console vers les logs natifs en release ;
sa visibilité effective sur le binaire Play reste à vérifier.

## Protocole Motorola / Play

1. Connecter le Motorola et sélectionner son transport ADB courant. Employer le
   verrou `scripts/android-device-lock.js wrap --owner dreamer --device ...` pendant
   les opérations sur l’appareil. Ne pas voler un verrou détenu par une autre tâche.
2. Vérifier modèle/OS, package, versionCode, installateur Play (`com.android.vending`)
   et certificat de l’APK installé. `npm run android:play-qa-device -- --device ...`
   fournit la première vérification ; compléter par le certificat SHA-256 de l’APK
   effectivement installé. Ne pas déduire la provenance Play de la seule version.
3. Vérifier que toute saisie en cours est sauvegardée avant le démarrage à froid.
   Ne pas fermer brutalement une dictée ou une saisie non persistée.
4. Sous le verrou, relever l’heure du téléphone, arrêter uniquement le package de
   base, confirmer l’absence de PID, puis lancer son activité principale résolue
   depuis le package installé. Aucun lien profond de diagnostic n’est ajouté.
5. Relever le nouveau PID, puis ne conserver que la ligne JSON `[NoctaliaRuntime]`
   de ce PID, postérieure à l’heure de départ. Exemple de lecture après lancement :

```sh
# Variables renseignées à partir de l’appareil et du démarrage observés.
# TI602_START : heure du téléphone avant l’arrêt, format MM-DD HH:MM:SS.000.
# TI602_PID : résultat non vide de adb -s "$TI602_DEVICE" shell pidof com.tanuki75.noctalia.
adb -s "$TI602_DEVICE" logcat -d -v threadtime --pid="$TI602_PID" -T "$TI602_START" 'ReactNativeJS:I' '*:S' |
  sed -n 's/^.*ReactNativeJS *: \(\[NoctaliaRuntime\] {.*}\)$/\1/p'
```

6. Vérifier que `applicationId`, version et build correspondent au package inspecté,
   `development=false`, `updatesEnabled=true`, et que `updateId`/`runtimeVersion`
   sont renseignés. Conserver le PID et la fenêtre temporelle séparément comme
   contexte du démarrage. `unknown`, aucune ligne ou plusieurs runtimes inattendus
   dans la même fenêtre ne constituent pas une qualification réussie.
7. Comparer séparément la configuration native et le manifeste embarqué si nécessaire.
   Une mise à jour disponible ou `NoUpdatesAvailable` ne remplace jamais les valeurs
   observées du runtime chargé. Consigner la preuve expurgée dans TI-602.
8. Confirmer la préservation du compte, du journal et du brouillon, sans exporter
   leur contenu. Libérer uniquement le verrou de cette tâche.

Une version Play qui n’embarque pas ce diagnostic ne peut pas l’acquérir par une
simple commande ADB. Si les diagnostics existants ne suffisent pas, une livraison
autorisée séparément est nécessaire avant de rejouer ce protocole. Ne jamais
remplacer Play par un APK local pour simuler la preuve demandée.

## Validation locale

Les tests couvrent les origines embarquée/OTA, les cas indéterminés, le repli de
secours, l’absence de données privées et d’appels de mise à jour, l’unicité par runtime,
les versions natives indisponibles, l’échec de journalisation et l’intégration au
layout limitée au Journal Android. La qualification finale utilise
`npm run test:prepush` sur le worktree propre et commité ; les résultats sont
consignés dans la PR et le ticket. Cette validation locale ne vaut pas preuve Play.
