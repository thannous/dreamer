# TI-519 — Journal disponible depuis le cache

Le journal publie le cache du compte et ses mutations locales dès que ces deux lectures ont réussi. La récupération du jeton, la migration des rêves invités et le chargement Supabase ne bloquent plus ce premier contenu. Un rafraîchissement conserve le contenu déjà affiché.

## Contrat fonctionnel

- L’état d’actualisation distante est distinct de l’état de lecture/écriture sur l’appareil. Un échec distant propose une nouvelle tentative sans déclarer les rêves perdus.
- Le passage de la session à l’état prêt est coordonné par un seul effet de chargement.
- Chaque opération appartient à une génération et à un compte. Une réponse obsolète ne publie pas de données ni de nouvelles écritures pour le compte actif.
- Une modification locale pendant une requête garde la priorité. Les migrations différées ne remplacent pas une édition ou une suppression plus récente.
- La suppression d’un rêve dont l’envoi n’a pas encore fourni d’identifiant distant doit conserver une intention durable, masquée lors des lectures suivantes, puis être confirmée sur le serveur du compte concerné.

Le cache n’est pas paginé dans ce lot. Les espaces de stockage et les contrats backend restent inchangés. L’optimisation générale de la CI appartient à une autre tâche.

## Validation

Les tests couvrent notamment le cache visible avant résolution du réseau, le nombre d’appels après disponibilité de la session, les changements de compte, les lectures et écritures échouées, les modifications concurrentes et la reprise des migrations.

La revue indépendante a accepté l’arbre final après correction des fenêtres de concurrence. Les cinq suites ciblées passent : 207 tests. Les vérifications TypeScript application/tests et le contrôle du diff passent. Une durée simulée par Jest ne constitue pas une mesure de rendu sur appareil. Aucune qualification native, Play, OTA ou production n’est revendiquée par ce document.

## Comparaison contrôlée du 7 septembre 2026

Baseline : `77f49c0b4`. Comparaison dans le même Jest Expo/JSDOM, mêmes mocks, trois répétitions par scénario. Un rêve synchronisé dans le cache, lectures de stockage immédiatement résolues, migration déjà terminée, jeton après 1 000 ms puis fetch après 1 000 ms. Le premier contenu signifie `loaded=true` et une liste non vide après flush React.

| Scénario | Avant | Après |
| --- | ---: | ---: |
| Premier contenu, médiane en temps simulé | 2 000 ms | 0 ms |
| Fetch initial | 1 | 1 |
| Fetch total si sessionReady arrive à 100 ms pendant l’attente du jeton | 2 | 1 |
| Fetch supplémentaire si sessionReady arrive après le chargement terminé | 1 | 1 |

Premier contenu : `[2000, 2000, 2000]` avant, `[0, 0, 0]` après. Transition concurrente : `[2, 2, 2]` appels avant, `[1, 1, 1]` après. Chaque exécution a passé six scénarios de mesure. Les 0 ms signifient qu’aucune avance de l’horloge simulée n’est nécessaire après la lecture du cache ; ce n’est pas un temps de rendu réel de 0 ms. Le gain correspond exclusivement aux délais injectés.

Le harness de mesure temporaire et le rapport sont conservés localement dans `/private/tmp/ti519-benchmark-harness/` et `/private/tmp/ti519-measurement.md`, hors de la suite permanente. Les tests de régression permanents couvrent séparément l’ordre de publication et le nombre d’appels. Une mesure native contrôlée reste nécessaire pour qualifier la latence réelle.

Commandes de validation :

```sh
npm run test:file -- hooks/__tests__/useDreamPersistence.test.tsx hooks/__tests__/useDreamJournal.test.tsx hooks/__tests__/useOfflineSyncQueue.test.tsx services/__tests__/supabaseDreamService.test.ts components/journal/__tests__/JournalPersistenceNotice.test.tsx --watchman=false
npm run typecheck:app
npm run typecheck:tests
git diff --check
```

La mesure contrôlée a été rejouée après le dernier correctif : six scénarios passent avec les mêmes résultats. Les intentions de suppression sans identité distante restent conservées si le serveur ne renvoie pas encore le rêve ; une réponse vide ne prouve pas qu’un upload en cours n’aboutira jamais.

Lint ciblé sur tous les fichiers TypeScript modifiés : zéro erreur, six avertissements React Hooks (accès aux refs dans la liste et mises à jour d’état dans des effets). Ces avertissements ne sont pas présentés comme résolus par ce lot.
