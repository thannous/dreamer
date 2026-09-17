# Autorisations IA et perte d’abonnement — 17 septembre 2026

## Incident et périmètre

Une analyse a été acceptée pendant un abonnement Plus de test, puis sa première image a été demandée après expiration. L’analyse est terminée, mais la ligne `quota_usage` issue du trigger de sauvegarde ne contient aucun `analysis_request_id`. Le worker refuse donc l’image avant tout appel au fournisseur, avec `FREE_IMAGE_ANALYSIS_CLAIM_PENDING`, jusqu’à épuisement des trois tentatives.

Chronologie vérifiée dans RevenueCat et Supabase, heures de Paris : analyse à 17 h 27, expiration à 17 h 51, demande d’image à 19 h 11 min 55 s et échec à 19 h 12. Le dernier événement RevenueCat est SANDBOX / TEST_STORE ; le compte possède également un historique Play Store de test. Aucun achat, renouvellement, changement d’abonnement ou rejeu historique n’a été effectué pour le diagnostic.

Le Motorola identifié par ADB exécute `com.tanuki75.noctalia` 3.1.0 (54), installation sans installateur Play déclaré, avec un client de développement. Cela ne prouve pas le comportement du binaire actuellement distribué par le Play Store.

## Architecture retenue

1. **Une réservation atomique pour toutes les analyses.** `reserve_authenticated_analysis_authorization` possède les contrôles de compte, rêve, requête, quota mensuel et idempotence. Le RPC synchrone existant et l’admission des jobs l’utilisent. Plus reste sans plafond, mais reçoit la même preuve durable que l’offre gratuite. Un ancien résultat écrit par le client ne devient jamais une autorisation.
2. **Une vérification commune pour l’image.** L’API et le worker appellent `verifyAnalysisImageAuthorization`. La preuve doit correspondre au compte, au rêve et à la requête. Une analyse réellement en cours peut attendre ; une analyse terminée sans preuve est refusée immédiatement ; une panne de lecture reste une indisponibilité technique, sans inventer une expiration.
3. **Un motif d’échec durable.** `ai_jobs` reste la source de vérité. Un trigger projette le code d’échec utilisable par l’interface sur le rêve. Le dernier job prévaut ; une ancienne exécution terminant en retard ne remplace pas son motif. Le client lit ce code mais ne le renvoie pas dans les écritures du journal. Les anciens échecs sont renseignés sans relance ni consommation de quota.
4. **Un contrat de présentation commun.** Les refus de droits et les demandes épuisées n’offrent pas une relance technique inutile. Le même message d’expiration est utilisé dans l’écran d’abonnement et dans les réglages du compte. Les erreurs de discussion respectent également leur caractère réessayable.
5. **Des régressions exécutables.** Un test PostgreSQL synthétique utilise PGlite 0.5.8, fixé en dépendance de développement. `test:analysis-authorization:db` est exécuté dans le job CI backend existant, sans modification des filtres ni suppression de contrôles.

Les images HD et les régénérations indépendantes gardent leurs contrôles d’offre active existants. Cette correction conserve le droit à la première image d’une analyse autorisée ; elle ne prolonge pas un abonnement et ne généralise pas un droit illimité après expiration.

## Audit des parcours voisins

| Situation | Constat établi | Traitement |
| --- | --- | --- |
| Plus expire entre analyse et première image | Preuve absente pour le parcours Plus ; admission et exécution divergent | Réservation commune, preuve indépendante de l’offre actuelle, contrôle partagé |
| Réouverture du rêve après échec | La relecture serveur peut supprimer le code stocké seulement dans le cache | Projection serveur du code ; fusion qui privilégie le résultat serveur et conserve le diagnostic ancien compatible |
| Abonnement expiré | La date n’était affichée que lorsque l’abonnement était actif | Avis explicite : date de fin, offre gratuite, accès conservé aux rêves et analyses |
| Limite de discussion atteinte côté serveur | Certaines réponses 429 étaient classées comme saturation temporaire ; bouton de relance sans action utile | Classification des véritables contrats `code`/`error`, message de limite, absence de bouton sans requête réessayable |
| Gestion de l’abonnement indisponible | Erreur uniquement journalisée, interface silencieuse | Message visible et possibilité de réouvrir le gestionnaire ; passage par le service d’abonnement |
| Annulation du renouvellement avec droits toujours actifs | Ne doit pas être confondue avec une expiration | Test négatif : aucune annonce d’expiration pour un plan encore actif |
| Nouveau compte gratuit | N’a jamais perdu Plus | Test négatif : aucune annonce d’expiration sans historique daté |
| Indisponibilité temporaire de vérification | N’établit pas une perte de droits | Refus temporaire distinct, réessayable, sans message d’abonnement expiré |

L’actualisation au retour au premier plan, les mises à jour RevenueCat et le timer d’expiration existent déjà. Leur présence ne prouve pas tous les scénarios de réseau dégradé ou de changement de compte : aucune nouvelle qualification exhaustive de ces parcours n’est revendiquée.

## Sécurité et compatibilité

- RPC de réservation réservé au service ; rôle JWT contrôlé dans le corps, `search_path` vide. Le wrapper conserve la signature utilisée par l’app.
- Preuves non forgeables par les clients : sur le serveur inspecté, RLS de `quota_usage` activée avec une seule politique SELECT du propriétaire, sans politique d’écriture client. Les jobs ne sont pas modifiables par le rôle authentifié.
- Aucun rehaussement de droits fondé sur `user_metadata`, un drapeau `is_analyzed`, une date client ou une ligne de quota sans identifiant de requête.
- Pas de remise à zéro des tentatives, pas de récupération générale des anciennes autorisations, pas de changement du modèle image ni de l’activation HD.
- Les analyses Plus synchrones doivent désormais identifier un rêve persistant et une requête en attente. Les clients actuels transmettent ces données ; les appels anciens sans identité exploitable sont refusés proprement.
- Le nouveau champ est additif et lu via les lectures complètes `select('*')`. La projection légère de liste reste inchangée. Les anciens serveurs restent lisibles par le client.
- Une perte de connexion pendant un achat, un changement de compte pendant une actualisation, les périodes de grâce de facturation et un binaire Play ne sont pas couverts par une preuve matérielle dans cette qualification.

## Vérifications

- PostgreSQL synthétique : 30 assertions, dont reproduction de l’ancien défaut avant migration, Plus → gratuit, quotas gratuits, idempotence, isolation compte/rêve, permissions, refus sans état pending résiduel, projection et ordre des échecs.
- Edge Functions : vérification de types des quatre entrées API/workers/webhook et 227 tests réussis.
- Tests ciblés interface/erreurs : 79 tests réussis ; persistance et fusion : 21 tests réussis ; rendu des relances de chat : 3 tests réussis.
- Le contrôle final `test:prepush` et son résultat sont consignés dans la PR après commit.
- Motorola : version locale chargée via Metro 8083 et tunnel ADB, sans réinstallation ni effacement. L’avis d’expiration réel du compte est lisible et annonce la date 17 septembre à 17 h 51. Aucune transaction lancée.
- Le motif restauré de l’ancien échec et la génération réelle après correction nécessitent encore l’application des migrations et le déploiement serveur. Les tests locaux ne sont pas présentés comme une réparation de production.

## Livraison et récupération ciblée

Branche isolée basée sur `codex/dream-image-20260917`, sans inclusion des modifications de synchronisation ni des autres travaux locaux. Les captures, logs, identifiants de compte et la procédure de récupération de l’incident restent hors Git.

Ordre de publication prévu : appliquer uniquement les deux nouvelles migrations, puis déployer `api` et `image-job-worker`, vérifier les définitions et versions réellement publiées, puis qualifier un parcours réel. Ne pas utiliser un `db push` global.

La récupération du job historique est distincte : une procédure privée vérifie les identités exactes, l’heure de l’analyse, la ligne de quota et l’empreinte originale de la demande. Elle peut rétablir la preuve vérifiée sous Plus puis autoriser une seule tentative supplémentaire sur le même job, sans remettre les trois tentatives précédentes à zéro. Elle n’a pas été exécutée.

Les déploiements et cette relance de production attendent une autorisation explicite, conformément au guide du dépôt. Les modifications de code, les validations locales et la préparation de la PR sont autorisées.
