# Illustrations agrandies des scènes de symboles — 23 octobre 2026

Responsable : Codex, à la demande de Thanh. Périmètre : afficher l'illustration
du cas sélectionné en grand dans la section des trois scènes, avec une
composition adaptée au site Noctalia. Préparation et vérification locales ;
aucune publication, fusion, modification de compte ou de données.

## Résultat

Le choix par clic ou clavier affiche la peinture correspondante avec sa lecture
et le lien de sa variante. Les choix restent à gauche à partir de 1024 px ;
en dessous, le tableau suit les choix. À partir de 1800 px, la lecture se place
à droite du tableau. Les effets existants utilisent des surfaces distinctes
et s'arrêtent lorsque leur tableau est masqué ou que le mouvement est réduit.

Les trois peintures servies plafonnent actuellement à 640 px pour chaque symbole.
Le tableau est donc limité à 40 rem dans la composition standard, sans nouveau
fichier agrandi artificiellement. Les écrans à forte densité restent limités par
ces sources. Les images originales, les traductions et les URL sont conservées.

## Identité et vérification

Base : `c0de9eae92b0f4c43220ca07cf690955dc2419c5`, avec uniquement le générateur
et le parcours site de cette tâche superposés dans une copie Linux isolée.
Les travaux backend concurrents du checkout principal ne font pas partie de
cette qualification. Backend, OTA, installation native : sans objet.

Générateur final SHA-256 :
`a8cdea06d857bca6bd7bc69f5db0a58b332c29ddc035c0bb0a06c671d48e47ae`.

Inspection Chrome : 2560 × 1440, 1920 × 1080, 900 × 1000 et 390 × 844.
Les trois choix, l'image décodée et la lecture ont été inspectés. Aucune erreur
console observée ; le script analytics ignore volontairement localhost.
Captures locales : `test-results/scene-immersive/desktop-calm.png` et
`test-results/scene-immersive/mobile-cage.png`.

Commandes de reproduction avec Node 24.22.1 et les dépendances du projet :

```sh
npm run docs:build
npm run docs:check
npm run test:testerarmy:typecheck
node tools/e2e/run.mjs site web run --grep 'the French tiger atlas|the language menu leads from the French moon atlas'
git diff --check
```

Résultat : `docs:build`, `docs:check`, typage TesterArmy et `git diff --check`
réussis. Les deux parcours ciblés réussissent : tigre (7,2 s) et lune en
français/portugais/anglais (6,4 s). Le runner confirme `exitCode: 0`,
`applicationQualified: true`, sources et sorties stables, sans erreur secondaire.
Les cas couvrent les trois choix, clavier, image décodée et correspondance avec
la vignette, lecture et lien de variante, absence de débordement, deux effets
animés, pause du tableau masqué et mouvement réduit. Cette campagne n'utilise
pas de modèle ni de compte utilisateur.

Lint ciblé : aucun nouveau diagnostic par rapport à `HEAD`. Le contrôle absolu
reste en échec sur cinq `no-undef` préexistants (`__dirname`) dans le générateur ;
sept avertissements du générateur et cinq du parcours sont également inchangés.
Comparaison exacte des règles/messages/sévérités :
`test-results/scene-immersive/lint-baseline-comparison.json`.

Les résultats des parcours et leurs preuves sont conservés dans
`test-results/scene-immersive/1792776064118-8255-0bd001b1-67fe-438d-b712-0d51da65ffee/` ;
les logs et les SHA testés/livrés sont dans `test-results/scene-immersive/isolated-validation/`.
Les deux fichiers livrés correspondent exactement aux fichiers testés.
La revue indépendante a corrigé le plafond de
largeur hérité et les attentes de mouvement des surfaces encore non montées.
Cette preuve ciblée ne remplace ni `verify:pr` avant un push, ni la qualification
de publication du site.
