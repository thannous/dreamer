# Passation — images Codex, intégration et animations Claude

## Point de départ du 20 octobre 2026

Le cadre commun des 240 symboles est publié dans les six langues : **1 440 pages**, dont **75 packs d'images** et **165 à préparer**. La plaque latérale et les trois scènes restent présentes sur les pages équipées. Deux effets sont présents sur les 74 packs communs ; le Tigre conserve son moteur historique limité au hero. Les pages sans pack gardent leur illustration statique : ne pas confondre uniformisation et création des 165 packs manquants.

Version publique : `1a63ecf787bc8d20e322314e1ba17987c83b1198`, PR478. Lire [la preuve actuelle](../qa/symbol-pages-uniform-20261020.json), [le suivi](README.md) et [le guide](../symbol-atlas-guidelines.md). Les 74 packs communs ont une QA actuelle sur six langues et deux tailles ; le Tigre reste à corriger pour la plaque et les vignettes. Les 240 symboles ont une publication actuelle. Les 40 contrôles PR474 et 37 anciennes publications restent historiques. Aucun accord personnel de Thanh n'a été inventé.

Ne pas réappliquer les patches déjà intégrés des lots précédents. Récupérer le master courant avant tout travail. Les 38 nouveaux packs de la PR474 ont chacun huit rôles ; reprendre leurs réglages existants plutôt que reconstruire un moteur. Leur archive PNG est référencée, mais sa disponibilité locale n'est pas affirmée.

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
| Cadrage des pages sans pack | `docs-src/config/symbol-hero-portrait.json` ; supprimer l’entrée quand un pack dédié est ajouté |
| Assemblage des surfaces | `docs-src/static/scripts/generate-symbol-pages.js` |
| Géométrie commune site/app | `scripts/lib/atlas-motion.js` |
| Cycle de vie | Moteur commun `docs-src/static/js/symbol-living/`, chemin actif déclaré par le générateur ; Tigre historique séparé |
| Copie destinée à l'application | `npm run symbols:dictionary:sync` régénère `data/app/symbol-atlas.json` ; ne pas modifier ce fichier à la main |

Ne pas créer de moteur par symbole. Utiliser les commandes `atlas:pack`, `atlas:handoff`, `atlas:gallery`, `atlas:receipt` du package `apps/site` ; voir [le catalogue](../../../scripts/README.md#atlas-pages-asset-packs-handoffs-and-qualification-receipts). Conserver les chemins à empreinte pour les assets/scripts immuables. Modifier `docs-src/`, jamais le résultat généré `docs/`.

Les placements actuels acceptent `place.at: [x, y]` pour fixer le centre de la texture dans la peinture (coordonnées de 0 à 1), et `place.zoom` de 0,1 à 4 : un zoom inférieur à 1 permet une petite lueur locale. `motion.scenes[sceneId]` remplace les deux effets de `motion.thumb` pour une scène donnée ; sans remplacement, le profil commun des vignettes est utilisé. La licorne fournit un exemple existant. Recalculer sur les dimensions réelles avec `atlasSixBox` ; les anciennes limites de positionnement des patches Bougie ne décrivent plus ces possibilités.

## Contrôle proportionné et prochaine action

Reprendre un symbole représentatif sur le master actuel avant d'étendre les réglages : paysage à 2560×1440, mobile à 390×844, plaque et trois scènes. Observer les deux effets au cours du temps dans le cadre réellement visible, le scroll et les changements de scène. Vérifier les six langues et les liens, l'absence de couture, la lisibilité du titre, la réduction des mouvements et les arrêts/reprises hors écran/onglet. À DPR2, contrôler aussi la source réellement téléchargée : le cover à 75svh peut dépasser la largeur du viewport et doit sélectionner une variante native suffisante. Le portrait est téléchargé sur mobile ; la plaque desktop masquée ne l'est pas.

Si ce pilote passe, contrôler le périmètre affecté avec le runner existant ; réutiliser les preuves inchangées. Ne pas lancer de régénération générale ou une optimisation au pixel sans défaut visible. Pour chaque correction, remettre une seule branche avec base/head, chemins détenus et preuve du candidat ; `npm run verify:pr` avant chaque push. Le merge et la publication suivent `AGENTS.md`, sans contournement des gardes.

Limites : la campagne actuelle qualifie le navigateur, pas un appareil physique ni l'application native. Le build Linux a régénéré uniquement les fichiers autorisés de son bundle experience ; le reçu conserve cet état et prouve la stabilité des entrées et sorties. L'archive native PR474 demeure référencée, pas localement vérifiée. Les différences visuelles mineures ne bloquent pas un lot ; corriger les défauts visibles de contenu, cadrage, netteté ou mouvement.
