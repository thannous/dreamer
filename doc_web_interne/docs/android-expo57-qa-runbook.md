# Runbook QA Android — Expo 57 / versionCode 34

Ce document décrit la qualification Android reproductible de Noctalia après la
migration Expo 57. Il sépare strictement le téléphone Google Play du device
Test Store.

## 1. Invariants de sécurité

- Le téléphone de qualification Play ne reçoit **jamais** un APK local : pas de
  `adb install`, pas de désinstallation, pas de `pm clear`.
- L'upgrade v33 vers v34 se fait uniquement avec **Mettre à jour** dans Google
  Play, sans réinstallation.
- Les achats, restaurations et changements de compte Test Store se font sur un
  émulateur dédié, jamais sur le téléphone qui porte la preuve d'upgrade.
- Aucun email, mot de passe, identifiant ADB, token d'approbation ou clé
  `service_role` ne doit être commité.
- Les tokens d'approbation d'un scénario sensible sont fournis à la commande et
  ne sont jamais enregistrés dans un fichier `.env`.
- Le harnais d'upgrade ne lit que l'identité du package et une empreinte locale
  SHA-256 du téléphone. L'`ANDROID_ID` brut n'est ni affiché ni persisté.

## 2. Comptes QA et secrets locaux

Deux identités distinctes sont nécessaires :

1. `qa-paid` : compte Google confirmé, présent sur l'émulateur Test Store ;
2. `qa-free` : compte Supabase email/mot de passe confirmé et sans entitlement.

Le restore actuel utilise Google. Un second compte email seul ne remplace donc
pas le compte Google `qa-paid`.

Ne pas déduire `qa-paid` de l'adresse qui administre le Dashboard Supabase :
ce doit être une identité **utilisateur de l'application**, connectée par Google
sur l'émulateur et dont l'entitlement Plus est vérifié. Si cette identité n'est
pas encore connue, laisser `REVENUECAT_QA_EMAIL` vide et arrêter les scénarios
d'achat/restore au preflight ; ne pas lui substituer arbitrairement le compte
administrateur.

Créer le compte gratuit depuis le bon projet Supabase :

1. ouvrir `Authentication > Users` ;
2. choisir `Add user` ;
3. utiliser une boîte QA appartenant à l'équipe ;
4. créer l'utilisateur avec confirmation automatique ;
5. vérifier ensuite une connexion email/mot de passe dans Noctalia.

La production exige la confirmation email. Ne pas créer un compte depuis le
téléphone Play v33 : l'inscription marque l'empreinte locale comme convertie et
pollue le baseline d'upgrade.

Créer localement `.env.qa.local`, déjà couvert par `.gitignore`, puis limiter ses
permissions :

```bash
chmod 600 .env.qa.local
```

Contenu attendu pour un compte payant Google :

```dotenv
REVENUECAT_QA_AUTH=google
REVENUECAT_QA_EMAIL=<email-du-compte-google-qa-paid>
REVENUECAT_QA_SWITCH_FREE_EMAIL=<email-qa-free>
REVENUECAT_QA_SWITCH_FREE_PASSWORD=<mot-de-passe-qa-free>
```

Le dépôt et ce runbook ne fournissent volontairement aucune valeur réelle. Une
fois les identités confirmées, renseigner localement l'email Google actuellement
sélectionné sur l'émulateur et les identifiants du compte gratuit Supabase.

Si le compte payant utilise exceptionnellement email/mot de passe, ajouter
`REVENUECAT_QA_PASSWORD` et mettre `REVENUECAT_QA_AUTH=email`.

Ne jamais mettre dans ce fichier :

- `SUPABASE_SERVICE_ROLE_KEY` ;
- `REVENUECAT_QA_APPROVAL` ;
- `REVENUECAT_QA_RESTORE_APPROVAL` ;
- `REVENUECAT_QA_CLEAR_STATE_APPROVAL` ;
- `REVENUECAT_QA_SWITCH_APPROVAL` ;
- `REVENUECAT_QA_PHYSICAL_DEVICE_APPROVAL`.

Charger les valeurs pour la session courante :

```bash
set -a
. ./.env.qa.local
set +a
```

## 3. Reconnexion ADB en Wi-Fi

Le port ADB Wi-Fi peut changer. Le harnais compare une empreinte stable et non
le `host:port`, qui reste seulement une information de transport.

```bash
adb mdns services
adb connect <host>:<connect-port>
adb devices -l

export ANDROID_PLAY_DEVICE='<adb-id-courant>'
npm run android:device:physical
npm run android:play-qa-device:wait -- \
  --device "$ANDROID_PLAY_DEVICE" \
  --expected-version-code 33 \
  --require-ui-ready
```

Si l'ordinateur n'est plus appairé :

```bash
adb pair <host>:<pair-port> <pair-code>
adb connect <host>:<connect-port>
```

Le téléphone doit être réveillé, déverrouillé et visible comme `device` avant
de lancer Maestro.

## 4. Préparer le baseline Play v33

Préparation neuve, une seule fois :

```bash
export UPGRADE_SENTINEL="UPGRADE_V33_V34_$(date -u +%Y%m%d%H%M%S)"

npm run android:play-upgrade:prepare -- \
  --device "$ANDROID_PLAY_DEVICE" \
  --sentinel "$UPGRADE_SENTINEL"
```

Le scénario crée un rêve témoin, sélectionne l'affichage compact, tue et
relance l'application, puis ne sauvegarde le baseline que si les deux états
sont retrouvés.

Si une tentative s'est interrompue après la création du rêve, ne jamais relancer
une préparation neuve. Reprendre avec le token exact retrouvé dans le journal :

```bash
npm run android:play-upgrade:prepare -- \
  --device "$ANDROID_PLAY_DEVICE" \
  --resume \
  --sentinel "$UPGRADE_SENTINEL"
```

`--replace` est réservé à l'abandon explicite d'un ancien baseline ou à la
migration d'un état legacy vers le schéma avec empreinte stable :

```bash
npm run android:play-upgrade:prepare -- \
  --device "$ANDROID_PLAY_DEVICE" \
  --resume \
  --sentinel "$UPGRADE_SENTINEL" \
  --replace
```

Une réussite écrit le fichier local ignoré par Git :

`doc_web_interne/docs/android-play-upgrade-33-to-34.local.json`.

Ne pas mettre à jour le téléphone tant que ce fichier n'existe pas et que le
résumé n'affiche pas `PREPARED` avec `qualification=true`.

À ce stade, l'état doit décrire `schemaVersion=2`, la transition `33->34` et un
snapshot `before` en versionCode 33, sans snapshot `after`. Ne jamais modifier
ce JSON à la main : en cas d'interruption avant son écriture, reprendre le rêve
témoin avec `--resume`; s'il existe déjà, le préserver jusqu'à la vérification.

## 5. Vérifier l'upgrade Play v34

Attendre que le versionCode 34 soit publié sur le track Play Internal. Sur le
même téléphone, utiliser **Mettre à jour** dans Google Play, sans désinstaller.

```bash
adb connect <host>:<nouveau-connect-port>
export ANDROID_PLAY_DEVICE='<adb-id-courant>'

npm run android:play-qa-device:wait -- \
  --device "$ANDROID_PLAY_DEVICE" \
  --expected-version-code 34 \
  --require-ui-ready

npm run android:play-upgrade:verify -- \
  --device "$ANDROID_PLAY_DEVICE"
```

La preuve qualifiante exige simultanément :

- installateur `com.android.vending` ;
- même téléphone malgré un éventuel nouveau port ADB ;
- même certificat Play Signing ;
- `firstInstallTime` inchangé ;
- `lastUpdateTime` plus récent ;
- rêve témoin toujours présent ;
- préférence compacte toujours active après relance ;
- résultat `PASS` avec `qualification=true`.

Après succès, le même fichier d'état contient le snapshot `after` en
versionCode 34 et la date de vérification. Conserver ce fichier local avec les
traces Maestro jusqu'à l'enregistrement des preuves de release.

## 6. Rebuild et tests standalone

Utiliser un émulateur distinct du téléphone Play :

```bash
export ANDROID_TESTSTORE_DEVICE='<emulator-id>'
```

Profil production, notamment pour les permissions réelles :

```bash
npm run android:release:local -- \
  --profile production-apk \
  --device "$ANDROID_TESTSTORE_DEVICE" \
  --install

npm run test:e2e:release:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE"

# Guest explicite -> login qa-free -> analyse backend -> logout -> guest.
set -a
. ./.env.qa.local
set +a
npm run test:e2e:release:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE" \
  --flow maestro/release-auth-analysis.yml

# Login qa-free -> création hors ligne -> replay de la file -> effacement local
# -> reconnexion -> récupération Supabase -> logout.
npm run test:e2e:release:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE" \
  --flow maestro/release-auth-offline-sync.yml

# Gate manuelle voix réelle -> transcription -> sauvegarde -> analyse.
# Le testeur prononce exactement la phrase témoin documentée ci-dessous.
npm run test:e2e:release:voice-analysis:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE"
```

La suite Release couvre le smoke à froid, la reprise après arrière-plan et mort
du processus, les permissions microphone/notifications acceptées et refusées,
ainsi que la sauvegarde hors ligne suivie du retour réseau. Le flow authentifié
`release-auth-analysis` ajoute une preuve UI réelle de connexion, analyse,
déconnexion et retour invité. `release-auth-offline-sync` crée automatiquement
un témoin unique, exige le badge de mutation en attente, attend sa disparition,
efface toute donnée locale, puis exige que ce même témoin soit rechargé depuis
Supabase. Il se termine toujours par une déconnexion.

Le flow `release-auth-voice-analysis` est une gate manuelle : après le début de
la dictée, prononcer exactement :

> Last night I walked through a quiet forest under a bright moon, then a golden
> fox guided me to a blue door.

Le scénario n'autorise la sauvegarde que si les ancres `forest|moon` puis
`fox|door` apparaissent dans la transcription. Il exige ensuite la carte de
transcription et une interprétation réelle, puis se déconnecte. Le minuteur du
microphone seul ne constitue jamais une preuve de reconnaissance vocale.

Sur l'émulateur Android 36.5.11 testé, l'injection audio gRPC fait quitter le
processus de l'émulateur et l'audio hôte n'est pas capturé de manière fiable.
Utiliser un téléphone v34 qualifié ou une route d'injection audio préalablement
validée ; ne pas remplacer cette gate par le flow de permissions.

Le fallback serveur `/transcribe` est couvert par les tests client et Deno, mais
sa preuve runtime exige à la fois le déploiement de la fonction Edge `api` et un
nouvel APK qui contient le client mis à jour. Le fichier audio temporaire est
supprimé dans le `finally` du parcours normal, succès ou échec du fallback.

`maestro/release-analysis.yml` reste un probe invité manuel : il peut être
bloqué par un quota déjà consommé sur l'empreinte de l'émulateur. Pour la gate
reproductible, utiliser le compte `qa-free` confirmé avec quota disponible.

Profil RevenueCat Test Store :

```bash
npm run android:release:local -- \
  --profile revenuecat-teststore \
  --device "$ANDROID_TESTSTORE_DEVICE" \
  --install

npm run test:e2e:release:teststore:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE"

# Readiness + vrai paywall mensuel/annuel, sans achat ni restore.
set -a
. ./.env.qa.local
set +a
npm run test:e2e:release:teststore:paywall:local -- \
  --device "$ANDROID_TESTSTORE_DEVICE"
```

Avant les scénarios payants, ajouter/sélectionner explicitement sur cet
émulateur le compte Google `qa-paid`, vérifier que Noctalia est connectée avec
la même adresse, puis exécuter les preflights. Le compte `qa-free` reste une
identité email/mot de passe distincte et ne doit pas être ajouté comme compte
Google de l'émulateur.

Un build standalone attendu est `release`, non débogable, sans Metro, avec le
mode Test Store et les packages mensuel/annuel visibles.

Le flow paywall authentifié vérifie dans la même exécution le mode
`RevenueCat Test Store`, un probe SDK réussi avec deux packages, les sélecteurs
mensuel/annuel et les commandes réelles d'achat et de restauration. Il ne tape
jamais ces deux dernières commandes et déconnecte `qa-free` à la fin. Utiliser
ce flow lorsqu'une ancienne déconnexion place l'application sur l'écran limité
« Connexion requise », où le QA Lab n'est volontairement pas rendu.

## 7. Achat, restore et changement de compte

Toujours commencer par le preflight non destructif.

Avant toute approbation, ouvrir `Settings > Subscription QA Lab` sur l'APK
Test Store avec le compte Google déjà sélectionné :

1. vérifier le mode `RevenueCat Test Store` ;
2. lancer le probe SDK et exiger deux packages ;
3. lancer `Refresh` et noter `free / inactive` avant achat ou `plus / active`
   pour un compte déjà entitulé ;
4. si le compte est `free / inactive`, ouvrir le paywall et vérifier les offres
   mensuelle/annuelle ainsi que les boutons achat/restore, sans les toucher.

La présence du bon compte Google ne prouve pas à elle seule l'entitlement. Le
refresh RevenueCat est la source de vérité applicative ; conserver le compte
connecté entre ce contrôle et le preflight transactionnel.

### Achat mensuel

```bash
npm run test:e2e:subscription-teststore:purchase:preflight -- \
  --plan monthly \
  --device "$ANDROID_TESTSTORE_DEVICE"

REVENUECAT_QA_APPROVAL=I_APPROVE_TEST_STORE_PURCHASE \
npm run test:e2e:subscription-teststore:purchase -- \
  --plan monthly \
  --device "$ANDROID_TESTSTORE_DEVICE"
```

Rejouer la même séquence avec `--plan annual` pour la preuve annuelle.

### Restore Google

Le restore efface l'état applicatif de l'émulateur. Vérifier que le compte
Google `qa-paid` est disponible avant d'approuver :

```bash
npm run test:e2e:subscription-teststore:restore:preflight -- \
  --device "$ANDROID_TESTSTORE_DEVICE"

REVENUECAT_QA_RESTORE_APPROVAL=I_APPROVE_TEST_STORE_RESTORE \
REVENUECAT_QA_CLEAR_STATE_APPROVAL=I_APPROVE_CLEAR_NOCTALIA_APP_STATE \
npm run test:e2e:subscription-teststore:restore -- \
  --device "$ANDROID_TESTSTORE_DEVICE"
```

Ne jamais utiliser l'approbation physique sur le téléphone d'upgrade Play.

### Switch paid vers free

L'application doit être connectée comme `qa-paid` Plus avant le preflight :

```bash
npm run test:e2e:subscription-teststore:account-switch:preflight -- \
  --device "$ANDROID_TESTSTORE_DEVICE"

REVENUECAT_QA_SWITCH_APPROVAL=I_APPROVE_ACCOUNT_SWITCH_TEST \
npm run test:e2e:subscription-teststore:account-switch -- \
  --device "$ANDROID_TESTSTORE_DEVICE"
```

Le résultat attendu est un second compte explicitement `free` et `inactive`,
sans fuite de l'entitlement du compte payant.

## 8. Preuves locales

Chemins ignorés par Git :

- upgrade : `doc_web_interne/docs/android-play-upgrade-33-to-34.local.json` ;
- RevenueCat : `doc_web_interne/docs/revenuecat-qa-evidence.local.json` ;
- voix Release : `doc_web_interne/docs/android-voice-analysis-evidence.local.json` ;
- traces Maestro : `maestro-results/android/`.

Le reçu voix est écrit atomiquement uniquement après la réussite complète de
`release-auth-voice-analysis`. Il est lié au package, au versionCode, au
versionName et au SHA-256 du flow, sans identifiant ADB ni identité utilisateur.
Le runner supprime le reçu précédent dès qu'une nouvelle tentative commence :
une tentative échouée ne peut donc jamais réutiliser une ancienne preuve verte.

Exemple d'enregistrement d'une preuve :

```bash
npm run subscription:qa:evidence -- \
  --gate test_store_monthly \
  --tester qa-paid \
  --app-user-id "$REVENUECAT_APP_USER_ID" \
  --version-code 34 \
  --evidence "Test Store monthly purchase completed; plus / active; refresh completed"
```

Ne jamais inscrire l'email ou le mot de passe du testeur dans le texte de
preuve.

Pour les flows auxquels des clés `EMAIL` ou `PASSWORD` sont transmises, le
runner expurge stdout/stderr et les artefacts texte après chaque tentative. Il
supprime toutes les captures de ce flow, car un masquage fiable des pixels
n'est pas garantie. Les valeurs restent brièvement présentes dans les arguments
du processus Maestro, qui impose encore `-e` : exécuter ces flows uniquement sur
un poste QA de confiance. Un rejeu nettoie aussi les traces historiques du même
répertoire de flow avec les identifiants courants.

## 9. Gates GO / NO-GO

```bash
npm run subscription:qa:verify-local
npm run subscription:qa:report
npm run subscription:qa:release-gate
npm run android:gates:strict
npx expo install --check
npx expo-doctor
npm run typecheck:app
npm run typecheck:tests
npm run lint
npm run test:fast
```

Sur les PR, `test:fast` publie sa durée et la compare au dernier artefact réussi
de `master`. Une régression supérieure à 20 % ou une baseline absente bloque la
PR. Seul un push sur `master` peut amorcer explicitement une nouvelle baseline ;
les artefacts sont conservés 90 jours.

Le job `edge-functions` exécute également `deno check --frozen` et l'ensemble
des tests de `supabase/functions/api` avec Deno 2.7. Un lockfile incohérent ou
une régression du proxy de transcription bloque donc la PR avant une release.

Pour une qualification de release, le workflow EAS
`.eas/workflows/android-release-qualification.yml` est déclenchable manuellement
et sur les tags `v*`. Il construit le profil Android `production-apk`, puis passe
le `build_id` au job Maestro qui exécute `maestro/release-smoke.yml` sur un Pixel
6 Play Store API 35. Le smoke ne démarre pas Metro et le job ne poursuit pas si
le build échoue. Le workflow doit être publié dans le dépôt et le projet EAS lié
à GitHub avant de devenir une preuve distante.

Le GO Play exige :

- preuve physique d'upgrade 33 vers 34 qualifiante ;
- Google Sign-In, Billing et Play Integrity validés sur la v34 Play ;
- achats mensuel et annuel, restore Google et switch paid vers free validés ;
- convergence RevenueCat/backend prouvée ;
- voix réelle vers transcription, sauvegarde et analyse validée sur la v34 ;
- fonction Edge `api` déployée et fallback `/transcribe` vérifié avec un APK
  reconstruit ;
- permissions production et readiness Test Store vertes ;
- toutes les gates ci-dessus avec un code de sortie 0.

Sinon, verdict **NO-GO** avec la gate exacte et le chemin de preuve manquant.

## 10. Dépannage rapide

- Baseline absent après un échec : retrouver le rêve exact et utiliser
  `--resume`; ne pas consommer un nouveau quota invité.
- Port ADB différent : reconnecter le téléphone et passer le nouvel identifiant
  à `verify`; l'empreinte stable décide s'il s'agit du même appareil.
- `Selected ADB transport does not belong...` : mauvais appareil ou utilisateur
  Android ; ne pas contourner la vérification.
- `STALE` dans le rapport RevenueCat : rafraîchir le snapshot Store avant la
  release, sans transformer `STALE` en preuve de succès.
- Analyse distante non déterministe : utiliser un compte QA confirmé avec quota
  disponible et conserver séparément les erreurs backend des échecs UI.
- Compte email non confirmé : le recréer/confirmer depuis le Dashboard Supabase
  du bon projet ; ne jamais modifier directement `auth.users`.
- Dialogue Google Password Manager : le subflow QA gère `Never` et `Not now`.
  Une saisie IME ponctuellement rejetée est retentée une seule fois ; si la
  seconde tentative échoue, vérifier les identifiants localement et arrêter le
  test au lieu de multiplier les connexions.
