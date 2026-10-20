# Passation — images Codex, code Claude, publication Codex

## Livraison actuelle du lot 09

Les six packs Hibou, Bateau, Grotte, Rose, Éclair et Baleine sont publiés dans les six langues sur `1038406132baf06556f6abda8f1620ac4774984b` ([PR494](https://github.com/thannous/dreamer/pull/494), placements [PR496](https://github.com/thannous/dreamer/pull/496)). Le total courant est **111 packs, 129 restants**, 666 pages équipées parmi 1 440 pages communes. [Preuve complète](../qa/symbol-batch09-delivery-20261020.json) ; [suivi](README.md).

Codex conserve les 48 sources sélectionnées, prompts, SHA et huit rôles dans `output/noctalia-symbols-batch08-2026-10-20/source-library-batch08-v1.zip` du checkout principal ; [reçu](../qa/symbol-batch08-sources-20261020.json). Le nom initial du dossier est conservé, mais le registre attribue ces six symboles au lot 09. Le lot 08 de 30 packs arrivé en parallèle est préservé : ses archives privées et sa preuve ciblée sont décrites dans [son reçu](../qa/symbol-packs-lot-08-30-20261020.json). Ne pas régénérer les images déjà sélectionnées.

Claude a intégré les vraies peintures et corrigé les textures localisées qui masquaient des sujets. Les profils A/B doivent être revus sur les vrais médias, aux dimensions réelles, avant de compter le pack terminé. La publication et les preuves actuelles sont consignées ; aucun accord personnel de Thanh n'a été inventé. Les preuves antérieures restent historiques, sans être effacées.

## Reprendre sans perdre le travail

- Ne pas régénérer les 210 PNG sélectionnés. Les variantes remplacées sont conservées, mais seuls les fichiers sélectionnés dans les manifests et ZIP courants servent le site.
- Ne pas relancer `manage.mjs configure` du dossier local du lot 08 : sa base précède les mises à jour de master et écraserait des preuves plus récentes. Les 30 profils, langues et scènes sont déjà configurés. Modifier les JSON canoniques directement si nécessaire.
- Terminer la vérification locale sur le commit livré avant tout push. Remettre une branche et une PR avec le commit vérifié et le résultat de `verify:pr`. Une preuve ciblée de 30 parcours n'est pas une campagne Release complète.
- Réexaminer le registre courant avant le prochain lot : 129 symboles restent sans pack. Le lot 09 est déjà occupé par les six symboles ci-dessus ; les anciennes files de production doivent être rapprochées des IDs actuels avant une nouvelle génération. Respecter la taille de lot demandée par Thanh.
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
