# Noctalia — brief d'implémentation multilingue `cemetery` (J29–J31)

Date de préparation : 13 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

Branche de travail : `codex/seo-ranking-wave-2`

## État et porte d'autorisation

Ce document est un brief prêt à implémenter. Il n'autorise aucune publication
avant la lecture J+7 du 15 août 2026 (`casa`, `ragno`, `perro` ; `scuola` reste
dans son expérience séparée). En vertu du HOLD explicite :

- `data/dream-symbols.json` n'a pas été modifié ; `cemetery` n'y figure pas ;
- aucune route, page, image, canonical ou hreflang n'a été créé ;
- rien n'a été poussé vers `master`, déployé ni demandé en indexation ;
- les 50 suivis Rank Tracker, `casa`, `ragno`, `perro` et `scuola` sont
  inchangés.

L'opportunité reste ouverte parce que le manque de propriétaire précis est
confirmé sur les deux couches indépendantes ci-dessous.

## Preuves, par couche

### Preuve locale (dépôt)

- `data/dream-symbols.json` contient `158` concepts ; aucune entrée
  `cemetery|cimetière|cementerio|friedhof|cimitero`, dans aucun champ.
- `docs-src/content/` ne contient aucune occurrence de ces cinq formes : aucun
  propriétaire éditorial local ni passage localisé préexistant.
- Voisinage existant pertinent (aucun n'est un propriétaire de l'intention
  « lieu cimetière ») :
  - `death` (catégorie `actions`) — fin de phase, transformation ;
  - `deceased-person` (catégorie `people`) — personne décédée ;
  - `funeral` (catégorie `actions`) — cérémonie d'adieu ;
  - `ghost` (catégorie `people`) — présence ;
  - aucun concept `grave` / `graves` n'existe dans le fichier.
- Risque de cannibalisation évalué : faible et gérable, à condition de centrer
  chaque propriétaire sur le **lieu** (cimetière, tombes, allées, portail,
  nuit, promenade, rencontre) et de renvoyer mort/deuil/présence vers les
  fiches existantes par liens contextuels, sans recouvrir leurs requêtes
  principales. Les hubs de lieux (catégorie `places`, 24 concepts) restent
  hubs ; les cinq propriétaires reçoivent l'intention précise.

### Preuve GSC (propriété `sc-domain:noctalia.app`, relevé du 13 août 2026)

Fenêtre 28 jours, 15 juillet–11 août 2026 (dernière journée complète visible :
11 août) : `4 231` clics, `501 427` impressions, CTR `0,8 %`, position moyenne
`7,4` pour la propriété.

Cluster `cemetery|cimetière|cementerio|Friedhof|cimitero` :

- 28 jours : `0` clic, `0` impression ;
- fenêtre disponible « 12 mois » (5 décembre 2025 → 11 août 2026) : `0` clic,
  `1` impression, position `51` — une longue requête anglaise sur un chien dans
  un cimetière, hors intention ;
- décision d'ownership : absence durable de propriétaire GSC dans les données
  restituées (les totaux filtrés peuvent être incomplets ; cela ne garantit
  pas l'absence de toute requête anonymisée).

Aucune nouvelle lecture GSC n'a été produite par ce lot : aucune couche GSC
fraîche n'était accessible dans la session de collecte, et aucune valeur
ultérieure au 11 août n'est affirmée ici.

### Preuve Ahrefs (projet `9361004`)

Relevé `Limits & Usage` au début du lot (gratuit, via API) : plan
`Trial, billed monthly`, remise à zéro `2026-08-16T00:00:00Z`, usage API
workspace `0/0`. Cette couche API est distincte du compteur de crédits
généraux de l'interface ; la baseline UI à revalider restait `131/200`
utilisés, `69` restants, Rank Tracker `50/50`, Site Audit `3 627/10 000`
(dernier relevé documenté au 13 août).

Micro-lot SERP autorisé (plafond 4 crédits généraux) :

| # | Marché | Requête | Résultat |
| ---: | --- | --- | --- |
| 1 | ES | `soñar con cementerio` | refus serveur : `API units limit reached. Expected usage: 50, API units left: 0` |
| 1 bis | ES | `soñar con cementerio` (variante réduite) | même refus serveur |
| 2 | DE | `traumdeutung friedhof` | non tentée : même couche API épuisée |
| 3 | FR | `rêver de cimetière` | non tentée : même couche API épuisée |
| 4 | US/EN | `dreaming about cemetery` | non tentée : même couche API épuisée |

Coût réel du micro-lot : `0` crédit. Aucun appel n'a retourné de données ; la
baseline `131/200` (69 restants) reste la référence non contredite. Le blocage
confirme la frontière déjà documentée : la couche API signale `0` unité
disponible, distincte des crédits généraux visibles dans l'interface Starter.
Aucun achat, add-on ou changement d'abonnement n'a été effectué pour lever ce
blocage.

Métriques Ahrefs disponibles sans nouvelle dépense (déjà versionnées) :

| Marché | Requête | KD | Volume pays | TP | Source |
| --- | --- | ---: | ---: | ---: | --- |
| IT | `sognare cimitero` | 0 | 600 | 600 | micro-lot J29 du 13 août |
| ES | `soñar con cementerio` | 0 | 250 | 150 | micro-lot J29 du 13 août |
| DE | `traumdeutung friedhof` | 0 | 150 | 60 | micro-lot J29 du 13 août |
| FR | `rêver de cimetière` | 0 | 60 | 300 | backlog J27 du 11 août, non revalidé J29 |
| US | `dreaming about cemetery` | 0 | 10 | 60 | backlog J27 du 11 août, non revalidé J29 |

SERP déjà documentées : IT `sognare cimitero` (DR `0` en positions 3 et 8,
DR `25` en position 4 avec zéro domaine référent ; variantes tombes, nuit,
foule, sens psychologique). Aucune SERP fraîche DE/FR/US n'existe pour ce
concept ; les valeurs FR/US ci-dessus datent du 11 août et doivent être
traitées comme indicatives.

## Brief éditorial partagé

Intention : comprendre ce que peut signifier un rêve situé dans un cimetière —
le lieu, ses tombes, son ambiance, ce qu'on y fait et avec qui — sans prédire
deuil, danger ou chance.

Angle commun aux cinq propriétaires : lieu, mémoire, deuil, transition,
tombes, nuit, présence d'autres personnes (famille, foule, inconnus), promenade
ou recherche d'une tombe, portail, cimetière abandonné. Cadrage non prédictif :
le rêve n'annonce ni décès, ni événement futur, ni message surnaturel ; il
invite à comparer la scène avec l'émotion et le contexte récent du rêveur.

Exclusions explicites sur les cinq marchés : pas de Smorfia napolitaine, pas
de numéros de loterie, pas de lecture divinatoire présentée comme un fait, pas
de promesse de signe des défunts. Pour l'Italie en particulier, la page ne doit
pas centrer son angle sur les numéros de la Smorfia ; le folklore peut être
mentionné comme limite culturelle, jamais comme mode d'emploi.

Structure par propriétaire (identique aux vagues turtle/crocodile/lice/scorpion) :
titre et description uniques, résumé, trois questions de réflexion, quatre FAQ
et quatre scénarios développés, plus un actif éditorial 1 600 × 900 sans texte,
logo, filigrane ni code divinatoire, décliné en variantes 240/480/800/1 200.

### Routes canoniques préparées

| Langue | Route canonique |
| --- | --- |
| EN | `/en/symbols/cemeteries` |
| FR | `/fr/symboles/cimetiere` |
| ES | `/es/simbolos/cementerio` |
| DE | `/de/traumsymbole/friedhof` |
| IT | `/it/simboli/cimitero` |

La forme plurielle EN suit le pattern des propriétaires d'intention (`turtles`,
`crocodiles`, `scorpions`) ; les autres langues utilisent le singulier de la
requête principale. À confirmer à l'implémentation avec le contrat URL.

### EN — `/en/symbols/cemeteries`

- Title : `Dreaming About Cemeteries: Meaning and Context`
- H1 : `What It Means to Dream About a Cemetery`
- Meta description : `Dreaming about a cemetery? Compare graves, night, walking through, visiting someone and your emotion using context, not predictions.`
- Scénarios : wandering among graves at night; searching for a specific grave;
  a crowded cemetery or funeral gathering; an abandoned or peaceful cemetery
  during the day.
- FAQ : what does dreaming about a cemetery mean? What about walking through
  graves at night? What if I was visiting someone's grave? Does a cemetery
  dream predict death or bad news? (réponse cadrée : non, aucune prédiction).
- Liens/ancres internes : `death` (« dreams about death »),
  `deceased-person` (« dreaming of a deceased person »),
  `funeral` (« funeral dreams »), hub lieux (`places`).
- Données : US volume `10`, KD `0`, TP `60` (11 août, indicatif).

### FR — `/fr/symboles/cimetiere`

- Title : `Rêver de cimetière : sens et scénarios`
- H1 : `Rêver de cimetière : ce que ce lieu peut raconter`
- Meta description : `Rêver de cimetière : comparez tombes, nuit, promenade, visite d'une tombe et émotion ressentie, à partir du contexte, sans prédiction.`
- Scénarios : se promener entre les tombes la nuit ; chercher une tombe
  précise ; un cimetière bondé ou une cérémonie ; un cimetière abandonné ou
  apaisé en plein jour.
- FAQ : que signifie rêver de cimetière ? Et rêver de marcher entre les
  tombes la nuit ? Et si je visitais la tombe de quelqu'un ? Rêver de
  cimetière annonce-t-il un décès ou une mauvaise nouvelle ? (cadrage : non).
- Liens/ancres internes : `mort` (« rêver de mort »),
  `defunt` (« rêver d'un défunt »), `enterrement` (« rêver d'enterrement »),
  hub lieux.
- Données : FR volume `60`, KD `0`, TP `300` (11 août, indicatif).

### ES — `/es/simbolos/cementerio`

- Title : `Soñar con cementerio: significado y escenas`
- H1 : `Soñar con un cementerio: qué puede contar este lugar`
- Meta description : `Soñar con cementerio: compara tumbas, noche, pasear entre lápidas, visitar una tumba y tu emoción según el contexto, sin predicciones.`
- Scénarios : caminar entre tumbas de noche; buscar una tumba concreta; un
  cementerio lleno de gente o una ceremonia; un cementerio abandonado o en calma
  durante el día.
- FAQ : ¿qué significa soñar con cementerio? ¿Y caminar entre tumbas de
  noche? ¿Y visitar la tumba de alguien? ¿Soñar con cementerio anuncia una
  muerte o una mala noticia? (encuadre: no).
- Liens/ancres internes : `muerte` (« soñar con muerte »),
  `persona-fallecida` (« soñar con una persona fallecida »),
  `funeral` (« soñar con un funeral »), hub de lugares.
- Données : ES volume `250`, KD `0`, TP `150` (13 août).

### DE — `/de/traumsymbole/friedhof`

- Title : `Traumdeutung Friedhof: Bedeutung`
- H1 : `Friedhof im Traum: Was dieser Ort erzählen kann`
- Meta description : `Traumdeutung Friedhof: Gräber, Nacht, Spaziergang, Grabesuche und Gefühl im Kontext vergleichen – ohne Vorhersage.`
- Scénarios : nachts zwischen Gräbern gehen; ein bestimmtes Grab suchen; ein
  voller Friedhof oder eine Trauerfeier; ein verlassener oder friedlicher
  Friedhof am Tag.
- FAQ : Was bedeutet es, von einem Friedhof zu träumen? Was bedeutet ein
  nächtlicher Gang über den Friedhof? Was, wenn ich ein Grab besucht habe?
  Kündigt ein Friedhofstraum einen Tod an? (Einordnung: nein).
- Liens/ancres internes : `tod` (« Traumdeutung Tod »),
  `verstorbene-person` (« verstorbene Person im Traum »),
  `beerdigung` (« Traumdeutung Beerdigung »), Hub Orte.
- Données : DE volume `150`, KD `0`, TP `60` (13 août).

### IT — `/it/simboli/cimitero`

- Title : `Sognare cimitero: significato e scene`
- H1 : `Sognare un cimitero: cosa può raccontare questo luogo`
- Meta description : `Sognare cimitero: confronta tombe, notte, passeggiata, ricerca di una tomba ed emozione partendo dal contesto, senza previsioni.`
- Scénarios : passeggiare tra le tombe di notte; cercare una tomba precisa; un
  cimitero affollato o una cerimonia; un cimitero abbandonato o sereno di
  giorno.
- FAQ : cosa significa sognare un cimitero? E camminare tra le tombe di
  notte? E visitare la tomba di qualcuno? Sognare un cimitero annuncia una
  morte o una cattiva notizia? (inquadratura: no).
- Liens/ancres internes : `morte` (« sognare la morte »),
  `persona-defunta` (« sognare una persona defunta »),
  `funerale` (« sognare un funerale »), hub dei luoghi.
- Données : IT volume `600`, KD `0`, TP `600` (13 août) — marché pilote.
- Exclusion renforcée : ne pas centrer la page sur les numéros de la Smorfia
  ni sur la loterie ; le folklore reste une limite mentionnée, pas l'angle.

## Illustration

Un seul actif éditorial 1 600 × 900 sous
`docs-src/static/img/symbols/editorial-2026-08-j31/` (nom proposé :
`cemetery-v1.webp`), décliné en variantes 240/480/800/1 200 sous
`docs-src/static/img/seo/symbols-v2/`. Sujet : allée de cimetière au crépuscule
ou tôt le matin, tombes sobres, aucun humain identifiable, aucune croix
ostentatoire au premier plan, aucun texte, logo, filigrane ni code divinatoire.
L'image illustre le lieu et l'ambiance, pas une scène de deuil littérale.

## Critères GO / HOLD

Conditions de GO à la porte du 15 août (toutes requises) :

1. la lecture J+7 de `casa`, `ragno` et `perro` ne révèle aucun incident ;
2. `scuola` reste dans son expérience séparée et n'est pas fusionnée au lot ;
3. le contrat URL est étendu depuis un HEAD propre après le commit contenu,
   avec les cinq routes ci-dessus validées ;
4. `docs:build` et `docs:check` passent, avec parité des cinq langues, cinq
   auto-canoniques, six alternates hreflang avec `x-default` et
   `index, follow` ;
5. un seul concept par déploiement : `wasp` n'est préparé qu'après la preuve
   publique HTTP de `cemetery`.

Conditions de HOLD :

- tout incident au checkpoint J+7, ou toute découverte d'un propriétaire
  existant non vu à J29 ;
- toute ambiguïté de cannibalisation non résolue avec `death`,
  `deceased-person` ou `funeral` (par exemple si GSC montre après publication
  que ces fiches absorbent les requêtes cimetière) ;
- incapacité à produire l'actif éditorial conforme aux exclusions.

Après publication, mesure uniquement sur fenêtres GSC complètes, sans demande
d'indexation ; requalifier si les valeurs FR/US (11 août) divergeaient
fortement d'une revalidation ultérieure.

## Frontières du lot J29–J31

- Aucun crawl manuel, aucune demande d'indexation, aucun achat, add-on ou
  changement d'abonnement, aucun message externe.
- Aucune modification de `scuola`, `casa`, `ragno`, `perro` ni des 50 suivis.
- Le lot s'est limité à collecte, documentation et brief ; aucune page, route
  ou image n'a été créée ; rien n'a été publié ni poussé vers `master`.
- Coût Ahrefs du lot : `0` crédit (deux appels SERP refusés côté serveur,
  couche API à `0` unité) ; le plafond autorisé de 4 crédits n'a pas été
  entamé.
