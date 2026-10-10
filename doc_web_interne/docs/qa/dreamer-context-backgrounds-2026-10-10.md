# Dreamer : illustrations immersives — 2026-10-10

Le propriétaire demandait davantage d'immersion, puis a rejeté les peintures
sombres dans le thème clair. Chaque contexte dispose désormais d'une variante
lumineuse pour le papier et d'une peinture nocturne pour le sombre. L'ouverture
conserve les couleurs de l'image sur jusqu'à 240 points (128 en fenêtre courte
ou avec du texte agrandi). Seuls ses 40 derniers points rejoignent le fond uni
sur lequel le texte se lit. Capture et la recherche du journal retirent
l'ouverture pendant la saisie pour préserver la place du clavier.

Les images personnelles des rêves et les illustrations des symboles restent
prioritaires. Les surfaces et textes habituels de Lucid ne changent pas.
L'échec de chargement retire l'ouverture ; changer de thème peut charger
l'autre variante. Les images locales utilisent le cache mémoire afin d'éviter
la réutilisation d'une ancienne ressource Android après une mise à jour.

## Répartition et assets

| Contexte | Scène, déclinée en clair et sombre |
| --- | --- |
| Accueil sans image de rêve, callback Dreamer | Reverie |
| Capture | Capture |
| Explorer, guides et lecture des guides | Path |
| Tendances, bilan hebdomadaire, rituel lucide | Astral |
| Journal rempli, réglages, récupération du mot de passe, mémoire | Journal |
| Réflexion et dialogue sans image de rêve | Dialogue |
| Rituel « Rêver » | Ritual |
| Dictionnaire et repli de fiche symbole | Symbols |
| Plus | Observatory |
| Sons du soir, natif | Sleep |

Six nouveaux WebP nocturnes de 1536 × 1024 : **511 584 octets**.
Dix nouveaux WebP clairs, même format, qualité 82 : **1 871 242 octets**.
ImageGen intégré ; sélection déléguée à l'agent, sans prétendre à une revue
visuelle du propriétaire. Les quatre autres scènes nocturnes réutilisent les
assets existants. Prompts, sources et empreintes :
[manifeste](../../../assets/images/dreamer/generation.json).
[Catalogue](../../../constants/dreamerArtwork.ts),
[ouverture illustrée](../../../components/ui/DreamerBackground.tsx).

## Source et preuve web courantes

Source runtime : `1ffb384f0a25ce45f1127d277444bad61f21cc83`.
Les commits de compte rendu suivants ne changent pas les entrées de l'app.
Le résultat obligatoire de `npm run verify:pr` et le commit final exact sont
consignés dans la [PR #326](https://github.com/thannous/dreamer/pull/326).

Artefact local canonique, ignoré :
`tools/e2e/.e2e/dreamer-web/1791666601202-20638-ebe531ef-19c8-4728-a3b2-fe5c2a5489fc`.
Run `01a127a6-c2ef-7dc0-b97e-32ea8c45189b`.
**5/5 parcours**, code 0, sources et sorties stables.
**47 états, 634 textes**, aucun contraste sous le seuil attendu ; minimum
**5,09:1**. Les pixels derrière le texte sont mesurés après masquage temporaire
de son encre, en excluant le contenu coupé, recouvert ou désactivé : 4,5:1
pour le texte courant, 3:1 pour le grand texte.

Le contrôle d'immersion compare la zone visible de Capture à l'image décodée
dans un canvas ; le voile ancien échoue au seuil de 8/255 par canal. Toutes les
scènes vérifient également une image lumineuse en clair (moyenne RGB pondérée
supérieure à 0,55), nocturne en sombre (inférieure à 0,5). Ces parcours couvrent
la saisie, la recherche, les actions du journal et de la réflexion, les rituels,
les fenêtres de 320 et 1440 pixels et le repli après échec de chargement.

```sh
E2E_WEB_LOCALE=fr-FR E2E_WEB_PORT=8106 mise exec -- npm run test:testerarmy -- run --grep 'contextual backgrounds'
```

TesterArmy `e2e 0.18.0`, web `0.13.0`, Playwright `1.63.0`, Node `24.19.0`,
un worker, français, services simulés, mouvement réduit et réseau externe bloqué.
Les fixtures Jest simulent le composant raster pour éviter les vues natives
Expo ; leurs assertions métier restent inchangées. Les tests du moteur utilisent
les chemins canoniques macOS pour `/var` et `/private/var` : les refus de liens
étrangers et de shells du dépôt restent en place. Aucun contrôle de livraison
n'est contourné.

## Motorola : Release locale courante

Source runtime identique à la preuve web. Sur le Motorola edge 60 fusion,
**1/1 parcours passé**, **26 captures** : 11 écrans dans les deux thèmes,
la saisie avec clavier et l'accès aux durées des sons du soir. Les assertions
de thème, de brouillon vide, d'écrans et de contrôles visibles passent.
Run `01a127aa-626d-77b9-ad5e-31606eda6385`, **141,42 s**, SDK code 0.
Les pixels réels de Capture passent : moyenne RGB pondérée **0,814 en clair**
et **0,083 en sombre**. Sources, tests et config restent stables ; l'APK installé
avant et après correspond au reçu. `qualification-day-variants-cache/end.json`
conclut `qualified: true`.

Racine locale : `tools/e2e/.e2e/motorola-backgrounds-20261010/`.
Matrice : `matrix-day-variants-cache/`, avec rapport JSON, JUnit et captures.
Relance exacte : `rerun-day-variants-cache.txt` depuis cette racine ; son suffixe
distinct conserve les preuves précédentes. Le SDK est `e2e 0.18.0`, mobile
`0.10.0`, agent-device `0.21.22`, Node `24.19.0`. Le journal rempli et la
réflexion sont parcourus sur le web simulé, sans manipuler un rêve personnel
sur le téléphone.

Un contrôle complémentaire impose un **défilement réel** des sons du soir :
le contrôle de durée passe de y=2388 à y=1525 dans les deux thèmes, puis le
bouton de lecture devient visible sans le déclencher. **1/1 passé**, **4 captures**,
**39,27 s**, run `01a127ae-49c4-7eb3-8e5f-af83db268849`.
Le fond de la barre d'état reste identique avant/après (écart maximal 0/255
par canal), clair ou sombre selon le thème. Le thème Dynamic est restauré.
Artefacts : `matrix-day-variants-scroll/` et
`qualification-day-variants-scroll/end.json` (`qualified: true`).
La relance utilise la même commande de verrou, avec `node qualify-scroll.mjs`
et un suffixe `E2E_REPLAY_SUFFIX` neuf. **30 captures natives au total**.
Les images nommées `sleep-scrolled` de la première matrice prouvent seulement
l'accès au contrôle déjà visible ; le déplacement est établi par ce complément.

- APK : `22bf4b1c499f8e5a83dffe1b4d1b0e2ff601d213cb207a5d948cfe66ebc2f57c`.
- Certificat : `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Entrées app : `a2862278e8caaa89fe554937d8f941e32c012ce890c633548e06c7bbb42ff495`.
- Entrées Android : `870053072fd31ef0ea3f8eb406afb57d92437a0a69f6c0d8e0acce99a4a072b1`.
- Reçu, APK et log : `tools/e2e/.e2e/motorola-backgrounds-20261010/build-day-variants-cache/`.

Le profil est `production-apk --side-by-side-qa`, arm64, **3.5.0 (83)**,
`com.tanuki75.noctalia.qa`, non debuggable, OTA désactivées. La signature est
identique au QA existant ; `adb install -r` préserve ses données. L'app principale
n'est ni réinstallée ni effacée. Le flag sons du soir est activé uniquement pour
ce build QA. La campagne commence par `app.open()`, utilise un seul worker sous
le verrou physique Dreamer et restaure le thème Dynamic en fin de parcours.

```sh
JAVA_HOME=/Users/timax/.local/share/mise/installs/java/temurin-17.0.20+101 \
ANDROID_HOME=/Users/timax/Library/Android/sdk \
EXPO_OFFLINE=1 EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false \
EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED=true \
mise exec -- npm run android:release:local -- --side-by-side-qa --reuse-native-project --abi arm64-v8a
```

Checkout isolé : `/private/tmp/noctalia-backgrounds-native-20261010`.
Expo 58.0.6, React Native 0.88.0-rc.3, Java 17.0.20.1, Gradle 9.4.1,
Build Tools 37.0.0, targetSdk 36. Build passé en **2 min 20 s**.
Les logs et captures privés restent ignorés.
Ce profil local ne qualifie pas Play/Store, les paiements, le backend ou la
lecture audio. Le ratio numérique de contraste reste une mesure web.

## Défauts reproduits et preuves historiques

La première matrice native avec les variantes claires (`eaf864b24`) a réussi
ses assertions de navigation, mais l'inspection des captures a montré une
ancienne peinture nocturne derrière le papier. Le contrôle des pixels reproduit
ce défaut : moyenne **0,142**, sous le seuil clair **0,55**. Cette exécution ne
qualifie donc pas les images, malgré le résultat SDK de navigation passé.
Son artefact est `tools/e2e/.e2e/motorola-backgrounds-20261010/matrix-day-variants/`,
avec le diagnostic `qualification-day-variants/observed-painting-pixels.json`.
Le code installé d'Expo Image explique le cache persistant par identifiant
numérique de ressource et version Android ; la correction limite ces peintures
locales au cache mémoire. Aucun reset de données ni changement de compteur.

L'ouverture immersive précédente (`68f696959`) avait 26 captures Motorola et
5 parcours web passés, avec protection de la barre d'état pendant le défilement
et du bouton d'enregistrement pendant la saisie. Ses images sombres en clair
ont été rejetées : ses captures ne qualifient pas les nouvelles variantes.
Le voile initial (`832df312`) avait 34 captures iOS, Release QA 3.5.0 (11),
données simulées ; le réglage suivant (`5932e59da`) avait 20 captures Motorola.
Ces preuves restent historiques.

Le pilote web `1791664896202-81033-ff907f4e-42cd-4f55-b7c5-5c391ab127a9`
a reproduit l'absence de peinture dans le journal mobile (3/5) ; la condition
de rendu a été corrigée. Les diagnostics initiaux de JDK et de format `V2 Signer`
restent dans `build-immersive/`. La préparation des variantes claires a également
refusé un chemin de log inexistant avant toute installation ; le chemin corrigé
est conservé dans le script local de campagne. Ces diagnostics ne sont pas
présentés comme des résultats fonctionnels.
