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

## Portée restante

Cette preuve est web. Le rendu natif, les tailles de texte système, les gestes
physiques et les sons de sommeil sur appareil ne sont pas qualifiés par ce run.
La disponibilité native des sons de sommeil est conservée. Le callback
d’authentification réel n’a pas été exercé. Aucune publication, installation
personnelle, modification de compte réel ni transaction n’a été effectuée.
