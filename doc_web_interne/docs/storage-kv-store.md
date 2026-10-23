# Stockage natif du journal et migration KV historique

Revue des sources du 23 octobre 2026. Le nom de ce fichier conserve l'ancien
point d'entrée TI-40 ; `expo-sqlite/kv-store` n'est plus le moteur principal des
rêves natifs.

## Moteur actuel

Sur iOS/Android, [storageServiceReal.ts](../../services/storageServiceReal.ts)
utilise [createJournalRecordStore](../../services/journalRecordStore.ts) dans
`dreamer-journal-v1.db` pour les rêves et le cache distant. Les enregistrements
sont stockés par identité, ordre et scope, avec un commit transactionnel du scope.
Les checkpoints de lignes serveur complètes utilisent aussi ce moteur.

Lors de la première lecture d'un scope, le moteur importe les anciens records
via `readLegacyDreamRecords`. Cette lecture utilise `getItem(key, { strict: true })` :
une erreur de lecture ou un payload invalide interrompt la migration, au lieu de
transformer l'échec en journal vide. `getSavedDreams` distingue `absent`, `loaded`
et `error` ; une sauvegarde échouée rejette sa promesse.

Sur le web, les chemins KV existants restent en place : IndexedDB et le fallback
localStorage. Cette architecture locale ne prouve pas une synchronisation distante.

## Adaptateur KV et héritage TI-40

Le stockage KV reste utilisé pour d'autres clés et pour relire les anciens gros
payloads. Pour les clés de `FILE_BACKED_KEYS`, lorsque kv-store est disponible,
l'ordre de lecture legacy est :

1. `expo-sqlite/kv-store` ;
2. fichier legacy ;
3. AsyncStorage legacy.

En mode non strict, une valeur trouvée dans un fallback est copiée vers kv-store
avant nettoyage de sa source. En mode strict, elle est rendue sans cette migration
opportuniste, et une erreur du stockage principal reste une erreur. Ce chemin
legacy ne décrit pas les écritures actuelles des rêves dans le record store.

Les anciens logs `kv-store hit`, `kv-store write` et les logs de migration mesurent
l'adaptateur KV. Les marqueurs `journal.records_*` concernent le moteur à records ;
ne pas comparer leurs durées comme s'ils couvraient la même opération.

## Maintenance

Les chemins legacy servent encore à la lecture et à la récupération. Leur retrait
nécessite une preuve de migration et une couverture des installations concernées ;
un nombre de versions écoulées ne suffit pas. Pour une modification, vérifier
lecture legacy, écriture échouée, nouvelle tentative et redémarrage avec les
fixtures possédées, sans réinitialiser de données personnelles. Voir la
[validation proportionnée](validation-proportionnee.md).
