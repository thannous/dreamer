# Passation — packs de symboles par lots de 30

## Lot 10 prêt à livrer

Responsable d’intégration : **Codex**. Branche : `codex/symbol-images-lot-09-30`, master intégré : `1038406132baf06556f6abda8f1620ac4774984b`. Candidat navigateur propre : `fc0d47528b092ffae3e49cc020fbc27e902dc01b`. Les modifications de suivi ultérieures réutilisent cette preuve sans revendiquer un nouveau parcours.

**29 couvertures conservées, 203 nouveaux PNG, 29 packs et 1 102 dérivés**. Les 29 parcours passent dans les six langues aux deux tailles demandées. Les 145 captures et les 29 familles de sources ont été inspectées. Les 72 variantes portugaises manquantes ont été traduites fidèlement depuis leurs variantes anglaises existantes, puis relues indépendamment ; les interprétations longues existantes sont préservées. La scène accident d’avion utilise l’indice italien 6.

Lire [le rapport](../qa/symbol-packs-lot-10-30-20261020.md), [le reçu](../qa/symbol-packs-lot-10-30-20261020.json) et [le suivi Excel/CSV](README.md). Les originaux, prompts et provenance sont dans [29 ZIP privés Drive](https://drive.google.com/drive/folders/1fUiZ6cBJMwNNV54MYLLPhvwFd47YfT6Q) et dans `output/symbol-packs-lot-09-30-20261020` du checkout principal. `RECUPERATION.json` décrit la reprise ; la file persistée du lot 08 conserve l’ordre des prochains lots. Les versions remplacées restent conservées localement.

Le candidat contient **140 packs, 100 restants et 59 QA actuelles**. Les 30 QA du lot 08 restent valides sur leurs entrées inchangées ; ce lot ajoute 29 parcours frais. Le lot 08 est fusionné par la PR490, sans nouvelle qualification de production de notre part. Aucun accord personnel de Thanh, fusion ou publication du lot 10 n’est consigné. Les livraisons PR478 et PR485 restent historiques.

## Reprendre sans perdre le travail

- Ne pas régénérer les 203 PNG actifs du lot 10 ; ses sept variantes Bateau inutilisées restent sauvegardées. Les 210 PNG du lot 08 restent également conservés. Les variantes remplacées sont conservées, mais seuls les fichiers sélectionnés dans les manifests et ZIP courants servent le site.
- Ne pas relancer `manage.mjs configure` du dossier local du lot 08 : sa base précède les mises à jour de master et écraserait des preuves plus récentes. Les profils, langues et scènes sont déjà configurés. Modifier les JSON canoniques directement si nécessaire.
- Terminer la vérification locale sur le commit livré avant tout push. Remettre une branche et une PR avec le commit vérifié et le résultat de `verify:pr`. Une preuve ciblée de 29 parcours n'est pas une campagne Release complète.
- Poursuivre ensuite avec la file persistée : lots 11, 12 et 13 de 30, puis lot 14 de 10. Réexaminer le catalogue courant avant de produire pour éviter les doublons d'un autre travail.
- Enregistrer chaque image, prompt et provenance dès sa réception ; archiver chaque pack terminé et mettre à jour le suivi par lot. Ne pas remettre le suivi ou les rapports internes sur Drive sans autorisation appropriée à ces documents.

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

Utiliser `atlas:pack`, `atlas:handoff`, `atlas:gallery` et `atlas:receipt` du package `apps/site` ([catalogue](../../../scripts/README.md#atlas-pages-asset-packs-handoffs-and-qualification-receipts)). Ne pas créer un moteur ou composant par symbole. Modifier `docs-src/`, jamais `docs/` généré. Garder les chemins à empreinte.

Les placements acceptent `place.at: [x, y]` (centre relatif), et `place.zoom` de 0,1 à 4 pour une petite lueur locale. `motion.scenes[sceneId]` remplace les deux effets de `motion.thumb` pour cette scène. Recalculer avec `atlasSixBox` sur les dimensions réelles.

## Contrôle proportionné

Piloter un symbole représentatif, puis contrôler le lot affecté sur les pages réelles : deux tailles, six langues, trois variantes, effets dans le temps, transparence, titre, scroll, réduction des mouvements et peinture stable. Vérifier que mobile utilise le portrait dédié et ne télécharge pas la plaque masquée. Conserver le reçu, la révision et la commande exacte ; réutiliser seulement les preuves inchangées.

La preuve du lot 10 qualifie le navigateur local, sans appareil physique, application native, mesure de fluidité ou publication : 29 réussites, zéro échec ou ignoré. Les autres parcours sont hors sélection. Les différences mineures sans défaut visible ne justifient pas des retouches sans fin.
