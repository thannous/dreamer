# Noctalia — exécution Ahrefs Starter J26

Date : 10 août 2026

Dernier relevé live : 16:47 CEST

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

Mode : lecture Ahrefs/GSC autorisée, lecture HTTP publique et documentation locale. Aucun achat, boost, changement d'abonnement, changement Rank Tracker, demande d'indexation, crawl manuel, publication, commit ou push.

## Verdict exécutif

Les quatre lots J26 ont été exécutés et transformés en preuves durables. Le résultat ne justifie aucune nouvelle page ni aucune modification des expériences gelées.

- Le compteur général visible est resté à `63 → 63` après les Lots A à D. Une collecte concurrentielle additionnelle a ensuite produit sept rapports Organic Keywords exploitables et fait passer le compteur à `70`, soit un crédit par rapport.
- Le crawl planifié, non déclenché manuellement, s'est terminé à 16:12 CEST avec un Health Score de 100 et zéro erreur.
- L'empreinte organique confirme des propriétaires solides en italien, espagnol et allemand. Le rapport US est dominé par des pages espagnoles et ne peut pas servir seul de proxy au contenu anglais.
- Le maillage interne fournit un backlog utile, mais les 40 suggestions automatiques comportent des doublons de fragments, des self-links et une ancienne cible `/Home/Simboli`. Aucune correction en masse n'est sûre.
- Un nouveau backlink éditorial dofollow DR 55 est public et valide. Le profil global reste cependant massivement pollué par du spam ; aucun désaveu n'est justifié sans action manuelle GSC ou autre preuve de dommage.
- Les deux alertes Ahrefs `x-default` sur des pages PT-BR-only sont conformes au contrat du dépôt et ne doivent pas être « corrigées ». Les deux nouvelles warnings actionnables sont les descriptions trop courtes des pages légales PT-BR.

La recommandation provisoire est `LEAN_FREE` après la clôture : collecter les content gaps ciblés à J27, puis revenir à Free sauf si la conservation hebdomadaire des 50 suivis est une exigence métier. La décision de facturation reste à l'utilisateur.

## État Git et frontière de travail

Le relevé a commencé sur le worktree détaché `7e0dc2f5e37c4bdd669386ea151889cc85ad5223`. Pendant l'analyse initiale, `origin/master` avait avancé jusqu'à `cf6884b80d085c5aa4da8653a1039d475d1e9f11`. Au checkpoint final de la collecte concurrentielle, le master distant est `2a560b7bb23b74da6808c6f841126bf4e1713f70`. Les commits de citation gaps et d'outreach restent séparés des concurrents organiques de ce rapport.

Le worktree contenait déjà les livrables J26 locaux non commités. Il n'a donc pas été resynchronisé en cours de collecte : un changement de base aurait mélangé le WIP et les nouveaux commits distants. Les contrôles de sources PT-BR et des décisions GSC ont été faits en lecture seule contre `origin/master`. Toute implémentation ultérieure doit repartir d'un worktree propre synchronisé sur le master courant.

## Compteurs et usage

| Point de contrôle | Crédits généraux visibles | Crawl workspace | Rank Tracker |
|---|---:|---:|---:|
| Préflight initial, avant le crawl planifié | 63 | 1 647/10 000 | 50/50 |
| Après le crawl planifié | 63 | 2 843/10 000 | 50/50 |
| Après Lot A | 63 | 2 843/10 000 | 50/50 |
| Après Lot B | 63 | 2 843/10 000 | 50/50 |
| Après Lot C | 63 | 2 843/10 000 | 50/50 |
| Après Lot D, relevé final | 63 | 2 843/10 000 | 50/50 |
| Après collecte concurrentielle IT | 65 | 3 627/10 000 | 50/50 |
| Après collecte concurrentielle DE | 67 | 3 627/10 000 | 50/50 |
| Après collecte concurrentielle FR | 69 | 3 627/10 000 | 50/50 |
| Après collecte concurrentielle ES | 70 | 3 627/10 000 | 50/50 |

Le crawl planifié a ajouté `1 196` crédits workspace, qui correspondent aux `1 196` pages HTML indiquées par le rapport courant. Il reste `7 157/10 000` crédits de crawl au niveau workspace.

Le reset et la prochaine facturation restent affichés au 16 août 2026 à 00:00 UTC. Avec 70 crédits généraux utilisés sur le plafond Starter documenté de 200, le reliquat général nominal est de 130. Le quota additionnel éventuel du projet vérifié n'est pas exposé dans l'interface et ne doit pas être présenté comme un solde confirmé.

## Site Audit — crawl planifié du 10 août

| Indicateur | 3 août | 10 août | Lecture |
|---|---:|---:|---|
| Health Score | 100 | 100 | stable |
| Erreurs | 0 | 0 | stable |
| Warnings | 44 | 46 | +2 |
| Notices | 1 314 | 214 | forte baisse affichée ; définitions et catégories Ahrefs à conserver telles quelles |
| URL totales crawlées | 1 596 | 1 615 | +19 |
| URL internes | 1 180 | 1 201 | +21 |
| Ressources | 414 | 414 | stable |
| Pages HTML | 1 175 | 1 196 | +21 |
| Réponses 2xx | non conservé | 1 614 | courant |
| Redirections | 3 | 3 | stable |

Les compteurs du 3 août ne sont pas parfaitement additifs dans l'interface (`1 180 + 414` ne reproduit pas `1 596`). Les deltas sont donc comparés métrique par métrique et aucune valeur manquante n'est reconstruite.

Les quatre catégories de warnings techniques restent : 25 titles trop longs, 15 meta descriptions trop courtes, 3 meta descriptions trop longues et 3 redirections 3XX. L'augmentation `44 → 46` vient entièrement des deux nouvelles descriptions courtes :

| URL | Longueur Ahrefs | Décision |
|---|---:|---|
| `/pt-br/politica-de-privacidade` | 94 | revoir localement la description sans altérer la portée juridique |
| `/pt-br/termos-de-uso` | 92 | revoir localement la description sans altérer la portée juridique |

Deux notices `X-default hreflang annotation missing` concernent `/pt-br/funcionalidades` et `/pt-br/perguntas-frequentes`. Elles sont attendues : `origin/master:docs-src/README.md` impose `x-default` vers l'anglais seulement lorsqu'une version anglaise existe, et `origin/master:scripts/docs-partial-coverage.test.js` teste explicitement l'absence de `x-default` pour une page PT-BR-only. Verdict : `ACCEPT_TOOL_NOTICE`, aucune modification.

## GSC frais et indexation

Le probe GSC de 15:40 CEST a renvoyé le 8 août comme dernier jour complet ; les 9 et 10 août n'étaient pas finalisés.

| Fenêtre | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 12 juillet–8 août | 4 270 | 486 318 | 0,878 % | 7,32 |
| 14 juin–11 juillet | 2 436 | 311 126 | 0,783 % | 8,43 |

Cette actualisation remplace la fenêtre arrêtée au 7 août pour les totaux site. Elle ne rend toujours pas mesurable la vague metadata du 8 août : un seul jour post-publication est présent et aucune attribution n'est possible.

Le rapport Indexation, mis à jour le 7 août, reste à 990 URL indexées et 275 non indexées, dont 254 `Explorée, actuellement non indexée` avec validation en échec. Les dix exemples visibles sont :

1. `/en/symbols/nudity` ;
2. `/es/simbolos/luna` ;
3. `/es/simbolos/lugares` ;
4. `/de/blog/traeume-verfolgt-werden-bedeutung-und-interpretation` ;
5. `/fr/blog/guide-cauchemars` ;
6. `/de/blog/zeitumstellung-schlaf-traeume` ;
7. `/es/simbolos/llorar` ;
8. `/es/blog/suenos-dientes-caen` ;
9. `/es/blog/significado-de-suenos` ;
10. `/es/simbolos/escuela`.

`/es/simbolos/escuela` est une page espagnole et ne doit pas être confondue avec l'expérience italienne `scuola`, qui reste non publiée.

## Lot A — Organic Keywords et Top Pages

| Marché Ahrefs | Mots-clés | Preuve dominante | Décision |
|---|---:|---|---|
| IT | 402 | `/it/simboli/fuoco` : trafic estimé 265 ; `/it/simboli/cane` : 243 ; guide eau : 70 ; fiche eau : 42 | protéger les gagnants ; maintenir le HOLD eau |
| DE | 96 | lexique A–Z : trafic 104 et 62,7 % du marché DE ; `/de/traumsymbole/fallen` : 20 | protéger le lexique ; ne pas redistribuer `Traumdeutung` sans cartographie |
| FR | 53 | cluster rêves d'eau/inondation en positions 5–9 ; Top Pages est resté vide après deux chargements | conserver la preuve Keywords ; recharger Top Pages seulement si une décision J27 le requiert |
| ES | 108 | `/es/blog/suenos-de-agua` : trafic 348 et 79,6 % ; `/es/simbolos/puerta` : 32 | protéger le blog eau ; aucune nouvelle page inondation |
| US | 71 | trafic dominé par `/es/blog/suenos-de-agua` et `/es/simbolos/lobo` ; seulement quatre lignes anglaises utiles visibles | ne pas confondre marché US et performance EN |
| GB | 0 | aucun mot-clé retourné | absence de signal Ahrefs, pas preuve d'absence GSC |

Les lignes anglaises visibles aux États-Unis restent faibles : grossesse position 21, guide lucid dream position 20, lieux de rêve position 9 et rêves récurrents position 24. `/en/dream-journal-apps` reste gelée car ses modifications du 8 au 10 août sont postérieures à la fenêtre GSC robuste.

Ahrefs confirme le partage italien : le guide eau capte les scénarios larges, tandis que la fiche `/it/simboli/acqua` capte les variantes d'eau sale/trouble. Cela renforce `HOLD_MESURE` : aucune troisième page, aucun cross-canonical et aucune nouvelle édition pendant la mesure.

## Lot B — maillage, ancres et 254 URL GSC

- `1 187` pages figurent dans Most linked pages. Le haut du tableau est dominé par les liens de template et ne mesure pas l'importance éditoriale.
- Les pages les moins liées comprennent les articles `rumore notturno` IT, night noise EN/ES/DE/FR, climat DE/IT et plusieurs contenus méthodologie/vie privée, avec seulement 1 à 5 liens internes.
- `4 015` ancres internes sont recensées. `Empty anchor` concerne 85 pages et 99 liens. Les CTA génériques `Read article`, `Lire l'article`, `Leggi l'articolo`, `Leer artículo` et `Artikel lesen` sont récurrents.
- Le rapport Internal link opportunities contient 40 suggestions, mais répète des fragments d'une même cible, propose des self-links et suggère l'ancienne destination `/Home/Simboli`. Aucune application en masse n'est autorisable.

Rapprochement décisionnel :

| Source / cible | Signal | Décision |
|---|---|---|
| article DE `traeume-verfolgt...` → article rêves récurrents | source visible dans les 254 GSC et recommandation Ahrefs sur `wiederkehrende träume` | `P1_REVIEW` : vérifier indexabilité, unicité et ancre dans un worktree propre |
| `/es/simbolos/inundacion` → `/es/blog/suenos-de-agua#...` | cible organique dominante, position Ahrefs 4 | `P2_REVIEW` : dédupliquer les fragments avant ajout éventuel |
| `/it/guides/` → ancien blog eau | cible position 27 mais troisième URL du cluster eau | `REJECT_CONFOUNDER` pendant le HOLD italien |
| suggestions vers `/Home/Simboli` | destination historique/erronée | `REJECT_INVALID_TARGET` |

Les neuf autres exemples GSC ne sont pas déclarés « sous-liés » sans analyse page par page. Une corrélation entre faible maillage et non-indexation ne prouve pas une cause.

## Lot C — backlinks

Vue d'ensemble : 459 backlinks, 411 domaines référents, 8 domaines dofollow et 403 domaines exclusivement nofollow. La homepage concentre 463 liens provenant de 410 domaines dans Best by links ; seules trois autres destinations apparaissent dans les premières lignes.

### Nouveau lien éditorial confirmé

| Champ | Preuve |
|---|---|
| Domaine | `it.thamhiemmekong.com` |
| DR / trafic domaine Ahrefs | 55 / 13,8 K |
| Source | `/scienza/cosa-significa-sognare-durante-il-sonno.html` |
| Destination | `/it/blog/come-ricordare-i-tuoi-sogni-10-tecniche-efficaci` |
| Ancre | `Noctalia` dans la référence « Dimentichiamo circa il 95%... » |
| Type | dofollow ; `rel="noopener noreferrer"`, sans `nofollow` |
| HTTP public | source 200, canonical auto-référent, aucune meta robots restrictive visible |
| Première vue Ahrefs | 9 août 2026 |

Décision : conserver et surveiller, sans réclamer un autre lien ni attribuer un effet SEO avant preuve GSC/référente.

### Bruit et pertes

- Parmi les huit domaines dofollow, cinq sont marqués `SPAM` par Ahrefs. `peerpush.com` et le nouveau domaine éditorial sont les deux signaux les plus crédibles ; `launchllama.co` est un nouveau domaine nofollow à qualifier séparément.
- L'ancre externe principale est un long texte promotionnel SEOExpress présent sur 224 domaines référents ; une seconde ancre promotionnelle apparaît sur 43 domaines. Ces lignes décrivent un réseau de spam, pas une campagne Noctalia validée.
- Les domaines perdus visibles sont `backlinker.shop` (`SPAM`) et `dreammeaniings.com` (DR 7). Aucun ne mérite une récupération prioritaire.
- Le rapport Broken backlinks est verrouillé par `Boost your project`. Il ne fournit aucune donnée Starter. Ne pas interpréter cette limite comme zéro lien cassé et ne pas ouvrir la tarification.

Aucun désaveu n'est recommandé à ce stade : le volume de spam seul ne prouve pas un impact, et aucune action manuelle GSC n'a été observée.

## Lot D — concurrents organiques retenus

La sélection privilégie la proximité thématique et le nombre de mots-clés communs, pas seulement le pourcentage de chevauchement.

| Marché | Concurrent 1 | Preuve | Concurrent 2 | Preuve | Statut J27 |
|---|---|---|---|---|---|
| IT | `lasmorfianapoletana.com` | 13 060 mots-clés ; 233 communs ; trafic 90,8 K | `guidasogni.it` | 4 057 ; 90 communs ; trafic 12,1 K | `GO_GAP_CIBLE` |
| DE | `traum-deutung.de` | 3 289 ; 73 communs ; trafic 30,3 K | `traumdeuter.ch` | 2 385 ; 55 communs ; trafic 16,9 K | `GO_GAP_CIBLE` |
| ES | `misabueso.com` | 5 209 ; 54 communs ; trafic 6,0 K | `diariofemenino.com` | 39 193 ; 65 communs ; trafic 52,7 K | `ADJUST` : second domaine plus généraliste |
| FR | `tristan-moir.fr` | 4 245 ; 38 communs ; trafic 8,8 K | `signification-reve.com` | 5 506 ; 35 communs ; trafic 5,5 K | `GO_GAP_CIBLE` |
| US | `sleepfoundation.org` | 139 570 ; 5 communs | `verywellmind.com` | 202 050 ; 4 communs | `HOLD_EN_FILTER` |

Les deux domaines US ne sont que des benchmarks provisoires. Le jeu US de Noctalia est dominé par les pages espagnoles ; aucun Content Gap anglophone ne doit être lancé avant d'avoir filtré les URL Noctalia en `/en/` et confirmé des concurrents réellement anglophones.

## Backlog J27

1. Content Gap est verrouillé derrière la tarification sur le plan observé. Le remplacement par sept rapports Organic Keywords ciblés IT/DE/FR/ES est terminé et documenté. Valider maintenant dans GSC le gap chaussures, puis crocodile et les absences italiennes ; aucune création avant confirmation.
2. Pour l'anglais, construire d'abord un cohort `/en/` depuis GSC et Top Pages. Ne pas utiliser le rapport US sitewide comme proxy.
3. Segmenter les 254 URL GSC par type, valeur et nombre de liens internes. Commencer par l'article DE `traeume-verfolgt...` ; ne faire aucune demande d'indexation en masse.
4. Préparer, dans un worktree propre basé sur le master courant, une correction locale distincte des deux meta descriptions PT-BR légales. Ne pas toucher aux notices `x-default` conformes au contrat.
5. Ne plus ouvrir Broken backlinks sans autorisation d'un boost payant. Utiliser plutôt les rapports accessibles New/Lost, Best by links et Link Intersect si une question précise le justifie.
6. Conserver le gel `casa`–`ragno`–`perro`, le HOLD eau italien, le gel EN et l'expérience `scuola` séparée/non publiée.
7. À la fin de J27, relever les compteurs et produire la recommandation finale Free vs Starter avant toute décision de facturation.

## Collecte concurrentielle ciblée additionnelle

La preuve détaillée est conservée dans [`j26-competitive-keyword-gap-2026-08-10.md`](./j26-competitive-keyword-gap-2026-08-10.md), avec le backlog dans [`j26-competitive-gap-backlog-2026-08-10.csv`](./j26-competitive-gap-backlog-2026-08-10.csv).

- sept rapports concurrents utiles, sept crédits généraux, compteur `63 → 70` ;
- signal P1 : chaussures dans quatre marchés, KD 0, absent des trois inventaires locaux, mais absence GSC non confirmée ;
- signaux secondaires : crocodile IT/DE et église IT/DE/ES ;
- absences italiennes à vérifier : cacca/feci, pidocchi, vermi et uova ;
- demande majoritairement couverte par des fiches ou dictionnaires existants, donc priorité à `EXISTING_URL_FIRST` ;
- loto, smorfia, cabale, tarot, astrologie et autres lignes hors produit rejetés.

Verdict : `0 nouvelle page maintenant` reste inchangé.

## Recommandation d'abonnement provisoire

`LEAN_FREE`, à confirmer après J27.

Les preuves uniques de Starter aujourd'hui sont utiles mais ponctuelles : sélection concurrentielle, historique SERP/Rank Tracker, nouveau backlink et crawl comparatif. Les décisions éditoriales importantes — zéro nouvelle page, ownership italien, gel EN, cartographie allemande et mesure des expériences — viennent principalement de GSC, du dépôt et du site public. De plus, Broken backlinks exige un boost séparé et une grande part du profil de liens est du bruit.

Le maintien de Starter devient rationnel seulement si Noctalia a besoin chaque semaine des 50 couples pays × appareil ou si les content gaps J27 produisent de façon répétable plusieurs actions implémentables que GSC ne permet pas d'obtenir. Sinon, clôturer les preuves puis revenir à Free est le choix le plus efficient. Aucune action de facturation n'a été effectuée.
