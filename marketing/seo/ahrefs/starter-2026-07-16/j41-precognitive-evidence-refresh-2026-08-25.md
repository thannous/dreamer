# J41 — refonte factuelle du propriétaire EN « precognitive dreams »

Date d'exécution : 25 août 2026

Propriété GSC : `sc-domain:noctalia.app`

URL propriétaire : `/en/blog/precognitive-dreams-science`

## Verdict

Le levier actionnable de J41 est une refonte éditoriale ciblée de l'URL
existante. La page se situe déjà en première page sur un volume d'impressions
important, mais son CTR reste presque nul. Elle cible déjà « science » et
« confirmation bias » : un nouveau changement cosmétique du title seul ne
répondrait pas au problème. Le lot améliore donc simultanément la promesse du
snippet, la hiérarchie de réponse et la qualité des preuves, sans créer de
nouvelle route.

## Preuves GSC

Fenêtres complètes disponibles au 23 août 2026 :

| Fenêtre | Clics | Impressions | CTR calculé | Position |
| --- | ---: | ---: | ---: | ---: |
| 28 jours, 27 juillet–23 août | 4 | 20 238 | 0,0198 % | 7,8 |
| Disponible sur 12 mois, 5 décembre–23 août | 10 | 53 400 | 0,0187 % | 8,3 |

Requêtes visibles qui motivent la structure :

| Requête | Fenêtre | Impressions | Position |
| --- | --- | ---: | ---: |
| `confirmation bias in precognitive dreams` | disponible sur 12 mois | 466 | 6,0 |
| `percentage of people who report precognitive dreams` | disponible sur 12 mois | 205 | 7,2 |
| `confirmation bias precognitive dreams` | disponible sur 12 mois | 157 | 7,1 |
| `precognitive dreams confirmation bias` | disponible sur 12 mois | 91 | 6,8 |
| `scientific evidence dreams predict the future no evidence` | 28 jours | 90 | 9,0 |
| `prospective dream diary precognitive dreams confirmation bias study` | 28 jours | 70 | 4,7 |
| `precognitive dreams scientific evidence review pubmed` | 28 jours | 54 | 9,9 |

Le rapport GSC « AI generative appearance » attribue 1 150 impressions à cette
URL sur 28 jours, soit environ 5,7 % de ses 20 238 impressions. Ce signal
n'explique donc pas à lui seul le CTR global.

## Vérification scientifique

La réécriture s'appuie sur trois sources primaires de l'Université
d'Édimbourg :

- Watt (2014), étude en ligne de 50 participants : taux de succès direct de
  32 % au-dessus du hasard sur la mesure planifiée ;
- Watt, Wiseman et Vuillaume (2015), laboratoire du sommeil, 20 participants
  sélectionnés : aucune preuve de précognition onirique dans cet échantillon ;
- Watt et al. (2014), deux études psychologiques : rappel sélectif des couples
  rêve-événement présentés comme confirmés et association entre croyance et
  capacité à trouver des correspondances.

La conclusion éditoriale est volontairement limitée : une expérience
subjective peut être sincère, mais une capacité prédictive fiable et
reproductible n'est pas établie.

## Modification locale J41

Une seule source est modifiée :
`docs-src/content/blog/blog.precognitive-dreams-science/en.md`.

- Title : `Precognitive Dreams: Science & Confirmation Bias | Noctalia`
  (59 caractères).
- H1 : `Can Dreams Predict the Future? What Science Shows`.
- Description : réponse explicite sur les études contrôlées, leurs limites et
  la méthode prospective.
- Métadonnées Open Graph, Twitter et JSON-LD synchronisées.
- `wordCount` JSON-LD recalculé à `995` mots visibles dans les blocs
  éditoriaux ; temps de lecture conservé à `PT4M`.
- Quick answer réécrite avec les résultats contradictoires des études de 2014
  et 2015.
- Tableau de preuves renforcé par l'étude directe sur le rappel sélectif.
- Suppression des anecdotes historiques non sourcées, de la citation attribuée
  sans source vérifiable, et des sections spéculatives sur la conscience
  globale, le presentiment et la mécanique quantique.
- Section dédiée à la fréquence déclarée : environ un tiers est une mesure de
  croyance ou d'expérience rapportée, pas un taux de prédiction vérifiée.
- Protocole de journal prospectif resserré : critères définis à l'avance,
  conservation des échecs, comparaison du texte original et relecture en
  aveugle.
- CTA corrigés : l'horodatage améliore la trace, mais ne constitue jamais une
  preuve de précognition.

La route, le canonical, le hreflang, le sitemap et le maillage propriétaire
restent inchangés.

## Garde-fous

- Aucune nouvelle page.
- Aucun changement des 50 couples Rank Tracker, de leurs emplacements ou tags.
- `scuola` reste une expérience séparée.
- `casa`, `ragno` et `perro` restent gelés jusqu'au 5 septembre.
- Aucun crédit Ahrefs général consommé.
- Aucune demande d'indexation, mutation GSC, action d'autorité externe ou
  changement d'abonnement.

## Validation

- `git diff --check` : vert.
- `npm run docs:build` : vert, 1 256 URL dans le sitemap.
- `npm run docs:check` : vert, 0 erreur et 0 avertissement.

## Séparation des états

- Observation GSC : terminée en lecture seule.
- Vérification des sources : terminée.
- Modification locale : réalisée dans `docs-src/` uniquement.
- Commit et push : non réalisés.
- Publication : non réalisée.
- Mesure : comparer le CTR et la position sur 28 jours complets après
  publication éventuelle ; ne pas mélanger la fenêtre prépublication.
