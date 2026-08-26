# Ambiances dynamiques Noctalia

Index global des maquettes et preuves Android des quatre thèmes applicatifs.
Les fichiers sources restent rangés avec le chantier Lucid afin de ne pas
dupliquer les PNG lourds.

## Règle horaire locale

| Plage | Ambiance | Base de contraste |
| --- | --- | --- |
| `05:00–08:59` | Lumière douce du matin | claire |
| `09:00–16:59` | Lumière claire | claire |
| `17:00–20:59` | Afterglow | sombre |
| `21:00–04:59` | Nuit | sombre |

`Dynamique` suit ces plages sans accès à la position. `Automatique` reste un
choix distinct qui suit uniquement le thème clair/sombre du système.

## Preuves dans l’application

- [Accueil complet — matin](../lucid-onboarding/mockups/2026-08-21/00-app-today-morning.png)
- [Réglages complets — afterglow](../lucid-onboarding/mockups/2026-08-21/00-app-settings-afterglow.png)

## Comparaison sur le choix de l’horizon

- [Nuit](../lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-theme-dark.png)
- [Clair](../lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-theme-light.png)
- [Matin](../lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-theme-morning.png)
- [Afterglow](../lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-theme-afterglow.png)

Les captures ont été prises sur Android à `1080 × 2340`, densité `440`, soit
environ `393 × 850 dp`. Les aperçus `?ambience=` sont disponibles uniquement
en développement et ne modifient pas la préférence persistée.

