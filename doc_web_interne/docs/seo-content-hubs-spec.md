# Content hubs SEO Noctalia — spécification d’implémentation

Date : 16 juillet 2026  
Statut : **implémentée et validée localement ; aucune publication lancée**
Base inspectée : `master` à `f8bdfdc6e`  
Périmètre : site marketing multilingue FR, EN, ES, DE et IT

## Décision structurante

Noctalia doit formaliser son architecture de content hubs à partir des pages déjà publiées.

Cette évolution organise le maillage interne ; elle ne migre pas l’arborescence du site.

> **Contrainte absolue : aucune URL existante ne doit changer.**

Le chantier ne doit créer, supprimer, renommer ni rediriger aucune URL. Il ne doit modifier aucun slug, canonical, hreflang, chemin de sitemap ou chemin de breadcrumb existant. Toute différence arrête l’implémentation.

## Sources de vérité

- Contenu éditorial : `docs-src/content/blog/`
- Calendrier éditorial : `doc_web_interne/docs/CONTENT-PLANNING.md`
- Registre généré des routes localisées : `data/site-manifest.json`
- Registre généré du blog : `data/content-manifest.json`
- Configuration globale : `docs-src/config/site.config.json`
- Générateurs guides et symboles : `scripts/build-guides-pages.js` et `docs-src/static/scripts/generate-symbol-pages.js`
- Sortie générée et ignorée par Git : `docs/`
- Référence de méthode : [Semrush — Content Hubs: What They Are & How to Create One](https://www.semrush.com/blog/content-hub/)

`CONTENT-PLANNING.md` reste la source de vérité pour les sujets, les dates et les priorités de publication. La future configuration des hubs décrit uniquement des relations entre pages existantes. Les deux manifests sont des sorties versionnées de résolution et de contrôle, pas des fichiers où éditer les URLs.

## État courant vérifié

Le site possède déjà les fondations d’une architecture hub-and-spoke :

- 233 pages logiques dans `data/site-manifest.json` ;
- 5 langues par page ;
- 1 165 chemins localisés uniques ;
- 1 170 fichiers HTML générés, en incluant les sorties noindex, callback, erreur et templates ;
- 49 pages de type `blogArticle`, dont 3 hubs éditoriaux utilisant un JSON-LD `CollectionPage` ;
- 1 index blog ;
- 1 index guides ;
- 1 dictionnaire de symboles ;
- 8 guides de curation ;
- 8 catégories de symboles ;
- 150 pages de symboles.

Les hubs éditoriaux existants sont :

| Identifiant stable | Modèle | URL française existante |
| --- | --- | --- |
| `blog.dream-meanings` | Hub-and-spoke | `/fr/blog/signification-des-reves` |
| `blog.dream-journal` | Hub-and-spoke | `/fr/blog/journal-de-reves` |
| `blog.lucid-dreaming` | Hub-and-spoke | `/fr/blog/reve-lucide` |
| `guide.dictionary` | Content database | `/fr/guides/dictionnaire-symboles-reves` |

Les trois hubs blog, l’index blog et leurs principaux spokes contiennent déjà des liens manuels. Les 27 spokes retenus ci-dessous renvoient déjà vers leur hub dans les cinq langues. Le dictionnaire relie déjà ses catégories et ses symboles, qui proposent des retours vers le dictionnaire. L’objectif n’est donc pas de reconstruire ces pages, mais de rendre leur topologie explicite, cohérente et testable.

## Objectifs

1. Déclarer chaque relation hub-spoke à partir de `pageId` stables.
2. Garantir un hub principal au maximum par article.
3. Garantir le lien du hub vers chaque spoke déclaré et le retour du spoke vers son hub.
4. Proposer au maximum trois contenus réellement liés sur les spokes retenus.
5. Appliquer les mêmes relations dans les cinq langues sans dupliquer les slugs dans une nouvelle configuration.
6. Empêcher automatiquement toute régression d’URL publique.
7. Conserver le dictionnaire comme content database existante, sans réécrire son générateur.

## Hors périmètre

- créer une route `/content-hub`, `/topics`, `/themes` ou `/categories` ;
- renommer une page ou harmoniser des slugs entre langues ;
- créer un nouveau hub « sommeil » pendant ce chantier ;
- modifier les canonical, hreflang, breadcrumbs, redirections ou le sitemap ;
- réécrire les 150 pages de symboles ou les générateurs de guides ;
- changer le header, le footer ou la navigation principale ;
- ajouter un nouveau type de JSON-LD ;
- publier un nouvel article ;
- modifier le portefeuille des 50 mots-clés Ahrefs pendant la baseline ;
- souscrire un outil ou un add-on supplémentaire ;
- pousser, déployer ou soumettre des URLs ou un sitemap.

## Architecture cible

Les gateways et hubs restent sur leurs URLs actuelles :

```text
blog.index — /{lang}/blog/
├── blog.dream-meanings — hub existant
│   └── 19 spokes éditoriaux existants
├── blog.dream-journal — hub existant
│   └── 5 spokes éditoriaux existants
└── blog.lucid-dreaming — hub existant
    └── 3 spokes éditoriaux existants

guide.dictionary — content database existante
├── 8 symbolCategory
└── 150 symbol

8 guideCuration existants — hors du contrat content database initial
```

`blog.index` et `guide.index` sont des gateways de découverte, pas des hubs principaux d’articles.

### Portefeuille initial des hubs blog

Le portefeuille initial formalise uniquement les rattachements déjà cohérents avec le contenu. Une page peut rester sans hub principal ; il ne faut pas forcer une appartenance artificielle.

#### `blog.dream-meanings`

- `blog.anxiety-dreams-meaning`
- `blog.being-chased-dreams`
- `blog.children-dreams-guide`
- `blog.death-dreams-meaning`
- `blog.dream-interpretation-history`
- `blog.dreams-about-ex`
- `blog.dreams-and-creativity`
- `blog.dreams-mental-health`
- `blog.exam-dreams-meaning`
- `blog.falling-dreams-meaning`
- `blog.flying-dreams-meaning`
- `blog.precognitive-dreams-science`
- `blog.pregnancy-dreams-meaning`
- `blog.recurring-dreams-meaning`
- `blog.snake-dreams-meaning`
- `blog.stop-nightmares-guide`
- `blog.stress-dreams-work`
- `blog.teeth-falling-out-dreams`
- `blog.water-dreams-meaning`

#### `blog.dream-journal`

- `blog.dream-journal-guide`
- `blog.how-to-remember-dreams`
- `blog.rem-sleep-dreams`
- `blog.why-we-dream-science`
- `blog.why-we-forget-dreams`

#### `blog.lucid-dreaming`

- `blog.dream-incubation-guide`
- `blog.lucid-dreaming-beginners-guide`
- `blog.sleep-paralysis-guide`

Un lien contextuel vers un autre hub reste autorisé. Il ne transforme pas ce second hub en propriétaire principal. Par exemple, un article principalement rattaché au journal peut aussi citer le rêve lucide lorsque le contenu le justifie.

## Modèle de configuration

Créer `docs-src/config/content-hubs.json`.

La configuration ne doit contenir que des identifiants logiques. Les champs `url`, `path`, `slug`, `canonical` et `hreflang` y sont interdits.

Exemple de forme attendue :

```json
{
  "schemaVersion": 1,
  "hubs": [
    {
      "id": "dream-meanings",
      "kind": "hubAndSpoke",
      "directoryPageId": "blog.index",
      "hubPageId": "blog.dream-meanings",
      "spokePageIds": [
        "blog.water-dreams-meaning",
        "blog.flying-dreams-meaning"
      ],
      "relatedByPageId": {
        "blog.water-dreams-meaning": [
          "blog.recurring-dreams-meaning",
          "blog.dreams-mental-health"
        ]
      },
      "render": {
        "hubMissingSpokes": true,
        "spokeMissingLinks": true
      }
    },
    {
      "id": "dream-symbols",
      "kind": "contentDatabase",
      "directoryPageId": "guide.index",
      "hubPageId": "guide.dictionary",
      "memberSelectors": [
        { "collection": "symbols", "types": ["symbolCategory", "symbol"] }
      ],
      "renderMode": "validateOnly"
    }
  ]
}
```

Le fichier réel doit inclure les 27 spokes blog listés dans cette spec. `relatedByPageId` est explicite et facultatif : aucun algorithme ne doit inventer des rapprochements éditoriaux. Une page peut avoir zéro à trois contenus liés. Une relation `relatedByPageId` inter-hub est interdite dans le MVP ; les liens contextuels manuels inter-hub restent autorisés.

`directoryPageId` est contractuel : dans les cinq langues, chaque gateway doit déjà lier le `hubPageId` associé. Aucun module n’est injecté sur une gateway.

## Registre de résolution

Créer `scripts/lib/content-hub-registry.js`.

Responsabilités :

- charger et valider `content-hubs.json` ;
- indexer les hubs et les spokes ;
- refuser tout champ d’identité d’URL dans la configuration ;
- refuser un `pageId` absent de `data/site-manifest.json` ;
- refuser un article déclaré dans plusieurs hubs principaux ;
- refuser une relation vers soi-même ;
- refuser plus de trois contenus liés ;
- vérifier que chaque contenu lié appartient au même hub principal ;
- vérifier la relation `directoryPageId -> hubPageId` dans les cinq langues ;
- résoudre tous les chemins avec `entry.locales[lang].path` depuis le manifeste ;
- résoudre les titres depuis le front matter localisé des pages blog ;
- ne jamais reconstruire un chemin avec une concaténation de langue et de slug, ni un titre depuis un slug.

L’API interne minimale doit permettre :

```js
registry.getHubByPageId(pageId)
registry.getPrimaryHubForSpoke(pageId)
registry.getRelatedSpokes(pageId)
registry.resolvePath(pageId, lang)
registry.resolveTitle(pageId, lang)
```

## Rendu du MVP

Créer `scripts/lib/docs-components/content-hubs.js` et l’appeler depuis `scripts/lib/docs-renderer.js` uniquement pour les hubs et les spokes explicitement déclarés dans la configuration.

Sur un spoke, le composant vérifie d’abord les destinations déjà présentes dans le corps éditorial. Le module éventuel est placé à la fin du contenu principal et contient seulement les relations encore absentes :

- un lien clair vers le hub principal si ce backlink manque ;
- de zéro à trois liens vers des spokes explicitement associés et encore absents ;
- des libellés génériques localisés via `docs-src/locales/{en,fr,es,de,it}.json` ;
- des URLs résolues par le registre, dans la langue de la page.

Sur un hub, le composant compare les spokes déclarés aux liens déjà présents dans le corps éditorial. Il ajoute une section complémentaire uniquement pour les spokes encore absents. Il ne reproduit jamais une carte ou un lien déjà présent.

Contraintes de rendu :

- HTML statique, sans JavaScript supplémentaire ;
- aucun visuel lourd ;
- aucune modification du `<head>` ;
- aucun changement de JSON-LD ;
- aucun changement de breadcrumb ;
- un seul bloc portant `data-content-hub-module` par page ;
- aucun bloc si toutes les relations configurées sont déjà présentes ;
- sur un hub, le bloc n’existe que s’il reste au moins un spoke non lié dans le corps éditorial ;
- aucun bloc sur les deux gateways, les pages non rattachées, les guides ou les symboles ;
- ancres naturelles et localisées, sans répétition forcée du mot-clé exact ;
- titres de liens issus des métadonnées existantes, jamais de slugs transformés en texte ;
- liens accessibles au clavier, avec une hiérarchie de titres cohérente ;
- aucun layout shift : le bloc est rendu côté build et réserve naturellement sa place.

Pour obtenir un titre cible, le composant lit le front matter localisé existant avec les helpers de `scripts/lib/docs-source-utils.js`. Une métadonnée absente fait échouer le build ; le slug ne sert jamais de texte de secours.

Pour détecter une destination déjà présente, le composant résout chaque `href` relatif depuis l’URL courante, retire seulement query et fragment, puis compare le pathname exact à celui du manifeste. Cette déduplication concerne le module généré et ses compléments ; elle n’interdit pas les liens contextuels déjà présents ailleurs dans l’article.

Les cartes déjà présentes sur `blog.index` et sur les trois hubs restent la présentation de référence du MVP. Elles ne doivent pas être dupliquées par le composant. Le composant complète uniquement les liens manquants ; le nouveau contrôle vérifie ensuite que chaque hub lie tous ses spokes déclarés.

## Content database des symboles

Le dictionnaire ne doit pas être reconstruit.

Le contrôle doit confirmer la chaîne existante :

```text
guide.index -> guide.dictionary -> symbolCategory/symbol
symbolCategory/symbol -> guide.dictionary
```

Pour le MVP, ne pas modifier :

- `scripts/build-guides-pages.js` ;
- `docs-src/static/scripts/generate-symbol-pages.js` ;
- `docs-src/static/data/symbol-i18n.json` ;
- `docs-src/static/data/curation-pages.json` ;
- `data/dream-symbols.json`.

## Contrat absolu d’immuabilité des URLs

### Pourquoi un nouveau garde-fou est nécessaire

Les contrôles actuels valident la cohérence entre le manifeste, le HTML et le sitemap. Ils accepteraient néanmoins un renommage si toutes les couches étaient modifiées de manière cohérente.

Il faut donc comparer le candidat à une référence figée avant l’implémentation.

### Baseline versionnée

Créer `data/seo-url-contract-baseline.json` depuis un build propre de la base `f8bdfdc6e`, avant toute modification liée aux hubs.

La baseline contient `sourceRevision`. Cette révision est une métadonnée de provenance et doit être un ancêtre du commit candidat ; elle n’est jamais comparée à `HEAD` par égalité.

Le snapshot doit contenir :

1. pour chaque `collection + pageId + langue` : type, langue canonique, slug canonique, slug localisé et path ;
2. l’ensemble exact `allHtmlOutputPaths` des 1 170 fichiers HTML générés, y compris `404.html`, `auth/callback/index.html`, `en/index.html` et les deux templates HTML ;
3. pour chaque page HTML indexable : fichier de sortie, canonical, hreflang complets, `og:url`, identités JSON-LD SEO, breadcrumbs JSON-LD et liens visibles du fil d’Ariane ;
4. pour le sitemap : chaque `<loc>` et chaque alternate hreflang ;
5. les règles actives de `docs-src/static/_redirects` et `docs-src/static/vercel.json`.

Les identités JSON-LD figées sont uniquement :

- `WebPage.url` et `WebPage.@id` ;
- `BlogPosting.url`, `BlogPosting.@id` et `BlogPosting.mainEntityOfPage.@id` ;
- `CollectionPage.url` et `CollectionPage.@id`.

Les images, auteurs, organisations et URLs d’un `ItemList` ne font pas partie du contrat d’identité de route.

Le snapshot trie les collections sans ordre sémantique : pages, `pageId`, langues, hreflang et entrées sitemap. Il préserve strictement :

- l’ordre des positions de chaque breadcrumb ;
- l’ordre source de `docs-src/static/_redirects` ;
- l’ordre des tableaux `redirects` et `rewrites` de `docs-src/static/vercel.json`.

Pour les breadcrumbs, deux listes distinctes sont stockées :

- chaque `BreadcrumbList` JSON-LD, ordonné par `position`, en lisant `item` ou `item.@id` ;
- uniquement les `a[itemprop="item"][href]` visibles, résolus en URL absolue depuis la page courante.

Le dernier breadcrumb visible peut être du texte sans lien. Les deux listes n’ont donc pas l’obligation d’avoir la même longueur.

Les valeurs suivantes doivent rester exactement identiques :

- ensemble des `pageId` ;
- association `pageId + langue -> slug + path` ;
- ensemble des 1 170 sorties HTML et des chemins indexables ;
- canonical ;
- hreflang, y compris `x-default` ;
- `og:url` et identités JSON-LD SEO ;
- entrées et alternates du sitemap ;
- cibles des breadcrumbs JSON-LD et visibles ;
- règles de redirection.

Le contrôle compare les valeurs brutes après trim et décodage HTML ou XML uniquement. Il ne doit utiliser ni `normalizeUrl()`, ni `normalizePrettyPath()`, ni une sérialisation par `URL` pour comparer canonical, hreflang, `og:url`, JSON-LD ou sitemap. `new URL()` est autorisé uniquement pour résoudre un `href` relatif de breadcrumb visible.

Les changements suivants échouent notamment :

- ajout ou retrait d’un slash final ;
- changement de casse ;
- ajout ou retrait de `.html` ;
- changement d’encodage ;
- changement de domaine ou de protocole ;
- ajout, suppression ou remplacement d’un chemin ;
- réattribution d’un chemin à un autre `pageId` ;
- ajout d’une redirection pour masquer un renommage.

Peuvent être exclus du snapshot : `lastmod`, titres, descriptions, images, textes d’ancre et nouveaux liens internes non structurels.

Avant toute comparaison, l’extracteur échoue sur :

- plusieurs canonical dans une page ;
- plusieurs `og:url` dans une page ;
- plusieurs hreflang identiques dans une page ;
- plusieurs `<url>` avec le même `<loc>` ;
- plusieurs alternates de même langue dans une entrée sitemap ;
- plusieurs positions identiques dans un breadcrumb.

### Contrôle automatisé

Créer `scripts/check-public-url-stability.js` avec trois modes :

```bash
node scripts/check-public-url-stability.js
node scripts/check-public-url-stability.js --write-baseline
node scripts/check-public-url-stability.js --extend-baseline
```

Le mode `--write-baseline` :

- est exécuté une seule fois avant les changements ;
- refuse de remplacer une baseline existante ;
- n’est appelé ni par `docs:build`, ni par `docs:check`, ni par la CI ;
- ne possède pas de commande npm raccourcie ;
- doit partir d’une révision exacte, propre et déjà validée par `docs:build` puis `docs:check` ;
- ne peut pas être utilisé dans le commit d’implémentation des hubs.

Le mode `--extend-baseline` est réservé aux futures publications explicitement approuvées. Il peut seulement ajouter de nouveaux `pageId`, sorties HTML et routes ; il échoue si une seule entrée déjà protégée est modifiée, réattribuée ou supprimée. Il n’est pas utilisé pendant ce chantier et ne possède pas non plus de commande npm raccourcie.

Le mode de vérification appelle `assertDocsBuildReady(ROOT_DIR)`, puis est ajouté à `scripts/docs-check.js` après `validate-i18n-seo.js` ; le sitemap a déjà été généré par `docs:build`. Une erreur indique le `pageId`, la langue, la valeur attendue et la valeur reçue.

Pour ce chantier, les quatre totaux suivants restent à **1 165** avant et après :

- chemins manifest ;
- chemins uniques ;
- pages canoniques ;
- entrées sitemap.

L’ensemble des sorties HTML reste également à **1 170**. Ces valeurs sont des critères du chantier, pas des constantes générales du produit : une future publication éditoriale devra être traitée séparément, après intégration de ce lot et avec une extension strictement additive approuvée de la baseline. Les 1 165 routes déjà protégées resteront alors immuables.

## Contrat content hubs

Créer `scripts/check-content-hub-contract.js`.

Le checker appelle d’abord `assertDocsBuildReady(ROOT_DIR)` afin de ne jamais analyser un rendu absent, ancien ou issu d’un build échoué.

Le contrôle s’exécute sur le HTML généré et échoue si :

- un hub ou spoke déclaré n’existe pas dans les cinq langues ;
- une gateway ne lie pas son hub déclaré dans une langue ;
- un article possède plus d’un hub principal ;
- un hub ne lie pas un spoke déclaré ;
- un spoke ne renvoie pas vers son hub principal ;
- un contenu lié est absent, identique à la page courante ou hors du hub principal ;
- plus de trois contenus liés sont rendus dans un module spoke ;
- un lien traverse les langues ;
- un lien est cassé ou pointe vers une redirection ;
- le bloc `data-content-hub-module` est injecté plusieurs fois ;
- une gateway reçoit un module ou un hub reçoit un lien complémentaire déjà présent dans son corps éditorial ;
- le dictionnaire, une catégorie ou un symbole rompt la chaîne de retour existante.

Les liens contextuels supplémentaires restent autorisés. Le contrôle ne doit jamais déduire le hub principal à partir de tous les liens trouvés dans une page.

## Fichiers prévus

### Nouveaux fichiers

- `docs-src/config/content-hubs.json`
- `scripts/lib/content-hub-registry.js`
- `scripts/lib/content-hub-registry.test.js`
- `scripts/lib/docs-components/content-hubs.js`
- `scripts/check-content-hub-contract.js`
- `scripts/check-content-hub-contract.test.js`
- `scripts/check-public-url-stability.js`
- `scripts/check-public-url-stability.test.js`
- `data/seo-url-contract-baseline.json`

### Fichiers modifiés

- `scripts/lib/docs-renderer.js` : insertion du module sur les hubs et spokes déclarés ;
- `docs-src/locales/en.json`
- `docs-src/locales/fr.json`
- `docs-src/locales/es.json`
- `docs-src/locales/de.json`
- `docs-src/locales/it.json`
- `scripts/docs-check.js` : ajout des deux contrats ;
- `package.json` : commandes ciblées `docs:check-content-hubs` et `docs:check-url-stability`.

La workflow `.github/workflows/quality.yml` exécute déjà `docs:build` puis `docs:check` lorsque `docs-src/`, `data/` ou `scripts/` change. Aucune modification de workflow n’est nécessaire si les deux contrôles sont bien intégrés à `docs:check`.

### Fichiers explicitement inchangés dans le MVP

- `docs-src/content/blog/**`
- `scripts/docs-build.js`
- `scripts/build-content-manifest.js`
- `scripts/build-site-manifest.js`
- `scripts/lib/site-manifest.js`
- `scripts/build-guides-pages.js`
- `docs-src/static/scripts/generate-symbol-pages.js`
- `data/content-manifest.json`
- `data/site-manifest.json`
- `docs-src/config/static-pages.json`
- `docs-src/config/site.config.json`
- `docs-src/static/data/symbol-i18n.json`
- `docs-src/static/data/curation-pages.json`
- `data/dream-symbols.json`
- `docs-src/static/_redirects`
- `docs-src/static/vercel.json`

`docs/` reste une sortie générée ignorée par Git et ne doit jamais être éditée ou commitée.

## Plan d’implémentation

### Lot 0 — figer les URLs

1. Créer un worktree propre contenant cette spec et dont `f8bdfdc6e` est l’exacte révision source URL de référence.
2. Avant tout code hub, lancer `npm run docs:build` puis `npm run docs:check` sur cette base.
3. Ajouter le script de stabilité et ses tests.
4. Générer `data/seo-url-contract-baseline.json` avec `sourceRevision: "f8bdfdc6e2db6ba7ecab2346fbc0925cf7098ab4"`.
5. Vérifier les 1 165 routes et les 1 170 sorties HTML.
6. Créer un commit local focalisé, sans publication, et conserver son hash comme `<commit-lot-0>`.

Si `master` avance avant le début du chantier, arrêter ce lot, choisir la nouvelle révision exacte avant tout changement hub, relancer les contrôles et mettre à jour dans cette spec la révision et les totaux observés.

Commit recommandé : `test(seo): freeze public URL contract`.

### Lot 1 — déclarer la topologie

1. Ajouter `content-hubs.json` avec les 27 spokes blog et le dictionnaire.
2. Ajouter le registre et ses tests.
3. Ajouter le contrat content hubs en mode vérification.
4. Confirmer la parité des cinq langues.
5. Confirmer que les manifests restent byte-identiques.

### Lot 2 — rendre les modules hub et spoke

1. Ajouter le composant HTML statique.
2. Ajouter les libellés dans les cinq locales.
3. Injecter le composant sur les spokes déclarés et compléter uniquement les liens manquants sur les hubs.
4. Vérifier l’absence de duplication et de lien interlangue.
5. Vérifier que gateways, guides et symboles restent structurellement inchangés. Sur un hub, le seul changement structurel autorisé est le bloc complémentaire prévu ; le `<head>`, le JSON-LD et les breadcrumbs restent identiques.

### Lot 3 — intégrer les gates

1. Ajouter les deux commandes npm ciblées.
2. Intégrer les deux contrôles à `docs:check`.
3. Lancer les tests ciblés puis le pipeline site complet.
4. Créer un second commit local focalisé, sans push ni déploiement.

Commit recommandé : `feat(seo): formalize existing content hubs`.

### Lot 4 — mesure après publication autorisée

Si une publication est demandée séparément :

- annoter la date dans le suivi SEO ;
- conserver les 50 mots-clés Ahrefs inchangés pendant la baseline ;
- suivre par hub les impressions, clics, CTR, position moyenne et pages recevant des clics ;
- comparer hubs et spokes à J+14 et J+28 ;
- n’ouvrir un nouveau hub que si les données montrent un sujet suffisamment dense et distinct.

Ce lot ne nécessite pas d’abonnement Semrush.

## Validation

### Tests ciblés

```bash
npm run test:file -- \
  scripts/lib/content-hub-registry.test.js \
  scripts/check-content-hub-contract.test.js \
  scripts/check-public-url-stability.test.js
```

### Site généré

```bash
npm run docs:build
npm run docs:check-url-stability
npm run docs:check-content-hubs
npm run docs:check
npm run docs:check-crosslinks
git diff --check
git diff --exit-code <commit-lot-0>..HEAD -- data/seo-url-contract-baseline.json
```

`npm run docs:release-check` n’est exécuté que dans une phase de publication explicitement autorisée. Aucun deploy, push, ajout Search Console/Bing ou resoumission de sitemap ne fait partie de cette spec.

## Critères d’acceptation bloquants

- [ ] La baseline contient 233 pages logiques, 1 165 chemins localisés uniques et 1 170 sorties HTML.
- [ ] L’ensemble des URLs avant/après est strictement identique.
- [ ] Zéro slug, path, canonical, hreflang, `og:url`, identité JSON-LD SEO, cible de breadcrumb ou règle de redirection change.
- [ ] La baseline est inchangée entre le commit du Lot 0 et le commit d’implémentation.
- [ ] `data/content-manifest.json` et `data/site-manifest.json` sont inchangés.
- [ ] Les trois hubs blog utilisent uniquement des `pageId` ; le dictionnaire utilise son `pageId` et des sélecteurs de collection/type sans URL.
- [ ] Les 27 spokes blog ont au maximum un hub principal.
- [ ] Les relations passent dans les cinq langues.
- [ ] Chaque gateway lie chaque hub déclaré dans les cinq langues.
- [ ] Chaque hub lie tous ses spokes déclarés.
- [ ] Chaque spoke lie son hub principal.
- [ ] Chaque spoke affiche au maximum trois contenus liés explicitement configurés.
- [ ] Aucun bloc content hub, aucune carte et aucun lien complémentaire n’est rendu en double.
- [ ] Le dictionnaire, ses 8 catégories et ses 150 symboles conservent leur chaîne actuelle.
- [ ] Aucun fichier source blog n’est modifié pour le MVP.
- [ ] Aucun nouveau JavaScript client ni nouvelle image n’est ajouté.
- [ ] Les tests ciblés, `docs:build`, `docs:check`, `docs:check-crosslinks` et `git diff --check` passent.
- [ ] `docs/` n’est pas commitée.
- [ ] Aucun push, déploiement ou soumission externe n’a lieu sans demande explicite.

Un seul écart d’URL rend le lot non livrable, même si une redirection fonctionne.

## Risques et parades

| Risque | Parade |
| --- | --- |
| Déduire le hub principal depuis tous les liens d’une page | Utiliser uniquement `content-hubs.json` comme registre d’appartenance. |
| Dupliquer les cartes déjà présentes | Sur les hubs, ne rendre que les spokes absents du corps éditorial. Tester l’unicité de `data-content-hub-module` et des destinations. |
| Créer des liens traduits vers la mauvaise langue | Résoudre chaque cible depuis `site-manifest.json` avec la langue courante. |
| Diluer la pertinence avec des liens automatiques | Exiger une liste `relatedByPageId` explicite, limitée à trois. |
| Faire dériver le dictionnaire | Limiter son contrat aux 8 catégories et 150 symboles déjà reliés, le déclarer `validateOnly` et ne pas toucher à ses générateurs. |
| Modifier une URL de façon cohérente mais invisible aux checks actuels | Comparer tout le rendu à une baseline versionnée immuable. |
| Mélanger ce chantier avec une publication éditoriale | Utiliser un worktree et des commits séparés ; geler la base pendant le lot. |
| Ajouter du poids ou provoquer du CLS | HTML statique, sans image ni script et sans chargement différé. |

## Retour arrière

Le retour arrière consiste à retirer le second commit d’implémentation des hubs. Le commit de contrat d’URL peut rester : il protège le site indépendamment du composant.

Aucune redirection, restauration de sitemap ou action Search Console/Bing ne doit être nécessaire, puisque les URLs ne changent jamais.

## Décisions différées

- Un éventuel hub « sommeil et environnement » sera évalué après les mesures J+28 ; aucune URL n’est réservée maintenant.
- La migration des cartes manuelles des hubs vers un rendu entièrement généré est hors MVP.
- Une modification future d’URL exige une spec de migration distincte et ne peut pas être introduite dans ce chantier.

## Définition de terminé

Le pipeline local est prêt lorsque les deux commits locaux coexistent dans un worktree propre, que tous les gates sont verts et que le diff d’URLs est vide. La publication reste une décision séparée de l’utilisateur.
