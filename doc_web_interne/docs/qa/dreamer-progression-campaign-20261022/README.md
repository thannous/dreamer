# Campagne de tests — progression Dreamer, 22 octobre 2026

Suivi de la campagne demandée par Thanh (message transmis par Codex) sur les trois
priorités Dreamer : conservation des badges, redécouverte et notes personnelles,
parcours de guides. Responsable de ce suivi : Claude (session cloud). Le suivi maître
reste celui de Codex sur le Mac ; ce document en est la contribution Claude, avec les
mêmes 27 ID.

- **Candidat** : PR [thannous/dreamer#555](https://github.com/thannous/dreamer/pull/555),
  branche `codex/dreamer-progression-20261022`, commit
  `271fd2b5c879e22f42b08979f9af842b0561ec45`. PR ouverte, non fusionnée, fusionnable ;
  aucun check CI ni statut de déploiement sur ce SHA.
- **Autorisation et limites** : campagne de tests seulement. Ni fusion, ni déploiement
  app/backend, ni publication Store. Aucun compte de production créé ou supprimé. Aucun
  achat ni appel IA payant. Aucun changement de droits ou du registre OAuth. Aucune clé
  privilégiée utilisée. Aucune donnée réelle modifiée.
- **Date d’exécution** : les preuves fraîches F1 à F3 ont été exécutées le 22/10/2026
  sur 271fd2b. R1 à R5 sont réutilisées (révisions antérieures ou même SHA, artefacts
  bruts non accessibles ici) ; voir [Preuves](#preuves).

## Synthèse

| Statut dans l’environnement exigé | Nombre | ID |
| --- | --- | --- |
| PASS | 0 | — |
| FAIL | 0 | — |
| BLOQUÉ | 27 | tous : H, Q et N indisponibles ici |
| NON EXÉCUTÉ | 0 | — |

Un statut ne change que dans l’environnement exigé. Les défauts reproduits sur des
équivalents locaux sont donc relevés comme anomalies, sans changer le statut :
- Q03 et N03 : A1 ;
- Q01 : A2 et A3.

Les parcours H sont **BLOQUÉS** : aucune application candidate hébergée (URL ou build)
contenant ce commit, et aucun compte QA A/B autorisé n’est disponible ici. Les cas N
sont **BLOQUÉS** : aucune cible native ni build Release candidat. Le runner Q (stack
Supabase locale jetable) est **BLOQUÉ** dans ce conteneur : il tourne en root et
l’environnement d’exécution a refusé la création d’un utilisateur système non-root pour
Postgres (`SUPABASE_NATIVE_POSTGRES_USER`).

Les contrôles indépendants ont continué. Ils restent étiquetés selon leur nature exacte,
jamais comme hébergés ou natifs :

- **mock** : TesterArmy web en mode mock.
- **inspection** : Playwright sur le serveur web mock, sans valeur de parcours.
- **PGlite** : PostgreSQL synthétique en processus, sur les vraies migrations.
- **réutilisé** : preuves de Codex.

### Anomalies

| ID | Sévérité | Cas | Résumé |
| --- | --- | --- | --- |
| A1 | Moyenne, latente | Q03, N03 | Une note acquittée par un serveur pré-migration ne peut plus jamais être sauvegardée : l’ancien reçu est rejoué après la migration. Confirme le fil Codex P2 ouvert sur la PR. |
| A2 | Faible (robustesse) | Q01 | Une mutation de notes invalide fait échouer **tout** le lot `sync_dream_mutations` (erreur 23514), y compris les mutations valides du même lot, au lieu d’un résultat `failed` par mutation. |
| A3 | Faible | Q01 | Un collage de 4 001 caractères dans l’éditeur de note est tronqué en silence à 4 000 (`maxLength`) : compteur `4000 / 4000`, pas de refus explicite. Contredit « ni le client ni la base ne tronquent ». |
| O1 | Observation (préexistante) | U01 | Allemand : le nouveau texte des guides vouvoie (« Sie haben … markiert »), comme les guides existants, alors que notes et collection tutoient. Textes des guides corrigés le 23/10 ; cartes symboles et lexique encore en « Sie » (lot fiches symboles). |

### Prochaines actions

1. **Corriger A1 avant fusion.** Deux options : relancer une mutation de notes refusée
   sous une nouvelle identité de reçu ; ou faire invalider/retraiter, par la RPC migrée,
   un reçu `ack` dont la réponse n’a pas de `personal_notes` alors que la requête en
   portait. Ajouter le cas au contrat SQL.
2. **Décider A2 et A3**, propriétaire : Codex/Thanh.
   - A2 : renvoyer `failed` par mutation, comme pour les limites de longueur et de débit.
   - A3 : refuser explicitement au-delà de 4 000 caractères plutôt que tronquer.
3. **Débloquer H** :
   - un candidat app hébergé identifié (URL de prévisualisation ou build) sur 271fd2b
     ou son successeur, branché sur le backend migré ;
   - deux comptes QA autorisés A/B et des profils isolés.
   La branche Supabase `e2e` prévue par [test-login](../../test-login.md) n’existe pas
   encore et `scripts/test-supabase-targets.json` est vide.
4. **Débloquer Q** : rejouer sur le Mac de Codex, ou sur une machine qualifiée, les
   commandes `test:e2e:backend` du rapport d’intégration, sur 271fd2b ou après
   correction d’A1. Dans ce conteneur, il faudrait un utilisateur non-root.
5. **Débloquer N** : build Release candidat identifié et cible QA possédée (un worker
   par cible).

## H00 — identification du candidat

| Élément | Constat | Source |
| --- | --- | --- |
| SHA | `271fd2b5c879e22f42b08979f9af842b0561ec45`, pointe de `origin/codex/dreamer-progression-20261022` | `git fetch`, PR #555 |
| URL/build app | **Aucun.** Ni statut de commit ni check run sur le SHA ; Codex indique ne pas avoir publié l’app. | GitHub (statuts/checks vides) |
| Mode | Réel : non disponible. Mock : serveur Expo web local construit depuis 271fd2b (`.env.mock`). | ce conteneur |
| Backend hébergé | Projet Supabase de production `usuyppgsmmowzizhaoqj` (profils publics suivis `.env.playstore`, `.env.teststore`) | dépôt |
| Migrations distantes | `badge_ledger_continuity=20261022180520`, `dream_personal_notes=20261022180532`, `guide_reading_progress=20261022180535`, déployées par Codex le 22/10 à 20:05 (Paris). Sources : `20261022170231_…`, `20261022170242_…`, `20261022170346_…`. | Codex, réutilisé |
| Revue backend | Schéma, fonctions, contraintes, permissions, RLS : PASS. Smoke SQL lecture seule : 4 validations, 3 refus RPC sans identité, 2 lectures RLS sans identité, 4 refus anonymes. Ne prouve pas les parcours positifs. | Codex, réutilisé |
| Comptes QA A/B | **Aucun** disponible : pas de `.env.test.local`, liste de cibles de test vide, branche `e2e` non créée. | dépôt, environnement |
| Cible native | **Aucune** (conteneur Linux sans appareil ni émulateur) ; aucun build Release candidat. | environnement |
| Stack Q | Linux x86_64, glibc 2.39, Supabase CLI 2.121.0 verrouillé : compatible, mais exécution en root sans `SUPABASE_NATIVE_POSTGRES_USER` ; création d’un utilisateur refusée. | `scripts/check-native-supabase-runtime.cjs` |
| `verify:pr` | PASS sur 271fd2b (8 exécutés, 5 réutilisés, 9 hors périmètre ; Jest 193 suites/2 563 tests ; Deno 354) | corps de la PR, réutilisé |
| Revue Codex | 1 fil ouvert (P2, `services/journalMutationTransport.ts:309-312`) : reçu périmé avant nouvelle tentative des notes. Confirmé ici (A1). | PR #555 |

**Statut : BLOQUÉ.** L’identification source, backend et migrations est faite, mais il
n’existe ni application candidate hébergée, ni comptes QA, ni cible native.

## Preuves

### Fraîches (cette campagne, 22/10/2026, commit 271fd2b)

**F1 — TesterArmy web mock : 3/3 PASS, code 0.**
- Worktree isolé au SHA exact ; `npm ci` réel (le runner refuse les sources liées par
  symlink) ; source propre et stable du début à la fin (`sourceClean: true`, révision
  début = fin = 271fd2b).
- Versions : e2e 0.21.2, Playwright 1.64.0, Node 24.22.1, locale en-US, un worker.
- Parcours :
  - « a written dream earns its card face down, turned over once and kept after a reload » ;
  - « guide reading resumes after reload and only explicit completion earns a unique badge event » ;
  - « personal notes survive reload, edits and deletion without changing the dream; old dreams are rediscovered ».
- Artefact : `tools/e2e/.e2e/dreamer-web/1792693279874-1445-6c8eb604-dade-4dbf-b3b6-ce91f2b3b8b4`
  (rapport, junit, traces, 6 captures). Il est conservé dans le conteneur cloud
  éphémère seulement, pas dans Git.
- Rejouer :

```sh
E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'a written dream earns|guide reading resumes|personal notes survive reload'
```

**F2 — Sonde PGlite des trois migrations : 9/9 PASS.**
- [`progression-db-probe.test.cjs`](progression-db-probe.test.cjs). PostgreSQL synthétique
  en processus, même approche que les contrats `scripts/*-migration.test.cjs`.
- Exécute les vraies migrations `20261021171000` (serveur pré-notes), puis les trois
  migrations du candidat, avec la vraie fonction `current_app_product()`.
- Les sessions sont ordinaires : rôles `authenticated`/`anon` avec claims JWT
  synthétiques ; aucun rôle qui contourne RLS.
- La sonde refuse de tourner si une migration diffère des octets de 271fd2b
  (empreintes SHA-256 dans le script).
- Limites :
  - pas de Supabase Auth ni de PostgREST ;
  - table `dreams` minimale, sans ses politiques RLS historiques ;
  - registre OAuth simulé par une table locale.
- Rejouer :

```sh
mise exec -- node --test doc_web_interne/docs/qa/dreamer-progression-campaign-20261022/progression-db-probe.test.cjs
```

**F3 — Inspection web mock (Playwright, pas un parcours).**
- [`ui-inspect.mjs`](ui-inspect.mjs), sur le serveur Expo web mock démarré depuis 271fd2b.
- Six langues, viewport 320×640, `reducedMotion: reduce`.
- Pour chaque langue : notes (éditeur et note enregistrée), liste des guides, statut et
  achèvement d’un guide, puis collection. Mesures : clés i18n brutes, débordement
  horizontal, éléments hors écran, erreurs JS.
- Avec `--limits` (en-US) : collage de 4 001 caractères et plafond de 50 notes.
- Captures et rapport hors Git (`test-results/`, ignoré). Le rapport `report*.json`
  enregistre la révision du checkout et l’URL servie.
- Le script refuse de tourner si les sources de l’app diffèrent de 271fd2b (seul ce
  dossier de campagne peut changer).
- Il sort en échec à la moindre régression relevée : étape incomplète, erreur de page,
  clé brute, débordement, contrôle hors écran, ou limite non honnête avec `--limits`.
  Tant qu’A3 n’est pas corrigée, `--limits` sort donc en échec en la reproduisant.
- Rejouer : démarrer d’abord le serveur web mock depuis ce même checkout avec les
  réglages utilisés ici, puis lancer l’inspection quand `http://127.0.0.1:8096/` répond.

```sh
EXPO_NO_METRO_LAZY=1 EXPO_PUBLIC_MOCK_AUDIO=true EXPO_PUBLIC_MOCK_PERSISTENCE=true \
  EXPO_PUBLIC_PERFORMANCE_TRACING=false NOCTALIA_APP_VARIANT=noctalia EXPO_PUBLIC_APP_VARIANT=noctalia \
  EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false \
  mise exec -- npm run start:mock -- --web --port 8096
node doc_web_interne/docs/qa/dreamer-progression-campaign-20261022/ui-inspect.mjs
node doc_web_interne/docs/qa/dreamer-progression-campaign-20261022/ui-inspect.mjs en-US --limits
```

### Réutilisées (Codex, artefacts sur le Mac, non accessibles ici)

Les identifiants viennent du [rapport d’intégration](../dreamer-progression-20261022.md).
Validité pour 271fd2b, vérifiée par `git diff` :
- de 46cd3fae2 à 271fd2b, seuls changent la copie FR/PT, `services/guideReadingStore.ts`
  (transfert des guides, requalifié ensuite), un test de routes et un helper E2E ;
- de 68f42e56a à 271fd2b, seuls changent la copie FR/PT et un test de routes.

| Réf. | Preuve | Valeur pour 271fd2b |
| --- | --- | --- |
| R1 | Backend local (Q, runner possédé) `backend-web/1792690908954-…` sur 46cd3fae2 : 8 PASS / 1 échec. Badges ×3 et notes ×3 PASS. | Valide pour badges et notes : aucun code badge/notes modifié depuis. |
| R2 | `backend-web/1792691270209-…` sur 30e93d170 : droits, signets et restauration des guides PASS. | Valide (copie seulement depuis). |
| R3 | `backend-web/1792691367910-…` sur 68f42e56a : guides attribués au premier compte, guides fermés pendant les changements de compte, PASS. | Valide (copie seulement depuis). |
| R4 | `verify:pr` PASS sur 271fd2b : Jest, dont les tests ciblés `badgeLedgerStore`, `badgeLedgerSync`, `guideReadingStore`, `dreamUtils`, `journalMutationTransport`, `accountDeletionService`. | Même SHA ; non relancé (aucune entrée changée). |
| R5 | Revue schéma/RLS et smoke SQL lecture seule sur le backend hébergé. | Contrats négatifs seulement ; aucun parcours positif. |

## Suivi des 27 cas

Le statut porte sur l’environnement exigé par le plan. Les équivalents locaux sont
décrits à part et ne changent pas ce statut.

| ID | Prio | Env | Statut | Équivalent local, preuve | Anomalie | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| H00 | P1 | — | BLOQUÉ | Identification faite (ci-dessus) | — | Fournir candidat hébergé et comptes A/B |
| B01 | P1 | H | BLOQUÉ | R1 PASS ; F1 PASS (local seulement) | — | Rejouer en H |
| B02 | P1 | H | BLOQUÉ | R1 PASS ; R4 | — | Rejouer en H |
| B03 | P1 | H | BLOQUÉ | F2 PASS (CAS) ; R4 | — | Rejouer en H, deux profils |
| B04 | P1 | H | BLOQUÉ | F2 PASS (RPC liée au compte) ; R4 | — | Rejouer en H |
| B05 | P2 | H | BLOQUÉ | F2 PASS (côté base) ; R4 | — | Rejouer en H |
| R01 | P2 | H/Q | BLOQUÉ | F1 PASS partiel (mock) ; lecture de code | — | Fixture adaptée en Q ou H |
| N01 | P1 | H | BLOQUÉ | F1 PASS (mock) ; F3 dates | — | Rejouer en H |
| N02 | P1 | H | BLOQUÉ | R1 PASS | — | Rejouer en H |
| N03 | P1 | H/Q | BLOQUÉ | F2 PASS ; R1 PASS | A1 (lié) | Harness QA en H ou runner Q |
| N04 | P1 | H | BLOQUÉ | F2 PASS (serveur) ; R1 ; R4 | — | Rejouer en H, deux profils |
| N05 | P1 | H | BLOQUÉ | R1 PASS | — | Rejouer en H |
| G01 | P1 | H | BLOQUÉ | F1 PASS (mock) ; R2 PASS ; F3 six langues | — | Rejouer en H ; texte agrandi en N |
| G02 | P1 | H | BLOQUÉ | F1 PASS (mock) | — | Rejouer en H |
| G03 | P1 | H | BLOQUÉ | F2 PASS (SQL) ; R4 | — | Rejouer en H avec lecture cloud retardée |
| G04 | P1 | H | BLOQUÉ | R3 PASS ; R4 | — | Rejouer en H, comptes A/B |
| G05 | P2 | H | BLOQUÉ | R4 | — | Rejouer en H |
| S01 | P1 | H | BLOQUÉ | F2 PASS ; R1, R2 ; R5 | — | Sessions ordinaires A/B en H |
| S02 | P1 | H, sinon schéma + Q | BLOQUÉ | F2 PASS (vraie fonction, registre simulé) ; R1 ; R5 | — | Contextes produit QA réels, ou runner Q |
| S03 | P1 | H lecture + Q | BLOQUÉ | R5 (H lecture) ; F2 PASS ; R4 | — | Runner Q, compte jetable |
| U01 | P2 | H/Q | BLOQUÉ | F3 PASS partiel (mock) | O1 | Texte agrandi natif ; changement de langue en session |
| Q01 | P1 | Q | BLOQUÉ | F2 bornes PASS ; F3 plafond 50 PASS ; A2 et A3 reproduites | A2, A3 | Décider A2/A3 ; rejouer en Q |
| Q02 | P1 | Q | BLOQUÉ | R4 (isolation, stockage mémoire) | — | Runner Q |
| Q03 | P1 | Q simulé | BLOQUÉ | F2 : A1 reproduite (reprise impossible) ; R4 (pas de fausse confirmation) | A1 | Corriger A1 ; rejouer en Q |
| T01 | P1 | N | BLOQUÉ | Aucun ; NON QUALIFIÉ | — | Build Release et cible native |
| T02 | P1 | N | BLOQUÉ | Aucun ; navigateur vierge ≠ réinstallation | — | Installation QA vierge possédée |
| T03 | P2 | N | BLOQUÉ | Aucun ; pas de mesure FPS | — | Cible native, lecteur d’écran |

## Détail par cas

Pour tous les cas :
- **Commit** : 271fd2b, sauf mention de preuve réutilisée.
- **Date** : 22/10/2026.
- **Build** : aucun build hébergé ou natif. Les équivalents locaux utilisent le serveur
  web mock de 271fd2b (F1, F3) ou PGlite (F2).

### H00 — P1 — identification

- **Prérequis** : accès au dépôt, à la PR et à l’environnement.
- **Actions et assertions** : SHA, URL/build, mode, backend, migrations, comptes, cibles
  natives, faisabilité Q.
- **Statut** : BLOQUÉ (voir section H00).
- **Preuve** : section H00.
- **Prochaine action** : fournir le candidat hébergé et les comptes A/B.

### B01 — P1/H — acquisition puis restauration de A sur navigateur vierge

- **Prérequis H manquants** : candidat hébergé, compte A, profil vierge.
- **Statut H** : BLOQUÉ.
- **Équivalent local** :
  - R1 « saved and reading badges restore on an empty browser with their original
    acquisition dates » : PASS en Q (réutilisé).
  - F1 (mock) : carte gagnée face cachée, révélée une fois, conservée après reload
    (local seulement, aucune confirmation distante en mock).
- **À vérifier en H** :
  - même progression, palier, date et révélation ;
  - statut « sauvegardé » seulement après confirmation.

### B02 — P1/H — coupure du seul service badges

- **Statut H** : BLOQUÉ.
- **Équivalent** :
  - R1 : échec du service de sauvegarde avec état local conservé, puis reload et reprise
    (Q, réutilisé) ;
  - R4 : accusé perdu retenté sans double comptage ni changement de date (isolation).
- **Lecture de code** : `BadgeSyncHost` passe à `pending`, puis `unavailable` en cas
  d’échec, et retente toutes les 30 s, au retour au premier plan et au retour du réseau.
- **À vérifier en H** : le libellé de statut réellement affiché pendant la coupure.

### B03 — P1/H — deux profils de A, actions distinctes

- **Statut H** : BLOQUÉ.
- **F2 (PGlite)** : une écriture sur une révision périmée est refusée
  (`accepted: false`) et reçoit la ligne courante ; la ligne gagnante est intacte.
- **R4 (isolation)** : union, déduplication et nouveau palier franchi une seule fois ;
  appareils distincts au même horodatage non confondus.
- **À vérifier en H** : la reprise de conflit réelle entre deux profils.

### B04 — P1/H — changement A→B pendant lecture/sauvegarde différée

- **Statut H** : BLOQUÉ.
- **F2** : un worker lié à A qui porte la session de B est refusé (42501) ; rien n’est
  écrit chez A ni chez B ; B garde un registre vide.
- **R4** :
  - réponse tardive ignorée après changement de compte ;
  - action finie pendant une lecture différée attribuée à A ;
  - aucun import de A chez B.
- **À vérifier en H** : le retour de A et ses données complètes.

### B05 — P2/H — suppression d’un rêve synthétique après acquisition

- **Statut H** : BLOQUÉ.
- **F2** : supprimer un rêve supprime ses notes (même ligne) ; les autres rêves et
  leurs notes sont intacts ; le registre de badges et ses dates ne sont pas touchés.
- **R4** : un palier acquis garde sa date quand le journal se vide.

### R01 — P2/H ou Q — redécouverte

- **Statut H/Q** : BLOQUÉ (ni fixture H, ni runner Q).
- **F1 (mock, fixture possédée vieillie à 45 jours dans un stockage mock isolé, aucun
  rêve personnel antidaté)** :
  - aucune carte pour un rêve récent ;
  - carte présente après vieillissement ;
  - ouverture sur le bon récit, note supprimée absente.
- **Lecture de code** (`lib/dreamRediscovery.ts`, `app/(tabs)/index.tsx`) :
  - l’anniversaire a la priorité ;
  - choix stable sur la journée locale (index par jour local) ;
  - seuil de 30 jours calendaires locaux ;
  - analyse non requise.
- **Limite** : aucun test ne fixe la stabilité quotidienne ni la priorité de
  l’anniversaire ; non observées en parcours.

### N01 — P1/H — note : ajout, reload, édition, annulation puis suppression

- **Statut H** : BLOQUÉ.
- **F1 (mock)** : ajout, reload et note retrouvée ; édition qui remplace le texte avec
  le récit inchangé ; annulation de suppression puis suppression confirmée ; note
  absente ensuite.
- **F3** : date de création affichée dans les six langues.
- **Non couvert** :
  - la mention « modifiée le » après une édition un autre jour (non visible le même
    jour) ;
  - l’absence de requête IA, non mesurée côté réseau (mock sans réseau).

### N02 — P1/H — note hors ligne, réseau puis second navigateur

- **Statut H** : BLOQUÉ.
- **R1** : « personal notes survive an offline save and a fresh browser without changing
  the dream » PASS en Q (réutilisé).
- **À vérifier en H** : persistance locale immédiate et absence de fausse confirmation.

### N03 — P1/H (harness limité) sinon Q — ancien client et retry de création

- **Statut H/Q** : BLOQUÉ.
- **F2 (PGlite)** :
  - un ancien client qui met à jour le titre sans `personal_notes` conserve les notes ;
  - une création retentée (nouveau reçu, même `client_request_id` de rêve) ne crée
    aucun doublon et conserve les notes ;
  - le même reçu rejoué renvoie la même réponse ;
  - `personal_notes: []` vide explicitement les notes : champ omis et tableau vide sont
    bien distingués.
- **R1** : compatibilité ancien client, PASS en Q.
- **Anomalie liée** : A1 (retry après réponse d’un serveur pré-migration).

### N04 — P1/H — deux profils, conflits édition/édition et édition/suppression

- **Statut H** : BLOQUÉ.
- **F2** : édition et suppression sur une révision périmée reçoivent `conflict`
  explicite ; rien n’est écrasé ni supprimé.
- **R4 (isolation)** :
  - deux ajouts indépendants fusionnés ;
  - édition/édition et édition/suppression lèvent un conflit, sans résurrection ;
  - fusion au-delà de 50 notes refusée sans troncature.
- **R1** : refus des écrasements concurrents, PASS en Q.
- **Lecture de code** : l’éditeur se verrouille quand le rêve est en `conflict` ; le
  brouillon reste dans l’état du composant.
- **Non observé** : l’expérience de conflit côté UI.

### N05 — P1/H — brouillon pendant l’attribution de l’identité serveur

- **Statut H** : BLOQUÉ.
- **R1** : « a personal-note draft stays open while an offline dream gains its server
  identity » PASS en Q.

### G01 — P1/H — section, sortie, reprise, restauration ailleurs

- **Statut H** : BLOQUÉ.
- **F1 (mock)** :
  - statuts Visited / In progress / Completed corrects ;
  - signet au-delà de 0 ;
  - « Reprendre » ramène la section 3 à l’écran après reload.
- **R2** : restauration des signets et achèvements sur navigateur vierge, PASS en Q.
- **F3** : statuts et résumé traduits dans les six langues, sans clé brute.
- **Non couvert** : changement de langue dans la même session ; texte agrandi (non
  émulable sur web, relève de T03).

### G02 — P1/H — ouverture sans récompense, deux achèvements explicites

- **Statut H** : BLOQUÉ.
- **F1 (mock)** :
  - l’ouverture n’ajoute aucune clé `night-scholar` ;
  - deux achèvements explicites donnent deux clés, puis une carte « New Bronze » ;
  - la réouverture ne duplique rien (toujours 2) ;
  - l’exercice reste facultatif (ouvre `/ritual/memory`).
- **R4** : un ancien badge reste acquis.

### G03 — P1/H — lecture cloud retardée, visite à zéro puis signet réel

- **Statut H** : BLOQUÉ.
- **F2 (SQL)** :
  - une visite à 0 n’écrase ni le signet ni son horodatage ;
  - un vrai signet plus ancien remplace une visite à 0 ;
  - un signet plus ancien ne gagne pas ;
  - l’achèvement n’est jamais retiré et garde sa première date.
- **R4** : le signet cloud est conservé quand un appareil neuf visite avant la réponse
  distante.

### G04 — P1/H — invité termine, guides fermés, A, déconnexion, B, retour A

- **Statut H** : BLOQUÉ.
- **R3** : PASS en Q sur 68f42e56a (copie seulement depuis).
- **R4** :
  - transfert unique ;
  - un démarrage froid déjà connecté n’adopte pas une progression étrangère ;
  - transfert interrompu terminé pour son propriétaire réservé.

### G05 — P2/H — achèvement hors ligne, retry, exercice facultatif

- **Statut H** : BLOQUÉ.
- **R4** : achèvement hors ligne conservé et retenté ; une visite ne vaut jamais
  achèvement.
- **Lecture de code** (`lib/guideReadingCopy.ts`) : chaque exercice ouvre le journal ou
  un rituel, sans achat ni IA ; F1 vérifie `/ritual/memory`.

### S01 — P1/H — B et anonyme contre les lignes de A, puis réaffectation

- **Statut H** : BLOQUÉ (pas de comptes QA ; aucune clé privilégiée utilisée).
- **F2 (sessions ordinaires)**, avec intégrité de A identique avant et après :
  - B lit 0 ligne de badges et de guides de A ;
  - les mises à jour de B touchent 0 ligne ;
  - l’insertion de B pour A est refusée (42501) ;
  - les RPC badges et guides de B pour A sont refusées (42501) ;
  - la mise à jour des notes d’un rêve de A par B donne « Dream not found » ;
  - la suppression par B d’un rêve de A rend un `ack` idempotent sans rien supprimer ;
  - B ne peut pas s’approprier la ligne de A (0 ligne) ;
  - A ne peut pas céder ses guides à B (42501) ;
  - l’anonyme est refusé sur les tables et les trois RPC (42501).
- **R1/R2** : refus des comptes étrangers, PASS en Q.
- **R5** : 4 refus anonymes sur l’hébergé, lecture seule.

### S02 — P1/H avec contextes produit réels, sinon schéma + Q

- **Statut H** : BLOQUÉ (aucun contexte produit QA réel ; registre OAuth non touché).
- **F2** : vraie fonction `current_app_product()`, registre simulé par une table locale.
  - legacy (sans `client_id`) et `journal` sont acceptés pour les badges, les guides et
    `sync_dream_mutations` (notes) ;
  - Lucid, un autre produit et un `client_id` inconnu sont refusés (42501) ou voient
    0 ligne ;
  - des `user_metadata`/`app_metadata` « journal » n’ouvrent rien.
- **R1** : refus des autres produits sur le même compte, PASS en Q.

### S03 — P1/lecture seule H + Q — cascades, suppression de compte et logout

- **H, lecture seule** : revue du schéma par Codex, PASS (R5, réutilisé).
- **Statut Q** : BLOQUÉ (runner).
- **F2** :
  - la suppression de l’utilisateur A efface ses badges, guides et rêves (et donc
    leurs notes) ;
  - B est intact ;
  - la suppression d’un rêve n’efface que ses notes.
- **R4** :
  - effacement local seulement après suppression de compte confirmée (pas au logout) ;
  - barrières contre les réponses tardives.
- **Non exécuté** : la vraie suppression de compte via l’API sur une stack jetable.

### U01 — P2/H ou Q — six langues, petit écran, texte agrandi

- **Statut H/Q** : BLOQUÉ.
- **F3 (mock, 320 px)**, sur notes, guides et collection, en FR/EN/DE/ES/IT/PT :
  - aucune clé brute ;
  - aucun débordement horizontal ni bouton hors écran ;
  - aucune erreur JS.
- **Registre** :
  - FR tutoie partout (« Ton récit original reste intact », « Tu as marqué ce guide… »,
    « Connecte-toi… ») ;
  - PT est brésilien (« você », « Excluir », « Salvar ») ;
  - statut invité honnête (« Collection conservée sur cet appareil »).
- **Observation O1** (allemand, préexistante dans les guides).
- **Non couvert** : texte agrandi (natif) et changement de langue en cours de session.

### Q01 — P1/Q — bornes

- **Statut Q** : BLOQUÉ (runner). Anomalies A2 et A3 reproduites sur les équivalents.
- **F2 : refus en base, sans écrasement et sans reçu.**
  - Notes : 50 notes et 4 000 caractères acceptés ; 51 notes, 4 001 caractères,
    identifiant dupliqué, texte vide ou `updatedAt < createdAt` refusés.
  - À 50 notes, l’édition d’une note existante est acceptée.
  - Badges : famille inconnue, registre de plus de 512 Kio, plus de 100 clés,
    `revealed > 3`, champ inconnu, 4 dates et paramètres incomplets refusés (22023).
  - Guides : guide inconnu et sections 101 et −1 refusés (23514), aucune ligne créée.
  - Mais le refus d’une note invalide annule tout le lot (A2).
- **F3 (mock UI)** :
  - à 50 notes, le bouton d’ajout disparaît ;
  - le message « This dream has 50 notes. You can edit an existing note. » s’affiche ;
  - l’édition reste possible et s’enregistre.
  - Mais un collage de 4 001 caractères est tronqué en silence (A3).

### Q02 — P1/Q — marqueur de transfert, réponses tardives, suppression, stockage illisible

- **Statut Q** : BLOQUÉ.
- **R4 (isolation, stockage mémoire)** :
  - échec du marqueur, retry puis B : l’intention de A est conservée et rien ne va à B ;
  - suppression d’un compte avec écritures en file ;
  - stockage illisible laissé intact ;
  - réponses tardives ignorées.
- **Limite** : ce n’est pas une preuve Q.

### Q03 — P1/Q simulé — ancien serveur sans notes

- **Statut Q** : BLOQUÉ (runner). Anomalie A1 reproduite en simulation PGlite.
- **Pas de fausse confirmation** : le client convertit un `ack` sans `personal_notes`
  en `failed` (R4, `journalMutationTransport`). Données locales conservées.
- **La reprise échoue (A1)** : après migration, la même mutation rejoue l’ancien reçu
  et les notes ne sont jamais écrites (F2).
- Le backend hébergé n’a pas été rétrogradé.

### T01, T02, T03 — P1/P1/P2/N

- **Statut** : BLOQUÉ ; NON QUALIFIÉ (aucune cible native ni build Release candidat).
- Un navigateur vierge n’équivaut pas à une réinstallation native.
- Aucune mesure FPS n’est revendiquée.

## Anomalies détaillées

### A1 — Reçu périmé : notes jamais sauvegardées après un serveur pré-migration

- **Sévérité** : moyenne, latente. Exposition actuelle faible : le backend hébergé est
  migré depuis le 22/10 20:05 et aucune app avec notes n’est publiée. Le défaut
  revient avec tout environnement sans la migration (rollback, branche de test
  incomplète, build pointé vers un backend en retard).
- **Environnement** : PGlite (F2) sur les migrations 271fd2b, et lecture du client.
- **Attendu** : après déploiement de la migration, la note en attente est sauvegardée.
- **Observé** : la nouvelle tentative avec le même `client_request_id` rejoue le reçu
  `ack` enregistré par l’ancien serveur ; la colonne `personal_notes` reste `[]`. Le
  client reconvertit ce `ack` en `failed` à chaque tentative, sans fin.
- **Étapes** :
  1. Sur la fonction pré-notes, `create` avec `personal_notes` : `ack`, reçu enregistré,
     réponse sans notes.
  2. Appliquer les trois migrations.
  3. Rejouer la même mutation : réponse identique, notes absentes.
  4. Une nouvelle identité de reçu sauvegarde bien les notes.
- **Preuve** : F2, test « Q03/N03-P2 ».
- **Lecture du client** : `services/journalSyncEngine.ts` conserve la mutation, même
  `id` et même `clientRequestId`, en `failed`, et la renvoie.
- **Correction proposée** : voir Prochaines actions, point 1.

### A2 — Une note invalide fait échouer tout le lot de synchronisation

- **Sévérité** : faible (robustesse). Le client officiel borne déjà le nombre et la
  longueur des notes, mais un état local invalide bloquerait aussi les autres
  mutations du même lot, à chaque tentative.
- **Environnement** : PGlite (F2).
- **Attendu** : refus explicite de la seule mutation fautive, comme pour
  `DREAM_TRANSCRIPT_TOO_LONG` et `DAILY_DREAM_LIMIT`.
- **Observé** : lot [titre valide, 51 notes] → exception 23514
  (`dreams_personal_notes_valid`) pour tout l’appel ; le titre valide n’est pas
  appliqué ; aucun reçu.
- **Preuve** : F2, test « Q01 ».
- **Correction proposée** : valider `personal_notes` dans la boucle et renvoyer
  `failed` avec un code dédié, sans reçu.

### A3 — Collage de plus de 4 000 caractères tronqué en silence

- **Sévérité** : faible (perte silencieuse de la fin d’un texte collé, rare).
- **Environnement** : web mock 271fd2b (F3), Chromium. `maxLength` de `TextInput`
  tronque aussi sur natif (non vérifié).
- **Attendu** : refus explicite, sans troncature, comme l’indique le rapport Codex
  « neither client nor database truncates data ».
- **Observé** : valeur de 4 000 caractères, compteur `4000 / 4000`, aucun message.
- **Étapes** :
  1. Ouvrir un rêve, puis « Add a personal note ».
  2. Coller 4 001 caractères.
  3. Lire la valeur et le compteur.
- **Preuve** : F3 `--limits`.
- **Correction proposée** : retirer `maxLength`, garder le compteur, désactiver
  l’enregistrement au-delà de 4 000 caractères avec un message.

### O1 — Registre allemand mixte dans les guides

Les textes de progression des guides (`lib/guideReadingCopy.ts`) vouvoient, comme les
guides existants (`lib/dreamGuideCopy.ts`). Notes et collection tutoient. Ce n’est
pas une régression du candidat ; décision éditoriale à prendre (Thanh).

**Partiellement corrigé le 23/10/2026, O1 reste ouverte.** Sur demande de Thanh,
l’allemand de l’interface des guides, de leur progression et des quatre guides pratiques
passe au « du » prévu par le [contrat de marque](../../../../specs/noctalia-brand-contract.md)
(`lib/guideReadingCopy.ts`, `lib/dreamGuideCopy.ts`, `data/practicalDreamGuides.ts`).
Les quatre guides de symboles affichés dans l’app (`services/dreamGuideService.ts`)
lisent `docs-src/static/data/curation-pages.json`, partagé avec le site, dont la
[charte éditoriale](../../charte-editoriale.md) impose « Sie » en allemand : un lecteur
allemand passe donc encore du « du » au « Sie » dans ces quatre guides.
Prochaine action (Thanh) : passer le site allemand au « du » (charte et contenu public),
ou fournir à l’app une version « du » de ces guides.

**Textes des guides corrigés le 23/10/2026.** Thanh choisit le « du » pour tout l’allemand. La
[charte éditoriale](../../charte-editoriale.md) passe à « du (DE) », et les quatre guides
de symboles de l’app avec les huit guides et le hub du site
(`docs-src/static/data/curation-pages.json`, `scripts/build-guides-pages.js`) sont
convertis. Reste visible dans l’app : les cartes symboles de ces guides et le lexique
lisent les fiches symboles (`data/dream-symbols*.json`, synchronisées vers `data/app/`),
encore en « Sie ». Elles passent au « du » avec le lot fiches symboles du site, puis
articles, sans changer leurs URL.

## Limites

- Aucun résultat de cette campagne ne qualifie l’application hébergée, le backend
  hébergé en écriture, une installation native ou la production.
- Les preuves PGlite n’exercent ni Supabase Auth ni PostgREST.
- Les preuves mock n’exercent aucune synchronisation distante.
- Les artefacts bruts de F1 et F3 restent dans le conteneur cloud éphémère ; ce
  résumé expurgé et les deux scripts sont la trace durable.
- Ni données réelles, ni comptes, ni droits, ni registre OAuth, ni backend n’ont été
  modifiés.
