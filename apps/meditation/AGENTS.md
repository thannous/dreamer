# AGENTS.md — Noctalia Meditation

Guide de contribution pour agents et développeurs. La spécification complète du
produit vit dans `../../specs/noctalia-meditation.md` — elle fait foi sur le
périmètre, les écrans et les décisions d'architecture.

## Ce qu'est ce projet

Application autonome de la marque Noctalia : méditation guidée, respiration,
univers et progression douce. La boucle essentielle est choisir une intention,
écouter ou reprendre une séance disponible, puis terminer calmement. Zen est une
référence historique, sans obligation de parité. Voir
`../../specs/noctalia-brand-contract.md` pour les responsabilités produit.

Les abonnements sont désactivés par défaut (`lib/env.ts`). Les achats uniques
d'univers restent distincts ; aucune modification ne doit réactiver implicitement
un abonnement ou déduire un droit commercial du compte d'une autre app.

**Pas de compte, pas de backend applicatif.** Tout l'état est local
(AsyncStorage). Les pistes audio distantes viennent d'un bucket statique.

## Commandes

```bash
npm start          # serveur de dev
npm run ios        # build natif iOS
npm run android    # build natif Android
npm run web        # web (vérification visuelle uniquement, non ciblé en v1)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Règles non négociables

1. **Styling via Uniwind** (Tailwind v4, CSS-first). Les classes utilitaires
   d'abord ; `StyleSheet` / `style={}` uniquement pour ce que Tailwind ne peut
   pas exprimer (SVG, stops de dégradé, valeurs animées par Reanimated, `zIndex`
   de compositing). Il n'y a ni `tailwind.config.js` ni `babel.config.js` — ne
   pas en recréer.
2. **Aucune couleur en dur.** Les tokens vivent dans `global.css` (`@theme` pour
   l'invariant, `@layer theme` + `@variant` pour les couleurs par thème) et
   `constants/theme.ts` (valeurs brutes pour SVG et dégradés). Les deux fichiers
   doivent rester synchronisés.
3. **`accent` est un remplissage, jamais une couleur de texte.** Pour du texte
   accentué : `tone="accent"` (`--n-accent-text`). Sur un fond champagne :
   `tone="onAccent"`. C'est ce qui garantit le contraste AA dans les deux thèmes.
4. **`Text` : la variante porte la fonte et la taille, `tone` porte la couleur.**
   Ne jamais passer une classe `text-<couleur>` via `className` : deux classes de
   couleur concurrentes sont départagées par l'ordre de la feuille de style, pas
   par l'ordre des classes — l'override perd silencieusement.
5. **Variables d'environnement** : accès exclusivement via `lib/env.ts`, avec la
   clé écrite en toutes lettres dans le `switch`. `process.env[key]` dynamique
   casse en build de production.
6. **Le thème** : `auto` est passé tel quel à `Uniwind.setTheme('system')`, et
   le thème **résolu** se lit via `useUniwind()`. Ne pas réintroduire d'écouteur
   `Appearance` manuel.
   La préférence technique initiale est `dark` pour les surfaces sans univers.
   L'accueil initial et tout l'onboarding restent nocturnes. Les pages de
   pratique suivent l'apparence de leur univers. Pour imposer celle d'une surface,
   utiliser `ThemeScope` : il synchronise Uniwind, `useTheme()` et l'atmosphère.
   Un `ScopedTheme` seul ne suffit pas si le fond ou les props natives lisent
   aussi `useTheme()`.
   Les pages annexes (réglages, enregistrées, accès) utilisent `WorldPage` :
   elles suivent l'univers sélectionné comme les onglets. Dans les réglages,
   « Univers » ouvre le sélecteur de l'accueil ; ne pas réintroduire une bascule
   clair/sombre indépendante qui créerait une rupture dans ce parcours.
7. **Le souffle est unique.** Une seule animation pour toute l'app, dans
   `BreathProvider`. Une surface qui respire lit `useBreath()` — elle ne démarre
   jamais sa propre boucle, sinon les rythmes dérivent et l'effet se casse. Toute
   plage d'opacité animée doit plafonner à 1,00 : au-delà, c'est écrêté.
8. **Le verre vient des tokens, le flou est rare.** `bg-ink-card` et
   `bg-ink-panel` sont translucides : les surfaces échantillonnent l'aurore
   d'`Atmosphere` posée par `NightBackground`, et c'est ce qui les fait lire
   comme du verre. Ne jamais les repasser en opaque — une carte opaque perce un
   trou plat dans l'atmosphère. Le vrai `BlurView` reste réservé au chrome qui
   flotte au-dessus d'un contenu qui bouge : la pilule d'onglets, et un
   `GlassCard` par écran au maximum. Jamais dans une liste qui défile.
   Corollaire : le fond doit rester plus profond que les cartes, sinon il n'y a
   aucune séparation à voir.
9. **Toute boucle infinie respecte `useReducedMotion()`.**
10. **Animations de layout : contournement actuel d'un défaut observé.** Les
    versions précédentes de Reanimated laissaient `FadeInDown`/`Layout` à une
    opacité partielle. Utiliser actuellement `SharedValue` + `withTiming`, comme
    le souffle et le silence progressif. Ce choix ne fige pas les versions ou
    possibilités futures : un pilote local sur la version installée peut lever
    le contournement si le cas réel, l'accessibilité et les interactions passent.
    Une commande parfois invisible reste un défaut à corriger.
11. **Les icônes passent par `IconSymbol`**, repris tel quel de l'app journal :
    SF Symbols natifs sur iOS, MaterialIcons ailleurs via la table `MAPPING`.
    Le vocabulaire est celui des SF Symbols. Ne pas dessiner d'icônes maison :
    la cohérence qui compte est entre les deux apps de la marque, pas à
    l'intérieur d'une seule. Vérifier que la correspondance Material ne ment
    pas — `replay-10` sur un bouton qui saute 15 s est un défaut, pas un détail.
12. **L'audio passe par `services/audioService`**, jamais par `expo-audio`
    directement : c'est ce qui permet au mock de le remplacer en E2E et en
    développement sans fichiers audio.

## Structure

`app/` routes Expo Router · `components/atmosphere/` fonds · `components/ui/` kit
· `constants/` tokens · `context/` providers · `content/` catalogue statique typé
· `services/` accès plateforme (+ `mocks/`) · `lib/` utilitaires.

## Avant de proposer un changement

Exécuter les commandes depuis `apps/meditation`. Pour les changements de code,
appliquer la [validation proportionnée](../../doc_web_interne/docs/validation-proportionnee.md)
du dépôt parent : tests ciblés pour un comportement, lint ciblé et écran concerné
pour une petite retouche visuelle ; `npm run typecheck` et `npm run lint` selon
l'impact. Les changements audio, achats ou stockage demandent les cas d'échec
pertinents. Les commandes ne sont pas une checklist à exécuter intégralement.
Réutiliser les résultats du code inchangé, regrouper les corrections avant push
et ne pas relancer une suite applicative pour une correction documentaire.
Pour une modification documentaire, vérifier le contenu et les liens sans lancer
les suites applicatives. Les règles parentes de confidentialité, autorisation,
préservation du travail et verrou partagé de l'appareil restent applicables.
Les chemins de thème et de services de ce guide sont propres à Meditation.
Un travail natif demandé inclut sa génération locale nécessaire dans un worktree
isolé, après contrôle SDK/profil ; réutiliser le projet compatible existant avant
un `prebuild --no-install`. Ne pas redemander une confirmation pour ce même
périmètre. Garder un propriétaire par appareil et ne réinitialiser que l'état QA
possédé. EAS/Store, publication, données personnelles et nouveau coût externe
ne sont pas autorisés par cette génération locale.

Le contrat fonctionnel actuel guide les attentes. Un ancien scénario ou
contournement informe le diagnostic, sans interdire une évolution justifiée ;
documenter le changement et conserver son ancien résultat comme historique.
Référencer le rapport canonique et ses pièces utiles plutôt que dupliquer toutes
les captures et leurs vérifications à chaque étape. Lire le guide parent pour
les mises à jour compatibles de TesterArmy et la validation proportionnée.

## E2E — TesterArmy

Le framework par défaut pour les nouveaux parcours est TesterArmy `e2e`, selon
https://docs.expo.dev/guides/using-e2e/. Lire `../../tools/e2e/README.md`.
`npm run test:testerarmy` sélectionne le web (preuve visuelle et routage seulement).
`E2E_DEVICE=<serial-emulateur> npm run test:testerarmy:mobile -- android` vise un
build Release installé ; utiliser `ios` avec le nom exact d'un simulateur iOS.
Les tests natifs effacent l'état de cette app sur le simulateur dédié sélectionné.
Conserver les assertions Maestro encore pertinentes jusqu'à leur remplacement
exécuté. Une attente devenue obsolète se révise avec sa raison produit et sa
preuve actuelle ; elle ne bloque pas automatiquement l'adoption. Aucun contrôle
CI obligatoire n'est contourné implicitement. Respecter les règles parentes.


La skill officielle `agent-device` sert à l'inspection native. Utiliser
`E2E_DEVICE=<appareil-dedie> npm run agent-device:inspect -- android` (ou `ios`)
et `npm run agent-device:mcp -- ios` pour l'exploration, sous le même verrou
que TesterArmy. Lire la section agent-device de `../../tools/e2e/README.md`.
Une capture d'inspection ne qualifie ni l'audio ni un parcours E2E.
