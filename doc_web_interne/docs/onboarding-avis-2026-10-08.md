# Onboarding mobile — avis et refonte (8 octobre 2026)

Avis porté sur la version de `master` (6a05d1aa) et sur les fichiers locaux non suivis de Thanh dans `components/onboarding/` (prototype du 3 octobre : `OnboardingSky`, `OnboardingConstellation`, `OnboardingPathCard`, `OnboardingProgress`, `StepReveal`, `onboardingMotion`). Ces fichiers n'ont pas été modifiés ; la refonte s'en inspire et est réimplémentée dans `components/onboarding/story/`.

## Ce qui marchait déjà

- La promesse « Tes rêves ont une histoire » est juste, courte, et l'illustration nocturne porte la marque mieux que n'importe quel texte.
- Deux écrans seulement, « Passer » toujours visible, aucune saisie obligatoire : le coût d'entrée est faible.
- Le choix du premier pas (explorer, garder un souvenir, symboles) mène directement à de la valeur.

## Ce qui affaiblissait le récit

- **Une liste de fonctions plutôt qu'une histoire.** Raconter / Comprendre / Explorer, avec « Voix et images », « Dialogue guidé », décrivait des écrans. Le trio déjà traduit dans les six langues mais inutilisé, Raconter → Repérer → Relier, raconte la boucle du produit : je note, je remarque, je relie mes nuits.
- **Un décor figé.** L'image est magnifique mais immobile ; la lune, élément central du tableau, ne participait pas.
- **Des transitions plates.** Un fondu de 8 px pour tout : arrivée, changement d'étape, validation. Rien ne disait qu'on avançait dans la nuit.
- **Le choix en bloc.** Les trois chemins dans une seule carte ressemblaient à un formulaire.
- **Grandes tailles de texte.** À 1,5× sur Android, « Comprendre » se coupait en « Comprendr / e ».

## Ce qui a été fait

- Acte I, arrivée : le ciel s'ouvre (léger zoom qui se pose), les étoiles respirent, le titre arrive ligne par ligne, la lune répond par un halo quand « une histoire » apparaît, puis Raconter → Repérer → Relier s'allument en constellation et une étincelle parcourt le fil.
- Acte II, descente : choisir « Commencer » incline la caméra vers le lac ; les chemins montent en trois cartes séparées.
- Acte III, plongée : valider pousse la caméra dans la scène pendant que le texte s'efface.
- Tout reste touchable dès la première image, seules l'opacité et les transformations bougent, et « Réduire les animations » ne garde que des fondus.

## Ce que je ferais ensuite

- Un vrai pont entre l'onboarding et la première capture : reprendre la constellation en en-tête de l'écran Capturer pendant le premier rêve, pour que « Raconter » s'allume quand on écrit.
- Mesurer avant d'aller plus loin : taux de passage de l'étape 1 à 2 et part de « Passer » (les événements `onboarding_step_viewed` et `onboarding_choice_selected` existent déjà).
- Qualifier le motion sur un iPhone et un Android d'entrée de gamme en Release ; il n'a été vu qu'en simulateur et émulateur.
