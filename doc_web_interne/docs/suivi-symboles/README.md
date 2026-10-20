# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV](symbol-rollout.csv) · [Passation](HANDOFF.md)

**117 packs complets sont publiés**, soit **702 pages équipées** dans les six langues. **123 packs restent à préparer**. Les 240 symboles ont le cadre commun, soit 1 440 pages. Le lot 10 ajoute Abeille, Volcan, Bague, Cascade, Tortue et Masque : huit rôles, trois scènes distinctes et deux phénomènes animés sur chaque surface.

Version publique : `736a14dc4b55127e1e52b51eb50009e66323a387`, [PR509](https://github.com/thannous/dreamer/pull/509), avec l’implémentation de Claude et les peintures de Codex. Déploiement : [Cloudflare Pages](https://fea97f88.noctalia.pages.dev). [Preuve de livraison](../qa/symbol-lot10-delivery-20261020.json).

La qualification Release du site passe : 97 tests navigateur, sans échec, exclusion ou test instable. Les 1 440 pages publiques correspondent au build publié. La campagne couvre les cinq surfaces des six nouveaux packs dans les six langues sur desktop et leurs couvertures sur mobile. L’inspection publique complète cette preuve à 2560×1440 et 390×844 DPR2, avec contrôle de la source portrait, des scènes et des animations. Cette preuve ne qualifie pas un appareil physique, un binaire natif ou les FPS.

## Lire les états

- **Atlas / pack d’images** : huit rôles et trois scènes dans six langues. **Commun** : cadre partagé et image existante, pack encore à préparer.
- **QA / accord / publication** : étapes distinctes liées aux empreintes des sources. Les 117 QA et les 240 publications sont actuelles. Aucun accord visuel individuel de Thanh n’est inventé ; l’autorisation de publier les lots demandés est acquise.
- **Historique** : les preuves des lots précédents restent conservées. Une publication ancienne ne valide pas un rendu modifié.
- **Sources du lot 10** : 36 peintures ImageGen sélectionnées et 12 textures réutilisées à l’octet près. Les 48 PNG, prompts, SHA et manifestes de rôles sont conservés dans une archive locale portable. [Reçu des sources](../qa/symbol-lot10-sources-20261020.json). Les archives natives des autres lots restent décrites dans leurs reçus existants.

## Mettre à jour après chaque lot

1. Relire le registre avant de choisir les six IDs sans pack et réserver un numéro libre. Suivre [la guideline](../symbol-atlas-guidelines.md).
2. Codex génère les peintures ; Claude adapte les scènes, langues et profils de mouvement aux vrais médias. Vérifier les placements alpha par surface et par scène, puis les comportements visibles sur mobile et grand écran.
3. Employer les commandes canoniques `atlas:pack`, `atlas:handoff`, `atlas:receipt`, `symbols:dictionary:sync` et `symbols:rollout`. Le registre porte les étapes et leurs preuves.
4. Publier le master exact après sa qualification Release. Contrôler le résultat public avant d’ajouter les enregistrements de publication.
5. Actualiser Excel et CSV depuis le même rapport. Préserver les 240 IDs, formules, filtre et volets, recalculer, exporter, rouvrir et contrôler les zones modifiées. Mettre à jour les empreintes du snapshot.

Sources : [profils](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [langues](../../../docs-src/config/symbol-atlas-locales.json), [registre](../../../docs-src/config/symbol-rollout.json). Classeur : 489 formules, filtre `A10:AC250`, volets `C11`. Recalcul et réouverture avec Artifact Tool ; application Excel native non contrôlée.
