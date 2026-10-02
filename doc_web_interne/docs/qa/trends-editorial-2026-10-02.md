# Tendances : bilan éditorial

Direction retenue par l’utilisateur : bilan éditorial sans détail des rêves par jour. Maquette : `dist/tendances-maquettes-20261002/bilan-editorial-sans-detail-quotidien-clair-sombre.png` dans le checkout principal. Travail isolé du WIP des autres écrans.

## Périmètre et critères

Deux chiffres principaux issus de `buildDreamTrends` : rêves capturés et jours actifs. Les thèmes suivent, puis les séries, la moyenne lorsqu’elle existe et la dernière capture. Émotions, types, récurrences, évolution et navigation conservés. Sept jours locaux glissants et calculs inchangés ; aucun filtre, nouvelle donnée ou fonctionnalité. Préférences de thème explicites et Auto conservées.

## Vérifications choisies avant implémentation

Les parcours web existants ne couvrent pas Tendances. Les risques concrets sont : valeurs zéro masquées, motifs artificiels dans un journal récent, moyenne fictive avant sept jours, colonne de chiffres recouvrant les libellés à 320 px, détails non accessibles au défilement, et thème explicite remplacé par le système. Un parcours E2E ciblé vérifie le journal vide/récent et un profil mock rempli, avec captures et trace. Aucun nouveau test en isolation. Les anciens contrôles exclusifs au graphique retiré sont supprimés ; les tests du modèle sont conservés.

Commande : `NOCTALIA_APP_VARIANT=noctalia EXPO_PUBLIC_APP_VARIANT=noctalia E2E_WEB_PORT=8137 E2E_REUSE_SERVER=1 mise exec -- npm run test:e2e:web -- e2e/web/trends-editorial.spec.ts --workers=1`.

Préconditions : serveur `NOCTALIA_APP_VARIANT=noctalia EXPO_PUBLIC_APP_VARIANT=noctalia EXPO_PUBLIC_MOCK_PERSISTENCE=true mise exec -- npm run start:mock -- --web --port 8137`, Chromium Playwright installé, services mock, données synthétiques, horloge du 2 octobre 2026 et fuseau Europe/Paris dans les tests. Les rêves mock restent en mémoire. Aucune requête de facturation ou de backend réel n’est autorisée par les fixtures.

## Résultat

Qualification locale du 3 octobre 2026, branche `codex/tendances-bilan-editorial`. Comparaison visuelle initiale sur base `5833c3ae4b59f6147f38fc9510276cd07a7ed6b5`, puis intégration du seul commit Tendances sur `3c9da7a486333f79dde8c722bc8abddfe258c66b` (master distant). Le rapport HTML E2E enregistre automatiquement le SHA testé et l’état du checkout ; une exécution finale sur commit propre identifie le candidat livré.

- E2E ciblé : 3/3 passent. Journal vide à 320 px en clair et sombre, valeurs zéro et moyenne absente, aucun graphique quotidien, CTA et enregistrement du premier récit ; profil rempli, 4 rêves/4 jours actifs sur les sept jours de la fixture, thèmes et évolution ; thème explicite indépendant du système et Auto suivant le système ; allemand à 320 px sans débordement des sections.
- Types app/tests et lint ciblé vérifiés. Le contrôle final `test:prepush` et la CI qualifient le commit de livraison séparément.
- Le premier contrôle affecté a passé 102 suites et signalé une assertion de structure CSS obsolète dans le test d’échelle de texte. Les deux assertions de classes ont été retirées ; les contrôles de libellés non tronqués et de mise à l’échelle restent présents. Aucun nouveau test en isolation.
- Comparaison visuelle clair/sombre dans le navigateur intégré, 390 × 886 px, contre les deux cadres de la maquette recadrés et normalisés depuis 432 × 982 px. Corrections : espacement excessif qui repoussait les détails sous la navigation, puis dernière capture rétablie en ligne avec valeur à droite. Les chiffres et dates diffèrent volontairement de l’illustration : le profil mock réel du 3 octobre donne 3 rêves/3 jours actifs, aucune valeur de maquette n’est injectée dans le produit.
- Fraunces et Space Grotesk existantes, palette canonique, titres et chiffres hiérarchisés, libellés longs repliables. Navigation, réglages et wordmark existants conservés. Aucun nouvel asset ou changement d’animation. Le modèle `lib/dreamTrends.ts` reste inchangé.

Preuves privées ignorées : `test-results/e2e-web/` (traces et captures attachées), `test-results/e2e-web-report/` (rapport et SHA), `test-results/e2e-web-junit/results.xml` (résultat machine). Les comparaisons et captures françaises sont dans `dist/tendances-maquettes-20261002/implementation/` du checkout principal ; rapport détaillé `design-qa.md` dans ce dossier. Résultat de la comparaison visuelle : **passed** après correction, avec différences de données et de navigation existante explicites.

Limite : le retour depuis le rêve sauvegardé vers le Journal web inchangé échoue avec `Failed to set an indexed property [0] on 'CSSStyleDeclaration'`. L’essai et sa trace sont conservés dans `implementation/blocked-recent-journal/`. La nouvelle suite s’arrête donc après l’enregistrement pour ce parcours ; elle ne revendique pas la mise à jour du bilan récent après retour. Les tests existants du modèle et de l’écran conservent leur couverture des moyennes nulles et des motifs insuffisants. Aucune qualification native, taille de texte physique, installation ou publication mobile n’est revendiquée.
