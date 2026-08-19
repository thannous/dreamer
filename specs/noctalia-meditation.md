# Noctalia Meditation — Spécification produit & technique

**Version :** 1.0 · **Date :** 2026-08-19 · **Statut :** prêt à implémenter
**Source de référence :** template « Zen — React Native Meditation App » (https://www.native-templates.com/templates/meditation)
**Objectif :** livrer une application identique en périmètre fonctionnel au template Zen, entièrement rhabillée avec la patte graphique Noctalia.

---

## 1. Contexte

Noctalia est aujourd'hui une application de journal de rêves (Expo SDK 57 / Supabase / RevenueCat, 6 langues). `Noctalia Meditation` est une **seconde application mobile de la marque**, autonome (bundle id, store listing, build et cycle de release distincts), qui partage l'identité visuelle, le ton et le positionnement éditorial. **Aucun compte, aucun backend applicatif en v1** (cf. §10).

Positionnement : Noctalia (rêve, nuit, interprétation) → Noctalia Meditation (préparation au sommeil, respiration, méditation guidée). Le pont produit est explicite : *on médite le soir, on rêve la nuit, on journalise au matin*.

### 1.1 Principe directeur

> **Périmètre = Zen, à l'identique. Habillage = Noctalia, à 100 %.**

Aucun écran de Zen n'est retiré, aucun n'est ajouté en v1. Toute la couche visuelle (couleurs, typographies, fonds, illustrations, wording) est remplacée par les tokens Noctalia. Les « aurora gradients » de Zen deviennent l'**atmosphère nocturne Noctalia** (dégradé encre + orbites + poussière d'étoiles or).

---

## 2. Stack technique (imposée)

| Élément | Version | Note |
|---|---|---|
| Expo SDK | `~57.0.12` | Expo Router, New Architecture activée |
| React Native | `0.86.2` | |
| React | `19.2.3` | |
| TypeScript | `~6.0.3` | mode `strict` |
| Uniwind | `^1.11.0` | **nouveauté vs Noctalia** : styling utility-first, `className` (cf. ADR-001) |
| Tailwind CSS | `^4.3.x` | requis par Uniwind, configuration CSS-first |
| Expo Router | `~57.0.12` | routing par fichiers |
| react-native-reanimated | `4.5.1` | animations respiration + player |
| react-native-gesture-handler | `~2.32.0` | |
| react-native-safe-area-context | `~5.7.0` | |
| react-native-screens | `~4.26.0` | |
| expo-audio | `~57.0.3` | lecture des sessions + boucles ambiantes |
| expo-video | `~57.0.x` | **à ajouter** — fonds vidéo (feature « Video backgrounds ») |
| expo-linear-gradient | `~57.0.1` | |
| expo-blur | `~57.0.2` | surfaces verre |
| expo-image | `~57.0.2` | artworks, avec cache disque |
| react-native-svg | `15.15.4` | fond atmosphérique, anneaux de respiration |
| expo-haptics | `~57.0.1` | retours de respiration |
| expo-font | `~57.0.0` + `@expo-google-fonts/{fraunces,space-grotesk,lora}` | |
| expo-localization | `~57.0.1` | détection de langue |
| @react-native-async-storage/async-storage | `2.2.0` | persistance locale |
| expo-file-system | `~57.0.x` | cache disque des pistes distantes |
| expo-notifications | `~57.0.10` | rappel de pratique quotidien |
| expo-image-picker | `~57.0.9` | photo de profil |
| expo-apple-authentication | `~57.0.1` | Sign in with Apple |
| react-native-purchases | `^9.6.7` | RevenueCat (paywall) |
| @shopify/flash-list | `2.0.2` | listes de sessions |
| Jest + jest-expo | aligné SDK 57 | tests unitaires |
| Maestro | — | E2E Android |

Plateformes : **iOS et Android**. Web non ciblé en v1 (le bundle doit néanmoins builder sans erreur).

### 2.1 Différence majeure avec le repo Noctalia actuel

Noctalia utilise `StyleSheet` + `constants/journalTheme.ts` + `constants/noctaliaDesign.ts`. **Noctalia Meditation utilise Uniwind** : les mêmes tokens sont exposés en CSS-first dans `global.css` (cf. §5.5), sans `tailwind.config.js` ni `babel.config.js`. Aucun `StyleSheet.create` sauf cas justifié (animations Reanimated, styles calculés dynamiquement).

---

## 3. Structure du projet

**Monorepo** : l'application vit dans `apps/meditation/` du dépôt `dreamer`, à côté de l'app journal qui reste à la racine (la déplacer dans `apps/journal/` serait une restructuration à part entière, à faire un jour, pas maintenant).

Deux projets Expo dans un même dépôt demandent trois garde-fous, tous en place :
le `tsconfig.json` de la racine exclut `apps/**` ; le `metro.config.js` de la racine ajoute `apps/meditation` à sa `blockList`, sans quoi les deux arbres `node_modules` entrent en collision dans la haste map ; et `jest`/`lint` de la racine listent leurs dossiers explicitement, donc ne voient pas le second projet. Chaque app garde ses propres dépendances et ses propres commandes.

```
apps/meditation/
├── app/                              # Expo Router
│   ├── _layout.tsx                   # providers + fonts + splash
│   ├── index.tsx                     # routeur de démarrage (redirection)
│   ├── welcome.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── goals.tsx
│   │   ├── experience.tsx
│   │   ├── intention.tsx
│   │   └── reminder.tsx
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   ├── email.tsx
│   │   └── callback.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx                 # Accueil
│   │   ├── breathe.tsx
│   │   ├── search.tsx
│   │   └── profile.tsx
│   ├── session/[id].tsx
│   ├── player/[id].tsx               # modal plein écran
│   ├── breathe/[pattern].tsx         # exercice animé plein écran
│   ├── category/[slug].tsx
│   ├── favorites.tsx
│   ├── session-complete.tsx          # modal de fin de session
│   ├── paywall.tsx                   # modal
│   └── settings/
│       ├── index.tsx
│       ├── account.tsx
│       ├── language.tsx
│       ├── reminders.tsx
│       ├── help.tsx
│       └── legal.tsx
├── components/
│   ├── atmosphere/                   # NightBackground, StarField, GlowOrb, AuroraVeil
│   ├── ui/                           # Button, Card, GlassCard, Chip, Sheet, Slider, Toggle…
│   ├── home/                         # TodayCard, QuickSessionRow, StreakBadge, GreetingHeader
│   ├── session/                      # SessionCard, SessionList, NarratorBlock, BenefitList
│   ├── player/                       # PlayerArtwork, PlayerControls, ProgressScrubber, TimerSheet
│   ├── breathe/                      # BreathRing, BreathPhaseLabel, PatternCard, BreathTimer
│   ├── profile/                      # StatTile, StreakCalendar, AvatarPicker
│   └── paywall/                      # PlanCard, BenefitRow, RestoreLink
├── constants/
│   ├── theme.ts                      # tokens Noctalia (source de vérité, copiés depuis dreamer)
│   ├── typography.ts
│   └── motion.ts                     # durées/courbes d'animation
├── content/
│   ├── sessions.ts                   # catalogue statique typé
│   ├── categories.ts
│   ├── narrators.ts
│   └── breathing.ts                  # 4 patterns
├── context/                          # ThemeProvider, AuthProvider, PlayerProvider,
│                                     # SubscriptionProvider, LanguageProvider, LibraryProvider
├── hooks/                            # useAudioPlayer, useBreathEngine, useStreak,
│                                     # useFavorites, useSessionProgress, useTranslation
├── lib/                              # env.ts, storage.ts, i18n/, analytics.ts, types.ts, format.ts
├── services/                         # audioService, mediaService, storageService,
│                                     # purchaseService, notificationService (+ mocks/)
├── assets/
│   ├── audio/sessions/               # pistes .m4a
│   ├── audio/ambience/               # boucles d'ambiance
│   ├── video/                        # fonds vidéo (mp4, H.264, muet)
│   ├── images/artwork/               # visuels de sessions
│   └── fonts/
├── tests/
├── maestro/
├── tailwind.config.js
├── global.css
├── app.json / app.config.ts
├── AGENTS.md · CLAUDE.md             # règles agents (comme Zen fournit Claude/Cursor rules)
└── package.json
```

---

## 4. Inventaire des écrans

La galerie de Zen compte 23 captures, dont 4 variantes en thème sombre : **19 écrans uniques documentés**, complétés par les écrans de support (légal, fin de session, rappels) qui portent le total aux « 20+ screens » annoncés. Correspondance 1:1 ci-dessous — **24 routes** au total.

| # | Écran Zen | Route Noctalia Meditation | Contenu |
|---|---|---|---|
| 1 | Welcome — *find your inner calm* | `/welcome` | Fond vidéo/atmosphère, logo Noctalia, baseline, CTA « Commencer » + « J'ai déjà un compte » |
| 2 | Onboarding — motivations | `/(onboarding)/goals` | Multi-sélection : Mieux dormir · Réduire le stress · Me concentrer · Gérer l'anxiété · Cultiver la gratitude · Préparer mes rêves |
| 3 | Onboarding — niveau | `/(onboarding)/experience` | Choix unique : Débutant · Occasionnel · Régulier |
| 4 | Onboarding — intention quotidienne | `/(onboarding)/intention` | Durée cible/jour : 5 · 10 · 15 · 20 min |
| 5 | *(ajout Noctalia, remplace rien)* rappel | `/(onboarding)/reminder` | Opt-in notification + heure. **Note :** si l'on veut rester strictement à 23 écrans, cette étape est fusionnée dans l'écran 4. Recommandation : la garder séparée (cf. §20 Q1) |
| 6 | Sign in (Apple / Google / email) | `/(auth)/sign-in` | Construit mais **désactivé en v1.0** par `EXPO_PUBLIC_ACCOUNTS_ENABLED=false` (cf. §10) |
| 7 | Saisie email | `/(auth)/email` | Idem : construit, inaccessible dans les builds store v1.0 |
| 8 | Home — pratique du jour | `/(tabs)/index` | Salutation contextuelle, `TodayCard`, reprise en cours, sessions rapides (5/10/15 min), bandeau série |
| 9 | Breathe — patterns | `/(tabs)/breathe` | 4 cartes : Apaisant · Carré · 4-7-8 · Cohérence cardiaque |
| 10 | Search — catégories + bibliothèque | `/(tabs)/search` | Champ de recherche, grille de catégories, liste complète filtrable (durée, narrateur, thème) |
| 11 | Profile — statistiques | `/(tabs)/profile` | Série en cours / record, sessions, minutes totales, calendrier de pratique, accès Favoris & Réglages |
| 12 | Session detail | `/session/[id]` | Artwork, titre, durée, narrateur, description, liste de bénéfices, CTA lecture, favori, badge Plus |
| 13 | Full-screen player | `/player/[id]` | Artwork dégradé animé, scrubber, ±15 s, play/pause, vitesse, minuteur de fondu, AirPlay/Cast (iOS), fond vidéo optionnel |
| 14 | Breathing exercise animé | `/breathe/[pattern]` | Anneau respiratoire animé, phase (Inspire/Retiens/Expire/Pause), compte à rebours, haptique, ambiance sonore |
| 15 | Category — ex. Sommeil | `/category/[slug]` | En-tête illustré + liste des sessions de la catégorie |
| 16 | Favorites | `/favorites` | Sessions sauvegardées, état vide soigné |
| 17 | Paywall « Zen Plus » → **Noctalia Plus** | `/paywall` | Annuel (mis en avant, économie %) / Mensuel, liste de bénéfices, essai, restaurer, CGU/Confidentialité |
| 18 | Settings + bascule de thème | `/settings` | Thème (Clair/Sombre/Auto), notifications, langue, compte, aide, légal, version |
| 19 | Profile settings + photo | `/settings/account` | Avatar (`expo-image-picker`), prénom, email, plan, déconnexion, suppression de compte |
| 20 | Language selection | `/settings/language` | en · fr · es · de · it · pt |
| 21 | Help & FAQ | `/settings/help` | Accordéons FAQ + contact |
| 22 | *(support)* Légal | `/settings/legal` | CGU, confidentialité, licences |
| 23 | *(support)* Fin de session | `/session-complete` | Récap : durée, série mise à jour, CTA « Noter mon rêve » (deep link vers l'app Noctalia), « Terminer » |
| 24 | *(support)* Rappels | `/settings/reminders` | Activation, heure, jours |

> Les écrans 22–24 correspondent au « 20+ screens » annoncé par Zen (dont le décompte inclut les écrans de support non capturés dans la galerie).

### 4.1 Détail des écrans clés

**`/(tabs)/index` — Accueil**
- En-tête : salutation dépendant de l'heure (« Bonsoir » après 18 h), date, `StreakBadge`.
- `TodayCard` : session recommandée du jour (déterministe par `hash(userId + date)` sur le catalogue, filtrée par les objectifs d'onboarding), artwork plein largeur, durée, CTA « Commencer ».
- Section « Reprendre » : visible seulement si une session a une progression 5 % < p < 95 %.
- Section « Sessions rapides » : chips 5 / 10 / 15 min → liste horizontale.
- Section « Respirer » : raccourci vers le pattern préféré.
- Section « Pour ce soir » : sessions de la catégorie Sommeil.

**`/player/[id]` — Lecteur**
- Artwork : dégradé Noctalia animé (Reanimated, cycle de 12 s) + halo or, ou fond vidéo si la session en déclare un.
- Contrôles : play/pause, −15 s / +15 s, scrubber avec temps écoulé/restant, volume ambiance, vitesse (0,75× / 1× / 1,25×), minuteur de fondu (5/10/15/30 min / fin de session).
- Lecture en arrière-plan + contrôles écran verrouillé (`UIBackgroundModes: audio`, `FOREGROUND_SERVICE` Android).
- Sortie : swipe-down → mini-player persistant au-dessus des onglets.
- Fin de piste → `/session-complete`.

**`/breathe/[pattern]` — Respiration**
- Anneau SVG dont le rayon est piloté par une `SharedValue` ; halo qui s'intensifie à l'inspiration.
- Phases affichées en Fraunces, minuterie globale configurable (1/3/5/10 min).
- Haptique légère à chaque changement de phase (désactivable).
- Ambiance sonore optionnelle en boucle.

---

## 5. Design system Noctalia

Source de vérité : `constants/journalTheme.ts` et `constants/noctaliaDesign.ts` du repo `dreamer`. Les valeurs sont **copiées telles quelles** (pas de dépendance croisée entre les deux dépôts en v1).

### 5.1 Palette — thème sombre (par défaut)

| Token | Hex | Usage |
|---|---|---|
| `backgroundDark` | `#03040D` | fond d'écran nocturne |
| `backgroundCard` | `#0D0B1C` | surfaces de cartes |
| `backgroundSecondary` | `#192344` | panneaux, champs |
| `textPrimary` | `#FFF9EF` | titres, corps |
| `textSecondary` | `#B7AEC9` | texte secondaire |
| `textTertiary` | `#8E84A7` | libellés, inactifs |
| `accent` | `#D4A574` | **remplissages et filets uniquement** |
| `accentText` | `#EAD4B4` | texte/icônes accentués sur fond nuit |
| `accentDark` | `#9A6332` | états pressés, bordures fortes |
| `accentLight` | `#EAD4B4` | filets, surbrillance |
| `textOnAccentSurface` | `#3B2412` | texte sur CTA or |
| `divider` | `#514637` | hairlines |
| `navbarBg` | `#050510` | barre d'onglets |

### 5.2 Palette — thème clair

| Token | Hex |
|---|---|
| `backgroundDark` (fond) | `#FBFAF7` |
| `backgroundCard` | `#FFFDF8` |
| `backgroundSecondary` | `#F3EFE7` |
| `textPrimary` | `#2A2838` |
| `textSecondary` | `#6B6880` |
| `textTertiary` | `#6F6C84` |
| `accent` | `#D4A574` |
| `accentText` | `#9A6332` |
| `divider` | `#E4DDD2` |

**Règle non négociable :** `accent` (`#D4A574`) ne sert **jamais** de couleur de texte. Utiliser `accentText` (`#9A6332` en clair, `#EAD4B4` en sombre) — contraste WCAG AA garanti.

### 5.3 Typographie

| Rôle | Police | Graisses |
|---|---|---|
| Titres, chiffres de statistiques, phases de respiration | **Fraunces** | 400 / 500 / 600 / 700 |
| Corps, boutons, libellés, navigation | **Space Grotesk** | 400 / 500 / 700 |
| Citations, intentions, textes d'ambiance | **Lora** (italique inclus) | 400 / 400i / 700 |

Échelle : `display 34/40`, `h1 28/34`, `h2 22/28`, `h3 18/24`, `body 16/24`, `bodySm 14/20`, `caption 12/16`, `overline 11/14` (tracking +0,12 em, capitales).

### 5.4 Formes, ombres, atmosphère

- Rayons : `sm 8` · `md 12` · `lg 16` · `xl 24` · `full 999`. Cartes de session : `xl`. Artwork du player : `28`.
- Espacements : `4 / 8 / 16 / 20 / 24 / 32`.
- Cartes verre : fond `rgba(13,11,28,0.92)` (sombre) / `#FFFDF8` (clair), bordure 1 px `divider`, rayon 24, + filet d'accent de 2,5 px en haut sur les cartes mises en avant (`DecoLines.stripe`).
- Ombres : reprendre les 4 niveaux `sm/md/lg/xl` de `Shadows` (élévations 1→8).
- **Atmosphère (remplace les « aurora gradients » de Zen) :** `LinearGradient` `#03040D → #120D23` + orbites SVG `rgba(234,212,180,0.24)`, poussière d'étoiles `rgba(234,212,180,0.7)`, voile `rgba(25,35,68,0.42)`, halo or à 16 % d'opacité. Deux variantes : `immersive` (welcome, player, respiration) et `subtle` (onglets, listes).

### 5.5 Mapping Uniwind (CSS-first)

Aucun `tailwind.config.js`, aucun `babel.config.js` : tout vit dans `global.css`.
L'invariant (fontes, tailles, rayons) va dans `@theme`, les couleurs sont déclarées par
thème dans `@layer theme` avec `@variant` :

```css
@import 'tailwindcss';
@import 'uniwind';

@theme {
  --font-display: 'Fraunces_600SemiBold';
  --text-h1: 28px;
  --text-h1--line-height: 34px;
  --radius-xl: 24px;
  --spacing-gutter: 20px;
  /* couleurs déclarées ici pour générer les utilitaires */
}

@layer theme {
  :root {
    @variant light { --color-ink: #fbfaf7; --color-ivory: #2a2838; /* … */ }
    @variant dark  { --color-ink: #03040d; --color-ivory: #fff9ef; /* … */ }
  }
}
```

Une couleur `--color-ivory-muted` produit `text-ivory-muted`, `bg-ivory-muted`, etc.
Le `ThemeProvider` passe la préférence à `Uniwind.setTheme('light' | 'dark' | 'system')`
et lit le thème **résolu** via `useUniwind()`. La persistance reste en AsyncStorage.

**Règle d'écriture des composants.** Une variante typographique ne porte jamais de
couleur : le composant `Text` sépare `variant` (fonte + taille) de `tone` (couleur). Deux
classes `text-*` concurrentes sont une source de régressions de contraste silencieuses —
c'est ce qui a motivé le choix d'Uniwind (cf. [ADR-001](adr-001-nativewind-vs-uniwind.md)).

### 5.6 Signature sensible

Ce qui distingue Meditation de l'app journal n'est pas une texture, c'est **le temps**.
Le verre existe déjà chez Noctalia journal ; en faire la signature ici donnerait un
re-skin. Trois éléments, dans cet ordre d'importance :

**1. Le souffle.** Une unique `SharedValue` Reanimated dans `BreathProvider`, oscillant
0 → 1 → 0 en 11 s (5,5 s inspiration / 5,5 s expiration, easing sinus) : la cohérence
cardiaque, exactement ce que les exercices enseignent. Toutes les surfaces qui respirent
la lisent, donc **halo, filets dorés et anneau du lecteur sont en phase** — l'interface
inspire et expire comme un seul corps. Coût : une animation pour toute l'app, sur le
thread UI, quel que soit le nombre de consommateurs.

| Surface | Amplitude |
|---|---|
| Halo du fond | opacité 0,84 → 1,00 |
| Filet champagne des cartes mises en avant | opacité 0,77 → 0,95 |
| Anneau du bouton lecture | échelle 1,00 → 1,02 |

Les plages doivent **plafonner à 1,00** : au-delà, l'opacité est écrêtée et la surface
passe une partie du cycle collée au maximum au lieu de respirer.

`prefers-reduced-motion` fige `progress` à 0,5 : chaque surface se pose sur sa valeur
moyenne, une app immobile paraît alors voulue et non inachevée.

**2. Le silence progressif** — la signature d'interaction. Pendant une séance, les
commandes s'effacent après 4 s sans geste ; un toucher les rappelle. `ProgressiveSilence`
enveloppe le chrome, jamais le contenu : masqué, il quitte l'arbre d'accessibilité et
cesse de recevoir les touchers, pour que le geste qui le rappelle ne le déclenche pas.

**3. Le grain.** Un bruit tuilé de 96 px à 3,5 % la nuit, 2,2 % le jour, par-dessus le
fond et les surfaces vitrées. C'est ce qui sépare le verre dépoli d'un matériau système
du clair de lune à travers la brume, et cela convient à une palette champagne sur encre,
qui est une palette de papier et d'argentique. Un bitmap répété : ni flou, ni shader.

**Le verre est une texture d'appui, pas la signature.** Une surface `GlassCard` par écran
au maximum, jamais dans une liste qui défile (`BlurView` coûte cher sur Android, et tout
frost aplatit la hiérarchie qu'il devrait créer). Partout ailleurs : `Card`.

**Aucune transition qui glisse.** Fondus uniquement, 640 ms, easing sinus.

---

## 6. Modèles de données

```ts
// content/types
export type SessionCategorySlug =
  | 'sleep' | 'stress' | 'focus' | 'anxiety' | 'gratitude' | 'dream-prep';

export type MeditationSession = {
  id: string;
  slug: string;
  titleKey: string;            // clé i18n
  descriptionKey: string;
  categorySlug: SessionCategorySlug;
  narratorId: string;
  durationSec: number;
  audio: AudioSource;          // require(...) local en v1
  artwork: ImageSource;
  videoBackground?: VideoSource;
  benefitKeys: string[];       // 3 à 5 puces
  isPremium: boolean;
  accent: [string, string];    // dégradé d'artwork
};

export type Narrator = { id: string; name: string; bioKey: string; avatar: ImageSource };

export type BreathingPatternId = 'calm' | 'box' | 'four-seven-eight' | 'coherent';
export type BreathingPattern = {
  id: BreathingPatternId;
  nameKey: string; descriptionKey: string;
  phases: { type: 'inhale' | 'hold' | 'exhale' | 'rest'; seconds: number }[];
  defaultDurationMin: 1 | 3 | 5 | 10;
  accent: [string, string];
};

// état utilisateur (local)
export type UserProfile = {
  displayName?: string; avatarUri?: string;
  goals: SessionGoal[]; experience: 'beginner' | 'occasional' | 'regular';
  dailyIntentionMin: 5 | 10 | 15 | 20;
};
export type PracticeEntry = { dateISO: string; sessionId?: string; patternId?: BreathingPatternId; seconds: number };
export type Streak = { current: number; longest: number; lastPracticeISO?: string };
export type Progress = Record<string /* sessionId */, { positionSec: number; completedCount: number; lastPlayedISO: string }>;
```

Clés AsyncStorage (préfixe `@noctalia-med/`) : `profile`, `onboarding`, `favorites`, `progress`, `practice-log`, `streak`, `theme`, `language`, `reminders`, `player-prefs`.

---

## 7. Contenu v1

- **6 catégories** : Sommeil, Stress, Concentration, Anxiété, Gratitude, Préparation au rêve (la dernière est le pont éditorial avec Noctalia).
- **24 sessions** (4 par catégorie), durées 3 / 5 / 10 / 20 min. **8 gratuites** (au moins une par catégorie sauf « Préparation au rêve »), 16 réservées à Noctalia Plus.
- **3 narrateurs** (voix féminine, voix masculine, voix neutre/instrumentale).
- **4 patterns de respiration** :
  | Pattern | Cycle |
  |---|---|
  | Apaisant (`calm`) | 4 s inspire · 6 s expire |
  | Carré (`box`) | 4 · 4 · 4 · 4 |
  | 4-7-8 | 4 inspire · 7 rétention · 8 expire |
  | Cohérence cardiaque (`coherent`) | 5,5 s · 5,5 s |
- **3 ambiances** en boucle : pluie, océan, bruit brun (réutilisables depuis `assets/audio/sleep/` de Noctalia).

Le catalogue est **statique et typé** (`content/sessions.ts`) en v1 — comme Zen, l'app n'a pas de backend de contenu.

---

## 8. Architecture audio & distribution des pistes

### 8.1 Lecture

- `services/audioService.ts` encapsule `expo-audio` ; interface unique consommée par `PlayerProvider`.
- Un seul lecteur « session » + un lecteur « ambiance » superposable (volume indépendant).
- Mode audio : `playsInSilentMode: true`, `shouldPlayInBackground: true`, ducking désactivé.
- iOS : `UIBackgroundModes: ["audio"]`. Android : service de premier plan + notification média.
- Reprise : la position est écrite toutes les 5 s et à chaque pause dans `progress`.
- Mini-player : composant persistant rendu dans `(tabs)/_layout.tsx`, masqué sur `/player/[id]`.
- **Mode mock** (`EXPO_PUBLIC_MOCK_MODE=true`) : `services/mocks/audioServiceMock.ts` simule la progression sans fichier audio, pour l'E2E et le dev sans assets. Même convention que Noctalia : module conditionnel + `*Real` + `mocks/*Mock`, jamais d'import direct de l'implémentation.

### 8.2 Budget de taille — pourquoi tout embarquer est impossible

Référence mesurée sur les boucles Noctalia existantes : 1,5 Mo pour 5 min, soit ~40 kbps / **0,3 Mo par minute**. À 48 kbps mono (suffisant pour de la voix) :

| Poste | Volume |
|---|---|
| 24 sessions × ~10 min | **~86 Mo** |
| 3 ambiances × 5 min | 4,5 Mo |
| 24 artworks WebP 1080² | ~3 Mo |
| 3–4 fonds vidéo | ~24 Mo |
| **Total si tout est embarqué** | **~118 Mo** |

Or le module de base d'un AAB Play plafonne à 150 Mo installés, et une app lourde dégrade le taux d'installation. Tout embarquer est donc exclu.

### 8.3 Distribution retenue

- **Embarqué dans le bundle** : les 3 ambiances, les artworks, **les 4 sessions offertes du premier lancement** (~15 Mo). L'app est utilisable immédiatement, hors ligne, dès l'installation — sans le moindre appel réseau.
- **Distant** : les 20 autres sessions et les fonds vidéo, servis en **fichiers statiques depuis un bucket Cloudflare R2** (`EXPO_PUBLIC_MEDIA_BASE_URL`), déjà dans l'écosystème Cloudflare du site marketing.
- **Cache** : `mediaService` télécharge via `expo-file-system` vers un répertoire persistant, indexe `{sessionId → uri locale}` en AsyncStorage, purge en LRU au-delà de 300 Mo. Une session déjà écoutée ne se retélécharge jamais.
- **Ce n'est pas un backend** : bucket de fichiers statiques derrière un CDN, zéro base de données, zéro exécution serveur, zéro donnée utilisateur sortante.
- **Gating des pistes premium** : les URLs sont non devinables (chemin UUID) mais **non signées** en v1 — un fichier premium reste techniquement récupérable par qui connaît son URL. Risque assumé pour du contenu audio non exclusif. Si cela devient un enjeu, la signature se fait par un Worker Cloudflare qui interroge l'API REST RevenueCat (~50 lignes), sans introduire de base de données.
- **Objectif de taille** : téléchargement store ≤ 60 Mo iOS et ≤ 50 Mo Android.

---

## 9. Moteur de respiration

`hooks/useBreathEngine.ts` : machine à états dérivée de `BreathingPattern.phases`, pilotée par `withTiming` sur une `SharedValue` (`scale` 0,55 → 1,0), boucle jusqu'à expiration du timer global.
- Rendu de l'anneau en `react-native-svg` + `useAnimatedProps` (pas de re-render JS par frame).
- Haptique : `Haptics.impactAsync(Light)` à chaque transition, coupée si l'utilisateur l'a désactivée ou si la réduction de mouvement système est active.
- `prefers-reduced-motion` : remplacer l'anneau animé par une jauge linéaire + compte à rebours.
- Une session de respiration terminée alimente le journal de pratique et la série, comme une session guidée.

---

## 10. Comptes : aucun en v1

**La v1.0 n'a ni compte, ni serveur applicatif.** Zen n'en a pas non plus, et rien dans le périmètre n'en réclame : le catalogue est embarqué, la lecture est locale, les favoris / la progression / les séries / les préférences vivent en AsyncStorage, et RevenueCat gère seul les droits d'accès et la restauration d'achat via le compte App Store ou Play.

Conséquences directes, toutes favorables :

- Étiquette de confidentialité store **« aucune donnée collectée »**, pas de politique de conservation à tenir, surface RGPD nulle.
- Aucun coût d'infrastructure, aucune astreinte, aucune migration de schéma.
- Aucun écran de connexion bloquant à l'entrée : l'utilisateur médite au premier lancement.

### 10.1 Les écrans d'auth restent construits, mais éteints

Les écrans 6 et 7 sont développés (parité avec Zen, et bascule future en une variable), mais pilotés par `EXPO_PUBLIC_ACCOUNTS_ENABLED`, à `false` dans les builds store v1.0 :

- `/welcome` mène directement à l'onboarding ; `/(auth)/*` est injoignable.
- `/settings/account` gère le profil **local** : prénom, avatar, objectifs, remise à zéro des données.

> **Règle de review :** ne jamais publier un bouton de connexion non fonctionnel (rejet App Store 2.1). Le drapeau est la garantie : soit l'auth marche, soit elle n'est pas affichée.

### 10.2 Le jour où l'on activera les comptes

Trois besoins — et **seulement** ces trois — justifieront de rouvrir le sujet : synchronisation multi-appareils, compte unique partagé avec l'app Noctalia, abonnement acheté sur iOS et utilisé sur Android. Décision à prendre sur les chiffres de rétention post-lancement, pas maintenant.

Le jour venu, la marche est courte : Supabase est déjà en place pour Noctalia, `authService` est déjà l'unique point d'entrée dans le code, et l'état local est déjà sérialisable tel quel. Contraintes qui s'appliqueront alors : Sign in with Apple obligatoire dès qu'un autre provider social est proposé (App Store 4.8), et suppression de compte en self-service (App Store 5.1.1(v)).

---

## 11. Monétisation

- **Noctalia Plus** (nom du plan repris de l'app existante), RevenueCat.
- Offres : **annuel** (mis en avant, badge « −xx % ») et **mensuel**, essai gratuit 7 jours sur l'annuel.
- Entitlement : `meditation_plus`, propre à cette app. Sans compte, RevenueCat fonctionne en `appUserID` anonyme : « Restaurer les achats » rétablit l'abonnement via le compte App Store / Play sur la même plateforme — ce qui couvre la réinstallation et le changement d'appareil du même écosystème. Le partage d'abonnement avec l'app Noctalia suppose une identité commune : reporté avec les comptes (cf. §10.2 et §20 Q2).
- Points de déclenchement du paywall : session premium, 3ᵉ session gratuite du mois épuisée, pattern de respiration avancé, minuteur > 15 min, téléchargement hors-ligne.
- Écran paywall = écran 17 ; « Restaurer les achats » et liens légaux obligatoires.
- Mode `teststore` pour la QA, comme dans Noctalia.

---

## 12. Internationalisation

6 langues, identiques à Noctalia : **en, fr, es, de, it, pt**.
- `lib/i18n/{en,fr,es,de,it,pt}.ts`, clés plates (`player.controls.play`), hook `useTranslation()`.
- Langue détectée via `expo-localization`, surchargeable dans `/settings/language`, persistée.
- Le contenu du catalogue référence des **clés**, jamais du texte en dur — y compris les titres et bénéfices des sessions.
- Les fichiers audio des sessions sont en anglais en v1 ; l'UI est localisée. Un champ `audioLocales: AppLanguage[]` est prévu dans le modèle pour la v2.

---

## 13. Accessibilité

- Contraste AA sur tous les textes : d'où la règle `accent` ≠ texte (§5.2).
- Cibles tactiles ≥ 44×44 pt, `accessibilityRole`/`accessibilityLabel` sur tous les contrôles du player et des cartes.
- Support de la mise à l'échelle des polices jusqu'à 200 % (aucune hauteur fixe sur les conteneurs de texte).
- `AccessibilityInfo.isReduceMotionEnabled()` respecté par l'anneau de respiration, l'artwork animé et les fonds vidéo.
- Fonds vidéo : toujours muets, désactivables dans les réglages, jamais porteurs d'information.
- VoiceOver/TalkBack annonce les changements de phase de respiration (`accessibilityLiveRegion`).

---

## 14. Performance

- Listes en `FlashList` (catalogue, recherche, favoris).
- `expo-image` avec `cachePolicy="memory-disk"` et `placeholder` blurhash.
- Aucune animation pilotée par le thread JS : Reanimated worklets uniquement.
- Fonds vidéo : ≤ 6 Mo, 1080×1920, H.264, 8–12 s en boucle, chargés en différé et suspendus quand l'écran perd le focus.
- Budget : démarrage à froid < 2 s sur un appareil Android milieu de gamme ; passage à la lecture < 400 ms.

---

## 15. Tests & qualité

| Niveau | Outil | Périmètre minimal |
|---|---|---|
| Unitaire | Jest + jest-expo + `@testing-library/react-native` | `useBreathEngine` (durées de phases), `useStreak` (bascule de jour, fuseau, rupture), sélection de la session du jour, gating premium, formatage des durées |
| Composant | RNTL | `PlayerControls`, `SessionCard`, `PlanCard`, états vides |
| E2E | Maestro (Android) | onboarding complet → lecture d'une session → fin → série incrémentée ; respiration 1 min ; paywall depuis une session premium ; bascule de thème ; changement de langue |
| Statique | `tsc --noEmit` (TS 6, strict), ESLint (config Expo) | zéro erreur, zéro warning sur `scripts` |

`testID` ajoutés uniquement là où Maestro en a besoin, centralisés dans `lib/testIDs.ts` (convention Noctalia).

---

## 16. Assets à produire

| Asset | Quantité | Spécification |
|---|---|---|
| Pistes audio de sessions | 24 | `.m4a` AAC **48 kbps mono** (débit retenu au §8.2), normalisées à −16 LUFS, fondus 1,5 s |
| Boucles d'ambiance | 3 | `.m4a` ~40 kbps, 5 min, boucle sans couture (réutilisables depuis `assets/audio/sleep/` de Noctalia) |
| ~~Artworks de sessions~~ | — | **Supprimé en L2** : l'artwork est peint depuis la paire d'accent de la catégorie (`SessionArtwork`) plus le grain. 24 bitmaps représentaient un poids réel pour ce que la palette exprime déjà, et le dégradé reste dans la marque par construction. |
| Fonds vidéo | 3–4 | 1080×1920 MP4 H.264, muet, ≤ 6 Mo |
| Avatars de narrateurs | 3 | 512×512 WebP |
| Icône d'app + splash | — | Déclinaison Noctalia : croissant/étoile or `#D4A574` sur `#03040D` |
| Illustrations d'états vides | 4 | SVG monochrome or |

Les visuels peuvent être générés (pipeline Higgsfield déjà en place côté marque) ; la direction artistique doit rester cohérente avec les artworks de rêves de Noctalia.

---

## 17. Configuration applicative

```jsonc
{
  "name": "Noctalia Meditation",
  "slug": "noctalia-meditation",
  "scheme": "noctaliameditation",
  "ios":     { "bundleIdentifier": "com.noctalia.meditation", "infoPlist": { "UIBackgroundModes": ["audio"] } },
  "android": { "package": "com.noctalia.meditation",
               "permissions": ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "POST_NOTIFICATIONS"] },
  "userInterfaceStyle": "automatic",
  "newArchEnabled": true
}
```

Variables `EXPO_PUBLIC_*` : `EXPO_PUBLIC_MOCK_MODE`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_MEDIA_BASE_URL`, `EXPO_PUBLIC_ACCOUNTS_ENABLED`. Accès **uniquement** via `lib/env.ts` avec union de clés typée et `switch` statique (règle Noctalia : pas de `process.env[key]` dynamique, jamais de secret dans `EXPO_PUBLIC_*`).

Profils : `.env.mock`, `.env.real`, `.env.teststore` + `scripts/expo-safe-runner.js` repris de Noctalia.

Deep links croisés : `noctalia://record` depuis `/session-complete` (« Noter mon rêve »), avec repli sur le store si l'app Noctalia n'est pas installée.

---

## 18. Lots de livraison

| Lot | Contenu | Sortie |
|---|---|---|
| **L0 — Fondations** | Scaffold Expo 57 + NativeWind v4 + Tailwind mappé sur les tokens Noctalia, polices, `ThemeProvider`, `NightBackground`, kit UI (Button, Card, GlassCard, Chip, Sheet) | Écran de démo qui prouve clair/sombre |
| **L1 — Parcours d'entrée** | Welcome, 4 étapes d'onboarding, écrans d'auth derrière `ACCOUNTS_ENABLED`, routeur de démarrage, **plomberie i18n (en/fr)** | Écrans 1–7 |
| **L2 — Bibliothèque** | Catalogue statique (24 séances, 6 catégories, 3 voix), barre d'onglets, Accueil, Recherche, Catégorie, Détail de séance, Favoris | Écrans 8, 10, 12, 15, 16 |
| **L3 — Lecture** | `audioService` (+ mock), `mediaService`, `PlayerProvider`, lecteur plein écran avec silence progressif, mini-lecteur, ambiances, vitesse, minuteur de fondu, fin de séance | Écrans 13, 23 |
| **L4 — Respiration** | `useBreathEngine` (horloge unique, phases pures), liste des 4 rythmes, exercice animé, repli `prefers-reduced-motion`, journal de pratique | Écrans 9, 14 |
| **L5 — Profil & séries** | Journal de pratique, séries, statistiques, calendrier | Écran 11 |
| **L6 — Réglages** | Réglages, profil local + photo, langue, rappels planifiés (`notificationService` + mock), aide/FAQ, légal | Écrans 18–22, 24 |
| **L7 — Monétisation** | RevenueCat, gating premium, paywall | Écran 17 |
| **L8 — Finition** | Fonds vidéo, haptique, accessibilité, **4 locales restantes** (es, de, it, pt), tests Maestro, icône/splash, préparation stores | Release candidate |

---

## 19. Hors périmètre v1

- **Comptes utilisateur, backend applicatif et synchronisation multi-appareils** (cf. §10) ; Zen n'en a pas non plus.
- Abonnement partagé entre les deux apps Noctalia, et achat multiplateforme iOS ↔ Android.
- Téléchargement hors-ligne explicite « à la demande » (le cache CDN couvre l'usage courant ; bouton dédié prévu v1.2).
- Programmes/parcours multi-jours, défis, social, partage.
- Apple Watch / widgets / Live Activities.
- Voix off localisées (UI localisée uniquement).
- Version web.

---

## 20. Questions ouvertes (arbitrage nécessaire)

1. **Étape « rappel » dans l'onboarding** : étape dédiée (recommandé, meilleure opt-in) ou fusionnée dans l'écran « intention » pour coller exactement aux 4 étapes de Zen ?
2. **Abonnement** : abonnement propre à Meditation (retenu par défaut, seule option sans compte) ou, plus tard, Noctalia Plus unique couvrant les deux apps ? À rouvrir seulement si les comptes arrivent.
3. ~~**Dépôt**~~ — **tranché le 2026-08-19 : monorepo.** L'app vit dans `apps/meditation/` du dépôt `dreamer` (cf. §3).
4. **Voix** : narrateurs enregistrés en studio, ou synthèse vocale premium (ElevenLabs) pour la v1 ?
5. **Hébergement des pistes** : bucket Cloudflare R2 (retenu, cohérent avec le site) ou embarquer davantage de sessions au prix d'un bundle plus lourd ?
6. ~~**NativeWind v4 ou Uniwind**~~ — **tranché le 2026-08-19 : Uniwind** (cf. [ADR-001](adr-001-nativewind-vs-uniwind.md)). Le §2 est mis à jour en conséquence.

---

## 21. Critères d'acceptation de la v1

- [ ] Les 24 routes existent et sont atteignables ; aucune route morte.
- [ ] Chaque écran est correct en clair **et** en sombre, avec l'atmosphère Noctalia.
- [ ] Zéro couleur en dur hors `tailwind.config.js` / `constants/theme.ts`.
- [ ] Zéro chaîne de caractères en dur : tout passe par i18n, dans les 6 langues.
- [ ] Lecture audio continue écran verrouillé sur iOS et Android, reprise à la position exacte.
- [x] Les 4 patterns de respiration respectent leurs durées de phase à ±100 ms sur 5 minutes. *(Vérifié en L4 : exact par construction — les phases dérivent d'une horloge unique, pas d'une chaîne de minuteurs. Mesuré à l'écran : expiration 7,99 s / inspiration 4,02 s.)*
- [x] La série s'incrémente une fois par jour civil local et se rompt après un jour manqué. *(Vérifié en L5 : logique pure dans `lib/streak.ts`, 21 tests dont les deux moitiés du critère, puis contrôlé à l'écran — série 3, record 4, 7 pratiques, 63 min, calendrier aligné.)*
- [ ] Le paywall s'ouvre sur chaque point de déclenchement listé et « Restaurer » fonctionne.
- [ ] Aucun appel réseau au premier lancement : onboarding et première session jouables en mode avion.
- [ ] Téléchargement store ≤ 60 Mo (iOS) / ≤ 50 Mo (Android) ; une session distante déjà écoutée se relit hors ligne.
- [ ] Aucune référence à un compte ou à un backend applicatif dans le code livré (`ACCOUNTS_ENABLED=false` → `/(auth)/*` injoignable).
- [ ] `tsc --noEmit` et `eslint` passent sans erreur.
- [ ] Le parcours E2E Maestro « onboarding → session → fin » passe sur émulateur Android.
