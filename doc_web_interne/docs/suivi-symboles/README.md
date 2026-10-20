# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation](HANDOFF.md)

**111 packs complets sont publiés**, soit **666 pages équipées** dans les six langues ; **129 packs restent à préparer**. Les 240 symboles partagent le cadre commun, soit 1 440 pages. Le lot 09 ajoute Hibou, Bateau, Grotte, Rose, Éclair et Baleine : huit rôles par symbole, trois scènes et deux phénomènes par image. Le lot 08 de 30 packs intégré en parallèle par la PR490 est conservé et inclus dans cette publication.

Version publique : `1038406132baf06556f6abda8f1620ac4774984b`, [PR494](https://github.com/thannous/dreamer/pull/494), avec les placements de [PR496](https://github.com/thannous/dreamer/pull/496). Déploiement : [Cloudflare Pages](https://ce671c33.noctalia.pages.dev). Lire [la preuve de livraison](../qa/symbol-batch09-delivery-20261020.json).

La qualification Release du site passe ; sa campagne navigateur compte 91 tests, aucun échec, exclusion ou test instable. Les 1 440 pages publiques correspondent au build du master publié. Les six nouveaux packs ont leurs cinq surfaces vérifiées au cours du temps dans les six langues sur desktop et leurs héros sur mobile ; le contrôle public complète cette preuve à 2560×1440 et 390×844, avec contrôle de la source téléchargée à DPR2. Cette preuve navigateur ne qualifie ni un appareil physique, ni une nouvelle version native, ni les FPS. La [PR497](https://github.com/thannous/dreamer/pull/497) a réparé le chargement de la même version du SDK Anthropic pour débloquer les contrôles ; aucun backend n'a été déployé par ce lot.

## Lire les états

- **Atlas / pack d'images** : huit rôles et correspondances dans six langues. **Commun** : cadre partagé et illustration existante, pack encore à préparer.
- **QA / accord / publication** : preuves distinctes liées aux sources. Les 111 QA et les 240 publications sont actuelles. Aucun nouvel accord personnel de Thanh n'est inventé ; son autorisation de publier les lots demandés reste acquise.
- **Historique** : les preuves PR474, PR478, PR485 et la qualification des 30 packs PR490 restent conservées. Une ancienne publication ne valide pas une nouvelle version.
- **Sources** : le lot 09 conserve localement 48 PNG sélectionnés, leurs prompts et SHA dans une archive portable, dont 40 nouvelles images ImageGen et huit réemplois de textures identifiés. [Reçu source](../qa/symbol-batch08-sources-20261020.json). Le nom du dossier et de l'archive garde le numéro de préparation initial, avant l'arrivée du lot 08 concurrent. Les 30 archives privées du lot 08 restent référencées dans [son reçu](../qa/symbol-packs-lot-08-30-20261020.json) et [Drive](https://drive.google.com/drive/folders/1XzmtnMeVfBGWkT6XdLs5hGGI_kBjes0p) ; les archives natives PR474 restent non vérifiées localement.

## Mettre à jour après chaque lot

1. Relire le registre courant avant de choisir les symboles et réserver un numéro de lot distinct. Suivre [le guide](../symbol-atlas-guidelines.md) et la taille de lot demandée par Thanh. Ne pas reprendre aveuglément une ancienne file de production.
2. Codex remet les vrais packs ImageGen ; Claude adapte les trois scènes, six langues et deux phénomènes aux peintures reçues, dans le moteur commun. Les profils préparés avant les médias sont des propositions : les contrôler sur les vraies images avant de les livrer.
3. Utiliser les commandes canoniques `atlas:pack`, `atlas:handoff`, `atlas:receipt` et `symbols:rollout` du package site. Le registre est la source des états ; conserver les sources et leurs archives sans qualifier un fichier par son seul nom.
4. Mettre à jour le classeur existant et le CSV depuis le même rapport : 240 IDs, huit rôles, six langues et preuves actuelles/historiques. Préserver formules, filtre et volets ; recalculer, exporter, rouvrir et inspecter le résultat. Actualiser les empreintes du snapshot.
5. Vérifier le commit avant push, puis le master exact avant publication. Contrôler le résultat public avant de consigner sa publication. Ne pas faire dépendre l'autorisation déjà acquise d'une nouvelle validation subjective.

Sources : [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [langues](../../../docs-src/config/symbol-atlas-locales.json), [registre](../../../docs-src/config/symbol-rollout.json). Le classeur conserve les 489 formules, le filtre `A10:AC250` et les volets `C11` ; recalcul et réouverture vérifiés avec Artifact Tool, sans contrôle de l'application Excel native.
