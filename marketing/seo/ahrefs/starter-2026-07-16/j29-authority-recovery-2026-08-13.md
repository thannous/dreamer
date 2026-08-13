# Noctalia — J29 autorité et récupération de liens

Date : 13 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

## Décision du jour

J29 confirme que l'autorité externe, et non une correction technique urgente,
est le principal levier encore ouvert avant la remise à zéro. Le profil brut
Ahrefs reste fortement pollué : `421` domaines référents sont visibles, mais
seulement `10` sont suivis. Les deux actions externes les plus proches d'une
citation éditoriale propre restent `D2` Marika Pech et `D5` DreamWell ; elles
sont préparées et non envoyées, car chaque route exige une autorisation
explicite indépendante.

Les relances `D7` Atlas Workspace et ILTY ont déjà été envoyées dans leurs fils
existants le 13 août, après autorisation et stop gates dédiés. Elles passent en
surveillance passive : aucun second message automatique.

## Baseline live J29

| Couche | Valeur vérifiée | Interprétation |
| --- | ---: | --- |
| Ahrefs DR | `0.1` | hausse déjà observée, sans attribution causale |
| Ahrefs UR | `5` | métrique du domaine racine |
| Backlinks | `477` | `10` suivis et `467` non suivis |
| Domaines référents | `421` | `10` suivis et `411` non suivis |
| Mots-clés organiques estimés | `966` | `455` en positions 1–3 |
| Trafic organique estimé | `4.6K` | estimation Ahrefs, pas GSC |
| GSC 28 jours | `4.23K` clics, `501K` impressions, CTR `0.8 %`, position `7.4` | 15 juillet–11 août 2026 |
| GSC liens externes | `148` | 4 pages de destination visibles |

La fenêtre GSC gagne une journée complète par rapport à J28. Les agrégats de
propriété ne prouvent l'effet d'aucun lot particulier.

## Collecte Ahrefs facturable

Le lot annoncé couvrait nouveaux/perdus, backlinks cassés, meilleures pages par
liens, ancres et intersection concurrentielle, pour un plafond de `20` crédits.
Le compteur général est resté à `126/200` avant et après la collecte : aucune
consommation générale visible. Les `50/50` suivis Rank Tracker et le Site Audit
`3 627/10 000` sont inchangés.

### Nouveaux et perdus

- `8` groupes de liens suivis sont classés nouveaux sur le dernier mois.
- Les deux nouveaux liens éditoriaux lisibles sont la citation italienne DR 55
  vers l'article de rappel des rêves, déjà connue, et un lien allemand DR 0.7
  dont la source est hors sujet et faible.
- PeerPush reste un lien suivi propre de DR 71, mais il s'agit d'un lien
  existant conservé, pas d'une acquisition J29.
- Quatre nouveaux liens suivis affichent des ancres d'achat de backlinks/PBN et
  des sources explicitement marquées `SPAM` ; ils sont rejetés.
- Aucun groupe de lien suivi perdu n'est visible sur le dernier mois.

### Pages recevant des liens

Ahrefs ne montre que cinq destinations externes agrégées :

| Destination | Domaines référents | Suivis | Décision |
| --- | ---: | ---: | --- |
| `/` | `419` | `7` | ne pas interpréter le volume brut comme autorité propre |
| `/?ref=peerpush` | `1` | `1` | conserver ; ne pas relancer ni payer |
| article DE sur les rêves de mort | `1` | `1` | faible source hors sujet ; aucune action |
| article ES sur l'eau | `1` | `0` | lien nofollow perdu ; aucune récupération prioritaire |
| article IT sur le rappel des rêves | `1` | `1` | conserver la citation éditoriale existante |

### Ancres suivies

Six ancres suivies sont visibles. Quatre domaines utilisent l'ancre PBN
sur-optimisée `High Quality Dofollow Backlinks...` et doivent être ignorés.
Les signaux propres sont une ancre vide PeerPush, `Noctalia` vers l'article IT,
une URL brute DroidSpy et deux ancres éditoriales faibles. Aucune manipulation
d'ancre ni désaveu automatique n'est justifié par ce seul rapport.

### Rapports verrouillés

`Broken backlinks` et `Link intersect` demandent un boost ou un changement de
plan. Aucun achat ni changement d'abonnement n'a été effectué. Les contrôles
HTTP publics et le registre versionné restent l'alternative opérationnelle.

## Contrôle croisé GSC et public

Le rapport GSC Links passe de `149` à `148` liens externes. La page
`/en/dream-journal-apps` passe de `14` à `13` liens dans l'agrégat, tandis que
les trois autres destinations restent visibles. Cette variation ne suffit pas
à identifier une source perdue.

Le contrôle public du jour conserve six pages suivies reproductibles, cinq
nofollow et trois non indexables. SaaSHub conserve son lien suivi depuis sa page
d'alternatives ; sa fiche principale reste `noindex, follow`. Aucune
redirection, restauration de page ou modification locale n'est donc requise.

## Backlog exécutable

| Priorité | Route | État J29 | Prochaine action |
| ---: | --- | --- | --- |
| P0 | Marika Pech `D2` | prête, non autorisée, non envoyée | autoriser séparément l'envoi unique de la correction factuelle |
| P0 | DreamWell `D5` | prête, non autorisée, non envoyée | autoriser séparément l'envoi unique de la correction DreamKit |
| P1 | Atlas + ILTY `D7` | deux relances envoyées, aucune publication prouvée | surveillance passive uniquement |
| P1 | Simone `D8B` | message préparé, non envoyé | stop gate frais puis autorisation dédiée |
| P1 | ANTENNE BAYERN `D9A` | message préparé, non envoyé | stop gate frais puis autorisation dédiée |
| P1 | Epigenius `D9B` | message préparé, non envoyé | stop gate frais puis autorisation dédiée |
| P1 | Ràdio Nova `D10A` | message préparé, non envoyé | stop gate frais puis autorisation dédiée |

## Point de contrôle J30

1. Ne pas rouvrir ces rapports Ahrefs sans question nouvelle ; les preuves
   durables sont maintenant conservées.
2. Relever GSC au 12 août complet et mesurer uniquement les propriétaires
   publiés dont l'observation est déjà lisible.
3. Réserver la lecture J+7 de `casa`, `ragno`, `perro` au 15 août ; conserver
   leur gel jusqu'au 5 septembre.
4. Garder `scuola` séparée et non publiée jusqu'à cette lecture.
5. Ne consommer les crédits restants que pour un trou de preuve listé ; ne pas
   chercher à vider le compteur.

## Frontières

Aucun message, formulaire, soumission, achat, boost, add-on, changement
d'abonnement, crawl manuel, demande d'indexation, modification des 50 suivis ou
édition de contenu n'a été effectué par ce lot J29. Les relances D7 mentionnées
ci-dessus proviennent d'un lot distinct déjà autorisé et versionné sur
`master`. Une transmission ne prouve ni livraison, ni acceptation, ni backlink,
ni gain de DR ou de ranking.
