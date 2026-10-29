# Fastlane pour Noctalia iOS

Cette configuration concerne Dreamer/Noctalia (`com.tanuki75.noctalia`).
Les lanes appellent les lanceurs existants du dépôt avec le Node épinglé par
`mise`. Les signatures restent dans Xcode et les identifiants Store dans
`eas.json`. Aucun compte, certificat ou profil n'est créé par la configuration.

## Installation et premier contrôle

Depuis la racine du dépôt, avec Ruby géré par Homebrew ou votre gestionnaire :

```sh
bundle install
bundle exec fastlane lanes
bundle exec fastlane ios check
```

Si les gems Homebrew partagées ne sont pas inscriptibles, utiliser
`GEM_HOME="$(ruby -e 'print Gem.user_dir')" bundle install` : Ruby recherche
également les gems de ce dossier utilisateur. Ne pas utiliser `sudo`.

`Gemfile.lock` verrouille Fastlane et ses dépendances. Fastlane installé par
Homebrew peut aussi lancer ces lanes avec `fastlane ios check`.

| Commande | Résultat |
| --- | --- |
| `bundle exec fastlane ios check` | Vérifie Xcode et la cohérence des versions locales. |
| `bundle exec fastlane ios plan` | Affiche le plan de version des changements commités ; ne modifie rien. |
| `bundle exec fastlane ios release_check` | Vérifie le checkout propre et la préparation de version. |
| `bundle exec fastlane ios build team:… device:…` | Archive et exporte localement une IPA Release avec signature de développement. |
| `bundle exec fastlane ios testflight_check build_id:…` | Inspecte un build EAS terminé et l'historique des soumissions, sans envoyer. |
| `bundle exec fastlane ios testflight_upload build_id:…` | Envoie ce build précis sur TestFlight. |

## Compiler pour l'iPhone

Suivre les [prérequis de compilation locale](../doc_web_interne/docs/ios-local-tailscale-ota.md#commandes) :
projet natif existant et cohérent, Pods installés, signature Xcode, iPhone enregistré,
profil d'environnement iOS et Tailscale connecté. Le lanceur ne régénère pas le
projet natif et n'installe pas l'app sur le téléphone.

```sh
bundle exec fastlane ios build \
  team:APPLE_TEAM_ID \
  device:'nom de l’iPhone ou UDID' \
  profile:.env.ios.local
```

`team` et `device` peuvent aussi venir de `NOCTALIA_APPLE_TEAM_ID` et
`NOCTALIA_IOS_DEVICE`, exportées dans le shell. `profile` vaut `.env.ios.local`
par défaut ; les valeurs de ce fichier restent privées. Pour une version locale
distincte, fournir ensemble `version:X.Y.Z` et `build_number:N`.

Cette lane utilise `scripts/ios-local-ota.js` avec ses contrôles de configuration,
Pods, signature, profil et identité du binaire. Elle conserve ses artefacts sous
`.tmp/ios-local-ota/`. Cette IPA de développement sert au parcours iPhone local.

## Préparer puis envoyer sur TestFlight

Utiliser un build EAS existant, terminé, de profil `production` et de distribution
`STORE`. Les [règles de release et d'envoi](../doc_web_interne/docs/MOBILE_VERSIONING.md#envoyer-en-test-interne)
s'appliquent : checkout propre, version préparée, source compatible et autorisation
explicite pour l'envoi. L'authentification EAS existante est réutilisée.

```sh
bundle exec fastlane ios testflight_check build_id:UUID_DU_BUILD_EAS

# Seulement lorsque l'envoi TestFlight a été autorisé :
bundle exec fastlane ios testflight_upload build_id:UUID_DU_BUILD_EAS
```

Ces deux lanes appellent `scripts/mobile-release.js submit-internal` ; la première
ajoute `--dry-run`. Le lanceur vérifie le build distant, son projet, sa version,
sa plateforme, son commit et l'historique des soumissions avant tout envoi.
Il utilise l'app App Store Connect déjà déclarée dans `eas.json`, sans modifier
les groupes TestFlight. Aucune lane ne lance de build EAS ou de publication App Store.
Les paramètres inconnus sont refusés ; pour une vérification sans envoi, utiliser
la lane `testflight_check`.

Les rapports Fastlane restent dans `outputs/fastlane/`, ignoré par Git.
`FL_REPORT_PATH` permet de les diriger vers le dossier canonique d'une campagne.
Pour un build ou une campagne QA, appliquer les consignes de stockage
d'[AGENTS.md](../AGENTS.md) avant de produire les artefacts.
