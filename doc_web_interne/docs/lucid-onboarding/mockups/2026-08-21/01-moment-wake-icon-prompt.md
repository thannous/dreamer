# Icône de réveil — étape 1

## Source visuelle

- Référence : `01-practice-three-moments.png`
- Génération brute archivée : `01-moment-wake-icon-generation.png`
- Asset transparent utilisé par l’application : `assets/images/lucid/onboarding/moment-wake-sunrise.png`

## Prompt

> Using the supplied onboarding reference as the exact visual source, isolate and recreate only the small mint sunrise pictogram located on the upper luminous path. Output a square icon asset on a perfectly solid pure black background. The icon must be centered, flat, and minimal: a thin mint outline semicircular sun rising above two thin horizontal horizon lines, with short thin rays above it. No arrow, no filled semicircle, no landscape, no glow, no texture, no text, no border, no extra objects. Match the reference icon's proportions and delicate line weight as closely as possible, suitable for a 30 dp mobile UI pictogram.

## Intégration

Le fond noir a été converti en transparence et l’asset a été normalisé sur une toile carrée. La couleur reste pilotée à l’exécution par `palette.accentStrong`. L’image est purement décorative, sans état ni sélection incrustés, et reste masquée aux technologies d’assistance par son conteneur React Native.
