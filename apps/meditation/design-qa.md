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

---

# Design QA — achat ponctuel d’un univers

## Cible et preuves

- Vérité visuelle sélectionnée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-bf735dc3-94fc-4195-9951-2c8897cae65e.png`
- Implémentation Android finale, Marée profonde non acquise :
  `/private/tmp/noctalia-world-purchase-final.png`
- Comparaison normalisée côte à côte, ouverte et inspectée :
  `/private/tmp/noctalia-world-purchase-comparison-final.png`

## Viewport, densité et état

- Appareil : émulateur Android `emulator-5554`, 360 × 780 dp, densité 3×.
- Capture native : 1080 × 2340 px ; source : 853 × 1844 px.
- La capture native a été ramenée à 853 × 1844 px pour une comparaison à
  dimensions égales. Aucun cadre de téléphone ou canvas desktop n’est inclus.
- État : français, thème sombre, `Marée profonde`, univers non acquis, prix
  ponctuel mock `0,99 €` et restauration disponible.

## Comparaison visuelle

- Typographie : le titre emploie Fraunces Regular dans une variante `hero`
  dédiée ; l’interface et le prix restent en Space Grotesk. Taille, poids,
  retours à la ligne et hiérarchie correspondent à la cible.
- Espacement : le chevron, le bloc éditorial, la mention d’achat, le CTA et la
  restauration suivent les mêmes axes et proportions. Le CTA occupe environ
  73 % du viewport et conserve une cible tactile native.
- Couleurs : encre, ivoire, lavande et champagne viennent exclusivement des
  tokens Noctalia. Le CTA utilise un dégradé champagne discret, sans carte ni
  matière glass ajoutée.
- Image : un fond raster dédié de 853 × 1844 px, optimisé en WebP à environ
  121 Ko, reprend l’ouverture marine, les rayons, les poissons et la végétation
  de la cible. Le tiers inférieur reste sombre pour protéger la lecture.
- Copy : `Marée profonde`, la promesse courte, `Achat unique`,
  `Obtenir · 0,99 €` et `Restaurer` sont identiques à la cible.

### Région focalisée

La vue complète normalisée conserve le texte et le CTA à une taille suffisante
pour juger la typographie, le filet du bouton, le dégradé, les retours à la
ligne et l’icône de retour ; aucun crop supplémentaire n’était nécessaire.

## Historique P0/P1/P2 de cette itération

1. P1 — le premier rendu utilisait le fond du trainer, avec une lumière
   centrale et sans la composition marine de la cible. Correction : création
   d’un asset `purchase` dédié, sans texte ni UI incrustés.
2. P2 — le sous-titre restait sur une ligne et la hiérarchie du titre était
   trop faible. Correction : variante typographique `hero` et largeur de
   lecture ramenée à 58 %.
3. P2 — le CTA était trop étroit, plat et la restauration trop dorée.
   Correction : largeur alignée sur la cible, dégradé champagne tokenisé et
   restauration en ton muted.
4. P2 — les écarts verticaux autour du bloc d’achat différaient de la cible.
   Correction : rythme `mt-12/gap-2` et suppression du padding inférieur
   superflu. La comparaison post-correctif est le montage final ci-dessus.

## Interactions vérifiées sur Android

- ouverture directe de l’aperçu de `Marée profonde` ;
- achat mock local sans transaction réelle : le CTA devient `Continuer` et le
  statut devient `Cet univers est à vous` ;
- `Continuer` sélectionne l’univers et revient à l’accueil, dont la promesse
  devient celle de `Marée profonde` ;
- contrôles accessibles présents : retour, achat/continuer et restauration.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable après la comparaison combinée finale.
- Divergence acceptée : le chrome système Android reste visible, contrairement
  à la maquette sans barre d’état. Il s’agit du chrome natif, pas d’un élément
  simulé par l’application.

## Validation technique

- TypeScript : passé sans erreur.
- ESLint Expo ciblé : passé sans erreur.
- Jest ciblé : 3 suites, 31 tests passés.
- Uniwind : artefacts régénérés après ajout des variantes typographiques.

final result: passed

---

# Design QA — rappel orbital

## Cible et preuves

- Vérité visuelle sélectionnée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-0ef20ded-e63f-444b-99de-ecd55acd5ab9.png`
- Implémentation Android finale, rappel actif à 21:30 :
  `/private/tmp/noctalia-reminder-final-v2b.png`
- Comparaison normalisée côte à côte, ouverte et inspectée :
  `/private/tmp/noctalia-reminder-compare-v2.png`

## Viewport et état comparé

- Appareil : Motorola Edge 60 Fusion physique sous Android, connecté par ADB
  Wi-Fi.
- Capture native : 1220 × 2712 px ; source : 853 × 1844 px.
- La capture native a été recadrée proportionnellement au viewport de la
  source. Le chrome Android reste visible uniquement côté implémentation.
- État : français, thème sombre, quatrième étape sur quatre, rappel activé,
  heure 21:30 et CTA actif.

## Correspondance visuelle et fonctionnelle

- La composition reprend la proposition validée : en-tête éditorial, grand
  cadran lunaire central, heure focale, activation en capsule et footer à deux
  actions.
- Le cadran est un asset raster dédié avec lune, graduations, quatre foyers et
  halo champagne. Son bord alpha se dissout dans le ciel Noctalia au lieu de
  former une carte rectangulaire.
- L'heure est un vrai champ numérique. Une saisie `2230` produit `22:30` ; les
  chevrons ajoutent et retirent 15 minutes sans désynchroniser l'état.
- `Me rappeler` expose un rôle `checkbox` et un état `checked`. La coche en
  contour lumineux, le cadran et le libellé répondent ensemble en 220 ms sur
  le thread UI ; Reduced Motion supprime le changement d'échelle.
- Le rappel désactivé reste lisible mais inerte. L'autorisation système n'est
  demandée qu'au CTA final et seulement si le rappel est activé.
- Le bouton principal demeure ancré dans la zone basse tandis que le contenu
  peut défiler avec Dynamic Type.

## Historique P0/P1/P2 de cette itération

1. P1 — l'écran initial ressemblait à un formulaire de réglage générique.
   Correction : remplacement par le cadran orbital validé, sans perdre la
   saisie directe demandée précédemment.
2. P1 — le premier cadran formait un disque noir trop brutal sur l'atmosphère.
   Correction : asset à bord alpha progressif et voile nocturne local renforcé.
3. P2 — le cadran et la capsule étaient trop hauts, laissant un vide excessif
   avant le CTA. Correction : cadran porté à 340 dp sur format compact et
   rythme vertical recalé d'après la comparaison combinée.
4. P2 — la coche pleine avait un poids visuel supérieur à la maquette.
   Correction : cercle transparent, contour champagne et halo contenu.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable après inspection de la comparaison combinée.
- Divergence acceptée : la lune de production montre davantage de matière sur
  sa face sombre que le concept, tout en conservant le croissant, la palette et
  la hiérarchie. Cette différence évite de figer du texte dans l'asset et garde
  l'heure réellement interactive.

## Validation technique de cette itération

- TypeScript : passé sans erreur.
- ESLint Expo ciblé : passé sans erreur.
- `git diff --check` ciblé : passé.
- Vérification native : activation, saisie directe `22:30`, pas de 15 minutes,
  retour à `21:30` et état actif final.

final result: passed

---

# Design QA — Niveau sous forme de trajectoire

## Cible et preuves

- Vérité visuelle sélectionnée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-8f8e955f-813a-447a-a7cc-ed33ceef916b.png`
- Implémentation Android finale, `Occasionnel` sélectionné :
  `/private/tmp/noctalia-experience-capsule-full-selected.png`
- Comparaison normalisée côte à côte, ouverte et inspectée :
  `/private/tmp/noctalia-experience-capsule-full-compare.png`

## Viewport et état comparé

- Appareil : Motorola Edge 60 Fusion physique sous Android, connecté par ADB
  Wi-Fi.
- Capture native : 1220 × 2712 px ; source : 852 × 1846 px.
- Pour la comparaison, la capture native a été ramenée au viewport 852 × 1846
  de la source. Le chrome Android reste visible uniquement côté implémentation.
- État : français, thème sombre, deuxième étape sur quatre, niveau
  `Occasionnel` sélectionné, CTA actif.

## Correspondance visuelle et fonctionnelle

- La composition reprend la cible : en-tête éditorial, trajectoire champagne
  en S, trois vignettes de progression, capsule latérale et CTA persistant.
- Les trois vignettes sont extraites de la maquette validée puis optimisées en
  WebP ; leur sujet, leur lumière, leur recadrage et leur ordre sont donc ceux
  de la référence, sans asset générique substitué.
- La capsule sélectionnée conserve la géométrie en pilule, le contour fin, la
  faible matière glass et le foyer champagne derrière la vignette. À la
  demande produit, le marqueur central a été supprimé : le contour suffit à
  porter la sélection.
- La capsule laisse 20 dp de marge d'écran de chaque côté, passe derrière
  l'illustration et englobe donc tout le contenu sélectionné. Son contour passe
  d'un champagne presque effacé à gauche à une présence plus nette à droite.
- Les marges d'en-tête, tailles Fraunces/Space Grotesk, filets décoratifs,
  position des trois niveaux et géométrie du CTA ont été recalés après
  comparaison directe. L'écart restant en haut et en bas vient exclusivement
  de la barre d'état et de la barre de navigation Android absentes de la
  maquette.
- Un changement de niveau déplace la capsule en 220 ms sur le
  thread UI, sans animation de layout ni autoscroll. Reduced Motion applique
  directement l'état final.
- Les trois choix exposent un rôle `radio` et un état `checked`. Le changement
  `Occasionnel → Régulier → Occasionnel` a été vérifié sur l'appareil.

## Historique P0/P1/P2 de cette itération

1. P1 — la première passe était trop claire et violette, comprimait la
   trajectoire et plaçait le CTA trop bas. Correction : voile nocturne local,
   coordonnées verticales recalées et footer aligné sur la cible.
2. P1 — la sélection ne portait pas le foyer lumineux distinctif de la
   maquette. Correction : halo de vignette renforcé et dégradé champagne très
   localisé à gauche de la capsule.
3. P2 — libellés de niveaux, descriptions et CTA étaient légèrement trop
   grands. Correction : tailles locales mesurées sur la source, sans modifier
   les tokens typographiques globaux.
4. P2 — les points de passage au début et à la fin de la trajectoire manquaient.
   Correction : deux repères discrets ajoutés sur le même canevas vectoriel.
5. P2 — le marqueur de sélection faisait doublon avec la capsule et son
   contour gardait la même présence sur les deux côtés. Correction : marqueur
   supprimé, contour en dégradé d'opacité et capsule pleine largeur avec 20 dp
   de respiration aux bords, illustration incluse à l'intérieur.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable après inspection de la comparaison combinée.
- Divergence acceptée : chrome système Android visible sur la capture réelle ;
  aucun élément appartenant à l'application n'a été déplacé pour le simuler.

## Validation technique de cette itération

- TypeScript : passé sans erreur.
- ESLint Expo ciblé : passé sans erreur.
- `git diff --check` ciblé : passé.
- Vérification native : changement de niveau, état sélectionné, mouvement de
  capsule et CTA actif.

final result: passed

---

# Design QA — objectifs en mosaïque immersive

## Cible et preuves

- Vérité visuelle sélectionnée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-146345db-3c44-4bc9-ba93-35d163e5bd78.png`
- Implémentation Android, sommeil et rêves sélectionnés :
  `/private/tmp/noctalia-goals-bento-final.png`
- Comparaison normalisée côte à côte, ouverte et inspectée :
  `/private/tmp/noctalia-goals-bento-final-compare.png`

## Viewport et état comparé

- Appareil : Motorola Edge 60 Fusion physique sous Android, connecté par ADB
  Wi-Fi.
- Capture native : 1220 × 2712 px ; source : 852 × 1846 px.
- Les deux vues ont été ramenées à 1846 px de haut pour la comparaison.
- État : français, thème sombre, `Mieux dormir` et `Préparer mes rêves`
  sélectionnés, CTA actif.

## Comparaison visuelle et fonctionnelle

- La structure reprend la cible : en-tête éditorial, progression, mosaïque
  asymétrique à deux colonnes et CTA persistant.
- La géométrie finale reprend la cascade de la cible plutôt qu’une grille
  équilibrée : `sommeil → concentration → positif` à gauche et
  `stress → anxiété → rêves` à droite, avec départ droit décalé de 4 dp,
  gouttières de 8 dp et rayons de 12 dp. Sur l’appareil, la colonne gauche
  mesure 1784 px contre environ 1816 px une fois la source ramenée à la même
  largeur ; l’écart restant correspond au chrome système conservé.
- Les six illustrations sont des assets raster dédiés et cohérents : sanctuaire
  lunaire, tension dissoute dans l’eau, point focal céleste, refuge forestier,
  première lumière positive et portail vers les rêves. Elles sont cadrées en
  4:5 et optimisées en WebP 672 × 840, pour un poids total d’environ 218 Ko.
- La sélection ne modifie plus la photographie : aucun voile ni remplissage
  champagne n’est appliqué. Seuls le contour champagne et la coche carrée
  indiquent l’état, conformément à la cible et à la demande utilisateur.
- Les six options exposent un rôle `checkbox` et un état `checked`. Deux
  sélections simultanées ont été vérifiées sur l’appareil et activent le CTA.
- Fraunces et Space Grotesk, les contrastes ivoire/champagne, le grain et les
  orbites restent dans le système Noctalia. Aucun asset générique de monde ne
  subsiste sur cet écran.

## Historique P0/P1/P2 de cette itération

1. P2 — les premières cartes réutilisaient les fonds des mondes et ne
   traduisaient pas précisément chaque intention. Correction : six scènes
   dédiées, générées comme une collection cohérente puis intégrées dans le
   projet.
2. P2 — l’état sélectionné ajoutait un voile champagne sur toute l’image et
   dénaturait son contraste. Correction : suppression complète de cette couche,
   avec conservation du contour et de la coche uniquement.
3. P2 — la première version laissait trop d’espace vide entre la mosaïque et
   le CTA. Correction : hauteurs asymétriques recalées pour occuper le viewport
   réel sans perdre le scroll aux tailles de texte supérieures.
4. P2 — la première passe reprenait le principe du bento mais pas ses
   proportions : gouttières trop larges, cases et libellés trop imposants,
   `Anxiété` trop haute et `Rêves` trop courte. Correction : mesures
   carte par carte, typographie Fraunces régulière 19 dp, cases 28 dp et
   cascade verticale rapprochée de la source.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable sur la comparaison finale.
- P3 accepté : certaines scènes diffèrent littéralement de la première
  proposition générée, mais conservent la même métaphore, la même composition
  et une cohérence de série supérieure aux anciens assets génériques.

## Validation technique de cette itération

- Jest complet final : 30 suites et 289 tests passés.
- TypeScript : passé sans erreur.
- ESLint Expo complet : passé sans erreur.
- Vérification native : sélection multiple, état accessible et CTA actif.

final result: passed

---

# Design QA — Introduction respiratoire immersive

## Cible et preuves

- Maquette de référence :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-261a1bf4-fa8d-4e8e-bb79-1d016b05b931.png`
- Implémentation Android, halo au repos :
  `/private/tmp/noctalia-breath-rest-final.png`
- Implémentation Android, halo activé :
  `/private/tmp/noctalia-breath-visual-final.png`
- Comparaison complète normalisée :
  `/private/tmp/noctalia-breath-full-compare.png`
- Comparaison rapprochée du halo :
  `/private/tmp/noctalia-breath-halo-compare.png`

## Viewport et état comparé

- Appareil : Motorola physique sous Android 16, connecté par ADB Wi-Fi.
- Capture native : 1220 × 2712 px, densité 450 dpi ; largeur logique React
  Native mesurée à 433,78 dp.
- État : français, thème sombre immersif, halo au repos, aucune transition en
  cours.
- La comparaison complète isole la surface de l’application de la coque de la
  maquette et ramène les deux rendus à 1656 px de haut. Le rapprochement halo
  compare séparément la géométrie, le trait et le contenu central.

## Comparaison visuelle et fonctionnelle

- Structure : sur-titre, titre éditorial sur deux lignes, filet champagne,
  halo, indication sonore, texte d’introduction et CTA suivent le même ordre
  et la même hiérarchie que la référence.
- Halo : deux cercles concentriques, circonférence intérieure très fine et arc
  champagne plus épais de 10 h à 7 h. Le halo occupe 390 dp, soit environ 90 %
  de la largeur logique disponible, et conserve son cercle parfait.
- Contenu : `Inspirez` et `Un premier souffle, avant de commencer` restent
  centrés dans la zone vide du halo, sans faire partie de l’image générée.
- Signature d’interaction : le halo consomme l’unique souffle global de 11 s ;
  un toucher ajoute une réponse lumineuse ponctuelle, une haptique et l’état
  `En rythme`, sans créer de seconde boucle permanente.
- Texture : les orbites et le grain Noctalia restent visibles en soutien. Aucun
  verre décoratif n’est ajouté au centre du rituel.
- Accessibilité : Reduced Motion fige le souffle à mi-course ; le halo expose
  un rôle bouton, un nom et une indication accessibles ; le CTA reste visible
  et atteignable sur l’appareil testé.

## Historique P0/P1/P2 de cette itération

1. P1 — la première version utilisait un grand cercle générique et un contenu
   qui ne reprenait pas la composition de la maquette. Correction : nouvel
   écran dédié et asset de halo isolé, avec tout le texte rendu en UI native.
2. P1 — l’image du halo suivait sa taille intrinsèque et paraissait trop petite
   sur l’appareil. Correction : wrapper animé à taille responsive explicite,
   recadrage carré de l’asset et rendu `expo-image` contenu.
3. P2 — le libellé actif se repliait sur trois lignes. Correction : état court
   `En rythme`, traduit dans les six catalogues.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable.
- P3 accepté : le fallback Material Android de l’onde sonore comporte cinq
  barres, alors que la maquette emploie une onde plus détaillée. Il reste dans
  le système `IconSymbol` partagé avec Noctalia et conserve le même sens et la
  même hiérarchie.

## Validation technique de cette itération

- Jest ciblé : 3 suites, 46 tests passés.
- Jest complet : 29 suites, 284 tests passés.
- TypeScript : passé sans erreur.
- ESLint Expo ciblé et complet : passé sans erreur.
- Expo Doctor : 21/21 contrôles passés.
- `git diff --check` : passé.
- Parcours natif vérifié : accueil → introduction respiratoire → interaction
  du halo → objectifs.

final result: passed

---

# Design QA — Home Journey option 2 + rail « Up next »

## Cible et preuves

- Vérité visuelle sélectionnée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-6020443b-0431-48b9-92e8-165119386c21.png`
- Implémentation Android, Constellation sélectionnée :
  `/private/tmp/noctalia-journey-option2-clean-start.png`
- Implémentation Android, Aube sélectionnée :
  `/private/tmp/noctalia-journey-option2-balanced-dawn.png`
- État du rail après balayage horizontal :
  `/private/tmp/noctalia-journey-carousel-swiped.png`
- Contrôle Dynamic Type 200 % :
  `/private/tmp/noctalia-journey-option2-font200.png`
- Comparaison normalisée côte à côte ouverte et inspectée :
  `/private/tmp/noctalia-option2-design-qa-comparison.png`

## Viewport et normalisation

- Appareil : émulateur Android API 36, `shapier_360dp_api36`.
- Viewport logique : 360 × 640 dp ; capture native : 1080 × 1920 px ; densité
  forcée : 480 dpi.
- Source : 841 × 1870 px, correspondant à une composition plus haute, proche
  de 360 × 800.
- Pour la comparaison, la source a été ramenée proportionnellement à 1920 px
  de haut (864 × 1920) et la capture runtime conservée à 1080 × 1920 ; montage
  final 1944 × 1920. La différence de ratio est intentionnelle et permet de
  juger le comportement responsive sur le petit viewport réel.
- État principal comparé : thème Constellation, texte système 130 %, aucune
  séance commencée, CTA `Begin`, premier chargement en haut de Home.

## Comparaison visuelle et fonctionnelle

- Typographie : Fraunces et Space Grotesk préservent la hiérarchie éditoriale.
  Le CTA a été raccourci visuellement de `Begin the journey` à `Begin`, comme
  dans la cible, tout en gardant le nom accessible complet.
- Rythme : progression puis deck asymétrique, avec grande carte active et
  aperçu compact du second monde. Le split mesuré est 60/40 et l’aperçu mesure
  78 % de la hauteur de l’active. Sur 360 × 640, le rail commence sous le deck
  et son titre reste visible au-dessus du chrome, invitant à poursuivre.
- Couleurs et tokens : les deux apparences réutilisent exclusivement les
  surfaces et couleurs du design system. Le verre reste limité au chrome ; le
  deck et le rail échantillonnent directement les scènes.
- Images : les miniatures réelles de Constellation et Aube sont cadrées dans les
  deux cartes ; aucune forme de remplacement, faux SVG ou placeholder.
- Copy : monde, durée, catégorie, Plus, jalons et CTA sont traduits via les six
  catalogues existants. Le titre interne de séance a été retiré du deck pour ne
  pas créer un second concept concurrent ; il reste dans l’écran de détail et
  dans le nom accessible du CTA.
- Interactions Android : sélection des deux mondes et persistance, scroll
  automatique unique vers le deck après sélection, CTA accessible, balayage
  manuel jusqu’à la troisième pratique et ouverture de `/session/:id` vérifiés.
- Dynamic Type : à 200 %, le contenu grandit et reste atteignable par scroll ;
  le CTA court demeure visible après défilement, sans clipping.

## Historique P0/P1/P2 de cette itération

1. P1 — le libellé `Begin the journey` passait sur deux lignes à 130 % et
   produisait une capsule disproportionnée. Correction : libellé visible
   `session.play` / `session.resume`, nom accessible long conservé.
2. P1 — le premier recalage 60/40 faisait passer le titre de séance et Plus sur
   des rangées supplémentaires, repoussant le CTA sous le chrome. Correction :
   suppression du titre de séance dans le deck, Plus replacé dans le header et
   meta sans wrap. Preuve post-correctif : carte active
   `[60,870][614,1474]`, aperçu `[650,870][1020,1338]`, CTA
   `[101,1262][574,1434]`, entièrement avant le chrome à `y=1686`.
3. Une alerte React « state update on a component that hasn't mounted yet » a
   été observée après Fast Refresh. Un démarrage à froid avec `logcat` nettoyé,
   puis un changement de monde, ne l’a pas reproduite ; aucune erreur ou alerte
   `ReactNativeJS` n’est présente dans les logs de preuve.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable.
- P3 accepté : la cible comporte une flèche dans le CTA et un léger trait de
  séparation interne. Leur absence ne réduit ni l’affordance, ni la lisibilité,
  ni la réussite du flux sur le viewport réel.
- Le carrousel demandé après la sélection n’existe pas dans la maquette source ;
  son rail manuel, limité à trois pratiques avec aperçu de la carte suivante,
  est donc évalué comme une extension cohérente plutôt qu’une divergence.

## Validation technique de cette itération

- ESLint Expo complet : passé sans erreur.
- TypeScript : passé sans erreur.
- Jest : Home Journey + recommandations futures 16/16 ; parité i18n 34/34.
- `git diff --check` : passé.

final result: passed

---

# Design QA — durée sous forme de portail lunaire

## Cible et preuves

- Vérité visuelle sélectionnée et corrigée :
  `/Users/tanuki/.codex/generated_images/01a01e4d-58b6-7661-9c91-77e3a72014be/exec-9023e8cf-e5a5-4215-bc21-bb3b5052e73c.png`
- Implémentation Android finale, `10 min` sélectionné :
  `/private/tmp/noctalia-intention-lunar-final-v2.png`
- Comparaison normalisée côte à côte, ouverte et inspectée :
  `/private/tmp/noctalia-intention-lunar-compare-final.png`

## Viewport et état comparé

- Appareil : Motorola Edge 60 Fusion physique sous Android, connecté par ADB
  Wi-Fi.
- Capture native : 1220 × 2712 px ; source : 852 × 1846 px.
- La capture native a été ramenée au viewport 852 × 1846 de la source. Le
  chrome système Android reste visible uniquement côté implémentation.
- État : français, thème sombre, troisième étape sur quatre, `10 min`
  sélectionné et CTA actif.

## Correspondance visuelle et fonctionnelle

- Le bloc éditorial reprend les retours de ligne, la règle champagne et la
  largeur de lecture de la cible.
- Le portail lunaire est un asset raster dédié de 800 × 800, optimisé en WebP
  à environ 73 Ko. Son fond a été extrait en alpha pour que les orbites se
  fondent dans l'atmosphère au lieu de former un carré visible.
- La durée active et sa description sont de vrais textes traduits, superposés
  à l'asset. Les flèches utilisent `IconSymbol` et conservent une cible tactile
  supérieure à leur disque visible grâce au `hitSlop`.
- La rangée inférieure des quatre choix a été supprimée conformément à la
  maquette corrigée. Les flèches parcourent 5, 10, 15 et 20 minutes ; elles se
  désactivent correctement aux deux extrémités.
- Le portail lit l'unique souffle global. Le changement de valeur ajoute un
  settle de scale/opacité sur le thread UI, sans animation de layout ; Reduced
  Motion conserve le changement de texte sans déplacement.
- La valeur par défaut est 10 minutes, ce qui rend la maquette et l'état produit
  cohérents dès l'arrivée sur l'écran.

## Historique P0/P1/P2 de cette itération

1. P1 — la première implémentation affichait un carré sombre autour de l'asset.
   Correction : extraction alpha post-génération et remplacement du WebP.
2. P1 — le premier portail était environ 25 % plus petit que la cible.
   Correction : échelle visuelle portée à 1,4 sans agrandir ni déplacer les
   cibles tactiles des flèches.
3. P2 — le titre et le sous-titre utilisaient toute la largeur disponible et
   ne revenaient pas à la ligne comme la maquette. Correction : largeur
   éditoriale plafonnée, contenu conservé intégralement.
4. P2 — les flèches étaient trop lourdes et le CTA trop large. Correction :
   disques ramenés à 48 dp avec `hitSlop`, footer porté à 24 dp de marge.

## Findings finaux

- Aucun P0, P1 ou P2 actionnable après inspection de la comparaison combinée.
- Divergence acceptée : le chrome système Android décale légèrement le CTA vers
  le bas par rapport à la maquette sans chrome ; aucun élément de l'application
  n'a été déplacé pour simuler cette absence.

## Validation technique de cette itération

- TypeScript : passé sans erreur.
- ESLint Expo ciblé : passé sans erreur.
- `git diff --check` ciblé : passé.
- Vérification native : `10 → 5`, blocage de la flèche précédente, puis
  `5 → 10 → 15 → 20` et blocage de la flèche suivante. Les valeurs et
  descriptions ont été confirmées dans l'arbre d'accessibilité Android.

final result: passed
