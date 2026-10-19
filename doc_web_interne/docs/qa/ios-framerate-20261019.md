# Fluidité iOS — préparation du 19 octobre 2026

Objectif : réduire les saccades du journal, de la lecture et des changements de
page, en conservant les gestes, la parallaxe, les animations utiles et les contrôles.
Cette préparation reprend **toute la PR #439 fusionnée**, depuis
`0b74eac878896a2de814e1f5a78226cb236a797d`. Les résultats physiques précédents
restent dans [leur rapport](native-performance-20261018.md) ; ils ne sont pas des
mesures de ce nouveau correctif.

## Correctif préparé

Le `ScrollView` du détail livrait chaque événement de défilement au runtime
JavaScript : publication de l’offset au header et à la parallaxe, mise à jour du
dernier offset et appel du setter React du dock, même lorsque sa visibilité ne
changeait pas. C’est du travail continu évitable ; son coût FPS reste à mesurer.

Sur natif, `Animated.ScrollView` et `useAnimatedScrollHandler` publient directement
les offsets sur le thread UI. La réaction animée appelle JavaScript uniquement
lorsque le seuil de visibilité du dock change. Les rares lectures d’offset pour
révéler une interprétation ou ancrer une illustration restent à jour. Le chemin
web et ses événements de fin de défilement sont conservés.

Les durées, la parallaxe, le papier, les pages voisines et les cibles tactiles sont
conservés. `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS` reste désactivé : son activation
avait fait rater le toucher de la langue dans le tiroir, avec un avant/après
[déjà reproduit](native-testerarmy-qualification-20261006.md#reproduced-corrections).
Le parcours natif ajouté vérifie le dock d’un rêve non analysé avec une illustration
locale, puis son retour interactif. La référence textuelle 013 ne couvre pas ce seuil.

## Référence et environnement

- Nouveau simulateur iPhone 17 dédié, iOS 27.0, sans compte ni données personnelles.
- Release embarquée depuis `0b74eac87`, mises à jour distantes désactivées,
  signature non requise sur ce simulateur. Projet natif isolé existant réutilisé.
- Métadonnées natives générées : **1.0 (1)** ; manifeste applicatif 3.6.0. Ce binaire
  local sert uniquement à la comparaison, sans équivalence Store ou compteur EAS.
- SHA-256 de la référence archivée :
  `ea0fc1854663f286654207ad1ab7b94dde683706db2f96ad20d1515e3e099f2f`.
  JavaScript embarqué :
  `63289c8302692a4e76e9514c2269f43d47921bb62c7b19f2d483847a46df8ad7`.
  Identité installée comparée : concordante.
- SQLite invitée : 200 rêves synthétiques, 29 illustrations locales, aucune
  session copiée et aucune écriture serveur. La variante `framerate` comprend le
  rêve 002 non analysé et un long récit permettant de vérifier le dock.

Le premier contrôle Expo en ligne recommande onze mises à jour de maintenance.
La référence conserve Expo 58.0.14, RN 0.88.0 et Reanimated 4.7.1. Leur compatibilité
est contrôlée avec la carte `expo/bundledNativeModules.json` installée
(`EXPO_OFFLINE=1 expo install --check`), sans désactiver ce contrôle ni ajouter
d’exclusions. Cela ne vaut pas validation des recommandations Expo les plus récentes.

## Blocage et état des preuves

Xcode 27.1 (27A9275) attend CoreSimulator **1174.9.2** ; le composant système
installé est **1171.7.0**. `xcodebuild -checkFirstLaunchStatus` renvoie 69.
La destination du simulateur est refusée par `DVTCoreSimulatorAdditionsErrorDomain 3`.
La compilation pour la destination générique iOS Simulator réussit ; elle ne
résout pas l’exécution des tests XCTest sur un appareil nommé.

Le paquet Apple `XcodeSystemResources.pkg` fourni avec Xcode est signé et vérifié.
Son installation réclame l’autorisation administrateur du Mac. Le propriétaire
demande de poursuivre la préparation en attendant. Aucun changement global de
Xcode, de sécurité, ni arrêt d’une session étrangère n’a été effectué.

**FPS, P95 de frame, taux de frames manquées, interactions natives et absence de
régression sur appareil : non qualifiés pour ce correctif.** La compilation et
l’installation ne remplacent pas ces mesures. Aucun résultat manquant n’est un zéro.

## Protocole prêt à reprendre

Faire un pilote, puis cinq répétitions si la méthode livre des métriques attribuables
à l’app. Même simulateur, même fixture, même version d’outils et même séquence :
défilement du journal illustré, détail illustré, changement de page engagé/annulé,
retour conservant la position. Aucune compilation en parallèle et aucun snapshot
d’accessibilité pendant la fenêtre mesurée : ces snapshots dominaient un ancien
profil CPU physique. Conserver la trace brute et les fenêtres réellement comparées.

Utiliser Animation Hitches et le profil CPU natif pour expliquer le résultat.
Une durée CPU ou un intervalle de callback ne prouve pas le framerate affiché.
Si les métriques de frame sont indisponibles sur simulateur, garder cette limite
et confirmer sur l’iPhone physique. Préserver les thèmes, Reduced Motion, le texte
agrandi, les boutons, les gestes et l’ancrage avant de retenir un gain.

Parcours précis, depuis `tools/e2e`, après vérification de la Release et préparation
de la fixture possédée :

```sh
E2E_OWNER_NATIVE_PERF_ACK=approved E2E_PERF_PLATFORM=ios \
  E2E_PERF_DEVICE=Noctalia_Framerate_QA E2E_PERF_FIXTURE_UI=framerate \
  E2E_OUTPUT=/private/tmp/noctalia-ios-framerate-20261019/native-candidate \
  mise exec -- npx e2e run --config e2e.native-performance.config.ts
```

Les reçus de build, de fixture, d’installation, la proposition relue et les logs
restent dans le dossier privé local de cette campagne. Les résultats de validation
et le candidat compilé seront précisés après leur achèvement. Aucun déploiement,
build EAS, soumission Store ou changement du compte de développement.
