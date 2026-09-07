# Contrat de cohérence des couleurs Noctalia

## Décision

Ce lot prépare le partage des primitives de marque en vérifiant les miroirs CSS
et TypeScript existants. Il ne déplace pas les configurations natives et ne crée
pas de package partagé avant d'avoir stabilisé les responsabilités des tokens.
Les interfaces restent inchangées. Les valeurs CSS restent la référence ; les
surfaces TypeScript Morning/Afterglow sont alignées sur cette référence.

Journal et Lucid utilisent les palettes de `constants/journalTheme.ts` et la
feuille racine `global.css`. Meditation possède ses propres surfaces dans
`apps/meditation/constants/theme.ts` et `apps/meditation/global.css`. Une même
marque n'exige pas des surfaces identiques entre ces produits.

## Sémantique explicite

- Journal : `champagne-on` correspond à `accentText`, pour le texte accentué sur
  les surfaces de lecture.
- Meditation : `champagne-text` correspond à `accentText` ; `champagne-on`
  correspond à `textOnAccent`, pour le texte sur un remplissage accentué.
- Les fonds de cartes Journal peuvent venir de `noctaliaDesign.surface` plutôt
  que de la palette opaque `journalTheme`. Les mappings ne confondent pas ces
  deux usages.

Ces conventions existantes sont contrôlées, pas renommées dans ce lot. Un futur
package doit exposer des rôles non ambigus et conserver des adaptateurs produit.
Le contrat fonctionnel reste `specs/noctalia-brand-contract.md`.

## Périmètre

Le contrôle porte sur les couleurs des palettes Journal dark/light/morning/
afterglow et Meditation dark/light. Les surfaces calculées par
`getNoctaliaDesignTokens` sont contrôlées pour les quatre combinaisons réelles :
Dark/dark, Light/light, Morning/light et Afterglow/dark. Le mode binaire ne
suffit pas à distinguer les surfaces : la fonction lit aussi `colors.ambience`.

Chaque déclaration `--color-*` des palettes doit être enregistrée dans le
mapping approprié. Le parseur limite ces palettes à `@layer theme > :root` ;
un `@variant dark` dans une autre règle CSS ne crée pas une palette supplémentaire.

Le contrôle ne certifie ni les contrastes de chaque écran, ni les thèmes des
univers Meditation, ni les animations, ni le rendu sur appareil. Les tests de
contraste existants et la qualification native restent distincts.

## Exécution

Les commandes canoniques sont `npm run brand:check` depuis la racine et depuis
`apps/meditation`. Le contrôle est exécuté avant le lint de chaque produit afin
que les jobs qualité existants le vérifient sans modifier les pipelines.
Les divergences doivent être examinées : ne pas recopier mécaniquement une
valeur d'un produit à l'autre pour obtenir un contrôle vert.

## Preuves du lot initial (PR #118)

Validation locale sur la base `eee5f80cf`, Node 24.19.0 :

- 136 comparaisons Journal/Lucid et 45 Meditation (dont les valeurs par défaut
  CSS), soit 181 au total ; aucune divergence sur les mappings contrôlés.
- Dix tests de mutation verts via le projet Jest Node : divergences et absences
  de tokens, thèmes, normalisation, expressions non prises en charge et blocs
  CSS ambigus. Les deux tests existants de contraste sont également verts.
- Lint complet des deux produits vert : zéro erreur ; le lint racine rapporte
  60 avertissements sur les fichiers existants. ESLint ciblé du nouveau code vert.
- Commande Meditation exécutée dans une fixture sans package ni dépendances
  racine : 45 comparaisons vertes avec les seules dépendances Meditation.
- Revue indépendante du code final validée, aucun défaut actionnable restant.

Aucune palette, feuille CSS, dépendance ou configuration native n'a été modifiée.
Les preuves sont locales ; la CI de la PR constitue une vérification distincte.

## Suivi de revue de la PR #118

Trois remarques publiées après fusion ont motivé un correctif sur la base
`77f49c0b4` :

- 52 comparaisons supplémentaires couvrent les surfaces Morning et Afterglow.
  Les miroirs TypeScript utilisent maintenant les couleurs CSS de ces ambiances.
- Une couleur CSS non enregistrée fait échouer le contrôle.
- Les variantes CSS de composants/utilitaires ne sont plus interprétées comme
  des palettes. Les doublons dans le véritable scope des palettes restent refusés.

Preuves locales : 233 comparaisons, 22 tests dans trois suites, types application
et tests, lint ciblé et revue indépendante verts. Une comparaison des objets
runtime complets avant/après conserve les quatre combinaisons Dark/Light et
mode binaire.

Prévisualisation web mock effectuée sur l'onboarding Lucid avec les paramètres
`ambience=morning` et `ambience=afterglow`. Les deux écrans se rendent. Un défaut
visuel distinct reste à traiter : les titres Morning sombres sont peu lisibles
sur l'illustration nocturne derrière l'onboarding. Cela n'est pas une validation
de contraste de cet écran ; le rendu natif n'a pas été qualifié dans ce lot.
