# Passation — packs de symboles par lots de 30

## Lot 14 qualifié localement

Responsable : **Codex**. Branche : `codex/symbol-images-final-100`. Master intégré : `a51fd4fad506490fd0ca04e18ff1a1bcf6056901`. Candidat navigateur propre : `3eadba5f121c1017c032929534d269c330aa5abb`. Le suivi ultérieur réutilise cette preuve sans revendiquer un nouveau parcours.

**10 couvertures conservées, 70 nouveaux PNG, 10 packs et 380 dérivés.** Les 10 parcours passent dans les six langues à 2560×1440 et 390×844. Les 50 captures et les 10 familles de sources sont inspectées. Les interprétations longues et les traductions concurrentes de master sont préservées ; seules les cartes PT manquantes pour les variantes choisies sont ajoutées.

[Rapport](../qa/symbol-packs-lot-14-10-20261020.md) · [Reçu](../qa/symbol-packs-lot-14-10-20261020.json) · [Suivi Excel/CSV](README.md). Les sources, prompts et provenance sont dans [10 ZIP privés Drive](https://drive.google.com/drive/folders/1Ye1CGz0N6mZfyeyaIziRv6jiPd8u4DwI) et dans `output/symbol-packs-final-100-20261020/lot-14` du checkout principal. `RECUPERATION.json` et `plan.json` permettent la reprise ; ne pas régénérer les fichiers déjà enregistrés.

État courant : **240 packs, 0 à compléter, 240 QA actuelles**. Les preuves historiques, dont la publication master du lot 09, restent conservées. Aucun accord personnel de Thanh, fusion de cette branche ou nouvelle publication n’est déclaré pour le lot.

## Reprendre sans perdre le travail

- Les 100 packs demandés sont intégrés et contrôlés ; aucune génération ne reste dans cette file. Les 94 nouvelles archives natives et les six sauvegardes des dérivés hérités sont sur Drive. Il reste à retrouver l’archive native source-library-lot10-v1.zip des six packs hérités ; ne pas les régénérer.
- Les plans, prompts et références des prochains lots sont conservés dans `output/symbol-packs-final-100-20261020`. Les indices PT de la préparation initiale ont été rapprochés de master : 60 cartes manquantes sont préparées pour les 20 symboles du lot 12 concernés, sans remplacer les variantes existantes de master.
- Utiliser les intégrateurs qui mettent à jour les JSON courants. Ne pas relancer un ancien configurateur qui restaure une base historique. Le moteur et les composants restent communs.
- Sauvegarder chaque PNG dès réception, puis chaque pack sur Drive. Actualiser Excel et CSV par lot. Ne pas transférer les rapports internes ou le suivi vers Drive sans autorisation propre à ces documents.
- Passer `verify:pr` sur le commit exact avant chaque push. La preuve ciblée du lot n’est pas une campagne Release complète. Conserver les limites locales, natives et publiques distinctes.

## Direction artistique et mouvement

Peinture onirique détaillée, nette, encre presque noire `#0A0514`, indigo et violet ; lumière ivoire et accents champagne localisés. Diversifier les sujets et environnements ; aucun texte, logo, filigrane ou interface peinte. Utiliser les références validées pour le style, puis la couverture propre au symbole pour les déclinaisons. Préserver les fichiers natifs, sans agrandissement artificiel ni promesse de 4K.

Chaque pack comporte hero 16:9, portrait composé en 9:16, plaque au contour organique sur alpha, trois scènes fidèles au contenu et deux effets transparents horizontaux distincts. Sujet à droite et bas gauche sombre sur desktop ; sujet complet dans les deux tiers supérieurs du portrait, bas sombre pour le titre. La brume reste localisée.

Deux phénomènes perceptibles sur chaque surface visible : hero, plaque et trois scènes. Adapter leur taille, position et intensité à la peinture avec les configurations communes ; la lumière suit sa source. La peinture reste stable. Pas de vidéo/GIF, particules énormes, motifs répétitifs, coutures ou clignotements rapides. Les images sont communes aux six langues.

## Sources et commandes

| Besoin | Source |
| --- | --- |
| Scènes, positions et deux effets par composition | `docs-src/config/symbol-atlas-pilots.json` |
| Huit rôles, tailles et dérivés | `docs-src/config/symbol-atlas-six-assets.json` |
| Correspondances FR/EN/ES/DE/IT/PT-BR | `docs-src/config/symbol-atlas-locales.json` |
| Lots, QA, accord et publication | `docs-src/config/symbol-rollout.json` |
| Cadrage sans pack, à retirer lors de l'ajout d'un portrait dédié | `docs-src/config/symbol-hero-portrait.json` |
| Assemblage des pages | `docs-src/static/scripts/generate-symbol-pages.js` |
| Géométrie commune site/app | `scripts/lib/atlas-motion.js` |
| Animation commune | `docs-src/static/js/symbol-living/`, chemin actif déclaré par le générateur |
| Copie pour l'application | `npm run symbols:dictionary:sync` régénère `data/app/symbol-atlas.json` |

Utiliser `atlas:pack`, `atlas:handoff`, `atlas:gallery` et `atlas:receipt` du package `apps/site` ([catalogue](../../../scripts/README.md#atlas-pages-asset-packs-handoffs-qualification-receipts-and-review-galleries)). Ne pas créer un moteur ou composant par symbole. Modifier `docs-src/`, jamais `docs/` généré. Garder les chemins à empreinte.

Les placements acceptent `place.at: [x, y]` (centre relatif), et `place.zoom` de 0,1 à 4 pour une petite lueur locale. `motion.scenes[sceneId]` remplace les deux effets de `motion.thumb` pour cette scène. Recalculer avec `atlasSixBox` sur les dimensions réelles.

## Contrôle proportionné

Piloter un symbole représentatif, puis contrôler le lot affecté sur les pages réelles : deux tailles, six langues, trois variantes, effets dans le temps, transparence, titre, scroll, réduction des mouvements et peinture stable. Vérifier que mobile utilise le portrait dédié et ne télécharge pas la plaque masquée. Conserver le reçu, la révision et la commande exacte ; réutiliser seulement les preuves inchangées.

La preuve du lot 14 qualifie le navigateur local : 10 réussites, zéro échec ou ignoré, 256 parcours hors sélection. Elle ne qualifie pas une application native, un appareil physique, les FPS ou une nouvelle publication.

Reconciliation finale des 100 packs : [livraison et limite de sauvegarde](../qa/symbol-packs-final-100-20261022.md). Les trois parcours complémentaires passent également, sans nouvelle publication.
