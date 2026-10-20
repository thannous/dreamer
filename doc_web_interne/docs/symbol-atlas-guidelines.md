# Guide des illustrations vivantes des symboles Noctalia

Référence validée par Thanh le 18 octobre 2026 : Tigre et lot Serpent, Mer, Forêt, Maison, Chute, Papillon. Lire ce guide avant de créer des images, d’ajouter un symbole illustré ou de modifier ses mouvements. La suppression des boutons de pause fait partie de cette direction. Ce document est la référence unique ; les réglages numériques restent dans les fichiers de configuration.

## 1. Fixer le contenu et les références

Identifier l'ID stable du symbole dans le catalogue partagé, sa langue et ses données éditoriales. Associer les trois scènes à de vraies variantes de ce symbole, par des IDs stables ; conserver les textes, questions et liens issus de la source. Nommer l'auteur/intégrateur du lot et consigner les références utilisées.

Références visuelles : Tigre validé pour l'identité et le comportement ; lot validé Serpent/Mer/Forêt/Maison/Chute/Papillon pour les sujets variés. Réemployer une illustration existante quand le sens, le style et la résolution conviennent. Par exemple, une mue doit laisser lire une exuvie et une morsure doit montrer l'action attendue, même dans la vignette finale.

**Fin :** ID/langue, trois IDs de scènes, sources éditoriales et provenance des images sont explicites ; tout contenu réellement manquant est identifié avant de promettre la page.

Avant de paralléliser les nouveaux packs, intégrer une fiche complète selon ce contrat et l’examiner sur grand écran et mobile, scènes et deux phénomènes inclus. Réutiliser ensuite ses décisions dans le lot. Un seul intégrateur assemble les fichiers partagés ; chaque remise identifie sa base et les sources sélectionnées. Les décisions déjà validées restent acquises. Voir la [rétrospective du pilote et du lot de six](qa/symbol-atlas-retrospective-2026-10-18.md) pour les causes des reprises, l’organisation proposée et les mesures à suivre.

## 2. Préparer les cinq surfaces illustrées

| Surface | Contrat |
| --- | --- |
| Hero | Paysage et composition portrait dédiée au mobile ; sujet net, espace calme pour le titre, continuité jusqu'au haut de page. |
| Illustration latérale | Scène autonome aux contours peints irréguliers, fondus par un vrai alpha, avec espace transparent autour. Elle se fond dans l'encre comme celle du Tigre. |
| Trois vignettes | Trois scènes immédiatement distinctes et fidèles à leurs variantes ; le sujet reste reconnaissable dans le crop réel desktop/mobile. |

Le titre visible affiche uniquement le nom du symbole, dans toutes les langues. Ne pas ajouter de libellé « Signification : » ou sa traduction au-dessus ou sous le nom ; conserver séparément les métadonnées SEO.

La diversité vient des sujets, compositions et mouvements dans une même identité : encre, indigo/violet profonds, texte/lumière ivoire, accents champagne localisés. Les couleurs propres au sujet restent locales et n'imposent pas une nouvelle dominante à la page. Garder une peinture détaillée cohérente avec les références, sans texte ni interface incorporés aux images. Pour l'interface, suivre le [contrat de marque](architecture/NOCTALIA-BRAND-TOKEN-CONTRACT.md) : `champagne` sert aux accents ; les textes accentués utilisent la variante accessible `champagne-on`.

Pour une nouvelle image raster ou une correction, utiliser l'outil intégré Image Gen et inspecter les images de référence avant l'édition. Conserver le PNG sélectionné, le prompt, les dimensions natives et le SHA ; garder l'original en cas de correction. Pour un réemploi, documenter la source et l'opération exacte. Encoder/downscaler sans recadrage destructif ni agrandissement de fichier. La résolution paysage native 1672 px a été acceptée pour ce rendu ; vérifier son aspect à 2560 px et annoncer sa taille réelle, sans la qualifier de 4K.

**Fin :** les cinq surfaces ont des sources sélectionnées, lisibles et traçables ; alpha réel contrôlé pour le décor et les textures, aucune image de substitution ou cadre rectangulaire parasite.

## 3. Donner deux phénomènes à chaque surface

Chaque hero, décor latéral et vignette reçoit deux canaux A/B perceptiblement différents : par exemple reflets/brume, feuilles/lumière, poussières/rayons ou papillons/pollen. Le tableau de base reste spatialement stable ; seuls les calques ambiants et l'effet de profondeur au scroll produisent le mouvement.

Les deux textures d'un symbole peuvent être partagées entre ses cinq surfaces. Adapter pour chaque surface leurs positions, dimensions, opacités, sens et durée : un même placement ne convient pas automatiquement au paysage, au portrait, au décor et aux petits crops. Préserver le ratio des calques ; les débordements nécessaires à la dérive restent hors du champ visible. Examiner les extrémités et le bas du tableau pendant le scroll afin d'éviter une couture ou une zone découverte.

**Fin :** un relevé par surface décrit A/B et leur placement ; les phénomènes diffèrent visuellement, pas seulement par deux noms, deux fichiers ou deux durées.

## 4. Intégrer par données dans un moteur unique

Utiliser ces sources de vérité :

| Changement | Source à modifier |
| --- | --- |
| Interprétations, variantes et liens | Catalogues partagés indiqués dans [le guide du site](../../docs-src/README.md). |
| Symboles activés, ordre des scènes, cadrages et mouvements | [symbol-atlas-pilots.json](../../docs-src/config/symbol-atlas-pilots.json), liste explicite. |
| Dimensions, formats et chemins des fichiers | [symbol-atlas-six-assets.json](../../docs-src/config/symbol-atlas-six-assets.json). Son nom historique ne justifie pas un deuxième manifeste pour chaque nouveau lot. |
| Assemblage des pages, validation et placement des textures | [generate-symbol-pages.js](../../docs-src/static/scripts/generate-symbol-pages.js). |
| Chargement, visibilité et mouvement | Moteur partagé sous `docs-src/static/js/symbol-living/`, dont le chemin actif est déclaré dans le générateur. Le Tigre garde son moteur historique ; ne pas en créer un autre pour chaque symbole. |
| Comportement attendu | [site.web.e2e.ts](../../tools/e2e/tests/site.web.e2e.ts), liste attendue indépendante de la configuration. |
| Copie lue par l'app mobile (portrait, textures, scènes) | `data/app/symbol-atlas.json`, régénéré depuis les trois configurations ci-dessus par `npm run symbols:dictionary:sync` ; ne pas l'éditer à la main. Le build du site publie le même contenu sous `/content/symbols/atlas-v1.json`, que l'app installée télécharge : un lot publié sur le site atteint donc l'app sans nouvelle version. Le test `scripts/sync-app-symbol-dictionary.test.js` échoue tant que la copie n'est pas régénérée. |

Chaque entrée activée doit fournir huit rôles : `hero`, `portrait`, `plate`, trois `scene-<id>`, `layer` et `accent`. Le build refuse une entrée incomplète, un fichier invalide ou un profil qui perd l’un de ses deux phénomènes. Les profils paysage, portrait, plaque et vignette ont chacun leurs placements. Une mise à jour d’image remplace seulement les références de son rôle ; une correction du cycle de vie se fait dans le moteur commun.

Conserver les PNG sources, prompts, métadonnées et SHA dans une archive portable du lot, distincte des dérivés servis. Le reçu du lot indique le nom et le SHA de cette archive ; l’archive reste nécessaire pour reprendre une génération. Les fichiers servis sont versionnés par leur empreinte. Quand le JavaScript change, publier un nouveau chemin à empreinte sans écraser un script déjà marqué immuable. Garder les URL des assets inchangés.

Réutiliser les composants de page et les tokens Noctalia. La maintenance d'une image ou d'un symbole se fait dans sa source/configuration ; une correction du cycle de vie se fait une seule fois dans le moteur. Prévoir des fallbacks statiques propres si une image, un format ou l'exécution du script manque. Sur mobile, le hero mesure 75svh depuis y=0, derrière la navbar ; les images latérales masquées n'y sont pas téléchargées. Le desktop garde la composition large jusqu'à 2560 px et les proportions du Tigre.

**Fin :** ajouter un symbole ne demande pas de copier un moteur ou de disperser des conditions spécifiques dans les composants partagés ; manifeste, données et fichiers se correspondent sans déformation.

### Cadre commun et packs à compléter

Les 240 symboles partagent le même assemblage de page dans les six langues. Au 20 octobre 2026, 75 disposent du pack d'images, dont 74 sont animés sur chaque surface ; le Tigre historique garde son hero animé mais sa plaque et ses vignettes restent à compléter. Les 165 autres gardent leur image statique. Ne pas ajouter de plaque ou scènes factices pour remplir la mise en page. Le prochain lot doit compléter les huit rôles, les trois scènes et leurs deux phénomènes avant de changer l'état du pack.

Le cadrage portrait de ces pages sans pack est déclaré dans `docs-src/config/symbol-hero-portrait.json`. Quand un pack dédié est ajouté, supprimer son entrée de ce fichier : son portrait et ses placements viennent alors du pack. À DPR2, vérifier `currentSrc` : un hero en cover à 75svh peut nécessiter une peinture plus large que le viewport. Utiliser la variante native appropriée, sans agrandissement artificiel.

Le suivi sépare les sources réellement consommées : changer un cadrage ne périme que ce symbole ; changer la copie des scènes ne périme pas une fiche sans scènes. Garder une preuve claire plutôt que multiplier les contrôles au pixel. Sur cette machine, utiliser le runtime Linux existant pour les contrôles de publication et conserver les preuves hors de `/tmp`, vidé à l'arrêt du système Linux.

### Outils communs pour les lots suivants

Les commandes et effets détaillés sont dans le [catalogue des outils Atlas](../../scripts/README.md#atlas-pages-asset-packs-handoffs-and-qualification-receipts). Depuis la racine, utiliser `npm run <commande> --prefix apps/site -- <options>` ; ne pas recopier un encodeur ou un collecteur par symbole.

- `atlas:pack` lit un `noctalia.atlas-pack/1` portable : huit rôles, chemins relatifs, SHA et prompts/provenance réels. Faire le dry-run, puis fusionner dans le manifeste canonique quand l’ID est activé. Le cache par symbole évite le réencodage des sources et recettes inchangées ; le reçu identifie les dérivés écrits/réutilisés. Un réemploi reste conditionné au style, au sens et au rendu effectif, pas à la seule présence d’un fichier.
- `atlas:handoff` remet et vérifie le patch avec sa base, son head et les blobs avant/après. Sans les refs cloud locales, distinguer le contrôle des contenus de la preuve d’ascendance ; appliquer seulement le patch attendu sur les chemins détenus par le lot.
- `atlas:gallery` produit la page de revue hors des sources et du site généré, avec les mêmes fiches aux tailles desktop/mobile. Les dimensions affichées ne suffisent pas à prouver le viewport réel : relever également la taille et la densité du navigateur de contrôle.
- `atlas:receipt` vérifie et copie la qualification réelle du runner existant, avec le candidat exact et sa propreté. Il ne transforme ni un test filtré, ni une capture, ni un build en campagne complète qualifiée.

Garder un seul rapport par lot et une seule copie canonique de chaque preuve. Les packs sources sélectionnés vont dans l’archive portable ; les brouillons rejetés restent hors de la sélection servie. Aucun nom de fichier ou prompt ne vaut approbation visuelle de Thanh.
## 5. Contrôler le cycle de vie par image

Le moteur observe la visibilité de chaque image et anime seulement ses canaux visibles et décodés. L'interface ne monte aucune commande pause, y compris sous forme de bouton masqué. Le moteur arrête les canaux quand la réduction des mouvements est demandée, l'onglet est caché ou l'image quitte le viewport ; il reprend un état cohérent quand les conditions système le permettent. Un changement de format conserve cette logique. Le contenu et l'image statique restent utilisables dans les fallbacks.

**Fin :** chaque surface a une base stable, deux canaux visibles et variables dans le temps lorsqu'elle doit tourner, et aucun canal actif quand sa condition d'arrêt s'applique. La présence d'une animation CSS seule ne constitue pas cette preuve.

## 6. Qualifier le lot et conserver une preuve proportionnée

Identifier la révision, le moteur, les assets, le navigateur, le viewport et la densité. Comparer dans une même planche les sources, les captures réelles et la référence validée ; inspecter les détails individuellement si la planche les rend trop petits. Vérifier polices, rythme de mise en page, couleurs, images et contenu.

À 2560 × 1440 et sur mobile 390 × 844 au minimum : cadrage du sujet, contours entiers du décor, trois scènes distinctes et labels complets, contraste, ratios, profondeur au scroll et absence de couture au bas du tableau. Qualifier un breakpoint intermédiaire quand la modification touche son comportement. Contrôler les requêtes : portrait approprié au mobile, décor desktop absent des téléchargements mobiles.

Ouvrir aussi les ancres directement et par les liens de section. Sur mobile, `#scenes` doit afficher le titre Scènes courantes entièrement sous la barre fixe Sens/Questions/Variantes après stabilisation du scroll ; conserver les rectangles du titre et de la barre pour le vérifier. Vérifier l'absence de commande pause montée dans les sept fiches FR de référence. Mesurer les deux canaux de chaque image pendant un intervalle borné, puis vérifier les arrêts/reprises système et les changements de format. Conserver captures et résultats avec la révision ; distinguer preuve visuelle, preuve temporelle et parcours fonctionnel. Une capture seule ne prouve ni mouvement ni clic, et ces mesures ne qualifient pas les FPS ou un appareil physique.

**Fin :** aucun P1/P2 restant ; les contrôles adaptés au changement passent, les limitations et éventuels P3 sont nommés dans un seul rapport de lot. Réutiliser les preuves encore valides plutôt que répéter les mêmes campagnes.

## 7. Faire valider, puis étendre

Décision de Thanh du 19 octobre 2026 : publier chaque lot complet sur noctalia.app, dans les six langues, après les vérifications adaptées. L'autorisation de publication vaut pour les lots demandés ; ne pas redemander un go à la fin de chacun. Conserver les contrôles de livraison et vérifier ensuite les pages publiques sur mobile et grand écran. Le suivi distingue toujours ce qui est préparé, vérifié et effectivement publié.

Présenter le lot à taille desktop/mobile avec un aperçu local et appliquer les retours. Étendre dans le périmètre autorisé en réutilisant les validations et décisions existantes ; une délégation déjà acquise ne demande pas une nouvelle approbation par image. Garder cette référence unique à jour quand une décision graphique change. Les règles de Git, validation, merge et publication restent dans [AGENTS.md](../../AGENTS.md) et ses guides de livraison : s’y reporter au stade concerné, sans les dupliquer ici.

**Fin :** le lot est accepté ou les corrections sont explicites. La validation d'un rendu n'est ni une publication implicite ni une autorisation d'étendre le périmètre aux autres symboles.
