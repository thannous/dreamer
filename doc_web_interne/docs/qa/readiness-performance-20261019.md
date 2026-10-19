# Données prêtes et accès réel à la lecture — 19 octobre 2026

## Résultat et périmètre

Suite de la PR #439, précédemment poussée à `d2b22221b`. Master de départ `967fe81f0`, source finale de cette tranche `0648d74fa`. Le checkout principal et ses modifications en cours sont préservés. L’IPA locale est distribuée sur le portail privé Tailscale à la demande du propriétaire. Aucun build EAS, publication Store, fusion ou déploiement de production.

Les corrections retirent les attentes décoratives du chemin d’accès au rêve et à son interprétation. La comparaison principale est **web mock**, avec trois essais par variante : elle isole le client, pas la latence du fournisseur IA. Des pilotes Android et la preuve de persistance sur le dernier binaire la complètent plus bas. Les mesures de mémoire et frames antérieures restent dans [le rapport natif](native-performance-20261018.md), avec leurs propres binaires et limites.

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
- Après le handoff de capture, le récit, les détails, le rappel et le dock ne rejouent plus une seconde entrée. Le dock perd son délai de 120 ms et son fondu de 400 ms. Les arrivées sans handoff gardent leur comportement. Le marqueur de fin de révélation suit le même garde que le rendu.
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
- **Code intermédiaire `3cb1b5423`, 3/3 parcours** : `tools/e2e/.e2e/dreamer-web/1792411539282-12009-36016ad7-d1e8-4551-8efb-d58b92f43869`. Lecture sans masquage ni scroll du test, raccourci après choix Oui/double appui puis rêve unique et texte exact à la réouverture, motion réduite et édition accessibles. Les répétitions précédentes sont réutilisées uniquement pour les timings : les derniers correctifs ajoutent la protection du backfill et le chargement optionnel d’Observe, sans changer la chorégraphie mesurée.
- **Dernier delta, 3/3 parcours** : `tools/e2e/.e2e/dreamer-web/1792412794200-31206-b435037a-a00e-4699-b1d8-22e356e57d3f`, source `2d6890481` + delta devenu `0648d74fa`, manifestes début/fin conservés. Le récit atteint l’opacité normale en 0,1 ms échantillonnée et le dock dans la même frame, contre-exemple au second fondu. La première ligne d’interprétation devient lisible en 143,8 ms sur cet essai. Les médianes de trois essais ci-dessus restent attribuées à leurs sources ; le dernier delta ne change ni la constellation, ni le scroll mesuré, ni le raccourci initial.
- **198 contrôles ciblés passent** : routes capture/détail existantes, confidentialité Observe, annulation des marqueurs et handoff. Le contre-exemple décoratif du marqueur est conservé avec sa nouvelle sémantique « committed ». Types application/tests/runner et lint passent, avec avertissements préexistants.
- Revue indépendante de `d2b22221b..20b0a4369`, puis deltas `19562cc93`, `3cb1b5423`, adaptateur de focus `2d6890481` et suppression de la seconde entrée `0648d74fa` : offset ancien de réanalyse corrigé, aucun défaut bloquant restant. Le faux routeur représente une route focalisée ; il ne prouve pas le blur d’une route conservée montée.

Commandes depuis la racine, pour la tête après correction :

```sh
E2E_WEB_PORT=8106 E2E_WORKERS=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true TMPDIR=/private/tmp \
  mise exec -- npm run test:testerarmy -- run --grep 'ready reading becomes readable' --repeat-each 3
E2E_WEB_PORT=8106 E2E_WORKERS=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true TMPDIR=/private/tmp \
  mise exec -- npm run test:testerarmy -- run --grep 'ready reading becomes readable|capture shortcut preserves|reduced motion opens'
TMPDIR=/private/tmp mise exec -- npm run verify:pr
```

La preuve `verify:pr` et son commit exact sont enregistrés dans le corps de la PR #439 lors de sa mise à jour. Sur `0648d74fa`, le contrôle complet passe : 8 contrôles exécutés, 5 réutilisés à entrées identiques, 3 hors périmètre ; 2 219 tests Jest liés au diff passent, avec un test déjà ignoré. Les contrôles isolés supplémentaires couvrent des échecs difficiles à ordonnancer dans le parcours UI : handoff périmé/annulé/autre rêve, catégorisation pendant promotion distante, télémétrie indisponible ou payload privé. La corrélation des anciens callbacks de layout est couverte par la revue du delta et les parcours ; aucun ordonnancement artificiel d’événements natifs n’est présenté comme exécuté.

Essais exclus ou bornés : premier appel du runner sans sous-ordre `run` (aucun test lancé), assertion de longueur de texte mock erronée, premier relevé de visibilité sans hit test, replay interrompu car fichier de chronologie manquant, timings pendant builds concurrents. Le test de reload supposait à tort une persistance du journal mock : `saveDreams` y utilise volontairement la mémoire de session. L’assertion finale couvre l’unicité et la réouverture, **pas** la durabilité SQLite après redémarrage. Le premier contrôle complet a aussi révélé que l’adaptateur de `journalCompactLayout` neutralisait toujours le focus : il déclenche désormais l’effet et son nettoyage pour représenter la route visible ; ses 22 assertions passent, dont le préchargement après fin du défilement. Les échecs et reçus sont conservés dans le dossier privé ; aucun contrôle obligatoire affaibli.

## Android et iOS : frontière actuelle

Les deux builds Release locaux du code final `0648d74fa` réussissent :

| Plateforme | Identité locale | Empreinte |
| --- | --- | --- |
| Android arm64, profileable, non debuggable | 3.6.0(83), APK local, certificat fac61745… | APK SHA-256 `0fafc22108448771d123f410d66692aa5f8457ad184cb9b272738f6279ad76f2` |
| iOS, Release signée localement, mises à jour distantes désactivées | 3.6.0(20), IPA locale | IPA SHA-256 `46964d728d920b7d12577e2d4ba63c675ebc9a7fa530d1ae763277cbdc3eddbe` |

Artefacts privés : `/private/tmp/noctalia-ready-to-ui-20261019/candidate-android-source0648d74fa/` et `.tmp/ios-local-ota/runs/2026-10-19T12-28-52-677Z/` dans le checkout de performance. L’IPA publiée dans le portail est un fichier immuable du même export. Son JavaScript embarqué a pour SHA-256 `2ce51d1f9d88dfe1866ee5b54ea0c2da1cb2d6ea51000ac85a1ad3f028e0b7b0`. Aucun compteur Store/EAS modifié. Les builds des codes `19562cc93` et `3cb1b5423`, puis l’IPA locale 3.6.0(19), sont conservés séparément ; ils ne servent pas d’identité au dernier correctif.

L’APK Android conserve Expo Updates activé dans son projet natif ; runtime, update ID et canal effectivement choisis après relance n’ont pas été relevés dans cette tranche. Le pilote immédiatement après installation est corrélé aux nouveaux marqueurs et au nouveau garde de révélation, mais ne qualifie pas un canal OTA ni une équivalence Play. iOS utilise le JavaScript embarqué avec mises à jour désactivées.

Reconstruction Android, avec Java 17 et Android SDK configurés :

```sh
mise exec -- npm run android:release:local -- --abi arm64-v8a --profileable --reuse-native-project
```

Reconstruction iOS : script canonique `npm run ios:local:build -- --team <équipe existante> --device <iPhone enregistré> --version 3.6.0 --build-number 20`, avec `EXPO_NO_DOTENV=1 EXPO_PUBLIC_PERFORMANCE_TRACING=true EXPO_PUBLIC_MOCK_MODE=false EXPO_NO_METRO_LAZY=1`. Il réutilise le projet QA isolé, archive puis exporte, et vérifie signature stricte, profil, appareil, manifeste et mises à jour désactivées. Logs `build-android-source0648.log` et `ios-ota-build20.log` dans le dossier privé.

**Motorola physique** : déverrouillé manuellement par le propriétaire, signature installée comparée avant mise à jour `adb install -r`, compte de développement approuvé conservé. Le SHA-256 du paquet relu sur le téléphone correspond au candidat final. Aucun effacement global ni désinstallation. Pilotage par le CLI `agent-device 0.21.28` installé dans le runner (`@e2e-dev/mobile 0.12.3`), avec assertions exactes ; ce n’est pas une nouvelle campagne du runner natif. Le premier appel SDK a expiré côté daemon ; le nouvel appel Android explicite a réussi. L’injection de texte de test utilise ASCII, sans changement de clavier système.

| Pilotes natifs, un essai par code | `3cb1b5423`, 99 rêves | `0648d74fa`, 100 rêves |
| --- | --- | --- |
| Sauvegarde demandée → confirmée | 137,9 ms | 91,9 ms |
| Navigation demandée → commit de la page | 276,1 ms | 154,8 ms |
| Commit → marqueur de fin de fenêtre de révélation | 587,1 ms | 260,7 ms |

Ces relevés sont des **pilotes**, batterie à 7 %, sans build ni vérification concurrente. Les délais du SDK entre ses appuis et captures sont exclus des deltas. La suppression des 120 + 400 ms est vérifiée dans le code et par le contre-exemple d’opacité web ; les deux RAF natives restent sensibles à l’ordonnancement/layout. Ni le delta de 326 ms, ni les gains sauvegarde/navigation ne constituent un gain universel, un P95, un cold start ou une mesure de pixels. Le reliquat de 261 ms appelle une trace native avant attribution CPU/décodage ; aucun délai fixe ajouté pour le masquer.

Sur **les deux codes**, sauvegarde → bouton « Voir mon rêve » pendant la cérémonie → page avec récit et actions : passe. Après arrêt complet du processus puis relance : recherche du rêve synthétique, **une seule entrée**, réouverture puis **texte exact dans l’éditeur** : passe. Captures inspectées, reçus `android-persistence-result.log` puis `android-final-persistence-result.log` ; détail final dans `android-final-0648/`. Cela qualifie la durabilité Android pour ces parcours. L’analyse IA native nouvelle reste non qualifiée : le compte a épuisé ses analyses offertes ; aucun achat ni changement de droits effectué.

Nettoyage : les deux créations et les deux suppressions ont des acquittements distincts côté serveur ; aucun rêve synthétique restant et retour aux 98 rêves initiaux, confirmés par une lecture limitée au compte de développement approuvé. L’attente SDK de 10 s a expiré sur la **seconde** suppression, déjà envoyée ; elle n’a pas été renvoyée. La reprise qui cherchait encore cette fixture a donc été arrêtée. L’absence des fixtures, la liste sans filtre, la fermeture du clavier et de la session ont ensuite été vérifiées séparément (`android-cleanup-final-receipt.json`). L’assertion d’un champ vide dans l’arbre AX était inadaptée lorsque le header animé sortait ce champ de l’écran. Aucun compte supprimé. Les commandes exactes, versions et chemins sont dans le reçu privé `handoff-receipt.json`.

**iPhone, export 20 de cette campagne** : le portail Tailscale privé existant a servi le build 20. Page, santé, manifeste HTTPS et téléchargement complet de l’IPA : 200, hash identique à l’export signé. Reçu `ios-tailscale-final-receipt.json`. Les logs du portail confirment ensuite les demandes de l’iPhone pour la page, le manifeste, l’icône et l’IPA du build 20. Aucun Funnel ni accès public ajouté. Une réponse HTTP ne prouve pas l’installation. Le dernier accès CoreDevice échouait avec `4016` ; une nouvelle lecture confirme le tunnel indisponible : installation effective, parcours et timings natifs iOS de ce dernier code restent à confirmer sur le téléphone. Les preuves physiques iOS précédentes appartiennent à leurs anciens binaires.

**Actualisation du portail pendant la livraison** : un export 3.6.0(21), préparé en parallèle, a remplacé le pointeur d’accueil ; le manifeste immuable du 20 reste accessible. Ses métadonnées déclarent aussi la source `0648d74fa`. Vérifications fraîches du 21 : signature stricte, profil incluant l’iPhone approuvé, schéma Google iOS cohérent avec son client embarqué, nouveaux parcours présents et téléchargement HTTPS identique. IPA SHA-256 `d129adc9b299e113ebf59013bed144ebbcb444105266bb910ce10c750159abb2`, JavaScript `95bb9acd00e20023a18d5f7bf0e3c949219e9e5477bdfed58d880be555131db9`. Le bundle diffère du 20 : aucune exécution native ni preuve de performance n’est transférée au 21. Les modifications parallèles du lanceur dans le checkout principal sont préservées, hors du diff de cette PR. Reçu `ios-tailscale-build21-receipt.json`.

## Leviers suivants, après mesure native

1. **Fin du job serveur → observation client** : polling analyse jusqu’à 15 s entre deux demandes, images jusqu’à 15 s. C’est une borne potentielle du code, pas une latence P95 mesurée. Piloter notification existante ou fenêtre de polling plus réactive uniquement au premier plan, avec pause en arrière-plan, reprise idempotente et nombre de requêtes/batterie mesurés.
2. **Référence d’image prête → décodage/présentation** : mesurer signature, lecture disque/réseau et événement Image sur les deux téléphones ; envisager ensuite redimensionnement précoce sur géométrie fixe. Ne pas activer de télémétrie globale d’URLs privées pour obtenir ce diagnostic.
3. **Persistance → premier contenu natif** : mesurer les nouveaux chemins avec les marqueurs installés avant d’ajouter cache, pagination ou suppression de polices. La publication optimiste avant commit SQLite n’est pas utilisée pour masquer un délai.
4. **Suppression authentifiée** : pendant le retrait des fixtures, la seconde requête a dépassé les 10 s d’attente du pilote avant son acquittement. Le client attend le transport puis la persistance avant navigation (`deleteDream` / `deleteAndNavigate`). Mesurer séparément requête, ack, commit et rendu ; évaluer ensuite l’utilisation de la file durable existante pour libérer l’UI, avec conflits/échecs/reprise couverts. Ce n’est pas une preuve de blocage après une donnée déjà prête. Aucun changement de ce contrat de synchronisation dans cette tranche.

Noxcturnal reste un levier de bundling local, sans gain de performance utilisateur revendiqué ici. Aucun changement d’intervalle de polling, de stockage ou de fournisseur ajouté à l’aveugle.
