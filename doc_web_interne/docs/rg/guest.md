# RG — Mode invité (guest)

Ce document décrit les **règles de gestion** appliquées quand l’utilisateur **n’est pas connecté** (“guest”).

## Objectifs

- Permettre de tester l’app sans compte avec une expérience fluide.
- Appliquer des limites simples (anti-abus) **sans contournement via suppression** de contenu.
- Garder une source de vérité claire dans le code.

## Source de vérité (quotas guest)

La source de vérité des quotas “guest” est dans `constants/limits.ts` :

- Analyses (IA) : `QUOTAS.guest.analysis = 2`
- Explorations (début de chat sur un rêve) : `QUOTAS.guest.exploration` n’est plus une entitlement produit (voir `limits.ts`)
- Messages par rêve : `QUOTAS.guest.messagesPerDream = 10`
- Images : `QUOTAS.guest.image = 2`
- Rêves enregistrés : illimités en local. Le compte sert au backup / sync / multi-appareils, pas à enregistrer plus de rêves.

## Où sont enregistrés les rêves guest

Les rêves guest sont persistés **localement** sur l’appareil via `services/storageServiceReal.ts` :

- Clé principale : `gemini_dream_journal_dreams` (`DREAMS_STORAGE_KEY`).
- Mobile : stockage via `@react-native-async-storage/async-storage` et bascule “file-backed” via `expo-file-system` pour éviter les limites de taille.
- Web : stockage via IndexedDB (fallback localStorage).

Impacts produit :

- Désinstaller l’app / effacer les données locales efface les rêves.
- Changer d’appareil ne transfère pas les rêves (sans compte).

## Règle “rêves enregistrés” (guest)

### Limite

- Un utilisateur guest peut **enregistrer un nombre illimité de rêves localement**.
- Aucun compte, paywall ou quota Journal n’est exigé avant confirmation de la sauvegarde.
- Les quotas analyses / images / chat restent inchangés.

### Compteur local (télémétrie, non bloquant)

Un compteur cumulatif local peut encore exister :

- Module : `services/quota/GuestDreamCounter.ts`
- Clé AsyncStorage : `guest_total_dream_recording_count_v1`
- Il ne décide plus si un rêve est enregistrable.

### Gating (contrôle)

- Il n’y a plus de helper `lib/guestLimits.ts` ni de sheet/banner de limite Journal.
- `app/recording.tsx` enregistre directement via `addDream`, sans pré-check ni catch `GUEST_LIMIT_REACHED`.
- `hooks/useDreamJournal.ts` (`addDream()` guest) persiste sous lock et n’émet plus `GUEST_LIMIT_REACHED`.
- `hooks/useDreamSaving.ts` n’applique plus de pré-check ni de catch de limite d’enregistrement.

### Concurrence (double tap / double submit)

- `withGuestDreamRecordingLock()` sérialise encore la persistance locale guest pour éviter deux écritures simultanées.

### Migration (compat)

Au démarrage, `migrateExistingGuestDreamRecording()` peut encore initialiser le compteur historique depuis `dreams.length`. Cela n’a plus d’effet d’admission.

## Règle “analyses” (guest)

### Limite

- Un utilisateur guest peut lancer **2 analyses**.

### Anti-bypass

On maintient un compteur cumulatif local (jamais décrémenté) :

- Module : `services/quota/GuestAnalysisCounter.ts`
- Clé AsyncStorage : `guest_total_analysis_count_v1`
- Usage effectif : `max(compteur_local, rêves_marques_analysés)`

### Gating

- Contrôle via `quotaService` → provider guest (`services/quota/GuestQuotaProvider.ts`).
- Lors d’une analyse réussie en guest : incrément du compteur local dans `hooks/useDreamJournal.ts` (et éventuellement sync max(local, server) quand un retour serveur existe).

## Règle “explorations” (guest)

### Limite

- Un utilisateur guest peut explorer **2 rêves** (démarrer une exploration/chat).

### Règle d’exception (continuer un chat déjà démarré)

- Si le rêve est déjà “exploré” (chat démarré), on autorise la reprise même si la limite globale est atteinte.
- Objectif : éviter de “repayer” pour continuer une conversation existante.

### Anti-bypass

Comme pour les analyses :

- Module : `services/quota/GuestAnalysisCounter.ts`
- Clé AsyncStorage : `guest_total_exploration_count_v1`
- Usage effectif : `max(compteur_local, rêves_marques_explorés)`

## Affichage UI (Settings)

- Carte quotas : `components/quota/QuotaStatusCard.tsx`
- Les quotas affichés pour le guest restent analyses / images / chat.
- Une éventuelle ligne “Rêves enregistrés” héritée de l’UI ne doit plus être lue comme un quota d’admission Journal.

## Limites connues / risques

- Comme c’est du local, un utilisateur peut “reset” en réinstallant l’app ou en effaçant les données.
  - Mitigation possible : enforcement serveur par fingerprint (déjà en place côté endpoint quota pour certaines métriques), au prix d’une dépendance réseau.
- Si le stockage des rêves est purgé (ex: récupération automatique “Row too big”), le journal local est perdu. Le compteur historique, s’il existe encore, ne doit plus bloquer un nouvel enregistrement.
  - Mitigation : proposer un compte pour le backup, sans quota Journal avant sauvegarde.

## Passage guest → compte (création / connexion)

### Données (rêves)

Quand l’utilisateur se connecte (ou crée un compte), **tous** les rêves guest locaux sont migrés vers Supabase :

- Logique : `hooks/useDreamPersistence.ts` (`migrateGuestDreamsToSupabase()`)
- Stratégie : `createDreamInSupabase()` fait un `upsert` sur `(user_id, client_request_id)` pour éviter les doublons (idempotent).
- Après une migration **complète** : les rêves locaux guest sont vidés (`saveDreams([])`), puis l’app charge la liste remote.
- En cas d’échec partiel : le stockage local n’est pas vidé, afin de ne perdre aucun récit. Un nouvel essai reprend les mêmes `client_request_id`.

### Quotas

- Les compteurs “guest” (analyses / explorations / rêves enregistrés) **ne comptent pas** pour les quotas mensuels d’un compte.
- Une fois connecté, `quotaService` bascule sur `SupabaseQuotaProvider` et l’UI affiche les quotas du tier (`free` mensuel ou `premium` illimité).
- Les compteurs guest restent dans le stockage local (utile si l’utilisateur se déconnecte plus tard), mais **ne sont plus affichés** tant qu’un `user` est présent.
