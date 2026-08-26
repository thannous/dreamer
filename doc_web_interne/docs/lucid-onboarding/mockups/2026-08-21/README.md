# Maquettes — onboarding Lucid Trainer

Archive locale durable des références reçues le 21 août 2026 et des preuves Android associées. Les noms sont indexés par numéro d’étape pour rester faciles à retrouver.

## Références visuelles

- [Étape 1 — pratique en trois moments](./01-practice-three-moments.png)
- [Étape 2 — nouveau décor neutre à quatre destinations](./02-waypoints-generation.png)
- [Étape 3 — niveaux d’expérience](./03-experience-levels.png)
- [Étape 4 — rythme hebdomadaire](./04-weekly-rhythm.png)
- [Étape 5 — fenêtre de sommeil](./05-sleep-window.png)

## Preuves de l’étape 3

- [Capture finale sur Motorola](./03-motorola-final.png)
- [Comparaison référence / Motorola](./03-reference-vs-motorola.png)
- [Prompt et provenance de l’asset lunaire](./03-experience-moon-prompt.md)

Contrat vérifié : les trois contrôles restent des radios natifs accessibles, leurs `testID` sont inchangés, leur ordre TalkBack reste `Débutant`, `Occasionnel`, `Régulier`, et aucun conteneur de l’étape n’est scrollable dans la disposition normale. Chaque lune est centrée sur son socle en pierre et son texte est centré dessous. La lune est un asset neutre transparent ; l’anneau et le halo sélectionnés restent des couches React Native. La capture finale inclut le passage de lisibilité : sous-titres plus clairs et plus soutenus, ombre de texte discrète, voile nocturne légèrement renforcé uniquement sur cette étape.

## Preuves de l’étape 1

- [Capture finale sur Motorola](./01-motorola-final.png)
- [Capture émulateur au format cible 393 × 850 dp](./01-emulator-393x850.png)
- [Comparaison référence / Motorola](./01-reference-vs-motorola.png)
- [Prompt et provenance du décor](./01-background-prompt.md)
- [Prompt et provenance de l’icône de réveil](./01-moment-wake-icon-prompt.md)
- [Génération brute de l’icône de réveil](./01-moment-wake-icon-generation.png)

Contrat vérifié : le décor est un raster neutre sans interface incrustée. La progression, les trois pictogrammes fins (soleil, lune étoilée et horizon de réveil) et le CTA restent des couches React Native ; le CTA conserve `lucid-onboarding-continue`, une hauteur de `60dp`, un libellé centré et une cible tactile distincte pour son disque visuel. Le pictogramme de réveil est un asset transparent neutre dont la teinte reste pilotée par la palette. Le titre garde sa formulation persistée et accessible sur une seule annonce, avec la césure visuelle de la maquette. Aucun nœud n’est scrollable dans la disposition Motorola normale et un glissement vertical laisse l’arbre d’accessibilité inchangé.

## Preuves de l’étape 2

- [Génération brute du décor à quatre destinations](./02-waypoints-generation.png)
- [Capture finale sur émulateur 393 × 850 dp](./02-emulator-393x850-final.png)
- [Capture polie — pictogrammes fins et sélection elliptique](./02-emulator-393x850-polished.png)
- [Capture finale artistique — bulle d’énergie](./02-emulator-393x850-energy-bubble.png)
- [Capture finale intégrée — horizon énergétique](./02-emulator-393x850-integrated-horizon.png)
- [Capture finale affinée — dalle énergétique](./02-emulator-393x850-energy-slab.png)
- [Prompts et provenance](./02-waypoints-prompt.md)

Les quatre grottes de la première version sont remplacées par quatre socles de pierre ouverts, alignés sous la grille native. Le raster ne contient aucune icône ni sélection. Les quatre options restent des radios accessibles à sélection unique, avec leurs IDs persistés et leurs `testID` `lucid-goal-*`. Les pictogrammes Feather partagent un trait fin homogène et restent ivoire sur les dalles inactives. L’état actif devient une charge d’énergie elliptique contenue dans la perspective de la pierre, avec profondeur radiale, arcs lumineux, particules, filament de contact et reflet discret. Son symbole actif est renforcé et son libellé devient menthe ; le reflow conserve un indicateur explicite autonome. Sa respiration est finie, exécutée sur le thread UI et neutralisée lorsque la réduction des animations est active. Aucun tracé natif n’est superposé au chemin peint : une première tentative créait une diagonale artificielle et a été retirée après inspection Android. Les libellés et les zones tactiles restent en React Native. La disposition normale ne contient aucun nœud scrollable.

## Ambiances globales de l’application

Les quatre palettes ne sont pas limitées à l’onboarding. Le choix `Dynamique`
pilote les tokens `StyleSheet`, les variables Uniwind, les surfaces, la
navigation, les icônes et les actions de toute l’application selon l’heure
locale, sans accès à la position :

- `05:00–08:59` : lumière douce du matin ;
- `09:00–16:59` : lumière claire ;
- `17:00–20:59` : afterglow ;
- `21:00–04:59` : nuit.

Preuves Android au format cible :

- [Choix de l’horizon — nuit](./02-emulator-393x850-theme-dark.png)
- [Choix de l’horizon — clair](./02-emulator-393x850-theme-light.png)
- [Choix de l’horizon — matin](./02-emulator-393x850-theme-morning.png)
- [Choix de l’horizon — afterglow](./02-emulator-393x850-theme-afterglow.png)
- [Accueil complet — matin](./00-app-today-morning.png)
- [Réglages complets — afterglow](./00-app-settings-afterglow.png)

Les captures hors onboarding vérifient que les deux nouvelles ambiances
recolorent aussi le chrome de l’app et les écrans standards. L’option
`Automatique` reste distincte : elle suit le thème clair/sombre du système,
tandis que `Dynamique` suit les quatre plages horaires ci-dessus. Les liens de
prévisualisation `?ambience=` sont compilés uniquement en développement et ne
modifient jamais la préférence persistée.

## Preuves émulateur au format cible

- [Étape 3 — niveaux d’expérience](./03-emulator-393x850.png)
- [Étape 4 — rythme hebdomadaire](./04-emulator-393x850.png)
- [Étape 5 — fenêtre de sommeil](./05-emulator-393x850.png)
- [Étape 5 — sélecteur d’heure Android natif](./05-emulator-time-picker.png)

L’AVD `shapier_360dp_api36` a été calibré temporairement à `1080 × 2340`, densité `440` et texte `100 %`, soit environ `393 × 850 dp`. Dans cette disposition normale, les cinq étapes restent fixes. Le fallback 360 dp ou texte 130 % conserve volontairement son `ScrollView` pour éviter les troncatures d’accessibilité.

## Preuves de l’étape 5

- [Capture finale sur Motorola](./05-motorola-final.png)
- [Sélecteur d’heure Android natif](./05-android-time-picker.png)
- [Comparaison complète référence / Motorola](./05-reference-vs-motorola.png)
- [Comparaison ciblée des contrôles et textes](./05-controls-comparison.png)

Contexte de validation : Motorola Edge 60 Fusion, `1220x2712`, densité `450`, locale française. L’étape 5 a été vérifiée avec les heures `22:30` et `07:00`.
