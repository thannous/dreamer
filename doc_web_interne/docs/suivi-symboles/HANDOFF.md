# Passation — images Codex, intégration et animations Claude

## Point de départ du 20 octobre 2026

Lire d'abord [le guide validé des illustrations](../symbol-atlas-guidelines.md) et [le suivi](README.md). Base de cet instantané : `8e38590c85ebca2cbbef732b179eb47a8b2800d8`. La PR474 est déjà fusionnée ; ne pas réappliquer les anciens patches des lots 04/06. Récupérer le master courant avant tout travail et comparer ses changements.

75 symboles sont intégrés, 165 restent à intégrer. Les 38 nouveaux packs de la PR474 ont chacun huit rôles : paysage, portrait, plaque latérale avec alpha, trois scènes distinctes, texture A `layer` et texture B `accent`. Leurs animations sont déjà configurées : il faut reprendre et qualifier le rendu existant, pas reconstruire un moteur. Le [reçu des 40 parcours](../qa/symbol-packs-40-20261020.json) porte sur `22c1871989966d0b303739c55b7338d0a58618de`, avant un changement du générateur. Garder cette preuve historique ; ne pas la présenter comme une validation du master courant.

## Répartition et remise d'un lot

- **Codex** prépare les images avec Image Gen, inspecte les références et sélectionne les sources. Il remet un pack portable `noctalia.atlas-pack/1` par symbole, les prompts et références réels, les dimensions natives, les SHA et le reçu de l'archive source. Toute réutilisation est explicite.
- **Claude** utilise les vrais dérivés pour intégrer le lot, adapter les placements A/B, les trois scènes et les six langues, puis vérifier les parcours. Un manifeste fictif peut aider une préparation locale, mais ne prouve aucun rendu et ne doit pas être livré comme un pack complet.
- **Codex** récupère la branche poussée ou le handoff vérifiable, intègre la version, effectue les contrôles de livraison et publie sur noctalia.app dans le périmètre demandé. Le suivi est mis à jour après vérification du résultat public. Claude peut pousser sa branche après `verify:pr` ; aucune interdiction générale de push.

La demande de cette passation et de ce suivi ne lance pas à elle seule un nouveau lot ni une nouvelle publication. Les autorisations de publication déjà acquises pour les lots demandés restent valables ; ne pas redemander une validation par image.

## Direction artistique et mouvement

Référence : Tigre validé et lot Serpent / Mer / Forêt / Maison / Chute / Papillon. Peinture détaillée nocturne, fonds encre, indigo et violet profonds ; lumières ivoire et touches champagne localisées. Diversifier les sujets et les compositions sans changer la dominante de toute la page. Pas de texte ou d'interface peints dans l'image, ni de vidéo ou GIF.

Chaque surface visible porte **deux phénomènes perceptiblement différents** : hero, illustration latérale et chacune des trois vignettes. Les deux textures peuvent être réemployées entre ces surfaces, avec des placements adaptés au paysage, portrait, plaque et à chaque scène. Deux fichiers distincts ou deux durées ne suffisent pas. Éviter une dérive ou un halo génériques sans rapport avec le tableau ; un détail lumineux doit suivre la vraie source lumineuse. Les peintures restent stables ; les textures ambiantes et la profondeur au scroll produisent le mouvement.

Les huit rôles sont déjà présents, mais cela ne signifie pas que les animaux ou objets ont des articulations ou une carte de profondeur. Un mouvement interne du sujet demanderait une préparation supplémentaire par Codex, à nommer avant de le promettre.

Desktop : utiliser la largeur disponible jusqu'à 2560 px, garder la composition de référence et l'image derrière la navbar. Mobile : hero à 75svh depuis y=0, portrait dédié, titre lisible. Ne pas remettre « Signification : » dans les six langues ni de bouton pause. Préserver les contours alpha et les ratios ; pas de couture au scroll. Ne pas agrandir artificiellement les sources 1672×941 et ne pas les annoncer en 4K.

## Modifier les bonnes sources

| Besoin | Source |
| --- | --- |
| Scènes, positions, deux canaux, réglages propres aux scènes | `docs-src/config/symbol-atlas-pilots.json` |
| Huit rôles, tailles et chemins des dérivés | `docs-src/config/symbol-atlas-six-assets.json` |
| Correspondances FR/EN/ES/DE/IT/PT-BR | `docs-src/config/symbol-atlas-locales.json` |
| Lots et preuves QA / accord / publication | `docs-src/config/symbol-rollout.json` |
| Assemblage des surfaces | `docs-src/static/scripts/generate-symbol-pages.js` |
| Géométrie commune site/app | `scripts/lib/atlas-motion.js` |
| Cycle de vie | Moteur commun `docs-src/static/js/symbol-living/`, chemin actif déclaré par le générateur ; Tigre historique séparé |
| Copie destinée à l'application | `npm run symbols:dictionary:sync` régénère `data/app/symbol-atlas.json` ; ne pas modifier ce fichier à la main |

Ne pas créer de moteur par symbole. Utiliser les commandes `atlas:pack`, `atlas:handoff`, `atlas:gallery`, `atlas:receipt` du package `apps/site` ; voir [le catalogue](../../../scripts/README.md#atlas-pages-asset-packs-handoffs-and-qualification-receipts). Conserver les chemins à empreinte pour les assets/scripts immuables. Modifier `docs-src/`, jamais le résultat généré `docs/`.

Les placements actuels acceptent `place.at: [x, y]` pour fixer le centre de la texture dans la peinture (coordonnées de 0 à 1), et `place.zoom` de 0,1 à 4 : un zoom inférieur à 1 permet une petite lueur locale. `motion.scenes[sceneId]` remplace les deux effets de `motion.thumb` pour une scène donnée ; sans remplacement, le profil commun des vignettes est utilisé. La licorne fournit un exemple existant. Recalculer sur les dimensions réelles avec `atlasSixBox` ; les anciennes limites de positionnement des patches Bougie ne décrivent plus ces possibilités.

## Contrôle proportionné et prochaine action

Reprendre un symbole représentatif sur le master actuel avant d'étendre les réglages : paysage à 2560×1440, mobile à 390×844, plaque et trois scènes. Observer les deux effets au cours du temps dans le cadre réellement visible, le scroll et les changements de scène. Vérifier les six langues et les liens, l'absence de couture, la lisibilité du titre, la réduction des mouvements et les arrêts/reprises hors écran/onglet. Le portrait est téléchargé sur mobile ; la plaque desktop masquée ne l'est pas.

Si ce pilote passe, contrôler le périmètre affecté avec le runner existant ; réutiliser les preuves inchangées. Ne pas lancer de régénération générale ou une optimisation au pixel sans défaut visible. Pour chaque correction, remettre une seule branche avec base/head, chemins détenus et preuve du candidat ; `npm run verify:pr` avant chaque push. Le merge et la publication suivent `AGENTS.md`, sans contournement des gardes.

Limite de l'audit de cette passation : les 1 444 dérivés des 38 nouveaux packs sont présents, plaques et textures avec vrai alpha, deux canaux configurés sur les six compositions. Six packs variés ont été examinés en planche. Aucune nouvelle preuve temporelle navigateur ni qualification native n'est attribuée à cet audit. L'archive native est référencée dans le reçu, pas disponible ni vérifiée sur cette machine.
