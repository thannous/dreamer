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
- `test:prepush` réussi sur le commit de code `a989c7d722cb295c9ce7fbec918257109d395164` : types app/tests, 188 suites et 2 157 tests réussis, une suite/un test déjà ignorés. Base distante actualisée `214c6e845e73599f0ee61cfa535303e2cfa73717`. Ces résultats locaux ne sont pas un verdict CI distant.
- Motorola : version locale chargée via Metro 8083 et tunnel ADB, sans réinstallation ni effacement. L’avis d’expiration réel du compte est lisible et annonce la date 17 septembre à 17 h 51. Aucune transaction lancée.
- Le motif de l’ancien échec est restauré en production par la migration. Une génération réelle après correction reste à qualifier séparément ; aucun rejeu historique n’a été effectué.

## Livraison et récupération ciblée

Branche isolée basée sur `codex/dream-image-20260917`, sans inclusion des modifications de synchronisation ni des autres travaux locaux. Les captures, logs, identifiants de compte et la procédure de récupération de l’incident restent hors Git.

Publication effectuée : uniquement les deux nouvelles migrations, puis `api` et `image-job-worker`, avec vérification des définitions et versions réellement publiées. Aucun `db push` global. Une génération réelle reste à qualifier séparément.

La récupération du job historique est distincte : une procédure privée vérifie les identités exactes, l’heure de l’analyse, la ligne de quota et l’empreinte originale de la demande. Elle peut rétablir la preuve vérifiée sous Plus puis autoriser une seule tentative supplémentaire sur le même job, sans remettre les trois tentatives précédentes à zéro. Elle n’a pas été exécutée.

## Publication serveur du 17 septembre 2026

Après accord de déploiement de l’utilisateur, les deux migrations ont été appliquées et vérifiées en production. Les versions enregistrées correspondent aux fichiers Git et leurs contenus ont été comparés par empreinte MD5 : `2e0dc0d3bccddb52d18e51df2fe3b031` pour l’autorisation, `4ed3f8268b80fe85cefbeff2d65d837a` pour le motif d’erreur. Le connecteur attribue initialement ses propres horodatages ; les deux entrées ont été alignées sur les versions des fichiers après vérification stricte du nom et du contenu.

Les deux parcours SQL utilisent la réservation commune. Les fonctions d’autorisation restent inaccessibles aux rôles `anon` et `authenticated`, et le trigger de projection est actif. L’ancien échec a maintenant son motif durable ; le job et sa ligne de quota restent inchangés. Aucun job actif à la vérification et aucune relance historique effectuée. Le comparatif des conseillers de sécurité ne montre aucun nouvel avis.

La comparaison avec les sources réellement déployées a révélé des différences indépendantes de cette PR. Les paquets de publication ont donc été préparés depuis `api` v108 et `image-job-worker` v20, en ajoutant uniquement le vérificateur commun et son appel dans chaque fonction. Les autres routes, modèles, contrôles HD et mécanismes d’authentification déployés sont conservés. Types Deno des deux paquets valides ; quatre assertions ciblées API et quatorze tests worker/vérificateur réussis. Les tests worker nécessitent l’accès à `deno.land` pour charger le WASM d’ImageScript ; l’échec initial sans cette permission est environnemental.

Après le changement de permissions et la demande de nouvel essai de l’utilisateur, le connecteur a publié les mêmes paquets préparés : **`api` v109 et `image-job-worker` v21, tous deux ACTIVE**. Les 49 fichiers de l’API et les 13 fichiers du worker ont été relus depuis Supabase et correspondent exactement aux manifestes soumis. `analysis-job-worker` reste en v8. Les deux points d’entrée refusent une requête sans authentification avec HTTP 401. Les migrations et le job historique ont été revérifiés après publication ; le job conserve ses trois tentatives épuisées et n’a pas été relancé.

Le blocage initial provenait des permissions : la CLI avait reçu HTTP 403, puis le contrôle automatique du connecteur avait refusé les fonctions malgré l’accord explicite. La nouvelle tentative a utilisé ce même connecteur après la mise à jour des permissions, sans contournement. Le Motorola est toujours visible via ADB mais son écran est verrouillé lors du contrôle après publication ; ce contrôle ne qualifie donc pas l’affichage final du motif d’échec sur l’appareil. L’avis d’expiration avait été vérifié auparavant sur la version locale. Aucune publication Play Store ni mise à jour OTA n’a été réalisée.

Empreintes SHA-256 des manifestes de publication privés : API `7d47bc99fb1328894696fed4c53014e06fd2ced617bbf80bdb337c4cf1a1e003`, worker `bfcb693cea0c2940c16b29c0d1cb277324748e335e6a783ed0f7906f3fd8b7c8`. Les captures, paquets et logs restent hors Git. La publication serveur est vérifiée ; la récupération de l’image reste distincte et soumise à un accord spécifique.

## Suivi : statut et souscription depuis la page Compte

Le bouton de vérification de l’abonnement ouvrait `settings?section=account`, mais cette branche de l’écran ne montait que la carte d’authentification. La carte d’abonnement existait seulement dans les réglages généraux. Le parcours a été vérifié sur le Motorola avant correction : connexion et déconnexion visibles, aucun statut ni accès aux offres.

La page Compte réutilise désormais `QuotaStatusCard`, intitulée « Abonnement et utilisation » dans les six langues. Elle affiche la formule, l’expiration éventuelle et l’action de souscription ou de gestion appropriée. Les préférences générales restent dans les réglages. Une panne du chargement des quotas ne masque plus la souscription lorsque le statut gratuit est connu ; un statut en cours de vérification ou indisponible n’est pas présenté comme une offre gratuite et ne déclenche pas d’incitation à acheter. Le contrôle d’abonnement peut être réessayé, y compris après un échec réseau.

Qualification locale : tests du parcours Compte, de la carte et du hook de quotas ; types app/tests ; lint sans erreur (deux avertissements préexistants dans `useQuota`). Sur le Motorola, la formule gratuite et l’avis d’expiration sont visibles. Le bouton « Passer à Noctalia Plus » ouvre les options mensuelle et annuelle. Aucun achat, renouvellement, rejeu d’image, effacement ou réinstallation. La validation matérielle concerne le client de développement chargé par Metro, pas une publication Play Store ou OTA.
