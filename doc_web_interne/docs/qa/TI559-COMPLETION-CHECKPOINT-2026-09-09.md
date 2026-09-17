# TI-559 — reprise complète, checkpoint du 9 septembre 2026

## État d’acceptation

**TI-559 reste en cours. Ce lot n’est pas accepté pour fusion ou production.** Les agents de revue et QA ont été interrompus par la limite d’usage Codex. Les changements ci-dessous sont sauvegardés pour reprise, pas présentés comme une clôture partielle du ticket.

## Changements

- Version analysis-2026-09-09.2 : citations extraites mot pour mot ou supprimées par validation déterministe ; restriction des conclusions de causalité/chronologie et questions présupposant une récupération.
- Reconstruction ordonnée des événements Interactions streaming et préservation des signatures/summaries dans les parties persistées, y compris le contrat invité et le miroir de type mobile. Aucune pensée n’est envoyée comme delta visible. Un stream interrompu n’est pas validé comme réponse complète.
- Aucune migration générale ni régénération des anciens rêves. Pas de déploiement Edge/Store.

## Preuves obtenues

39 tests backend ciblés passent (Gemini, route chat, analyse, contexte, prompts). 20 tests UI/compatibilité passent (journalDetailSavedConfirmation et dreamAnalysisFreshness). Harnais completion : deux tests Deno et un test launcher Node passent ; preview sans clé réussi. Ces preuves ne remplacent pas la revue indépendante.

### HTTP et base locale

[Résultat](ti559-http-db-2026-09-09/results.json) : 20 échanges via HTTP local, authentification réelle getUser, admissions et complétions via RPC Postgres réelles, 40 messages persistés. Relecture par nouveau client : récit et analyse inchangés, refus et association conservés comme message utilisateur, 20 réponses avec signatures. Doublon servi sans nouveau dispatch ; autre compte refusé. Fournisseur SSE synthétique : **aucune preuve de qualité Gemini par ce test**.

Base existante nommée noctalia-ti528-disposable, ports55321/55322. Nouveaux comptes synthétiques seulement ; données existantes préservées. Seed effectué via postgres pour le seul compte de fixture, avec entitlement Plus synthétique. Les essais préparatoires ont identifié une permission quota_usage insuffisante pour l’insertion directe, l’absence initiale de shareable_quote dans la fixture et la limite gratuite à10 messages de cette base. Les messages normalisés ne sont pas exposés directement : la relecture finale utilise dreams.chat_history comme l’application. Aucun grant ou quota modifié. Les comptes des essais restent exclusivement dans la base jetable.

### Analyse réelle

[24 réponses avant/après](ti559-completion-evaluation-2026-09-09/results.json), [reçu](ti559-completion-evaluation-2026-09-09/request-count.json). Même Flash3.8 low, 12 cas couvrant les six langues, plafond24, aucune relance. Clé Dreamweaver existante autorisée utilisée en mémoire uniquement. Corpus original followup conservé, complété par fragment EN, ambiguïté FR, troncature ES, répétition DE, négation IT, injection citée PT.

Première lecture parent : citations exactes, classifications attendues, absence d’émotions inventées dans les cas sans émotion nommée, notice de troncature et suffixe exclu. Réserves à arbitrer/corriger avant acceptation : EN associe la terreur au réveil dans l’insight ; DE suggère que l’alarme a terminé le souvenir dans les pistes ; PT transforme ponctuellement le souvenir limité en totalité du rêve. La revue qualitative indépendante complète n’a pas eu lieu. Ne pas transformer JSON valide en fidélité validée.

### Chat réel signé

[Résultats](ti559-chat20-signed-2026-09-09/results.json), [inputs expurgés](ti559-chat20-signed-2026-09-09/inputs.json), [reçu](ti559-chat20-signed-2026-09-09/request-count.json). 7 appels réservés ; 6 réponses complètes, premier texte médian756,5ms. Signatures reconstruite et réinjectées exactement via le contrat d’entrée, passage JSON de l’historique entre tours ; aucune signature opaque dans les preuves versionnées.

Tour7 : Gemini annonce completed mais renvoie une étape thought signée sans texte (output_tokens0). Le harnais s’arrête sans retry ni fallback ; **ce run n’est pas une qualification de20 échanges réussis**. Le run PR162 reste sa preuve historique avec l’ancien adaptateur. Il faut diagnostiquer/qualifier ce cas vide et sa récupération sans doublon avant clôture.

## Reprise obligatoire dans ce même ticket

1. Revue indépendante du correctif de signatures, notamment ordre des étapes, bornes guest, compatibilité legacy, modèle/fallback et fragments incomplets.
2. Revue qualitative complète des12 sorties finales ; corriger les réserves factuelles persistantes selon critères du ticket.
3. Qualifier le cas de réponse vide et la reprise du chat signé avec budget explicite et reçu neuf ; ne pas écraser/rejouer automatiquement les runs consommés.
4. QA indépendante Android du parcours concerné (récit/analyse, refus d’une piste, association, réouverture), avec base locale durable ; aucun résultat Android acquis dans cette passe. Émulateur lancé par QA arrêté proprement après interruption, sans effacement.
5. Contrôles finaux, revue PR, fusion autorisée et mise à jour des critères Linear seulement quand réellement satisfaits.

Worktree /private/tmp/noctalia-ti559-complete, branche codex/ti559-complete, base71a675aa6. Dossier principal et son WIP restent intacts. Aucun nouveau chantier à engager avant TI-559.
