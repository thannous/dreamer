# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation](HANDOFF.md)

Le lot 10 complète **29 packs**, conserve leurs couvertures peintes et ajoute **203 PNG natifs**. Le candidat contient **140 packs équipés**, soit **840 pages** dans les six langues ; **100 packs restent à compléter**. Le cadre commun comprend 240 symboles et 1 440 pages.

**59 QA actuelles** : 29 du lot 10 sur le candidat propre `fc0d47528b092ffae3e49cc020fbc27e902dc01b`, et 30 du lot 08 réutilisées sur leurs entrées inchangées. Le nouveau lot a été contrôlé dans les six langues à 2560×1440 et 390×844, avec inspection de 145 captures. Lire [le rapport du lot 10](../qa/symbol-packs-lot-10-30-20261020.md) et [son reçu](../qa/symbol-packs-lot-10-30-20261020.json). Ses sources, prompts et provenance sont conservés dans [29 archives privées Drive](https://drive.google.com/drive/folders/1fUiZ6cBJMwNNV54MYLLPhvwFd47YfT6Q). L’Excel conserve ses formules, filtres et volets.

Le lot 08 a été fusionné dans master par la PR490. Six autres packs ont rejoint master dans le lot 09 ; Bateau en fait partie et ses images servies sont conservées. Leurs sources sont archivées localement d’après le reçu concurrent ; aucune sauvegarde Drive n’est revendiquée pour ces six packs. Notre lot devient le lot 10. La fusion ou la publication du lot 10, ainsi qu’un accord visuel personnel, ne sont pas consignés.

## Lire les états

- **Atlas / pack d'images** : huit rôles et correspondances dans six langues. La présence des fichiers ne vaut pas qualification ou publication.
- **Commun** : cadre partagé et illustration existante ; le pack reste à compléter.
- **QA / accord / publication** : preuves distinctes, liées aux entrées du candidat. La correction du générateur du lot 08 a périmé les preuves antérieures ; les 30 QA du lot 08 restent actuelles sur leurs entrées inchangées.
- **Historique** : la PR485 a publié le Tigre commun et les 1 440 pages sur `76d7e577dfb7eb5251b0898e994e3a5210bfd56c` ; les 75 QA et 240 publications restent décrites dans [son reçu](../qa/symbol-tiger-common-motion-20261020.json) et `snapshot.json`. La [livraison PR478](../qa/symbol-pages-uniform-20261020.json) reste également conservée. Les 40 contrôles PR474 et 37 publications antérieures restent historiques. Le compteur « Publiées » du classeur concerne les preuves actuelles du candidat, pas la disponibilité du site historique.
- **Archives** : les 29 archives du lot 10 et les 30 du lot 08 ont leurs empreintes locales et leurs métadonnées Drive vérifiées. Pour les anciens packs PR474, la disponibilité locale de leur archive demeure non affirmée.

## Mettre à jour après chaque lot de 30 au maximum

1. Conserver les peintures satisfaisantes ; produire les rôles manquants du pack de huit fichiers. Suivre [le guide](../symbol-atlas-guidelines.md), avec un portrait composé pour mobile, une plaque et deux effets réellement transparents, et trois scènes correspondant au contenu.
2. Intégrer avec le convertisseur et le moteur commun, puis contrôler les pages réelles et les deux effets. Consigner les preuves dans [le registre](../../../docs-src/config/symbol-rollout.json), puis régénérer le rapport :

   ```sh
   npm run symbols:rollout --prefix apps/site -- --out /tmp/noctalia-symbol-rollout
   ```

3. Actualiser le classeur existant et son CSV depuis le même rapport : 240 IDs uniques, huit rôles, six langues et preuves actuelles/historiques. Conserver les formules, filtres et volets ; recalculer, exporter, rouvrir et inspecter le classeur. Le registre fait autorité.
4. Actualiser `snapshot.json` avec les empreintes des exports. Vérifier le commit avant chaque push. Le merge et la publication suivent les autorisations de la conversation et `AGENTS.md` ; ne compter une livraison qu'après son contrôle réel.

Sources : [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [langues](../../../docs-src/config/symbol-atlas-locales.json), [cadrages sans pack](../../../docs-src/config/symbol-hero-portrait.json). Le classeur conserve ses 489 formules, son filtre `A10:AC250` et ses volets à `C11`. Il a été recalculé et rouvert, sans pilotage de l'application Excel native.
