# Données prêtes et accès réel à la lecture — 19 octobre 2026

## Résultat et périmètre

Suite de la PR #439, déjà commitée et poussée à `d2b22221b`. Master de départ `967fe81f0`, source finale de cette tranche `3cb1b5423`. Le checkout principal et ses modifications en cours sont préservés. Aucun build EAS, publication Store, fusion ou déploiement dans cette livraison.

Les corrections retirent les attentes décoratives du chemin d’accès au rêve et à son interprétation. La mesure fraîche est **web mock**, avec trois essais par variante : elle isole le client, pas la latence du fournisseur IA ni les performances physiques Android/iOS. Les mesures de mémoire et frames antérieures restent dans [le rapport natif](native-performance-20261018.md), avec leurs propres binaires et limites.

| Observation contrôlée, médiane de 3 essais | Avant | Après |
| --- | --- | --- |
| Sauvegarde confirmée → action visible, non recouverte | 9 442,5 ms, cérémonie puis « Plus tard » | 109,3 ms, appui immédiat sur « Voir mon rêve » |
| Texte inséré → opacité au moins 0,95 | 2 080,3 ms | Même frame échantillonnée, médiane 0 ms |
| Texte inséré → première ligne visible et hit test non recouvert | Pas de valeur valide : encore sous le dock à la fin des 3 relevés | 147,5 ms, plage 138,8–148,4 ms |
| Réponse observée → commit React du texte | 59,9 ms | 57,2 ms |

La première ligne utilise deux **parcours utilisateur différents** : le raccourci devient disponible immédiatement après la sauvegarde durable ; il est activé par le test. La cérémonie complète reste facultativement disponible et conserve son rythme. Aucun gain de 9 secondes n’est attribué au stockage ou au réseau. Trois essais ne constituent pas un P95 de production ; « même frame » ne signifie pas une latence matérielle nulle.

## Corrections livrées

- « Voir mon rêve » apparaît après `await addDream`, sans attendre le nom fourni par l’IA, la plume ou le plongeon. Un choix « lire maintenant » déjà donné est conservé ; un verrou empêche une seconde navigation, y compris après double appui.
- Le nom transmis, provisoire ou sans thème, ne redéclenche plus un second nommage. La motion réduite transmet aussi le nom local plutôt que d’attendre la catégorisation sur la page suivante.
- La page libère le voile une fois sa mise en page prête et deux frames écoulées. Le délai historique de 700 ms reste un garde-fou si le signal manque. Le callback est détaché après retrait du propriétaire.
- Les chapitres du texte sont immédiatement présents à opacité normale. Suppression du délai calculé depuis la dernière étoile et du stagger des chapitres ; la constellation conserve seule son animation.
- Le défilement vise le premier paragraphe, et non seulement le début de la constellation, pour l’amener au-dessus du dock. Aucun retour forcé vers le haut si la personne lit déjà plus bas. Le layout appartient à la requête d’analyse courante : un offset ancien ne peut pas être consommé lors d’une réanalyse.
- Le backfill des sujets attend la catégorisation propriétaire. Sa clé privilégie `clientRequestId` et reste stable quand la synchronisation ajoute `remoteId`, ce qui évite une requête IA concurrente à l’arrivée rapide.
- Le journal ne lance aucun préchargement hors focus. Une résolution déjà partie peut finir ; son résultat ne démarre plus de décodage/préchargement après le blur. Les fenêtres et caches restent bornés.

## Marqueurs et confidentialité

| Marqueurs | Frontière observée |
| --- | --- |
| `journal.save_requested` → `journal.save_acknowledged` | Appel puis résolution de la sauvegarde durable |
| `journal.saved_navigation_started` → `journal.saved_page_committed` → `journal.saved_actions_reveal_elapsed` | Navigation, commit React puis fenêtre de révélation du dock écoulée |
| `analysis.result_observed` → `analysis.text_committed` → `analysis.reveal_window_elapsed` | Réponse reçue, texte commité puis occasion de présenter une frame |
| `image.result_observed` → `image.reference_committed` → `image.source_resolved` → `image.native_displayed` | Référence reçue/publiée, URI résolue puis événement Expo Image |

`image.native_loaded` est aussi câblé sur la grande couverture ; les illustrations arrivant pendant la visite émettent `native_displayed`, pas une chaîne complète load→display. L’ancien `analysis.text_displayed` du contenu inline est remplacé, car un effet React pouvait précéder de plusieurs secondes la fin de son masquage.

Les deux requestAnimationFrame et les événements Image ne prouvent ni les pixels présentés ni la visibilité dans le viewport. Le relevé E2E ajoute opacité héritée, position de la première ligne et hit test DOM contre les panneaux qui la recouvrent, sans défilement ajouté par le test. Les captures ont été inspectées.

`EXPO_PUBLIC_PERFORMANCE_TRACING=true` active User Timing, console et l’appel optionnel `Observe.logEvent`. Les attributs Observe sont uniquement nombres finis et booléens : aucun texte de rêve, UUID, e-mail ou URI. La corrélation est opaque, bornée et locale au processus/session. Préférences de dispatch et exclusion de Lucid conservées. Aucun suivi global des requêtes ou URLs d’images ajouté. Sans le flag, aucun événement ni timer supplémentaire ; le module Observe est requis paresseusement. Une défaillance de télémétrie ne bloque pas la capture.

Le câblage est vérifié par les contrôles isolés et la compilation. Aucun nouvel upload Observe ni lecture de son stockage natif n’est revendiqué dans cette tranche.

## Preuves reproductibles

Environnement : SDK 58, Babel par défaut, Node 24.19.0, TesterArmy e2e 0.21.2, web 0.15.2, Playwright 1.64.0. Chromium, 390×844, motion normale, profil Plus mock, huit rêves prédéfinis puis un rêve synthétique. Analyse mock fixe de cinq secondes ; services réels bloqués. Metro chaud, un worker, aucun build natif pendant les répétitions retenues.

- **Avant, 3/3** : `tools/e2e/.e2e/dreamer-web/1792410503750-6884-1dcfdf96-fcc0-4d1e-802b-3a64443647f1`. Runtime `5b8908e3d`, avec seulement un testID ajouté au premier chapitre. Les six fichiers de runtime ont été rejoués de manière cohérente dans le même checkout puis restaurés octet pour octet ; manifeste et script privés dans `/private/tmp/noctalia-ready-to-ui-20261019/`.
- **Après, 3/3, sans builds concurrents** : `tools/e2e/.e2e/dreamer-web/1792410945637-10102-39ed5197-f22d-4ade-8996-b1cfadf39d3c`, tête `2ddd77cc1`, runtime `19562cc93`. Valeurs par essai dans les `readiness-timings.json`, synthèse privée `comparison-web.json`.
- **Dernier code `3cb1b5423`, 3/3 parcours** : `tools/e2e/.e2e/dreamer-web/1792411539282-12009-36016ad7-d1e8-4551-8efb-d58b92f43869`. Lecture sans masquage ni scroll du test, raccourci après choix Oui/double appui puis rêve unique et texte exact à la réouverture, motion réduite et édition accessibles. Les répétitions précédentes sont réutilisées uniquement pour les timings : les derniers correctifs ajoutent la protection du backfill et le chargement optionnel d’Observe, sans changer la chorégraphie mesurée.
- **198 contrôles ciblés passent** : routes capture/détail existantes, confidentialité Observe, annulation des marqueurs et handoff. Le contre-exemple décoratif du marqueur est conservé avec sa nouvelle sémantique « committed ». Types application/tests/runner et lint passent, avec avertissements préexistants.
- Revue indépendante de `d2b22221b..20b0a4369`, puis deltas `19562cc93` et `3cb1b5423` : offset ancien de réanalyse corrigé, aucun défaut bloquant restant.

Commandes depuis la racine, pour la tête après correction :

```sh
E2E_WEB_PORT=8106 E2E_WORKERS=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true TMPDIR=/private/tmp \
  mise exec -- npm run test:testerarmy -- run --grep 'ready reading becomes readable' --repeat-each 3
E2E_WEB_PORT=8106 E2E_WORKERS=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true TMPDIR=/private/tmp \
  mise exec -- npm run test:testerarmy -- run --grep 'ready reading becomes readable|capture shortcut preserves|reduced motion opens'
TMPDIR=/private/tmp mise exec -- npm run verify:pr
```

La preuve `verify:pr` et son commit exact sont enregistrés dans le corps de la PR #439 avant push. Les contrôles isolés supplémentaires couvrent des échecs difficiles à ordonnancer dans le parcours UI : handoff périmé/annulé/autre rêve, catégorisation pendant promotion distante, télémétrie indisponible ou payload privé. La corrélation des anciens callbacks de layout est couverte par la revue du delta et les parcours ; aucun ordonnancement artificiel d’événements natifs n’est présenté comme exécuté.

Essais exclus ou bornés : premier appel du runner sans sous-ordre `run` (aucun test lancé), assertion de longueur de texte mock erronée, premier relevé de visibilité sans hit test, replay interrompu car fichier de chronologie manquant, timings pendant builds concurrents. Le test de reload supposait à tort une persistance du journal mock : `saveDreams` y utilise volontairement la mémoire de session. L’assertion finale couvre l’unicité et la réouverture, **pas** la durabilité SQLite après redémarrage. Les échecs et reçus sont conservés dans le dossier privé ; aucun contrôle obligatoire affaibli.

## Android et iOS : frontière actuelle

Les deux builds Release locaux du code `3cb1b5423` réussissent :

| Plateforme | Identité locale | Empreinte |
| --- | --- | --- |
| Android arm64, profileable, non debuggable | 3.6.0(83), APK local, certificat fac61745… | APK SHA-256 `ee81f8dab74096397e7a97b3aa33e70c6a66edef092c75c30fd4d3d8989bb7d6` |
| iOS, Release signée localement, mises à jour désactivées dans le projet QA isolé | 3.6.0(18) | main.jsbundle SHA-256 `579477148e071824aa33d155a8837e92fddd5deb52776e0218dc818d61abd12b` |

Artefacts privés immuables : `/private/tmp/noctalia-ready-to-ui-20261019/candidate-android-source3cb1b5423/` et `candidate-ios-source3cb1b5423/`. Aucun compteur Store/EAS modifié. Les premiers builds du code `19562cc93` sont conservés séparément et ne servent pas d’identité au dernier correctif.

Reconstruction Android, avec Java 17 et Android SDK configurés :

```sh
mise exec -- npm run android:release:local -- --abi arm64-v8a --profileable --reuse-native-project
```

Reconstruction iOS : même workspace/scheme Release local que le [protocole natif](native-performance-20261018.md), `EXPO_NO_DOTENV=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true EXPO_PUBLIC_MOCK_MODE=false EXPO_NO_METRO_LAZY=1`, équipe de développement existante. Les logs `build-android-source3cb1.log` et `build-ios-source3cb1.log` sont conservés dans le dossier privé.

Les nouveaux binaires ne sont **pas installés ni qualifiés sur les téléphones** : Motorola joignable mais verrouillé ; tunnel de confiance iPhone indisponible (`CoreDevice 4016`). Le déverrouillage/rebranchement manuel a été demandé. Le contrôle automatique a refusé `wm dismiss-keyguard` pour son risque de franchissement de l’écran verrouillé ; aucune autre méthode de déverrouillage tentée. Session de diagnostic Android fermée, aucune nouvelle fixture physique ni suppression de compte.

Prochaine étape dès disponibilité : vérifier identité/signature de l’app installée et le compte de développement approuvé, installer la version compatible sans désinstallation/reset, piloter un seul parcours sauvegarde→raccourci→lecture, corréler les marqueurs et la capture native, puis répéter trois fois et vérifier la persistance après relance. Utiliser le protocole et la coordination des appareils du [rapport natif précédent](native-performance-20261018.md), avec la nouvelle identité de binaire. Une compilation ou un test mock ne remplace pas cette preuve.

## Leviers suivants, après mesure native

1. **Fin du job serveur → observation client** : polling analyse jusqu’à 15 s entre deux demandes, images jusqu’à 15 s. C’est une borne potentielle du code, pas une latence P95 mesurée. Piloter notification existante ou fenêtre de polling plus réactive uniquement au premier plan, avec pause en arrière-plan, reprise idempotente et nombre de requêtes/batterie mesurés.
2. **Référence d’image prête → décodage/présentation** : mesurer signature, lecture disque/réseau et événement Image sur les deux téléphones ; envisager ensuite redimensionnement précoce sur géométrie fixe. Ne pas activer de télémétrie globale d’URLs privées pour obtenir ce diagnostic.
3. **Persistance → premier contenu natif** : mesurer les nouveaux chemins avec les marqueurs installés avant d’ajouter cache, pagination ou suppression de polices. La publication optimiste avant commit SQLite n’est pas utilisée pour masquer un délai.

Noxcturnal reste un levier de bundling local, sans gain de performance utilisateur revendiqué ici. Aucun changement d’intervalle de polling, de stockage ou de fournisseur ajouté à l’aveugle.
