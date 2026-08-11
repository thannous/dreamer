# Noctalia — exécution de la vague ranking J27

Date d'ouverture : 11 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

Branche de travail : `codex/seo-ranking-wave-2`

## But et contrat d'exécution

Le chantier transforme le backlog Ahrefs/GSC validé en actions séparées et mesurables. La vague de nouveaux propriétaires suit l'ordre `turtle` → `crocodile` → `lice`. Chaque concept doit franchir seul les états suivants :

`sources locales` → `contrôles` → `commit` → `contrat URL` → `push master` → `déploiement` → `preuve HTTP publique` → `mesure GSC`

Un concept suivant ne doit pas être publié avant la preuve publique du précédent. Les quinze routes ne sont donc pas fusionnées dans un seul lot.

Ce chantier ne modifie pas :

- les 50 couples Rank Tracker, leurs emplacements ou leurs tags ;
- les expériences `casa`, `ragno`, `perro` ou `scuola` ;
- l'abonnement Ahrefs, les add-ons ou la facturation ;
- GSC par demande d'indexation ;
- `docs/`, qui reste une sortie générée et non une source versionnée.

## Tableau de contrôle

| Priorité | Levier | État au 11 août | Prochaine porte |
|---|---|---|---|
| P0 | `turtle`, 5 langues | `LIVE_VERIFIED` | mesurer sur des fenêtres GSC complètes sans demander d'indexation |
| P0 | `crocodile`, 5 langues | `LIVE_VERIFIED` | mesurer sur des fenêtres GSC complètes sans demander d'indexation |
| P0 | `lice`, 5 langues | `LOCAL_FULL_CHECK_GREEN` | committer le contrat URL, coordonner puis pousser ce seul concept vers `master` |
| P0 | autorité externe | `PREPARE_ONLY_NO_SEND` | nouveau stop gate puis autorisation explicite, dossier par dossier |
| P1 | expérience `scuola` | `HOLD_UNTIL_2026-08-15` | lire la fenêtre J+7 de `casa/ragno/perro`, puis ouvrir un lot metadata-only séparé si le signal reste propre |
| P1 | 254 URL explorées non indexées | `DIAGNOSTIC_ONLY` | segmenter, commencer par l'article DE sur la poursuite, n'ajouter qu'un lien contextuel prouvé |
| P2 | `/es/simbolos/coche` | `QUEUED_FOR_OWNER_OPTIMIZATION` | revalider la source et le SERP avant toute édition |
| P2 | ancres IT poursuite | `HOLD_UNTIL_NEEDED` | ne différencier fiche/article que si la répartition GSC reste ambiguë |
| P3 | redirection IT mal encodée | `HOLD_GSC_PROOF` | confirmer l'URL exacte dans GSC avant intégration ; ne pas reprendre le WIP d'un autre worktree |

## Lot 1 — `turtle`

### Preuve qui autorise le propriétaire

La collecte J27 classe les cinq requêtes en `GO_NEXT_WAVE`. Le KD observé est 0 dans chaque marché : IT 1 200 recherches pays, DE 250, FR 100, ES 600 et US 100. GSC ne montre aucune impression récente pour le cluster et aucun propriétaire dédié ne préexistait. Les guides animaux restent des hubs ; la fiche localisée reçoit l'intention précise.

### Routes préparées

| Langue | Route canonique |
|---|---|
| EN | `/en/symbols/turtles` |
| FR | `/fr/symboles/tortue` |
| ES | `/es/simbolos/tortugas` |
| DE | `/de/traumsymbole/schildkroete` |
| IT | `/it/simboli/tartarughe` |

Les cinq propriétaires comprennent un titre et une description uniques, un résumé, trois questions de réflexion, quatre FAQ et quatre scénarios développés. Le contenu traite rythme, protection, persévérance, retrait, eau, carapace et jeunes tortues sans affirmation prédictive.

### Illustration et distribution interne

Actif éditorial : `docs-src/static/img/symbols/editorial-2026-08-j27/turtle-v1.webp`, 1 600 × 900.

Variantes responsives : 240, 480, 800 et 1 200 pixels sous `docs-src/static/img/seo/symbols-v2/`. L'image représente une seule tortue anatomiquement cohérente, sans texte, logo, filigrane ni codes divinatoires. Le symbole est ajouté à la curation des rêves d'animaux et conserve les guides comme hubs.

### Contrôles locaux

Commit de contenu local : `46e24e94f` (`feat(seo): add localized turtle ranking owners`). Le contrat URL est étendu depuis ce commit dans un second commit technique, sans autre concept.

| Contrôle | Résultat |
|---|---|
| JSON et whitespace | vert |
| bornes titres/descriptions | titres 35–43 caractères ; descriptions 129–145 |
| `npm run docs:build` | vert : 155 symboles, 775 pages de détail, 0 erreur |
| contrat des images | vert : héros visible, social, JSON-LD, sitemap et 775 cartes |
| parité des illustrations | verte dans les cinq langues |
| canoniques/hreflang/indexabilité | cinq auto-canoniques, six alternates avec `x-default`, `index, follow` |
| stabilité des URL avant extension | blocage attendu : cinq routes et leurs sorties dérivées ne sont pas encore dans la baseline |
| contrat URL après extension | vert : 1 221 routes manifeste, 1 221 pages canoniques, 1 221 entrées sitemap et 1 226 sorties HTML |
| release check sur export Git propre | vert : 0 erreur structurelle, 0 lien interne cassé et surface de déploiement propre ; validation des liens externes volontairement exclue |

Le blocage du contrat URL n'est pas une régression : le dépôt exige que l'ajout soit d'abord commité, puis inscrit dans la baseline depuis un HEAD propre. L'extension du contrat sera donc un commit technique séparé mais poussée avec le seul concept `turtle`, afin de produire un seul déploiement de concept.

### Retour CI après le premier push

Le push `5b8f3b0da` vers `master` a révélé une unique assertion de test restée codée en dur à 154 symboles dans `scripts/lib/content-hub-registry.test.js`. Le registre réel en contient désormais 155. Ce défaut est imputable au lot `turtle` et n'est pas classé comme bruit de baseline.

Le correctif porte uniquement le libellé et l'attente `154 → 155`. Le test ciblé passe 15/15 et la suite rapide complète passe 260 suites et 2 474 tests. Le commit `d1890c203` a été poussé sur `master`; le run Quality `31516168322` est entièrement vert, dont le build et le contrôle du site en 10 min 31 s.

À 17:39 UTC, les cinq routes publiques répondent HTTP 200 avec le titre localisé attendu, un canonical vers elles-mêmes, `index, follow`, six liens `hreflang` et le contenu dédié. Le master éditorial et les quatre variantes responsives répondent également 200 en `image/webp`. Le statut du check GitHub « Cloudflare Pages » est resté retardé en `in_progress` après la mise en ligne; la preuve HTTP publique, et non ce statut décalé, établit la publication.

## Lot 2 — `crocodile`

### Preuve et ownership

Le propriétaire dédié reprend l'intention précise dans cinq marchés sans retirer le rôle de hub aux guides animaux. Les volumes pays observés dans la collecte J27 sont : IT 700 (`KD 0`), DE 500 (`KD 0`), FR 150 (`KD 0`), ES 900 (`KD 0`) et US 40 (`KD 8`). Les trois impressions historiques DE/IT observées sur des guides restent un facteur de mesure, pas un motif pour canonicaliser la fiche vers le hub.

| Langue | Route canonique préparée |
|---|---|
| EN | `/en/symbols/crocodiles` |
| FR | `/fr/symboles/crocodile` |
| ES | `/es/simbolos/cocodrilos` |
| DE | `/de/traumsymbole/krokodil` |
| IT | `/it/simboli/coccodrilli` |

Le contenu distingue eau, observation, poursuite ou attaque, présence dans la maison et animal calme. Il n'assimile pas le rêve à une prédiction, une tromperie certaine ou un danger futur.

Actif éditorial local : `docs-src/static/img/symbols/editorial-2026-08-j27/crocodile-v1.webp`, 1 600 × 900, plus quatre variantes de 240 à 1 200 pixels. L'illustration montre un seul crocodile dans l'eau, sans humain, attaque, texte, logo, filigrane ni code divinatoire.

Contrôles locaux avant commit : inventaire porté à 156 symboles, 780 pages de détail, 785 contenus étendus, cinq titres de 38 à 46 caractères et cinq descriptions de 139 à 146 caractères. `docs:build`, le contrat d'image, la parité multilingue et les 15 tests du registre passent.

### Git, CI et publication

Le contenu et ses actifs sont isolés dans `2edfd52c5` (`feat(seo): add localized crocodile ranking owners`). Le contrat public additif des cinq routes est isolé dans `789c82dc4` (`chore(seo): extend URL contract for crocodile`). Aucun chemin existant n'a été retiré ou modifié par l'extension.

Le release check sur export Git propre passe avec 0 erreur et 0 avertissement dans `docs:check`, ainsi que 0 lien interne cassé. Son contrôle de profondeur conserve 70 avertissements non bloquants sur des fiches allemandes courtes, sans lien avec ce lot. La suite complète passe 260 suites et 2 474 tests. Le push fast-forward vers `master` a établi `origin/master = 789c82dc418cdf5ce98f669a9f09337b20324a25`; le run Quality exact `31519264150` est entièrement vert, dont le build/check du site en 8 min 56 s.

La session Chrome authentifiée a permis d'inspecter le déploiement Cloudflare Pages exact `abb9d5e9-2ccb-4772-961c-81ff244e41d7`. Il a terminé avec succès à 18:51:21 UTC sur la branche `master` et le commit `789c82d`, après 11 min 23 s. Les journaux confirment 3 837 actifs traités, 1 237 fichiers téléversés, 2 600 déjà présents, puis `Assets published` et `Your site was deployed`. Le check GitHub « Cloudflare Pages » du même SHA est désormais `completed/success`.

La preuve publique est acquise : les cinq routes localisées répondent HTTP 200, portent leur titre localisé suivi de `| Noctalia`, un canonical auto-référent, des directives `index, follow` et les six alternates uniques `en`, `fr`, `es`, `de`, `it`, `x-default`. Le master éditorial et les quatre variantes responsives répondent également HTTP 200 en `image/webp`. Aucun redéploiement manuel ni demande d'indexation n'a été nécessaire. Cette porte autorise désormais la préparation locale du lot `lice`, qui reste un concept et un déploiement séparés.

## Lot 3 — `lice`

### Preuve et ownership

Les cinq requêtes sont classées `GO_NEXT_WAVE` dans le backlog J27. Les volumes pays observés sont : IT 800 (`KD 0`), DE 200 (`KD 0`), FR 150 (`KD 0`), ES 1 600 (`KD 18`) et US 30 (`KD 0`). En Espagne, un domaine DR 0 apparaît déjà en 10e position, ce qui confirme une surface accessible malgré le KD supérieur. Aucun propriétaire dédié n'était visible dans la fenêtre GSC contrôlée; l'angle argent, chance ou prédiction est explicitement exclu.

| Langue | Route canonique préparée |
|---|---|
| EN | `/en/symbols/lice` |
| FR | `/fr/symboles/poux` |
| ES | `/es/simbolos/piojos` |
| DE | `/de/traumsymbole/laeuse` |
| IT | `/it/simboli/pidocchi` |

Les cinq propriétaires couvrent poux dans les cheveux, retrait, grand nombre et présence sur un enfant ou un proche. Le contenu sépare irritation répétée, limites proches, soin et gêne sociale des déclencheurs littéraux possibles : alerte scolaire, conversation familiale, démangeaison, contrôle des cheveux, nettoyage ou article récent. Il précise qu'un rêve ne diagnostique pas une infestation et ne prédit ni argent, ni chance, ni événement futur.

Actif éditorial : `docs-src/static/img/symbols/editorial-2026-08-j27/lice-v1.webp`, 1 600 × 900, accompagné de quatre variantes de 240 à 1 200 pixels. L'image montre un seul pou anatomiquement reconnaissable sur quelques cheveux, sans visage, plaie, sang, œufs, autre insecte, texte, logo, filigrane ni code divinatoire.

Contrôles locaux avant commit : 157 symboles uniques, 785 pages de détail et 790 contenus étendus; cinq titres de 40 à 42 caractères et cinq descriptions de 137 à 146 caractères. `docs:build` passe avec 0 erreur, le contrat des images vérifie 785 héros, cartes, données structurées et entrées sitemap, la parité multilingue passe et les 32 tests ciblés du registre et de l'image sont verts. `docs:check` s'arrête uniquement sur la porte attendue des cinq routes nouvelles et de leurs 21 surfaces dérivées, avant extension additive de la baseline URL.

Le contenu et ses actifs sont isolés dans `8ecf0772f` (`feat(seo): add localized lice ranking owners`). Depuis ce HEAD propre, la baseline URL a été étendue sans retrait : 1 231 routes manifeste, 1 231 pages canoniques, 1 231 entrées sitemap et 1 236 sorties HTML. Après extension, `docs:check` passe entièrement avec 0 erreur, 0 avertissement et 0 lien interne cassé; le contrat de hub valide 1 000 pages localisées et 2 305 relations requises.

## Autorité externe — frontière d'autorisation

L'ordre conservé est : Marika Pech, DreamWell, Atlas/ILTY, puis routes éditoriales allemandes et espagnoles. L'actif Noctalia à citer existe déjà, mais aucun message ne part dans ce chantier sans :

1. vérification fraîche du destinataire, de la page source, du lien actuel et de l'absence de doublon ;
2. brouillon factuel et traçable ;
3. autorisation explicite propre à l'envoi ;
4. preuve d'envoi distincte d'une réponse, d'une publication ou d'un backlink acquis.

Stop gate du 11 août :

- Marika Pech conserve la mention texte « Source : Noctalia, 2026 » et l'affirmation 40–60 %, sans lien Noctalia; Gmail ne contient aucun message pour `marikapech.com`.
- DreamWell conserve son bloc DreamKit, affirme encore une disponibilité Android et iOS et ne mentionne pas Noctalia; Gmail ne contient aucun message pour `dreamwellbewell.com`.
- Atlas et ILTY ne mentionnent toujours pas Noctalia sur leurs comparatifs publics. Leurs conversations d'origine sont dans Zimbra, pas dans le Gmail connecté; le contrôle boîte immédiat n'est donc pas réputé franchi dans ce passage.

État actuel : aucun envoi externe effectué par ce chantier. Marika et DreamWell sont prêts pour une autorisation d'envoi distincte après ultime contrôle public/boîte; Atlas/ILTY restent bloqués par le stop gate Zimbra et leur autorisation `D7`.

## Expériences et leviers différés

### `scuola`

Baseline naturelle : 7 clics, 1 906 impressions, CTR 0,367 %, position 6,08. Aucun traitement n'est publié. Si la lecture du 15 août n'introduit pas de facteur confondant, le seul traitement admissible reste `documentTitle` + `documentMetaDescription`, dans un commit et un déploiement séparés.

### 254 URL explorées non indexées

Le rapport GSC live, mis à jour le 7 août, a été exporté le 11 août. Son archive contient exactement 254 lignes d'URL et porte l'empreinte SHA-256 `515e55b94bb2195ebc90ea0e9d443518ef0addb0bb369ddea52f76a559c24bfb`.

| Segment | Nombre | Décision |
|---|---:|---|
| routes canoniques actuelles | 184 | auditer par valeur et intention; aucune demande d'indexation en masse |
| anciennes variantes `.html` ou routes legacy | 70 | aucune optimisation : les 70 répondent actuellement 301 avec une destination |

Les 184 routes actuelles se répartissent en 106 fiches symbole, 72 articles et 6 guides. Dix-sept ont été explorées dans les 28 jours précédant la mise à jour GSC; les autres sont plus anciennes. Le graphe généré donne à chacune au moins 4 sources de liens internes distinctes (médiane 10, maximum 42) : cette liste ne révèle donc aucun orphelin et ne justifie pas un ajout massif de liens.

L'article allemand sur la poursuite est bien dans le segment canonique, avec une dernière exploration le 4 août et 14 sources internes distinctes. Il reste le premier cas à lire, mais son statut n'est pas une preuve qu'un lien entrant supplémentaire résoudrait l'indexation. Le seul ajout préparatoire plausible est un lien contextuel et sémantiquement distinct vers l'article sur les rêves récurrents dans la section dédiée; il doit rester dans un lot P1 séparé après la vague P0.

### Propriétaires existants

`/es/simbolos/coche` conserve sa baseline de décision : 1 230 impressions, CTR 0,3 %, position 8,9. Le prochain lot doit viser le CTR et l'adéquation d'intention sans changer l'URL. Les ancres italiennes sur la poursuite restent inchangées tant que GSC ne démontre pas un ownership encore partagé.

### Redirection italienne mal encodée

La variante `per%C3%A9...` renvoie encore 404 publiquement, mais elle n'apparaît ni dans les 254 URL explorées/non indexées ni dans les trois 404 courantes de GSC. L'inspection directe de l'URL a échoué avec une erreur temporaire GSC et ne fournit donc pas de preuve positive. Elle reste en `HOLD_GSC_PROOF`; aucun diff d'un autre worktree n'est repris à l'aveugle.

## Mesure et coût

- Crédits Ahrefs consommés par cette implémentation : 0.
- Dernier compteur durable disponible avant ce chantier : 113/200 crédits généraux utilisés.
- Export GSC brut : archive CSV conservée hors dépôt; le connecteur Drive a refusé son téléversement en raison de son caractère potentiellement sensible. Une autorisation explicite dédiée aux données brutes est requise; seule son empreinte et sa segmentation décisionnelle sont versionnées.
- Rapport synthétique Drive : `j27-ranking-expansion-execution-2026-08-11.md`, identifiant `11HiAE9xMxWzbP6HMhui63XDneuPZVOgk`, dans `05 - Clôture J25-J27 - 2026-08-11`; aucun partage n'a été modifié.
- Mutation GSC : aucune.
- Demande d'indexation : aucune.
- Achat ou changement d'abonnement : aucun ; la décision reste à l'utilisateur.

Après preuve publique, les nouvelles routes seront mesurées dans GSC sur des fenêtres complètes. Une réponse HTTP 200 ou une présence au sitemap prouve la publication, pas l'indexation ni un gain de ranking.
