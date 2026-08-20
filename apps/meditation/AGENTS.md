# AGENTS.md — Noctalia Meditation

Guide de contribution pour agents et développeurs. La spécification complète du
produit vit dans `../dreamer/specs/noctalia-meditation.md` — elle fait foi sur le
périmètre, les écrans et les décisions d'architecture.

## Ce qu'est ce projet

Seconde application de la marque Noctalia : méditation guidée, respiration,
séries de pratique. Clone fonctionnel du template « Zen » (native-templates.com)
rhabillé aux couleurs Noctalia.

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
10. **Pas d'animations de layout Reanimated** (`FadeInDown`, `Layout`, etc.) :
    elles restent bloquées en cours de route et laissent le composant à une
    opacité partielle. Utiliser une `SharedValue` + `withTiming`, comme le
    souffle et le silence progressif — ou rien. Une commande parfois invisible
    est un défaut bien pire qu'un fondu manquant.
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

`npm run typecheck && npm run lint` doivent passer sans erreur.
