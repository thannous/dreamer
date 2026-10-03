# Paramètres Dream — listes groupées, 2 octobre 2026

Direction choisie par l’utilisateur : variante 1, clair et sombre. Référence privée locale : `dist/design-settings-20261002/01-listes-groupees-clair-sombre.png`, SHA-256 `0569e14ec356aa6006f5f4a6f8f5352f9b26c47eb52d0d3662f324efa72dcaf1`. Les images et traces restent ignorées par Git.

## Périmètre et invariants

Compte compact ; titres hors des groupes ; lignes de 64 px minimum et espaces de 24 px entre groupes ; rail et curseur natifs contrastés, état libellé ; déconnexion secondaire en pied. Formulaires du compte, mode invité et barrière invité, quatre modes d’apparence, sept langues, rappels et horaires conditionnels, consentement et suppression, contrôleurs et droits existants sont conservés. Aucun changement de palette, image de rêve, backend, abonnement ou version de build.

Les instructions autorisent l’implémentation et la livraison du paquet ; les builds EAS, soumissions aux stores et vérifications sur appareil restent distincts. Le worktree principal et ses modifications préexistantes sont préservés.

## Risques couverts par les parcours existants et ajoutés

- Choix explicite clair/sombre remplacé à tort par le système : vérifier la couleur effective avec système opposé, puis le suivi du système en mode Automatique ; les quatre choix restent accessibles.
- Commande de rappel désynchronisée de son libellé ou de son état accessible : activer, désactiver et revenir dans les réglages ; vérifier les états accessibles et les mots d’état. RN Web attend `activeThumbColor` pour le curseur ON ; le parcours vérifie aussi cette couleur rendue.
- Horaire du week-end affiché à tort ou perdu : apparition lors de l’activation, disparition lors de la désactivation. Ouverture/fermeture du sélecteur horaire existant.
- Perte du compte ou des droits pendant le déplacement de la déconnexion : connexion mock, quota gratuit, liens légaux, déconnexion réelle via le service existant, retour invité et absence de suppression connectée.
- Débordement sur petit écran : vérifier la largeur du groupe de rappels à 320 px.

Aucun test d’isolation ajouté. Les tests existants des confirmations de suppression, de vérification email et des contrôleurs continuent de qualifier leurs exceptions documentées.

## Reproduction et artefacts

Dans le worktree avec ses propres dépendances :

```sh
EXPO_PUBLIC_MOCK_PERSISTENCE=true mise exec -- npm run start:mock -- --web --port 8093
E2E_WEB_PORT=8093 E2E_REUSE_SERVER=1 mise exec -- npm run test:e2e:web -- e2e/web/settings.spec.ts --workers=1
```

Contexte : Expo web en Chromium, 390 × 844, langue française, profil fictif `new`, puis invité ; services simulés et requêtes externes bloquées par `e2e/web/fixtures.ts`. Le rapport Playwright consigne la révision testée, la propreté du worktree, l’environnement et les profils. Traces pour les deux thèmes, captures du haut, du groupe Rituels et de la déconnexion sous `test-results/e2e-web/` ; rapport HTML sous `test-results/e2e-web-report/` et JUnit sous `test-results/e2e-web-junit/`. Les captures normalisent le défilement horizontal de la page à zéro ; aucune image générée n’est substituée à l’interface.

Validation complémentaire : lint des fichiers concernés, `theme:check`, `brand:check`, puis `test:prepush` sur le commit propre. Les deux avertissements existants de `set-state-in-effect` dans EmailAuthCard ne sont pas modifiés par ce paquet.

## Comparaison visuelle et limites

Comparaison avec la maquette dans les deux thèmes : typographies Fraunces/Space Grotesk et palette conservées, groupes alignés, état ON/OFF lisible et déconnexion secondaire. Première comparaison : curseur ON vert par défaut sur le web, corrigé par la propriété spécifique RN Web puis vérifié à nouveau. Les descriptions complètes des rappels sont conservées, plutôt que les textes abrégés du générateur. Les panneaux de diagnostic présents uniquement en développement ne font pas partie de l’interface de production et restent inchangés. Le contrôle de mesure d’usage et les options HD demeurent conditionnels ; ils ne sont pas artificiellement activés pour correspondre à la maquette.

Les parcours qualifient l’interface web et les états simulés. Aucun nouveau binaire natif, test de permissions Android/iOS, paiement réel, synchronisation réelle ou contrôle sur appareil n’est revendiqué. Les contrôleurs natifs existants et leurs conditions ne sont pas remplacés.
