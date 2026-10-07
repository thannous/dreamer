# Noctalia sur iPhone : Xcode local et Tailscale

Objectif : modifier le code sur le Mac mini et voir les retouches sur l'iPhone
par Fast Refresh via Tailscale, puis produire une IPA autonome pour valider une
version. La compilation et la distribution n'utilisent pas EAS. Le projet
conserve ses dépendances React Native/Expo.

## Retouches en direct : Debug et Fast Refresh

Pour modifier un composant, sauvegarder sur le Mac et voir le résultat sur
l'iPhone, utiliser la version native **Debug**, reliée à Metro. L'IPA Release
autonome reste utile pour valider une étape et les performances. Elle ne doit
pas être reconstruite pour chaque retouche de texte ou de style.

Le projet existant charge déjà `.expo/.virtual-metro-entry` avec
`RCTBundleURLProvider` sous `#if DEBUG` dans `ios/Noctalia/AppDelegate.swift`.
Il inclut le client de développement dans sa configuration native ; il n'utilise
pas Expo Go. Aucun prebuild ni service EAS n'est nécessaire pour ce parcours.

Une compilation Debug est nécessaire à la première installation ou après un
changement natif. Exemple utilisé le 2 octobre 2026, avec l'équipe Apple déjà
configurée dans ce workspace et les compteurs locaux de ce test :

```sh
mkdir -p .tmp/ios-fast-refresh
mise exec -- xcodebuild -workspace ios/Noctalia.xcworkspace -scheme Noctalia -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath .tmp/ios-fast-refresh/DerivedData CODE_SIGN_STYLE=Automatic MARKETING_VERSION=3.4.9 CURRENT_PROJECT_VERSION=16 build > .tmp/ios-fast-refresh/build.log 2>&1
xcrun devicectl device install app --device '<nom appareil>' .tmp/ios-fast-refresh/DerivedData/Build/Products/Debug-iphoneos/Noctalia.app
```

Remplacer `<nom appareil>` par le nom retourné par `xcrun devicectl list devices`.
Les commandes utilisent le répertoire iOS existant ; aucun prebuild n'est lancé.
`ios:local:build` archive en **Release** et sert au parcours IPA décrit plus bas.

Ensuite, pour les retouches quotidiennes, lancer uniquement le serveur avec le
script canonique :

```sh
EXPO_PACKAGER_PROXY_URL=https://timax.tailf6d315.ts.net:9443 mise exec -- npm run start:mock -- --dev-client --lan --port 8086
```

Le port 8086 a été choisi pour ce test afin de préserver les autres serveurs
ouverts sur ce Mac. `--lan` permet à Metro d'écouter aussi en IPv4 :
`--localhost` écoutait seulement sur `::1`, ce qui produisait une réponse 502
avec le relais Tailscale ciblant `127.0.0.1`. L'URL de proxy est validée avec
le CLI installé ; la revérifier lors d'une mise à jour du SDK.

Le relais de développement est privé et distinct du portail IPA sur 8443 :

```sh
TAILSCALE_BE_CLI=1 /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --https=9443 --yes http://127.0.0.1:8086
```

Lire `serve status --json` avant cette commande ; préserver une configuration
existante sur le même port et ne pas activer Funnel. Metro doit rester ouvert
sur le Mac et Tailscale connecté sur les deux appareils. La page, le manifeste,
les assets et les WebSockets utilisent la même adresse HTTPS privée.

Ouvrir la connexion dans la version native installée :

```sh
xcrun devicectl device process launch --device '<nom appareil>' --payload-url 'exp+noctalia://expo-development-client/?url=https%3A%2F%2Ftimax.tailf6d315.ts.net%3A9443' com.tanuki75.noctalia
```

L'iPhone doit être associé, joignable et déverrouillé pour cette commande.
Au premier lancement, fermer la présentation puis le menu développeur avec sa
croix. Fast Refresh doit être activé. Les modifications de composants, styles
et textes arrivent depuis Metro ; les changements de code natif ou de
dépendances natives nécessitent une nouvelle compilation Debug.

Le profil `start:mock` utilisé ici simule les services métier ; le test ne
qualifie pas le backend réel. Au quotidien : laisser cette version de Noctalia
ouverte, modifier le fichier dans le dépôt sur le Mac, puis sauvegarder.
Le terminal Metro reste actif ; aucune commande de compilation ou d'installation
n'est nécessaire pour ces retouches.

## Test réel du 2 octobre 2026

| Contrôle | Résultat |
| --- | --- |
| Signature Debug et installation 3.4.9 (16) | Confirmées sur l'iPhone |
| Manifeste et bundle | Adresse HTTPS privée sur 9443, routeur Dreamer `app/`, moteur Hermes |
| Canaux `/hot` et `/message` | Handshake WebSocket TLS réussi via le relais ; client iPhone observé par Metro |
| Sauvegarde sur le Mac | Le libellé `Raconter` a été remplacé temporairement par `Raconter · DIRECT` |
| Résultat sur l'iPhone | Confirmé par l'utilisateur et une capture physique, sans Reload ni nouvelle installation |
| Retour au texte normal | Source originale restaurée exactement ; `Raconter` observé à nouveau sur l'iPhone |
| Processus natif | Identique avant et après l'arrivée du marqueur |

La preuve valide le cycle **modifier → sauvegarder → voir sur cet iPhone**.
Elle ne mesure pas la latence exacte ni les performances Release. La source
temporaire n'est pas conservée dans l'app. Aucune donnée de l'app n'a été copiée,
aucune désinstallation ni réinitialisation n'a été effectuée pour ce test.

Pour refaire ce contrôle, modifier temporairement un libellé visible dans
`app/onboarding.tsx`, sauvegarder, constater son arrivée sans Reload, puis
restaurer le texte et vérifier son retour. Conserver les captures avant/après et
l'identité du binaire dans les preuves privées.

Le candidat local du test est **3.4.9 (16), Debug**, installé sans désinstallation
ni réinitialisation. La version **3.4.9 (15), Release** reste disponible sur le
portail IPA. Ces compteurs locaux ne modifient pas les compteurs Store/EAS.
L'état et les captures du test sont dans `.tmp/ios-fast-refresh/`, ignoré par Git.

Références : [Fast Refresh, React Native](https://reactnative.dev/docs/fast-refresh)
et [utiliser un client de développement](https://docs.expo.dev/develop/development-builds/use-development-builds/).

## Parcours

1. Xcode compile le projet natif **existant** `ios/Noctalia.xcworkspace`, en Release
   pour embarquer le JavaScript et les assets. Les mises à jour JavaScript distantes
   sont désactivées dans la configuration native locale ; le lanceur vérifie aussi
   cette configuration dans l'IPA exportée. Aucun prebuild n'est exécuté.
2. Xcode exporte une IPA avec une signature de développement et un profil qui
   inclut l'iPhone enregistré (`method=debugging`, anciennement `development`).
3. Xcode génère le manifeste avec la version de l'app et la plateforme iOS.
   Le lanceur vérifie sa correspondance avec le binaire, la signature, le profil,
   sa validité et l'identité Noctalia, puis prépare une page privée et l'icône.
4. Un serveur sur localhost est accessible en HTTPS via **Tailscale Serve**.
   Sur l'iPhone connecté à Tailscale, Safari ouvre la page et l'utilisateur
   confirme l'installation via `itms-services`.
5. Xcode/CoreDevice peut lancer l'app sur un iPhone associé, déverrouillé et
   accessible. Le réseau Tailscale seul ne garantit pas cette connexion CoreDevice.

Une IPA de développement nécessite le mode développeur iOS. Pour une distribution
ad hoc, Apple exige un certificat de distribution et les appareils enregistrés ;
Xcode 27 nomme ce mode `release-testing`. Une IPA App Store/TestFlight n'est pas
un substitut au profil de développement/ad hoc.

## Commandes

Sur ce Mac, l'équipe est configurée dans le projet natif ignoré par Git et
`ios/.xcode.env.local` utilise le Node épinglé par `mise`. Les réglages précédents
sont conservés sous `.tmp/ios-local-ota/setup/`. L'archive utilise son propre
répertoire DerivedData afin de ne pas réutiliser un module Xcode créé avec des
headers absents. Après une réinstallation des dépendances JavaScript, préparer
les Pods existants avant de compiler : leurs fichiers générés peuvent avoir disparu
même si `Podfile.lock` et `Pods/Manifest.lock` correspondent.

```sh
mise exec -- npm run ios:local:check
mise exec -- npm run ios:ota:serve
```

`check` lit la disponibilité native, les identités de signature et le réseau.
`serve` n'installe rien sur le téléphone. Sans IPA validée, la page indique
qu'aucun binaire n'est disponible et ne présente aucun lien d'installation.
Le serveur reste en premier plan ; sa redirection HTTPS privée est sur le port
8443 et son serveur local sur 8765. Une configuration existante incompatible
ou une exposition Funnel sur ce port provoque un refus.

Une fois le compte Apple et la signature locale configurés dans Xcode et l'iPhone
enregistré :

```sh
mise exec -- npm run ios:local:build -- --team <TEAM_ID> --device '<nom de l iPhone>'
```

Pour une mise à jour locale, annoncer une version et un build supérieurs à ceux
déjà installés évite le candidat identique signalé « déjà installé » par iOS.
Les options `--version X.Y.Z --build-number N` s'appliquent à l'archive locale ;
elles ne changent pas les versions dans les sources ni les compteurs Store/EAS.
`ios/Noctalia/Info.plist` doit référencer `$(MARKETING_VERSION)` et
`$(CURRENT_PROJECT_VERSION)` pour les prendre en compte. Le lanceur vérifie les
valeurs réellement exportées avant publication. Le candidat IPA disponible au dernier contrôle est
**3.4.9 (15), Release**. Relire la version effectivement installée sur l'iPhone avant de
préparer la prochaine mise à jour locale et choisir des numéros supérieurs.

Cette commande archive et exporte localement, puis prépare les fichiers OTA.
Elle ne lance pas d'installation. Par défaut, les profils nécessaires
doivent déjà être disponibles. Lors de la configuration Apple explicitement
autorisée, ajouter `--provision` permet à Xcode de créer ou actualiser les profils
de signature via `-allowProvisioningUpdates`. L'enregistrement automatique
d'appareils n'est pas activé. Les logs, archives, IPA, profils extraits et
preuves restent sous `.tmp/ios-local-ota/`, ignoré par Git.

Pour lancer uniquement la version **déjà installée**, sur un iPhone associé et
déverrouillé :

```sh
mise exec -- npm run ios:local:launch -- --device '<nom de l iPhone>'
```

La mise à jour du 2 octobre a été appliquée par CoreDevice sur sa connexion
`localNetwork`, puis lancée avec cette commande. Cette connexion Xcode sans câble
requiert l'association et l'accessibilité du téléphone ; elle n'est pas une preuve
de transfert de l'IPA par le portail HTTPS Tailscale. En cas de refus du portail,
la commande native vérifiée est `xcrun devicectl device install app --device
'<nom de l iPhone>' '<chemin du .app vérifié extrait de l IPA>'`, après les
vérifications d'identité décrites ici. Elle conserve le bundle Noctalia et
ne nécessite pas de désinstallation.

Ne pas assimiler cette action à l'installation du candidat. Relever la version
installée et vérifier le résultat sur l'écran avant de qualifier la livraison.
Avant une mise à jour de l'app existante, vérifier les identités de signature et
de bundle. Une copie complète des données n'est pas un préalable aux tests
locaux d'interface. Ne pas désinstaller ou effacer l'app pour résoudre une
incompatibilité de signature sans en comprendre la cause.

Lorsqu'une sauvegarde de données est explicitement demandée, la copie locale
utilise `devicectl device copy from` sur le domaine
`appDataContainer`. Vérifier le nombre et les tailles des fichiers copiés ainsi
que `PRAGMA quick_check` sur les bases sauvegardées. Le transfert inverse utilise
`devicectl device copy to`, le même domaine/bundle et
`--remove-existing-content false`, app arrêtée. Un aller-retour sur le domaine
temporaire CoreDevice permet de vérifier la copie d'un répertoire sans toucher
au journal. La sauvegarde du conteneur ne comprend pas le trousseau iOS et ce
contrôle ne simule pas une restauration complète des données de l'app.

Pour arrêter : Ctrl+C ferme le serveur local. La redirection Serve persiste.
Pour retirer uniquement celle-ci sur le Mac :

```sh
TAILSCALE_BE_CLI=1 /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=8443 off
```

L'activation HTTPS du réseau Tailscale peut demander une action dans son interface
d'administration. Le lanceur affiche le lien officiel si Tailscale le demande.

## Validation et limites

Avant implémentation, les pannes retenues pour l'exception de tests en isolation
sont : compilation lancée malgré l'absence de signature ; manifeste pointant
vers une URL non HTTPS ; binaire appartenant à une autre app ; profil expiré ou
App Store, ou n'incluant pas le téléphone ; redirection d'un autre service écrasée ;
réutilisation d'un port Funnel public ; compteur de build utilisé à la place de la
version dans le manifeste Xcode d'installation ; candidat local configuré pour remplacer
son JavaScript embarqué par une mise à jour distante. Les E2E mobiles existants n'observent pas
les profils Apple, le CLI de compilation ou le serveur d'installation hôte.
Les tests précèdent le code et ne qualifient pas une installation iOS.

Le contrôle HTTP réel doit relever la révision, les fichiers du lanceur, les
commandes, les routes, les statuts et la configuration Serve. L'installation
et le lancement sur l'iPhone constituent une preuve séparée. Un serveur joignable
ou une archive exportée ne prouve pas que l'app fonctionne sur le téléphone.

## Sources vérifiées le 2 octobre 2026

- [Apple : distribution aux appareils enregistrés](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [Apple : profil ad hoc](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile)
- [Apple : manifeste et installation HTTPS](https://support.apple.com/fr-fr/guide/deployment/depce7cefc4d/web)
- [Apple : association et exécution sans câble](https://developer.apple.com/documentation/xcode/pairing-your-devices-with-your-mac)
- [Apple : certificat intermédiaire WWDR](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates)
- [Apple : outils Xcode et CoreDevice](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference)
- [Tailscale Serve et ses limites macOS](https://tailscale.com/docs/features/tailscale-serve)
- Contrat local Xcode 27 : `xcodebuild -help`, clés `manifest` et `method`.

Le document Apple sur le manifeste décrit les apps internes d'entreprise.
Son application au profil de développement de ce projet s'appuie aussi sur le
contrat d'export non App Store de Xcode 27 et sur le test Safari réussi sur cet
iPhone. Ce résultat reste limité au candidat, au profil et à l'appareil vérifiés.

## Handoff du 2 octobre 2026

Intégration : propriétaire de ce chat. Périmètre autorisé : préparation locale
Xcode/Tailscale et lancement sur l'iPhone ; aucun build EAS ou envoi Store.

- Xcode 27 et projet natif existant présents ; pods installés. Compte Apple existant
  utilisé, certificat Apple Development créé sur ce Mac, chaîne WWDR G3 complétée,
  identité de signature valide. Profil de développement incluant l'iPhone et ce
  certificat confirmé. Équipe native et Node `mise` configurés localement.
- iPhone physique iOS 27.0.1 associé, mode développeur activé. Noctalia
  `com.tanuki75.noctalia`, version 3.4.5, build 11 installé avant préparation. Révision source,
  runtime OTA, signature et origine exacte de ce binaire : inconnus.
- Lancement initial de cet ancien binaire confirmé par CoreDevice. Ouverture de
  la page privée prête dans Safari confirmée ; requête HTTP iPhone 200 observée.
- HTTPS Tailscale activé par l'utilisateur ; redirection privée 8443 → localhost
  8765 observée, aucune exposition Funnel dans la configuration Serve relevée.
- Archive et export locaux réussis : Noctalia 3.4.6 (12), JavaScript embarqué,
  mises à jour distantes désactivées dans l'IPA, signature et profil vérifiés.
  La page offre maintenant le lien d'installation du candidat validé.
- Six tests ciblés et lint réussis. Neuf assertions HTTP réelles réussies : page,
  état et HEAD 200 ; POST 405 ; chemin privé et IPA inexistante 404 ; manifeste
  et IPA 200, icône PNG 200. Le téléchargement HTTPS complet correspond au SHA-256 de l'IPA
  signée. Le rapport privé donne la commande exacte de répétition.
- Sauvegarde privée complète du conteneur : 49 fichiers, quatre bases SQLite
  avec `quick_check` réussi. Nombre et tailles comparés à l'inventaire de l'iPhone.
  Copie aller-retour d'un répertoire témoin CoreDevice validée ; aucune restauration
  des données réelles ni export du trousseau iOS effectué.
- Preuves privées : `.tmp/ios-local-ota/verification.json` et `requests.jsonl`.
  Le rapport identifie le HEAD, les empreintes des fichiers du lanceur, l'environnement,
  les préconditions, les commandes et les résultats ; les captures Apple restent privées.
- Les deux échecs d'archive provenaient de fichiers SQLite générés absents puis
  d'un module Xcode en cache. CocoaPods avec les versions verrouillées a régénéré
  les fichiers ; un import Swift avec cache neuf a vérifié les symboles, puis
  l'archive a réussi dans un DerivedData isolé. Stades, erreurs et conditions
  corrigées sont conservés dans les preuves privées.
- Première tentative OTA : l'iPhone a reçu le manifeste, puis a signalé un échec
  avant de demander l'IPA. L'app installée conserve son répertoire binaire initial ;
  aucune suppression effectuée. Le manifeste manuel utilisait incorrectement le
  build 11. Une exportation comparative de Xcode annonce la version 3.4.5 et la
  plateforme iOS. Le workflow utilise désormais ce manifeste natif et publie aussi
  l'icône ; le contrôle de régression refuse le compteur de build dans ce champ.
  Le candidat corrigé a été réexporté depuis l'archive déjà vérifiée, sans nouvelle
  compilation ni modification des compteurs EAS/Store.
- L'utilisateur a ensuite précisé « Noctalia déjà installé » : l'app et le candidat
  portaient encore les mêmes numéros 3.4.5 (11). Les versions littérales du fichier
  natif ont empêché une première tentative de changement ; le contrôle d'identité
  a refusé cet export avant publication. Le fichier natif utilise maintenant les
  variables Xcode, et la nouvelle archive 3.4.6 (12) est vérifiée.
- Mise à jour physique effectuée par CoreDevice via `localNetwork`, sans
  désinstallation ; version 3.4.6 et build 12 relus sur l'iPhone. App lancée,
  processus Noctalia observé. Les 43 fichiers de sauvegarde hors caches modifiés
  sont identiques avant le premier lancement. Quatre images SplashBoard ont été
  supprimées par iOS et deux fichiers SQLite de mémoire partagée ont changé.
  Les données persistantes comparées restent intactes.
- Cette première livraison confirme le lancement sans câble via CoreDevice.
  L'installation par Safari/Tailscale est vérifiée séparément dans le test suivant.
- Au début du test Safari suivant, CoreDevice relève de nouveau 3.4.5 (11) sur
  l'iPhone ; l'origine de ce changement n'est pas établie. Le candidat 3.4.6 (12)
  est conservé. Nouvelle sauvegarde de 50 fichiers, inventaire distant concordant
  et quatre bases SQLite valides. Neuf assertions HTTPS passent, signature valide,
  page 3.4.6 (12) observée dans Safari sur l'iPhone. Après confirmation dans Safari,
  l'iPhone reçoit le manifeste, les icônes et l'IPA de cette release immuable avec
  des réponses 200. Version 3.4.6 (12) relue après installation, nouveau répertoire
  binaire observé, bundle Noctalia conservé. Aucun transfert d'app par CoreDevice
  n'est effectué pendant cette tentative. Les 44 fichiers hors instantanés iOS
  et mémoire partagée des caches sont identiques avant le premier lancement ;
  les quatre bases SQLite sont valides. L'app est ensuite lancée par CoreDevice,
  processus actif et écran d'accueil initial visible. L'installation OTA et le
  lancement sont qualifiés ; les parcours métier et l'état du compte ne le sont
  pas par ce test. Les requêtes identifient maintenant la release immuable pour
  distinguer un ancien lien d'installation du candidat courant. Rapport privé :
  `.tmp/ios-local-ota/safari-tests/2026-10-02T12-09-06Z/result.json`.

Ces preuves concernent la signature locale, le candidat exporté, le service, la
mise à jour et le lancement sans câble du nouveau binaire sur l'iPhone. Les changements du lanceur restent
locaux, non commités. Les identifiants et adresses de l'appareil ne sont pas
reproduits dans ce handoff suivi par Git.
