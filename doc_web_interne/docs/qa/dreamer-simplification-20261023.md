# Dreamer : simplification et reprise Standard — 2026-10-23

Propriétaire : tâche de simplification autorisée par thanh (« On fait ça »).
Périmètre : compléter la PR #564 et intégrer master après #557. Le prototype
Voice Live et le chemin HD de Dreamer sont retirés ; la dictée habituelle,
Meditation, les images Standard, la réanalyse Plus et les reprises restent actifs.

## Sources et changements

- Base intégrée : `4e4f292f94bcb9c9c380536536996e370e98b9a2`.
- Premier lot de simplification : `1288d265a422a0e8dc31a386e5eafb64ca8c2934`.
- Code qualifié ici : `237b7d1910ca30901191c1948c872fdb03e3a041`, arbre propre
  et stable pendant chacun des trois runs. Les commits documentaires suivants
  réutilisent ces résultats sans les présenter comme de nouvelles exécutions.
- Le conflit de `useDreamJournal` conserve le helper partagé de #564 et la
  reprise Standard de #557. `analysisImageIntent` et sa continuation 2K/4K,
  les assertions exclusivement HD et les extensions HD des fixtures sont retirés.
- Le test HD devient [un parcours de reprise Standard](../../../tools/e2e/tests/backend-analysis-recovery.web.e2e.ts).
  Le [test des limites Plus](../../../tools/e2e/tests/backend-plus-reanalysis.web.e2e.ts)
  conserve toutes ses assertions ; son tag devient `plus-reanalysis`.
- La migration Plus, les trois fichiers de parcours natifs, la reconnaissance
  vocale, `useRecordingSession`, Meditation et les dépendances/lockfiles sont
  identiques à master. `expo-speech` reste installé pour ne pas retirer un module
  natif de Dreamer ; Meditation conserve sa propre dépendance de guidage respiratoire.
- Les résultats HD antérieurs restent historiques, avec des liens vers leurs
  sources immuables. L'assertion Settings portant sur un testID disparu est retirée.

## Vérifications fraîches

| Vérification | Résultat | Limite |
| --- | --- | --- |
| Reprise Standard + règles Plus, backend local réel | 2/2 PASS | Auth/Postgres, handlers et worker réels ; transport IA déterministe, aucun achat/appel IA externe |
| Capture, chat, journal, offre Plus et illustration Standard, en-US | 8/8 PASS | Navigateur, services simulés, fiches d'introduction désactivées |
| Réglages clair/sombre et reprise introduction, fr-FR | 3/3 PASS | Navigateur, services simulés, fiches désactivées |
| Journal, snapshots, égalité, transitions de file, sync et accusés perdus | 6 suites / 209 tests PASS | Tests ciblés de concurrence et persistance |
| Types TesterArmy et vérification Deno du serveur de reprise | PASS | Compatibilité statique |
| `verify:pr` sur `237b7d191` | PASS : 12 exécutés, 3 réutilisés, 7 hors périmètre | 193 suites / 2 581 tests Jest passent ; 1 test déclaré ignoré, 21 avertissements lint connus |
| Revue indépendante du diff final `237b7d191` | Aucun problème concret identifié | Lecture seule, ne remplace pas les parcours |

La reprise Standard édite un rêve déjà analysé, demande une réanalyse sans
remplacer l'image, recharge avant le lancement du worker, puis vérifie le résultat
visible après deux rechargements. Elle exige un seul job, une seule exécution IA
simulée et un seul reçu de quota. Le test Plus conserve le contrôle de propriété,
le refus Free, le hash du texte, l'idempotence et le plafond quotidien.

Les trois reçus `end.json` portent `applicationQualified: true`, des sources et
sorties stables, zéro erreur secondaire et un verrou libéré. Le runner backend
s'est terminé avec le code 0 après destruction de sa seule pile locale jetable.

Versions : e2e 0.21.2, web 0.15.2, mobile 0.12.3, agent-device 0.21.28,
Playwright 1.64.0 ; Supabase CLI 2.121.0, runtime natif local macOS.

## Artefacts et commandes exactes

Les sorties restent dans le worktree enregistré de cette tâche,
`/Users/timax/.codex/worktrees/dreamer-missing-native-journeys/noctalia/tools/e2e/.e2e/` :

- Backend : `backend-web/1792757152088-19878-94b58f61-e224-4201-b754-2f4f756ed0c4`.
- Interface EN : `dreamer-web/1792757205071-23851-22119aee-a6ab-4c04-86d7-b63f5e5a79cd`.
- Réglages FR : `dreamer-web/1792757290359-26564-e4a13ad3-9f93-44d4-8c66-8dd24c906b56`.

Chaque répertoire contient `report.json`, `end.json`, les traces et les captures.
Le reçu compact et les logs de commandes sont sous le dépôt canonique,
`outputs/pr564-simplification-20261023/` ; les médias ne sont pas dupliqués.

```sh
mise exec -- npm run test:e2e:backend -- --tag analysis-recovery --tag plus-reanalysis
mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'guest saves the exact story|free user saves, renames|guest Plus offer|watches its dream painted|capture gives the story room|capture keeps long and fragmentary|capture stops a dream|chat keeps chronological replies'
E2E_WEB_LOCALE=fr-FR mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'grouped settings preserve|Settings replays the introduction'
mise exec -- npm run verify:pr
```

## Limites

Pas de nouvelle campagne native iOS/Android, de build ni de preuve OTA sur ce
commit. Les résultats natifs de #557 restent attachés à leurs anciens binaires,
y compris la dictée iOS non qualifiée. Pas de preuve d'achat, de rendu HD ou de
production. Le backend HD et ses données restent en place ; aucune migration,
publication, configuration distante ou donnée personnelle n'est modifiée ici.
