# Noctalia — J29 validation GSC/Ahrefs guêpe et cimetière

Date : 13 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

## Verdict

Le cluster `cemetery` devient le prochain concept éditorial recommandé après la
lecture J+7 du 15 août. Le marché italien fournit le signal le plus fort :
`sognare cimitero` affiche un volume pays de `600`, un KD de `0` et un potentiel
de trafic de `600`. La SERP contient plusieurs pages sans domaine référent, dont
un résultat DR `0` classé troisième et un autre DR `0` classé huitième.

Le cluster `wasp` reste juste derrière. Son meilleur marché est l'Espagne :
`soñar con avispas` affiche un volume pays de `600`, un KD de `0` et un potentiel
de trafic de `250`. Les variantes observées couvrent notamment l'absence de
piqûre, l'attaque, la poursuite et la piqûre. Un résultat sans backlink ni
domaine référent est visible en septième position.

Aucun nouveau propriétaire n'est publié à J29. Les expériences `casa`, `ragno`
et `perro` restent gelées et `scuola` reste séparée et non publiée. La prochaine
porte d'implémentation est la lecture J+7 du 15 août, afin de ne pas ajouter un
nouveau facteur confondant avant ce checkpoint.

## Preuve GSC

La dernière journée complète visible est le 11 août 2026. La fenêtre 28 jours
du 15 juillet au 11 août affiche `4 231` clics, `501 427` impressions, un CTR de
`0,8 %` et une position moyenne de `7,4` pour la propriété.

Deux expressions régulières multilingues ont été contrôlées :

| Cluster | 28 jours | Fenêtre disponible « 12 mois » | Décision d'ownership |
| --- | ---: | ---: | --- |
| `wasp|guêpe|avispa|Wespe|vespa` | `0` clic, `0` impression | `0` clic, `0` impression | absence durable de propriétaire GSC |
| `cemetery|cimetière|cementerio|Friedhof|cimitero` | `0` clic, `0` impression | `0` clic, `1` impression, position `51` | l'unique impression est une longue requête EN sur un chien dans un cimetière ; aucun propriétaire de concept |

La fenêtre « 12 mois » disponible dans la propriété commence le 5 décembre
2025 et se termine le 11 août 2026. Les totaux filtrés de Search Console peuvent
être incomplets ; les zéros sont donc une preuve d'absence dans les données
restituées, pas une garantie absolue d'absence de toute requête anonymisée.

## Preuve Ahrefs ciblée

Le micro-lot a regroupé deux requêtes par marché afin de limiter la consommation.
Il a coûté `5` crédits généraux : le compteur est passé de `126/200` à `131/200`.
Il reste donc `69` crédits avant la remise à zéro observée le 16 août 2026 à
00:00 UTC. Rank Tracker reste à `50/50` et Site Audit à `3 627/10 000`.

| Priorité | Marché | Requête | KD | Volume | TP | Parent Topic | Décision |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| P0 | IT | `sognare cimitero` | 0 | 600 | 600 | `sognare cimitero` | propriétaire localisé recommandé dans la prochaine vague |
| P1 | ES | `soñar con avispas` | 0 | 600 | 250 | `soñar con avispas` | second concept ; couvrir piqûre, attaque, poursuite et absence de piqûre |
| P1 | ES | `soñar con cementerio` | 0 | 250 | 150 | `soñar con cementerio` | renforcer le concept cimetière en espagnol |
| P1 | IT | `sognare vespe` | 0 | 200 | 100 | `sognare vespe` | inclure stress, menace et limites des lectures folkloriques |
| P2 | DE | `traumdeutung wespen` | 0 | 150 | 150 | `traumdeutung wespen` | variante localisée du concept partagé |
| P2 | DE | `traumdeutung friedhof` | 0 | 150 | 60 | `traumdeutung friedhof` | variante localisée du concept partagé |

Les deux SERP approfondies confirment la faisabilité :

- ES `soñar con avispas` : résultat DR `10` en position 3 avec deux domaines
  référents ; résultat DR `46` en position 7 avec zéro backlink et zéro domaine
  référent ; les variantes visibles incluent `que significa`, `significado`,
  `que no pican`, `que atacan` et la piqûre ;
- IT `sognare cimitero` : résultat DR `0` en position 3, résultat DR `25` en
  position 4 avec zéro domaine référent et résultat DR `0` en position 8 avec
  zéro backlink ; les variantes visibles incluent les tombes, la nuit, la foule
  et le sens psychologique.

Ces observations ne garantissent pas un classement. Elles prouvent seulement
qu'une page sans forte autorité externe peut entrer dans les SERP actuelles si
elle satisfait correctement l'intention.

## Contrôle du dépôt

`data/dream-symbols.json` contient `158` concepts et ne contient ni `wasp` ni
`cemetery`. Une recherche ciblée dans `data/dream-symbols.json` et
`docs-src/content/` ne trouve aucun propriétaire éditorial dédié ni passage
localisé susceptible de créer une cannibalisation immédiate.

## Backlog exécutable

1. Le 15 août, lire d'abord le checkpoint J+7 de `casa`, `ragno` et `perro`,
   puis conserver `scuola` dans son expérience distincte.
2. Si ce checkpoint ne révèle aucun incident, préparer `cemetery` comme un seul
   concept partagé avec cinq propriétaires localisés. Commencer l'angle par
   lieu, mémoire, deuil, transition, tombes, nuit et présence d'autres personnes ;
   ne pas centrer la page italienne sur les numéros de la Smorfia.
3. Soumettre le concept à `docs:build`, `docs:check` et aux contrats URL, puis
   isoler contenu, contrat, commit et déploiement comme pour les vagues
   précédentes.
4. Ne préparer `wasp` qu'après la preuve publique de `cemetery`. Le brief doit
   distinguer abeilles et guêpes et traiter attaque, poursuite, nid, piqûre et
   guêpes non agressives sans présenter une croyance prédictive comme un fait.
5. Ne modifier aucun des 50 suivis et ne demander aucune indexation manuelle.

## Frontières

Aucun contenu, route, canonical, hreflang, suivi, crawl, message externe,
demande d'indexation, achat, add-on ou abonnement n'a été modifié par cette
validation. Le connecteur API Ahrefs a signalé `0` unité API disponible ; cette
couche reste distincte des `69` crédits généraux encore visibles dans
l'interface Starter.
