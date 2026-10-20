# Packs des 40 symboles — 20 octobre 2026

Les 40 symboles disposent chacun des huit rôles du site : 38 packs peints ont été
créés (304 PNG natifs) ; les packs Horloge et Bougie existants sont conservés.
Les mêmes images servent les six langues et les 40 couvertures remplacent les
anciens pictogrammes dans le catalogue consommé par l’app.

Les PNG, prompts exacts, références et fichiers pack.json sont conservés dans
l’archive source locale ; une copie privée des 304 PNG a été envoyée sur Drive
en huit ZIP de moins de 100 MiB, avec un manifeste de hachages. Le convertisseur
`atlas:pack` a contrôlé les huit rôles et la vraie transparence des 38 packs.
Les paysages natifs mesurent 1672×941, les portraits 941×1672 et les détourages
1254×1254. Aucun fichier n’a été agrandi artificiellement.

Le moteur commun conserve la peinture fixe et anime deux effets séparés. Sa
configuration accepte maintenant un centre explicite et des réglages par scène
pour placer une petite lueur sur le sujet, notamment la corne de la licorne.
Les réglages et les fichiers des packs antérieurs restent identiques.

La preuve canonique est [le reçu de qualification résumé](symbol-packs-40-20261020.json).
Les **40 parcours passent** sur le commit propre
`22c1871989966d0b303739c55b7338d0a58618de`, dans les six langues à 2560×1440
et 390×844. Les 200 captures des pages ont été inspectées, avec les PNG sources.
Le contrôle porte aussi sur les scènes, les deux canaux animés, les ratios, le
masquage du détourage, la peinture fixe et la réduction des mouvements. Le build
et `docs:check` passent. Le reçu final `verify:pr` figure dans la PR.

Commande de rejeu :

```sh
E2E_WEB_PORT=8129 E2E_WORKERS=4 mise exec -- npm run test:testerarmy:site -- run --grep 'new symbol packs:'
```

Artefact : `tools/e2e/.e2e/site-web/1792464474056-26075-06347a13-71e6-4a4e-8f3e-ef85800ef1b9`.
TesterArmy 0.21.2, moteur web 0.15.2. Les 15 autres tests du fichier sont exclus
par cette sélection : ce passage ne constitue pas la campagne Release complète.

La revue indépendante a identifié une capture mobile prise trop tôt. Le commit
`22c1871989` ajoute la borne basse de l’écran et le hit-test du titre, puis vérifie
les deux effets sur les trois miniatures mobiles. Le delta a été relu et les 40
parcours rejoués. Les captures antérieures sont remplacées par ce dernier reçu.

Cette livraison est locale et en branche : aucune approbation visuelle du
propriétaire, fusion, publication ou qualification native n’est déclarée. Les URL
publiques utilisées par l’app deviendront disponibles après publication du site.
Les archives PNG antérieures de Bougie et Horloge ne sont pas dans la nouvelle
archive ; leurs 16 rôles servis restent conservés dans Git.
