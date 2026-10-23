# Ambiances dynamiques Noctalia

Le calcul horaire actuel est dans [lib/themeAmbience.ts](../../../lib/themeAmbience.ts),
consommé par [ThemeContext](../../../context/ThemeContext.tsx). Ce guide concerne
les ambiances partagées de Dreamer/Lucid ; Meditation suit ses propres univers
et [son guide local](../../../apps/meditation/AGENTS.md).

## Règle horaire locale

| Plage | Ambiance | Base de contraste |
| --- | --- | --- |
| `05:00–08:59` | Lumière douce du matin | claire |
| `09:00–16:59` | Lumière claire | claire |
| `17:00–20:59` | Afterglow | sombre |
| `21:00–04:59` | Nuit | sombre |

`Dynamique` suit ces plages sans accès à la position. `Automatique` reste un
choix distinct qui suit uniquement le thème clair/sombre du système.

## Références visuelles historiques du 21 août 2026

Les six captures suivantes étaient référencées sous
`../lucid-onboarding/mockups/2026-08-21/`. Elles ne sont pas présentes dans le
checkout relu le 23 octobre 2026 ; elles ne constituent donc pas une preuve
visuelle consultable pour le candidat actuel :

- `00-app-today-morning.png` : accueil du matin ;
- `00-app-settings-afterglow.png` : réglages afterglow ;
- `02-emulator-393x850-theme-dark.png` : nuit ;
- `02-emulator-393x850-theme-light.png` : clair ;
- `02-emulator-393x850-theme-morning.png` : matin ;
- `02-emulator-393x850-theme-afterglow.png` : afterglow.

Le relevé historique indique Android `1080 × 2340`, densité `440`, soit environ
`393 × 850 dp`. Conserver cette provenance sans recréer ni dupliquer les médias.
Les aperçus `?ambience=` sont réservés au développement et ne changent pas la
préférence persistée.
