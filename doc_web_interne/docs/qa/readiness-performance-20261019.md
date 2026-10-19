# Disponibilité des données et accès à la page — 19 octobre 2026

## Périmètre et autorisation

Suite de la PR #439, déjà commitée et poussée à `d2b22221b`. Master de départ `967fe81f0` ; checkout principal et ses modifications en cours préservés. Implémenter le court terme, mesurer puis retirer les attentes de présentation avérées. Aucun déploiement, build EAS, publication Store, suppression de compte ou fusion compris dans cette livraison.

Le compte de développement approuvé peut servir aux parcours ; conserver les autres données et nettoyer uniquement les fixtures identifiées. Les mesures antérieures restent dans [le rapport natif](native-performance-20261018.md) ; elles ne valent pas nouvelle exécution.

## Instrumentation initiale

- `journal.save_requested` → `journal.save_acknowledged` : persistance durable, corrélation opaque conservée jusqu’à la page.
- `journal.saved_navigation_started` → `journal.saved_page_committed` → `journal.saved_actions_reveal_elapsed` : route, commit React, fenêtre de révélation des actions écoulée.
- `analysis.result_observed` → `analysis.text_committed` → `analysis.reveal_window_elapsed` : réponse, commit puis fin prévue de la révélation. L’ancien `text_displayed` confondait commit et visibilité.
- `image.result_observed` → `image.reference_committed` → `image.source_resolved` → `image.native_loaded` / `image.native_displayed` : référence, résolution puis événements Expo Image.

Les marqueurs ne prouvent ni la visibilité dans le viewport ni les pixels présentés. Les deux requestAnimationFrame signalent une occasion de présenter une frame, les événements Image sont ceux du composant natif. Les captures et les assertions du parcours complètent cette preuve.

`EXPO_PUBLIC_PERFORMANCE_TRACING=true` active les marqueurs QA, la console et les événements Observe persistés nativement. Sans ce flag, aucun événement ni timer supplémentaire. Attributs Observe limités aux nombres finis et booléens : aucun texte de rêve, UUID, e-mail ou URI. Les préférences de dispatch et l’exclusion de Lucid restent applicables. Un échec de télémétrie ne peut pas interrompre la sauvegarde. Aucun suivi réseau/images global activé.

Le préchargement du journal ne démarre qu’au focus et cesse au blur, y compris après une résolution asynchrone ; les fenêtres et caches restent bornés.

## Vérification et mesures

En cours. Critères : sauvegarde durable avant navigation, lecture et actions accessibles sans dépendre d’une animation décorative ; reprise/erreurs et motion réduite conservées. Les seuils de performance sont des objectifs de travail, pas une preuve en eux-mêmes.

Tests isolés ajoutés seulement pour la confidentialité du payload Observe, la télémétrie optionnelle qui échoue et l’annulation d’un marqueur après départ de l’écran : un parcours UI ne peut pas vérifier ces frontières natives de manière déterministe.

## Corrections après pilote

Le premier parcours a montré 2 077 ms entre insertion DOM et fin de l’opacité masquée, puis un second problème : une intersection du viewport ne suffit pas, car la barre d’actions peut recouvrir le texte. Le protocole ajoute donc un hit test sur la première ligne et ne défile plus depuis le test.

- Le texte et ses chapitres se présentent à l’état prêt ; la constellation garde seule sa chronologie décorative. Suppression de la fonction de délai de chapitres devenue inutilisée.
- La première ligne de l’interprétation, et non le seul début de la constellation, sert d’ancre au défilement automatique. Aucun retour forcé vers le haut si le lecteur est déjà plus bas.
- « Voir mon rêve » est disponible dès que le modal de capture monte après la persistance. Le geste garde une analyse explicitement choisie auparavant ; un verrou empêche une seconde navigation. La cérémonie et son choix normal restent disponibles.
- Le nom déjà transmis, y compris provisoire et sans thème, ne déclenche plus un second nommage. La motion réduite transmet elle aussi le nom local, sans attente IA.
- La page libère le voile après sa mise en page et deux frames, avec le garde-fou historique de 700 ms si le signal n’arrive pas ; le callback est annulé après retrait du propriétaire.

Pilote corrigé (un essai web mock, motion normale) : première action non recouverte 109 ms après l’accusé de sauvegarde ; interprétation non recouverte 144,6 ms après insertion. Échantillon de méthode, pas une mesure native ni un P95 de production. La capture a été inspectée visuellement. Artefact `tools/e2e/.e2e/dreamer-web/1792410184633-5519-5b7af7f5-e8df-432e-87e6-f11c47e0db71`.

11 contrôles isolés passent : confidentialité/télémétrie et identité/expiration/annulation du handoff. Types de l’application, des tests et du runner E2E passent. Répétitions, builds natifs finaux et vérification complète encore à terminer.
