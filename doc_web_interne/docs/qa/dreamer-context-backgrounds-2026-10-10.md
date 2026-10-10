# Dreamer : fonds selon le contexte — 2026-10-10

Six illustrations supplémentaires et le réemploi des fonds existants donnent une
ambiance stable à chaque contexte, avec un voile dérivé du thème et un repli sur
le fond uni si une image échoue. Les illustrations personnelles des rêves et les
visuels des symboles gardent leur priorité.

## Répartition

| Contexte | Illustration |
| --- | --- |
| Accueil sans illustration, callback Dreamer | Reverie existant |
| Capture | Capture existant |
| Explorer, guides et lecture des guides | Path existant |
| Tendances, bilan hebdomadaire, rituel lucide | Astral existant |
| Journal rempli, réglages, mot de passe, rituel de mémoire | Nouveau carnet nocturne |
| Réflexion et dialogue, y compris leurs états d’erreur | Nouvelles arches reliées |
| Rituel « Rêver » | Nouvelle forêt et lanterne |
| Dictionnaire et repli de fiche symbole | Nouvel atlas céleste |
| Plus | Nouvel observatoire |
| Sons de sommeil, natif uniquement | Nouveau lac brumeux |

Les six WebP font **511 584 octets** au total (1536 × 1024). Le générateur est
ImageGen intégré ; la sélection est celle de l’agent pour la demande du propriétaire.
Les prompts exacts, tailles et SHA-256 sont dans
[le manifeste](../../../assets/images/dreamer/generation.json).
Le catalogue statique est [dreamerArtwork.ts](../../../constants/dreamerArtwork.ts).

## Contraste et comportement

Le voile protège les textes principaux, secondaires et accentués, même au point
le moins couvert sur une image blanche en sombre ou noire en clair. Ces cas
extrêmes donnent au minimum 4,81:1 pour ces tokens opaques. Le texte sur un bouton
conserve son propre fond ; ce calcul ne qualifie pas tous les autres styles.

La mesure E2E relève la couleur, la taille et l’opacité du texte réellement
visible, masque temporairement son encre et mesure les pixels derrière ses
lignes. Elle exclut les zones masquées ou tronquées et les commandes désactivées.
Seuils : 4,5:1 pour le texte courant, 3:1 pour le grand texte.
**47 états capturés, 716 éléments de texte mesurés, minimum observé 4,512:1.**
Cela couvre clair/sombre, 390 × 844, capture et Explorer à 320 × 640 et
1440 × 900, et le repli après échec de l’image Plus.

Deux défauts reproduits ont été corrigés : citation du dialogue à 60 %
d’opacité (2,575:1 en clair, 3,931:1 en sombre) et sous-titre du journal à 92 %
(4,400:1 en clair). Ils utilisent maintenant le texte secondaire opaque du thème.
Les parcours vérifient aussi la saisie, l’enregistrement simulé, les angles de
réflexion, la recherche du journal et la progression de chaque rituel.

## Preuve canonique

Base des exécutions : `069fb1f16f092629adfc64091be77f56696bcb3e` plus les modifications
locales du candidat. Les 30 fichiers runtime touchés correspondent octet par
octet aux snapshots des deux exécutions retenues. Digest SHA-256 de leurs chemins
et empreintes triés : `40c406c2a18f40a745973f9583faea05ba1cfa05faea566ce89b074d1c743275`.
Le commit livré et sa preuve `verify:pr` sont consignés dans la PR.

Artefacts locaux ignorés par Git, sous `tools/e2e/.e2e/dreamer-web/` :

- `1791659163688-23119-cea68bf6-dc9f-4dbe-82af-93575c67a2d4` : les deux matrices
  complètes clair/sombre passent, code 0, source et sorties stables.
- `1791659040834-22384-ed38b197-dc92-419d-bb47-a25839bfca5c` : les trois autres
  parcours passent et sont réutilisés sans nouveau replay, sur les mêmes entrées
  runtime. Les deux anciennes matrices de ce run restent échouées : le rechargement
  déclenchait l’entrée Capture au lancement. Seule la navigation du test a changé
  pour rester dans la session via l’historique public du navigateur.

Chaque dossier conserve `report.json`, `end.json`, traces, captures et les mesures
`*-contrast.json`. L’union des résultats est **5/5 parcours passés**, et non un
rejeu frais des cinq dans la dernière invocation.

Commande complète de reproduction :

```sh
E2E_WEB_LOCALE=fr-FR E2E_WEB_PORT=8106 mise exec -- npm run test:testerarmy -- run --grep 'contextual backgrounds'
```

TesterArmy `e2e 0.18.0`, `@e2e-dev/web 0.13.0`, Playwright `1.63.0`, Node
`24.19.0`, un worker, français, mouvement réduit, services simulés et requêtes
externes bloquées. Les données sont synthétiques. Les contrôles de types app et
TesterArmy et le lint ciblé passent ; le lint conserve les avertissements
préexistants, sans erreur.

La première validation PR a exposé un import natif `expo-image` non simulé dans
trois fixtures de capture/Explorer. Leur ancien mock de fond décoratif cible
maintenant `DreamerBackground` ; toutes les assertions métier sont conservées.
La qualification de l’image et du voile reste celle des parcours E2E réels ci-dessus.

## Qualification native iOS

Le Release local **3.5.0 (11)** de `com.tanuki75.noctalia` a été installé sur le
simulateur dédié **Noctalia_Native_QA**, iPhone 18 Pro sous iOS 27. Le profil
`mock-persistent`, avec `EXPO_PUBLIC_MOCK_SHOWCASE=fr`, utilise les données
synthétiques françaises et la navigation habituelle sans rail de debug.
Les OTA sont désactivées et la signature locale est vérifiée.

Les deux matrices natives passent : **17 écrans × 2 thèmes, 34 captures**.
Le thème et la langue sont sélectionnés et vérifiés dans l’interface. Les
assertions couvrent les destinations réelles, la recherche du journal, l’entrée
dans Réflexion et la disparition du consentement initial avant Dialogue.
Les dix ambiances sont représentées, dont le lac des sons de sommeil, disponible
uniquement en natif. L’inspection visuelle confirme la lisibilité des textes et
commandes visibles ; le ratio numérique ci-dessus reste une mesure web.
Le dialogue est capturé pendant la réponse simulée, avec son illustration de rêve
prioritaire. La lecture audio et la fin de cette réponse ne sont pas qualifiées.

Identité du build, compilé dans le checkout isolé
`/private/tmp/noctalia-backgrounds-native-20261010` :

- Source : `832df312df89193a38f6e10598ef70d46a588ef7`.
- Digest des entrées app : `a0d9501196d4d5ec1d70805e9b188168f7be932911c8acaaf87b8c1aba92bbab`.
  La preuve native reste rattachée à ce build. Les ajouts du lot touchent le
  parcours TesterArmy et ce compte rendu. L’intégration de `master 14587ee40`
  ajoute sept fichiers de validation/normalisation ; la comparaison avec le
  reçu confirme que toutes les autres entrées, dont le code app et les assets,
  restent identiques. Cette intégration n’est pas présentée comme un rejeu natif.
- Digest des entrées natives : `f5553f7f9a0ebff1aaac1d0de8f787dcbc3692e97a235aaaa40e06836803f7f7`.
- SHA-256 du `.app` archivé : `b8f155fba941a736c9ef1494a8d6088f3b5370c8a3425b48abf62f11ab5d32fb`.
- Reçu immuable : `tools/e2e/.e2e/dreamer-ios/1791661181779-47774-407770fa-e294-4cbf-9d00-9c128213ee68/release.json`.
- Exécution retenue : `tools/e2e/.e2e/dreamer-ios/1791662189170-63928-37161f33-aaaf-4dee-8172-0b8b27d0bea6`.
  `report.json`, `qualification.json` et `end.json` : code 0, identité installée
  vérifiée avant/après, source et sorties stables, nettoyage complet, verrou libéré.
  Le parcours seul était non committé dans ce checkout pendant l’exécution.

TesterArmy `0.18.0`, moteur mobile `0.10.0`, agent-device `0.21.22`, Node `24.19.0`,
un worker, captures 402 × 874. Les PNG originaux ont été copiés pour la galerie
dans `tools/e2e/.e2e/dreamer-backgrounds-native-20261010/gallery.md` du checkout
principal ; leurs empreintes sont vérifiées contre le rapport, dans `manifest.json`.
Ces artefacts restent ignorés par Git.

Reproduction, depuis le checkout isolé conservant les entrées natives et le reçu :

```sh
AGENT_DEVICE_STATE_DIR=/private/tmp/noctalia-backgrounds-driver-20261010 \
E2E_DEVICE=Noctalia_Native_QA \
E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-ios/1791661181779-47774-407770fa-e294-4cbf-9d00-9c128213ee68/release.json \
mise exec -- node tools/e2e/run.mjs dreamer ios run --grep 'native contextual backgrounds matrix'
```

Le premier build a préparé les frameworks précompilés Expo et a été refusé pour
`BUILD_INPUTS_CHANGED` ; le second fournit le reçu stable. Le répertoire de pilote
séparé évite un ancien état partagé dont l’ownership était invérifiable, sans
effacer cet état ni modifier les verrous des autres tâches. Les premières matrices
ont conservé leurs échecs : confirmation iOS des liens, fixture française déjà
explorée reprenant directement Chat, puis consentement initial. Le run
`1791662047930-43236-13c1291c-7360-460b-b04b-485f090a2f5f` passait mécaniquement,
mais ses captures de Dialogue restaient masquées : il est écarté de la preuve
visuelle. L’assertion finale attend l’apparition puis la disparition du consentement.

## Portée restante

Cette qualification native porte sur le simulateur iOS et la taille de texte par
défaut. Android, un téléphone physique, les grandes tailles de texte système, la
lecture audio, le callback d’authentification réel et la persistance en production
restent non qualifiés par ces runs. Aucune publication, installation personnelle,
modification de compte réel ni transaction n’a été effectuée.
