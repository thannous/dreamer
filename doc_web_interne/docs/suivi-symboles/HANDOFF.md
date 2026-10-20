# Passation — packs de symboles par lots de 30

## Lot 08 prêt à livrer

Responsable d'intégration : **Codex**. Branche : `codex/symbol-images-lot-08-30`, master intégré : `f71600c97` (preuves PR487 ; code qualifié identique à master `76d7e577d`). Candidat navigateur propre : `9184f780a23f21687350020fa3448d58e4e0aadd` ; les mises à jour de suivi ultérieures réutilisent cette preuve sans revendiquer un nouveau parcours.

**30 couvertures conservées, 210 nouveaux PNG, 30 packs complets et 1 140 dérivés**. Les 30 parcours passent dans les six langues à 2560×1440 et 390×844. Les 150 captures et les 30 familles de sources ont été inspectées. Lire [le rapport](../qa/symbol-packs-lot-08-30-20261020.md), [le reçu](../qa/symbol-packs-lot-08-30-20261020.json), [l'Excel et le CSV](README.md). Les originaux, prompts et provenance sont dans [30 ZIP privés Drive](https://drive.google.com/drive/folders/1XzmtnMeVfBGWkT6XdLs5hGGI_kBjes0p) et dans le dossier local `output/symbol-packs-lot-08-30-20261020` du checkout principal. `RECUPERATION.json` décrit la reprise ; `production-queue.json` contient les prochains lots. Les versions rejetées restent conservées localement.

Le candidat contient **105 packs et 135 restants**, soit 630 pages équipées parmi les 1 440 pages du cadre commun. La migration du Tigre au moteur commun provient de master PR485 ; ce lot ne revendique pas un nouveau parcours Tigre. Les 30 QA sont actuelles pour le candidat ; les anciennes preuves restent historiques car le générateur a changé. Aucun accord personnel de Thanh ou nouvelle publication n'est consigné. Les publications PR478 et PR485 demeurent des livraisons historiques vérifiées, pas des preuves de ce nouveau lot.

## Reprendre sans perdre le travail

- Ne pas régénérer les 210 PNG sélectionnés. Les variantes remplacées sont conservées, mais seuls les fichiers sélectionnés dans les manifests et ZIP courants servent le site.
- Ne pas relancer `manage.mjs configure` du dossier local du lot 08 : sa base précède les mises à jour de master et écraserait des preuves plus récentes. Les 30 profils, langues et scènes sont déjà configurés. Modifier les JSON canoniques directement si nécessaire.
- Terminer la vérification locale sur le commit livré avant tout push. Remettre une branche et une PR avec le commit vérifié et le résultat de `verify:pr`. Une preuve ciblée de 30 parcours n'est pas une campagne Release complète.
- Poursuivre ensuite avec la file persistée : lot 09 de 30, puis 30, 30, 30 et 15. Réexaminer le catalogue courant avant de produire pour éviter les doublons d'un autre travail.
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

La preuve du lot 08 qualifie le navigateur local, sans appareil physique, application native, mesure de fluidité ou publication. Le premier passage a révélé deux divergences de ponctuation PT, corrigées dans le générateur puis rejouées : **30 réussites, zéro échec ou ignoré, 55 parcours hors sélection**. La revue a aussi corrigé les associations hôpital ES et école IT, sans changer leur contenu éditorial. Les différences mineures sans défaut visible ne justifient pas des retouches sans fin.
