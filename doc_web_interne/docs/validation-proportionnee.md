# Validation proportionnée des changements Noctalia

Cette règle s'applique à Journal, Lucid et Meditation. Le risque du comportement
modifié détermine les vérifications ; le nombre de tests n'est pas un objectif.
Les commandes disponibles restent celles des `package.json` et des guides locaux.

Le contrat fonctionnel actuel prime sur une ancienne attente de test. Les décisions
datées et résultats antérieurs restent des faits historiques, pas des interdictions
permanentes d'évolution. TesterArmy reste le choix par défaut pour les parcours
nouveaux ou affectés ; les interfaces et assertions critiques sont réellement testées.

## Évolution des contrats et outils

Avant de reproduire un ancien rouge, identifier le résultat attendu aujourd'hui.
Si le produit a changé, actualiser l'attente avec sa raison et un parcours ciblé,
en conservant l'ancien résultat et son contexte. Un contre-exemple historique
utile reste informatif ; une assertion encore pertinente reste un contrôle actuel.
Ne pas reclasser un ancien rouge comme passé ou supprimer implicitement un
contrôle existant (hook, classification ou job CI). Une nouvelle fonction n'attend pas une parité historique sans rapport
avec son comportement ni la disponibilité d'un appareil physique non requis.

Pour une mise à jour compatible, vérifier les peers, le loader et la documentation
installée, isoler les dépendances et essayer un parcours représentatif avec son
rapport/cleanup. Adopter la version épinglée quand les contrôles pertinents passent,
sans nouvelle demande générique d'autorisation dans le même travail demandé.
Un nouveau provider, budget, EAS/Store ou acte de publication garde sa limite propre.

Les contrôles isolés servent un mode d'échec concret inaccessible au parcours
(par exemple un receipt corrompu ou un signal). Décrire cette lacune et garder les
contrôles qui la détectent ; l'ordre chronologique test/code n'est pas un gate.

Pour le natif demandé, un projet manquant peut être généré dans le worktree isolé,
après vérification SDK/profil, avec `prebuild --no-install` explicite de préférence.
Ne pas régénérer le checkout primaire ou le projet d'une autre tâche. Réutiliser
un projet et un binaire seulement si leurs inputs pertinents restent compatibles.

| Changement | Vérifications attendues |
| --- | --- |
| Documentation, texte sans impact de mise en page ou de comportement | Relecture, liens concernés et contrôle du diff ; aucune suite applicative. |
| Petite retouche visuelle | Lint ciblé et inspection de l'écran ; contraste et texte agrandi si concernés. |
| Fonctionnalité | Tests ciblés du comportement et des régressions plausibles, lint/types pertinents, parcours UI concerné. |
| Données, comptes, synchronisation, achats, code partagé ou configuration de build | Suites impactées plus larges, cas d'échec et vérifications natives adaptées. |

## Éviter les répétitions

Choisir une commande de tests ciblés adaptée, sans cumuler systématiquement
`test:file`, `test:related`, `test:changed` et la suite complète. Réutiliser les
tests existants avant d'en ajouter ; tester un résultat observable, pas recopier
l'implémentation dans les assertions.

Après un passage réussi, relancer seulement ce qu'une modification pertinente,
un changement de dépendance/configuration, un échec ou un risque restant remet
en question. Conserver la révision et la portée des preuves. Une correction du
rapport ne demande pas de rejouer les tests du code inchangé.

Conserver le rapport canonique, source/build/device, verdict, commande exacte et
les logs/captures utiles au diagnostic. Les sorties restent immuables et les anciens
rouges restent distincts ; aucune duplication complète des médias ni nouvelle
vérification de tous leurs hashes à chaque statut/relecture. Référencer les pièces
existantes après le contrôle canonique ; revérifier lors d'un transfert d'octets,
d'un changement d'inputs, d'un soupçon de corruption ou d'un contrôle Release requis.
Cette règle supprime les répétitions ad hoc, pas les gardes existantes du runner.

Regrouper les corrections locales et leur relecture avant de demander la fusion
lorsque c'est possible. Pousser ne coûte rien : le hook ne lance aucune suite.
`npm run verify:pr` reste exigé sur le dernier commit de la PR : cette règle
n'autorise ni le contournement du hook ni une modification implicite des
contrôles (`verify-local.config.mjs`) ou du pipeline.

## Pousser, puis prouver avant la fusion (règle commune v2)

Chaque push lance le hook `.githooks/pre-push`, installé par `npm ci`/`npm install`.
Il dure quelques secondes et ne lance aucune suite : fichiers interdits (`.env`,
clés), secrets et taille des fichiers envoyés, puis il affiche la preuve de
l'arbre poussé (une preuve absente ne bloque pas). Une suppression de branche ou
un push sans nouveau commit ne lance rien. Les agents n'utilisent jamais
`git push --no-verify`.

Avant la fusion, l'auteur lance, sur la tête de la PR :

```sh
git fetch origin master
npm run verify:pr
```

Le contrôle porte sur une copie isolée du commit (`git worktree`, avec les
`node_modules` du checkout principal liés) : le travail non committé n'est ni
vérifié ni déplacé, et aucun arbre propre n'est exigé. Il lance `typecheck:app`,
`typecheck:tests`, `lint`, `lint:scripts`, les tests Jest liés au diff depuis le
merge-base avec `origin/master` (`test:changed`, même base que CircleCI, y
compris pour une PR empilée), les contrats statiques Supabase et Edge, et les
tests du moteur. Selon les chemins changés depuis `origin/master`, il ajoute
`docs:build` et `docs:check` (site : `docs-src/`, `data/`, `scripts/`, fichiers
de paquet), les tests du classificateur CircleCI (`.circleci/`), Meditation
(`apps/meditation` et fichiers partagés) et les Edge Functions sous Deno
(`supabase/functions`, `supabase/lib`, `supabase/migrations`, `deno.lock`).
La liste exacte est dans `verify-local.config.mjs`.

La preuve est liée à l'arbre vérifié et écrite dans
`$(git rev-parse --git-common-dir)/verify-proofs/`. Un contrôle déjà réussi sur
les mêmes entrées est réutilisé : une correction documentaire ne rejoue ni les
types ni le lint (leurs entrées ignorent le Markdown, `doc_web_interne/`,
`marketing/` et `specs/`), et un second `verify:pr` sur le même arbre ne rejoue
rien. Un contrôle spécialisé impossible sur la machine (Deno absent, par
exemple) rend la preuve `incomplete` : le lancer ailleurs (pipeline CircleCI
manuelle, machine du propriétaire), puis relancer avec
`--external <contrôle>=<preuve>`.

Ce contrôle qualifie une PR, pas une publication. Une publication, une branche
`release` ou `release/*` et un tag exigent `npm run verify:release` sur le SHA
exact (ou une pipeline CircleCI manuelle avec `force_full_validation: true`),
décrit dans le [guide CircleCI](circleci-migration.md#validation-complète-locale).

Ce contrôle remplace une sélection finale manuelle ; ne pas lui ajouter
systématiquement `test:file`, `test:related` et la suite entière. Pendant le
développement, les vérifications du tableau restent proportionnées. Un module
partagé de traductions peut sélectionner beaucoup de tests, car ses
consommateurs sont réellement nombreux. Les vérifications sur appareil restent
celles que demandent les surfaces modifiées.

Pendant le développement, `npm run test:changed` utilise le merge-base avec la
référence **locale** `origin/master`. `JEST_CHANGED_SINCE=HEAD npm run test:changed`
reste disponible pour un delta non committé : un résultat sans tests après un
commit ne prouve rien sur la PR. Dans une pipeline CircleCI manuelle, la base
explicite fournie par la classification reste prioritaire.

## Après le push : vérifier la bonne révision

Regrouper les corrections et vérifier les changements de dernière minute avant
un push. Quand plusieurs tâches travaillent sur une même branche, garder un
responsable de l'intégration et signaler les nouveaux commits.

1. Coller dans la section **Local proof** de la PR la sortie de
   `node scripts/verify-local.mjs proof-block`, puis ajouter les preuves encore
   manquantes (natif, appareil). Push et PR ne déclenchent pas CircleCI.
2. Traiter les commentaires de revue par de nouveaux commits, puis relancer
   `npm run verify:pr` sur la nouvelle tête et mettre la preuve à jour.
3. Avant fusion, `git fetch origin master`. Si `master` a bougé depuis la
   preuve, fusionner `origin/master` dans la branche, relancer
   `npm run verify:pr` (seuls les contrôles dont les entrées ont changé
   tournent) et mettre `## Local proof` à jour.
4. Le CTO fusionne en squash quand la PR n'est plus en brouillon, que le
   `Commit SHA` de la preuve est la tête de la PR
   (`gh pr view <PR> --json headRefOid,mergeable`), sans fil ouvert ni conflit.
   `gh pr merge <PR> --squash --match-head-commit <SHA vérifié>` évite une
   fusion après un push concurrent. Une nouvelle tête nécessite son propre
   verdict.

Les jobs site et Noctalia conservent la même sélection Jest et la même base.
Lorsque Noctalia exécute déjà cette sélection (ou la suite exhaustive), le job
site conserve ses build/check et évite uniquement le second passage Jest. Pour
une PR site seule, ou si Noctalia ne lance pas Jest, le job site le conserve.

## Tests asynchrones et contrats de copie

Attendre une interaction asynchrone dans `act` ou avec l'outil asynchrone de la
bibliothèque. Résoudre les promesses contrôlées par un test dans un `act` attendu
avant de vérifier l'état final. `waitFor` reste utile pour un résultat observable ;
un timeout plus long n'est pas une réparation d'une mise à jour React non attendue.

Les contrats de copie protègent une intention produit (rêve enregistré, étape
facultative, absence d'envoi implicite), pas la présence obligatoire d'une ancienne
formulation. Vérifier les tests consommateurs lorsqu'une traduction partagée change.
Les fixtures Git temporaires désactivent la maintenance automatique pour ne pas
laisser d'écritures en arrière-plan pendant leur nettoyage.

## Revue et preuve native

Une implémentation substantielle demande une revue indépendante. Une correction
mineure issue de cette revue se vérifie sur son delta ; elle ne déclenche pas
systématiquement une nouvelle revue complète. Une simple édition documentaire
se satisfait d'une relecture et d'un contrôle du diff.

Par exemple, remplacer une liste par une FlatList justifie des tests ciblés de
montage, d'édition et de suppression ainsi qu'un parcours natif pertinent. Changer
ensuite une phrase du rapport demande de vérifier la phrase contre sa preuve,
pas de relancer toute la suite mobile.

Les tests locaux, la QA sur émulateur/appareil, une pipeline CI manuelle et la
livraison restent des preuves distinctes. Un test avec fixture mémoire ne valide pas la persistance.
Une capture de l'éditeur ne prouve pas une sauvegarde. Une preuve native absente
reste à qualifier ; multiplier les tests unitaires ne la remplace pas.

Pour TalkBack sur Motorola, utiliser le [protocole court de qualification](qualification-talkback.md) : pilote de la méthode avant la recette, preuve gestuelle distincte du clavier, puis restauration vérifiée.
