# TI-559 — Conversation optimisée de 20 échanges réels

## Résultat et portée

20 appels Gemini réellement effectués le 9 septembre 2026, avec un seul récit fictif français. Chaque réponse nouvelle alimente le tour suivant : ce n’est pas le replay des anciennes réponses. Modèle `gemini-3.5-flash-lite`, réflexion `minimal`, plafond de sortie 2048 tokens, `store:false`. Les fonctions de contexte, d’historique et l’adaptateur sont ceux de master `5cdc0f328` ; aucune modification du code produit dans ce lot.

Revue indépendante : acceptation fonctionnelle bornée de cette conversation. Les rappels aux tours 5, 10, 15, 19 et 20 préservent l’association avec la grand-mère et distinguent couleur initiale, correction et inconnues. Le tour 16 refuse le diagnostic ; le tour 17 traite la citation comme une citation. Réserve mineure au tour 4 : « cet espace » suggère légèrement un espace derrière la porte inconnue. Cette fixture ne prouve pas une fidélité universelle ou la qualité dans les autres langues.

| Mesure | Valeur |
|---|---:|
| Appels réservés / réponses complètes | 20 / 20 |
| Premier texte médian | 694 ms |
| Premier texte maximal | 891 ms |
| Réponse complète médiane | 1 056,5 ms |
| Réponse complète maximale | 1 324 ms |
| Tokens entrée / réponse | 26 930 / 719 |
| Tokens réflexion / cache | 0 / 0 |

Tous les premiers textes sont sous 2 secondes dans ce petit échantillon. Mesure locale SDK → fournisseur : elle exclut authentification, base de données, réseau mobile et rendu Android. Pas de comparaison statistique contrôlée avec les anciennes mesures, ni garantie de latence en production.

## Limite technique révélée par l’instrumentation

Les événements streaming montrent **20 étapes de pensée et 20 deltas de signature**, malgré zéro token de réflexion déclaré. L’événement final ne fournit pas de parties exploitables à `extractModelParts` : les 20 réponses passent par le repli texte, et les signatures ne sont pas réinjectées. Leur présence est comptée sans sauvegarder leur contenu opaque.

La documentation Interactions exige de préserver les étapes et signatures lorsqu’elles sont émises en mode stateless : [génération de texte](https://ai.google.dev/gemini-api/docs/interactions/text-generation) et [streaming](https://ai.google.dev/gemini-api/docs/interactions/streaming), consultées le 09/09. La réussite de ce run ne valide donc pas ce contrat. Le zéro étape rapporté par les anciens probes venait du seul objet final et ne prouvait pas une absence dans le flux. **TI-559 reste ouvert** pour cette dette, la fidélité des analyses et la chaîne HTTP/DB/mobile ; ne pas confondre l’acceptation textuelle de cet essai avec une qualification technique complète.

## Reproductibilité et sécurité du run

Le harnais reprend uniquement le récit et les 20 messages utilisateur de la fixture antérieure. La revue vérifie que les réponses nouvelles 1–19 sont bien les dernières réponses modèle des inputs suivants. Fenêtre de 20 messages récents et notes utilisateur anciennes bornées à 8000 caractères via `buildChatHistory`.

Un seul dispatch autorisé par tour, 20 maximum, réservation persistée avant l’appel, aucun retry/fallback. Répertoire de sortie exclusif, sans reprise ou écrasement. Clé Dreamweaver existante utilisée uniquement en mémoire après autorisation ; aucun récit privé, aucune configuration de production et aucun déploiement.

Commandes : `npm run reflection:chat:20:check`, `npm run reflection:chat:20:preview` (sans génération), `npm run reflection:chat:20:run` (appels réels, dossier existant bloquant un second run). Check, preview et diff-check revus indépendamment.

Preuves synthétiques : [inputs](ti559-chat20-optimized-2026-09-09/inputs.json), [résultats](ti559-chat20-optimized-2026-09-09/results.json), [reçu](ti559-chat20-optimized-2026-09-09/request-count.json). Les anciennes preuves restent intactes.
