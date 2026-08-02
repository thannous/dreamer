# Audit complet — Écran Statistiques (mobile)

**Date :** 2026-08-01
**Périmètre :** `app/(tabs)/statistics.tsx` (1 970 lignes) + `hooks/useDreamStatistics.ts`, `lib/dreamProfile.ts`, `lib/dreamStatsInsight.ts`
**Axes :** utilité, usage, UX, UI, gratuit vs payant
**Méthode :** lecture du code + inspection en conditions réelles (build web Expo en `EXPO_PUBLIC_MOCK_MODE`, 390 × 844, thème sombre, FR), sur les trois états : invité sans rêve, compte gratuit avec 8 rêves, compte Noctalia Plus avec 8 rêves.

> Réserve de méthode : l'observation dynamique a été faite sur le **build web** du même code React Native. Les constats de logique, d'i18n et de données sont indépendants de la plateforme. Les deux points marqués **[web ?]** doivent être reconfirmés sur device avant correction.

---

## 1. Résumé exécutif

L'écran contient de bonnes briques (profil onirique, next best action, séries) mais souffre de trois problèmes structurels et d'une série de bugs visibles.

**Verdict par axe**

| Axe | Note | Constat principal |
|---|---|---|
| Utilité | 🟠 Moyenne | Beaucoup de compteurs d'activité, peu d'insight sur le contenu des rêves |
| Usage | 🔴 Faible | Zéro instrumentation analytique : l'usage réel de la page est inconnu |
| UX | 🟠 Moyenne | Deux CTA « prochaine action » contradictoires, état vide muet, filtre période partiellement appliqué |
| UI | 🔴 À corriger | Trou du donut blanc en thème sombre, légende non traduite, pluriels cassés |
| Gratuit vs payant | 🔴 Critique | Le paywall verrouille des données déjà visibles gratuitement 2 sections plus bas |

**Les 5 points à traiter en priorité**

1. **Le paywall du Profil onirique ne verrouille presque rien.** Sur 4 signaux payants, 2 (« Type dominant », « Thème ») sont déjà lisibles gratuitement dans le camembert et dans « Thèmes populaires », et les 2 autres (« Fragment », « Période ») affichent « À découvrir » pour tout utilisateur qui n'est pas passé par le parcours « rêve dont je me souviens ». Un abonné Plus type paie donc pour deux valeurs qu'il avait déjà et deux cases vides — constaté en live (§7.1).
2. **Bug visuel bloquant : le centre du donut est blanc en thème sombre**, et le total y est écrit en blanc dessus → chiffre quasi illisible. `PieChart` ne reçoit ni `innerCircleColor` ni `backgroundColor`, la lib retombe sur `'white'` en dur (§6.1).
3. **La légende du camembert affiche les types en anglais brut** (« Symbolic Dream (5 Rêves) ») alors que les étiquettes du même graphe, 300 px plus haut, sont traduites (« Rêve symbolique 5 · 63 % ») (§6.2).
4. **Deux cartes voisines donnent deux « prochaines actions » différentes** : « Profil onirique → Ajoute un rêve » et « Prochaine meilleure action → Terminer les analyses en attente ». Sur un profil marqué « Vivant » avec 8 rêves, la première conseille l'action de débutant (§5.2).
5. **Le filtre de période n'est appliqué qu'à la moitié de la page** : `useDreamStatistics(periodDreams)` mais `buildDreamProfile(dreams)`. En « 7 jours », le Profil onirique reste calculé sur tout l'historique, sans que rien ne le signale (§5.3).

---

## 2. Cartographie de la page

Ordre de rendu réel (mobile, utilisateur gratuit avec des rêves) :

| # | Bloc | Source | Différé ? |
|---|---|---|---|
| 0 | Header `Noctalia / Statistiques` + 2 icônes (période, partage) | `NoctaliaScreenHeader` | non |
| 1 | **Aperçu** — total, favoris, cette semaine, ce mois-ci | `useDreamStatistics` | non |
| 2 | **Profil onirique** — readiness, CTA, 4 métriques, 4 signaux (payants) | `buildDreamProfile` | non |
| 3 | **Prochaine meilleure action** — titre/corps/CTA + 3 jauges | `getDreamStatsInsight` | non |
| 4 | **Séries** — série actuelle, plus longue, moyenne/semaine | `useDreamStatistics` | non |
| 5 | **Types de rêves** — donut + légende | idem | oui (`InteractionManager`) |
| 6 | **Thèmes populaires** — top 5 classé + barres | idem | oui |
| 7 | **Engagement** — discussions, rêves avec discussion, rêves analysés, rêve le plus discuté | idem | oui |

Hauteur mesurée : **3 694 px de contenu pour 751 px de viewport**, soit ≈ 5 écrans de défilement pour 8 rêves (davantage en gratuit, le bloc Plus preview ajoutant ~500 px).

---

## 3. Utilité — que dit réellement cette page ?

### 3.1 Le déséquilibre : on mesure l'usage de l'app, pas les rêves

Sur les 17 valeurs affichées, **14 mesurent l'activité de l'utilisateur dans l'app** (combien de rêves, combien analysés, combien de discussions, séries) et **3 seulement disent quelque chose sur le contenu de ses rêves** (répartition des types, top thèmes, thème dominant).

Or la promesse produit — reprise mot pour mot dans l'onboarding : « Noctalia repère des émotions, des lieux et des motifs » — est une promesse de **contenu**. La page Statistiques est le seul endroit qui pourrait tenir cette promesse à l'échelle du journal, et elle la tient à peine.

Absents alors que la donnée existe déjà en base (`DreamAnalysis`) :
- évolution d'un thème dans le temps (le thème « noir » recule-t-il ?) ;
- symboles / mots récurrents entre rêves ;
- corrélation jour de la semaine ↔ type de rêve ;
- rêves récurrents rapprochés entre eux.

### 3.2 Redondance : la même information 2 à 3 fois

| Donnée | Affichée dans |
|---|---|
| Nombre total de rêves | Aperçu (« Total des rêves ») **+** centre du donut |
| Rêves analysés | Profil onirique (implicite) **+** jauge « Analyse 63 % » **+** Engagement (« Rêves analysés 5 ») |
| Rêves explorés | Profil (« Explorés 1 ») **+** jauge « Exploration 13 % » **+** Engagement (« Rêves avec discussion 1 ») |
| Répartition des types | Étiquettes du donut **+** légende sous le donut (mêmes chiffres, ~300 px plus bas) |
| Type dominant | Plus grande part du donut **+** signal payant « Type dominant » |
| Thème n°1 | « Thèmes populaires » rang 1 **+** signal payant « Thème » |

La page pourrait perdre ~30 % de sa hauteur sans perdre une seule information.

### 3.3 Calculs morts

`hooks/useDreamStatistics.ts:109-126` produit `dreamsByDay` (7 entrées) et `dreamsOverTime` (boucle de 30 itérations, recalculée à chaque changement de `dreams`). **Aucun des deux n'est rendu nulle part.** Les clés i18n correspondantes existent pourtant dans les 5 langues et ne sont référencées par aucun composant :

- `stats.section.dreams_by_day` — « Rêves par jour de la semaine »
- `stats.section.dreams_over_time` — « Rêves au fil du temps (30 derniers jours) »

Deux visualisations ont donc été préparées (données + traductions) puis jamais branchées. C'est à la fois du calcul inutile et, surtout, **la réponse au manque d'insight du §3.1 est déjà à moitié écrite**.

### 3.4 Métriques faibles ou trompeuses

- **« Moyenne de rêves / semaine »** : `weeksSinceFirst = max(1, floor((now - premierRêve) / 1 semaine))`. Un utilisateur qui a 3 rêves depuis 5 jours voit « 3,0 / semaine ». Le plancher à 1 semaine gonfle systématiquement les nouveaux comptes.
- **« Cette semaine » / « Ce mois-ci » sous filtre** : ces deux cartes sont recalculées **à l'intérieur** de l'ensemble déjà filtré. En « 7 jours », on obtient donc Total = 4, Cette semaine = 4, Ce mois-ci = 4 — trois cartes identiques, dont une logiquement impossible (constaté en live).
- **« Série la plus longue » sous filtre** : plafonnée à la fenêtre. En « 7 jours » elle ne peut pas dépasser 7. Un record all-time devrait rester all-time.
- **« Thèmes populaires » en cas d'égalité** : avec 4 thèmes à 1 rêve chacun, l'écran affiche un classement 1-2-3-4 et **quatre barres pleines à 100 %** (constaté en live). Le classement est du bruit, la barre n'apporte rien.

---

## 4. Usage — on ne sait pas si cette page sert

`grep` sur l'écran : **aucun appel à `analytics.track`**. Aucun événement n'est émis pour :

- l'affichage de l'écran ;
- le clic sur « Débloquer la profondeur du profil » → paywall ;
- le clic sur les CTA « Profil onirique » et « Prochaine meilleure action » ;
- l'ouverture du sélecteur de période / le choix d'une période ;
- le partage (succès ou échec).

Conséquences directes :
- impossible de savoir si l'onglet Stats est visité, et par qui ;
- **le paywall de cette page est totalement non attribué** — voir aussi §7.3 ;
- impossible d'arbitrer les priorités de ce backlog avec des données.

C'est le seul point de l'audit qui bloque tous les autres : sans instrumentation, chaque décision ci-dessous reste une hypothèse.

---

## 5. UX

### 5.1 État vide : une page blanche avec un bouton

`statistics.tsx:1007-1027`. Quand l'utilisateur n'a aucun rêve, l'écran affiche **uniquement un bouton « Ajoute un rêve » flottant au centre du vide**. Pas de titre, pas d'explication, pas d'illustration, aucune indication de ce que la page contiendra.

La chaîne existe pourtant depuis longtemps et n'est référencée nulle part :

```
'stats.empty': 'Encore aucun rêve.\nCommencez à enregistrer pour voir vos statistiques !'
```
(`lib/i18n/fr.ts:955`, idem en/es/de/it)

Aggravant : dans cet état, **les deux actions du header restent actives**. On peut ouvrir le sélecteur de période sur une page vide, et surtout **partager** — le message généré est alors « Rêves : 0, Favoris : 0, Série actuelle : 0 jours ».

### 5.2 Deux « prochaines actions » qui se contredisent

Constaté en live sur un compte à 8 rêves, profil marqué **« Vivant »** :

| Carte | Pastille | CTA |
|---|---|---|
| Profil onirique | ✅ Vivant | **« Ajoute un rêve »** → `/recording?intent=remembered` |
| Prochaine meilleure action | — | **« Ouvrir le journal »** (« Terminer les analyses en attente ») |

Deux cartes adjacentes, deux verdicts différents, et le premier est l'action de débutant. La cause est dans `lib/dreamProfile.ts:82` :

```ts
if (params.totalDreams === 0 || params.profileSeedDreams === 0) {
  return 'add_anchor';
}
```

`profileSeedDreams` ne compte que les rêves marqués « repère » ou « souvenir » — c'est-à-dire uniquement ceux passés par le parcours « rêve dont je me souviens ». **Un utilisateur qui note ses rêves normalement toutes les nuits aura toujours `profileSeedDreams === 0`**, donc toujours `add_anchor`, quel que soit son volume. La readiness (`getReadiness`, ligne 70) est calculée sur `totalDreams` et dit « Vivant » ; le nextAction est calculé sur les seeds et dit « commence ». Les deux ne peuvent pas être d'accord.

Recommandation : soit un seul bloc « prochaine action » pour toute la page, soit deux rôles distincts et clairement libellés (état du profil ≠ action recommandée), et corriger la règle `add_anchor` pour qu'elle ne s'applique qu'aux journaux réellement vides.

### 5.3 Le filtre de période n'est appliqué qu'à la moitié de la page

```ts
const periodDreams = useMemo(() => filterDreamsByStatsPeriod(dreams, selectedStatsPeriod), …); // :737
const stats = useDreamStatistics(periodDreams);                                               // :741
const dreamProfile = useMemo(() => buildDreamProfile(dreams), [dreams]);                      // :750  ← non filtré
```

Vérifié en live : en passant de « Tout » à « 7 jours », l'Aperçu passe de 8 à 4 rêves **tandis que le Profil onirique reste strictement identique**. L'utilisateur voit une page où une moitié parle des 7 derniers jours et l'autre de tout l'historique, sans aucune indication.

### 5.4 Aucun rappel de la période active dans le corps de page

Le seul indice qu'un filtre est actif est **la pastille du bouton calendrier dans le header** (`active: selectedStatsPeriod !== 'all'`). Aucun titre de section, aucune puce, aucun sous-titre ne rappelle « 7 jours ». Un utilisateur qui revient sur l'onglet, ou qui a fait défiler, lit « Total des rêves : 4 » sans savoir pourquoi.

À noter : le choix de période **n'est pas persisté** (état local `useState`), il retombe sur « Tout » à chaque remontage — comportement défendable, mais alors le filtre ne sert qu'à une consultation ponctuelle.

### 5.5 État cassé : période sans aucun rêve

`statistics.tsx:989` teste `dreams.length === 0` pour l'état vide, mais les sections différées sont conditionnées par `hasStatisticsContent = loaded && periodDreams.length > 0` (`:798`). Si l'utilisateur sélectionne « 7 jours » sans rêve récent, il obtient :

- Aperçu : **0 partout** ;
- Profil onirique : **des chiffres non nuls** (calculé sur tout l'historique, cf. §5.3) ;
- Prochaine meilleure action : `totalDreams === 0` ⇒ `kind = 'record'` ⇒ **« Créer ton premier signal / Enregistrer un rêve »**, affiché à un utilisateur qui a 50 rêves ;
- Séries : 0 ;
- Types / Thèmes / Engagement : **absents sans explication**.

Aucun message du type « Aucun rêve sur cette période ».

### 5.6 Le rêve le plus discuté est un cul-de-sac

`statistics.tsx:1382-1400` : le bloc « Rêve le plus discuté » affiche le titre du rêve et son nombre de messages dans une `View` — **non tappable**. C'est le seul endroit de la page qui pointe vers un rêve précis, et il ne mène nulle part. Un `Pressable` vers `/journal/[id]` est une ligne de code.

### 5.7 Perception au chargement

Les cartes montent avec une animation d'opacité échelonnée : délais 150 / 220 / 260 / 300 / 450 / 600 / 750 ms, durée 650 ms. La dernière section n'est donc pleinement visible qu'à **≈ 1,4 s**. À l'arrivée sur l'onglet, la capture prise immédiatement montre **une page visuellement vide** (le contenu est bien monté, mais à opacité quasi nulle). S'y ajoute `InteractionManager.runAfterInteractions` pour les 3 sections différées.

Sur un onglet où l'utilisateur arrive par un tap et s'attend à des chiffres, cet effet coûte plus qu'il ne rapporte. Réduire les délais (ou ne les appliquer qu'au premier affichage de session) rendrait la page instantanée.

### 5.8 Découvrabilité des actions du header

Deux icônes nues (calendrier, partage), sans libellé ni menu. Rien n'indique que le calendrier = filtre de période. Les `accessibilityLabel` sont corrects (« Choisir une période », « Partager les statistiques ») mais invisibles pour un utilisateur voyant.

---

## 6. UI

### 6.1 🔴 Le trou du donut est blanc en thème sombre — et le total est écrit dessus

**Constaté visuellement.** Le camembert est rendu en donut, son disque central apparaît **blanc opaque**, et le total (« 8 ») y est écrit avec `noctalia.text.primary` — soit du **quasi-blanc en thème sombre**. Le chiffre le plus important du graphe est illisible.

Cause, `statistics.tsx:1163-1182` : `PieChart` reçoit `donut`, `radius`, `innerRadius`, `strokeColor` — mais **ni `innerCircleColor` ni `backgroundColor`**. La librairie retombe alors sur une valeur en dur :

```js
// node_modules/gifted-charts-core/dist/PieChart/index.js:85
var innerCircleColor = props.innerCircleColor ?? props.backgroundColor ?? 'white';
```

Correction : passer `innerCircleColor={noctalia.screen.background}` (ou `surface.raised`). Bug indépendant de la plateforme.

### 6.2 🔴 La légende affiche les types en anglais brut

`statistics.tsx:1285` :

```tsx
{item.type} ({t('stats.legend.count', { count: formatNumber(item.count) })})
```

`item.type` est la valeur brute de `DreamType` (`'Symbolic Dream'`, `'Nightmare'`, `'Lucid Dream'`, `'Recurring Dream'`). Rendu observé en français :

> ⬛ Symbolic Dream (5 Rêves) — ⬛ Nightmare (1 Rêves) — ⬛ Lucid Dream (1 Rêves) — ⬛ Recurring Dream (1 Rêves)

…alors que les étiquettes du **même graphe**, juste au-dessus, utilisent `getDreamTypeLabel(item.type, t)` et affichent correctement « Rêve symbolique », « Cauchemar », « Rêve lucide », « Rêve récurrent ». Le helper est déjà importé dans le fichier (`:42`). Défaut visible sur les 5 langues.

**Cas connexe** : `useDreamStatistics.ts:87` remplace un `dreamType` absent par la chaîne littérale `'Unknown'`, et `lib/dreamLabels.ts` n'a pas de clé pour cette valeur. Un journal contenant des rêves non analysés affichera donc une part « Unknown », non traduite, dans toutes les langues.

### 6.3 🔴 Pluriels cassés

Les deux chaînes concernées n'ont pas de forme singulière, dans aucune langue :

- `stats.legend.count` = `'{count} rêves'` (`lib/i18n/fr.ts:1018`) → **« 1 rêves »**, observé 3 fois dans la légende et 1 fois dans « Thèmes populaires »
- `stats.engagement.messages` = `'{count} messages'` (`:1045`) → **« 1 messages »**, observé sous « Rêve le plus discuté »

Le fichier gère pourtant déjà le cas ailleurs — `stats.card.day` / `stats.card.days` sont sélectionnés à la main dans le composant (`:1128`). Il manque simplement le même traitement ici, ou une clé `_one` / `_other`.

### 6.4 🟠 `textTransform: 'capitalize'` casse la casse française

Trois styles appliquent `capitalize`, qui en RN met **une majuscule à chaque mot** :

| Style | Ligne | Chaîne source | Rendu observé |
|---|---|---|---|
| `themeText` | `:1858` | « Mystique (spirituel, mystérieux) » | **« Mystique (Spirituel, Mystérieux) »** |
| `legendText` | `:1827` | « … rêves » | « … Rêves » |
| `profileSignalValue` | `:1723` | « Rêve symbolique », « À découvrir » | **« Rêve Symbolique »**, **« À Découvrir »** |

Les chaînes i18n sont déjà correctement capitalisées à la source : le `textTransform` ne sert à rien et dégrade le rendu dans les 5 langues. À supprimer.

### 6.5 🟠 Densité et rythme vertical

- **Premier écran = 4 chiffres.** La carte « Aperçu » occupe la totalité du viewport initial pour 4 valeurs, avec des chiffres à 36 px et beaucoup de blanc. L'écran Statistiques ne montre aucune statistique de contenu avant le 3ᵉ défilement.
- **Trou d'environ 250 px** entre le donut et sa légende : le conteneur du graphe est dimensionné sur la hauteur maximale d'étiquette (`PIE_LABEL_HEIGHT` = 3 lignes) même quand aucune étiquette ne fait 3 lignes.
- **Chevauchement des étiquettes** : à 390 px, les cartouches de gauche (« Rêve lucide », « Cauchemar ») touchent le bord du donut. L'algorithme de placement (`getPieMetrics`, `distributeLabelsOnSide`, ~140 lignes) atteint sa limite sur petit écran.
- **Libellés qui passent à 2 lignes** (« TOTAL DES DISCUSSIONS », « SÉRIE LA PLUS LONGUE ») déséquilibrent la hauteur des `StatCard` d'une même rangée.
- **Barres de « Thèmes populaires » inutiles** : normalisées sur `maxThemeCount`, elles sont toutes à 100 % dès qu'il y a égalité — cas fréquent sur un petit journal.

### 6.6 🟠 Accessibilité

| Élément | État |
|---|---|
| `StatCard` | ✅ `accessibilityLabel` « titre : valeur » |
| Boutons du header | ✅ label + `hitSlop` |
| CTA (profil, insight, upgrade, période) | ✅ `accessibilityRole="button"` + label |
| **Camembert** | ❌ Aucune alternative textuelle. Tout le SVG (parts, étiquettes, connecteurs) est invisible pour un lecteur d'écran. La légende, seule alternative, est en anglais (§6.2) |
| **Jauges « Analyse / Exploration / Objectif série »** | ❌ Pas de `accessibilityRole="progressbar"` ni de `accessibilityValue` |
| **Barres de thèmes** | ❌ Aucun rôle ni valeur |
| **Contraste du total du donut** | ❌ Blanc sur blanc (§6.1) |

### 6.7 Points spécifiques web / desktop — hors périmètre mobile strict

- **[web ?]** Le sélecteur de période s'affiche **sur environ 43 % de la largeur**, collé à gauche, au lieu d'une feuille pleine largeur. `BottomSheet` calcule une largeur fixe (`getNativeBottomSheetContentWidth`, `components/ui/BottomSheet.tsx:37`) qui donnerait 358 px à 390 px de viewport — l'écart observé semble donc spécifique au rendu web. **À reconfirmer sur device.**
- **Desktop web** (`width >= DESKTOP_BREAKPOINT`) : `statistics.tsx:913-917` bascule sur `PageHeader`, qui **n'accepte pas de prop `actions`**. Le filtre de période et le partage sont donc purement et simplement absents en desktop web. Le code du `statsHeaderActions` est calculé puis jeté.

---

## 7. Gratuit vs payant

### 7.1 🔴 Le gate verrouille des données déjà gratuites

C'est le point le plus important de l'audit. Le **seul** contenu payant de la page est le bloc des 4 signaux du Profil onirique (`statistics.tsx:637-717`, `canShowPremiumSignals = isPlusActive`).

Comparaison mesurée **sur le même jeu de 8 rêves**, compte gratuit puis compte Plus :

| Signal verrouillé | Valeur révélée en Plus | Déjà disponible gratuitement ? |
|---|---|---|
| Type dominant | « Rêve symbolique » | **Oui** — plus grande part du donut, étiquetée « Rêve symbolique 5 · 63 % », 2 sections plus bas |
| Thème | « Calme (doux, rassurant) » | **Oui** — section « Thèmes populaires », visible en entier |
| Fragment | **« À découvrir »** (vide) | — |
| Période | **« À découvrir »** (vide) | — |

L'utilisateur gratuit voit quatre cartouches identiques marquées « Insight Plus », sur ~500 px de hauteur, **avec zéro information scent** : rien ne laisse deviner ce qui se cache derrière, ni que deux des quatre valeurs sont déjà sous ses yeux.

Et l'abonné, lui, obtient : deux valeurs qu'il avait déjà, et deux cases vides.

**Pourquoi « Fragment » et « Période » sont vides.** Ces deux facettes proviennent de `dream.memory.strongestFragment` / `dream.memory.approximatePeriod` (`lib/dreamProfile.ts:135-136`), métadonnées renseignées **uniquement** par le parcours « rêve dont je me souviens ». Un utilisateur qui note ses rêves au réveil, cas d'usage principal de l'app, n'en produit jamais. Les deux seuls signaux réellement exclusifs de l'offre payante sont donc structurellement vides pour la majorité des abonnés.

**Pistes** (à arbitrer, elles ne sont pas cumulatives) :
- verrouiller de la **profondeur** plutôt que de la redite : évolution des thèmes dans le temps, symboles récurrents, corrélations — c'est-à-dire précisément les deux visualisations déjà calculées et jamais branchées (§3.3) ;
- si le gate reste sur les 4 signaux, **masquer les sections gratuites qui les dévoilent** — ce qui appauvrirait la version gratuite, donc peu recommandé ;
- rendre le teaser informatif : valeur floutée, ou « 3 motifs détectés dans tes 8 rêves », plutôt que 4 fois « Insight Plus » ;
- ne montrer le gate que lorsque le contenu payant est **non vide**, sinon promettre un plan (« encore 2 rêves-repères pour débloquer tes fragments »).

### 7.2 🟠 Le signal payant contredit la section gratuite

Sur le même jeu de données :

- section gratuite « Thèmes populaires » → **rang 1 = Mystique** (2 rêves)
- signal payant « Thème » → **Calme**

Les deux tris divergent en cas d'égalité :

```ts
// lib/dreamProfile.ts:56 — tri avec départage alphabétique
.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))

// hooks/useDreamStatistics.ts:138 — tri par compte seul (ordre d'insertion conservé)
.sort((a, b) => b.count - a.count)
```

Avec `calm`, `mystical` et `noir` à 2 rêves chacun, le profil départage alphabétiquement (`calm`) et la section gratuite garde l'ordre de rencontre (`mystical`). Les deux blocs affichent donc deux « thèmes dominants » différents sur le même écran. Un tri unique et partagé résout le point.

### 7.3 🟠 Le paywall part sans contexte

`statistics.tsx:761-763` :

```ts
const handleDreamProfileUpgradePress = useCallback(() => {
  router.push(buildPaywallHref('settings'));   // ← trigger générique
}, []);
```

Le trigger `'settings'` est réutilisé tel quel. Conséquences :
- l'utilisateur arrive sur un paywall dont le titre et les 3 arguments parlent des **réglages** et des quotas, pas des motifs oniriques qu'on vient de lui promettre — rupture de discours ;
- côté données, **impossible de distinguer les conversions venues de Stats** de celles venues des réglages ;
- `lib/paywallVariants.ts` supporte déjà un variant par trigger : ajouter un `stats_profile` est peu coûteux et adresse les deux problèmes.

Combiné à l'absence totale de tracking (§4), la performance commerciale de ce gate est aujourd'hui **entièrement invisible**.

### 7.4 Répartition gratuit / payant actuelle

| Bloc | Invité | Gratuit | Plus |
|---|---|---|---|
| Aperçu, Séries, Engagement | ✅ | ✅ | ✅ |
| Types de rêves (donut + légende) | ✅ | ✅ | ✅ |
| Thèmes populaires | ✅ | ✅ | ✅ |
| Prochaine meilleure action | ✅ | ✅ | ✅ |
| Profil onirique — readiness, CTA, 4 métriques | ✅ | ✅ | ✅ |
| Profil onirique — 4 signaux | 🔒 | 🔒 | ✅ |
| Filtre de période, partage | ✅ | ✅ | ✅ |

Aucune différence entre **invité** et **gratuit** : le gate ne récompense pas la création de compte, alors que c'est un palier clé du reste de l'app (quotas). Un palier intermédiaire — par exemple l'historique long réservé aux comptes — serait cohérent avec le modèle existant.

---

## 8. Tests

**Existant**
- `hooks/__tests__/useDreamStatistics.test.tsx` — bonne couverture du hook, y compris `dreamsByDay` / `dreamsOverTime`… qui ne sont jamais rendus (§3.3).
- `tests/app-routes/statisticsScreen.test.tsx` — 3 tests, uniquement la frontière Plus (preview verrouillé, signaux visibles, redirection paywall).

**Non couvert**
- filtre de période (application partielle §5.3, période vide §5.5) ;
- état vide et état de chargement ;
- partage (contenu du message, échec silencieux) ;
- rendu de la légende et des étiquettes du donut (aurait attrapé §6.2) ;
- cohérence entre le thème dominant du profil et « Thèmes populaires » (§7.2).

À noter : le test de la frontière Plus assert `screen.getByText('calm')` — la valeur brute, parce que le `t` du test renvoie la clé. Il ne vérifie donc pas que le libellé est traduit.

---

## 9. Backlog priorisé

### P0 — bugs visibles, correction courte

| # | Sujet | Où | § |
|---|---|---|---|
| 1 | Passer `innerCircleColor` au `PieChart` (trou blanc + total illisible en sombre) | `statistics.tsx:1163` | 6.1 |
| 2 | Traduire la légende via `getDreamTypeLabel` | `statistics.tsx:1285` | 6.2 |
| 3 | Formes singulières pour `stats.legend.count` et `stats.engagement.messages` (× 5 langues) | `lib/i18n/*.ts` | 6.3 |
| 4 | Supprimer les 3 `textTransform: 'capitalize'` | `statistics.tsx:1723,1827,1858` | 6.4 |
| 5 | Afficher `stats.empty` dans l'état vide ; désactiver partage + période quand il n'y a aucun rêve | `statistics.tsx:1007-1027` | 5.1 |
| 6 | Libellé traduit pour le type `'Unknown'` | `useDreamStatistics.ts:87` + `dreamLabels.ts` | 6.2 |

### P1 — cohérence produit

| # | Sujet | Où | § |
|---|---|---|---|
| 7 | Appliquer le filtre de période au Profil onirique, ou l'exclure explicitement et le dire | `statistics.tsx:750` | 5.3 |
| 8 | Rappeler la période active dans le corps de page (puce sous le titre) | `statistics.tsx` header/sections | 5.4 |
| 9 | État « aucun rêve sur cette période » | `statistics.tsx:798,989` | 5.5 |
| 10 | Résoudre le conflit des deux « prochaines actions » ; corriger la règle `add_anchor` | `lib/dreamProfile.ts:82` | 5.2 |
| 11 | Tri unique et partagé pour les thèmes (profil ↔ section gratuite) | `dreamProfile.ts:56` / `useDreamStatistics.ts:138` | 7.2 |
| 12 | Rendre « Rêve le plus discuté » tappable → `/journal/[id]` | `statistics.tsx:1382` | 5.6 |
| 13 | Instrumenter : vue d'écran, CTA, upgrade, période, partage | `statistics.tsx` | 4 |
| 14 | Variant de paywall `stats_profile` au lieu du trigger `'settings'` | `statistics.tsx:762`, `paywallVariants.ts` | 7.3 |

### P2 — valeur et forme

| # | Sujet | § |
|---|---|---|
| 15 | **Repenser l'offre payante** : verrouiller de la profondeur (évolution des thèmes, symboles récurrents) plutôt que des données déjà gratuites | 7.1 |
| 16 | Brancher `dreamsByDay` / `dreamsOverTime` (données + traductions déjà prêtes) — sert aussi le point 15 | 3.3 |
| 17 | Teaser Plus informatif, et masqué quand le contenu payant serait vide | 7.1 |
| 18 | Dédoublonner : légende ↔ étiquettes du donut, analysés/explorés répétés 3 fois | 3.2 |
| 19 | Réduire les délais d'animation d'entrée (≈ 1,4 s aujourd'hui) | 5.7 |
| 20 | Resserrer le rythme vertical ; supprimer le trou donut/légende ; corriger le chevauchement des étiquettes à 390 px | 6.5 |
| 21 | Accessibilité : alternative textuelle du camembert, `progressbar` sur les jauges | 6.6 |
| 22 | Revoir « Moyenne / semaine », « Cette semaine / Ce mois-ci » sous filtre, « Série la plus longue » sous filtre, classement des thèmes à égalité | 3.4 |
| 23 | Tests : période, état vide, légende traduite, cohérence des thèmes | 8 |
| 24 | Desktop web : réintroduire période + partage (`PageHeader` sans `actions`) | 6.7 |

---

## 10. Suivi — état au 2026-08-02

**Livré :** P0 1-6, P1 7-14, P2 19, 21, 23, 24, plus le masquage des cartes « Cette semaine / Ce mois-ci » sous filtre (§3.4).

Vérifications : `typecheck:app` et `typecheck:tests` propres ; suite Jest complète verte (235 suites, 2 155 tests, contre 37 tests sur le périmètre stats avant) ; lint des chemins touchés = 2 warnings, tous deux pré-existants et vérifiés dans `HEAD`.

Deux correctifs ont d'abord été livrés en no-op et rattrapés avant application : **P0-3** (les 10 chaînes `_one` créées mais le ternaire absent des 3 points d'appel) et **P1-13** (toute la tuyauterie analytics sans un seul `trackProductEvent` dans l'écran).

Une régression a été introduite par P1-7 puis corrigée : appliquer le filtre de période au profil rendait `hasAtLeastOneAnalysis` et `hasDreamProfileSeed` fenêtrés, ce qui faisait **disparaître la carte Profil, la carte Prochaine action et le seul point d'entrée du paywall** dès qu'une fenêtre ne contenait aucun rêve analysé. Résolu en séparant visibilité (journal entier) et contenu (période).

**Non livré — décisions produit, pas des correctifs :**

- **#15 — repenser ce que verrouille l'offre payante.** C'est le point n°1 de l'audit et il reste entier. Sur les 4 signaux payants, 2 sont toujours lisibles gratuitement 2 sections plus bas, et 2 restent vides pour qui ne passe pas par le parcours « rêve dont je me souviens ». Les correctifs livrés ont supprimé la *contradiction* entre gratuit et payant (§7.2) mais pas le déséquilibre de valeur (§7.1).
- **#16** brancher `dreamsByDay` / `dreamsOverTime` (données et traductions déjà prêtes) — sert directement #15.
- **#17** teaser Plus informatif · **#18** dédoublonnage de la page · **#20** rythme vertical et chevauchement des étiquettes du camembert · **#22** hors cartes semaine/mois (moyenne/semaine, série la plus longue sous filtre).

**Action requise avant livraison :** `supabase/migrations/20260801120000_product_analytics_stats_events.sql` est **écrite mais non appliquée**, et l'edge function `api/routes/analytics.ts` n'est pas redéployée. Les événements `stats_*` sont rejetés côté serveur tant que ce n'est pas fait — la migration et le déploiement doivent précéder tout build embarquant cette instrumentation.

**Dette signalée hors périmètre :** `symbol_detail_viewed` accepte `source: 'guide'` côté client (`lib/productAnalytics.ts:142`) mais pas côté serveur (`supabase/functions/api/routes/analytics.ts:123`) — dérive pré-existante, ces événements sont silencieusement perdus.

---

## 11. Phase 1 — profondeur payante (2026-08-02)

Adresse partiellement **#15** (repenser ce que verrouille l'offre) et **#16** (brancher les données calculées mais jamais affichées).

**Décidé par la mesure, pas par intuition.** Un spike a mesuré que les **symboles** ne se concentrent pas : 121 symboles sur 30 rêves → 29 symboles distincts pour 33 mentions rattachées (ratio 1,14). Une section « symboles récurrents » serait restée vide sous ~50 rêves. Les symboles sont donc **hors phase 1** — ils exigent d'abord que le schéma d'analyse renvoie un identifiant canonique. Les **émotions** souffrent du même mal brut (ratio 1,20 fr / 1,04 en) mais un lexique de 12 familles les concentre à **4,92**, et `theme` est une énumération à 4 valeurs, concentrée par construction.

**Livré :**

| Section | Accès | Source |
|---|---|---|
| Rythme (barres, jour de la semaine) | Gratuit | `dreamsByDay`, calculé depuis toujours et jamais affiché (#16) |
| Émotions dominantes | Plus | `lib/dreamEmotions.ts` — 12 familles canoniques × 5 langues |
| Thèmes au fil du temps (courbes) | Plus | Nouvelle agrégation thème × jour |

**Le changement qui compte** : l'état verrouillé montre désormais **le compte réel et masque le détail** (« 6 émotions reviennent dans ton journal ») au lieu de quatre cartouches « Insight Plus » identiques. Vérifié en conditions réelles : la promesse verrouillée annonce 6, l'état débloqué en livre exactement 6.

**Défauts trouvés par la review et corrigés :** la période « 7 jours » plafonne l'étendue à 7 alors que le seuil de S3 était de 14 — la section était **définitivement insatisfaisable** sous ce filtre ; le fragment `joy*` était silencieusement inerte (clé de bucket sur 4 caractères, stem de 3) ; S2 pouvait annoncer « 0 émotions reviennent » quand rien ne matchait le lexique.

**Non traité, volontairement :** les 4 signaux existants du Profil onirique restent la boussole gratuite ; le dédoublonnage de la page (#18), le rythme vertical (#20) et la sémantique des métriques (#22) restent ouverts.

**Note pour la suite :** `symbols` et `emotions` sont absents des rêves analysés **avant** l'arrivée de ces champs. Pour un utilisateur ancien, la section Émotions sera plus maigre que son journal ne le laisse penser.
