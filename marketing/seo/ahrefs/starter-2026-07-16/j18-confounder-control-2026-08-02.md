# Noctalia — J18 : contrôle des changements et facteurs confondants

Date : 2 août 2026

Exécution : 18:28 CEST

Projet Ahrefs : `9361004`

Mode : lecture seule, zéro appel Ahrefs, zéro crédit général, zéro export GSC, zéro crawl et aucune modification SEO

## Verdict

J18 est terminé. Aucun changement direct n'a été détecté sur les huit URL du portefeuille, les cinq articles de la vague éditoriale 2 ou l'article allemand sur le bruit nocturne depuis leurs baselines respectives.

Les gels restent valides. Deux événements globaux doivent néanmoins être inscrits dans le journal de mesure :

1. le déploiement du 31 juillet a ajouté un lien de footer vers la tarification sur les pages surveillées ;
2. le sprint d'autorité du 31 juillet a modifié le contexte de backlinks du domaine, principalement vers la page d'accueil.

Ces événements ne justifient aucune remise à zéro des gels, mais ils empêchent d'attribuer une évolution future uniquement aux changements éditoriaux des pages.

## Intégrité des sources

### Dépôts et worktrees

- branche d'audit : `codex/seo-starter-j1-j17-archive`, HEAD `da92e371dbb5c17fbad260d8a3d364b198982fc4` ;
- `master` local observé : `bc9a283852aef6776eac7d90c16e9b048dbaceb4` ;
- `origin/master` local observé : `8c6de2b1ed08d9040da19d1320cb4e3828d7e1ae` ;
- la divergence actuelle concerne surtout l'application Android et les statistiques, pas les contenus SEO surveillés ;
- le checkout principal contient du travail utilisateur non commité sur l'application et les statistiques, mais aucun fichier `docs-src/`, `data/dream-symbols.json` ou source SEO surveillée n'y est modifié ;
- le présent worktree ne contient aucune modification suivie. Les documents Ahrefs non suivis, dont un fichier préexistant hors de ce lot, ont été préservés.

### Portefeuille 5 + 3

Les objets `stairs`, `mouth`, `tree`, `school`, `elevator`, `falling`, `rain` et `running` ont la même empreinte dans :

- le commit de baseline de la vague 2 `2105289bbb37e58692a271edd431bbdbdeabc475` ;
- la branche d'audit ;
- `master` local ;
- `origin/master` local.

Conclusion : aucune variation de `data/dream-symbols.json` concernant les huit objets n'est susceptible de brouiller la lecture J18.

### Articles surveillés

Aucun delta de source n'existe après la baseline pour :

- `/en/blog/flying-dreams-meaning` ;
- `/en/blog/dream-interpretation-history` ;
- `/es/blog/guia-suenos-lucidos-principiantes` ;
- `/en/blog/pregnancy-dreams-meaning` ;
- `/es/blog/suenos-de-muerte` ;
- `/de/blog/naechtlicher-laerm-schlaf-traeume`.

Les corrections de citations issues de l'audit de qualité sont déjà présentes dans l'état de baseline comparé. Elles ne constituent donc pas une nouvelle modification postérieure à cette baseline.

## Contrôle live

Contrôle direct effectué le 2 août 2026. La détection de données structurées n'entre pas dans ce lot ; aucune conclusion schema n'est tirée d'un simple téléchargement HTML.

| URL | HTTP | Canonical | Robots | `dateModified`/sitemap `lastmod` |
|---|---:|---|---|---|
| `/es/simbolos/escaleras` | 200 | propre | `index, follow` | 2026-07-10 |
| `/es/simbolos/boca` | 200 | propre | `index, follow` | 2026-07-10 |
| `/es/simbolos/arbol` | 200 | propre | `index, follow` | 2026-07-10 |
| `/it/simboli/scuola` | 200 | propre | `index, follow` | 2026-07-24 |
| `/es/simbolos/ascensor` | 200 | propre | `index, follow` | 2026-07-24 |
| `/es/simbolos/caida` | 200 | propre | `index, follow` | 2026-07-10 |
| `/it/simboli/pioggia` | 200 | propre | `index, follow` | 2026-07-06 |
| `/it/simboli/correre` | 200 | propre | `index, follow` | 2026-07-24 |
| `/en/blog/flying-dreams-meaning` | 200 | propre | `index, follow` | 2026-07-28 |
| `/en/blog/dream-interpretation-history` | 200 | propre | `index, follow` | 2026-07-28 |
| `/es/blog/guia-suenos-lucidos-principiantes` | 200 | propre | `index, follow` | 2026-07-28 |
| `/en/blog/pregnancy-dreams-meaning` | 200 | propre | `index, follow` | 2026-07-28 |
| `/es/blog/suenos-de-muerte` | 200 | propre | `index, follow` | 2026-07-28 |
| `/de/blog/naechtlicher-laerm-schlaf-traeume` | 200 | propre | `index, follow` | 2026-07-17 |

Le sitemap répond en 200 et contient les quatorze URL avec les mêmes dates. Aucun changement d'URL, redirection intermédiaire, canonical ou directive robots n'a été observé.

## Registre des facteurs confondants

| Événement | Date | Portée | Niveau | Traitement dans les prochaines lectures |
|---|---|---|---|---|
| Ajout d'un lien de footer vers la page de tarification | 2026-07-31 | Sitewide, visible sur les pages surveillées | faible à modéré | Annoter ; il modifie légèrement la distribution des liens internes, sans viser directement les 14 URL |
| Sprint d'autorité et déploiement de nouveaux actifs publics | 2026-07-31 | Domaine et page d'accueil | modéré | Annoter toute évolution d'autorité ; ne pas l'attribuer à une page ou à un snippet |
| Quatre domaines suivis manuellement comme pages suivies/indexables | état vérifié au 2026-07-31 | Liens vers la page d'accueil | modéré, délai inconnu | PeerPush, JunkStartups, Launch Llama et SaaSHub alternatives ; leur date d'acquisition n'est pas identique à leur date de vérification |
| Soumissions et outreach en attente | depuis le 2026-07-31 | Autorité future potentielle | non mesuré | Ne compter aucun backlink tant qu'une page publique vérifiable n'existe pas |
| Correction accessibilité du dictionnaire | 2026-07-29 | Dictionnaire, styles partagés mineurs | faible | Pas de changement de contenu ou métadonnées des 5 + 3 ; conserver comme contexte technique |
| Validations Rich Results et redirections | 2026-07-29 | Infrastructure et page anglaise distincte | faible pour le portefeuille | Garder séparé de l'expérience metadata |
| Regénération du bundle d'expérience | 2026-08-02 | Page d'accueil uniquement | nul pour les 14 URL | Le bundle n'est chargé ni sur une page symbole testée ni sur un article testé |
| Nouveaux pushes applicatifs et déploiements techniques | 2026-08-01/02 | Application principalement | nul à faible | Un déploiement sans delta HTML surveillé ne constitue pas une modification SEO de page |
| Données GSC arrêtées au 2026-07-27 dans la dernière preuve | courant | Mesure | élevé pour toute conclusion précoce | Attendre le lot GSC prévu le 4 août ; ne pas extrapoler |
| Aucun nouveau snapshot Rank Tracker après le 2026-07-29 à J16 | courant | Mesure Ahrefs | élevé pour les positions | Aucun nouvel appel J18 ; attendre une vraie mise à jour hebdomadaire |

## Décisions de gel

### Portefeuille principal

Les cinq pages restent gelées jusqu'au 8 août :

1. `/es/simbolos/escaleras` ;
2. `/es/simbolos/boca` ;
3. `/es/simbolos/arbol` ;
4. `/it/simboli/scuola` ;
5. `/es/simbolos/ascensor`.

`scuola` reste le premier test metadata prévalidé et `ascensor` le second. La prévalidation ne constitue toujours pas une autorisation d'édition.

### Vague éditoriale 2

Les cinq articles restent gelés jusqu'au 25 août. Le contrôle J+7 du 4 août sera une lecture précoce, pas un verdict d'impact.

### Article allemand sur le bruit nocturne

Le statut `monitor_only` décidé à J17 reste valide. Aucun changement ou échantillon nouveau ne justifie une édition.

## Budget et actions Ahrefs

- appel Rank Tracker : 0 ;
- appel Site Explorer/Keywords Explorer : 0 ;
- crédit général consommé : 0 ;
- nouveau crawl : 0 ;
- dernier compteur interface connu : 53 crédits utilisés au 30 juillet, non revalidé aujourd'hui ;
- export GSC : 0.

## Suite validée par ce contrôle

1. J19, le 3 août : aucune collecte payante nécessaire ; préparer uniquement le lot GSC et maintenir les gels.
2. J20, le 4 août : exporter les dernières fenêtres GSC complètes et effectuer la lecture J+7 de la vague 2, en annotant le footer et le sprint d'autorité du 31 juillet.
3. Le 8 août : produire la baseline fraîche des cinq priorités avant toute décision sur `scuola`.
4. Ne modifier aucune des pages surveillées avant les points de décision et autorisations correspondants.

## Point d'arrêt

J18 ne révèle aucun incident nécessitant une correction. Aucune source SEO, configuration Ahrefs, publication, demande d'indexation ou action externe n'a été modifiée.
