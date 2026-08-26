# Noctalia Lucid Trainer — Spécification produit & technique

**Version :** 1.0 · **Date :** 2026-08-20 · **Statut :** module implémenté dans le dépôt, jamais publié en magasin
**Source de vérité :** le code du dépôt `dreamer`, branche du module Lucid Trainer. Ce document décrit ce
qui existe, pas ce qui est souhaité. Chaque valeur citée est relevée dans un fichier nommé.
**Documents frères :** [`LUCID_TRAINER_ARCHITECTURE.md`](../doc_web_interne/docs/LUCID_TRAINER_ARCHITECTURE.md)
(architecture, en anglais), [`LUCID_TRAINER_RELEASE.md`](../doc_web_interne/docs/LUCID_TRAINER_RELEASE.md)
(runbook de release), [`LUCID_TRAINER_SHARED_IDENTITY_ADR.md`](../doc_web_interne/docs/LUCID_TRAINER_SHARED_IDENTITY_ADR.md)
(ADR sur l'identité Supabase partagée), [`LUCID_TRAINER_HANDOFF.md`](../doc_web_interne/docs/LUCID_TRAINER_HANDOFF.md)
(rapport de passation). Le présent document est la vue produit + technique en français ; les quatre autres
restent la référence opérationnelle.

---

## 1. Ce qu'est le module

Noctalia Lucid Trainer est une **application compagnon** de Noctalia, consacrée à l'entraînement
au rêve lucide. Elle construit une routine en trois temps — l'attention en journée (tests de réalité),
la préparation au coucher (programmes guidés, signaux nocturnes facultatifs), le bilan au réveil —
puis restitue des tendances personnelles et une recommandation calculée hors ligne.

Le partage des rôles est explicite et tenu dans les écrans eux-mêmes (`app/lucid/about.tsx`) :

> **Lucid Trainer construit les routines. Noctalia reste le journal** pour enregistrer, interpréter
> et conserver les rêves.

Trois techniques sont couvertes, et seulement trois (`LUCID_TECHNIQUES` dans `lib/lucid/model.ts`) :
**MILD**, **SSILD**, **WBTB**.

### 1.1 Ce que le module n'est pas

**Ce n'est pas un outil de soin.** Ce n'est ni un dispositif médical, ni une aide au sommeil, ni un
outil thérapeutique, et il ne pose aucun diagnostic. La limite est écrite dans le catalogue de contenu,
dans les cinq langues (`lib/lucid/content/*.ts`, clé `onboarding.wellbeingNotice`) :

> « Cet outil concerne le bien-être et l'auto-observation, pas les soins. Protège d'abord ton sommeil
> et arrête tout exercice qui provoque détresse ou fatigue inhabituelle. »

Quatre conséquences, toutes appliquées dans le code :

1. **Aucune promesse de résultat.** L'écran de progression s'intitule « Des tendances, pas des
   promesses » et qualifie explicitement les petits échantillons de signaux précoces
   (`buildLucidWeeklyReview` renvoie `comparison.evidence: 'none' | 'early' | 'usable'`, seuil à
   3 essais par méthode — `DEFAULT_MINIMUM_METHOD_ATTEMPTS` dans `lib/lucid/progress.ts`).
2. **Le sommeil passe avant la technique.** Le coach hors ligne dispose d'une action `protect_sleep`
   qui prend le pas sur toute recommandation d'entraînement, et chaque programme porte ses
   `stopRules`. Le calendrier de programme affiche « les jours manqués restent disponibles ; ne
   réduisez jamais votre sommeil pour rattraper ».
3. **Aucun contenu généré par IA.** Aucun appel à Gemini, aucun service d'analyse : le catalogue est
   statique et typé, le coaching est une fonction pure sur les observations locales.
4. **Une porte de sortie nommée.** L'aide (`app/lucid/help.tsx`) et l'écran science
   (`content.science.supportAdvice`) invitent à arrêter et à consulter un professionnel adapté si la
   perturbation du sommeil, la détresse, la confusion ou la somnolence diurne persistent.

### 1.2 Principe directeur

> **Une pratique, pas une performance. Le sommeil d'abord, la lucidité ensuite, et jamais l'inverse.**

---

## 2. Architecture : une variante d'application, pas un second dépôt

Contrairement à `Noctalia Meditation` (monorepo, `apps/meditation/`, cf.
[`noctalia-meditation.md`](noctalia-meditation.md) §3), **Lucid Trainer n'a pas de projet Expo séparé**.
Le module vit dans l'arbre de l'app journal :

- ses routes sont sous `app/lucid/**`, enregistrées dans le `Stack` racine
  (`app/_layout.tsx`, `<Stack.Screen name="lucid" />`) ;
- son domaine est sous `lib/lucid/**`, ses services sous `services/lucidTrainer*.ts`, son état sous
  `context/LucidTrainerContext.tsx`, son kit d'interface sous `components/lucid/**` ;
- **une seule variante native** commute l'identité du binaire dans `app.config.ts`.

Le même bundle JavaScript sert donc les deux applications. Dans le build Noctalia, `/lucid` reste
atteignable depuis la carte du rituel « lucide » (`app/ritual/[id].tsx`, `ritual.id === 'lucid'` →
`router.push('/lucid')`). Dans le build Lucid, `/lucid` est le point de départ et le reste :
`unstable_settings.anchor` vaut `'lucid'`, et `resolveAppStartupDecision` force toute destination
initiale hors `/lucid` vers `/lucid`.

### 2.1 Sélection de la variante — deux marqueurs, jamais un seul

`app.config.ts` exige que **les deux** marqueurs sélectionnent Lucid, et échoue bruyamment sinon :

| Variable | Portée | Valeur Lucid |
|---|---|---|
| `NOCTALIA_APP_VARIANT` | native (config Expo) | `lucid` |
| `EXPO_PUBLIC_APP_VARIANT` | runtime (bundle) | `lucid` (ou `lucid-trainer`) |

Un marqueur seul lève `Partial Lucid Trainer configuration`. Côté runtime, `lib/appVariant.ts` recroise
`expoConfig.extra.product` et `EXPO_PUBLIC_APP_VARIANT` : en production, un désaccord jette ; en
développement il est toléré et journalisé, et c'est l'environnement qui gagne (confort de QA).

Profil d'exécution : `.env.lucid` (aucun secret, il ne porte que les deux marqueurs et
`EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED=true`). Commandes, dans `package.json` :

```
npm run start:lucid          # dev server, profil .env.lucid
npm run start:lucid:mock     # profil .env.lucid.mock
npm run android:lucid        # build+run natif Android
npm run ios:lucid            # build+run natif iOS
npm run lucid:gates          # portes de release (cf. §13)
npm run test:e2e:lucid       # suite Maestro du compagnon (cf. §12 et §14.8)
```

### 2.2 Identité applicative (`createLucidExpoConfig`)

| Élément | Valeur |
|---|---|
| Nom | `Noctalia Lucid Trainer` |
| Slug | `noctalia-lucid-trainer` |
| Schéma | `noctalia-lucid` |
| Bundle iOS / package Android | `com.tanuki75.noctalia.lucid` |
| Version / runtimeVersion | `1.0.0` (ligne de version propre, `buildNumber` `1`, `versionCode` `1`) |
| Projet EAS | `d210576f-5dc4-4f7a-a5e1-a407c209c3a2` — **distinct** de celui de Noctalia |
| OTA | `updates: undefined` : le compagnon **n'hérite pas** du canal OTA de Noctalia |
| App links | `applinks:lucid.noctalia.app` (iOS) et `https://lucid.noctalia.app/` (`autoVerify`, Android) |
| Icône / splash | `assets/lucid/images/lucid-trainer-icon.png`, fond `#201131` |
| Clés RevenueCat | `undefined` — elles doivent venir du profil de build du compagnon, jamais de Noctalia |
| Supabase | **partagé** : même `supabaseUrl` et même `supabaseAnonKey` que Noctalia (cf. l'ADR d'identité) |

### 2.3 Ce que la variante retire

Le compagnon n'écoute pas. `createLucidExpoConfig` retire le plugin `expo-speech-recognition`,
supprime `NSMicrophoneUsageDescription` et `NSSpeechRecognitionUsageDescription`, ajoute
`android.permission.RECORD_AUDIO` aux `blockedPermissions` et configure `expo-audio` avec
`microphonePermission: false`. `android.permissions` est vidé.

Il ajoute en revanche neuf sons de signal groupés (`expo-audio` + `expo-notifications` avec
`sounds:`), le plugin `./plugins/withLucidNoctaliaQueries` (déclaration `<queries>` étroite du schéma
`noctalia`, pour tester le lien vers l'app journal sur Android 11+ sans visibilité de paquets large),
et rétablit `expo-notifications` **sans** `withDisableNotificationsBootActions` : le compagnon veut la
restauration des notifications après redémarrage.

### 2.4 Arborescence du module

```
app/lucid/
├── _layout.tsx                     # LucidTrainerProvider + porte d'onboarding + Stack
├── (tabs)/
│   ├── _layout.tsx                 # barre d'onglets flottante en verre
│   ├── index.tsx                   # Aujourd'hui
│   ├── programs.tsx                # Programmes
│   ├── night.tsx                   # Nuit
│   ├── progress.tsx                # Progression
│   └── settings.tsx                # Réglages
├── onboarding.tsx                  # 7 étapes
├── program/[id].tsx                # détail d'un programme
├── session/[program]/[session].tsx # séance guidée
├── reality-check.tsx               # modal
├── morning.tsx                     # modal
├── weekly.tsx                      # bilan hebdomadaire
├── permissions.tsx · science.tsx · privacy.tsx · data.tsx · help.tsx · about.tsx
├── account.tsx · subscription.tsx
components/lucid/                   # LucidUI (kit), LucidGlass (verre), LucidInfoPage (pages de texte)
constants/lucidTheme.ts             # palette « nuit jade » + bloc normatif
context/LucidTrainerContext.tsx     # état, commits, synchronisation, consentements
hooks/useLucidNightAudio.ts · hooks/useLucidNow.ts
lib/lucid/
├── model.ts                        # types + validateurs d'entrée
├── domain.ts                       # état initial, fusion, résolution de conflits
├── progress.ts                     # résumés, comparaison de méthodes, tendance, coaching
├── audio.ts                        # plans de signaux nocturnes et garde-fous
├── reminders.ts                    # construction du plan de rappels
├── calendar.ts                     # calendrier de programme
├── routes.ts                       # routes sûres, porte d'onboarding
├── deepLinks.ts                    # passage consenti vers Noctalia
├── analytics.ts                    # 5 événements, propriétés en liste blanche
└── content/{en,fr,es,de,it,index,types,references}.ts
services/
├── lucidTrainerStorage.ts          # état + file, verrous, export JSON/CSV
├── lucidTrainerSecureStorage.ts    # AES-256-GCM par clé d'appareil
├── lucidTrainerSync.ts             # file de mutations, transports Supabase, barrière de reset
├── lucidTrainerNotifications.ts    # rappels et signaux nocturnes
├── lucidTrainerExport.ts · lucidTrainerCloudData.ts
scripts/check-lucid-trainer-gates.js
supabase/migrations/20260813010000_lucid_trainer_sync.sql
```

---

## 3. Identité visuelle « nuit jade »

Le bloc normatif est **en tête de `constants/lucidTheme.ts`** et fait autorité. Il n'est pas recopié
ici : toute valeur ajoutée à la palette doit s'y plier, et le lire est la première chose à faire avant
de toucher une couleur du module. Ses quatre règles, par leur nom :

1. **Un seul accent de marque.** `accent` porte l'état actif, la sélection et la progression. `amber`
   est un signal sémantique (le matin, la vigilance), jamais une deuxième marque.
2. **Une teinte remplit, elle n'écrit pas.** Texte sur surface teintée → déclinaison `*On`
   (`accentOn` sur `accentSoft`), comme `champagne` / `champagne-on` côté Noctalia.
3. **Le fond est chromatique, pas gris.** L'élévation se lit à la teinte
   (`background` → `surface` → `surfaceRaised`), pas à un filet d'un pixel partout.
4. **`border` est un filet décoratif ; `borderInteractive` délimite les cibles tactiles**, et tient
   3:1 sur les quatre surfaces des deux thèmes (WCAG 1.4.11). Ne jamais remettre `border` sur un contrôle.

Tous les couples texte/surface tiennent 4,5:1 au pire cas, mesurés sur les quatre surfaces de chaque thème.

### 3.1 Parenté et distinction avec Noctalia

Sœur par le vocabulaire — mêmes fontes, même rayon de carte (24), même matériau de verre que
`components/inspiration/GlassCard.tsx`. Distincte par la teinte : là où Noctalia pose du champagne sur
l'encre, Lucid pose du jade sur un pétrole nocturne. L'atmosphère d'écran est **un token**
(`palette.atmosphere`, trois arrêts passés à un `LinearGradient` dans `LucidScreen`), pas six `rgba`
en dur : changer l'accent doit changer l'ambiance.

En dehors de la palette, le module ne contient que trois couleurs littérales : `'#000'` (ombre portée
de la barre d'onglets) et deux blancs de filet dans `LucidGlass`.

### 3.2 Typographie — Fraunces est la voix, pas l'interface

Deux graisses de Fraunces, deux rôles, et rien d'autre :

| Fonte | Emploi |
|---|---|
| `Fraunces_600SemiBold` 34/40 | **le titre d'écran**, un seul par écran (`LucidScreen.title`) |
| `Fraunces_500Medium` 17–18 | **la phrase de principe** qu'on lit une fois : rappel neutre du matin, principe du test de réalité, invite de réflexion d'une séance, et l'argumentaire d'ouverture de l'écran d'abonnement (`subscription.tsx`, `styles.heroBody`) |
| `SpaceGrotesk_*` | tout ce qui se scanne : titres de carte, valeurs, libellés, boutons, listes |

Du serif sur chaque titre de carte donnait un ton éditorial à un écran qu'on consulte, pas qu'on lit.

### 3.3 Kit d'interface (`components/lucid/LucidUI.tsx`)

`LucidScreen`, `LucidCard`, `LucidButton`, `LucidSectionHeader`, `LucidPill`, `LucidProgressBar`,
`LucidMetric`, `LucidChoiceCard`, `LucidToggleRow`, `LucidIconAction`. Trois règles portées par le kit :

- **`LUCID_TAB_BAR_INSET` (92) est la réserve sous les onglets ; 24 partout ailleurs**, via la prop
  `bottomInset` de `LucidScreen`. Les deux ont été confondues, et six écrans sans barre gardaient
  132 px de vide.
- **`LucidButton` a une prop `disabledReason`** : un bouton désactivé nomme toujours la condition
  qu'il attend, sous lui, en `accessibilityLiveRegion="polite"`. Les quatre formulaires du module
  (onboarding, séance, test de réalité, bilan du matin) et le démarrage des signaux nocturnes s'en
  servent pour lister ce qui manque.
- **Le statut d'écran occupe sa propre ligne** (`status`), `trailing` reste réservé à une action de
  44 px : une pastille de 160 px posée à côté du titre amputait la colonne de titre de moitié.

`LucidGlass` est le matériau de chrome, et il n'a que deux emplois dans tout le module : le fond de la
barre d'onglets et la pastille de statut de `LucidScreen`. **L'opacité est le vrai design, le flou est
un bonus iOS** ; le verre ne passe jamais sous du texte de contenu, et il s'efface quand le système
demande la réduction de mouvement.

---

## 4. Modèle de données

Tout l'état du module tient dans un objet unique, versionné, sérialisable et validé —
`LucidTrainerState` (`lib/lucid/model.ts`, `LUCID_TRAINER_SCHEMA_VERSION = 1`) :

```ts
interface LucidTrainerState {
  schemaVersion: 1;
  createdAt: number; updatedAt: number;
  onboarding: LucidOnboardingState;        // singleton
  preferences: LucidTrainerPreferences;    // singleton
  progress: LucidProgramProgress[];        // ≤ 3, une entrée par technique, techniques uniques
  experiments: LucidExperiment[];          // bilans du matin, ≤ 10 000, ids uniques
  realityChecks: LucidRealityCheck[];      // ≤ 10 000, ids uniques
  weeklyReviews: LucidWeeklyReview[];      // ≤ 10 000, ids uniques
}
```

| Entité | Contenu et bornes |
|---|---|
| `onboarding` | objectif (4 valeurs), niveau (3), `weeklyTarget` 1–7, plage de sommeil (`bedtime`/`wakeTime` `HH:MM`, fuseau IANA validé par `Intl`), permission notifications, `audioSafetyAccepted`, `analyticsConsent` (`true`/`false`/`null`), préférences d'accessibilité |
| `preferences` | `locale` (5), `theme` (`system`/`light`/`dark`), `cloudSyncEnabled`, `noctaliaLinkEnabled`, `notificationsEnabled`, `realityCheckRemindersPerDay` 0–12, `audioCuesEnabled`, `audioVolume`, fuseau |
| `progress` | technique, `programId`, statut (`not_started`/`active`/`paused`/`completed`), `currentDay` 1–365, `completedExerciseIds`, `practiceDates` (clés de jour **locales**) |
| `experiments` | technique, `preparationMinutes` 0–240, résultat (`none`/`pre_lucid`/`lucid`), lucidité / rappel / qualité de sommeil 0–5, facteurs personnels (7 valeurs, uniques), notes ≤ 4 000 caractères |
| `realityChecks` | contexte (5), méthode (4), issue (`awake`/`dreaming`/`uncertain`), `mindful` |
| `weeklyReviews` | `weekStart` (clé de jour), jours de pratique 0–7, jours de rappel 0–7, rêves lucides 0–100, technique recommandée, notes |

**Tout ce qui entre est validé, pas seulement typé.** `isLucidTrainerState` et ses gardes vérifient
les énumérations, les bornes, l'unicité des identifiants, la validité réelle des dates et des fuseaux.
Un état illisible n'est pas réparé : il est effacé et remplacé par un état initial
(`loadLucidTrainerState` renvoie alors `source: 'recovered'`).

> Une divergence connue : le validateur tolère `audioVolume ≤ 0,5`, alors que l'audio plafonne à
> `MAX_LUCID_NIGHT_VOLUME = 0,3` et que l'écran Nuit borne l'affichage à 30 %. Le plafond effectif est
> celui de l'audio ; le validateur est simplement plus permissif que l'usage.

### 4.1 Stockage local chiffré

`services/lucidTrainerStorage.ts` écrit dans `expo-sqlite/kv-store` sous deux clés par périmètre :

```
noctalia_lucid_trainer:<userScope encodé>:state_v1
noctalia_lucid_trainer:<userScope encodé>:sync_queue_v1
```

`userScope` vaut `guest` ou `user:<id>`. Chaque écriture passe par un verrou sérialisé par clé
(`runSerialized`), pour qu'un `updateState` concurrent ne perde pas de mutation.

Le chiffrement est dans `services/lucidTrainerSecureStorage.ts` :

- **AES-256-GCM**, clé d'appareil générée à la première écriture et rangée dans `expo-secure-store`
  avec `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`noctalia-lucid-trainer-device-key-v1`) ;
- **la clé de stockage est authentifiée en AAD** : un chiffré ne peut pas être déplacé d'un
  utilisateur à un autre, ni de l'état vers la file ;
- enveloppe préfixée `noctalia-lucid-aesgcm-v1:` ; une valeur en clair héritée est relue puis
  **migrée en chiffré** à la lecture suivante ; une enveloppe invalide est supprimée et l'état repart
  de zéro plutôt que de faire échouer le démarrage ;
- **le web garde le stockage de plateforme** (`Platform.OS === 'web'` → passe-plat) ; les candidats
  de release sont natifs.

### 4.2 File de synchronisation

La synchronisation est **désactivée par défaut** (`cloudSyncEnabled: false`) et n'a lieu que si
l'utilisateur est authentifié **et** l'a activée. Sans cela, tout reste local et le statut affiché est
« Enregistré localement ».

Chaque changement produit une ou plusieurs `LucidSyncMutation` (`upsert` ou `delete`), rangées dans la
file locale chiffrée, avec `clientRequestId` (idempotence), `baseRevision`, statut
(`pending`/`sending`/`failed`/`blocked`) et compteur de tentatives. `services/lucidTrainerSync.ts` :

| Paramètre | Valeur |
|---|---|
| Taille de lot | `LUCID_SYNC_BATCH_SIZE = 25` |
| Délai de base | `5 s` |
| Délai maximal | `6 h` |
| Tentatives | `LUCID_SYNC_MAX_RETRIES = 8` |
| Backoff | exponentiel à **jitter égal** (`cap/2 + cap/2 × alea`) — pas de tempête de reprise, pas de boucle à délai nul |

Transports Supabase : `sync_lucid_trainer_mutations` (push) et `get_lucid_trainer_entities` (pull),
définis dans `supabase/migrations/20260813010000_lucid_trainer_sync.sql`. La table
`lucid_trainer_entities` est en RLS forcée, lecture limitée au propriétaire, écriture réservée au
`service_role` via les fonctions. Une table `lucid_trainer_reset_fences` porte une **génération de
reset indépendante des révisions d'entités** : elle survit à la recréation des singletons et empêche un
appareil hors ligne de re-téléverser des données antérieures à une suppression demandée ailleurs.

**Résolution de conflits** (`lib/lucid/domain.ts`) :

- `progress` **fusionne** (union des exercices terminés et des dates de pratique, `currentDay` au
  maximum, `startedAt` au minimum, `completed` absorbant) — perdre une journée de pratique parce que
  deux appareils ont écrit serait une régression visible ;
- toutes les autres entités : **dernier écrivain gagne** sur `updatedAt`, départage déterministe par
  JSON canonique (`canonicalLucidJson`) à égalité d'horodatage ;
- une suppression serveur d'un singleton (`onboarding`, `preferences`) est ignorée : ces deux
  enregistrements sont requis pour un état local valide, leur disparition se traduit par une remise à
  zéro complète, pas par une suppression unitaire.

À la connexion, `claimLucidTrainerGuestScope` propose de **reprendre le périmètre invité** dans le
compte ; l'import ne touche pas aux rappels du compte (la réconciliation reste liée au compte).

---

## 5. Écrans et parcours

**19 routes**, cinq onglets et quatorze écrans de pile.

| # | Route | Rôle |
|---|---|---|
| 1 | `/lucid/onboarding` | 7 étapes, gestes de retour désactivés |
| 2 | `/lucid/(tabs)` → `index` | **Aujourd'hui** : prochaine pratique, test de réalité, bilan du matin, semaine, coach |
| 3 | `/lucid/(tabs)/programs` | **Programmes** : les trois parcours, statut et progression |
| 4 | `/lucid/(tabs)/night` | **Nuit** : sécurité audio, bibliothèque de signaux, volume, fenêtre |
| 5 | `/lucid/(tabs)/progress` | **Progression** : 7 derniers jours, comparaison de méthodes, historique |
| 6 | `/lucid/(tabs)/settings` | **Réglages** : compte, apparence, entraînement, sommeil, accessibilité, langue, accès secondaires |
| 7 | `/lucid/program/[id]` | détail : preuves, calendrier, prérequis, règles d'arrêt, plan des séances |
| 8 | `/lucid/session/[program]/[session]` | séance guidée : étapes à cocher, précaution, invite de réflexion |
| 9 | `/lucid/reality-check` | modal : méthode, contexte, issue, confirmation de pleine conscience |
| 10 | `/lucid/morning` | modal : technique, préparation, résultat, trois scores, facteurs, notes |
| 11 | `/lucid/weekly` | bilan hebdomadaire : trois métriques, recommandation, notes |
| 12 | `/lucid/permissions` | état des notifications, audio, fuseau, redémarrage |
| 13 | `/lucid/science` | définition, résumé de preuves, incertitude, limites, 5 références |
| 14 | `/lucid/privacy` | local d'abord, sync facultative, passage minimal, analytics, données sensibles, export/suppression |
| 15 | `/lucid/data` | export JSON/CSV, passage vers Noctalia, suppression locale, suppression de compte |
| 16 | `/lucid/help` | 5 questions, dont « quand demander de l'aide » |
| 17 | `/lucid/about` | frontière produit, autonomie, version, contact |
| 18 | `/lucid/account` | connexion, reprise des données invité, Google si configuré |
| 19 | `/lucid/subscription` | Plus : bénéfices, offres, achat, restauration |

### 5.1 La porte d'onboarding

`resolveLucidOnboardingGate` (`lib/lucid/routes.ts`) est une fonction pure : elle prend le chemin
courant, le statut d'onboarding et l'état de chargement, et renvoie soit une destination, soit `null`
quand on est déjà au bon endroit. Ce `null` est ce qui empêche une boucle de `replace` sur le web,
où `/lucid` et `/lucid/(tabs)` désignent la même chose.

### 5.2 Parcours d'entrée — 7 étapes

Introduction et avis de bien-être → objectif → niveau → rythme (2/3/5/7 jours) → plage de sommeil
(deux champs `HH:MM` validés en direct + fuseau de l'appareil) → notifications et réduction de
mouvement → consentements (analytics, synchronisation, passage vers Noctalia, sécurité audio).
Le bouton d'action est **épinglé hors du `ScrollView`** : dans le flux, quatre interrupteurs de 70 px
poussaient « Configurer mon entraînement » hors de l'écran.

La permission de notification n'est **jamais** demandée à froid : elle l'est après l'écran qui
l'explique, et « Plus tard » est une sortie de premier rang.

### 5.3 Boucle quotidienne

```
journée   → /lucid/reality-check   → LucidRealityCheck (rien n'est pré-répondu)
coucher   → /lucid/(tabs)/night    → plan de signaux nocturnes (facultatif, bardé de conditions)
séance    → /lucid/session/…       → étapes cochées → LucidProgramProgress
réveil    → /lucid/morning         → LucidExperiment
semaine   → /lucid/weekly          → LucidWeeklyReview + recommandation
```

Deux formulaires démarrent **entièrement vides**, par décision explicite commentée dans le code : un
test de réalité qu'on n'a pas fait ne doit pas être enregistrable en un geste, et un bilan du matin ne
doit contenir que ce que l'utilisateur a réellement rapporté, puisqu'il est persisté, synchronisé et
donné au coach.

### 5.4 Coach hors ligne

`buildLucidWeeklyReview` (`lib/lucid/progress.ts`) produit, à partir des seules observations locales :
deux fenêtres de 7 jours, un résumé par fenêtre, une tendance (`improving`/`steady`/`declining`/
`insufficient_data`, seuil 0,1), une comparaison des trois méthodes avec un niveau de preuve, et une
action de coaching parmi sept — `protect_sleep`, `start_first_session`, `complete_preparation`,
`strengthen_recall`, `repeat_best_method`, `keep_routine`, `try_another_method`. Aucun réseau,
aucune IA.

---

## 6. Contenu et localisation

Le catalogue est **statique et typé** : `lib/lucid/content/{en,fr,es,de,it}.ts`, contrat dans
`types.ts`, agrégation et normalisation de locale dans `index.ts`.

- **Cinq langues** : `en`, `fr`, `es`, `de`, `it`. (Noctalia en a six ; le portugais n'est pas couvert
  ici — `LUCID_LOCALES` s'arrête à cinq, et `normalizeLucidLocale` replie tout le reste sur `en`.)
- **Trois programmes × 7 séances = 21 séances**, de 6 à 15 minutes, chacune avec objectif, étapes,
  précaution et invite de réflexion ; chaque programme porte son `evidenceNote`, ses `prerequisites`
  et ses `stopRules`.
- **Cinq références scientifiques** (`content/references.ts`), chacune avec DOI ou PMID, année,
  publication et note : `ildis-2020`, `tan-fan-2023`, `stumbrys-2012`, `baird-2022`, `aasm-srs-2015`.
  L'écran science les rend cliquables.
- Le catalogue porte aussi le chrome, l'onboarding, les tests de réalité, les signaux nocturnes, le
  bilan du matin, le bilan hebdomadaire, la science, la confidentialité et les intitulés de réglages.

**Chaque écran porte en plus son propre objet `COPY` en cinq langues.** C'est le second système de
localisation du module (cf. §14) : le catalogue porte la doctrine et le contenu long, les écrans
portent leurs libellés courts.

---

## 7. Rappels, planification et signaux nocturnes

### 7.1 Plan de rappels

`buildLucidReminderPlan` (`lib/lucid/reminders.ts`) est une fonction pure qui dérive un plan de l'état :

| Famille | Heure |
|---|---|
| `reality_check` (× `realityCheckRemindersPerDay`, 0–12) | l'intervalle d'éveil réel divisé en segments égaux — les tests ne collent donc ni au réveil ni au coucher, sans marge surprise supplémentaire |
| `bedtime` | coucher − 30 min |
| `morning_review` | réveil + 5 min |
| `wbtb` | coucher + 4 h 30, **uniquement si le programme WBTB est actif** |

`reconcileLucidTrainerReminders` (`services/lucidTrainerNotifications.ts`) réconcilie le planifié avec
le plan au chargement et à chaque retour au premier plan — donc après un changement de fuseau ou de
passage à l'heure d'été. Les notifications du module sont marquées
(`noctaliaNotificationOwner: 'lucid-trainer'`) : la réconciliation ne touche jamais celles de l'app
journal. Canal Android dédié : `lucid-trainer-reminders`.

### 7.2 Signaux nocturnes — facultatifs et sous conditions

Neuf fichiers sont embarqués : trois ambiances (`rain`, `ocean`, `brown-noise`) × trois paliers de
volume (`very_low`, `low`, `gentle`), chacun avec son propre canal de notification Android
(le volume d'un son de notification est une propriété de canal, il ne se change pas après coup).

Garde-fous, tous dans `lib/lucid/audio.ts`, appliqués par `createLucidNightSignalPlan` :

| Constante | Valeur |
|---|---|
| `MAX_LUCID_NIGHT_VOLUME` | 0,30 |
| `MAX_LUCID_PREVIEW_VOLUME` / durée | 0,20 / 10 s |
| `MAX_LUCID_CUE_DURATION_MS` | 8 s |
| `MIN_LUCID_FIRST_CUE_DELAY_MS` | 90 min après le début de la fenêtre nocturne |
| `MIN_LUCID_CUE_GAP_MS` | 45 min entre deux signaux |
| `LUCID_QUIET_BEFORE_TIMER_END_MS` | 30 min de silence avant la fin de fenêtre |
| `MAX_LUCID_NIGHT_CUES` | 4 |
| Fenêtre nocturne | 120 à 600 min |

Le plan est **refusé, avec un motif nommé**, tant qu'une condition manque :
`safety_not_acknowledged`, `unsafe_route`, `fragile_sleep`, `hearing_concern`, `invalid_timer`,
`invalid_volume`, `no_safe_signals`… L'écran Nuit traduit ces conditions en une liste lisible sous le
bouton désactivé (`disabledReason`) : accepter la sécurité audio, confirmer le haut-parleur, décocher
« sommeil fragile », décocher « fragilité auditive ».

Un signal manqué **n'est jamais rejoué** : les signaux expirés sont ignorés plutôt que joués en
retard. C'est écrit dans l'aide, dans les cinq langues.

---

## 8. Confidentialité, consentements, analytics

**Local d'abord, hors ligne par défaut.** Sans compte et sans synchronisation, le module est
complètement fonctionnel : programmes, séances, tests de réalité, bilans, tendances, coaching, rappels
et signaux nocturnes ne demandent aucun réseau.

**Quatre consentements distincts et révocables**, chacun avec son interrupteur, dans l'onboarding puis
dans les réglages :

| Consentement | Défaut | Effet |
|---|---|---|
| `analyticsConsent` | `null` (traité comme refus) | active les 5 événements produit |
| `cloudSyncEnabled` | `false` | active la file de synchronisation (exige un compte) |
| `noctaliaLinkEnabled` | `false` | autorise le passage d'un résumé minimal vers Noctalia |
| `audioSafetyAccepted` | `false` | condition nécessaire des signaux nocturnes |

Aucun n'implique un autre. Couper l'un ne coupe pas les autres.

**Analytics** (`lib/lucid/analytics.ts`) : cinq événements — `lucid_activation_completed`,
`lucid_training_completed`, `lucid_retention_observed`, `lucid_noctalia_handoff`, `lucid_conversion`.
Chaque propriété est une **valeur d'une liste blanche fermée** ; les clés doivent correspondre
exactement, sinon l'événement est rejeté. **Aucun texte libre ne sort jamais** : ni notes, ni titres,
ni contenu de rêve. `createLucidAnalyticsEvent` retourne `null` si la préférence n'est pas `enabled`.

**Export et suppression** (`app/lucid/data.tsx`) :

- export **JSON** (enveloppe versionnée `exportVersion: 1` + horodatage) ou **CSV** via
  `expo-file-system` puis `expo-sharing`. Le CSV échappe les cellules et **préfixe d'une apostrophe
  toute valeur commençant par `=`, `+`, `-` ou `@`** : un export ouvert dans un tableur ne doit pas
  exécuter de formule ;
- suppression locale (`resetLocalData`) : les deux clés du périmètre sont effacées **et** les
  notifications planifiées annulées, sous les deux verrous ;
- suppression des données distantes (`delete_lucid_trainer_data`), qui pose la barrière de reset ;
- suppression de compte, qui passe par le chemin de suppression de compte de Noctalia.

---

## 9. Compte, synchronisation, monétisation

Le compte est **facultatif** et sert exactement trois choses : la synchronisation multi-appareils, la
reprise des données invité, et le rattachement de l'abonnement. L'identité est **partagée avec
Noctalia** (même projet Supabase Auth, domaines produit isolés) — c'est l'objet de l'ADR d'identité
partagée, et `lucid:gates` vérifie que l'URL et la clé anonyme sont bien celles de Noctalia.

Limite à garder en tête, énoncée dans l'ADR : dans un projet Supabase partagé, le cloisonnement entre
applications est **logique, pas cryptographique**. Un JWT appartient au projet entier ; les politiques
RLS protègent les autres utilisateurs, pas les autres domaines produit du même utilisateur.

Monétisation : abonnement **Plus** via RevenueCat (`app/lucid/subscription.tsx`, `useSubscription`),
avec bénéfices, comparaison mensuel/annuel, remise annuelle calculée, achat et restauration.
Les clés RevenueCat du compagnon sont **volontairement absentes** de `app.config.ts` : hériter la clé
de Noctalia rattacherait les achats à la mauvaise application. La porte de release le vérifie.

---

## 10. Pont avec Noctalia

Deux ponts, dans les deux sens, tous deux étroits :

**Noctalia → Lucid.** La carte du rituel « lucide » propose « Ouvrir Lucid Trainer » et navigue vers
`/lucid` dans le même bundle (`app/ritual/[id].tsx`). Libellés dans les six langues de Noctalia.

**Lucid → Noctalia.** `lib/lucid/deepLinks.ts` construit un lien **uniquement si le consentement
explicite est présent** (`{ dataTransfer: true }`, objet à une seule clé) et si la charge utile est
exactement conforme :

```
noctalia://recording?v=1&source=lucid_trainer&technique=…&outcome=…&lucidity=…&recall=…
https://dream.noctalia.app/?…   (repli navigateur)
```

La charge est **catégorielle, jamais textuelle** : technique, issue (`lucid`/`remembered`/`no_recall`)
et deux bandes de score (`none`/`low`/`medium`/`high`). Aucune note, aucun contenu de rêve, aucune
date. Le parseur est aussi strict que le constructeur : jeu de clés exact, valeurs en liste blanche,
cohérence interne (une issue `no_recall` impose deux bandes `none`), hôte et chemin canoniques,
ni identifiants, ni port, ni fragment, longueur ≤ 512. Sur Android, le plugin
`withLucidNoctaliaQueries` déclare la seule requête `<intent>` nécessaire pour tester la présence de
l'app journal.

---

## 11. Accessibilité

Ce qui est réellement en place :

- **Contraste** : la palette est construite pour 4,5:1 sur les couples texte/surface et 3:1 sur
  `borderInteractive`, sur les quatre surfaces des deux thèmes. Les cas historiquement faibles sont
  documentés en commentaire à l'endroit où ils ont été corrigés (bord de carte pressable en thème
  clair, rail d'interrupteur éteint, pouce sur rail accent).
- **Rôles et états** : `radio` / `radiogroup` / `checkbox` / `progressbar` / `header` / `link` /
  `alert` sur les contrôles du module, `accessibilityState` porté partout où une sélection existe.
- **Motifs jamais portés par la seule couleur** : les statuts (`terminé`, `en cours`, `disponible`)
  sont écrits, les techniques sont identifiées par icône et par nom, pas par une teinte.
- **Raison de désactivation** annoncée en région live polie (`disabledReason`).
- **Réduction de mouvement** : `LucidCard` supprime la mise à l'échelle au pressage ; `LucidGlass`
  supprime le flou et rend la surface opaque.
- **Mise à l'échelle du texte système** : les textes suivent le réglage d'accessibilité de l'appareil
  (comportement React Native par défaut, `allowFontScaling` n'est désactivé nulle part) ; la barre
  d'onglets, seul élément permanent, borne l'agrandissement de son libellé.

---

## 12. Tests

**25 fichiers de test dédiés**, tous en Jest :

| Emplacement | Fichiers | Portée |
|---|---|---|
| `lib/lucid/__tests__/` | 11 | modèle et validateurs, domaine et fusion, progression et coaching, audio, rappels, calendrier, routes, contenu et parité des locales, liens profonds, analytics, variante d'app |
| `services/__tests__/lucidTrainer*` | 4 | stockage et verrous, chiffrement, synchronisation, notifications |
| `context/__tests__/` | 1 | `LucidTrainerContext` |
| `hooks/__tests__/` | 1 | `useLucidNow` |
| `tests/app-routes/` | 8 | onboarding, réglages, données, compte, abonnement, barre d'onglets, navigation à froid, pont depuis le rituel |

La logique décidable du module est presque entièrement pure et testée à ce titre : plans de signaux,
plans de rappels, calendrier, fusion d'états, résolution de conflits, backoff, coaching.

**E2E** : suite Maestro `lucid` (`npm run test:e2e:lucid`, profil `.env.lucid.mock`) — quatre flux
(`lucid-smoke`, `lucid-morning-review`, `lucid-night-safety`, `lucid-night-unlock`) et deux sous-flux
partagés. Voir §14.8 pour ce qu'ils couvrent et ce qu'ils ne prouvent pas encore.

---

## 13. Portes de release — `npm run lucid:gates`

`scripts/check-lucid-trainer-gates.js` résout la configuration Expo plusieurs fois, avec et sans
marqueurs, et vérifie **19 propriétés**. Le script sort en échec dès qu'une seule tombe.

| # | Porte |
|---|---|
| 1 | Sans marqueur, l'identité reste Noctalia (nom, slug, schéma, package, bundle, `extra.product`) |
| 2 | Un marqueur natif seul est refusé avec un message clair |
| 3 | Un marqueur public seul est refusé avec un message clair |
| 4 | Une configuration Google partielle est refusée avec un message clair |
| 5 | Identité du compagnon : nom, slug, schéma, `extra.product = lucid-trainer` |
| 6 | Script Android canonique `android:lucid` **et** package `com.tanuki75.noctalia.lucid` |
| 7 | Script iOS canonique `ios:lucid` **et** bundle `com.tanuki75.noctalia.lucid` |
| 8 | `.env.lucid` porte bien les deux marqueurs |
| 9 | Icône 1024×1024 **distincte** de celle de Noctalia (comparaison SHA-256) |
| 10 | Collecte micro et parole retirée : `RECORD_AUDIO` bloqué, aucune clé Info.plist, plugin de reconnaissance vocale absent |
| 11 | Neuf sons de signal prudents configurés **et présents sur disque** |
| 12 | Restauration des notifications après redémarrage conservée sur Android |
| 13 | Requête de paquet Noctalia étroite (`withLucidNoctaliaQueries`) |
| 14 | Déclarations d'app links `lucid.noctalia.app` des deux côtés |
| 15 | Projet EAS propre, différent de celui de Noctalia, et **aucun héritage OTA** |
| 16 | Identité Supabase partagée conservée (même URL, même clé anonyme) |
| 17 | Clés de facturation RevenueCat **jamais** héritées de Noctalia |
| 18 | Fournisseur Google désactivé tant que les deux clients du compagnon ne sont pas configurés — et correctement activé quand ils le sont |
| 19 | Documentation de release et migrations additives présentes sur disque |

Ces portes sont statiques et déterministes. Elles ne remplacent **pas** la matrice de validation sur
appareil décrite dans le runbook de release.

---

## 14. Ce qui n'est pas fait

Dettes connues, vérifiées dans le code au 2026-08-20. Elles sont listées ici parce qu'un spec qui les
tait ment par omission.

### 14.1 Les échelles typographiques et de rayons ne sont pas dans `lucidTheme.ts`

`constants/lucidTheme.ts` ne contient **que des couleurs**. Tailles, interlignes, rayons et espacements
sont écrits en dur, feuille de style par feuille de style. Relevé sur `app/lucid/**` et
`components/lucid/**` (valeurs distinctes de `fontSize` et `borderRadius` littérales) :

- **13 tailles de texte** : 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 34 — réparties sur
  **26 couples fonte + taille** ;
- **15 rayons** : 3, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25.

Aucune de ces valeurs n'est nommée, donc aucune n'est arbitrable : 17, 18 et 19 de rayon coexistent
sur des cartes voisines sans qu'aucune décision ne les distingue. Le bloc normatif de la palette n'a
pas d'équivalent pour la forme et le texte. Corollaire pratique : on ne peut pas modifier une échelle,
seulement une occurrence.

### 14.2 `largerText` et `screenReaderOptimized` sont stockés et lus par personne

`LucidAccessibilityPreferences` porte trois booléens. Un seul a un effet :

| Champ | Écrit par | Lu par |
|---|---|---|
| `reduceMotion` | onboarding (étape 6), réglages | `LucidCard` (pressage sans mise à l'échelle) |
| `largerText` | **personne** — l'onboarding recopie la valeur initiale (`false`) | **personne** |
| `screenReaderOptimized` | **personne** — idem | **personne** |

Les deux champs sont malgré tout validés, persistés, chiffrés, synchronisés vers Supabase et exportés.
Les libellés `largerText`, `screenReader` et `access` subsistent dans l'objet `COPY` de
`app/lucid/onboarding.tsx` **dans les cinq langues** sans être rendus une seule fois
(`grep -c 'copy.largerText' app/lucid/onboarding.tsx` → 0, idem pour les deux autres) :
trois clés, quinze chaînes mortes.

L'écran de réglages affirmait le contraire de ce que ces champs suggèrent : sa section Accessibilité
laissait croire à un réglage propre au Trainer. La copie a été corrigée — `systemTextBody` dit
désormais, dans les cinq langues, que « le Trainer hérite de la taille choisie dans les réglages
d'accessibilité de l'appareil » et « n'a pas de réglage de taille propre ». L'écran ne ment plus ;
les deux booléens du modèle, eux, restent orphelins.
Résultat : le modèle laisse croire à deux modes applicatifs qui n'existent pas.

Deux issues, à trancher : soit retirer les deux champs du modèle (migration de schéma, la
synchronisation les transporte déjà), soit leur donner un effet réel. Les laisser en l'état est le seul
choix à écarter.

### 14.3 `weeklyReviews` est écrit et jamais relu

`app/lucid/weekly.tsx` enregistre un `LucidWeeklyReview` complet — semaine, jours de pratique, jours de
rappel, rêves lucides, technique recommandée, notes libres. Il est validé, chiffré, synchronisé et
présent dans l'export CSV.

**Aucun écran ne lit `state.weeklyReviews`.** Ni l'écran hebdomadaire lui-même, qui recalcule tout à
partir de `experiments` et `progress` à chaque ouverture, ni la Progression, ni Aujourd'hui. Les notes
que l'utilisateur écrit — le seul texte libre de tout le bilan hebdomadaire — ne lui sont jamais
réaffichées.

Conséquence directe : chaque enregistrement crée un identifiant neuf (`Crypto.randomUUID()`) sans
déduplication par `weekStart`. Enregistrer deux fois la même semaine produit deux enregistrements
concurrents, et rien dans l'interface ne le montre.

### 14.4 Le module mélange tutoiement et vouvoiement en français

Deux registres cohabitent, séparés par la frontière technique entre catalogue et écrans :

- `lib/lucid/content/fr.ts` **tutoie**, sans exception (« Entraîne ton attention », « Que souhaites-tu
  entraîner ? », « Chargement de ton entraînement… ») — zéro occurrence de « vous », « votre » ou
  « vos » dans tout le fichier ;
- les objets `COPY` des écrans **vouvoient**, sans exception (« Posez une intention calme », « Votre
  sommeil passe avant toute technique », « Comparez vos propres observations »).

Les deux se rencontrent sur le même écran, souvent dans la même carte : l'écran Nuit affiche un titre
vouvoyé au-dessus de garde-fous tutoyés issus du catalogue. C'est propre à la locale française — en
allemand, espagnol et italien, catalogue et écrans emploient la même forme familière.

### 14.5 Deux systèmes de localisation en parallèle

Chaque écran embarque son propre objet `COPY` dupliqué en cinq langues, en plus du catalogue typé de
`lib/lucid/content/`. Il n'y a donc ni clé unique, ni test de parité couvrant les libellés d'écran
(le test de parité de `lib/lucid/__tests__/content.test.ts` ne voit que le catalogue). C'est la cause
structurelle de §14.2 (chaînes mortes non détectées) et de §14.4 (registres divergents).

### 14.6 Deux sources pour « réduire le mouvement »

`LucidCard` lit la préférence **stockée** (`state.onboarding.accessibility.reduceMotion`) tandis que
`LucidGlass` lit la préférence **système** (`usePrefersReducedMotion` →
`AccessibilityInfo.isReduceMotionEnabled`). Un utilisateur qui active la réduction au niveau du système
sans cocher l'interrupteur de l'app obtient un verre opaque et des cartes qui bougent encore ; l'inverse
est vrai aussi. Les deux intentions sont légitimes, une seule doit gagner.

### 14.7 L'écran Nuit ne persiste pas ses choix

Son (`rain`), fenêtre nocturne (6 h) et les trois interrupteurs de sécurité sont de l'état local
React, réinitialisé à chaque visite. Seuls `audioVolume` et `audioCuesEnabled` vont dans les
préférences. Re-confirmer la sécurité chaque nuit se défend ; redemander chaque nuit le son et la durée
est une friction non décidée.

### 14.8 Les flux Maestro sont écrits, pas exécutés

La suite `lucid` existe (`npm run test:e2e:lucid`, profil `.env.lucid.mock`) et compte quatre flux —
`lucid-smoke.yml`, `lucid-morning-review.yml`, `lucid-night-safety.yml`, `lucid-night-unlock.yml` —
plus deux sous-flux partagés (`open-lucid-app.yml`, `complete-lucid-onboarding.yml`, ce dernier
paramétré par `ACCEPT_AUDIO_SAFETY`). Ils couvrent le démarrage, l'onboarding, la traversée des
onglets, le bilan du matin, le refus des signaux nocturnes tant que la sécurité audio n'est pas
acceptée, **et la transition inverse** : une fois les conditions remplies, le verrou s'ouvre — sans
quoi un bouton câblé sur `false` passerait la suite.

Aucun de ces flux n'a jamais tourné : il n'y a pas eu d'émulateur dans la session qui les a écrits.
Leur syntaxe est calquée sur les flux existants et leurs testID sont tous vérifiés dans le code, mais
la première exécution reste à faire, et c'est elle qui dira si le filet tient.

Restent hors couverture : le parcours programme → séance → complétion, le bilan hebdomadaire,
l'export et la suppression des données, l'abonnement. Et surtout : **rien dans le dépôt n'atteste
d'une exécution réelle** — les flux demandent la CLI Maestro et un émulateur Android. Tant qu'ils
n'ont pas tourné, ils sont une intention de test, pas une preuve, et la matrice de validation du
runbook de release reste entièrement manuelle.

### 14.9 Portugais absent

Noctalia parle six langues, Lucid Trainer cinq. `normalizeLucidLocale` replie `pt` sur `en` sans le
signaler : un utilisateur lusophone du journal retrouve le compagnon en anglais.

### 14.10 Non publié

L'application n'a jamais été soumise à un magasin. `version` et `runtimeVersion` valent `1.0.0`,
`buildNumber` et `versionCode` valent `1`, les clés RevenueCat du compagnon ne sont pas provisionnées,
et les migrations Supabase du module sont additives mais **n'ont été ni appliquées ni testées sur une
base réelle** (rapport de passation, §1 et §7). Aucun contrat SQL de ces migrations n'a donc été
exécuté. Les portes externes restantes sont listées dans le runbook de release et le rapport de
passation.

---

## 15. Documents liés

| Document | Contenu |
|---|---|
| [`constants/lucidTheme.ts`](../constants/lucidTheme.ts) | **bloc normatif de la palette** — autorité sur les couleurs du module |
| [`doc_web_interne/docs/LUCID_TRAINER_ARCHITECTURE.md`](../doc_web_interne/docs/LUCID_TRAINER_ARCHITECTURE.md) | carte d'exécution, propriété des données, variantes de build |
| [`doc_web_interne/docs/LUCID_TRAINER_RELEASE.md`](../doc_web_interne/docs/LUCID_TRAINER_RELEASE.md) | runbook : portes locales, matrice appareil, chemins EAS, rollback |
| [`doc_web_interne/docs/LUCID_TRAINER_SHARED_IDENTITY_ADR.md`](../doc_web_interne/docs/LUCID_TRAINER_SHARED_IDENTITY_ADR.md) | ADR : un projet Supabase Auth, domaines produit isolés |
| [`doc_web_interne/docs/LUCID_TRAINER_HANDOFF.md`](../doc_web_interne/docs/LUCID_TRAINER_HANDOFF.md) | passation : état, correctifs, gates externes, ordre de reprise |
| [`specs/noctalia-meditation.md`](noctalia-meditation.md) | spec de l'autre application compagnon (monorepo, Uniwind) |
