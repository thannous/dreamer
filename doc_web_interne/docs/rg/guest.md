# RG — Mode invité (guest)

Ce document décrit les **règles de gestion** appliquées quand l’utilisateur **n’est pas connecté** (“guest”).

## Objectifs

- Permettre de tester l’app sans compte avec une expérience fluide.
- Appliquer des limites simples (anti-abus) **sans contournement via suppression** de contenu.
- Garder une source de vérité claire dans le code.

## Source de vérité (quotas guest)

La source de vérité des quotas “guest” est dans `constants/limits.ts` :

- Analyses (IA) : `QUOTAS.guest.analysis = 2`
- Explorations (début de chat sur un rêve) : `QUOTAS.guest.exploration = 2`
- Messages par rêve : `QUOTAS.guest.messagesPerDream = 10`
- Rêves enregistrés : `GUEST_DREAM_LIMIT = 2` (utilisé pour l’UI + le gating)

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

- Un utilisateur guest peut **enregistrer 2 rêves au total**.

### Anti-bypass

Le quota n’est **pas basé sur `dreams.length` uniquement** (sinon supprimer un rêve redonne du quota).

On maintient un compteur cumulatif local :

- Module : `services/quota/GuestDreamCounter.ts`
- Clé AsyncStorage : `guest_total_dream_recording_count_v1`
- Usage effectif : `max(compteur_local, dreams.length)`

### Gating (contrôle)

Le blocage est appliqué à deux niveaux :

1) **Avant tentative d’enregistrement** (UX)
- `app/recording.tsx` et `hooks/useDreamSaving.ts`
- Si quota atteint, ouverture de la sheet “limite atteinte”.

2) **Au point unique d’écriture** (sécurité)
- `hooks/useDreamJournal.ts` (dans `addDream()` quand `user == null`)
- Vérifie et refuse l’opération en lançant `QuotaErrorCode.GUEST_LIMIT_REACHED`.

### Concurrence (double tap / double submit)

Pour éviter deux enregistrements quasi simultanés qui passeraient le check :

- `withGuestDreamRecordingLock()` sérialise le “check + save + increment” (`services/quota/GuestDreamCounter.ts`).

### Migration (compat)

Au démarrage, on initialise une seule fois le compteur depuis l’existant :

- `migrateExistingGuestDreamRecording()` est appelé dans `app/_layout.tsx`.
- La valeur seed est `dreams.length` pour éviter de redonner du quota après mise à jour.

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
- Pour le guest, la ligne “Rêves enregistrés” affiche **le total** (cumulatif) et non seulement `dreams.length`.
- Libellé explicite : “Rêves enregistrés (total)” pour réduire la frustration (supprimer un rêve ne redonne pas de quota).

## Limites connues / risques

- Comme c’est du local, un utilisateur peut “reset” en réinstallant l’app ou en effaçant les données.
  - Mitigation possible : enforcement serveur par fingerprint (déjà en place côté endpoint quota pour certaines métriques), au prix d’une dépendance réseau.
- Si le stockage des rêves est purgé (ex: récupération automatique “Row too big”), le compteur cumulatif peut rester à 2 et bloquer.
  - Mitigation possible : message explicite (“données locales réinitialisées”) + CTA création de compte.

## Passage guest → compte (création / connexion)

### Données (rêves)

Quand l’utilisateur se connecte (ou crée un compte), les rêves guest sont migrés vers Supabase :

- Logique : `hooks/useDreamPersistence.ts` (`migrateGuestDreamsToSupabase()`)
- Stratégie : `createDreamInSupabase()` fait un `upsert` sur `(user_id, client_request_id)` pour éviter les doublons.
- Après migration : les rêves locaux guest sont vidés (`saveDreams([])`), puis l’app charge la liste remote.

### Quotas

- Les compteurs “guest” (analyses / explorations / rêves enregistrés) **ne comptent pas** pour les quotas mensuels d’un compte.
- Une fois connecté, `quotaService` bascule sur `SupabaseQuotaProvider` et l’UI affiche les quotas du tier (`free` mensuel ou `premium` illimité).
- Les compteurs guest restent dans le stockage local (utile si l’utilisateur se déconnecte plus tard), mais **ne sont plus affichés** tant qu’un `user` est présent.
