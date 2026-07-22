# Passeport QA invité connecté à la production

## Objectif

Permettre à un opérateur explicitement autorisé de tester le vrai parcours
invité Android contre la production, sans supprimer ni réinitialiser l'usage
historique de l'appareil.

Le passeport crée un sujet de quota temporaire `qa:<uuid>` signé dans le jeton
invité. Le fingerprint réel reste lié à l'appareil et continue d'être vérifié
par Play Integrity.

## Limites fixes

- un appareil actif par opérateur ;
- validité de 24 heures ;
- trois créations ou réinitialisations par jour UTC ;
- dix admissions IA payantes par jour UTC ;
- aucune désactivation des quotas produit, du plafond du chat, de l'anti-rafale,
  de l'idempotence ou de Play Integrity.

## Autorisation serveur

L'adresse email n'est jamais utilisée comme autorisation. L'Edge Function lit
uniquement la liste d'UUID Supabase Auth présente dans le secret
`GUEST_QA_OPERATOR_USER_IDS` (UUID séparés par des virgules).

Le flag client `EXPO_PUBLIC_GUEST_QA_LAB=true` affiche seulement l'interface
dans le profil EAS `ai-internal`. Il ne donne aucun droit serveur.

## Ordre de mise en production

1. Confirmer que les migrations précédentes sont appliquées et que le reset
   local Supabase est sain.
2. Appliquer `20260722152059_add_guest_qa_passports.sql`.
3. Configurer `GUEST_QA_OPERATOR_USER_IDS` avec l'UUID Auth du compte opérateur.
4. Déployer l'Edge Function `api`.
5. Construire et distribuer le profil Android `ai-internal` via Google Play
   Internal Testing afin que Play Integrity retourne `PLAY_RECOGNIZED`.

Ne pas activer `EXPO_PUBLIC_GUEST_QA_LAB` dans les profils `production`,
`release` ou `release-smoke`.

## Parcours opérateur

1. Installer la version `ai-internal` depuis Google Play.
2. Se connecter avec le compte opérateur autorisé.
3. Ouvrir Paramètres, puis `Passeport invité QA`.
4. Appuyer sur `Passer en invité` et confirmer.
5. L'application vérifie qu'aucun rêve invité local non synchronisé ne risque
   d'être perdu, crée le passeport, réinitialise uniquement les compteurs locaux
   de test, se déconnecte et ouvre l'onboarding invité.
6. Pour révoquer le passeport, se reconnecter puis utiliser `Révoquer`.

## Vérifications minimales

- le troisième rêve analysé est refusé après deux analyses invitées ;
- les appels rapides restent limités ;
- le plafond de messages du chat reste appliqué ;
- les requêtes répétées avec la même clé restent idempotentes ;
- après expiration ou révocation, le fingerprint réel retrouve son état normal ;
- aucune table `qa_private` n'est exposée dans le Data API.

La migration et les fonctions ne stockent aucun texte, titre, interprétation ou
image de rêve. Le journal d'audit contient uniquement l'opérateur, le passeport,
la capacité IA, une clé de requête et les horodatages.
