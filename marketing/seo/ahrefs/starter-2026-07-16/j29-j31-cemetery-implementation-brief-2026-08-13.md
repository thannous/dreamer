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

Expression revalidée en direct le 13 août, volontairement élargie aux variantes
et synonymes :
`cemeter(y|ies)|graveyards?|cimeti[eè]res?|cementerios?|friedh(o|ö|oe)f(e)?|cimiter[oi]|camposanto`.

- 28 jours : `0` clic, `0` impression ;
- fenêtre disponible « 12 mois » (5 décembre 2025 → 11 août 2026) : `0` clic,
  `1` impression, position `51` — une longue requête anglaise sur un chien dans
  un cimetière, hors intention ;
- décision d'ownership : absence durable de propriétaire GSC dans les données
  restituées (les totaux filtrés peuvent être incomplets ; cela ne garantit
  pas l'absence de toute requête anonymisée).

La lecture live n'ajoute pas de journée complète : Search Console indique une
mise à jour récente, mais la dernière journée restituée reste le 11 août. Les
deux fenêtres ci-dessus ont donc été confirmées, pas prolongées.

### Preuve Ahrefs (projet `9361004`)

Relevé live `Limits & Usage` dans l'interface avant collecte : plan
`Starter, billed monthly`, prochaine facturation le 16 août 2026 UTC, remise
à zéro le `2026-08-16T00:00:00Z`, compteur général `131/200`, Rank Tracker
`50/50` et Site Audit `3 627/10 000`. La couche API, elle, reste à `0/0` et ne
remplace pas le compteur général de l'interface.

Micro-lot SERP autorisé (plafond 4 crédits généraux) :

Les deux tentatives initiales via l'API ES ont été refusées avec
`API units limit reached. Expected usage: 50, API units left: 0` et n'ont pas
consommé de crédit général. Le complément a ensuite utilisé uniquement
l'interface Starter, une ouverture de rapport par marché :

| # | Marché | Requête | Snapshot SERP | Preuve utile |
| ---: | --- | --- | --- | --- |
| 1 | ES | `soñar con cementerio` | 1 août 2026 | AI Overview et PAA avant les résultats ; positions organiques 3/4/5 à DR 25/40/0 et 0/0/1 domaine référent |
| 2 | DE | `traumdeutung friedhof` | 5 août 2026 | AI Overview et PAA ; page DR 0, 0 domaine référent en position 7, puis une autre DR 0 en position 11 |
| 3 | FR | `rêver de cimetière` | 25 juillet 2026 | PAA en position 1 ; page DR 0, 0 domaine référent en position 6 et page DR 10, 0 domaine référent en position 10 |
| 4 | US/EN | `dreaming about cemetery` | 24 juin 2026 | AI Overview et PAA ; page DR 9, 0 domaine référent en position 5, avec résultats UGC dans la SERP |

Coût exact du complément UI : `4` crédits, compteur `131 → 135/200` ; il reste
`65` crédits généraux. Aucun bouton `Update` n'a été utilisé : les dates de
snapshot ci-dessus sont celles affichées par Ahrefs et ne sont pas présentées
comme des SERP du jour. Aucun achat, add-on ou changement d'abonnement n'a été
effectué.

Métriques Ahrefs consolidées après le complément UI :

| Marché | Requête | KD | Volume pays | TP | Parent Topic observé | Source |
| --- | --- | ---: | ---: | ---: | --- | --- |
| IT | `sognare cimitero` | 0 | 600 | 600 | `sognare cimitero` | micro-lot J29 du 13 août |
| ES | `soñar con cementerio` | 0 | 250 | 150 | `soñar con cementerio` | interface UI relue le 13 août |
| DE | `traumdeutung friedhof` | 0 | 150 | 60 | `traumdeutung friedhof` | interface UI relue le 13 août |
| FR | `rêver de cimetière` | 0 | 60 | 300 | `rever de cimetiere` (volume pays 150) | interface UI relue le 13 août |
| US | `dreaming about cemetery` | 0 | 10 | 60 | `spiritual meaning of graveyard in dreams` (volume pays 30) | interface UI relue le 13 août |

La SERP IT déjà documentée conserve deux pages DR `0` en positions 3 et 8 et
une page DR `25` sans domaine référent en position 4. Les quatre lectures UI
complémentaires montrent le même levier : l'autorité externe n'est pas un
prérequis absolu pour entrer dans ces SERP. Elles affinent aussi les sous-thèmes :
tombes et foule en ES ; `Grab`/`Gräber` en DE ; marche et recherche d'une tombe
en FR ; `graveyard`, visite et marche en EN. Cela ne garantit aucun classement.

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
| EN | `/en/symbols/cemetery` |
| FR | `/fr/symboles/cimetiere` |
| ES | `/es/simbolos/cementerio` |
| DE | `/de/traumsymbole/friedhof` |
| IT | `/it/simboli/cimitero` |

Le contrat EN est confirmé au singulier. Les 24 propriétaires locaux de la
catégorie `places` utilisent un nom de lieu singulier, sauf le pluriel lexical
`stairs`; `scripts/lib/site-manifest.js` construit explicitement la route avec
`symbol[lang].slug` et n'impose pas le pattern
animal de `turtles`, `crocodiles` ou `scorpions`. Les requêtes et résultats
observés emploient aussi majoritairement `cemetery` au singulier. Comme
`/en/symbols/cemeteries` n'a jamais été publié, aucune redirection legacy n'est
à créer.

### EN — `/en/symbols/cemetery`

- Title : `Cemetery Dream Meaning: Graves, Visits and Context`
- H1 : `Dreaming About a Cemetery or Graveyard`
- Meta description : `Dreaming about a cemetery or graveyard? Compare graves, walking, visits, night and your emotion in context, without fixed spiritual predictions.`
- Scénarios : wandering among graves at night; searching for a specific grave;
  a crowded cemetery or funeral gathering; an abandoned or peaceful cemetery
  during the day.
- FAQ : what does dreaming about a cemetery mean? What about walking through
  graves at night? What if I was visiting someone's grave? Does a cemetery
  dream predict death or bad news? (réponse cadrée : non, aucune prédiction).
- Liens/ancres internes : `/en/symbols/death` (« dreams about death »),
  `/en/symbols/deceased-person` (« dreaming of a deceased person »),
  `/en/symbols/funeral` (« funeral dreams »),
  `/en/symbols/places` (« place dream symbols »).
- Données : US volume `10`, KD `0`, TP `60`, avec `graveyard` dans le Parent
  Topic et les variantes ; ne pas reprendre la promesse spirituelle comme fait.

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
- Liens/ancres internes : `/fr/symboles/mort` (« rêver de mort »),
  `/fr/symboles/defunt` (« rêver d'un défunt »),
  `/fr/symboles/enterrement` (« rêver d'enterrement »),
  `/fr/symboles/lieux` (« symboles de lieux en rêve »).
- Données : FR volume `60`, KD `0`, TP `300`; Parent Topic sans accent
  `rever de cimetiere`, volume pays `150`.

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
- Liens/ancres internes : `/es/simbolos/muerte` (« soñar con muerte »),
  `/es/simbolos/persona-fallecida` (« soñar con una persona fallecida »),
  `/es/simbolos/funeral` (« soñar con un funeral »),
  `/es/simbolos/lugares` (« símbolos de lugares en sueños »).
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
- Liens/ancres internes : `/de/traumsymbole/tod` (« Traumdeutung Tod »),
  `/de/traumsymbole/verstorbene-person` (« verstorbene Person im Traum »),
  `/de/traumsymbole/beerdigung` (« Traumdeutung Beerdigung »),
  `/de/traumsymbole/orte` (« Traumsymbole Orte »).
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
- Liens/ancres internes : `/it/simboli/morte` (« sognare la morte »),
  `/it/simboli/persona-defunta` (« sognare una persona defunta »),
  `/it/simboli/funerale` (« sognare un funerale »),
  `/it/simboli/luoghi` (« simboli dei luoghi nei sogni »).
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
d'indexation ; conserver `cemetery` comme propriétaire EN tout en surveillant
les variantes `graveyard`, sans créer une seconde page synonyme.

## Frontières du lot J29–J31

- Aucun crawl manuel, aucune demande d'indexation, aucun achat, add-on ou
  changement d'abonnement, aucun message externe.
- Aucune modification de `scuola`, `casa`, `ragno`, `perro` ni des 50 suivis.
- Le lot s'est limité à collecte, documentation et brief ; aucune page, route
  ou image n'a été créée ; rien n'a été publié ni poussé vers `master`.
- Coût Ahrefs du complément : `4` crédits généraux (`131 → 135/200`), après
  deux appels API refusés et gratuits ; `65` crédits restent. Les 50 suivis et
  le quota Site Audit sont inchangés.
