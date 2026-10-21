# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation](HANDOFF.md)

Le lot 13 complète **30 packs**, conserve **29 couvertures** et ajoute **211 PNG natifs**. Le candidat contient **230 packs équipés**, soit **1380 pages** ; **10 packs restent à compléter** dans le cadre commun de 240 symboles et 1 440 pages.

**230 QA actuelles** : 30 parcours frais, qualifiant 30 symboles sur le candidat propre `e03821783020a61aeaaa58d22886e2118781efaa` et 200 preuves réutilisées sur leurs entrées inchangées. Le lot est contrôlé dans les six langues à 2560×1440 et 390×844 ; ses 150 captures sont inspectées. Lire [le rapport](../qa/symbol-packs-lot-13-30-20261020.md) et [le reçu](../qa/symbol-packs-lot-13-30-20261020.json). Les sources, prompts et provenance sont dans **[30 archives privées Drive](https://drive.google.com/drive/folders/1ufCuEvPuIMIs8KZiSlji5KNO42ZQTkJI)**. L’Excel conserve ses 489 formules, son filtre `A10:AC250`, ses volets à `C11` et ses trois règles de couleur.

Les six packs de master #509 sont préservés et indiqués comme réutilisés dans le classeur. Leurs 228 dérivés livrés et configurations publiques sont sauvegardés dans six ZIP distincts sur le Drive des 100 packs. Leur reçu référence une archive native locale absente de ce poste ; cette copie des dérivés ne contient pas les PNG et prompts originaux hérités. Les mises à jour concurrentes de master sont conservées, notamment les variantes PT existantes et [la livraison antérieure du lot 09](../qa/symbol-batch09-delivery-20261020.json). Cette dernière consigne 91 parcours et une publication, avec `sourceClean=false` dû aux bundles générés ; elle reste conservée comme historique, distincte de la qualification actuelle et sans nouvelle publication revendiquée. Les QA, accords et publications du candidat sont des états distincts : **230 / 0 / 0**. Aucune nouvelle publication ou approbation personnelle n’est attribuée à ce lot.

## Lire les états

- **Atlas / pack** : huit rôles et correspondances dans les six langues. Les fichiers présents ne valent pas qualification ou publication.
- **À compléter** : 10 packs manquants ou incomplets. Le CSV distingue aussi les affectations de lot en préparation : ses totaux de registre ne constituent pas le nombre de packs terminés.
- **QA / accord / publication** : seuls les enregistrements dont les sources et les preuves correspondent encore sont actuels. Une source modifiée périme la preuve, qui reste conservée comme historique.
- **Historique** : les reçus PR474, PR478, PR485, les lots précédents et la livraison master du lot 09 restent référencés dans `snapshot.json`. Les compteurs « Publiées » concernent le candidat, pas une nouvelle mesure de disponibilité publique. Une page au cadre commun peut déjà être publiée alors que son pack complet reste à produire.
- **Archives** : empreintes locales, envois réussis et métadonnées Drive vérifiés. Aucun hachage distant ou second téléchargement n’est revendiqué. Les anciens packs sans archive vérifiée restent signalés comme tels.

## Mettre à jour après chaque lot de 30 au maximum

1. Conserver les peintures satisfaisantes et produire les rôles manquants selon [le guide](../symbol-atlas-guidelines.md).
2. Convertir avec le packer existant, contrôler les pages réelles et enregistrer la QA dans [le registre](../../../docs-src/config/symbol-rollout.json). Régénérer `symbol-rollout.json` et le CSV avec `npm run symbols:rollout --prefix apps/site -- --out <dossier>`.
3. Actualiser ce classeur depuis le même rapport ; conserver les 240 IDs, les formules, les filtres et les volets. Recalculer, exporter, rouvrir et inspecter le rendu.
4. Actualiser les empreintes dans `snapshot.json`, vérifier le commit avant chaque push et conserver les limites des preuves. Fusion et publication suivent les autorisations de la conversation et `AGENTS.md`.

Sources : [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [langues](../../../docs-src/config/symbol-atlas-locales.json) et [cadrages sans pack](../../../docs-src/config/symbol-hero-portrait.json). Le classeur est recalculé avec Artifact Tool ; l’application Excel native n’est pas pilotée.
