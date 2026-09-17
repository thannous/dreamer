# ADR-002 — Autorisation des échanges Journal vers Lucid

Date : 8 septembre 2026. Décision d’architecture retenue pour TI-560 ; déploiement et preuve de bout en bout en attente. Base examinée : d2bc25936.

## Constat vérifiable

Journal et Lucid utilisent actuellement le même client Supabase et les mêmes flux de connexion (`lib/supabase.ts`, `lib/auth.ts`, `services/lucidTrainerSync.ts`). Les politiques Journal, RPC et Storage vérifient principalement `auth.uid()` et la propriété des données. Le serveur OAuth local est désactivé dans `supabase/config.toml`. Les sessions distribuées ne prouvent donc pas quelle application présente le bearer.

Un même jeton valide présenté avec deux en-têtes applicatifs différents représente la même autorité. `appId`, une variable publique, `user_metadata`, un deep link ou une préférence de consentement locale ne créent pas une identité client fiable. Les tests TI-528 caractérisent cette limite ; ils ne la présentent pas comme une isolation produit réussie.

## Décision

Conserver l’import distant paginé prévu par TI-522, désactivé tant que la frontière serveur n’est pas qualifiée. Ne pas remplacer silencieusement cet import par un fichier : aucun export structuré exhaustif Journal n’est actuellement attesté et ce transport demanderait un parcours et un contrat distincts.

La cible est une identité client émise et vérifiée par l’autorité d’authentification, plus une autorisation d’import révocable et limitée. Le compte identifie la personne ; le client identifie le produit ; le consentement autorise une opération précise. Aucun de ces éléments ne remplace les autres.

L’adaptateur d’import Lucid sera une capacité distincte des lectures Journal ordinaires. Il exposera uniquement des pages de texte, date, identifiant stable et révision, avec contexte source/compte et curseur opaque. Pas de clé privilégiée dans l’application ; pas de médias, analyses, données santé ou synchronisation automatique des copies.

## Application serveur nécessaire

- Valider signature, émetteur, audience et identité client réellement émise ; ne pas accepter un claim fourni par le client ni simuler son émission dans le seul banc de tests.
- Journal conserve ses opérations propriétaires ; Lucid ne peut pas lire directement les tables, RPC et objets Storage Journal avec son jeton applicatif.
- Le service d’import vérifie à chaque page utilisateur, client destinataire, portée, expiration et révocation du consentement. Un curseur n’accorde aucun droit et reste lié à ce contexte.
- Révocation ou changement de compte interrompt les nouvelles lectures. Les copies déjà choisies sont gérées explicitement dans Lucid, avec provenance et suppression locale ; elles n’entrent pas automatiquement dans sa file cloud.
- La suppression d’un produit ne supprime pas les données des deux autres ; les endpoints et politiques de suppression doivent appliquer la même frontière.

La documentation Supabase précise que les scopes OIDC ne restreignent pas seuls l’accès aux données : les politiques doivent utiliser l’identité client authentifiée. Référence : https://supabase.com/docs/guides/auth/oauth-server/token-security

## Migration des clients historiques

Il est impossible de conserver un bearer historique sans identité produit en accès Journal intégral tout en refusant ce même bearer lorsqu’il est présenté par Lucid. Une exception de compatibilité maintient nécessairement cette limite.

Le déploiement doit donc inventorier les versions distribuées, introduire les clients enregistrés et leurs redirections, qualifier les nouveaux flux, puis définir la transition et la réauthentification des sessions historiques avant d’affirmer une isolation forte. Aucun retrait immédiat de droit aux clients existants n’est livré par cette ADR. L’activation du serveur OAuth, l’enregistrement des clients et la migration de production sont des opérations de déploiement séparées.

## Preuve requise avant activation

Sur une base jetable avec des jetons réellement émis : deux utilisateurs × deux clients ; consentement absent, valide, expiré et révoqué ; tables, RPC et Storage directs ; suppression limitée au produit ; 0/1/1001/2501 éléments ; pagination interrompue, compte changé et curseur rejoué. Les chemins autorisés doivent réussir en même temps que les chemins interdits échouent. Ajouter les versions historiques à la matrice et documenter toute exception restante.

TI-560 et l’import distant TI-522 restent ouverts tant que cette preuve et le plan de transition ne sont pas établis. Cette décision ne prétend ni corriger une politique de production ni avoir déployé un nouvel émetteur.
