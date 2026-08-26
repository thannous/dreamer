# Étape 2 — provenance du décor à quatre destinations

## Outil et fichiers

- Outil : génération d’images intégrée Codex, mode édition raster.
- Cible d’édition : `assets/images/lucid/onboarding/onboarding-step-2.jpg`.
- Génération brute retenue : `02-waypoints-generation.png` (`853x1844`, RGB).
- Asset applicatif optimisé : `assets/images/lucid/onboarding/onboarding-step-2-waypoints.jpg` (`853x1844`, JPEG qualité 90).
- L’ancien décor reste conservé et n’est plus référencé par l’onboarding.

## Prompt initial

> Edit only the four small arched cave-like alcoves at the endpoints of the branching luminous paths. Replace every alcove with an open, low circular stone waypoint terrace integrated into the hillside, viewed from the same camera perspective. Each terrace must have a clearly visible flat stone top and a subtle neutral cyan reflection from the path, with no wall, arch, roof, tunnel, doorway, cave, hole, or enclosure. The four terraces must remain centered at the same four endpoint locations so four independent native mobile choice controls can be overlaid on them. Preserve the exact portrait composition, camera, crop and negative space; preserve the distant glowing main portal, crescent moon, clouds, mountains, trees, hillside, central path, and all four branching paths. The raster must remain a neutral non-interactive background: no selected state, icon, pictogram, rune, crescent, label, text, checkmark, halo ring, UI, button, border, device frame or watermark.

## Passe d’alignement retenue

> Reposition only the four open circular stone waypoint terraces and the final segments of their luminous branch paths so the terrace centers align with a fixed 2-by-2 native control grid. Upper-left: 25% width and 41% height; upper-right: 75% width and 41% height; lower-left: 25% width and 55% height; lower-right: 75% width and 55% height. Keep all four terraces similar in apparent diameter and perspective, approximately 15% of canvas width, with clear flat open tops. Preserve every other visual invariant as closely as possible. Keep the background neutral and unselected; no cave, hole, symbol, text, icon, UI or additional destination.

Les plateformes, chemins et portail appartiennent au décor. Les icônes, libellés, anneau, halo, coche, zones tactiles, rôles radio et états sélectionnés restent des calques React Native.
