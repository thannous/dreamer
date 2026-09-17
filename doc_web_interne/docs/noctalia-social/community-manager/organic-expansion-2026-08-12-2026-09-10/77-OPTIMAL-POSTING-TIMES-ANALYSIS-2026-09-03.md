# Noctalia — Analyse des horaires optimaux — consolidée le 2026-09-04

## Décision

À compter du **11 septembre 2026**, la cadence principale passe de trois à deux
vidéos par jour. Les trois réseaux principaux conservent les **deux mêmes
assets chaque jour**, publiés à leurs heures respectives.

| Réseau | Créneau 1 retenu | Créneau 2 retenu | Créneau suspendu | Niveau de confiance |
|---|---:|---:|---:|---|
| TikTok | 15:30 | 19:30 | 22:30 | Modéré |
| Instagram | 22:45 | 19:45 | 15:45 | Modérée pour C3 ; faible pour le second choix |
| X | 16:15 | 20:15 | 23:15 | Très faible — décision provisoire |

Cette décision s'applique au **cycle suivant**. Elle ne demande ni suppression,
ni déplacement, ni remplacement des lignes déjà programmées jusqu'au
10 septembre inclus.

## Source analysée

- [Classeur Google Sheets — onglet « Analyse 2 par jour »](https://docs.google.com/spreadsheets/d/1acoGpbZCg89Wy3SR4JioJg0_exyNyVqp3R5QagdQTTs/edit?gid=1079908475#gid=1079908475)
- [Détail Instagram — top 20 et agenda consolidé sur 90 jours](https://docs.google.com/spreadsheets/d/1acoGpbZCg89Wy3SR4JioJg0_exyNyVqp3R5QagdQTTs/edit?gid=1886520152#gid=1886520152)
- Agenda complet : 360 lignes couvrant les 30 jours du programme et les six
  plateformes.
- Historique mesuré : 105 lignes disposant de métriques observées au moment de
  l'analyse, dont 50 Reels Instagram uniques.
- Date de coupe : 4 septembre 2026 à 01:07 CEST.

Le premier relevé Instagram ne contenait que les 20 Reels les mieux classés par
**comptes ayant interagi** sur 90 jours. Cette sélection expliquait les trous,
notamment sur C1. Le relevé du 04/09 a ouvert les Insights individuels de chaque
Reel public inscrit dans l'agenda. Il couvre désormais 45 des 46 Reels publiés
du 12/08 au 03/09 : 16 C1, 15 C2 et 14 C3. Le Reel C1 du 26/08
`Dcgy8tmJbpv` affiche une page indisponible ; sa ligne reste documentée sans
valeur inventée. Les cinq Reels du top 20 hors agenda sont conservés séparément.

## Méthode

La portée — vues ou impressions selon la plateforme — est le critère principal.
La médiane protège la décision contre les vidéos exceptionnellement virales ;
les likes, partages, republications et sauvegardes servent de garde-fous.

Les règles suivantes ont été appliquées :

1. ne jamais additionner les métriques de plateformes différentes ;
2. distinguer une cellule vide d'une valeur réellement nulle ;
3. exclure la mesure TikTok du 3 septembre explicitement marquée comme très
   précoce et non stabilisée ;
4. considérer tout horaire avec moins de trois observations comme provisoire ;
5. comparer les horaires à l'intérieur d'un même réseau seulement.

## Résultats des réseaux principaux

| Réseau | Horaire | Observations stables | Vues moyennes | Vues médianes | Likes moyens | Lignes publiées dans l'agenda | Lecture |
|---|---:|---:|---:|---:|---:|---:|---|
| TikTok | 15:30 | 6 | 502 | 514,5 | 11 | 21 | Deuxième portée la plus forte |
| TikTok | 19:30 | 6 | 667 | 768 | 20 | 21 | Meilleure portée et meilleur engagement observés |
| TikTok | 22:30 | 5 | 318 | 228 | 8 | 19 | Créneau nettement le plus faible |
| Instagram | 15:45 | 16 | 259,7 | 186 | 5,3 | 17 | Troisième moyenne ; médiane presque égale à C2 |
| Instagram | 19:45 | 15 | 374,7 | 184 | 5,5 | 15 | Deuxième moyenne, sensible au Reel à 2 474 vues |
| Instagram | 22:45 | 14 | 473,5 | 212,5 | 7,6 | 14 | Meilleure moyenne, médiane et intensité d'interaction |
| X | 16:15 | 2 | 14 | 14 | — | 20 | Égalité de portée, signal d'engagement légèrement meilleur |
| X | 20:15 | 2 | 14 | 14 | — | 19 | Égalité de portée |
| X | 23:15 | 0 | — | — | — | 14 | Impossible à évaluer faute de métriques |

### Interprétation

- **TikTok** fournit la seule conclusion suffisamment cohérente : `19:30` est
  le meilleur créneau et `15:30` le second. Le créneau `22:30` est suspendu au
  prochain cycle.
- **Instagram** confirme `22:45` et `19:45` comme le duo à tester. `22:45` est
  nettement premier en moyenne (`473,5`), médiane (`212,5`), likes moyens
  (`7,6`) et interactions moyennes (`9,1`). `19:45` obtient la deuxième
  moyenne (`374,7`), mais sa médiane (`184`) est pratiquement égale à celle de
  `15:45` (`186`). Après retrait du maximum de chaque créneau, C1 et C2 donnent
  respectivement `224,3` et `224,7` vues moyennes. Le second horaire reste donc
  une décision de test ; seul l'avantage de C3 est relativement robuste.
- **X** montre une égalité de portée entre `16:15` et `20:15`. `16:15` est
  conservé devant grâce au seul signal de like/republication observé. `23:15`
  n'a aucune mesure exploitable.

## Plateformes secondaires

Les données ne justifient pas de passer à deux publications quotidiennes sur
les plateformes secondaires. Le programme conserve un seul hero par jour :

| Plateforme | Horaire conservé | Observations | Portée moyenne | Portée médiane | Décision |
|---|---:|---:|---:|---:|---|
| Pinterest | 17:30 | 7 | 74 impressions | 47 | Conserver un hero quotidien |
| YouTube Shorts | 18:00 | 2 | 469 vues | 469 | Conserver un hero quotidien ; preuve encore faible |
| Facebook Reels | 18:15 | 18 | 3 205 vues | 359 | Conserver un hero quotidien ; moyenne tirée par un pic à 51 308 vues |

Le pilote d'archive Facebook à `12:30` ne comporte qu'une observation à
1 462 vues. Il ne suffit pas à démontrer que cet horaire est supérieur à
`18:15`.

## Application opérationnelle

À partir du 11 septembre, chaque journée principale utilise deux assets :

| Ordre quotidien | TikTok | Instagram | X |
|---|---:|---:|---:|
| Vidéo A | 15:30 | 19:45 | 16:15 |
| Vidéo B | 19:30 | 22:45 | 20:15 |

L'ordre des deux assets reste identique sur les trois réseaux, même si leurs
heures diffèrent. Aucun contenu déjà placé dans une file native avant cette date
ne doit être supprimé sur la seule base de cette analyse.

Le calendrier pilote correspondant est documenté dans
[`79-TWO-POSTS-PER-DAY-CALENDAR-2026-09-11-24.md`](./79-TWO-POSTS-PER-DAY-CALENDAR-2026-09-11-24.md).
Ses 28 lignes restent bloquées jusqu'à affectation de masters validés ; les
horaires seuls ne constituent ni une programmation native ni une autorisation
de réutiliser une vidéo déjà publique.

## Prochaine revue

- TikTok : revalider après au moins 10 nouvelles mesures stables par horaire.
- Instagram : comparer les trois créneaux à âge de publication égal après au
  moins 10 nouveaux posts par horaire. Revalider spécialement le duel C1/C2 ;
  ne pas interpréter le Reel à 2 474 vues comme une preuve d'effet horaire.
- X : relever au moins 5 mesures par horaire avant de qualifier les créneaux de
  véritablement optimaux ; `23:15` reste prioritaire car il n'est pas mesuré.
- Continuer à journaliser le nom du fichier vidéo, l'URL publique, les vues, les
  likes, les partages/republications et les sauvegardes lorsqu'elles existent.
