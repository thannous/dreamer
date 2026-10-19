# Rétrospective — illustrations vivantes des symboles

18 octobre 2026. Périmètre : passage du Tigre au lot Serpent, Mer, Forêt, Maison, Chute et Papillon, jusqu’à la révision produit `f3c4ed7caf2458c2c7af35d220658778de747458`. Analyse des échanges, commits et preuves conservées ; aucune nouvelle génération ou publication.

## Conclusion

Mon diagnostic est que les reprises après une traduction incomplète du Tigre en critères de production constituent la principale cause évitable. Ce classement est qualitatif, sans chronométrage par cause. J’ai lancé six packs avant de verrouiller la fidélité graphique, toutes les surfaces et les deux phénomènes par image. La coordination des imports et certains contrôles navigateur ont ensuite ajouté des cycles. Le moteur partagé et le guide existent maintenant : la suite doit produire des contenus et des réglages dans ce cadre, sans refaire une page ou un moteur par symbole.

Les retours de Thanh ont révélé des omissions réelles. La palette et la composition latérale du Tigre étaient déjà des références ; leur correction ne doit pas être comptée comme une nouvelle direction utilisateur. Le retrait du bouton pause était, lui, une décision ultérieure légitime.

## Ce que les traces permettent de mesurer

| Observation | Portée de la mesure |
| --- | --- |
| 12 héros/portraits repris pour la marque | Reprise documentée vers l’identité Noctalia ; durée de génération non mesurée. |
| 30 sources complémentaires sélectionnées, dont 2 réemplois | Elles complètent les plaques, scènes et seconds effets. Ce travail utile n’est pas entièrement du gaspillage ; son lancement tardif a créé un second cycle. |
| 5 corrections ciblées pendant cet enrichissement | Morsure du Serpent deux fois, bord alpha de Mer, rayons de Forêt, pollen de Papillon. |
| 3 campagnes automatisées qualifiées : 64,25 s, 62,33 s et 59,63 s | 3 min 06,21 s d’exécution cumulée, hors builds, préparation, transferts et revue visuelle. Leurs périmètres diffèrent. |
| Un appel navigateur de 37 min 38,946 s | Attente observée le 18/10 de 18:50:31 à 19:28:10, heure de Paris, pour vérifier la galerie. Cause non établie ; aucune lenteur du site n’en est déduite. |

Il n’existe pas de chronométrage comparable du travail complet. Ces données ne permettent ni un total d’heures productives ni une promesse de gain chiffré.

## Causes et corrections de méthode

| Priorité | Ce qui a ralenti | Ce qui doit changer |
| --- | --- | --- |
| 1 | « Très différents » a été traduit en nouvelles dominantes, trop éloignées de Noctalia. | Joindre la même référence validée à chaque brief. Varier sujet, composition, profondeur et phénomènes dans la palette commune. |
| 1 | Le premier lot était incomplet face au Tigre : décor latéral, scènes illustrées et inventaire A/B insuffisamment formalisés. | Décrire les huit rôles et quatre profils avant production ; terminer une fiche complète avant de paralléliser les nouveaux packs. |
| 1 | Transmissions Claude/Codex sur des bases différentes : préfixes v1/v2 incohérents, puis conflit avec le correctif local du raccord. | Un intégrateur des fichiers partagés. Une remise regroupe base, patch ou branche, sources sélectionnées et contrôles exécutés ; annoncer toute correction locale avant la remise suivante. |
| 2 | Environnement de qualification préparé tard : échec Windows avant le SDK, puis tests Linux verts mais cycle de qualification incomplet. | Réutiliser le runner WSL qualifié et essayer un parcours complet avant une campagne. Vérifier le reçu de qualification, au-delà du nombre de tests verts. |
| 2 | Nombreuses manipulations navigateur et captures ; le retour d’un appel a pris plus de 37 minutes. | Réserver les interactions manuelles au jugement visuel et aux anomalies ; employer le runner existant pour les contrôles répétitifs. Faire de petites opérations bornées et reprendre sur un contexte frais après navigation. |
| 2 | Recettes spécialisées par chemin/version et plusieurs dossiers de preuve rendent la reprise coûteuse. | Un rapport courant par lot pointe vers les sources et campagnes immuables. Adapter les recettes existantes en outils paramétrables seulement là où une répétition réelle le justifie. |

La revue sémantique reste indispensable : une morsure doit se lire à la taille de vignette. Inversement, un doute sur une petite planche doit être vérifié dans l’image individuelle avant de régénérer ; le signalement erroné sur la mue en est l’exemple. Les captures servent au rendu ; une observation dans le temps sert à prouver les deux mouvements.

## Déroulement proposé pour le prochain lot

1. **Préparer une fois.** Identifier les symboles, leurs trois variantes réelles et les assets réutilisables. Reprendre le [guide canonique](../symbol-atlas-guidelines.md). Vérifier tôt la base de livraison, le runtime et les blocages connus.
2. **Compléter une fiche témoin.** Huit rôles : paysage, portrait, plaque détourée, trois scènes, texture A, texture B. Régler les quatre profils paysage/portrait/plaque/vignette. Examiner le rendu à 2560 × 1440 et 390 × 844, y compris miniatures, scroll, raccord et ancres. Les décisions déjà validées restent acquises.
3. **Paralléliser les autres packs.** Un producteur par symbole utilise ce même contrat. Codex produit et inspecte les images ; Claude implémente. Un seul intégrateur assemble configuration et manifeste, puis remet un candidat cohérent. Aucun changement d’outil de collaboration n’est décidé ici.
4. **Qualifier et présenter.** Contrôler les nouvelles scènes et les comportements affectés, conserver la campagne finale nécessaire et réutiliser les preuves inchangées. Toute relance indique son motif : entrée modifiée, échec ou risque encore ouvert. Les règles de livraison restent celles d’[AGENTS.md](../../../AGENTS.md).

Le point de passage utile est une fiche réellement complète, sans multiplier les demandes de validation par image. Une erreur du moteur commun se corrige une fois ; un nouveau symbole apporte principalement ses images et sa configuration.

## Déjà disponible et travail restant

**Disponible :** direction approuvée, [configuration structurée](../../../docs-src/config/symbol-atlas-pilots.json), validation bloquante des huit rôles et des profils A/B, moteur commun, bibliothèque de 48 PNG sélectionnés, guide, runner WSL et 11 parcours finaux qualifiés. L’aperçu du lot reste local.

**À préparer de manière ciblée :** rendre l’import/encodage des packs paramétrable et incrémental, puis simplifier la collecte d’un reçu de preuve. Ces outils sont des propositions ; ils ne sont pas implémentés par cette rétro et ne doivent pas devenir un nouveau framework.

**Avant une publication :** résoudre séparément la provenance de la baseline URL. `docs:check` retrouve `sourceRevision=1fc0142d79942570281a4a870583b54dc4bb3a0f is not an ancestor of HEAD`. La garde et la baseline restent intactes. Ce blocage n’empêche pas la préparation locale ; il empêche de présenter le lot comme prêt à publier.

## Mesurer le prochain lot

Relever les reprises par cause — omission du contrat, défaut d’image, défaut d’intégration ou nouvelle décision — ainsi que le temps de génération disponible, l’attente d’outil et le temps de qualification séparément. Suivre aussi les conflits d’import et les fichiers inchangés réencodés. Cibles de travail : aucun rôle oublié, aucune reprise globale pour dérive de palette, aucun conflit causé par une base non communiquée, un seul rapport courant. Ce sont des objectifs à comparer sur un lot similaire, pas des gains déjà prouvés ou de nouvelles barrières de livraison.

## Traçabilité

Les preuves locales non versionnées sont conservées sous `output/noctalia-six-symbols-2026-10-18/` dans le checkout principal :

- `enrichment-v1/DELIVERY.md` et `evidence/maintenance-integrity.json` : candidat, 11/11 qualifiés, limites et conservation des travaux préexistants ;
- `evidence/testerarmy-qualified/sdk.log`, `enrichment-v1/testerarmy-qualified/sdk.log` et `enrichment-v1/testerarmy-maintenance-qualified/sdk.log` : trois durées d’exécution ;
- `source-library-v1.receipt.json`, inspections des assets et manifestes : sources, réemplois et corrections ;
- `retro-2026-10-18/session-metadata.json` : métadonnées publiques bornées avant cette rétro, dont l’attente navigateur ; aucune déduction de temps humain ;
- `retro-2026-10-18/technical-evidence.md`, `design-process.md`, `coordination.md` : analyses croisées détaillées.

Cette documentation ne modifie pas les images ni le produit ; les limites de la qualification initiale restent valables. Les vérifications propres au push et à la publication restent à exécuter au stade demandé.
