# Symboles — Répertoire épuré, 3 octobre 2026

Responsable d’intégration : fil Symboles. Composition choisie par l’utilisateur : Répertoire épuré, clair/sombre. Implémentation et livraison autorisées ; fusion autorisée après validation. L’utilisateur prend en charge la qualification iPhone. Aucun build EAS ni soumission store.

## Candidat et portée

Code validé : `6a1fa400326cb467d91e9a65c25124189773094d`, master intégré : `a4c4fed3ffa8afdf491e236c94d8445f4b2cc970`. Base distante uniquement ; aucun commit du master local principal ni WIP d’autres fils importé. Les maquettes et prompts sont préservés.

En-tête compact, lien Guides discret, recherche en tête, populaires en texte, modes et filtres allégés, résultats en lignes sans titres tronqués. Catalogue (160), services, tri/recherche, navigation et sources analytics conservés. SymbolCard conserve sa variante carte par défaut dans les fiches de guide. SearchBar canonique remplace aussi la recherche de l’en-tête natif iOS ; les contrôles font partie du défilement et respectent les safe areas.

Les identifiants des populaires deviennent `symbol.popular.<id>` pour ne pas doubler ceux des résultats. Le scénario Maestro de l’onboarding est ajusté vers `symbol.popular.water` ; YAML analysé, scénario natif non exécuté.

## Preuve répétable

Environnement : Expo web Chromium, invité neuf, français, préférences locales persistées, auth/IA/paiements en mock. Aucun appel à un service de paiement ou backend réel autorisé par les fixtures. Viewport 390 × 844 ; stress navigateur 320 × 568 et texte doublé.

```sh
EXPO_PUBLIC_MOCK_PERSISTENCE=true mise exec -- npm run start:mock -- --web --port 8092
E2E_WEB_PORT=8092 E2E_REUSE_SERVER=1 mise exec -- npm run test:e2e:web -- e2e/web/symbol-dictionary.spec.ts e2e/web/dream-guides.spec.ts e2e/web/explorer-repertoire.spec.ts --workers=2
mise exec -- npm run test:prepush
mise exec -- npx expo lint app/symbol-dictionary.tsx components/symbols e2e/web/symbol-dictionary.spec.ts
```

Résultat : **12/12 E2E passent** (6 Symboles, 3 Guides, 3 Explorer). Recherche noms/extraits sans accents (`poursuivi`, `defunt`), lettres indisponibles/réinitialisation, catégories, aucun résultat (`astronaute`) et récupération, titres longs, détails/source, populaires, Guides/retour, thème explicite/système et vrai onboarding vers dictionnaire/retour à l’app. Le rechargement direct d’une URL locale n’est pas utilisé comme preuve d’un deep link natif : le démarrage local revient à Capturer.

`test:prepush` passe sur worktree propre : types app/tests, **101 suites / 1 025 tests** sélectionnés. Lint ciblé : zéro erreur, avertissement préexistant de setState dans l’effet de réinitialisation de lettre. `git diff --check` passe. Suite unitaire entièrement simulée du dictionnaire retirée au profit des parcours sur le catalogue et le routeur réels. Le retour après lien natif sans historique reste non qualifié sur appareil ; sa logique est conservée.

Artifacts locaux ignorés : `dist/symboles-maquettes-20261003/implementation/` contient `evidence.json`, rapport HTML, JUnit, traces, captures clair/sombre/vide/texte agrandi et comparaisons conjointes avec la référence. Rapport de fidélité `design-qa.md` dans ce dossier : **passed**, aucun P0/P1/P2 restant. Le fichier QA partagé à la racine n’est pas modifié par ce travail.

## Livraison et limites

Cette preuve couvre le code du candidat ci-dessus. Le commit de documentation et de ciblage Maestro qui la suit ne change pas le code exécuté. Les checks distants doivent encore être vérifiés sur le head final de la PR avant fusion ; publication Vercel et alias public à vérifier séparément après fusion.

Version binaire, source d’installation, OTA/runtime/channel et qualification physique : non testés dans ce lot. Aucun changement natif, backend ou migration. La validation web ne qualifie pas le clavier iOS, Dynamic Type, VoiceOver/TalkBack ni les gestes sur appareil.
