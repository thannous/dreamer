# TI-528 — Qualification Supabase locale jetable

## Résultat et périmètre

Dernière exécution : arbre produit `2af5163bc` avec la correction de migration et le harness de qualification ci-dessous. Test d’intégration réel PASS, contrat 55/55 PASS, typecheck tests et lint du harness PASS. Fixtures Android relues après cette exécution : A = 2 501, B = 1, identifiants inchangés.

Le 8 septembre 2026, les 62 migrations ont été rejouées depuis une base vide sur Supabase CLI 2.106.0 / PostgreSQL 17, projet isolé `noctalia-ti528-disposable`, API 55321 et PostgreSQL 55322. Le vérificateur existant `db:contract:check:local` passe ses 55 contrôles. Aucun projet cloud, donnée réelle, déploiement ou migration de production n'a été utilisé.

Le test opt-in `scripts/ti528/journal-local.test.ts` appelle les fonctions TypeScript de production (`fetchDreamListPage`, `fetchDreamFullPage`, `iterateDreamPages`, détail) via le vrai SDK et les vrais JWT de deux comptes synthétiques. Seul l'adaptateur de connexion de l'application est remplacé par les clients locaux; les requêtes, RLS et RPC ne sont pas simulées.

Scénarios vérifiés :

- 0, 1, 1 000, 1 001 et 2 501 rêves aux dates identiques, exhaustivité et absence de doublons.
- Limite PostgREST réellement abaissée à 137 pour une requête de 1 000; restauration du réglage dans `finally`. Fin uniquement après une page vide.
- Ajout et suppression entre deux pages : insertion au-delà de la borne exclue; suppression visible; les éléments restants sont parcourus une fois.
- Erreur de transport injectée sur une vraie lecture, curseur d'erreur conservé, puis reprise au même curseur après rétablissement.
- Lecture détaillée et curseur isolés entre comptes A/B, RLS REST explicite; insertion sous un autre propriétaire, modification, suppression et réattribution interdites, ligne propriétaire préservée.
- RPC de mise à jour rejouée à l'identique, révision modifiée, suppression et replay idempotent.
- Refus des accès directs client aux tables `ai_jobs` et `dream_sync_receipts`.
- Upload et signature Storage autorisés au propriétaire, signature refusée à l'autre utilisateur.
- Migration historique : absence complète autorisée; présence partielle d'une table, d'une vue ou d'une fonction refusée et objet sentinelle préservé.

L'admission complète des quotas/jobs (TI-560) n'est pas couverte par le simple refus d'accès direct aux tables. Il s'agit d'un test d'intégration réel séquentiel, pas d'une preuve de performances Android ni de configuration de production. Les comptes Android sont distincts des comptes éphémères du test afin de préserver leur jeu de 2 501 rêves.

## Défaut historique trouvé et correction minimale

Le premier replay inchangé échouait dans `20260723143132_remove_location_subsystem_from_noctalia.sql` : `Location removal aborted: expected 8 tables, found 0`. Cette suppression supposait une ancienne installation Dashboard et comparait des empreintes exactes de données absentes de l'historique.

La correction versionnée ne change aucune vérification destructive : elle ajoute un retour anticipé uniquement lorsque toutes les huit relations nommées, quelle que soit leur nature, et toutes les 27 fonctions nommées sont absentes. Toute présence partielle conserve les contrôles historiques, empreintes et `DROP ... RESTRICT`.

La copie temporaire de configuration conserve les migrations versionnées; seul le nom de projet, les ports et la liste de seed sont adaptés. `seed.sql` est référencé mais absent du dépôt : la liste devient vide dans la copie. Le bucket privé `dream-images`, absent des migrations, est provisionné explicitement comme infrastructure de fixture locale avant le scénario Storage.

## Reproduction

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

La commande canonique `db:qualify:local` valide explicitement le fichier local, puis lance le contrat DB existant et le test d'intégration via `test:file`. Elle échoue en l'absence de fichier; elle ne peut pas présenter une suite ignorée comme une qualification réussie. Le script de seed crée de nouveaux comptes à chaque exécution : conserver le fichier existant pendant une session Android en cours.

Les deux scripts refusent les ports autres que ceux de l'environnement dédié. Le statut contient une clé privilégiée exclusivement locale : garder ce fichier temporaire privé, ne jamais le committer ni le transmettre à l'application. Le fichier client ne contient que les paramètres publics et les identifiants synthétiques nécessaires à Android. Sans `TI528_LOCAL_STATUS`, le test est explicitement ignoré et n'accède à aucune base.

Sources : [développement local Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started), [changelog vérifié](https://supabase.com/changelog), configuration et migrations versionnées. La limite de production n'est pas déduite de cette qualification locale.
