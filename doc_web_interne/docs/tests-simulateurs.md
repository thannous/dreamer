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

Sans `--ref`, la commande récupère et teste `origin/master`. Le commit testé doit
contenir la réservation Simlock de `tools/e2e/run.mjs` ; un commit plus ancien est
refusé.

Par défaut, elle joue les parcours utilisateurs (couche compte et achats simulés) sur
iPhone et sur Android : compter environ 40 minutes et 50 Go libres sur le disque.
`--suites all` ajoute la configuration production et le serveur local réel (six builds
au lieu de deux, 1 h 30 à 2 h 30 estimées). Le Mac reste éveillé tant que la commande
tourne. `--plan` affiche les étapes sans rien lancer ; `--platform ios` limite la
campagne à une plateforme. `--help` liste les options.

Avant de lancer, suivre Storage Guard comme pour toute réservation d'appareil sur le
Mac mini (`~/Projects/infra-ops/storage-guard/AGENT_RULES.md`) : scanner, déclarer la
campagne avec son budget (deux builds Release par défaut, six avec `--suites all`), puis
la clore à la fin.
La commande ne le fait pas à ta place.

La commande ne lance aucun build EAS, aucun envoi aux Stores, aucun déploiement, et ne
touche à aucun téléphone. Elle peut donc tourner sans autre accord que la demande de
test.

## Choisir selon le risque

La commande applique la [validation proportionnée](validation-proportionnee.md) au
natif ; elle ne remplace ni `verify:pr` avant un push, ni `verify:release`, ni le bug
bash en environnement simulé avant une release.

- Avant une soumission aux Stores : la commande par défaut, sur le commit exact du
  candidat. Ajouter `--suites all` quand la configuration de build (`eas.json`,
  `app.config`, variables publiques) ou le serveur (API, synchronisation, comptes) a
  changé depuis la dernière campagne complète.
- Entre deux releases, pour un changement qui touche le natif : seulement la
  plateforme ou la couche concernée, par exemple `--platform ios` pour un écran,
  `--suites backend` pour la synchronisation ou les comptes.
- Une modification de texte du rapport ou de documentation ne demande pas de relance.
  Un nouveau changement applicatif fusionné dans le candidat demande une nouvelle
  campagne sur le nouveau commit : un rapport ne vaut que pour le commit qu'il nomme.

## Ce que fait la commande

1. Elle prend le commit dans un espace de travail isolé
   (`~/Projects/.workspaces/noctalia/release-sim-<commit>`), installe les dépendances et
   TesterArmy. Le checkout principal n'est pas modifié.
2. Pour chaque plateforme et chaque couche : build Release avec le JavaScript embarqué
   et les mises à jour OTA coupées, puis reçu de build. Le build ne vise aucun appareil.
3. Chaque run réserve un simulateur iPhone ou un émulateur Android du pool Simlock du
   Mac, comme les autres agents, en attendant au plus 30 minutes s'il est pris
   (`--wait-minutes`). Il installe la Release du reçu, joue les parcours natifs
   TesterArmy avec les contrôles habituels de `tools/e2e/run.mjs` (identité du binaire
   installé, source inchangée, nettoyage), puis rend l'appareil, que Simlock remet à
   zéro. Une réservation perdue ou non rendue rend la couche non qualifiée. Voir
   [la réservation Simlock](../../tools/e2e/README.md#automatic-simlock-reservation).
   Les parcours d'une plateforme continuent pendant que l'autre plateforme compile ;
   un seul build tourne à la fois, et la couche serveur local joue ses runs l'un après
   l'autre.
4. Elle écrit `outputs/release-simulators/<date>-<commit>/rapport.md` au fil de l'eau,
   range les preuves complètes dans le dossier `e2e/` à côté et les journaux dans
   `logs/`.
5. Elle libère l'espace de travail à la fin (`--keep` le garde pour relancer le même
   commit plus vite). Si le déplacement des preuves échoue, elle conserve cet espace
   et indique le chemin des preuves dans le rapport.

Une seule campagne tourne à la fois sur le Mac ; une deuxième est refusée.

Le rapport sert de preuve : il nomme le commit, l'environnement (Mac, Xcode, appareils
loués par Simlock, versions TesterArmy), le profil de chaque couche, le résultat et les
limites. Une campagne ciblée ne qualifie que les plateformes et couches sélectionnées ;
le rapport liste aussi la couverture simulateur non exécutée. Le verdict « il ne reste
que le vrai téléphone » est réservé à une campagne complète passée.

## Les trois couches

| Couche | Build | Ce qui est vérifié | Ce qui ne l'est pas |
| --- | --- | --- | --- |
| Configuration production | Profil `production` de `eas.json`, services réels | Le build tel que publié s'ouvre ; accueil, réglages, langue et thème gardés après redémarrage, menu, page de connexion, offre Plus ouverte puis fermée, liens des widgets | Aucun compte, aucun achat, aucune analyse : ces parcours ne dépendent pas du réseau |
| Compte et achats simulés | `mock-persistent` | Les mêmes parcours avec un compte de test, plus achat, restauration avec et sans reçu, achat différé, quotas Free et Plus, retour après connexion, collection hors ligne, liens de réinitialisation refusés | Pas de vrai Store ni de vrai serveur |
| Serveur local réel | `local-backend` (app QA `com.tanuki75.noctalia.qa`) | Vrai Auth/Postgres et vraies routes en local : création hors ligne puis synchro sans doublon, invité vers compte, séparation des comptes, analyse et chat repris après coupure sans double crédit, permission micro refusée puis rendue | Réponses IA fixes (pas la qualité IA), pas la production, pas la dictée en direct |

Le détail des parcours et de leurs limites est dans la
[matrice native](../../tools/e2e/NATIVE-MATRIX.md) et le
[guide des parcours natifs](../../tools/e2e/native-journeys.md). Les parcours avec
modèle (personas), la concurrence du journal (build avec délai de 30 s), les captures
des fonds clair et sombre (`contextual-backgrounds`) et la fluidité ne font pas partie
de la campagne : ils se lancent à part, comme décrit dans
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
4. `npm run release:simulators -- --ref <ce commit>` sur le Mac mini, avec `--suites all`
   si la configuration ou le serveur a changé : tout `OK`.
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


## Reprendre une Release iPhone compatible

Le lanceur peut utiliser un checkout conservé et son reçu sans réinstaller les
packages, régénérer le projet ou recompiler. Il vérifie les empreintes applicatives,
natives et du binaire avec les contrôles du candidat ; une incompatibilité refuse
la reprise et demande un build explicite, sans déclencher un build caché.

```sh
mise exec -- npm run release:simulators -- --platform ios --suites mock \
  --reuse-workspace /chemin/du/checkout-conserve \
  --release-receipt /chemin/du/release.json \
  --budget-gb 10 --startup-budget-gb 4 --personas
```

Les nombres sont des Go décimaux et doivent correspondre au budget autorisé pour
la campagne, déclarée auparavant avec Storage Guard. Les premiers 6 Go étaient une autorisation temporaire du propriétaire, passée de
4 à 6 Go ; ce n'est pas une exigence iOS ou TesterArmy. Le 31 octobre 2026, le
propriétaire a ensuite autorisé 10 Go pour cette campagne et abaissé explicitement
la réserve globale à 50 Go dans le thread Astra, avec une seule reprise coordonnée.
Storage Guard limite ordinairement les estimations à 500 Mo et exige 50 Go libres.
Sa configuration spécifique au pool Simlock est distincte. Il journalise et protège
les preuves ; il n'interrompt ni ne nettoie automatiquement les tests.

Le lanceur surveille séparément la réserve globale et une estimation de croissance
des fichiers alloués dans les sorties de la campagne. Une écriture ou suppression
externe ne dépense ni ne rembourse ce budget. La préparation hors de ces chemins
(caches partagés, préparation du pilote) est réservée explicitement par `--startup-budget-gb`, sur la
base des observations du pool ; les caches partagés restent non attribués. Cette
estimation ne constitue pas un quota physique APFS. Le chemin exact d'un appareil
iOS explicitement loué est compté dès le démarrage ; les sorties SDK sont attribuées
au PID de notre enfant, sans compter les runs voisins. Une marge de 250 Mo au plus
précède le plafond estimé. Les modes ordinaires et reprise partagent le même verrou
de campagne pour éviter deux pilotes concurrents. Le reçu distingue les deux
mesures et référence les médias SDK conservés sur place, sans déplacer le checkout
emprunté ou ses anciennes preuves. Une pression globale sous 50 Go interrompt le run.

`--personas` sert à stabiliser une reprise : le persona existant `persona-morning`
est exécuté une fois, puis les six autres seulement si le pilote est qualifié.
Le pilote seul ne prouve que 1/7. Ce découpage n'ajoute pas de contrôle obligatoire
aux campagnes ordinaires. Sans ce flag, la reprise joue le périmètre mock standard.
