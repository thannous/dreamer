# Design QA — mondes immersifs

## Cible et preuves

- Vérité visuelle — parcours clair :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-0553dff8-9b10-4e36-8c29-e9049855fa9a.png`
- Vérité visuelle — trainer sombre :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-ccfbe154-601c-4140-be35-8eed3f879740.png`
- Implémentation — accueil Aube :
  `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_b97eb49e-88e0-42ae-9c9e-58a8b4792f80.jpg`
- Implémentation — trainer Constellation actif :
  `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_cc04021b-3f63-4737-af3b-74067768d72b.jpg`
- Implémentation — trainer Dynamic Type maximal actif :
  `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_6a42b39d-39aa-41a2-bb41-46ca384c8833.jpg`
- Implémentation — fin Constellation :
  `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_b450dd6c-0c3f-4f52-99d2-fb17f7a75e59.jpg`
- Comparaisons normalisées côte à côte :
  `/private/tmp/noctalia-home-compare.png` et
  `/private/tmp/noctalia-trainer-compare.png`
- Démonstration iOS :
  `/private/tmp/noctalia-trainer-demo-optimized.mp4`

## Viewport et normalisation

- Appareil : simulateur iPhone 17, iOS 26.5.
- Viewport logique : 402 × 874 points, échelle native 3×.
- Captures XcodeBuildMCP optimisées : 368 × 800 px.
- Sources : 853 × 1844 px.
- Pour chaque comparaison, la source a été réduite proportionnellement à
  368 × 796 px puis centrée sur une toile 368 × 800 ; la capture de
  l’implémentation a été conservée à 368 × 800. Le montage final mesure
  736 × 800 px. Aucun cadre de téléphone ni chrome desktop n’est comparé.
- États comparés : accueil Aube au repos et trainer Constellation en exercice.

## Comparaison visuelle

### Vue complète

- Typographie : Fraunces conserve la voix éditoriale des concepts pour les
  titres et compteurs ; Space Grotesk reste réservée à l’interface. Les poids,
  retours à la ligne et hiérarchies restent lisibles dans les deux mondes.
- Espacement et rythme : le parcours réel conserve le fond plein écran, un
  foyer central, une progression et un CTA unique. Le sélecteur de monde est
  une divergence intentionnelle requise par le produit ; il remplace une
  partie de la trajectoire décorative du concept sans casser le rythme.
- Couleurs et tokens : Aube emploie papier, encre et champagne ; Constellation
  emploie encre, ivoire et champagne. Les scrims restent statiques pour la
  lisibilité ; seule la teinte respire très légèrement avec le SharedValue
  global. L’opacité reste toujours inférieure ou égale à sa valeur auteur.
- Images : deux scènes raster réelles, converties en WebP, sont utilisées en
  plein écran. Des miniatures 480 × 312 dédiées évitent de décoder les grands
  fonds dans le sélecteur. Poids runtime total : environ 347 Ko.
- Surfaces : un seul support glass porte l’action principale sur chaque écran.
  Le glass reste une texture d’appui et ne remplace jamais l’image.
- Icônes : les contrôles continuent d’utiliser `IconSymbol`; aucun pictogramme
  maison, emoji, SVG artisanal ou faux asset n’a été introduit.
- Copy : les noms, descriptions, phases, durées, progression et CTA sont
  traduits dans les six langues existantes.

### Régions focalisées

Aucun crop supplémentaire n’a été nécessaire : à 368 × 800, les deux montages
normalisés rendent lisibles les cinq surfaces critiques — titre, scène, foyer,
progression/phase et CTA/chrome. Les états plus exigeants ont été contrôlés par
des captures séparées : drawer clair/sombre, trainer actif, fin de rituel et
Dynamic Type maximal.

## Interactions et accessibilité vérifiées sur iOS

- sélection Constellation ↔ Aube et persistance ;
- status bar, tabs et drawer cohérents dans les deux apparences sans modifier
  le thème global de l’utilisateur ;
- démarrage du trainer, changements de phase, pause et progression ;
- mode Reduce Motion couvert par la jauge statique ;
- taille de texte `accessibility-extra-extra-extra-large`, au repos et en
  exercice : aucun chevauchement ni contrôle perdu ;
- écran de fin dans les deux mondes avec CTA persistant ;
- logs runtime inspectés : aucune exception JavaScript. Deux avertissements
  natifs préexistants concernent les modes background fetch/notification et ne
  touchent pas ce parcours visuel.

## Historique des corrections P0/P1/P2

1. Progression hebdomadaire trop faible sur le centre clair de Constellation.
   Correction : pourcentage en ton par défaut et jours inactifs en ton muted.
   Preuve post-correctif :
   `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_287b0c2b-4cdb-499a-b870-473c50b24e23.jpg`.
2. Indication de phase suivante trop faible sur le trainer actif.
   Correction : cue en ton par défaut, scrim inchangé.
   Preuve post-correctif :
   `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_cc04021b-3f63-4737-af3b-74067768d72b.jpg`.
3. À Dynamic Type maximal, le titre chevauchait le nom du pattern et la tablette
   masquait le temps/la progression.
   Correction : mode compact réel, pattern redondant masqué, jauge et textes
   focaux plafonnés, durées horizontalement défilantes.
   Preuve post-correctif :
   `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/screenshot_optimized_6a42b39d-39aa-41a2-bb41-46ca384c8833.jpg`.
4. Le monde ne se prolongeait pas sur l’écran de fin et les PNG imposaient
   environ 6,15 Mo au dépôt/runtime prévu.
   Correction : `WorldScene` sur la fin, fonds WebP et miniatures dédiées.
   Preuve post-correctif : capture de fin ci-dessus et quatre assets runtime
   totalisant environ 347 Ko.
5. Le nouvel univers restait statique hors trainer malgré la signature de
   souffle demandée.
   Correction : une seule couche de teinte lit l’unique souffle global de 11 s
   sur le thread UI ; scrim, texte et grain restent statiques. Reduced Motion
   la fixe à mi-course.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable.
- Divergence acceptée : les rôles `journey`, `trainer` et `completion` partagent
  actuellement l’image du monde afin de préserver la continuité. Le registre
  permet déjà d’attribuer un asset distinct à chaque rôle sans migration.

## Follow-up polish

- P3 : produire, lors d’un futur lot éditorial, des variantes d’art dédiées à
  la fin du rituel si une transformation narrative par étape devient un besoin
  produit explicite.

## Validation technique

- TypeScript : passé.
- ESLint Expo : passé sans erreur.
- Jest : 23 suites et 240 tests passés.
- Expo Doctor : 21/21 contrôles passés.
- `git diff --check` : passé.
- Revue indépendante finale : aucun P0/P1/P2 actionnable.

final result: passed
