# Frontières des dépendances Noctalia

Le [contrat de marque](../../../specs/noctalia-brand-contract.md) définit les
responsabilités produit. Le contrôle exécutable est
[scripts/check-monorepo-boundaries.js](../../../scripts/check-monorepo-boundaries.js),
lancé par `npm run boundaries:check`.

## Imports applicatifs

- Lucid possède ses observations et son état d'entraînement. Son domaine, ses
  routes, composants, hooks et contexte ne peuvent importer directement les
  providers, hooks, stockage, analyse ou synchronisation du Journal.
- Le domaine Lucid et les primitives pures `dateUtils`, `circuitBreaker` et
  `authValidation` ne peuvent importer les routes, composants, hooks ou contextes
  applicatifs.
- Le runtime Meditation reste dans `apps/meditation/`. Son package et son lockfile
  sont propres ; ses outils peuvent utiliser le verrou Android partagé.

Le contrôle AST lit les imports/exports, `require`, imports dynamiques et
imports de types dont la cible est littérale. `@/` est résolu dans l'application
concernée. Les tests sont exclus de ces règles d'import produit. Les noms de
modules calculés, nouvelles racines ou nouveaux alias exigent une revue : ce
contrôle statique ne prouve pas toute la composition runtime ni le trafic réseau.

## Builds et vérification

Dreamer et Lucid partagent l'installation racine ; Lucid conserve sa racine de
routes `routes/lucid/`. Meditation garde son installation indépendante. Le site
se reconstruit depuis `docs-src/` et `data/` ; `docs/` est une sortie ignorée.

[verify-local.config.mjs](../../../verify-local.config.mjs) sélectionne les
contrôles locaux. La carte historique `.circleci/dependency-consumers.tsv` et les
anciens cas de classification restent des entrées de tests locaux. Ils ne
lancent plus de validation applicative dans CircleCI : celui-ci ne conserve
qu'un benchmark manuel d'installation, décrit dans le [guide CI](../circleci-migration.md).

Utiliser `node scripts/check-monorepo-boundaries.js --meditation` pour le périmètre
Meditation avec ses dépendances installées. Choisir les autres contrôles selon la
[validation proportionnée](../validation-proportionnee.md). Une frontière statique
valide ne remplace pas un parcours natif ni une preuve de publication ; les
[procédures de livraison](../repository-operations.md) restent applicables.
