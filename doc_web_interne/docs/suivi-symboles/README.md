# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation](HANDOFF.md)

Le lot 14 complète **10 packs**, conserve **10 couvertures** et ajoute **70 PNG natifs**. Le candidat contient **240 packs équipés**, soit **1440 pages** ; **0 packs restent à compléter** dans le cadre commun de 240 symboles et 1 440 pages.

**240 QA actuelles** : 10 parcours frais, qualifiant 10 symboles sur le candidat propre `3eadba5f121c1017c032929534d269c330aa5abb` et 230 preuves réutilisées sur leurs entrées inchangées. Le lot est contrôlé dans les six langues à 2560×1440 et 390×844 ; ses 50 captures sont inspectées. Lire [le rapport](../qa/symbol-packs-lot-14-10-20261020.md) et [le reçu](../qa/symbol-packs-lot-14-10-20261020.json). Les sources, prompts et provenance sont dans **[10 archives privées Drive](https://drive.google.com/drive/folders/1Ye1CGz0N6mZfyeyaIziRv6jiPd8u4DwI)**. L’Excel conserve ses 489 formules, son filtre `A10:AC250`, ses volets à `C11` et ses trois règles de couleur.

Les six packs de master #509 sont préservés et indiqués comme réutilisés dans le classeur. Leurs 228 dérivés livrés et configurations publiques sont sauvegardés dans six ZIP distincts sur le Drive des 100 packs. Leur reçu référence une archive native locale absente de ce poste ; cette copie des dérivés ne contient pas les PNG et prompts originaux hérités. Les mises à jour concurrentes de master sont conservées, notamment les variantes PT existantes et [la livraison antérieure du lot 09](../qa/symbol-batch09-delivery-20261020.json). Cette dernière consigne 91 parcours et une publication, avec `sourceClean=false` dû aux bundles générés ; elle reste conservée comme historique, distincte de la qualification actuelle et sans nouvelle publication revendiquée. Les QA, accords et publications du candidat sont des états distincts : **240 / 0 / 0**. Aucune nouvelle publication ou approbation personnelle n’est attribuée à ce lot.

## Lire les états

- **Atlas / pack** : huit rôles et correspondances dans les six langues. Les fichiers présents ne valent pas qualification ou publication.
- **À compléter** : 0 packs manquants ou incomplets. Le CSV distingue aussi les affectations de lot en préparation : ses totaux de registre ne constituent pas le nombre de packs terminés.
- **QA / accord / publication** : seuls les enregistrements dont les sources et les preuves correspondent encore sont actuels. Une source modifiée périme la preuve, qui reste conservée comme historique.
- **Historique** : les reçus PR474, PR478, PR485, les lots précédents et la livraison master du lot 09 restent référencés dans `snapshot.json`. Les compteurs « Publiées » concernent le candidat, pas une nouvelle mesure de disponibilité publique. Une page au cadre commun peut déjà être publiée alors que son pack complet reste à produire.
- **Archives** : empreintes locales, envois réussis et métadonnées Drive vérifiés. Aucun hachage distant ou second téléchargement n’est revendiqué. Les anciens packs sans archive vérifiée restent signalés comme tels.

## Mettre à jour après chaque lot de 30 au maximum

1. Conserver les peintures satisfaisantes et produire les rôles manquants selon [le guide](../symbol-atlas-guidelines.md).
2. Convertir avec le packer existant, contrôler les pages réelles et enregistrer la QA dans [le registre](../../../docs-src/config/symbol-rollout.json). Régénérer `symbol-rollout.json` et le CSV avec `npm run symbols:rollout --prefix apps/site -- --out <dossier>`.
3. Actualiser ce classeur depuis le même rapport ; conserver les 240 IDs, les formules, les filtres et les volets. Recalculer, exporter, rouvrir et inspecter le rendu.
4. Actualiser les empreintes dans `snapshot.json`, vérifier le commit avant chaque push et conserver les limites des preuves. Fusion et publication suivent les autorisations de la conversation et `AGENTS.md`.

Sources : [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [langues](../../../docs-src/config/symbol-atlas-locales.json) et [cadrages sans pack](../../../docs-src/config/symbol-hero-portrait.json). Le classeur est recalculé avec Artifact Tool ; l’application Excel native n’est pas pilotée.

Reconciliation finale des 100 packs : [livraison et limite de sauvegarde](../qa/symbol-packs-final-100-20261022.md). Les trois parcours complémentaires passent également, sans nouvelle publication.

Copies privées Drive autorisées le 22 octobre et vérifiées : [Excel](https://docs.google.com/spreadsheets/d/1TW79LHKvIa8cqX60VV8vI5sP-v43Saiv/edit?usp=drivesdk&ouid=101116459704958679172&rtpof=true&sd=true) · [CSV](https://drive.google.com/file/d/1BQAjbuD2UWPlDfElaJQZ5qcv3ZIe1bau/view?usp=drivesdk). Les empreintes et métadonnées figurent dans le reçu final.

[Index des 100 archives médias actives](https://drive.google.com/file/d/16huw2vqXVUTq-MkbT8YMTqW-RGpfyUnu/view?usp=drivesdk) : utiliser les IDs de cet index lorsque des versions précédentes coexistent dans les dossiers Drive.
