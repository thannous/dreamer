# TI-528 — Qualification Supabase locale jetable

## Qualification actuelle sans Docker — 19 octobre 2026

La commande intégrée utilise la stack Supabase native jetable du lanceur backend :

```sh
mise exec -- npm run test:e2e:backend -- --runtime native --qualify-ti528
```

Elle exécute sept parcours navigateur, le contrat de base, puis les quatre suites
TI528 et leurs six cas, séquentiellement sur la même stack possédée. L'option
`--qualify-ti528` s'exécute toujours sur une stack native possédée ; les anciennes
options `--status-file` et `--prepare-only` (mode VM fourni) ont été supprimées avec
Docker et sont refusées avant tout démarrage. Le lanceur fournit uniquement son propre
statut privé, conserve l'option dans la commande de reproduction et détruit sa
stack exacte dans `finally`, y compris après un échec.

Les six cas couvrent pagination/synchronisation et isolation des propriétaires,
admission concurrente, quotas invités et mensuels, idempotence des jobs, reprise
des leases de dialogue et remboursement unique des jobs image expirés. Ils
n'appellent aucun fournisseur IA ni service de paiement.

Le 19 octobre 2026, la source `967fe81f` avec les changements locaux du lot d'audit
a passé les sept parcours, les 56 contrats DB et les six cas TI528 (quatre suites,
aucun cas ignoré), avec sortie 0. Le journal privé est
`/private/tmp/noctalia-backend-native-updated-20261019.log`. Cette preuve locale
ne qualifie ni une application mobile, ni les Stores, ni la production.

Le lecteur de statut accepte deux contrats explicites :

- Stack gérée : reçu identifié par un ID de stack et un runtime reconnu, clés
  locales présentes, API et PostgreSQL strictement sur `127.0.0.1`, ports distincts
  entre 20000 et 32767, sans chemin API détourné, query ou fragment. Le même garde
  de cible que le lanceur backend est appliqué avant tout client privilégié.
- Ancien environnement TI528 : API exactement `http://127.0.0.1:55321` et base
  PostgreSQL `127.0.0.1:55322/postgres`, sans query ni fragment ; ce contrat reste
  inchangé. Une cible hébergée ou un port local arbitraire sans reçu géré n'est pas accepté.

L'URL DB validée est transmise au vérificateur par `SUPABASE_DB_URL`, sans exposer
son mot de passe dans les arguments affichés par npm. Les clés privilégiées
restent dans le statut temporaire privé et ne vont ni dans Git ni dans le profil
public Expo. Voir le [guide backend](../e2e-backend-qualification.md) pour les
prérequis, les copies de migrations sans tâches HTTP externes actives et les
artefacts. Sans `TI528_LOCAL_STATUS`, les quatre suites restent explicitement
ignorées dans Jest ordinaire ; `db:qualify:local` refuse ce manque et ne peut pas
le présenter comme une qualification réussie.

## Résultat historique — 8 septembre 2026

Exécution historique : arbre produit `2af5163bc` avec la correction de migration et le harness de qualification ci-dessous. Test d’intégration réel PASS, contrat 55/55 PASS, typecheck tests et lint du harness PASS. Fixtures Android relues après cette exécution : A = 2 501, B = 1, identifiants inchangés.

Le 8 septembre 2026, les 62 migrations ont été rejouées depuis une base vide sur Supabase CLI 2.106.0 / PostgreSQL 17, projet isolé `noctalia-ti528-disposable`, API 55321 et PostgreSQL 55322. Le vérificateur existant `db:contract:check:local` passe ses 55 contrôles. Aucun projet cloud, donnée réelle, déploiement ou migration de production n'a été utilisé.

Le test opt-in `scripts/ti528/journal-local.test.ts` appelle les fonctions TypeScript de production (`fetchDreamListPage`, `fetchDreamFullPage`, `iterateDreamPages`, détail) via le vrai SDK et les vrais JWT de deux comptes synthétiques. Seul l'adaptateur de connexion de l'application est remplacé par les clients locaux; les requêtes, RLS et RPC ne sont pas simulées.

Scénarios vérifiés :

- 0, 1, 1 000, 1 001 et 2 501 rêves aux dates identiques, exhaustivité et absence de doublons.
- Limite PostgREST réellement abaissée à 137 pour une requête de 1 000; restauration du réglage dans `finally`. Fin uniquement après une page vide.
- Ajout et suppression entre deux pages : insertion au-delà de la borne exclue; suppression visible; les éléments restants sont parcourus une fois.
- Erreur de transport injectée sur une vraie lecture, curseur d'erreur conservé, puis reprise au même curseur après rétablissement.
- Lecture détaillée et curseur isolés entre comptes A/B, RLS REST explicite; insertion sous un autre propriétaire, modification, suppression et réattribution interdites, ligne propriétaire préservée.
- RPC de mise à jour rejouée à l'identique, révision modifiée, suppression et replay idempotent.
- Batch applicatif réel : modification de A puis suppression de B à date identique, reçus distincts, rejeu et mise à jour hors ligne obsolète de B sans résurrection ni modification de A.
- Refus des accès directs client aux tables `ai_jobs` et `dream_sync_receipts`.
- Upload et signature Storage autorisés au propriétaire, signature refusée à l'autre utilisateur.
- Migration historique : absence complète autorisée; présence partielle d'une table, d'une vue ou d'une fonction refusée et objet sentinelle préservé.

L'admission complète des quotas/jobs (TI-560) n'est pas couverte par le simple refus d'accès direct aux tables. Il s'agit d'un test d'intégration réel séquentiel, pas d'une preuve de performances Android ni de configuration de production. Les comptes Android sont distincts des comptes éphémères du test afin de préserver leur jeu de 2 501 rêves.

## Défaut historique trouvé et correction minimale

Le scénario de dates identiques a révélé une collision supplémentaire dans le client : sur `5de967d01`, le batch applicatif « modifier A, supprimer B » retourne deux acquittements pour A. Le test réel reproduit cet échec avant correction, en exécutant la version historique du service sur les mêmes assertions. Les alias de synchronisation utilisaient le timestamp commun et pouvaient réattribuer à B l'identité acquittée de A. La correction conserve les dates, mais donne priorité aux identités distante/client ; elle est également vérifiée par la qualification Android des routes et actions. Les résultats de ce scénario ne sont pas déduits des seuls tests RPC.

Le premier replay inchangé échouait dans `20260723143132_remove_location_subsystem_from_noctalia.sql` : `Location removal aborted: expected 8 tables, found 0`. Cette suppression supposait une ancienne installation Dashboard et comparait des empreintes exactes de données absentes de l'historique.

La correction versionnée ne change aucune vérification destructive : elle ajoute un retour anticipé uniquement lorsque toutes les huit relations nommées, quelle que soit leur nature, et toutes les 27 fonctions nommées sont absentes. Toute présence partielle conserve les contrôles historiques, empreintes et `DROP ... RESTRICT`.

La copie temporaire de configuration conserve les migrations versionnées; seul le nom de projet, les ports et la liste de seed sont adaptés. `seed.sql` est référencé mais absent du dépôt : la liste devient vide dans la copie. Le bucket privé `dream-images`, absent des migrations, est provisionné explicitement comme infrastructure de fixture locale avant le scénario Storage.

## Reproduction historique avec ports fixes

Cette procédure conserve le mode TI528 d’origine ; elle n’est pas un prérequis
pour la commande native intégrée ci-dessus.

Le script de préparation copie exactement les migrations versionnées dans le projet dédié et adapte seulement nom, ports et seed absent. Il refuse un répertoire non reconnu, les liens symboliques et les migrations supplémentaires; il ne démarre, n'arrête et ne réinitialise aucun conteneur. Pour prouver un replay depuis zéro, utiliser ce répertoire uniquement lorsqu'aucun volume antérieur de ce projet n'existe. Une relance sur un volume existant ne constitue pas une nouvelle preuve de reconstruction.

```sh
npm run db:qualify:prepare
node_modules/.bin/supabase start --help
node_modules/.bin/supabase start --workdir /private/tmp/noctalia-ti528-db --exclude analytics,vector,studio,meta,edge-runtime,realtime,imgproxy
umask 077
node_modules/.bin/supabase status --workdir /private/tmp/noctalia-ti528-db -o json > /private/tmp/ti528-local-status.json
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json npm run db:qualify:local
node scripts/ti528/seed-local.cjs /private/tmp/ti528-local-status.json /private/tmp/ti528-client-fixture.json
```

La commande `db:qualify:local` valide explicitement le fichier local, puis lance le contrat DB existant et les quatre suites d'intégration via `test:file`. Elle échoue en l'absence de fichier; elle ne peut pas présenter une suite ignorée comme une qualification réussie. Le script de seed crée de nouveaux comptes à chaque exécution : conserver le fichier existant pendant une session Android en cours.

Dans ce mode historique sans reçu de stack gérée, le lecteur de statut et le script de seed refusent les ports autres que 55321/55322. Le statut contient une clé privilégiée exclusivement locale : garder ce fichier temporaire privé, ne jamais le committer ni le transmettre à l'application. Le fichier client ne contient que les paramètres publics et les identifiants synthétiques nécessaires à Android. Sans `TI528_LOCAL_STATUS`, le test est explicitement ignoré et n'accède à aucune base.

Sources : [développement local Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started), [changelog vérifié](https://supabase.com/changelog), configuration et migrations versionnées. La limite de production n'est pas déduite de cette qualification locale.

## Admissions concurrentes — complément historique du 8 septembre 2026

La commande `db:qualify:local` exécute aussi `scripts/ti528/admission-local.test.ts` sur le même environnement jetable protégé. Le test appelle réellement `claim_ai_request_window` : succès sous le rôle serveur prévu, refus explicite `42501` sous les rôles anonyme et authentifié. Il ne présente pas un succès administrateur comme une preuve d'autorisation client.

Sept demandes simultanées du même acteur doivent produire exactement trois admissions ; dix acteurs distincts doivent produire exactement quatre admissions globales. Les refus ne consomment pas de nouvelles places. Les capacités ont des compteurs distincts et les refus donnent un délai de reprise positif. Cette primitive ne possède pas de clé de requête : deux appels consomment deux admissions, sans promesse d'idempotence.

Les identifiants/capacités sont synthétiques, chaque capacité est propre à l'exécution et le nettoyage ne cible que ses lignes et son compte temporaire. La durée de fenêtre est choisie à partir de l'horloge PostgreSQL pour ne pas traverser sa borne pendant le test. Les credentials restent dans le fichier local privé ; aucun fournisseur IA n'est appelé.

Les admissions de jobs durables, quotas de consommation, leases de workers et autorisations interapps ne sont pas couvertes par ce seul complément. À cette étape historique, TI-528 restait ouvert. Référence technique vérifiée : [fonctions et privilèges Supabase](https://supabase.com/docs/guides/database/functions), 8 septembre 2026 ; migrations locales versionnées comme contrat de comportement.
