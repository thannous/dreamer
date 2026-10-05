# Lucid — corrections de cohérence du 2 octobre 2026

Lot issu de l’audit graphique local du même jour. Intégration : branche `codex/lucid-visual-corrections`, worktree isolé du checkout Journal/Meditation. Autorisation : implémenter les corrections identifiées ; publication, prebuild, build EAS et utilisation du Motorola exclus.

## Résultat attendu

- Champ horaire lisible en sombre et apparence iOS liée au thème effectif.
- Quatre onglets complets à 320/360/390 px ; raccourcis sans ellipse, graisse Space Grotesk déjà chargée.
- Onboarding clair sur un fond de lecture continu, trois programmes dans le gabarit immersif existant, titres de cartes/phases sans-serif.
- Compte, formulaires, récupération et vérification d’e-mail dans la palette Lucid ; variante Journal conservée. Import invité toujours soumis à l’accord existant.
- Préambules et métriques retirés de la pratique active ; diagnostics permissions/Health repliés et réservés au développement. Disponibilité Health vérifiée avant activation de l’import.
- Vouvoiement français, formulaires facultatifs plus compacts. Politique sommeil et blocages WBTB conservés.

## Validation répétable

Le parcours `tests/e2e/lucid-visual-journey.mjs` utilise le navigateur intégré et une origine locale vierge. Il effectue de vraies interactions UI, avec deux rêves explicitement fictifs ; il ne crée aucun compte réel, n’envoie aucun e-mail et ne déclenche aucun achat.

Démarrer `mise exec -- npm run start:lucid:mock -- --web --port 8097` selon l’autorisation macOS requise par AGENTS. Depuis le Browser node_repl, après le bootstrap documenté du navigateur :

```js
var { runLucidVisualJourney } = await import('/absolute/checkout/tests/e2e/lucid-visual-journey.mjs');
await runLucidVisualJourney({
  browser,
  base: 'http://localhost:8097', // origine vierge : choisir un autre port si elle a déjà été utilisée
  output: '/private/tmp/lucid-visual-e2e',
  revision: '<git rev-parse HEAD>',
});
```

Le rapport JSON identifie la révision, le profil, les préconditions, chaque assertion, les URL et snapshots DOM ; les captures restent locales. Il vérifie contraste du sélecteur, sauvegarde des horaires, intégrité des libellés, programmes et sécurité WBTB, formulaire invalide, sauvegarde matin→Journal→signes→Atlas, absence de consignes techniques dans l’UI principale, indisponibilité Health et reprise persistée des deux laboratoires.

Les assertions ont précédé l’implémentation ; le défaut de contraste a été reproduit sur la source initiale. Aucun nouveau test isolé n’a été ajouté. Les fixtures existantes sont mises à jour ; les assertions cosmétiques et trois tests de structure (hauteur des onglets, colonne de métriques, forme du visuel SSILD) sont retirés. Les assertions de stockage, de consentement, d’erreur et de reprise restent en place. Les contrôles de livraison sont lint ciblé, types app/tests et `mise exec -- npm run test:prepush` sur le worktree propre et committé, puis CI sur le head de la PR.

Le serveur autonome génère uniquement les types de `routes/lucid`. Pour vérifier tout le dépôt, régénérer les déclarations du routeur `app/` avec le générateur Expo installé ; ne pas corriger les écrans Journal pour contourner ce décalage d’environnement.

## Limites

Environnement testé : Expo 57 web mock, données locales fictives, sans binaire Lucid natif. Version déclarée 3.4.5 ; identité/signature, runtime OTA, backend, HealthKit natif, microphone, notifications après redémarrage, Dynamic Type, VoiceOver et qualité du mouvement sur release restent non qualifiés. Le sélecteur iOS reçoit le thème correct dans le code ; son rendu natif exige un binaire/profil Lucid adapté. Aucun appareil Motorola n’est utilisé.

Prochaine étape native : utiliser un profil/binaire Lucid explicitement autorisé. La qualification web ne vaut ni installation native ni publication.
