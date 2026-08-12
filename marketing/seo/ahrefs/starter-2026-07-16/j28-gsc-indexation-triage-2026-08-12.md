# J28 — tri GSC des URL explorées non indexées

Date de contrôle : 12 août 2026. Les données de performance GSC étaient indiquées comme mises à jour six heures avant la lecture et s'arrêtaient au 9 août 2026.

## Verdict

Le premier cas, l'article allemand sur la poursuite, ne présente pas de blocage d'indexation actuel. Il a généré des impressions et des clics dans Google, alors que le rapport de couverture exporté le 11 août le classait encore parmi les URL explorées non indexées au 7 août. Cette divergence est traitée comme un état de couverture retardé ou transitoire.

Aucune demande d'indexation n'est justifiée. Un seul lien interne contextuel est retenu depuis une page source forte et sémantiquement proche.

## Segmentation conservée

| Segment du rapport de couverture | Nombre | Décision |
|---|---:|---|
| routes canoniques actuelles | 184 | auditer par valeur et intention, au cas par cas |
| anciennes variantes `.html` ou routes legacy | 70 | ne pas optimiser; elles répondent 301 vers une destination |

Les 184 routes actuelles restent réparties en 106 fiches symbole, 72 articles et 6 guides. Le graphe de liens versionné donne à chacune au moins quatre sources distinctes; il n'y a donc pas de justification à une campagne massive de liens internes.

## Cas 1 — article DE sur la poursuite

URL cible : `https://noctalia.app/de/blog/traeume-verfolgt-werden-bedeutung-und-interpretation`

### Preuves techniques et GSC

- HTTP public : 200.
- robots : `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`.
- canonical : auto-référentiel.
- dernière exploration dans le rapport de couverture : 4 août 2026.
- sources internes distinctes avant traitement : 14.
- GSC 28 jours complets, du 13 juillet au 9 août : 1 clic, 83 impressions, CTR 1,2 %, position 8,9.
- GSC 12 mois sélectionnés : 2 clics, 131 impressions, CTR 1,5 %, position 8,5. La page n'existait pas sur toute la fenêtre; le graphique visible commençait le 5 décembre 2025.

Les impressions et clics prouvent que Google servait déjà cette URL. Le levier n'est donc pas une réparation technique d'indexation, mais un renforcement éditorial mesuré.

## Page source retenue

URL source : `https://noctalia.app/de/blog/wiederkehrende-traeume-bedeuten-ihre-verborgenen-botschaften-verstehen`

| Fenêtre GSC | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 28 jours, 13 juillet–9 août | 41 | 5,34 k affichées | 0,8 % | 6,7 |
| 12 mois sélectionnés | 114 | 16,5 k affichées | 0,7 % | 7,8 |

La page source traite explicitement les rêves récurrents et comporte un passage « Gejagt werden ». Elle dispose donc à la fois d'un signal organique significatif et d'un contexte utilisateur naturel.

## Traitement local

Fichier source modifié : `docs-src/content/blog/blog.recurring-dreams-meaning/de.md`.

Le passage « Gejagt werden » renvoie désormais vers l'article détaillé avec l'ancre `typischen Szenarien eines Verfolgungstraums`. Cette ancre décrit les scénarios complets détenus par le blog et reste distincte de la fiche symbole `/de/traumsymbole/verfolgung`, propriétaire de la consultation rapide.

Les champs `modifiedTime`, `dateModified` et la date visible ont été alignés sur le 12 août 2026. Le titre, la description, l'URL, le canonical et l'ownership ne changent pas.

## Garde-fous

- aucune dépense de crédit Ahrefs;
- aucun changement des 50 suivis, emplacements ou tags;
- aucune demande d'indexation;
- aucune mutation GSC;
- aucune modification de `docs/`;
- aucun traitement de `scuola`, `casa`, `ragno` ou `perro`;
- aucun envoi externe.

## Mesure suivante

Conserver la baseline cible de 1 clic, 83 impressions et position 8,9 sur 28 jours. Comparer des fenêtres GSC complètes après recrawl naturel; ne pas attribuer une variation au lien tant que la nouvelle version n'a pas été observée par Google.
