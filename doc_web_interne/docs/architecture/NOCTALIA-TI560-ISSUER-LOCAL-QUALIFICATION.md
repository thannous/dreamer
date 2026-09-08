# TI-560 — Émission OAuth réelle sur base jetable

8 septembre 2026. Base source du harness : `5f172a070` ; qualification de l'émetteur seulement, avant les politiques d'isolation et l'import distant de l'ADR-002.

## Exécution

```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node scripts/ti560/qualify-issuer-local.cjs
```

Le fichier de statut reste privé et hors Git. Le harness applique les gardes TI-528 (API 127.0.0.1:55321, base 127.0.0.1:55322), puis vérifie le nom/projet/réseau et l'image du conteneur Auth existant. Il démarre une instance auxiliaire du **même identifiant d'image Docker GoTrue v2.189.0**, exposée uniquement sur 127.0.0.1:55329 et connectée uniquement au réseau du banc. Il ne remplace ni ne redémarre l'Auth historique, n'effectue aucun reset et ne modifie pas la configuration versionnée. Aucun fournisseur externe, tunnel, clé supplémentaire ou rotation.

La configuration existante est copiée dans un fichier temporaire privé (répertoire 0700, fichier 0600), avec OAuth activé, chemin `/oauth/consent` et inscription dynamique désactivée. Le fichier est supprimé en fin d'essai. La création des utilisateurs/clients utilise uniquement la clé administrative du banc ; les opérations consentement et émission utilisent les rôles normaux et PKCE.

## Résultat vérifié

Deux exécutions complètes passent, dont une après durcissement du nettoyage :

- Deux utilisateurs synthétiques et deux clients **publics**, Journal/Lucid, enregistrés par l'API Auth avec `token_endpoint_auth_method=none`.
- Pour chaque couple utilisateur/client : challenge S256, demande d'autorisation, lecture du consentement et approbation sous session utilisateur réelle, échange du code avec verifier et redirection exacte.
- `state` conservé, `sub`/`aud`/`iss`/`client_id` vérifiés ; refresh réellement échangé et identité client conservée.
- Jetons acceptés par `/user` Auth et par l'API REST historique, ce qui complète le simple décodage des claims.
- Session password historique sans `client_id` caractérisée.
- Les deux utilisateurs sont supprimés et les deux clients révoqués via l'API administrative à chaque exécution. GoTrue conserve des lignes clients avec `deleted_at` : contrôle après les deux essais, **0 utilisateur de fixture, 0 client actif, 4 clients supprimés logiquement**. Aucun conteneur auxiliaire restant ; Auth historique toujours actif.

Le scope `email` évite toute exigence d'ID token OpenID ; aucun secret de signature n'est transmis à un client. Les tokens restent uniquement en mémoire et ne sont pas imprimés.

## Limites

Cette preuve établit la capacité d'émission réelle de deux identités applicatives sur le banc. Elle ne prouve **pas** encore leur isolation : la requête REST des deux clients réussit volontairement avec les politiques actuelles. Les gardes tables/RPC/Storage, les autorisations d'import, expiration/révocation pendant pagination, les parcours UI de connexion et le déploiement ne sont pas livrés ici. Le consentement OAuth de test n'est pas le consentement produit d'import.

Une exception pour les jetons historiques garde leur compatibilité mais ne garantit pas l'isolation contre leur réutilisation depuis un autre logiciel. TI-560 reste ouvert conformément à l'ADR-002. Aucun résultat de production n'est déduit de cet essai local.

Références vérifiées : [OAuth local Supabase](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [flux OAuth](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [source GoTrue v2.189.0](https://github.com/supabase/auth/tree/v2.189.0/internal/api/oauthserver).

## Durcissement après revue indépendante

Le cycle Docker sépare désormais `create` et `start` : la propriété du conteneur est enregistrée avant son démarrage, et un échec de publication du port déclenche son nettoyage. Les commandes Docker sont bornées à 30 s ; les requêtes HTTP à 10 s, la santé à 1 s avec dix tentatives. SIGINT et SIGTERM déclenchent l'annulation des requêtes courantes puis le nettoyage, dont les requêtes disposent de leur propre délai indépendant. Un arrêt forcé SIGKILL ne peut pas fournir cette garantie.

Vérifications de panne réellement exécutées (injections locales, aucun autre conteneur arrêté) :

- listener possédé sur 55329 : échec de santé borné et suppression de l'auxiliaire ;
- échec injecté de `docker start` après vraie création : code non nul, aucun auxiliaire restant ;
- requête administrative suspendue : expiration du délai et nettoyage ;
- SIGTERM pendant cette requête : annulation puis nettoyage.

La preuve OAuth complète a ensuite été rejouée avec succès. État final : zéro utilisateur synthétique, zéro client actif, six tombstones clients issus des trois runs complets ; aucun auxiliaire restant. `node --check` et `git diff --check` passent. Aucune politique d'accès produit ajoutée par ces correctifs.
