# Noctalia — réconciliation J25 Ahrefs Starter

Date : 9 août 2026
Projet Ahrefs : `9361004`
Périmètre : état Git, changements SEO intervenus depuis J24 et snapshot Rank Tracker hebdomadaire

## Résumé exécutif

L'archive J1–J24 a été transférée sans fusion historique sur une branche fraîche issue du `master` courant. L'ancienne branche d'archive n'avait aucun commit propre et accusait 136 commits de retard au moment du transfert ; seuls ses douze fichiers non suivis contenaient un travail à conserver.

Le changement le plus important depuis la clôture J24 est le commit `3bac9c1f6` du 8 août. Il a publié le support générique metadata-only et trois variantes sur `casa`, `ragno` et `perro`. Il n'a pas implémenté `scuola`. Le verdict J24 sur `scuola` reste donc une décision préparatoire, pas le début de son expérience.

J25 dispose aussi d'un nouveau snapshot Rank Tracker réellement daté du 9 août. Les cinquante couples restent actifs, non gelés et inchangés dans leur configuration.

## Réconciliation Git et production

- branche source historique : `codex/seo-starter-j1-j17-archive` ;
- état de la branche source au transfert : zéro commit propre, 136 commits derrière `master`, douze synthèses non suivies ;
- base initiale de réconciliation : `master` au commit `4447cf268` ;
- réalignement avant publication : avance rapide sur `origin/master` au commit `92697d742` ;
- branche de consolidation : `codex/seo-starter-j25-archive` ;
- le worktree principal contenait et a continué à recevoir un travail utilisateur important sans rapport avec cette archive ; aucun de ces fichiers n'a été touché ;
- `master` et `origin/master` pointaient sur le même commit au début de la consolidation ; la branche d'archive a ensuite suivi le nouveau `origin/master` sans réécrire son historique.

Il ne faut pas fusionner l'ancienne branche : une fusion ne transporterait pas ses fichiers non suivis et risquerait de donner une impression trompeuse de mise à niveau. La réconciliation porte uniquement les synthèses utiles sur la base actuelle.

## Vague metadata publiée le 8 août

Le commit `3bac9c1f6` introduit deux champs localisés optionnels :

- `documentTitle` ;
- `documentMetaDescription`.

Le générateur les limite au document `<title>` et à la meta description. Le H1, le contenu visible, les FAQ, le JSON-LD, Open Graph, Twitter, les canonical, les hreflang, les images et les dates de fraîcheur restent alimentés par les champs partagés existants. Les release gates contrôlent également les longueurs et empêchent que ces champs seuls modifient les dates éditoriales.

Trois URL ont reçu une variante :

| URL | Changement | Gel |
|---|---|---|
| `/it/simboli/casa` | title et meta description uniquement | jusqu'au 5 septembre 2026 |
| `/it/simboli/ragno` | title et meta description uniquement | jusqu'au 5 septembre 2026 |
| `/es/simbolos/perro` | title et meta description uniquement | jusqu'au 5 septembre 2026 |

Le contrôle HTTP du 9 août a retrouvé les trois variantes en production avec HTTP 200, canonical propre et directive `index, follow`. Le checkpoint J+7 est fixé au 15 août et le checkpoint J+28 au 5 septembre. Aucun signal du 9 août ne peut être attribué à ces métadonnées après une seule journée.

## Statut de `scuola`

`/it/simboli/scuola` ne contient ni `documentTitle` ni `documentMetaDescription` dans le `master` du 9 août. La page live conserve :

- `<title>Sognare Scuola: significato | Noctalia</title>` ;
- la description générée à partir du contenu partagé.

La baseline J24 reste utilisable : 6 clics, 1 900 impressions, CTR 0,316 % et position moyenne 6,01 sur la fenêtre du 10 juillet au 6 août. Le KPI reste le CTR GSC. Rank Tracker ne contient pas de couple direct pour `scuola` et ne peut pas remplacer cette mesure.

La consolidation de l'archive n'implémente pas `scuola`. Son changement devra rester un lot source séparé afin que son commit, sa date de publication et sa fenêtre de mesure ne soient pas confondus avec la vague `casa`–`ragno`–`perro`.

## Snapshot Rank Tracker du 9 août

Les SERP ont été mises à jour entre 06:35 et 08:03 UTC. Les appels Rank Tracker ont déclaré un coût nul.

| Appareil | Couples | Classés | Non classés | Progressions | Reculs | Stables | Gelés |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 50 | 42 | 8 | 14 | 7 | 21 | 0 |
| Desktop | 50 | 42 | 8 | 15 | 8 | 19 | 0 |

Mouvements notables, à lire comme relevés hebdomadaires et non comme effets causaux :

- `sognare bambini piccoli` : 25 → 5 mobile et 26 → 6 desktop ;
- `dream journal app` : nouvelle position 3 mobile et 16 → 5 desktop, sur `/en/dream-journal-apps` ;
- `history of dream analysis` : nouvelle position 21 mobile et 23 desktop ;
- `soñar con hospital` en Espagne : 7 → 1 sur les relevés visibles ;
- `rêver d'inondation signification spirituelle` : 9 → 1 sur mobile et desktop.

Les baselines nulles restent conservées pour `ai dream interpretation app` et `dictionnaire des rêves`. `dream interpretation app` reste non classé dans ce snapshot ; son annotation historique continue de distinguer l'URL antérieurement observée `/en/dream-journal-apps` de la cible souhaitée `/en/ai-dream-interpretation-app`.

## Dérives d'URL à surveiller

Trois écarts nets entre URL classée et tag cible ont été relevés sans modifier la configuration :

| Appareil | Requête | URL classée | URL cible |
|---|---|---|---|
| Mobile | `traumlexikon` | `/` | `/de/guides/traumsymbole-lexikon` |
| Mobile | `50 sueños y su significado` | `/` | `/es/guides/diccionario-simbolos-suenos` |
| Desktop | `sognare acqua sporca` | `/Home/Simboli` | `/it/guides/simboli-sogni-acqua` |

Ces écarts justifient une preuve SERP ou GSC supplémentaire, pas un changement immédiat de cible. Les emplacements et les cinquante couples restent inchangés.

## Compteurs et limites

- dernier compteur général vérifié dans l'interface : 63 crédits utilisés le 8 août ;
- prochain renouvellement et remise à zéro observés : 16 août 2026 UTC ;
- dernier quota Site Audit observé : 1 147/10 000 ;
- dernier crawl visible : 3 août, Health Score 100 ;
- appels Rank Tracker J25 : coût API déclaré nul ;
- connecteur `limits-and-usage` le 9 août : `Trial, billed monthly`, remise à zéro le 16 août et zéro unité API consommée.

Le relevé du connecteur décrit la couche API et ne remplace pas l'autorité de l'interface Starter pour les crédits généraux, le quota du projet vérifié et la facturation. Aucune valeur générale postérieure à 63 n'est inventée.

## Facteurs confondants ajoutés au registre

Depuis l'ancienne base d'archive, `master` a également intégré des changements de pages presse, alternatives, surfaces de citation et un volume important de preuves de prospection et de backlinks. Ces actions peuvent influencer l'autorité ou le trafic du domaine à moyen terme. Elles ne prouvent pas un effet sur une URL précise et ne doivent pas être utilisées pour attribuer les mouvements Rank Tracker du 9 août.

## Décision J25

1. Conserver les cinquante suivis sans changement.
2. Geler `casa`, `ragno` et `perro` jusqu'au 5 septembre ; première lecture seulement le 15 août.
3. Conserver `scuola` comme expérience séparée non commencée.
4. Examiner les trois dérives d'URL avec des preuves SERP/GSC avant toute recommandation.
5. Vérifier manuellement `Limits & Usage` avant toute dépense J25–J27.
6. Ne pas lancer de nouveau crawl ni de requête Ahrefs payante dans ce lot documentaire.
7. Préparer la décision d'abonnement au plus tard à J27, avant le renouvellement du 16 août.

## Critères d'acceptation de la consolidation

- historique J1–J24 conservé sans réécriture rétroactive ;
- état de `master` et de la production séparé des décisions historiques ;
- portefeuille 50/50 et snapshot du 9 août documentés sans lignes brutes ;
- vague metadata distincte de l'expérience `scuola` ;
- crédits généraux non extrapolés depuis la couche API ;
- aucun fichier source SEO, suivi Ahrefs, crawl ou indexation modifié par J25.
