# Ahrefs Starter multi-projets — exploiter l'abonnement sans perturber Noctalia

Date de référence : 2 août 2026

Objet : utiliser le mois Ahrefs Starter sur les autres sites possédés, sans consommer les ressources nécessaires au plan SEO Noctalia ni modifier ses expériences.

Ce document est un plan d'utilisation. Il n'autorise pas la création d'un projet Ahrefs, la connexion GSC, un crawl, l'installation d'un script, une modification Cloudflare, une dépense de crédits, un achat ou une modification SEO.

## Résumé

La meilleure façon d'utiliser Starter sur plusieurs projets n'est pas de partager Rank Tracker. Noctalia utilise déjà les 50 couples disponibles. Le levier multi-projets le plus intéressant est Site Audit : Ahrefs autorise un nombre illimité de projets vérifiés et attribue actuellement 5 000 crédits de crawl par mois à chaque projet vérifié.

La stratégie recommandée est donc :

1. sanctuariser les ressources de Noctalia ;
2. sélectionner les autres sites réellement détenus et vérifiables ;
3. vérifier chaque projet via GSC, DNS, fichier HTML ou meta tag ;
4. lancer un crawl initial plafonné par projet ;
5. produire un backlog technique avec les données du crawl et de GSC ;
6. utiliser seulement un petit nombre de crédits partagés pour Site Explorer et les concurrents ;
7. conserver Rank Tracker, les listes Keywords Explorer et le Report Builder à Noctalia.

## Limites Starter utiles au mode multi-projets

| Ressource | Limite publiée | Portée réelle |
|---|---:|---|
| Projets vérifiés | illimités | Chaque site doit prouver sa propriété |
| Site Audit, projet vérifié | 5 000 pages HTML internes 200 par mois et par projet | Quota indépendant pour chaque projet vérifié |
| Crédits supplémentaires vérifiés | 500 par mois | Pool partagé utilisable sur les URL de tous les projets vérifiés |
| Crédits généraux | 200 par mois | Pool partagé par tout le workspace |
| Projets non vérifiés | 1 | À réserver au seul cas où la vérification est impossible |
| Rank Tracker | 50 couples requête × emplacement | Limite globale déjà occupée par Noctalia |
| Historique Site/Keywords Explorer | 1 mois | Capturer les données avant la fin du cycle |
| Lignes par rapport | 250 | Nécessite une forte priorisation |
| Top Pages | 25 lignes | Suffisant pour une baseline, pas pour un inventaire exhaustif |
| Exports Site/Keywords Explorer | aucun | Conservation manuelle nécessaire |
| Listes Keywords Explorer | 5 listes de 100 | Ressource globale déjà prévue pour Noctalia |
| SEO Toolbar | jusqu'à 800 SERP enrichies | Limite susceptible de diminuer selon l'usage des autres outils |
| Report Builder | 1 rapport de 5 widgets | Ressource globale réservée à la clôture Noctalia |
| Web Analytics | jusqu'à 1 million de pages vues par mois et par site | Disponible gratuitement, mais installation soumise à autorisation |
| Bot Analytics | gratuit pendant la bêta | Nécessite une intégration Cloudflare |
| API v3, MCP et Ahrefs Connect | 0 unité | Ne pas construire de workflow multi-projets autour de l'API |

`Account Settings → Limits & Usage` reste l'autorité si les valeurs affichées diffèrent de la documentation.

## Ressources à sanctuariser pour Noctalia

### Interdiction de partage

| Ressource | Réservation Noctalia | Règle pour les autres projets |
|---|---|---|
| Rank Tracker | 50/50 | Aucun ajout, remplacement, retrait ou changement d'emplacement |
| Listes Keywords Explorer | cinq listes prévues | Ne pas créer de liste multi-projets avant la décision Noctalia |
| Report Builder | un rapport final | Ne pas créer ou modifier le rapport pour un autre site |
| Projet `9361004` | configuration et historique intacts | Ne pas changer scope, intégration, concurrents ou paramètres |
| Site Audit Noctalia | quota propre au projet | Ne pas lancer de crawl Noctalia depuis ce plan multi-projets |
| Pages gelées | mesures en cours | Aucune modification, lien ou outreach depuis un autre projet |

### Pools partagés

Les pools suivants ne sont pas attachés à un seul site :

- 200 crédits généraux ;
- 500 crédits supplémentaires pour les URL des projets vérifiés ;
- quota de SERP enrichies de la Toolbar ;
- limite d'un projet non vérifié.

Dernier compteur Noctalia connu : `53/200` crédits généraux le 30 juillet. Il doit être revalidé avant d'attribuer le moindre crédit aux autres projets.

Réserves minimales recommandées :

- crédits généraux : conserver 105 crédits pour les lots et incidents Noctalia ;
- pool vérifié : conserver 170 crédits pour les huit URL et la clôture Noctalia ;
- Toolbar : conserver 40 SERP pour Noctalia ;
- projet non vérifié : conserver la place libre tant qu'aucun besoin prioritaire n'est approuvé.

Si le compteur général est toujours `53/200`, le plafond prudent pour tous les autres projets réunis est de 30 crédits généraux. Cette enveloppe laisse une marge supplémentaire au-delà de la réserve Noctalia.

## Le meilleur usage : Site Audit par projet vérifié

Chaque projet vérifié obtient son propre quota mensuel de 5 000 pages HTML internes répondant en 200. Ajouter trois projets vérifiés peut donc rendre disponibles jusqu'à 15 000 crédits de crawl indépendants, sans réduire le quota Site Audit de Noctalia.

Les redirections, erreurs 4xx/5xx, ressources et URL externes peuvent être explorées sans consommer ces crédits de crawl ; seuls les documents HTML internes en 200 sont comptés.

### Conditions d'éligibilité d'un projet

Le site doit :

- appartenir à l'utilisateur ou à une organisation qui autorise l'audit ;
- être vérifiable par GSC, DNS, fichier HTML ou meta tag ;
- avoir un domaine public stable ;
- disposer d'une personne capable d'exploiter le backlog ;
- ne pas être au milieu d'une migration non documentée ;
- ne pas présenter un risque de charge serveur incompatible avec le crawl.

### Scoring de sélection sur 100

| Critère | Points |
|---|---:|
| Valeur commerciale du trafic organique | 25 |
| Propriété et vérification immédiatement disponibles | 15 |
| Demande organique ou pages déjà visibles | 15 |
| Capacité d'implémentation dans les huit semaines | 15 |
| Taille compatible avec un crawl de 5 000 pages | 10 |
| Migration, chute de trafic ou anomalie récente | 10 |
| Données GSC disponibles | 10 |

Interprétation :

- `75–100` : vague 1 ;
- `60–74` : vague 2 ;
- `40–59` : audit léger seulement ;
- `<40` : ne pas consommer Ahrefs pendant ce mois.

### Tableau de sélection à remplir

| Projet | Domaine | Propriétaire confirmé | GSC/DNS disponible | Pages estimées | Score | Vague |
|---|---|---|---|---:|---:|---|
| Projet A |  |  |  |  |  |  |
| Projet B |  |  |  |  |  |  |
| Projet C |  |  |  |  |  |  |
| Projet D |  |  |  |  |  |  |
| Projet E |  |  |  |  |  |  |

## Procédure complète pour chaque autre projet

### Étape 1 — Préflight hors Ahrefs

Avant de créer le projet :

- identifier le domaine canonique, protocole et variante `www` ;
- relever le sitemap, robots.txt et nombre estimé d'URL ;
- vérifier la présence de GSC ;
- relever les changements des 30 derniers jours ;
- identifier trois pages commerciales ou stratégiques ;
- identifier deux concurrents organiques probables ;
- définir le résultat attendu de l'audit ;
- créer un dossier privé propre au projet.

Critère d'arrêt : ne pas créer le projet si aucune action ne pourra être prise après l'audit.

### Étape 2 — Vérification de propriété

Méthodes possibles :

1. connexion Search Console ;
2. enregistrement DNS TXT ;
3. fichier HTML à la racine ;
4. meta tag de vérification.

Privilégier GSC lorsqu'elle est déjà configurée. Toute connexion ou modification DNS/HTML constitue une action externe et exige l'autorisation du propriétaire du site.

Ne pas utiliser le seul emplacement de projet non vérifié pour un site possédé : la vérification donne accès au quota Site Audit par projet et au pool de rapports pour URL vérifiées.

### Étape 3 — Configuration du crawl

| Taille estimée du site | Maximum conseillé au premier crawl |
|---|---:|
| moins de 500 pages | 500 |
| 500 à 1 500 pages | 1 500 |
| 1 500 à 5 000 pages | nombre estimé + marge de 10 % |
| plus de 5 000 pages | 5 000, en ciblant sitemaps et répertoires prioritaires |

Conserver les mêmes paramètres pour les comparaisons futures :

- user-agent ;
- source de découverte ;
- rendu JavaScript ou HTML ;
- règles d'inclusion/exclusion ;
- vitesse de crawl ;
- respect de robots.txt ;
- nombre maximal de pages.

Ne jamais lancer plusieurs crawls simultanément sur le même petit serveur.

### Étape 4 — Baseline technique

Pour chaque projet, conserver :

- date et heure du crawl ;
- Health Score ;
- total d'URL et pages internes HTML 200 ;
- erreurs, warnings et notices ;
- pages indexables et non indexables ;
- codes HTTP ;
- canonicals ;
- hreflang si le site est multilingue ;
- profondeur de clic ;
- pages orphelines ;
- sitemap contre pages crawlées ;
- titles, descriptions et H1 ;
- liens internes cassés ;
- chaînes et boucles de redirection ;
- pages lentes et problèmes de ressources ;
- données structurées signalées par le crawl.

Priorité d'analyse :

1. crawlabilité et indexation ;
2. canonicalisation et redirections ;
3. erreurs serveur et liens cassés ;
4. architecture et profondeur ;
5. on-page ;
6. performance ;
7. notices à faible impact.

Ne pas transformer automatiquement chaque warning Ahrefs en ticket. Chaque problème doit être relié à une URL stratégique et à une conséquence réelle.

### Étape 5 — Rapprochement avec GSC

Exporter deux fenêtres complètes de 28 jours :

- clics ;
- impressions ;
- CTR ;
- position ;
- pages ;
- requêtes visibles ;
- appareils ;
- pays.

Utiliser les agrégats de page comme autorité. Les requêtes visibles peuvent être anonymisées ou incomplètes.

Croiser les données pour distinguer :

- page non indexable ;
- page indexable sans impression ;
- page visible sans clic ;
- page classée en positions 4–20 ;
- anomalie technique sans effet mesurable ;
- trafic estimé Ahrefs non confirmé par GSC.

### Étape 6 — Contrôles gratuits avec la SEO Toolbar

Sans activer les métriques payantes, contrôler cinq pages représentatives par site :

- page d'accueil ;
- page produit ou service principale ;
- page éditoriale la plus visible ;
- page récemment modifiée ;
- page présentant une issue Site Audit.

Relever :

- title, description et H1–H7 ;
- canonical, robots et hreflang ;
- redirections et en-têtes HTTP ;
- liens sortants et liens cassés ;
- données structurées rendues ;
- Web Vitals de laboratoire.

La Toolbar permet une preuve rendue utile pour JSON-LD. Un simple téléchargement HTML ou `curl` ne suffit pas toujours lorsque le schema est injecté en JavaScript.

### Étape 7 — Pack Site Explorer minimal

Après la baseline gratuite, utiliser le pool vérifié seulement sur les projets scorés à 60 ou plus.

Pack recommandé par projet :

| Rapport | Question |
|---|---|
| Overview | Quelle est l'empreinte organique et d'autorité actuelle ? |
| Organic Keywords | Quelles requêtes existantes méritent une action ? |
| Top Pages | Quelles pages concentrent la visibilité estimée ? |
| Backlinks ou Referring Domains | Quels liens réellement pertinents existent ? |
| Broken Backlinks | Quelle équité peut être récupérée ? |

Plafond initial : cinq ouvertures et, au maximum, cinq opérations de filtre ou d'historique supplémentaires, soit dix crédits vérifiés par projet.

Règles d'économie :

- préparer tous les filtres avant l'ouverture ;
- traiter un projet dans une session unique ;
- trier et paginer avant de changer de filtre ;
- ne pas inspecter individuellement toutes les URL ;
- ne pas rouvrir le même rapport après la session ;
- conserver immédiatement la synthèse manuelle.

### Étape 8 — Analyse concurrentielle minimale

Utiliser au maximum un concurrent par projet lors de la première passe.

Plafond général par projet : quatre crédits maximum pour :

- Overview ;
- Organic Keywords ;
- Top Pages ;
- Backlinks ou Referring Domains.

Ne pas créer de projet non vérifié pour chaque concurrent. Site Explorer suffit. Ne pas lancer Content Gap ou Link Intersect sans vérifier qu'ils sont accessibles sous Starter et sans budget explicite.

### Étape 9 — Recherche de mots-clés sans monopoliser les listes

Les cinq listes Ahrefs restent réservées à Noctalia. Pour les autres projets :

- préparer et dédupliquer les seeds hors Ahrefs ;
- regrouper jusqu'à 10 000 seeds dans une recherche Keywords Explorer lorsque nécessaire ;
- limiter la recherche aux deux projets les mieux scorés ;
- conserver manuellement les 25 à 50 meilleures opportunités ;
- ne pas créer de liste Ahrefs ;
- ne pas ajouter les mots-clés à Rank Tracker.

Plafond global conseillé : six crédits généraux, filtres compris.

Champs à conserver : volume local, KD, Traffic Potential, intention, Parent Topic, SERP features, URL existante et effort estimé.

### Étape 10 — Backlog par projet

Produire un backlog de huit semaines maximum, séparé en :

- blocages d'indexation ;
- problèmes techniques à fort impact ;
- redirections et liens cassés ;
- maillage interne ;
- titles et descriptions ;
- contenu à enrichir ;
- contenu nouveau réellement justifié ;
- récupération de backlinks ;
- mesures et contrôles post-publication.

Chaque ligne doit contenir : URL, vraie source éditable, preuve, impact, effort, risque, responsable, autorisation requise et critère d'acceptation.

## Budget global pour les autres projets

Ce budget ne s'applique qu'après capture des compteurs live et confirmation des réserves Noctalia.

### Crédits généraux partagés

| Usage autres projets | Plafond global |
|---|---:|
| Chargement Dashboard lors de l'ajout des projets | 5 |
| Deux analyses concurrentielles minimales | 8 |
| Deux lots Keywords Explorer | 6 |
| SERP ou historique indispensable | 6 |
| Incident ou preuve finale | 5 |
| **Total maximum** | **30** |

Ne pas dépasser 30 crédits généraux pour l'ensemble des autres projets pendant le mois.

### Pool des projets vérifiés

| Usage | Plafond |
|---|---:|
| Vague 1 : deux projets × 10 crédits | 20 |
| Vague 2 : trois projets × 10 crédits | 30 |
| Compléments sur les deux meilleurs projets | 20 |
| **Total initial** | **70** |

Le pool vérifié est partagé entre tous les projets vérifiés. Les 5 000 crédits Site Audit, eux, sont propres à chaque projet.

### Site Audit

- jusqu'à cinq projets vérifiés ;
- un premier crawl par projet ;
- maximum 5 000 pages HTML internes 200 par projet ;
- aucun recrawl automatique pendant ce mois ;
- second crawl uniquement après correction autorisée et si le quota le permet.

### Toolbar

- cinq pages on-page gratuites par projet ;
- métriques SERP payantes pour les deux projets les mieux scorés seulement ;
- dix SERP par projet maximum ;
- conserver au moins 40 SERP pour Noctalia.

## Calendrier multi-projets proposé

| Date | Action | Ressource partagée maximale |
|---|---|---:|
| 02/08 | Inventorier les sites, vérifier propriété/GSC et calculer les scores | 0 |
| 03/08 | Faire approuver les projets de vague 1 et leur méthode de vérification | 0 |
| 04/08 | Ajouter/vérifier le projet A et lancer son crawl plafonné | 1 crédit Dashboard possible, quota crawl A |
| 05/08 | Ajouter/vérifier le projet B et lancer son crawl plafonné | 1 crédit Dashboard possible, quota crawl B |
| 06/08 | Analyser les crawls A/B et exporter GSC | 0 général |
| 07/08 | Pack Site Explorer A/B | 20 vérifiés |
| 08/08 | Prioriser les backlogs A/B ; aucune action sur Noctalia depuis ce lot | 0 |
| 09/08 | Ajouter jusqu'à trois projets de vague 2 et lancer les crawls | quotas propres C/D/E |
| 10/08 | Audit léger C/D/E et Toolbar gratuite | 0 général |
| 11/08 | Compléments Site Explorer et concurrents des projets les mieux scorés | 50 vérifiés, 20 généraux max |
| 12–14/08 | Consolider les backlogs sans nouvelle dépendance Ahrefs | 0 |

La limite opérationnelle recommandée est de cinq autres projets pendant ce mois. Au-delà, la profondeur d'analyse et la capacité d'implémentation diminueraient fortement.

## Fonctions qui ne doivent pas être partagées

### Rank Tracker

Les 50 couples sont utilisés par Noctalia. Ne pas supprimer un suivi Noctalia pour suivre un autre projet : la suppression ferait perdre l'historique et modifierait le protocole expérimental.

Pour les autres projets, utiliser temporairement :

- GSC pour les positions moyennes et impressions ;
- Site Explorer pour la découverte de mots-clés ;
- un registre manuel des requêtes prioritaires ;
- Rank Tracker seulement après retour à Free ou décision de réallocation séparée.

### Keyword Lists

Ne pas consommer une des cinq listes prévues pour Noctalia. Conserver les opportunités des autres projets dans des documents ou classeurs propres à chaque projet.

### Report Builder

Le rapport unique est réservé à la clôture Noctalia. Produire pour les autres projets un bilan Markdown ou un PDF local à partir des données conservées.

### Projet non vérifié

Ne pas occuper l'unique place avec un concurrent ordinaire. Elle ne doit être utilisée que pour un site impossible à vérifier, très prioritaire et explicitement approuvé.

## Web Analytics et Bot Analytics

### Web Analytics

Pour un autre projet où le script existe déjà : lecture agrégée autorisable sans modification.

Pour un site sans script : l'installation modifie le code ou le gestionnaire de tags et nécessite une autorisation de mise en production. Ne pas l'inclure implicitement dans l'audit.

### Bot Analytics

Bot Analytics peut séparer robots de recherche, outils SEO et crawlers IA. Sa configuration exige toutefois Cloudflare Logpush ou un Worker avec token.

Préparation autorisée :

- confirmer que le domaine utilise Cloudflare ;
- choisir Worker ou Logpush ;
- documenter permissions, coût et risque de performance ;
- préparer la procédure de retour arrière.

Exécution interdite sans autorisation Cloudflare distincte.

## Actions interdites

- retirer ou modifier un mot-clé Rank Tracker Noctalia ;
- utiliser les cinq listes Keywords Explorer pour les autres projets ;
- remplacer le rapport Noctalia dans Report Builder ;
- dépenser dans le pool partagé sans relever les compteurs avant/après ;
- dépasser 30 crédits généraux cumulés pour les autres projets ;
- lancer des crawls sur des sites non possédés ;
- ajouter un projet sans accord du propriétaire ;
- connecter GSC, modifier DNS ou ajouter une balise sans autorisation ;
- installer Web Analytics ou Bot Analytics sans autorisation de publication/infrastructure ;
- modifier les pages à partir des findings sans validation de leur backlog ;
- commit, push, déploiement, indexation ou outreach implicite ;
- acheter un add-on, des crédits ou des suivis supplémentaires ;
- utiliser un paywall comme justification de montée vers Lite ;
- consommer les quotas simplement pour les vider.

## Livrable standard pour chaque autre projet

```text
Projet et domaine :
Méthode de vérification :
Date du crawl :
Quota configuré / consommé :
Pages internes HTML 200 :
Health Score :
Erreurs / warnings / notices :
Blocages d'indexation :
Canonicals / hreflang / sitemap :
Liens cassés / redirections :
Top pages GSC :
Requêtes positions 4–20 :
Opportunités CTR :
Backlinks récupérables :
Concurrent analysé :
Top 5 actions :
Backlog 8 semaines :
Autorisations nécessaires :
Crédits avant / après :
```

## Critères de réussite du mois multi-projets

- Noctalia reste à 50/50 et ses ressources réservées sont intactes ;
- aucun changement de page Noctalia vient du lot multi-projets ;
- deux à cinq autres domaines possédés disposent d'une baseline Site Audit ;
- chaque projet audité a un backlog exploitable, pas seulement un Health Score ;
- chaque crédit partagé est rattaché à une question et à un livrable ;
- aucun projet non vérifié n'est créé inutilement ;
- aucun script, Worker ou changement DNS n'est appliqué sans autorisation ;
- les données importantes sont conservées avant la fin de Starter ;
- les autres projets peuvent poursuivre huit semaines de travail sans abonnement payant.

## Sources officielles Ahrefs

Consultées le 2 août 2026 :

- [Limites du plan Starter](https://help.ahrefs.com/en/articles/9419051-about-ahrefs-starter-plan)
- [Actions qui consomment des crédits](https://help.ahrefs.com/en/articles/6061658-what-actions-consume-credits)
- [Avantages et vérification des projets](https://help.ahrefs.com/en/articles/4321336-what-is-a-verified-project)
- [Consommation Site Audit](https://help.ahrefs.com/en/articles/3119402-how-are-crawl-credits-in-site-audit-spent)
- [Calcul des mots-clés Rank Tracker](https://help.ahrefs.com/en/articles/1446270-how-are-tracked-keywords-calculated)
- [SEO Toolbar](https://help.ahrefs.com/en/articles/79085-ahrefs-seo-toolbar-installation-and-usage)
- [Web Analytics](https://help.ahrefs.com/en/articles/10247870-about-ahrefs-web-analytics)
- [Bot Analytics](https://help.ahrefs.com/en/articles/14297049-about-bot-analytics)
- [Comparaison des abonnements et limites API](https://help.ahrefs.com/en/articles/6117209-what-s-the-difference-between-all-ahrefs-subscription-plans)

## Point d'arrêt

La prochaine action n'est pas un crawl. Il faut d'abord fournir la liste des autres domaines, confirmer leur propriété et leur méthode de vérification, puis faire valider la vague 1.
