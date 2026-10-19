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
