# Qualité des illustrations — 16 septembre 2026

## Comportement livré dans le code

- Préférences → Qualité des illustrations : Standard (1K), HD 2K, HD 4K. Standard reste la valeur initiale, y compris pour Plus. Le choix est explicite et conservé par compte sur cet appareil ; aucune illustration existante n'est régénérée.
- Standard : `gemini-3.1-flash-lite-image`. HD : `gemini-3.1-flash-image`, uniquement pour Plus. Les variables serveur existantes permettent de remplacer ces modèles.
- 2K et 4K partagent 15 crédits par mois civil UTC. Le serveur vérifie l'abonnement et réserve un crédit avant l'appel au fournisseur. Les réservations comptent dans le plafond ; un même job ne consomme pas deux crédits. Un échec terminal libère la réservation. La consultation du quota réconcilie les remboursements interrompus.
- L'image HD conserve ses pixels d'origine au stockage, sans réduction à 1024 pixels. Une erreur de stockage HD reste un échec, sans énorme data URI présentée comme résultat.
- Une limite atteinte propose les Préférences et conserve Réessayer, pour permettre de revenir à Standard. La navigation et le footer ne sont pas modifiés.

## Vérifications locales

- 444 tests Jest liés dans 26 suites passés avant corrections de revue ; contrôle ciblé final de la fiche rêve : 21 tests passés, dont la reprise après quota HD épuisé.
- 55 tests Deno passés (modèles, adaptateur Gemini, pipeline, quota, admission et worker). Contrôle ciblé final du worker : 11 tests passés, dont la persistance de l'échec même si le remboursement échoue.
- TypeScript application et tests : passés. Lint ciblé : aucune erreur ; avertissements préexistants dans les grandes surfaces journal/hook. `git diff --check` passé.
- PostgreSQL via PGlite : migration exécutée et assertions comportementales passées. Plafond 15 parmi 20 demandes, identité du job, Plus uniquement, isolation des comptes, remboursement, absence de remboursement des images livrées, changement de mois et permissions RPC/table.
- PGlite sérialise les requêtes : ce test ne mesure pas une contention entre plusieurs processus PostgreSQL. Le verrou transactionnel par utilisateur a été examiné lors de la revue indépendante.
- Test de pixels avec une image synthétique 2304 × 4096 : hauteur 4096 conservée en HD et ramenée à 1024 en Standard.
- Revue Bugbot : deux P2 trouvés puis corrigés (reprise Standard masquée ; remboursement empêchant la persistance d'échec). Régressions ciblées passées après correction.
- Premier passage CI : test de pixels bloqué par l'absence d'accès réseau au codec ImageScript. Permission Deno limitée à `deno.land` ajoutée pour charger son module WASM versionné ; aucun test, filtre ou contrôle retiré. La commande complète des tests Edge corrigée passe localement : 199 tests.

Pour reproduire le contrôle SQL, installer `@electric-sql/pglite` dans un répertoire temporaire puis, depuis la racine du dépôt :

```sh
NODE_PATH=/tmp/noctalia-hd-db/node_modules node doc_web_interne/docs/qa/illustration-quality-2026-09-16/quota-check.cjs
```

## Déploiement serveur et limites de preuve

- Après autorisation explicite de l'utilisateur : migration `20260916185856_hd_illustration_monthly_quota` appliquée (nom local aligné sur la version attribuée par Supabase), worker `image-job-worker` v17 ACTIVE, fonction isolée `illustration-hd` v1 ACTIVE. L'API v105 et `capture-recall` v2 sont conservées.
- Le contrôle automatique a refusé le remplacement complet de l'API : charge de revue supérieure à 200 000 octets. L'alternative isolée (~80 Ko) expose uniquement l'admission d'images et réutilise les gardes d'authentification, d'application et d'abonnement existantes. Le client dirige uniquement les créations HD hébergées vers cette fonction ; Standard et suivi des jobs gardent leur contrat actuel.
- Vérifications HTTP en production : anonyme → 401, utilisateur QA Free demandant 4K → 403 `HD_IMAGE_PLUS_REQUIRED`, quota Free → 200 avec limite 0, tentative de réservation privilégiée par le client → 403, accès anonyme au worker → 401. Aucun appel payant de génération HD réelle n'a été effectué (seul un compte QA Free est disponible). Le contrôle des pixels concerne une image synthétique.
- SQL en production : RLS activé ; aucun accès direct à la table pour anon/authenticated ; réservation réservée au serveur ; lecture du quota accessible uniquement à l'utilisateur authentifié. Les avis Supabase concernant la table sans politique et la RPC SECURITY DEFINER sont intentionnels : table privée et RPC filtrée par `auth.uid()`. [Avis RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Delta d'isolation : 49 tests client passés (dont URLs hébergées moderne/ancienne, Standard et proxy local), types des tests, lint ciblé et `deno check --frozen illustration-hd/index.ts` passés.
- Motorola verrouillé : parcours visuel non qualifié. Émulateur installé : Capture visible mais navigation/deep links vers Préférences sans effet dans cette session. Aucun effacement de données ni réinstallation. Le parcours natif Préférences → génération réelle reste à vérifier.
- Branche basée sur `codex/capture-conversation-20260916` (PR #175). Cette livraison HD doit rester distincte du déploiement antérieur de `capture-recall`.
- La livraison mobile par un canal Store/OTA reste distincte et n'a pas été effectuée. Restent à qualifier : parcours visuel et génération réelle 4K avec un compte Plus.

Contrat fournisseur vérifié : [génération d'images Gemini](https://ai.google.dev/gemini-api/docs/image-generation), [Gemini 3.1 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image).
