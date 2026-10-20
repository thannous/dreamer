# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation Codex / Claude](HANDOFF.md)

Instantané du 20 octobre 2026, après la PR [474](https://github.com/thannous/dreamer/pull/474), sur la source `8e38590c85ebca2cbbef732b179eb47a8b2800d8` : **75 symboles intégrés et 165 encore à intégrer**, sur 240. Les 75 couvrent **450 pages Atlas**, dans les langues FR, EN, ES, DE, IT et PT-BR. Le catalogue complet représente 1 440 pages.

La PR ajoute 38 packs complets ; Horloge et Bougie sont réemployés parmi les 40 symboles contrôlés. Les huit rôles sont présents pour chaque nouveau pack. Le contrôle statique du 20 octobre confirme 1 444 dérivés présents, la transparence réelle des plaques et des deux textures, et deux canaux configurés pour le paysage, le portrait, la plaque et chacune des trois scènes. Il ne constitue pas un nouveau contrôle temporel dans le navigateur.

## Lire les états

- **Intégré** : les images et les données existent pour les six langues.
- **QA / accord / publication** : chaque étape exige sa propre preuve pour la version concernée.
- **Historique / stale** : une preuve existe mais sa source a changé ; elle reste conservée. Les 40 contrôles de la PR474 et les 37 publications antérieures sont dans ce cas depuis la modification du générateur partagé. Un compteur actuel à zéro ne signifie pas que les anciennes pages n'ont jamais été publiées.
- **Archive référencée** : l'archive PNG est décrite par la preuve du lot ; sa disponibilité locale n'est pas affirmée. Les 304 PNG de la PR474 restent nécessaires pour reprendre une génération. Les dérivés versionnés permettent l'intégration et les réglages d'animation.

## Mettre à jour après chaque lot

1. Modifier les sources et consigner les preuves dans `docs-src/config/symbol-rollout.json`, sans attribuer une QA ou une publication à partir de la seule présence d'images.
2. Régénérer le rapport depuis le checkout propre du candidat, avec des fins de ligne cohérentes :

   ```sh
   npm run symbols:rollout --prefix apps/site -- --out /tmp/noctalia-symbol-rollout
   ```

3. Comparer le rapport au tableau : IDs uniques, 240 lignes, huit rôles des packs intégrés, six langues et étapes de livraison. Actualiser le classeur existant en conservant formules, filtres et volets ; remplacer le CSV avec celui du même rapport. Le classeur est un export de consultation, pas une seconde source d'autorité.
4. Mettre à jour la source et les empreintes dans `snapshot.json`. Recalculer, exporter et rouvrir le XLSX ; vérifier les formules et un aperçu. Après une publication autorisée, consigner le SHA réellement publié et les contrôles publics avant de changer son statut.

Sources autoritatives : [registre](../../../docs-src/config/symbol-rollout.json), [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [manifeste des images](../../../docs-src/config/symbol-atlas-six-assets.json), [guide des illustrations](../symbol-atlas-guidelines.md). Les valeurs d'un export ne remplacent pas le registre ni ses preuves.
