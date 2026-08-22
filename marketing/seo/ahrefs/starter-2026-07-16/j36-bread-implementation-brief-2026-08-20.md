# Noctalia — brief d'implémentation `bread`

Date : 20 août 2026

Statut : `BRIEF_ONLY` — aucune route créée, aucune publication

## Décision

Le concept mérite un propriétaire futur, d'abord en italien. Il ne mérite pas
encore une vague simultanée de cinq routes : IT possède la preuve la plus
forte, ES reste utile malgré un Traffic Potential fortement révisé, FR est
modeste, DE manque d'une SERP récente et US est trop faible sur la formulation
testée.

Le concept canonique reste néanmoins unique : le pain comme symbole de
nourriture, sécurité, partage, travail et abondance selon la scène et
l'émotion. Les cinq localisations doivent conserver ce même périmètre ; aucune
page religieuse, « numéro chance », recette ou nutrition ne doit être absorbée.

## Contrat proposé, non publié

| Marché | Slug réservé | Requête primaire | Title de travail | Priorité |
|---|---|---|---|---|
| IT | `/it/simboli/pane` | `sognare pane` | `Sognare il pane: mangiarlo, farlo o condividerlo` | P0 après gate |
| ES | `/es/simbolos/pan` | `soñar con pan` | `Soñar con pan: comerlo, hacerlo o compartirlo` | P1 après gate |
| FR | `/fr/symboles/pain` | `rêver de pain` | `Rêver de pain : en manger, en donner ou le partager` | P2 |
| DE | `/de/traumsymbole/brot` | `traumdeutung brot` | `Traumdeutung Brot: essen, backen oder teilen` | HOLD |
| EN | `/en/symbols/bread` | `bread dream meaning` à revalider | `Bread in Dreams: Eating, Baking or Sharing` | HOLD |

Les slugs sont des réservations éditoriales dans ce brief, pas un contrat URL
actif. Avant création, vérifier le registre, les collisions et la forme exacte
de la requête anglaise.

## Scénarios communs requis

1. pain frais, chaud ou abondant ;
2. pain rassis, brûlé ou moisi ;
3. manger le pain seul ou avec quelqu'un ;
4. donner, recevoir ou partager du pain ;
5. acheter, pétrir ou cuire du pain ;
6. manquer de pain ou ne pas pouvoir le manger ;
7. émotion dominante : sécurité, plaisir, gêne, pénurie ou responsabilité.

Chaque localisation doit expliquer que le rêve n'est ni une prédiction ni une
signification fixe. Les exemples culturels peuvent varier, mais ne doivent pas
transformer la page en contenu religieux ou divinatoire.

## Gate avant implémentation

- relancer GSC `bread` sur 28 jours pour confirmer l'absence de propriétaire ;
- revalider Ahrefs seulement si la décision de production est proche ;
- obtenir une SERP DE récente sans dépasser un micro-budget annoncé ;
- tester la requête EN `bread dream meaning`, parent plus pertinent que
  `dreaming about bread` ;
- vérifier qu'aucune page blog ne capte déjà ces intentions ;
- créer un seul concept par commit et ne jamais modifier les 50 suivis pour
  faire entrer la nouvelle vague.

GO de production seulement si IT et ES restent informationnels et si les cinq
fiches peuvent partager un concept canonique sans pages artificielles. Sinon,
publier plus tard IT seule dans un lot explicitement autorisé et maintenir les
autres marchés en backlog.
