# Fluidité Dreamer — avant/après du 19 octobre 2026

## Résultat et périmètre

Demande du propriétaire : améliorer la fluidité de Noctalia Dreamer en gardant
toutes les fonctionnalités et en dégradant le moins possible le visuel, avec un
rapport avant/après. Branche `claude/practical-meitner-yly1ex`, partie de
`baa393b6` puis fusionnée avec `origin/master` `ce62eb94` (aucun fichier commun).
Comparaison finale : **avant = `ce62eb94`** (`origin/master`), **après = `8067f00a`**,
seul le diff de cette branche les sépare. `origin/master` `b6e5dd19` (onboarding,
site, outillage backend et E2E) puis `59cf23c0` ont ensuite été fusionnés sans
conflit. Le second recoupe quatre fichiers de cette branche : refonte de l'Accueil
(#467) et peintures qui se posent une fois au lieu de respirer sans fin (#464).
L'Accueil fusionné garde les lectures hors composant, le store de défilement et
`HeaderScrollView`, et reste compilé par React Compiler. Ces mesures restent celles
de `8067f00a` ; elles ne qualifient pas la nouvelle page d'Accueil. Aucune animation, durée, image, parallaxe
ou cible tactile n'est retirée. Aucun build EAS, déploiement, publication Store ni
mesure sur appareil dans cette tranche.

| Parcours web mesuré (médiane de 5, CPU ×4) | Avant | Après | Écart | Plages par essai avant / après |
| --- | ---: | ---: | ---: | --- |
| 5 changements d'onglet — temps de script | 1 073 ms | 757 ms | **−29 %** | 988–1 133 / 720–768 |
| 5 changements d'onglet — tâches longues cumulées | 901 ms | 413 ms | **−54 %** | — |
| 3 ouvertures d'un rêve + retour — temps de script | 6 881 ms | 5 227 ms | **−24 %** | 6 658–7 850 / 4 935–5 553 |
| 3 ouvertures + retour — P95 des intervalles de frame | 233 ms | 133 ms | −43 % | — |
| Dictionnaire, 5 lettres touchées — temps de script | 1 484 ms | 1 159 ms | **−22 %** | 1 427–1 600 / 1 023–1 383 |

Les plages ne se recouvrent pas sur ces trois parcours, et trois campagnes
antérieures (base `baa393b6` contre les commits intermédiaires) donnaient le même
sens : onglets −28 à −34 %, rêve −18 à −23 %, dictionnaire −24 à −28 %.

Les rapports [natifs du 18](native-performance-20261018.md), [de préparation iOS](ios-framerate-20261019.md)
et [de disponibilité des données](readiness-performance-20261019.md) traitaient
déjà le retour au journal, la mémoire du papier, le scroll du détail et les
attentes de la lecture. Cette tranche vise ce qu'ils laissaient : le travail
JavaScript déclenché par chaque **navigation**, chaque **début/fin de geste de
défilement** et chaque **frame de défilement** des écrans à en-tête peint.

## Causes trouvées

Attribution des rendus React (build de production non minifié, mock Plus, CPU non
bridé, premier de deux essais identiques) : nombre de rendus effectifs par composant.

| Composant | 5 changements d'onglet, avant → après | 3 ouvertures + retour, avant → après |
| --- | ---: | ---: |
| Tous composants confondus | 3 750 → 1 445 (−61 %) | 15 681 → 8 315 (−47 %) |
| `JournalRuntime` / `DreamsProvider` | 5 → 0 | 6 → 0 |
| Écrans Tendances / Explorer (cachés) | 5 / 5 → 0 / 0 | 6 / 6 → 3 / 3 |
| Écran Journal | 7 → 2 | 18 → 9 |
| En-têtes peints (`NoctaliaScreenHeader`) | 22 → 0 | 54 → 24 |
| Feuilles du tiroir et du Journal (`BottomSheet`) | 24 → 0 | 48 → 0 |
| Cartes du Journal (`DreamCard`) | 0 → 0 | 48 → 0 |
| Contenu du tiroir de réglages | 5 → 0 | 6 → 0 |
| `View` / `Text` | 525 / 136 → 70 / 0 | 2 892 / 804 → 1 470 / 186 |

`RootLayoutNav`, `TabLayout` et les hôtes abonnés à la route (indicateur d'analyse,
Speed Insights) se rendent toujours à chaque navigation : c'est leur rôle.

1. **Chaque changement de route reconstruisait tout l'arbre.** `RootLayoutNav`
   lit `usePathname`/`useGlobalSearchParams` et n'est pas compilable par React
   Compiler (`try/finally`, `import()`, conditions dans des `try`). Son JSX —
   fournisseurs, `DreamsProvider`, tiroir de réglages, navigateurs — était recréé
   à chaque navigation et faisait re-rendre les onglets montés, leurs en-têtes
   peints et les hôtes globaux.
2. **La valeur du contexte des réglages rapides changeait à chaque route** : `show`
   dépendait de `pathname` ; Accueil, Journal, Tendances, Explorer et Capture
   se re-rendaient.
3. **React Compiler ignorait des composants fréquents** : l'Accueil (`try/catch`
   contenant une condition), la liste du Journal (deux `eslint-disable
   exhaustive-deps`), le contenu du tiroir (chaîne optionnelle suivie de `||`) et
   `DreamCard` (lecture `objet.frame` prise pour un accès à une ref).
4. **L'état « en cours de défilement » vivait dans l'écran** (Accueil, Rituel,
   Guides, Guide, Catégories, Symbole, Chat) : chaque début et fin de geste
   re-rendait l'écran entier, au moment où le doigt commence à bouger.
5. **Douze écrans pilotaient leur en-tête animé depuis le thread JS** : chaque
   événement de défilement (16 ms) traversait vers JavaScript pour écrire la
   valeur partagée lue par le fondu, l'étirement, la parallaxe et le voile.
6. **Le dictionnaire triait 240 symboles avec `localeCompare(…, options)`**, qui
   construit un collator et normalise les deux noms à chaque comparaison, et
   refaisait ce tri à chaque lettre touchée.
7. **Sur le web, une page masquée derrière une autre route mesure ses vues à zéro**
   puis à leur taille au retour : chaque carte du Journal et l'en-tête de
   recherche se rendaient deux fois de plus à chaque visite d'un rêve.

## Corrections

| Correction | Fichiers | Effet attendu | Visuel |
| --- | --- | --- | --- |
| Arbre racine extrait dans `RootNavigator` (`memo`, deux props primitives : thème, démarrage non critique), compilé | `app/_layout.tsx` | Une navigation ne re-rend plus les onglets cachés, leurs en-têtes ni les fournisseurs | Identique |
| `show` stable (route lue à l'ouverture via une ref mise à jour en layout effect) ; nom de profil calculé hors du composant | `components/settings/QuickSettingsProvider.tsx` | Les écrans qui offrent le tiroir ne se re-rendent plus à chaque route ; contenu du tiroir compilé | Identique |
| Accueil et Journal compilables : lectures de stockage hors composant, lien de filtres appliqué pendant le rendu (motif React « ajuster l'état »), retour en haut via `useEffectEvent` | `app/(tabs)/index.tsx`, `app/(tabs)/journal.tsx` | Mémoïsation automatique ; un lien de filtres ne rend plus d'abord l'ancienne liste | Identique |
| `DreamCard` compilable (retour de `useFrameParallax` déstructuré) ; mesures de taille nulle ignorées pour la carte et l'en-tête de recherche | `components/journal/DreamCard.tsx`, `app/(tabs)/journal.tsx` | Plus de double rendu des cartes ni de relayout de la liste autour d'une visite | Identique |
| État de défilement dans un store externe (`useSyncExternalStore`) ; seuls ses lecteurs (cartes vitrées, compositeur du chat) se re-rendent | `context/ScrollPerfContext.tsx`, `hooks/useScrollIdle.ts`, 7 écrans | Plus de re-rendu de l'écran au début/fin d'un geste | Identique : flou et ombres coupés pendant le geste comme avant |
| `useHeaderScroll` : gestionnaire Reanimated sur le thread UI en natif (`HeaderScrollView`/`HeaderFlatList`), gestionnaire JS conservé sur web comme le Journal et la page du rêve | `components/ui/headerStretch.ts`, 12 écrans | Aucun événement JS par frame de défilement ; l'en-tête suit même si JS est occupé | Identique |
| Tendances : la recherche des sections à révéler n'appelle JS que tant qu'une section reste éteinte | `app/(tabs)/statistics.tsx` | Plus d'appel `measureInWindow` par frame une fois tout révélé | Identique |
| Dictionnaire : clés normalisées une fois, un seul `Intl.Collator`, tri indépendant de la lettre | `app/symbol-dictionary.tsx` | Tri ≈ 44× plus rapide, plus de tri par lettre touchée | Ordre identique (vérifié) |

React Compiler compile désormais `RootNavigator`, `InspirationScreen` (Accueil),
`JournalListScreen`, `DreamCard` et `QuickSettingsContent`, sans en perdre un seul
parmi ceux qu'il compilait déjà : relevé du plugin `babel-plugin-react-compiler`
1.0.0 (journal d'événements `CompileSuccess`/`CompileError`) sur chaque fichier
modifié, avant/après.

## Défaut web préexistant trouvé et corrigé

Le banc vérifie le texte saisi : après une visite d'un rêve, la recherche du
Journal ne recevait que « f ». Cause : `react-native-web` ferme le clavier (blur du
champ) à **chaque** événement de défilement quand `keyboardDismissMode="on-drag"`,
y compris le retour en haut animé que déclenche chaque lettre. Le défaut existe sur
la base dès que la liste n'est pas en haut : build de production `baa393b6`, liste
défilée puis saisie, blur dès la première lettre. En conservant la mesure réelle de
la page masquée, la correction 7 le rendait plus fréquent.

Correction, web seulement : `keyboardDismissMode="none"` ; la liste ferme le clavier
quand elle défile dans les 150 ms d'une molette ou d'un toucher de l'utilisateur, et
la frappe annule cette fenêtre. Le natif garde `on-drag`. La revue indépendante a
fait abandonner une première version qui fermait aussi sur un glisser des puces de
filtres ou une molette au-dessus d'une liste immobile.

Parcours TesterArmy ajouté à `dreamer-journeys` : liste défilée, saisie lettre par
lettre de « The Infinite Library » (valeur exacte, focus conservé, un résultat),
molette latérale qui ne déplace pas la liste (position identique après 400 ms,
focus conservé), puis défilement réel par l'utilisateur (clavier fermé). Il échoue
sans la correction (le champ ne contient que « T ») et avec la première version
trop large (focus perdu sur la molette latérale) ; il passe 3/3 avec la correction.

## Mesures

### Banc web reproductible

`scripts/perf/measure-web-fluidity.mjs` sert deux exports web de production en mode
mock (profil Plus, 390×844, Chromium 141, CPU bridé ×4), ignore toute requête
externe et rejoue le même parcours cinq fois par build. Chaque fenêtre relève les
commits React (hook DevTools), le temps de script et de tâches (CDP), les tâches
longues et les intervalles `requestAnimationFrame`. Il échoue si la saisie de
recherche n'atteint pas entièrement le champ.

| Fenêtre (médiane de 5) | Script avant → après | Plages avant / après | Tâches longues | Verdict |
| --- | --- | --- | --- | --- |
| 5 changements d'onglet | 1 073 → 757 ms (−29 %) | 988–1 133 / 720–768 | 901 → 413 ms | Gain |
| 3 ouvertures d'un rêve + retour | 6 881 → 5 227 ms (−24 %) | 6 658–7 850 / 4 935–5 553 | 7 315 → 5 497 ms | Gain |
| Dictionnaire, 5 lettres | 1 484 → 1 159 ms (−22 %) | 1 427–1 600 / 1 023–1 383 | 1 238 → 856 ms | Gain |
| Recherche « forest » dans le Journal | 1 576 → 1 461 ms (−7 %) | 1 375–1 845 / 1 134–1 614 | 1 215 → 1 083 ms | Indéterminé |
| Défilement Accueil / Journal / Tendances / Explorer / Guides / Rituel | ±11 % | Recouvrement | — | Indéterminé |

Les rendus de composants de la recherche passent de 4 787 à 2 314 en moyenne
(−52 %), sans gain de temps attribuable. Sur le web, les gestionnaires de
défilement sont inchangés (le chemin UI ne vaut que pour le natif) : l'absence de
différence est attendue. Le nombre de commits peut augmenter quand le temps baisse
(40 → 62 sur les onglets) : chaque commit est plus petit ; ce n'est pas une mesure
de coût. Le P95 des intervalles `requestAnimationFrame` d'un navigateur sans écran
n'est pas une mesure de pixels présentés.

### Tri du dictionnaire

Même comparateur avant/après sur `data/app/dream-symbols.json` (240 symboles, six
langues), 30 répétitions, Node 24.19.0 (V8) : **12,2 → 0,28 ms par tri**, ordre
identique pour les six langues. Hermes, plus coûteux sur `Intl`, n'est pas mesuré.

## Validation

- `typecheck:app`, typecheck des tests TesterArmy et lint : aucun nouvel
  avertissement ; l'empreinte de l'avertissement résolu du Journal (effet du lien
  de filtres) quitte la base par `lint:warnings -- --prune`.
- Jest : les 23 suites liées aux fichiers modifiés (434 tests) passent, puis les
  18 suites liées aux derniers changements du Journal (366 tests).
- TesterArmy web Dreamer, 131 tests dont 45 réservés à des options non activées.
  Dernière suite complète sur le code applicatif final (2 workers) : 81 passent.
  Quatre échecs `ENGINE_FAILURE: dialog handler failed … No dialog is showing`
  viennent du moteur : Chromium 141 local attaché par CDP, faute de pouvoir installer
  ici le Chromium épinglé ; la base `baa393b6` rejouée dans les mêmes conditions
  échoue de la même façon (3 sur 5, d'autres tests passant). Relancés sur `8067f00`
  avec un worker, ces parcours et ceux qui avaient échoué ainsi plus tôt (chat par
  catégorie, symboles personnels, analyse invitée, constellation, illustration)
  passent tous, avec le nouveau parcours de recherche : **6/6**. Ce dernier échoue
  sans sa correction. Le cinquième échec est traité au point suivant. Après fusion de
  `59cf23c0` (tête `58fa719a`) : 82 passent, les quatre seuls échecs sont cette même
  erreur moteur et passent **4/4** en relance avec un worker.
- `dreamer-journal-margin` (« failed illustration leaves a compact readable entry »)
  échouait une fois sur deux sur cette branche : `boundingBox()` nul. Le test
  vérifiait la ligne déjà listée **avant** que la recherche s'applique, puis mesurait
  pendant le remontage des lignes web (≈ 80 ms après la saisie, même séquence sur les
  deux builds de production). Il attend désormais le résultat unique de la recherche
  et la hauteur compacte, puis revérifie l'absence de couverture : 20/20 sur la
  branche, et passe sur la base. Aucune assertion n'est retirée.
- Revue indépendante du diff : un défaut confirmé (fermeture du clavier web trop
  large), corrigé ci-dessus ; remarques facultatives traitées dans le banc. Relecture
  ciblée de la correction : aucun défaut applicatif ; l'étape « liste immobile » du
  parcours ne prouvait rien (la liste à un résultat défile encore) et a été remplacée
  par la molette latérale ; horloge monotone (`performance.now()`) pour la fenêtre.

## Limites

- **Aucune mesure native.** L'environnement cloud n'a ni téléphone ni simulateur.
  Le scroll des en-têtes sur le thread UI et la fin des re-rendus au début/fin de
  geste n'agissent que sur natif : leur gain en frames reste **non qualifié**
  jusqu'à une mesure FrameTimeline/Instruments sur les deux Release. Les gains de
  navigation sont du travail JavaScript commun aux deux plateformes, mesuré ici
  sous V8 et non sous Hermes.
- Le banc compare deux builds identiques hors diff ; ce n'est ni un appareil, ni un
  FPS natif, ni une latence toucher-vers-pixel.
- Builds, rapports E2E et traces vivent dans un conteneur éphémère : identités et
  chiffres sont recopiés ici, les commandes ci-dessous les régénèrent.

## Leviers suivants (non faits ici)

1. **Mesure native** des deux changements propres au natif, avec le
   [protocole du 18](native-performance-20261018.md) sur les deux Release.
2. **Ouverture d'un rêve** : encore environ 2 800 rendus de composants par visite
   sur le web. `JournalDetailContent` (3 600 lignes) n'est pas compilé (trois
   `eslint-disable exhaustive-deps`) ; même méthode que pour la liste du Journal.
3. **Position du Journal au retour sur le web** : défaut préexistant, la liste ne
   revient pas exactement où elle était (repos 0 → 456 px sur la base, 0 → 169 px
   après cette branche). Le natif est corrigé et qualifié depuis le 18.
4. **Boucles d'attente hors écran** (étoiles, balayage de peinture, points de
   génération) : elles continuent sous un écran poussé ; les suspendre hors focus
   par `animationPlayState`, sans changement visible.
5. **Identité de l'utilisateur** recréée à chaque rafraîchissement de session
   (`AuthContext`) : re-rendu des consommateurs au retour au premier plan. Zone
   comptes/synchronisation, à traiter avec ses parcours d'échec.
6. **Parallaxe des cartes** : un `measure()` par carte illustrée et par frame de
   défilement natif ; à revoir après la mesure native.

## Relancer

```sh
# Deux exports identiques hors diff (profil mock), hors dépôt.
EXPO_PUBLIC_MOCK_PERSISTENCE=true node ./scripts/expo-safe-runner.js --profile .env.mock \
  export -p web --output-dir /tmp/web-<label>
# Cinq passages, CPU ×4 ; --chromium seulement si le Chromium de Playwright manque.
node scripts/perf/measure-web-fluidity.mjs --dist /tmp/web-<label> --label <label> \
  --runs 5 --cpu 4 [--chromium <chrome>]
# Attribution : même export avec --no-minify, puis --attribute 1 --cpu 1 --runs 2.
# Parcours ajouté (Chromium local : E2E_WEB_CDP_ENDPOINT=<DevTools local>).
npm run test:testerarmy -- run --grep 'scrolled journal'
```
