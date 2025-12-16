# Storage migration (TI-40) — `expo-sqlite/kv-store`

## Goal
Les rêves (transcript/interpretation/chatHistory) peuvent devenir volumineux. Les stocker en JSON via AsyncStorage (ou via fichiers) peut impacter le temps de load/save et générer des soucis de quotas/limites selon la plateforme.

## Solution implémentée
Sur **iOS/Android**, `services/storageServiceReal.ts` utilise désormais **`expo-sqlite/kv-store`** (stockage clé/valeur backed par SQLite) comme backend principal dès qu’il est disponible.

Sur **web**, on conserve le backend existant **IndexedDB → localStorage** (le support web de `expo-sqlite` nécessite WASM + en-têtes COOP/COEP pour `SharedArrayBuffer`).

## Clés concernées
Les clés lourdes sont regroupées dans `FILE_BACKED_KEYS` (ex: `gemini_dream_journal_dreams`, cache remote, pending mutations).

## Migration incrémentale (sans perte)
Pour les clés lourdes sur mobile, l’ordre de lecture est :
1. `expo-sqlite/kv-store` (si présent)
2. fichier legacy (si présent)
3. AsyncStorage legacy (si présent)

Dès qu’une valeur est trouvée en (2) ou (3), elle est **copiée vers kv-store**, puis la source legacy est **supprimée** (best-effort).

## Mesure (POC)
En `__DEV__`, `services/storageServiceReal.ts` log :
- hit kv-store (`bytes`, `ms`)
- write kv-store (`bytes`, `ms`)
- migrations (file → kv-store, AsyncStorage → kv-store)

## Rollout proposé
1. Ship kv-store + migration lazy (actuel) avec fallback intact.
2. Observer les logs perf (dev) et, si besoin, ajouter un flag pour activer/désactiver kv-store.
3. Après une ou deux versions, supprimer les chemins legacy si le taux de migration est satisfaisant.

