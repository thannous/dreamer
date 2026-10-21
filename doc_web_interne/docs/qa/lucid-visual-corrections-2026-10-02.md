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

Mise à jour du 21 octobre 2026 : le parcours manuel `tests/e2e/lucid-visual-journey.mjs` a été retiré après validation de ses quatre équivalents `PR237` dans `tools/e2e/tests/lucid.web.e2e.ts` : **4/4 PASS** sur `70c197ca6`, rapport privé `lucid-web/1792580329982-12050-65841e80-c336-4965-947e-038013ae3d4f`. Ils utilisent les API publiques TesterArmy avec une origine locale et des données fictives ; aucun compte, e-mail ou achat réel.

```bash
E2E_WEB_LOCALE=fr-FR npm run test:testerarmy:lucid -- run --grep PR237
```

Le runner prépare le serveur local isolé et conserve les traces et captures. Contraste du sélecteur, sauvegarde des horaires, intégrité des libellés, programmes et sécurité WBTB, formulaire invalide (mot de passe court compris), matin→Journal→signes→Atlas, absence de consignes techniques, indisponibilité Health et reprise des deux laboratoires restent vérifiés. Le registre courant et les limites figurent dans [la migration TesterArmy](../../../../tools/e2e/MIGRATION.md). Les résultats ci-dessous restent le compte rendu historique du 2 octobre.

Les assertions ont précédé l’implémentation ; le défaut de contraste a été reproduit sur la source initiale. Aucun nouveau test isolé n’a été ajouté. Les fixtures existantes sont mises à jour ; les assertions cosmétiques et trois tests de structure (hauteur des onglets, colonne de métriques, forme du visuel SSILD) sont retirés. Les assertions de stockage, de consentement, d’erreur et de reprise restent en place. Les contrôles de livraison sont lint ciblé, types app/tests et `mise exec -- npm run test:prepush` sur le worktree propre et committé, puis CI sur le head de la PR.

Le serveur autonome génère uniquement les types de `routes/lucid`. Pour vérifier tout le dépôt, régénérer les déclarations du routeur `app/` avec le générateur Expo installé ; ne pas corriger les écrans Journal pour contourner ce décalage d’environnement.

## Limites

Environnement testé : Expo 57 web mock, données locales fictives, sans binaire Lucid natif. Version déclarée 3.4.5 ; identité/signature, runtime OTA, backend, HealthKit natif, microphone, notifications après redémarrage, Dynamic Type, VoiceOver et qualité du mouvement sur release restent non qualifiés. Le sélecteur iOS reçoit le thème correct dans le code ; son rendu natif exige un binaire/profil Lucid adapté. Aucun appareil Motorola n’est utilisé.

Prochaine étape native : utiliser un profil/binaire Lucid explicitement autorisé. La qualification web ne vaut ni installation native ni publication.
