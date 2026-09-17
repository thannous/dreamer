# Revue des relances de Raconter — 17 septembre 2026

## Conclusion

Alignement après correction : aider à déposer fidèlement un souvenir, même minime, et laisser à la personne la direction et la fin du récit. Le rappel ne doit devenir ni un questionnaire exhaustif, ni un récit à améliorer, ni une interprétation.

Sources : [contrat de marque](../../../specs/noctalia-brand-contract.md), en particulier la promesse Journal, la réflexion facultative, le fragment sauvegardable et la séparation observation/hypothèse ; [noyau du rappel](../../../lib/dreamRecallAssistant.ts), qui distingue récit original, réponses, questions et limites de relance. Les anciens détails de parcours après sauvegarde ne remplacent pas le parcours Raconter approuvé actuellement.

| Principe | Consigne retenue |
| --- | --- |
| Un fragment suffit | Une image, une atmosphère ou une scène immobile est un récit valable ; aucune exigence de longueur ou de complétude. |
| Fidélité au rêve | Ne pas réparer sa logique, ses contradictions ou sa chronologie. Préserver les rôles et l’incertitude. |
| La personne mène | Suivre ses corrections et changements de sujet ; ne pas la ramener au détail choisi par le modèle. |
| Une aide légère | Une seule invitation concrète si elle est utile, sans questionnaire à remplir ni pression pour chercher davantage. |
| Aucun souvenir suggéré | Ne proposer ni réponse ni événement supposé ; clarifier seulement une ambiguïté nécessaire. |
| Raconter avant réfléchir | Aucune signification symbolique, explication psychologique ou association imposée avec la vie réelle. |
| Savoir s’arrêter | Ne pas multiplier les descriptions d’apparence déjà données ; arrêter sans remplir les cinq questions possibles. |

## Corrections de la candidate précédente

La recherche de détails manquants devenait trop proche d’une liste de cases à compléter. La préférence pour actions et suite pouvait imposer une narration à un rêve immobile. Ces deux règles sont remplacées par une ouverture facultative, guidée par le souvenir et l’intention exprimée. Les contraintes anti-répétition, de vocabulaire simple et de réponse courte restent.

## Validation et livraison

- Huit tests techniques de route passent ; typage de capture-recall validé. Ces tests simulés ne mesurent pas la qualité sémantique du modèle.
- Modèle par défaut : Gemini 3.5 Flash-Lite ; sortie maximale 256 tokens ; pas d’appel de réécriture ni de critique supplémentaire.
- Déploiement autorisé explicitement par l’utilisateur après cette revue. Paquet préparé à partir de la fonction déployée v3 : seuls api/routes/recall.ts et api/lib/models.ts changent ; les quinze autres fichiers et verify_jwt=false (authentification interne) sont conservés.
- La lecture du contrat produit ne constitue pas une validation scientifique du rappel de rêve. La qualité réelle et les limites du modèle restent à observer.

## Preuve de déploiement

- Projet Noctalia usuyppgsmmowzizhaoqj ; seule fonction capture-recall déployée, v4 ACTIVE. SHA du paquet serveur : 6437fff623efdc156fed6210566c7ada1c815b03c52005ceced4cffc34eb7af1.
- Relecture distante après déploiement : api/routes/recall.ts et api/lib/models.ts correspondent exactement aux sources préparées du commit bf0f364c0. Modèle de rappel par défaut : gemini-3.5-flash-lite ; surcharges serveur éventuelles non inspectées.
- Requête HTTP synthétique non authentifiée sur /recall-question : 401 Missing guest fingerprint, confirmant que la route déployée répond et conserve son contrôle d’accès. Aucun appel Gemini authentifié n’a été réalisé pendant cette vérification ; pas de preuve sémantique en conditions réelles revendiquée.
- Aucun rêve personnel envoyé par les tests, aucune autre fonction ni table modifiée, aucune publication native. Les prochaines requêtes de relance utiliseront la fonction mise à jour ; une question déjà affichée ne change pas rétroactivement.
