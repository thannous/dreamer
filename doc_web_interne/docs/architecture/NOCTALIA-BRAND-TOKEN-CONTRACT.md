# Contrat de cohérence des couleurs Noctalia

## Décision

Ce lot prépare le partage des primitives de marque en vérifiant les miroirs CSS
et TypeScript existants. Il ne déplace pas les configurations natives et ne crée
pas de package partagé avant d'avoir stabilisé les responsabilités des tokens.
Les valeurs et les interfaces restent inchangées.

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
`getNoctaliaDesignTokens` sont contrôlées pour dark/light : cette fonction prend
un mode binaire, pas une ambiance. Cela ne certifie pas ses surfaces calculées
pour Morning ou Afterglow.

Le contrôle ne certifie ni les contrastes de chaque écran, ni les thèmes des
univers Meditation, ni les animations, ni le rendu sur appareil. Les tests de
contraste existants et la qualification native restent distincts.

## Exécution

Les commandes canoniques sont `npm run brand:check` depuis la racine et depuis
`apps/meditation`. Le contrôle est exécuté avant le lint de chaque produit afin
que les jobs qualité existants le vérifient sans modifier les pipelines.
Les divergences doivent être examinées : ne pas recopier mécaniquement une
valeur d'un produit à l'autre pour obtenir un contrôle vert.

## Preuves du lot

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
