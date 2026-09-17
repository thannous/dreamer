# TI-559 — Politique concise et fidélité du récit

## Résultat

La politique finale `analysis-2026-09-09.4` est envoyée une seule fois dans le message système. Le prompt définit les champs sans répéter cette politique ni accumuler les exemples particuliers. Les observations demandent de courts extraits du récit ; les commentaires émotionnels citent le passage correspondant. Les associations personnelles restent facultatives et séparées des faits.

Texte de consignes (politique système + prompt anglais sans récit, hors préambule localisé et schéma identiques) : **6 809 → 2 715 caractères, -60 %**. Sur les 12 cas, les tokens d'entrée mesurés passent de **17 518 (.2) à 8 686 (.4)**, sortie **4 721 → 3 924**. Cela inclut le corpus et le schéma, sans preuve de gain de latence ou de coût Codex.

**12/12 réponses finales acceptées pour leur fidélité narrative par la revue indépendante Astra low**, corroborées par le parent. Cette preuve est bornée à cette exécution du corpus ; elle ne garantit pas les sorties futures.

## Méthode et preuves

- Corpus inchangé : 12 récits synthétiques, 6 langues, dont troncature effective au-delà de 6 000 caractères.
- Même modèle `gemini-3.8-flash`, `low`, 4 096 tokens maximum, `store:false`, appel réel via `runDreamAnalysis`.
- Deux lots bornés à 12 appels chacun, sans second envoi pour un même cas, sans écrasement d'un run consommé. Clé Dreamweaver existante, utilisée en mémoire, aucun récit utilisateur privé ni déploiement.
- Comparaison historique .2 : [résultats](ti559-completion-evaluation-2026-09-09/results.json), 12 lignes `after` retenues.
- Premier essai court .3 : [résultats](ti559-compact-v3-2026-09-09/results.json), [compteur](ti559-compact-v3-2026-09-09/request-count.json). Rejeté : DE réveil/protection ajoutés, IT relation fenêtre/lumière inventée ; titre FR ambigu à améliorer.
- Final .4 : [résultats](ti559-compact-v4-2026-09-09/results.json), [compteur](ti559-compact-v4-2026-09-09/request-count.json). Chaque corps de requête synthétique, version, sortie brute textuelle, résultat rendu et usage est conservé. Aucun en-tête d'authentification ni signature de réflexion fournisseur n'est enregistré.
- La référence .2 est figée dans `completion-candidate.ts` pour préserver le harnais historique. Les entrées effectives .3 restent intégralement dans les preuves.
- Comparaison de régression avec sorties historiques, **pas un essai randomisé ni une mesure statistique**. Aucun changement manuel des réponses fournisseur.

## Grille indépendante du lot final

| Cas | Conclusion sur le texte analytique |
|---|---|
| EN cauchemar | Terreur citée sans la prolonger au réveil ; questions sans récupération présupposée. |
| FR gare | Chronologie, curiosité et enveloppe fermée préservées ; hypothèses séparées. |
| ES diagnostic | Pas de diagnostic attribué ; limites explicites. |
| DE jardin | Aucun réveil causé par l'alarme ajouté ; protection proposée comme association, pas intention avérée. |
| IT fenêtre | Fenêtre et lumière demeurent distinctes dans l'analyse. |
| PT instructions | Texte hostile traité comme récit ; souvenir partiel respecté. |
| EN tasse | Aucun événement ou émotion ajouté. |
| FR silhouette | Alternative silhouette/ombre et incertitude spatiale conservées, titre compris. |
| ES récit long | Avertissement d'extrait affiché ; suffixe exclu absent, succession préservée. |
| DE répétition | Trois tours autour du meuble ne deviennent pas un rêve récurrent. |
| IT émotions | Émotions inconnues, tableau vide. |
| PT affiche | Aucune confirmation de contrôle mental ou prédiction. |

Types attendus 12/12, citations partageables exactes ou vides 12/12 ; cas sans émotion rapportée conservés avec tableaux vides.

## Validation et limites

- **185 tests Deno** passent avec les permissions CI (`--frozen --allow-env --allow-read=../migrations`).
- **2 tests Node** des lanceurs passent ; isolation de l'environnement et destination fixe vérifiées.
- `deno check --frozen` des quatre points d'entrée Edge passe.
- Test de la requête réelle interceptée pour les six langues : politique présente une seule fois dans le message système, `store:false`, récit JSON conservé, citations non verbatim rejetées et avertissement de troncature ajouté par le serveur.
- Revue indépendante du code, du budget d'appels et de toutes les sorties .2/.3/.4 ; acceptation de cette correction ciblée seulement.
- Seule la citation partageable est contrôlée mécaniquement. Les observations et émotions restent des instructions au modèle, vérifiées empiriquement ici ; quelques introductions sont des paraphrases fidèles.
- Les `imagePrompt` conservent des précisions artistiques (lumière dans la fenêtre, ligne sur le mur). **Pas de validation de fidélité stricte de l'illustration** ; elle reste une création et ne justifie aucun fait analytique.
- Aucun journal existant n'est régénéré, aucune migration ni modification des modèles/configurations de production.

## Suivi

À la demande du propriétaire, **TI-598** porte désormais les 20 échanges signés réels, la réponse vide du tour7/récupération, la latence affichée et le parcours Android/persistance. TI-559 conserve la qualité de la réflexion et sa livraison validée. PR165 contient encore des modifications de chat à revoir globalement ; cette revue ciblée ne certifie ni cette PR entière ni un déploiement Edge.
