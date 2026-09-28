# Synchronisation des numéros de build Noctalia

EAS reste la référence des compteurs Android et iOS. Le dépôt et les projets natifs
générés en conservent une copie synchronisée ; la version produit reste préparée
par le processus de release existant. Les deux plateformes ont leurs propres compteurs.

## Utilisation

```sh
npm run release:versions:sync
npm run release:versions:check
```

Les commandes lisent les compteurs du profil EAS `production` de Noctalia. La première
met à jour `app.json` et les projets natifs existants ; la seconde échoue en cas
d'écart sans écrire. Ajouter `-- --platform android` ou `-- --platform ios` pour
limiter la vérification ou la synchronisation. Elles ne créent aucun projet natif,
ne lancent aucun build et ne modifient ni EAS ni les stores.

La synchronisation est également exécutée :

- avant les compilations Noctalia via `npm run android`, `npm run ios` et
  `npm run android:release:local`, y compris avec un projet Android réutilisé ;
- au retour de `npm run release:build -- --app noctalia --platform android|ios`,
  même si le build a échoué après avoir consommé un numéro.

Les démarrages Metro restent utilisables hors ligne. Les compilations natives
Noctalia nécessitent l'accès EAS pour vérifier leur numéro. En cas d'échec de
synchronisation après un build, relancer uniquement la synchronisation et vérifier
le build déjà créé avant d'en demander un nouveau.

Un build lancé directement depuis EAS ou une autre machine ne peut pas actualiser
ce checkout immédiatement : exécuter `release:versions:sync` pour en récupérer
le compteur. Les fichiers natifs générés restent ignorés par Git ; conserver les
changements de compteurs dans `app.json` avec les métadonnées de livraison.
Le contrôle de propreté autorise uniquement ce delta de compteurs non stagé lors
d'une livraison, pour pouvoir enchaîner Android et iOS. Les autres changements
locaux restent bloquants.

## Comparaison avec les stores

Comparer le même artefact et la même piste de distribution. Le compteur EAS peut
avancer pour un build en préparation ou échoué, alors que Play conserve le dernier
build publié. Synchroniser les fichiers locaux ne publie pas ce nouveau build.
Ne pas diminuer le compteur EAS, ni changer un numéro pour faire croire à une
publication. La disponibilité en production demande sa propre vérification.

Deux binaires portant le même numéro peuvent avoir un code ou une signature
différents. Conserver aussi le SHA, l'identifiant EAS et la provenance d'installation
dans les preuves QA. Le compteur iOS n'a pas à être égal au compteur Android.

## Risques et validation prévus avant implémentation

Les E2E de l'application ne détectent pas une configuration de compilation périmée.
Des tests d'intégration du script, sur des fichiers temporaires et avec uniquement
la réponse du service EAS simulée, couvrent ces cas avant implémentation :

- ancien numéro dans `app.json`, Gradle ou les métadonnées Xcode ;
- absence de projet natif : mettre à jour la configuration sans lancer de prebuild ;
- panne EAS, réponse manquante/invalide ou compteur inférieur : arrêter sans écrire ;
- projet natif d'une autre application : refuser sans modifier ses fichiers ;
- contrôle sans écriture et seconde synchronisation sans modification superflue ;
- modification concurrente pendant la lecture distante : ne pas l'écraser ;
- numéro synchronisé après une compilation : permettre la plateforme suivante sans
  assouplir le contrôle des autres modifications locales ;
- compteurs committés après un build iOS : ne pas exiger une nouvelle compilation
  pour ce seul changement, tout en rejetant les vrais changements de configuration.

La validation réelle compare ensuite la réponse EAS avec les fichiers locaux.
Elle ne constitue ni une compilation ni une qualification sur téléphone.

Commande reproductible des tests concernés :

```sh
npm run test:file -- scripts/sync-mobile-build-versions.test.js scripts/mobile-release.test.js scripts/expo-safe-runner.test.js scripts/build-android-release-local.test.js --watchman=false
```

Le rapport de vérification réel reste dans `dogfood-output/`, hors dépôt.
Référence : [gestion des versions Expo](https://docs.expo.dev/build-reference/app-versions/).
