# Validation locale et boucle site — 18 octobre 2026

Intégration : branche `codex/site-ci-performance`, base initiale `9e92fe947`,
puis `401d71579` intégré après les fusions mobiles des autres sessions.
Implémentation du moteur et du serveur : `be47327b8`. Le bloc de preuve de la PR
identifie le commit final vérifié. Publication, builds EAS et fusion restent hors
de ce lot. Le checkout principal et ses six fichiers déjà modifiés sont préservés.

## Comportement implémenté

- Les quatre contrôles type/lint optent pour `parallel: true`. Ils partagent
  une étape et un verrou de machine sous Linux ; chacun conserve son
  environnement, sa durée, son résultat et sa possibilité de réutilisation.
  Les autres étapes sont séquentielles. Un échec bloque l'étape suivante.
- Les types de routes Dreamer/Lucid sont écrits dans un fichier temporaire
  unique puis remplacés atomiquement. Un lecteur ne voit jamais une déclaration
  tronquée. Le SHA256 du moteur est mis à jour dans sa configuration.
- `import/namespace` est désactivé uniquement pour TypeScript, qui vérifie déjà
  ces accès (Deno pour les Edge Functions). JavaScript garde cette règle, et les
  règles du React Compiler sont conservées. Référence :
  [typescript-eslint](https://typescript-eslint.io/troubleshooting/typed-linting/performance/#eslint-plugin-import).
- `npm run docs:dev -- --symbol=tiger --lang=fr` fait une construction complète
  initiale, puis régénère les symboles choisis après modification du seul
  générateur. Toute autre source impose une construction complète. Les événements
  simultanés et reçus pendant une construction sont conservés ensemble. Un
  événement de dossier Windows émis par le bundle généré ne relance plus une
  construction en boucle ; le parcours réel le vérifie.
- Une prévisualisation partielle est explicitement refusée par les contrôles
  globaux jusqu'à une nouvelle construction complète. Les choix de symboles et
  de langues invalides échouent avant écriture, y compris dans le générateur CLI.
- Le contrôle complet a reproduit un défaut préexistant sous Git Windows : GNU
  tar traite `C:\...` comme un hôte distant. La copie de publication choisit
  désormais le tar natif Windows par chemin absolu ; les commandes et gardes de
  publication sont conservées. Les attentes des tests distinguent `USERPROFILE`
  et les capacités POSIX. Corrections : `1cc639f4e`, puis `140bbf49a`.
  Deux tests des gardes de comptes utilisent aussi les chemins natifs Windows
  et réservent leurs assertions de permissions POSIX à Linux (`b785129d3`) ;
  aucun script de compte ni garde de cible n'est modifié.

## Mesures

Windows, Node `24.19.0`, 32 processeurs logiques disponibles. Installation isolée
par `npm ci` selon le lockfile ; les premières tentatives avec les dépendances
incomplètes du checkout principal sont exclues des mesures. ESLint est exécuté
avec `--no-cache`, `TIMING=50`, et `EXPO_OFFLINE=1`. Ce sont des mesures des quatre
contrôles, pas du temps total de `verify:pr` ni d'une CI distante.

Comparaisons répétées sur les mêmes sources `f9806af5a`, sans autre validation
lourde concurrente. Avant : quatre commandes séquentielles et configuration
ESLint initiale de `9e92fe947`. Après : mêmes commandes dans le lot parallèle,
avec la règle redondante retirée. Le cache ESLint est désactivé ; le cache de
fichiers du système est déjà réchauffé.

| Quatre contrôles | Avant | Après |
| --- | ---: | ---: |
| Répétition 1 | 63,05 s | 35,00 s |
| Répétition 2 | 71,38 s | 42,09 s |
| Médiane | **67,21 s** | **38,55 s** |

Gain médian : **42,6 %**. Le reçu canonique est
`repeated-measurements-qualified.json` ; les journaux et exports bruts sont
conservés. La révision réelle est celle du coordinateur de mesure : les exports
sériels bruts avaient conservé une étiquette de base initiale, corrigée
explicitement dans le reçu canonique sans changer les durées ou résultats.

Sur le parcours final du serveur réel : construction initiale 13,86 s,
régénération du tigre FR 148 ms, reconstruction complète après changements
mixtes 14,29 s, puis absence de nouvelle construction non demandée. Les reçus
identifient le commit et les empreintes des sources.
Ces observations ne prédisent pas un gain identique sur une machine à quatre
cœurs et n'incluent pas le délai de regroupement des événements.

## Preuves et limites

Les contrôles isolés ajoutés couvrent des défauts que le navigateur ne peut pas
observer : une déclaration lue pendant son écriture, une preuve de validation
réutilisée sur du code mobile modifié, les signaux de processus et les résultats
individuels d'un lot parallèle. Les assertions du parcours CLI/HTTP couvrent le
comportement visible du serveur et du générateur.

- Moteur Linux : 83 tests réussis, zéro ignoré, dont les six scénarios du
  parallèle (recouvrement réel, environnements distincts, échec et réutilisation,
  signal, lanceur perdu et nettoyage des enfants avant libération du verrou).
- `verify:pr` passe sur `f9806af5a` intégré à `401d71579` : huit contrôles
  exécutés, trois réutilisés, cinq hors périmètre. Les quatre contrôles type/lint
  ont été recalculés après les modifications mobiles amont. Le commit source
  suivant du générateur est vérifié séparément pour constater leur réutilisation ;
  le bloc de preuve final de la PR consigne sa révision et son résultat.
- Windows : les scénarios applicables du moteur passent ; la supervision des
  groupes et `flock` restent propres à Linux, comme avant ce lot.
- Publication : 91 tests réussis sous Linux, incluant les vrais signaux et les
  permissions POSIX ; sous Windows, 87 réussis et deux contrôles POSIX ignorés,
  avec les deux cas SIGQUIT absents de cette plateforme exclus de la table.
  Les tests TypeScript sont transpilés sans modification de comportement pour
  la fixture Linux, lancée avec Jest `30.5.2`, comme le checkout Windows.
- Gardes des comptes de test : 36 tests réussis sous Windows et sous Linux,
  hors réseau, avec les permissions POSIX vérifiées sous Linux. Aucun compte,
  identifiant de connexion ou backend réel n'est créé ou modifié.
- Parcours HTTP : page FR modifiée, page EN inchangée en mode ciblé, événements
  de rechargement reçus, contrôle global refusé après prévisualisation partielle,
  reconstruction complète et page EN actualisée après un changement CSS et un
  changement du générateur dans la même fenêtre de regroupement.
- Parcours CLI : sortie ciblée du tigre FR identique octet par octet à la
  génération FR complète ; sélection partiellement invalide et langue inconnue
  refusées sans modifier la page existante.
- Contrôle d'import : une propriété absente échoue toujours en JavaScript via
  ESLint, et en TypeScript via `TS2339`. `react-hooks/static-components` reste
  une erreur.
- Contrats EAS/release mobiles : 192 tests réussis ; versions Dreamer, Lucid et
  Meditation cohérentes. Aucun workflow CircleCI/EAS, profil mobile, manifeste,
  compteur ou lockfile modifié. Aucun build natif ou parcours sur appareil réalisé.
- Contrats CircleCI : classificateur réussi dans une fixture Linux ; 12 tests
  Python réussis ; 360 combinaisons de déclenchement et six tests du repli Jest
  réussis sous Git Windows. Le cas de changement de type de lien du classificateur
  ne se reproduit pas sous Git Windows : la preuve de ce cas est Linux.

Artefacts privés : `.tmp/ci-performance/` dans le checkout de cette branche,
avec les journaux, reçus JSON et commandes de mesure. Reruns :

```sh
node --test scripts/test-verify-local.mjs
npm run test:file -- scripts/docs-dev.test.ts scripts/lib/docs-check-helpers.test.ts scripts/generate-shared-route-types.test.js scripts/verify-local-config.test.js --runInBand --watchman=false
npm run test:file -- scripts/android-release-smoke-workflow.test.js scripts/check-android-release-ref.test.js scripts/check-android-release-gates.test.js --runInBand --watchman=false
node scripts/mobile-release.js verify --app all
npm run verify:pr
```

Le moteur est portable mais seul Dreamer est modifié ici. Son adoption dans un
autre dépôt nécessite d'y reporter le moteur et ses tests, d'actualiser son pin
et de revérifier sa configuration ; aucune preuve d'un autre dépôt n'est revendiquée.
