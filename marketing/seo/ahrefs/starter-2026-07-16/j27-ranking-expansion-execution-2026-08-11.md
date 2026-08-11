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
| P0 | `turtle`, 5 langues | `LOCAL_VALIDATED_PENDING_COMMIT` | commit contenu, extension du contrat URL, push, déploiement et preuve publique |
| P0 | `crocodile`, 5 langues | `QUEUED_AFTER_TURTLE` | ne commencer la publication qu'après preuve HTTP de `turtle` |
| P0 | `lice`, 5 langues | `QUEUED_AFTER_CROCODILE` | ne commencer la publication qu'après preuve HTTP de `crocodile` |
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

| Contrôle | Résultat |
|---|---|
| JSON et whitespace | vert |
| bornes titres/descriptions | titres 35–43 caractères ; descriptions 129–145 |
| `npm run docs:build` | vert : 155 symboles, 775 pages de détail, 0 erreur |
| contrat des images | vert : héros visible, social, JSON-LD, sitemap et 775 cartes |
| parité des illustrations | verte dans les cinq langues |
| canoniques/hreflang/indexabilité | cinq auto-canoniques, six alternates avec `x-default`, `index, follow` |
| stabilité des URL avant extension | blocage attendu : cinq routes et leurs sorties dérivées ne sont pas encore dans la baseline |

Le blocage du contrat URL n'est pas une régression : le dépôt exige que l'ajout soit d'abord commité, puis inscrit dans la baseline depuis un HEAD propre. L'extension du contrat sera donc un commit technique séparé mais poussée avec le seul concept `turtle`, afin de produire un seul déploiement de concept.

## Autorité externe — frontière d'autorisation

L'ordre conservé est : Marika Pech, DreamWell, Atlas/ILTY, puis routes éditoriales allemandes et espagnoles. L'actif Noctalia à citer existe déjà, mais aucun message ne part dans ce chantier sans :

1. vérification fraîche du destinataire, de la page source, du lien actuel et de l'absence de doublon ;
2. brouillon factuel et traçable ;
3. autorisation explicite propre à l'envoi ;
4. preuve d'envoi distincte d'une réponse, d'une publication ou d'un backlink acquis.

État actuel : aucun envoi externe effectué par ce chantier.

## Expériences et leviers différés

### `scuola`

Baseline naturelle : 7 clics, 1 906 impressions, CTR 0,367 %, position 6,08. Aucun traitement n'est publié. Si la lecture du 15 août n'introduit pas de facteur confondant, le seul traitement admissible reste `documentTitle` + `documentMetaDescription`, dans un commit et un déploiement séparés.

### 254 URL explorées non indexées

La liste doit être segmentée en pages attendues, faibles, dupliquées et réellement utiles. L'article allemand sur la poursuite est le premier cas à lire, pas une autorisation automatique de maillage. Un lien interne n'est ajouté que si la page cible est canonique, indexable, utile pour l'intention et absente du chemin actuel.

### Propriétaires existants

`/es/simbolos/coche` conserve sa baseline de décision : 1 230 impressions, CTR 0,3 %, position 8,9. Le prochain lot doit viser le CTR et l'adéquation d'intention sans changer l'URL. Les ancres italiennes sur la poursuite restent inchangées tant que GSC ne démontre pas un ownership encore partagé.

### Redirection italienne mal encodée

La variante `per%C3%A9...` renvoie encore 404 publiquement, mais son correctif appartient à un autre worktree. Elle reste en `HOLD_GSC_PROOF` jusqu'à confirmation de cette URL exacte dans GSC ; aucun diff externe n'est repris à l'aveugle.

## Mesure et coût

- Crédits Ahrefs consommés par cette implémentation : 0.
- Dernier compteur durable disponible avant ce chantier : 113/200 crédits généraux utilisés.
- Requêtes GSC brutes versionnées : aucune.
- Mutation GSC : aucune.
- Demande d'indexation : aucune.
- Achat ou changement d'abonnement : aucun ; la décision reste à l'utilisateur.

Après preuve publique, les nouvelles routes seront mesurées dans GSC sur des fenêtres complètes. Une réponse HTTP 200 ou une présence au sitemap prouve la publication, pas l'indexation ni un gain de ranking.
