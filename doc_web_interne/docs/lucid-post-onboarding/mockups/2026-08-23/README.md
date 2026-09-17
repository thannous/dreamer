# Refonte post-onboarding — 23 août 2026

## Direction produit

- Trois destinations permanentes : Aujourd’hui, Programmes, Progression.
- Nuit et Réglages restent routables depuis des actions contextuelles.
- Une intention et une action principale par écran.
- Les détails de sécurité, de science et d’historique s’ouvrent progressivement.
- Les illustrations installent le lieu ; React Native porte toute l’interaction.

## Assets sources

| Usage | Fichier | Intention |
| --- | --- | --- |
| MILD | `assets/images/lucid/program-mild-destination.png` | Chemin de mémoire vers une intention claire |
| SSILD | `assets/images/lucid/program-ssild-destination.png` | Trois courants sensoriels convergeant vers un sanctuaire |
| WBTB | `assets/images/lucid/program-wbtb-destination.png` | Pont calme entre nuit et lumière du matin |
| Nuit | `assets/images/lucid/night-ritual-sanctuary.png` | Sanctuaire ouvert et trois plinthes neutres |
| Progression | `assets/images/lucid/progress-constellation.png` | Route céleste neutre destinée aux données natives |

Les cinq images ont été générées avec l’outil intégré `image_gen` en prenant
`mild-journey-path.png` et `today-dream-atlas.png` comme références de palette,
de texture et de monde. Contraintes communes des prompts : illustration
cinématographique nocturne, composition mobile verticale, espace négatif pour
les contrôles, aucune interface ou donnée peinte, aucun personnage, logo,
texte, grotte, bulle de verre ou surcharge néon.

- [Prompt set de génération](./generation-prompts.md)

## Preuves Android

- [Aujourd’hui — trois destinations et navigation contextuelle](./01-today-three-destinations-android.png)
- [Programmes — trois destinations illustrées](./02-programs-android.png)
- [Séance — pratique guidée et validation progressive](./03-session-android.png)
- [Nuit — sanctuaire, intention et sécurité progressive](./04-night-android.png)
- [Progression — constellation et données natives](./05-progress-android.png)
- [Bilan du matin — une question par étape](./06-morning-review-android.png)
- [Réglages — choix quotidiens et sections secondaires](./07-settings-android.png)

Capture : émulateur Android `1080 × 2340`, densité `440`, soit environ
`393 × 850 dp`. L’icône flottante `Tools` appartient au dev client Expo et ne
fait pas partie de l’interface livrée. Sur Aujourd’hui, c’est le bouton supérieur
semi-transparent ; l’engrenage plus bas appartient bien à Lucid Trainer.

Les captures sont les rendus finaux validés sur l’émulateur disponible. Le
Motorola n’était pas connecté pendant cette passe.
