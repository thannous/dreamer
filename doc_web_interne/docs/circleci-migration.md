# Validations locales et benchmark CircleCI

`verify-local.config.mjs` porte toute la validation. CircleCI conserve seulement
un benchmark manuel des installations E2E/Chromium, sans tests applicatifs,
types, lint, build, backend ou publication.

## Avant livraison

1. Installer les versions de `mise.toml` et les dépendances locales (`npm ci`
   à la racine, dans `apps/meditation` et `npm run test:testerarmy:setup`).
2. Actualiser `origin/master`, committer le lot, puis lancer `npm run verify:pr`
   avant chaque push. La commande vérifie le commit dans une copie isolée et
   conserve sa preuve. Un contrôle déjà passé est réutilisé seulement si ses
   entrées sont identiques. Le hook de push garde ses contrôles légers.
3. Reporter le commit vérifié et le résultat dans la PR avec
   `node scripts/verify-local.mjs proof-block`. Répondre aux commentaires avec
   une nouvelle preuve pour chaque nouveau head envoyé. Si master a bougé,
   l'intégrer et revérifier avant le push.
4. Avant publication autorisée, lancer `npm run verify:release` sur le SHA exact
   de master, ou `npm run verify:release:site` pour noctalia.app seul. Un benchmark
   CircleCI ne constitue jamais cette preuve.

### Validation complète locale

Les contrôles restent dans les commandes locales, sur Windows avec Git Bash et
Python et sur Linux, avec leurs prérequis. La configuration conserve :

| Surface | Contrôles |
| --- | --- |
| Application | Compatibilité Expo, frontières, versions mobiles, types application/tests, lint et lint scripts, Jest lié au diff avant push et Jest complet en release |
| Livraison | Moteur de preuve, gardes de publication et de comptes de test, gardes du runner backend, contrats EAS |
| Meditation | Compatibilité Expo, frontières, types, lint et Jest du package |
| Site | Build et contrôles du site, campagne TesterArmy site |
| Backend | Contrats DB statiques, migrations PGlite, types/tests Deno, parcours backend local sur le runtime Supabase natif et Chromium |
| Parcours web | Outillage et gardes TesterArmy, les quatre passes Dreamer, Lucid et Meditation, mêmes cas et assertions sur les deux OS |
| Sorties livrées | Site reconstruit pour le SHA ; build web pour la cible app |
| Contrats CI | Anciens cas de classification/fallback/préparation et nouveaux contrats du benchmark, tous exécutés localement |

`npm run verify:release` utilise `release --target app`. Les contrôles `app`
sont le build web, `e2e-backend` et les campagnes Dreamer/Lucid/Meditation.
`verify:release:site` garde les autres contrôles, y compris la campagne site.
Les builds EAS et les vérifications sur appareil restent des preuves séparées,
avec leurs autorisations et prérequis de plateforme.

`scripts/verify-local-config.test.js` vérifie la conservation des commandes de
l'ancien portfolio. Celui-ci est figé dans
`.circleci/tests/fixtures/validation-portfolio.yml`, avec l'ancien setup dans
`legacy-setup.yml`. Ces fixtures servent uniquement aux tests locaux existants :
le pipeline ne les lit pas. Les tests du benchmark vérifient aussi leurs empreintes.

Les tests communs exécutent les mêmes cas partout, avec simulation des erreurs
et différences de plateforme. Les suites natives propres à un OS restent une
qualification additionnelle explicitement distincte. Une installation manquante
(Deno, runtime Supabase natif, TesterArmy) laisse une preuve `incomplete` ; elle ne devient ni
un skip validant ni une différence de couverture acceptée. Exécuter le contrôle
sur une machine équipée et fournir sa preuve avec
`--external <contrôle>="owner-machine: <hôte> <note> on <SHA>"` si nécessaire.
Aucun lien CI n'est accepté (`externalSources: []`).

## Benchmark manuel ciblé

Dans CircleCI, *Trigger Pipeline*, choisir la branche et ajouter le booléen
`run_e2e_benchmark=true`. Le seul workflow exige **à la fois** ce paramètre et
`pipeline.event.name=api` ou `pipeline.trigger.type=api`. Un appel API sans
opt-in, un webhook push/PR et une planification ne lancent aucun job.
L'ancien paramètre `force_full_validation` est retiré.
Voir les [paramètres de pipeline](https://circleci.com/docs/guides/orchestrate/pipeline-variables/)
et les [options de déclenchement](https://circleci.com/docs/guides/orchestrate/triggers-overview/).

Le payload de déclenchement API transmet seulement :

```json
{"parameters": {"run_e2e_benchmark": true}}
```

Reproduction locale sur Windows ou Linux, sans installer les dépendances racines :

```sh
npm run test:testerarmy:benchmark
# Pilotage court :
npm run test:testerarmy:benchmark -- --runs 1
```

Le benchmark utilise le même script Node et le même lockfile sur les deux OS :

- Trois installations `npm ci` de `tools/e2e` dans des répertoires isolés.
  Le cache npm commence vide, puis est partagé entre les répétitions du run.
- Pour chaque installation, téléchargement Chromium complet et headless shell,
  avec un répertoire navigateur neuf par variante ; ordre alterné.
- Résultat JSON : SHA source, version Node/OS, empreinte du lockfile, version et
  révisions Playwright, temps bruts, médianes, tailles installées, codes de retour.
- Logs et résultats sous `.tmp/e2e-benchmark/results/`. Seul ce dossier devient
  un artifact CircleCI ; les paquets, caches et navigateurs temporaires sont exclus.
  Les artifacts disponibles sont conservés après échec ; voir la
  [référence CircleCI](https://circleci.com/docs/reference/configuration-reference/).

Le rapport est toujours `applicationQualified:false`. Une installation échouée
laisse `passed:false`, sans résumé de gain trompeur. Aucun seuil de vitesse
n'autorise à retirer des assertions. Les paquets système Linux, dépendances
racines, parcours applicatifs, files d'attente et transferts d'artifacts sont hors
mesure. Ne pas comparer directement des timings Windows et Linux ou des machines
différentes ; comparer complet/headless dans le même run.

Le job n'utilise ni contexte secret, cache CircleCI, Docker distant, continuation,
shard, build natif ni compte de test. Les fusions et publications n'attendent pas
CircleCI. Aucun lancement distant n'est nécessaire pour valider une PR.

## Vérifier les contrats localement

`verify:pr` sélectionne les contrats CI lors d'une modification `.circleci/`,
des scripts E2E d'installation/benchmark, de `package.json` à la racine ou des
manifestes `tools/e2e/package.json` et `tools/e2e/package-lock.json`.
Une modification isolée de chacun de ces manifestes est vérifiée par les tests
de configuration avec le même sélecteur que le moteur. `verify:release` lance
toujours les contrats CI.
Pour itérer uniquement sur le benchmark :

```sh
node --test .circleci/tests/benchmark.test.mjs tools/e2e/benchmark-setup.test.mjs
```

Les cas couvrent l'opt-in et les déclencheurs, l'absence de validations distantes,
les fixtures historiques inchangées, les paramètres invalides et la conservation
des erreurs, signaux et reçus partiels. Aucun cas commun ne dépend de l'OS hôte.
