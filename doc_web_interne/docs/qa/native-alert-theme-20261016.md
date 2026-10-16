# Apparence native et palettes dynamiques — 16 octobre 2026

Responsable : fil `popup-native-theme`. Périmètre : cohérence clair/sombre des
fenêtres natives avec le thème dynamique de Dreamer. Pas de publication demandée.

## Diagnostic et correction

La capture privée fournie montre la confirmation d’achat Apple StoreKit avec
`Environment: Sandbox`. Le service appelle `Purchases.purchasePackage` ; le
message de succès propre à Noctalia est un toast distinct dans le paywall.
Apple gère la confirmation système et sa présentation, comme expliqué dans
[WWDC25, StoreKit](https://developer.apple.com/videos/play/wwdc2025/241/).

Uniwind 1.12.2 remet `Appearance` en mode système pour les palettes personnalisées
`morning` et `afterglow`. Avec un système clair et la palette du soir sombre,
le style natif pouvait donc rester clair. Après `Uniwind.setTheme`,
[ThemeContext](../../../context/ThemeContext.tsx) applique désormais le mode
clair/sombre de la palette dynamique sur les plateformes natives. L’option
`auto` conserve la remise au mode système de Uniwind.
L’API agit sur le style de l’application ; voir
[React Native Appearance](https://reactnative.dev/docs/appearance).

## Preuves et relance

Code testé : `e79f04ad0f77685566723d5184de98b4b9ee0f20`, base
`cf78f078fda2717903c0a8e96563a733fd309062`. Les ajouts documentaires ultérieurs
ne changent pas ces entrées applicatives. Node 24.19.0, React Native 0.88.0-rc.3,
Uniwind 1.12.2, RNTL 14.1.0.

- Contrôle isolé : ancien code en échec (`dark` attendu, `light` obtenu) ; après
  correction, 5/5 tests des deux suites ThemeContext passent. Les deux nouveaux
  contrôles simulent le contrat de Uniwind et de Appearance : soir/matin avec
  système opposé, puis libération du style imposé en retournant à `auto`.
- Exception isolée : les parcours navigateur ne peuvent pas lire le style natif ;
  le parcours StoreKit nécessite une transaction et l’iPhone est utilisé par un
  autre fil. Ces contrôles protègent la frontière API, sans prouver un rendu iOS.
- TesterArmy frais : 2/2 parcours de réglages clair/sombre passent, dont le retour
  à `auto`, la persistance et la conservation des choix. Source propre et stable,
  locale `fr-FR`, services simulés, port 4520, aucune utilisation de modèle.
  SDK `e2e` 0.21.1, moteur web 0.15.0, Playwright 1.64.0.
- Artefact canonique local :
  `tools/e2e/.e2e/dreamer-web/1792167875157-73998-ee4bbe16-5c5f-4f2f-bb2f-957e8227e047/`
  (`qualification.json`, `report.json`, traces et captures). Rapport Jest dans
  `tools/e2e/.e2e/native-alert-theme-20261016/jest.json`.
- Le premier lancement E2E a refusé le lien de dépendances non ignoré
  (`SOURCE_SYMLINK`) avant les tests. Un répertoire de dépendances local ignoré
  contenant les liens a rétabli la préparation normale, sans changer les gardes.

```sh
mise exec -- npm run test:file -- context/__tests__/ThemeContext.native.test.tsx context/__tests__/ThemeContext.test.tsx
E2E_WEB_PORT=4520 E2E_WEB_LOCALE=fr-FR mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'grouped settings preserve'
mise exec -- npm run verify:pr
```

## Limite et prochaine action

Aucun nouveau binaire installé et aucun achat exécuté ici. Le texte, le bouton,
la forme et la mention Sandbox restent gérés par Apple. Le rendu de cette alerte
StoreKit après correction est **non qualifié** : elle peut imposer sa propre
apparence et ne pas suivre celle de l’application. Après intégration du code dans
le candidat iOS, recontrôler cette alerte lors du parcours Sandbox autorisé avec
son propriétaire. L’iPhone, son état billing, Metro 4519 et les preuves du fil
d’achat sont restés intacts.
