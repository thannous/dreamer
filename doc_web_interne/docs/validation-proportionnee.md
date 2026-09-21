# Validation proportionnée des changements Noctalia

Cette règle s'applique à Journal, Lucid et Meditation. Le risque du comportement
modifié détermine les vérifications ; le nombre de tests n'est pas un objectif.
Les commandes disponibles restent celles des `package.json` et des guides locaux.

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

Regrouper les corrections locales et leur relecture avant le push lorsque c'est
possible. Éviter les pushes successifs pour chaque ajustement documentaire. Les
contrôles CI obligatoires restent exigés sur le dernier commit de la PR : cette
règle n'autorise ni leur contournement ni une modification implicite du pipeline.

## Avant le push : même sélection que la CI

Pour une PR fonctionnelle, de code partagé ou d'outillage, terminer le lot dans
un arbre propre et committé, puis lancer :

```sh
npm run test:prepush
```

Ce point d'entrée actualise `origin/master`, calcule le même merge-base que
CircleCI (y compris pour une PR empilée), réutilise le classificateur existant,
puis lance les types application/tests lorsque Noctalia est concernée et la
sélection Jest impactée. Les filtres manuels sont refusés. Une erreur de fetch,
un arbre non committé ou une modification de HEAD/base/arbre pendant le contrôle
invalide le résultat. Le SHA et la base contrôlés sont affichés. Cette commande qualifie les pushes
ordinaires de branche, pas une publication par tag. Les branches `release` et
`release/*` ainsi que les pipelines taggés sont refusés : suivre leur validation
complète, imposée par CircleCI.

Ce contrôle remplace une sélection finale manuelle incomplète ; ne pas lui
ajouter systématiquement `test:file`, `test:related` et la suite entière.
Les vérifications du tableau restent proportionnées : documentation interne
classée sans impact = aucun test applicatif ; une petite retouche visuelle
n'impose pas cette commande. Un module partagé de traductions peut sélectionner
beaucoup de tests, car ses consommateurs sont réellement nombreux.

Il ne s'agit pas d'un hook Git qui exécute des suites à chaque push : les agents
l'appliquent selon le risque ci-dessus. Les contrôles du site généré, Meditation,
Edge, lint et appareils restent ceux demandés par les surfaces modifiées ; ce
résultat local ne les remplace pas. En présence de travail sans rapport, utiliser
un worktree isolé, sans supprimer ni embarquer ce travail pour rendre l'arbre propre.

Pendant le développement, `npm run test:changed` utilise le merge-base avec la
référence **locale** `origin/master`. `JEST_CHANGED_SINCE=HEAD npm run test:changed`
reste disponible pour un delta non committé : un résultat sans tests après un
commit ne prouve rien sur la PR. La base explicite fournie par CircleCI reste
prioritaire.

## Après le push : vérifier la bonne révision

Regrouper les corrections et vérifier les changements de dernière minute avant
un push. Quand plusieurs tâches travaillent sur une même branche, garder un
responsable de l'intégration et signaler les nouveaux commits.

1. Relever `headRefOid` avec `gh pr view <PR> --json headRefOid`.
2. Attendre `gh pr checks <PR> --watch`.
3. Relire `gh pr view <PR> --json headRefOid,statusCheckRollup,mergeable` : le
   watcher peut avoir suivi une ancienne révision. Tous les contrôles attendus
   doivent être terminés sur la tête actuelle, sans commentaire bloquant.
4. Dans le périmètre de fusion autorisé, utiliser
   `gh pr merge <PR> --merge --match-head-commit <SHA vérifié>` pour éviter une
   fusion après un push concurrent. Une nouvelle tête nécessite son propre verdict.

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

Les tests locaux, la QA sur émulateur/appareil, la CI et la livraison restent des
preuves distinctes. Un test avec fixture mémoire ne valide pas la persistance.
Une capture de l'éditeur ne prouve pas une sauvegarde. Une preuve native absente
reste à qualifier ; multiplier les tests unitaires ne la remplace pas.

Pour TalkBack sur Motorola, utiliser le [protocole court de qualification](qualification-talkback.md) : pilote de la méthode avant la recette, preuve gestuelle distincte du clavier, puis restauration vérifiée.
