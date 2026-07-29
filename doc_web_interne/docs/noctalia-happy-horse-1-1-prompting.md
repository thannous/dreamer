# Noctalia — base de prompting Happy Horse 1.1

Dernière vérification : 28 juillet 2026.

Cette fiche est la référence de production pour les prochaines vidéos organiques
Noctalia générées à partir d'une image avec Happy Horse 1.1.

## Principe directeur

L'image décrit l'esthétique. Le prompt Happy Horse dirige le mouvement, le
temps et le son.

Ordre recommandé :

1. action du sujet ;
2. évolution de l'environnement ;
3. mouvement de caméra ;
4. climax final ;
5. audio ;
6. absence de dialogue.

Ne pas redécrire le personnage, la chambre, la lumière, les couleurs ou le
cadrage déjà présents dans l'image de départ. Ne pas ajouter d'instruction
relative au visage, au profil ou à l'identifiabilité dans le prompt.

## Répartition des rôles

### ImageGen

Le prompt ImageGen porte l'identité visuelle complète :

> Cinematic, high-end photography; spontaneous, lived-in action;
> character-driven storytelling with emotional stakes; grainy 35mm film
> texture, rich contrast, natural light, authentic atmosphere.

Produire une image verticale 9:16 propre, forte dès la première frame, sans
texte, logo, sous-titre, interface ni watermark. Inspecter l'image avant toute
génération vidéo.

### Happy Horse 1.1

Le prompt vidéo décrit principalement :

- l'action active dès l'ouverture ;
- le portail atteint et franchi presque immédiatement ;
- une trajectoire spatiale unique et continue ;
- l'accélération et la transformation de l'univers ;
- un climax nettement différent de l'ouverture ;
- les couches audio synchronisées.

Si un rappel esthétique est nécessaire, utiliser seulement :

> Preserve the reference image's natural cinematic 35mm appearance.

## Direction « évasion, rêverie, sublime »

Pour les séries orientées vers l'émerveillement, construire le voyage comme
une invitation plutôt que comme une fuite :

- ouvrir sur un mouvement calme, curieux et immédiatement attiré par le
  portail ;
- faire de l'accélération une aspiration fluide vers un horizon, jamais une
  poursuite agressive ;
- privilégier les espaces vastes, l'élévation, la lumière naturelle
  transcendante, les matières aériennes et la sensation de liberté ;
- employer une transformation progressive et lisible qui fait passer le
  familier vers le merveilleux ;
- réserver les dernières secondes à un climax expansif, lumineux et
  contemplatif, nettement différent de la chambre ;
- conserver une présence sonore proche au départ, puis ouvrir l'espace avec
  des résonances aériennes, aquatiques ou harmoniques sans voix.

Vocabulaire utile :

- `an inviting pull toward the horizon` ;
- `effortless forward glide` ;
- `gentle but continuous acceleration` ;
- `vast luminous space` ;
- `serene sense of elevation and freedom` ;
- `awe-filled dreamlike crescendo`.

Éviter les formulations qui induisent la panique, la menace, l'impact violent
ou une accélération chaotique. Le sublime doit rester physique, lisible et
accueillant.

## Réglages Noctalia

- Mode : Image-to-video
- Modèle : Happy Horse 1.1
- Format : 9:16
- Résolution : 1080p
- Durée demandée : 12 secondes
- Audio natif : activé
- Référence : une seule image de départ par plongée
- Montage : un plan continu, sans coupe

Happy Horse 1.1 prend en charge les clips de 3 à 15 secondes, le 9:16, le
1080p, l'image-to-video et l'audio natif. Ces capacités doivent être revérifiées
dans le catalogue Magnific avant chaque lot payant, car les modèles, paramètres
et coûts peuvent évoluer.

Source officielle :
[Happy Horse 1.1 Guide — Magnific](https://www.magnific.com/blog/happy-horse-1-1-guide/)

## Progression cible sur 12 secondes

- Ouverture : action subtile mais déjà engagée à la première image.
- Avant 1 seconde : activation du portail et arrivée de la caméra à son seuil.
- Milieu : franchissement, accélération progressive et transformation majeure.
- Dernières secondes : climax spectaculaire, nettement différent de
  l'ouverture.
- Dernière image : la caméra avance encore ; aucun retour, boucle, reset,
  freeze, fondu ou end card.

Les repères temporels sont des objectifs de mise en scène interprétés par le
modèle, pas des garanties à l'image près.

## Règles de mouvement

- Utiliser une seule trajectoire de caméra précise.
- Préférer : `The camera immediately glides forward, enters the portal, then
  accelerates continuously through...`
- Éviter les combinaisons incompatibles de mouvements de caméra.
- Conserver une action principale par phase.
- Employer des indications physiques utiles : `physically grounded motion`,
  `realistic fabric movement`, `volumetric particles rushing past the lens`,
  `increasing forward momentum`, `stable spatial continuity` et `natural
  parallax`.

## Construction de l'audio

Décrire séparément :

1. le son proche de la chambre ;
2. la résonance du portail ;
3. l'ambiance du nouvel univers ;
4. la montée sonore du climax ;
5. `No dialogue.`

Exemple :

> Audio: soft breathing and fabric rustle at first, followed by a deep portal
> resonance, rushing crystalline wind and a powerful dreamlike crescendo. No
> dialogue.

## Gabarit de production

```text
Opening action: The scene is already in motion from the opening frame: [subtle immediate action]. Within the first second, [the dream portal activates and the camera reaches it].

Environment transformation: Beyond the portal, [describe the dream universe through motion and transformation]. [Describe one major environmental evolution].

Camera: The camera immediately glides forward and passes through the portal in one continuous uninterrupted movement. The forward momentum progressively accelerates, with natural parallax, physically grounded movement and stable spatial continuity.

Final climax: The journey culminates in [a final spectacular transformation clearly different from the opening scene]. The camera continues forward through the final moment, with no cuts, no return, no loop, no freeze and no end card.

Preserve the reference image's natural cinematic 35mm appearance.

Audio: [opening room sounds], transitioning into [portal sound], then [universe ambience and final crescendo]. No dialogue. No captions, titles, logos or interface elements.
```

## Contrôle avant dépense

1. Vérifier le catalogue du modèle, les paramètres exposés et le coût courant.
2. Confirmer le nombre exact d'exécutions autorisées.
3. Générer et inspecter toutes les images séparément.
4. Importer et classer les images.
5. Lancer les vidéos en parallèle seulement après validation de toutes les
   images.
6. Ne jamais ajouter un essai sans nouvelle autorisation.

## Orchestration multiagent

Pour un lot important, utiliser un orchestrateur et plusieurs agents de
concept :

1. l'orchestrateur réserve les identifiants, thèmes, chemins et dossiers ;
2. chaque agent génère et inspecte une image dans un espace de fichiers
   distinct ;
3. les agents rendent leur image, leur prompt final et leur verdict sans
   lancer de dépense vidéo ;
4. l'orchestrateur rassemble toutes les images, vérifie le catalogue, le coût,
   le solde et le nombre exact d'exécutions autorisées ;
5. les vidéos sont soumises en parallèle depuis un seul point de contrôle ;
6. la QA technique et visuelle peut ensuite être redistribuée par concept ;
7. l'orchestrateur produit le rapport consolidé.

États conseillés par concept :

`PLANIFIÉ → IMAGE_CRÉÉE → IMAGE_VALIDÉE → IMPORTÉE → VIDÉO_PRÊTE →
VIDÉO_LANCÉE → VIDÉO_TERMINÉE → QA_TERMINÉE`

La frontière entre `VIDÉO_PRÊTE` et `VIDÉO_LANCÉE` est le garde-fou financier
global. Aucun agent de concept ne doit consommer de crédits de façon autonome.

## Contrôle après génération

Pour chaque vidéo :

- inspecter visuellement le début, la transition, la trajectoire et le climax ;
- vérifier l'absence de texte, logo, interface ou end card ;
- mesurer durée, dimensions, cadence et codecs ;
- vérifier la présence et le niveau de l'audio natif ;
- détecter les gels anormaux ;
- classer le rendu dans son dossier de concept ;
- consigner le coût observé et tout écart au brief ;
- ne pas publier ni créer de campagne sans autorisation distincte.
