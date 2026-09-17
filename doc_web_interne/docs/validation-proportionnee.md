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
