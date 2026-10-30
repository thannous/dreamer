# Tests sur simulateurs avant une publication

Décision de Thanh, 30 octobre 2026 : un candidat mobile se teste sur le simulateur
iPhone et l'émulateur Android du Mac mini, plus sur son iPhone. Le vrai téléphone ne
sert qu'à la [courte liste](#ce-qui-demande-encore-un-vrai-téléphone) en fin de page.

## Lancer

Sur le Mac mini, depuis un checkout qui contient ce script (le dépôt principal à jour,
ou n'importe quel espace de travail de `origin/master`) :

```sh
mise exec -- npm run release:simulators -- --ref <commit du candidat>
```

Sans `--ref`, la commande récupère et teste `origin/master`. Compter 3 à 4 heures pour
les deux plateformes et les trois couches, et 30 Go libres sur le disque. Le Mac reste
éveillé tant que la commande tourne. `--plan` affiche les étapes sans rien lancer ;
`--platform ios` ou `--suites production,mock` réduisent la campagne pour une reprise.
`--help` liste les options.

La commande ne lance aucun build EAS, aucun envoi aux Stores, aucun déploiement, et ne
touche à aucun téléphone. Elle peut donc tourner sans autre accord que la demande de
test.

## Choisir selon le risque

La commande applique la [validation proportionnée](validation-proportionnee.md) au
natif ; elle ne remplace ni `verify:pr` avant un push, ni `verify:release`, ni le bug
bash en environnement simulé avant une release.

- Avant une soumission aux Stores : la campagne complète, sur le commit exact du
  candidat. Une release réunit comptes, synchronisation, achats et configuration de
  build : c'est le cas « vérifications plus larges ».
- Entre deux releases, pour un changement qui touche le natif : seulement la couche et
  la plateforme concernées, par exemple `--suites mock --platform ios` pour un écran,
  `--suites backend` pour la synchronisation ou les comptes.
- Une modification de texte du rapport ou de documentation ne demande pas de relance.
  Un nouveau changement applicatif fusionné dans le candidat demande une nouvelle
  campagne sur le nouveau commit : un rapport ne vaut que pour le commit qu'il nomme.

## Ce que fait la commande

1. Elle prend le commit dans un espace de travail isolé
   (`~/Projects/.workspaces/noctalia/release-sim-<commit>`), installe les dépendances et
   TesterArmy. Le checkout principal n'est pas modifié.
2. Elle utilise un simulateur « Noctalia QA Simulateurs » et un émulateur
   `Noctalia_QA_Simulateurs`, qu'elle crée s'ils manquent (iPhone classique sur le
   runtime iOS le plus récent, image Google APIs arm64 la plus récente). Ils ne servent
   qu'à elle, pour ne pas gêner un autre test.
3. Pour chaque plateforme et chaque couche : build Release avec le JavaScript embarqué
   et les mises à jour OTA coupées, reçu de build, installation, puis les parcours
   natifs TesterArmy avec les contrôles habituels de `tools/e2e/run.mjs` (identité du
   binaire installé, source inchangée, nettoyage).
4. Elle écrit `outputs/release-simulators/<date>-<commit>/rapport.md` au fil de l'eau,
   range les preuves complètes dans le dossier `e2e/` à côté et les journaux dans
   `logs/`.
5. Elle libère l'espace de travail à la fin (`--keep` le garde pour relancer le même
   commit plus vite).

Une seule campagne tourne à la fois sur le Mac ; une deuxième est refusée.

Le rapport sert de preuve : il nomme le commit, l'environnement (Mac, Xcode,
simulateur, émulateur, versions TesterArmy), le profil de chaque couche, le résultat
et les limites.

## Les trois couches

| Couche | Build | Ce qui est vérifié | Ce qui ne l'est pas |
| --- | --- | --- | --- |
| Configuration production | Profil `production` de `eas.json`, services réels | Le build tel que publié s'ouvre ; accueil, réglages, langue et thème gardés après redémarrage, menu, page de connexion, offre Plus ouverte puis fermée, liens des widgets | Aucun compte, aucun achat, aucune analyse : ces parcours ne dépendent pas du réseau |
| Compte et achats simulés | `mock-persistent` | Les mêmes parcours avec un compte de test, plus achat, restauration avec et sans reçu, achat différé, quotas Free et Plus, retour après connexion, collection hors ligne, liens de réinitialisation refusés | Pas de vrai Store ni de vrai serveur |
| Serveur local réel | `local-backend` (app QA `com.tanuki75.noctalia.qa`) | Vrai Auth/Postgres et vraies routes en local : création hors ligne puis synchro sans doublon, invité vers compte, séparation des comptes, analyse et chat repris après coupure sans double crédit, permission micro refusée puis rendue | Réponses IA fixes (pas la qualité IA), pas la production, pas la dictée en direct |

Le détail des parcours et de leurs limites est dans la
[matrice native](../../tools/e2e/NATIVE-MATRIX.md) et le
[guide des parcours natifs](../../tools/e2e/native-journeys.md). Les parcours avec
modèle (personas), la concurrence du journal (build avec délai de 30 s) et la
fluidité ne font pas partie de la campagne : ils se lancent à part, comme décrit dans
le [guide TesterArmy](../../tools/e2e/README.md).

## Lire le résultat

Le rapport commence par le verdict, puis un tableau couche par plateforme : `OK`,
`ÉCHEC` ou `non lancé`, avec le nombre de parcours réussis. « Hors profil » compte les
parcours qui ne s'appliquent pas à cette couche (les achats simulés dans la couche
production, par exemple) : ce ne sont pas des réussites. Pour un échec, ouvrir le
`summary.md` du dossier indiqué, puis la page `trace.md` du test : elle montre chaque
étape et ce que l'écran affichait. Une étape de préparation en échec (build, serveur
local) est signalée avec son journal dans `logs/`.

Un parcours en échec bloque la publication jusqu'à sa correction ou une décision
explicite de Thanh.

## Ce qui demande encore un vrai téléphone

Une courte session sur le build TestFlight (et Google Play en test interne), avant la
soumission :

- App Attest : une analyse en invité sur iPhone (le simulateur n'a pas App Attest). Sur
  Android, Play Integrity demande aussi un vrai téléphone.
- Achat et restauration réels avec un compte de test Apple ou Google.
- Installation depuis TestFlight ou Google Play : signature de production, groupe
  partagé app + widget, mise à jour par-dessus la version précédente.
- Micro physique et dictée en direct.
- Fluidité ressentie sur un vrai téléphone.

Tout le reste (écrans, navigation, journal, analyse côté app, offre Plus, langues,
thèmes) est couvert par la campagne. Les widgets, l'activité en direct et la Dynamic
Island se vérifient aussi sur le simulateur (essai du 25 octobre 2026), tout comme la
reprise des données après une mise à jour : installer d'abord le build Release de la
version précédente, ajouter des données, puis installer le candidat par-dessus. Ces
deux vérifications ne font pas encore partie de la commande.

## Place dans la release

1. Préparer la version et fixer le commit candidat ([versions mobiles](MOBILE_VERSIONING.md)).
2. Bug bash en mode simulé (`npm run test:bugbash:prerelease`) : chaque anomalie confirmée
   devient un test qui échoue d'abord pour la bonne raison, puis passe après correction.
3. `npm run verify:release` sur ce commit (il rejoue aussi les tests du bug bash).
4. `npm run release:simulators -- --ref <ce commit>` sur le Mac mini : tout `OK`.
5. Builds Store et envoi TestFlight / test interne, sur le go de Thanh.
6. La courte session sur téléphone ci-dessus.
7. Soumission, sur le go de Thanh.

## Limites connues

- La couche production parle aux serveurs de production au lancement, comme une
  installation neuve : pas de compte, pas d'achat. Sur le simulateur iPhone, l'app
  met la session invité en mode dégradé faute d'App Attest, sans la demander au
  serveur : c'est attendu.
- L'APK Android est construit en local pour arm64 avec la signature de debug : il
  qualifie le code, pas l'AAB envoyé sur Google Play. La preuve exigée par
  `npm run android:gates:strict` reste la commande de la
  [checklist Android](android-release-checklist.md#parcours-de-release-testerarmy-émulateur).
- Le build iOS local n'a pas la clé RevenueCat iOS (elle vit dans EAS) : l'offre Plus
  s'affiche sans prix réels dans la couche production.
