# Noctalia — validation locale du lot B

7 septembre 2026. Branche `codex/noctalia-autonomy-lot-b`, base
`795878a76881732fd1f9c449b679839667bb2089` (PR #113 fusionnée).

## Résultat fonctionnel

- TI-518 : observations Lucid issues de ses expériences persistées ; capture et
  consultation restent dans Lucid. Le démarrage Lucid ne monte plus le pipeline
  Journal, ses hosts ou ses migrations. La déconnexion Lucid ne nettoie pas le
  cache Journal.
- Les signes et préférences Atlas historiques sont conservés avec des sources
  indisponibles explicitement signalées. Les nouveaux signes portent un espace
  d'identifiants distinct et nécessitent leur propre confirmation.
- Les identifiants de source sont bornés, déterministes et conservent séparément
  la provenance brute. Les expériences historiques à identifiant long/Unicode et
  dates limites restent exploitables, sans migration du schéma distant.
- TI-527 : carte exécutable des consommateurs partagés, contrôle des imports
  directs et sélection des deux apps pour le verrou Android partagé. Les entrées
  inconnues restent conservatrices ; le repli Jest complet TI-517 est préservé.
- TI-558 : [contrat de marque](../../../specs/noctalia-brand-contract.md), corrections
  ciblées des spécifications et guides Meditation. Aucun nom public ou tarif
  réactivé par ces corrections documentaires.

## Preuves sur l'arbre final

| Contrôle | Résultat |
| --- | --- |
| Jest complet racine, `npm test -- --runInBand --watchman=false --silent` | 452 suites, 4 825 tests réussis |
| `npm run typecheck:app` et `npm run typecheck:tests` | Réussis |
| `npm run lint` | 0 erreur, 60 avertissements ; aucun statut « préexistant » déduit sans comparaison de baseline |
| Classificateur CircleCI et fixture de repli Jest | Réussis ; fixture de verrou indépendante de la carte de consommateurs |
| `npm run boundaries:check` | Réussi, 272 fichiers source examinés |
| `npm run lucid:gates` | Tous les contrôles de configuration réussis |
| `git diff --check` | Réussi |

Les quatre tests de composition montent le vrai RootLayout et le vrai
DreamsProvider, avec espion à la frontière `useDreamJournal`. Lucid invité et
connecté déclenchent zéro pipeline/host/migration Journal ; les comparateurs
Journal conservent ces appels. Cette preuve ne mesure pas le trafic d'un appareil.

La revue indépendante Astra low conclut PASS, sans défaut restant, sur les 46 fichiers du manifeste. Elle a notamment fait corriger le bornage des sources
historiques ; sa sonde indépendante couvre 42 combinaisons d'identifiants et de
dates. Une première transformation Babel trop large avait fait échouer les tests
de stockage. La configuration finale la limite à `app/_layout.tsx` en environnement
test ; la suite complète ci-dessus a été relancée après cette correction.

Empreinte SHA-256 du manifeste JSON compact trié des 46 fichiers du changement
relu (chemin et SHA-256 par fichier, avant ajout du présent compte rendu) :
`893ef58c5da028327c2aa32647480b82ccb3264253e1b7f6799c796ff8685282`.

Le [manifeste conservé](NOCTALIA-LOT-B-REVIEW-MANIFEST.json) exclut sa propre copie
et le présent compte rendu ; son hash porte sur le JSON compact sans retour final.
Les 46 empreintes ont été revérifiées après déplacement du worktree, sans dérive.

## Preuves qui restent distinctes

Le [préflight natif du lot A](../qa/NOCTALIA-LOT-A-NATIVE-QUALIFICATION.md) a
identifié le binaire Play installé, sans établir son lien avec le SHA cible.
Aucune qualification native du lot A ou B, achat réel, validation Store, mesure
de démarrage sur appareil ou vérification réseau réelle n'est déclarée passée.
Il faut un binaire/update JS attribué au code testé, les profils propres aux apps
et le protocole partagé de verrou avant reprise de TI-531.

Ce lot est un résultat local. Les états CI hébergés, création/fusion d'une nouvelle
PR et livraison native nécessitent leurs propres preuves. Les changements de
travail préexistants du checkout principal ont été conservés.
