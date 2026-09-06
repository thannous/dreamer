# Noctalia — premier lot de fiabilité

## Périmètre

Lot TI-514, TI-515, TI-516 et TI-517 de [TI-513](https://linear.app/ti-max/issue/TI-513),
relu dans Linear au démarrage le 6 septembre 2026. Base `origin/master` vérifiée
après fetch : `42daad3a8d7390ce96ca8bfbc420a28de37d0c7d`.
Branche locale : `codex/noctalia-reliability-lot-a`.
Worktree persistant : `/Users/tanuki/.codex/worktrees/noctalia-ti513-lot-a/dreamer`.

Ce lot ne clôt pas l'epic ni la qualification native TI-531. Les noms publics,
identifiants natifs, prix et abonnements restent hors périmètre.
Le checkout initial et ses travaux sociaux/configuration sont préservés.
Ce registre consigne la validation locale préalable à la création de la PR.
Aucun déploiement, changement de base ou publication produit n'est inclus.

## Résultat fonctionnel et décisions

### Journal — TI-514 / TI-515

- L'état affiché est distinct de la dernière écriture durable. Une tentative
  identique après échec réécrit réellement ; les écritures sont sérialisées par
  périmètre et les résultats obsolètes ne remplacent pas les données courantes.
- Les lectures distinguent données chargées, absence et erreur. Une lecture
  échouée ne supprime aucune source et ne provoque pas un journal vide. Pour un
  compte distant, l'absence de copie locale ne prouve pas un journal distant vide.
- Les lectures invalide/« Row too big » préservent les données. Une panne du
  stockage primaire ne devient pas un faux succès dans un stockage secondaire.
  Après un succès primaire, un échec de nettoyage d'une ancienne clé ne le nie pas.
- Les reprises conservent le brouillon, l'identité de capture et l'identifiant de
  mutation. La file redevient retentable après un échec d'écriture, sans remontage
  de l'écran. Les messages de reprise sont traduits dans les six langues.
- Les comptes sont isolés dès la transition de scope : données, références,
  callbacks, erreurs, files et écritures tardives. Le retour sur un compte restaure
  aussi ses modifications retenues après échec.
- La migration invitée attribue durablement un **snapshot d'identifiants locaux**
  à son compte destinataire avant la première création distante. La reprise,
  y compris après redémarrage, ne peut pas l'envoyer à un autre compte ni inclure
  les captures invitées ajoutées ensuite. Le chemin de migration en arrière-plan
  reprend une attribution existante sans en créer une nouvelle.
- La finalisation relit l'état durable et retire seulement les éléments transférés
  qui n'ont pas changé. Elle préserve les captures et modifications ultérieures,
  ne ressuscite pas les suppressions et libère l'attribution lorsqu'il ne reste
  aucun élément attribué.

Une sauvegarde locale ne prouve pas une synchronisation cloud ; les deux garanties
restent distinctes dans les états et les messages.

### Meditation — TI-516

Les droits acquis et le catalogue ont des états, délais et reprises indépendants.
Une offre suspendue ne bloque plus le premier écran ; une réponse tardive ne
remplace pas un achat ou une restauration plus récente. Les droits déjà vérifiés
survivent à une erreur de rafraîchissement. Un droit inconnu ne devient ni un
achat inventé ni un refus confirmé, et la préférence d'univers est conservée.

Les contenus et actions payants concernés restent indisponibles tant que les
droits/offres requis ne sont pas vérifiés ; aucun prix de substitution n'est
inventé. Une configuration RevenueCat absente est une indisponibilité. Le modèle
actuel reste sans compte applicatif, avec identité RevenueCat anonyme ; les
abonnements Meditation restent désactivés.

### CI — TI-517

Une base manquante, un historique incomparable ou un échec de diff déclenche
`run_full_tests=true` et `run_changed_tests=false`. Les comparaisons valides
conservent leur sélection par surface. Une régression vérifie la transmission
des paramètres jusqu'à la continuation et l'exécution effective de tests Jest.
Ces contrôles font désormais partie du job `noctalia-quality`.

Ces décisions traduisent la marque Noctalia en comportements vérifiables :
préserver ce que la personne confie, expliquer ce qui est enregistré et permettre
une reprise compréhensible. Elles ne remplacent pas le contrat de marque TI-558.

## Validation

| Contrôle | Résultat |
| --- | --- |
| Racine : `npm run test:fast -- --runInBand --watchman=false` | 448 suites, 4 788 tests passés |
| Racine : `npm run typecheck:app` et `npm run typecheck:tests` | Passés |
| Racine : lint des fichiers TypeScript modifiés | Aucune erreur ; huit avertissements React reproduits sur la base |
| Meditation : `npm test -- --runInBand --watchman=false` | 62 suites, 591 tests passés |
| Meditation : `npm run typecheck` et `npm run lint` | Passés, aucun avertissement lint |
| CI : `bash .circleci/tests/classify-changes.test.sh` | Passé |
| CI : `bash .circleci/tests/fallback-jest.test.sh` | Passé ; fixture Jest non vide, 1 suite / 3 tests |
| CLI CircleCI : validation config et continuation | Passée localement |
| `git diff --check` | Passé |

Les régressions ont notamment reproduit avant correction : la tentative de
sauvegarde ignorée après échec, une lecture remplacée par `[]`, les droits
Meditation perdus avec le catalogue, le mauvais repli CI, le faux échec de
nettoyage web, la restauration d'un ancien snapshot modifié/supprimé et la
création de mutations dupliquées lors d'une reprise.

Les tests de stockage relisent les données après rechargement du module. Les
scénarios de concurrence utilisent des promesses contrôlées et vérifient les
écritures ainsi que l'état rendu ; ils ne se limitent pas aux compteurs d'appels.

Le contrôle initial dans le checkout original avait détecté des dépendances
absentes et un type de route généré périmé. Une installation depuis les lockfiles
dans le worktree a permis de vérifier le typecheck du code initial avant les
correctifs. Aucune modification de dépendance ou lockfile n'est incluse.
Les huit avertissements lint restants ont été reproduits par ESLint sur les
sources exactes de la base : quatre `refs` dans Journal, quatre
`set-state-in-effect` dans Recording et les hooks.

## Coordination et revue

Sol a implémenté les correctifs complexes du Journal et de Meditation ; Luna a
pris le repli CI et les adaptations mécaniques de fixtures. Le parent a décidé
l'architecture, intégré les corrections finales, adapté les textes et ajouté des
régressions. Les revues sont réalisées par des instances Sol distinctes des auteurs.

- Meditation et CI : revue indépendante acceptée, aucun finding actionnable
  restant. Le reviewer a repassé 60 tests, les types/lint Meditation, les deux
  tests CI et la validation des deux configurations CircleCI.
- Journal : revue indépendante acceptée, aucun finding actionnable restant.
  Le reviewer a exécuté 19 suites / 464 tests, puis 3 suites / 87 tests sur les
  dernières corrections, les deux typechecks et le lint final. Il a revérifié
  les SHA-256 des 44 fichiers Journal code/tests/i18n ; empreinte de leurs lignes
  triées `<sha256>  <path>` :
  `2bc6496106a1570c5205011f2cca502cea9b55731f5fe83125c3cbc985626c3a`.

[Manifeste SHA-256 des 65 fichiers de source et de tests modifiés](NOCTALIA-RELIABILITY-LOT-A-MANIFEST.json).
Il inclut les fichiers nouveaux et exclut ce registre documentaire.
Lors de la préparation de la PR, une ligne vide finale du test shell CI a été
retirée pour satisfaire le contrôle du diff indexé ; aucun comportement n'a changé. Empreinte de
l'objet JSON trié (`json.dumps(manifest, sort_keys=True)`, UTF-8) :
`50a835b22d19112a790c987a18885668e1c97f1ce4661704ade97e32cbd66860`.

## Limites et suite

La validation est locale. Aucun test sur appareil, stockage Android natif avec
gros journal, TalkBack, achat/restauration réel, cache RevenueCat hors ligne,
CI hébergée, Store ou production n'est revendiqué. L'accès aux octets illisibles
dépend de la bibliothèque native ; un export n'est pas promis sans lecture
réussie. Aucun contenu privé de rêve n'est utilisé dans les fixtures ou ce registre.

La suite est la qualification native des parcours modifiés, puis une livraison
selon l'autorisation correspondante. Les autres tickets de TI-513 restent ouverts.
