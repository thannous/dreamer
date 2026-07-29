# Noctalia — Guide du Flow Magnific « Create your camera path »

Derniere verification: 2026-07-28.

Flow: [Create your camera path](https://www.magnific.com/app/tools/flow/ykUPW9xJIV)
Identifiant Magnific: `ykUPW9xJIV`
Createur: `sergiovillar` — Flow public, non possede par Noctalia.

## Objectif

Ce Flow transforme une image fixe en un plan video continu en suivant un trajet de
camera decrit en texte. Il est adapte aux videos Noctalia dans lesquelles la camera
part d'une chambre, plonge dans un portail de reve et explore un environnement
visuellement coherent.

Le Flow doit rester un outil d'exception pour les plans ou le mouvement de camera
est le principal effet spectaculaire. Il ne remplace pas le modele de production
standard pour les videos simples ou les essais exploratoires.

## Capacites confirmees

Le Flow expose deux entrees obligatoires:

1. **Image**: une creation image deja presente dans Magnific.
2. **Camera path**: une description libre du trajet de camera.

Il produit une video de **5 a 15 secondes**.

Le cout affiche lors de la verification est de **8 515 credits par execution**.
Ce tarif peut changer: toujours relire la fiche du Flow et le solde du compte avant
de lancer une production.

La fiche ne fournit pas de controle separe pour:

- la resolution de sortie;
- le format d'image;
- l'audio ou la musique;
- un negative prompt;
- une image de fin;
- un seed reproductible.

En consequence, le format vertical doit etre impose principalement par l'image de
depart en `9:16`. La presence et la qualite de l'audio doivent etre controlees sur
le rendu; elles ne doivent pas etre supposees.

## Quand utiliser ce Flow

Utiliser le Flow lorsque:

- le concept repose sur un seul mouvement de camera continu;
- l'image contient une profondeur claire et plusieurs reperes spatiaux;
- la camera doit traverser un portail, longer un objet, tourner autour d'un sujet
  ou survoler un decor;
- l'image de depart est deja validee et le concept justifie le cout;
- une seule execution bien preparee peut suffire.

Ne pas l'utiliser lorsque:

- le concept demande plusieurs univers sans liaison spatiale;
- le resultat depend surtout de transformations de personnages ou d'objets;
- plusieurs essais sont encore necessaires pour definir l'esthetique;
- une video moins couteuse peut produire le meme mouvement;
- l'image contient du texte, un visage identifiable ou une geometrie ambiguë.

## Organisation Magnific pour Noctalia

Avant toute video, ranger l'image source dans:

`Mois 1 — Reves & cauchemars viraux / 01 — Assets mutualises`

Creer ensuite un dossier de concept dedie dans la semaine correspondante et y
classer:

- la fiche du concept;
- le prompt anglais final;
- l'image source retenue;
- le rendu brut du Flow;
- l'export final controle.

Ne jamais ecraser une image ou une video existante. Conserver les variantes
ecartees avec une annotation descriptive si elles ont consomme des credits.

## Preparation de l'image de depart

L'image doit deja contenir le hook visuel. Le Flow anime une scene; il ne faut pas
attendre plusieurs secondes avant que le reve commence.

Pour une « plongee Noctalia »:

- image verticale `9:16`;
- personne adulte endormie, vue de dos ou visage completement masque;
- portail ou anomalie visible des la premiere image;
- portail assez grand pour devenir la direction naturelle de la camera;
- avant-plan, plan intermediaire et arriere-plan bien separes;
- chemin libre entre la camera et le portail;
- eclairage cinematographique avec contraste lisible sur mobile;
- aucun texte, sous-titre, logo, CTA, watermark ou interface;
- anatomie, mains et objets controles avant de depenser les credits du Flow.

Une image avec un portail trop petit, un decor plat ou des obstacles contradictoires
augmente le risque de trajectoire instable.

## Structure recommandee du camera path

Les instructions doivent etre redigees en anglais et decrire une trajectoire
physique, pas seulement une ambiance.

Structure:

```text
Start at [initial framing and height].
Immediately [first camera action and visual hook].
Move [direction, speed and distance] toward [clear spatial landmark].
Pass [above/below/between/through] [second landmark].
Then [turn/orbit/rise/dive] toward [final landmark].
Accelerate during the final seconds and end on [distinct final composition].
One continuous cinematic shot with smooth coherent motion.
[Visual and safety constraints].
```

Toujours preciser:

- l'action des `0–1 s`;
- la direction: forward, left, right, upward ou downward;
- la hauteur relative: floor level, above the bed, beneath the bridge, etc.;
- les reperes traverses dans leur ordre;
- les changements de vitesse;
- le cadrage final;
- l'absence de retour, boucle ou reset.

Eviter:

- « make it viral » ou « make it epic » sans instruction spatiale;
- plusieurs directions simultanees;
- un changement de decor sans portail ou transition physique;
- une liste excessive d'objets;
- des coupes de montage dans un Flow concu pour un trajet continu.

## Prompt maitre Noctalia

```text
Start exactly from the provided vertical image, with the camera slightly above
the sleeping person's shoulder. The impossible portal is already active at frame
one. Immediately accelerate forward, skim above the bed without revealing the
sleeper's face, and enter the center of the luminous portal within the first
second. Continue in one uninterrupted movement through the environment visible
inside it, passing between the nearest landmarks before banking upward. Increase
speed and visual scale during the final three seconds, then end on a wide,
spectacular view of the deepest part of the dream world. The final composition
must be clearly different from the bedroom opening. One continuous cinematic
camera path, smooth coherent geometry, photorealistic dream atmosphere. No cuts,
return, loop, reset, freeze, text, subtitles, logo, CTA, interface, watermark,
identifiable face or violence.
```

## Variantes de trajectoire

### Plongee directe

```text
Immediately dolly forward over the bed and dive through the circular portal.
Skim just above the dream landscape, pass between two large foreground landmarks,
then rise sharply during the final three seconds and end on a vast aerial reveal.
```

### Orbite puis passage

```text
Begin with a fast quarter-orbit around the sleeping silhouette while keeping the
face hidden. Align with the luminous portal, accelerate through its center, curve
around the main dream landmark, then end behind it on a new expansive horizon.
```

### Vol rasant puis ascension

```text
Enter the portal within the first second, descend to ground level, travel rapidly
along the luminous path between the trees, then tilt upward and climb above the
canopy. End on the cosmic sky and distant floating worlds, never returning to the
opening room.
```

## Procedure dans Magnific

1. Ouvrir le Flow « Create your camera path ».
2. Choisir l'image validee depuis les creations Magnific.
3. Coller le camera path final en anglais.
4. Verifier que l'image est verticale et qu'aucun visage ou texte indesirable
   n'est visible.
5. Relire le cout affiche et le solde de credits.
6. Obtenir une autorisation explicite pour cette execution.
7. Lancer une seule generation.
8. Attendre la fin du rendu et le classer dans le dossier du concept.
9. Controler le fichier avant toute autre generation ou publication.

## Procedure avec le connecteur Magnific

Sequence logique:

1. Lire le Flow avec `flows_get` pour verifier ses entrees et son cout courant.
2. Retrouver l'image avec `creations_search`, ou importer une image si necessaire.
3. Appeler `flows_run` avec:
   - l'identifiant de la creation image;
   - le camera path en anglais.
4. Afficher le resultat avec `creations_show`.
5. Attendre le statut terminal et verifier le rendu.

Les identifiants techniques des champs ne doivent pas etre copies durablement dans
un script: ils doivent etre relus avec `flows_get`, car un Flow public peut evoluer.

## Controle qualite du rendu

Verifier au minimum:

- duree comprise entre 5 et 15 secondes, cible Noctalia: `10,0 s`;
- format vertical reel, sans bandes ni recadrage destructeur;
- hook impossible visible des la premiere image;
- entree dans le portail avant `1,0 s`;
- trajectoire lisible, fluide et continue;
- acceleration ou changement d'echelle pendant les trois dernieres secondes;
- absence de visage identifiable;
- absence de texte, logo, CTA, watermark ou interface;
- geometrie stable et absence d'objets qui se dupliquent;
- derniere image nettement differente de la premiere;
- aucune boucle, retour a la chambre, freeze ou end card;
- audio present et exploitable, s'il a ete genere;
- absence de coupure audio brutale.

Si le rendu echoue sur le visage, le texte ou la lisibilite du trajet, ne pas tenter
de le reparer par une nouvelle execution immediate. Corriger d'abord l'image source
ou simplifier le camera path, puis demander une nouvelle autorisation de depense.

## Regle de decision

Avant de depenser 8 515 credits, les trois conditions suivantes doivent etre
reunies:

1. l'image source est visuellement validee;
2. le chemin peut etre decrit comme une trajectoire spatiale unique;
3. le gain attendu sur le mouvement de camera justifie le cout par rapport a un
   modele de production standard.

Par defaut, tester ce Flow sur **une seule video de reference** avant de l'etendre
a une serie. Ne jamais lancer plusieurs variantes en parallele sans validation du
premier rendu.
