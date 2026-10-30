# PR #633 — qualification native et corrections, 2026-10-30

La [PR #633](https://github.com/thannous/dreamer/pull/633) a été fusionnée le
2026-10-29 au commit `516bf9fc9959c83bb15c74c38addbb4bdc4660cc` pendant cette
campagne. Cette livraison de suivi corrige deux blocages observés pendant sa
qualification ; elle ne constitue ni une publication ni une validation Store.

## Corrections

- Après « Later », le sceau anime déjà l’arrivée du rêve sauvegardé. Le fade
  supplémentaire du Stack iOS bloquait le premier appui sur « Back to journal »,
  alors que le bouton était visible. Cette arrivée est désormais instantanée ;
  les ouvertures ordinaires du détail gardent leur comportement.
- Le détail de collection est un Modal plein écran. Sur iPhone Duo fermé, Close
  était dans la colonne système de droite et ouvrait le Centre de contrôle.
  Le contenu et Close respectent maintenant les gouttières latérales existantes,
  sans réduire le scrim. Les gouttières nulles restent sans effet.

## Identité et résultats

Code applicatif construit : `59f6947d93a69fe6eb66cd4f616bdfdaac14116b`.
Derniers parcours exécutés : `490d5673f6647891d7f5043fc97c4d3214e65e6a`.
Ce dernier commit ne change que le ciblage du test : attendre le détail plutôt
que le titre présent deux fois sur Android pendant le sceau. Les deux binaires
Release précédents sont réutilisés ; le garde confirme les entrées applicatives
et natives inchangées, les sources propres/stables et l’identité installée.

| Cible QA | Release | Parcours | Résultat |
| --- | --- | --- | --- |
| iPhone Duo fermé, Simulator iOS 27.1, arm64 | Dreamer 3.7.1 (14), OTA désactivée | En ligne | 1/1 passé |
| `SkillCodex_E2E`, Android API 37, arm64-v8a | Dreamer 3.7.1 (83), OTA désactivée | En ligne ; hors ligne à cache froid | 2/2 passés |

Profil `mock-persistent`, audio simulé, fiches d’onboarding désactivées,
catégorisation sans délai. Un seul worker par appareil ; chaque parcours commence
par `app.open()`. Les données des autres applications sont préservées.

Assertions : sauvegarde d’un texte synthétique, lecture du texte sauvegardé,
un seul appui ordinaire sur « Back to journal », arrivée au journal, collection
à une carte sur 43, révélation Bronze, Close dans les limites utiles, fermeture
effective du détail, disparition de « nouvelle carte », réouverture sans nouvelle
révélation. Les captures sont inspectées pour les pixels de l’illustration.
Les captures immédiates peuvent précéder la fin des animations d’entrée du texte ;
ce parcours ne qualifie pas toutes les copies du détail.

Sur Android, le second parcours active le mode avion avant l’entrée dans la
collection. Le SDK coupe également Wi-Fi et réseau cellulaire. État initial
restauré : avion désactivé, Wi-Fi et Bluetooth activés. Les propriétés temporaires
de journalisation image sont aussi restaurées. Les deux runners terminent avec
`applicationQualified: true`, nettoyage complet et verrou libéré.

## Preuve des images

Pour Night Journal, le fichier CDN attendu fait 115 360 octets, 720 × 720,
SHA-256 `18b56f3d95e804a2f8e69e36f3828c9f99cee1c96a28e78f95e7868d70f5ea94`.
Le cache iOS final contient ce fichier exact. Sur Android en ligne, la trace Glide
identifie cette URL, récupère les 115 360 octets, décode la source WebP 720 × 720
puis la recharge depuis le disque lors de la réouverture.

Sur Android hors ligne, un nouveau processus ne décode aucune source 720 × 720 ;
la tentative CDN échoue en `UnknownHostException`. La ressource locale
`drawable/assets_images_badges_app_nightjournalsmall` (`0x7f08007e`) est chargée.
L’entrée APK `res/ks.webp` correspond octet pour octet au WebP embarqué de
320 × 320, 30 150 octets, SHA-256
`7e6df92c78c8b305e151bc28ed62f18903162b9d4af4728ced8246ec784d74ae`.
L’illustration reste visible à la révélation et à la réouverture. La source CDN
complète n’est pas embarquée dans l’APK.

La vérification R2/CDN antérieure des 15 objets reste une preuve distincte :
[reçu publié](../../../assets/remote/app-media-verification.json).
Le parcours natif présent couvre l’illustration Night Journal représentative.

## Reçus canoniques

Chemins relatifs au workspace de qualification, sans copie des médias :

- Release iOS : `tools/e2e/.e2e/dreamer-ios/1793322255858-17950-4ff2cb32-bee8-4c84-9def-a902cf8721ff/release.json`.
  Empreinte du bundle archivé : `bc72aa30f8a3ee434296eea78be43053dd68a0aa8f18e7363ce44d9f72c11fa3`.
- Parcours iOS final : `tools/e2e/.e2e/dreamer-ios/1793324978756-40672-8c162d98-d783-46bb-ac85-7c6762563c5b/`.
- Release Android : `tools/e2e/.e2e/dreamer-android/1793323534414-35039-b1b2fee5-20e2-46f1-b3d1-4c284b2aeb09/release.json`.
  SHA-256 APK : `58f53d7797b11896ef72b9240c0ff4cc4a779fb6d509542a4ebd8e3b8dc84501`.
- Parcours Android final : `tools/e2e/.e2e/dreamer-android/1793324689865-39463-072b3b00-e7ae-4023-b34f-37150c412c24/`.

Dans le checkout canonique, `outputs/pr633-native-fix-20261030/receipt.json`
référence le workspace, les audits du cache/APK, la trace image Android, les échecs
conservés, le nettoyage et la preuve `verify:pr` du commit finalement livré.

## Relance ciblée

Depuis le workspace conservé, remplacer `DEVICE` par la cible QA réservée et
`RELEASE_JSON` par le reçu identifié ci-dessus :

```sh
E2E_DEVICE=DEVICE E2E_RELEASE_RECEIPT=RELEASE_JSON \
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false \
mise exec -- node tools/e2e/run.mjs dreamer ios run --tag pr633-collection

E2E_DEVICE=emulator-5554 E2E_AVD_NAME=SkillCodex_E2E \
E2E_RELEASE_RECEIPT=RELEASE_JSON \
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false \
mise exec -- node tools/e2e/run.mjs dreamer android run --install-release --tag pr633-collection
```

Versions effectives : Node 24.22.1, e2e 0.21.3, mobile 0.12.4, web 0.15.3,
agent-device 0.21.35. Le correctif compatible du pilote est épinglé dans le package,
son override et les gardes ; les contrôles obligatoires restent actifs.
Typecheck des tests passé ; gardes de qualification 27/27 ; lint ciblé sans erreur
(cinq avertissements préexistants dans le layout). Revue indépendante du delta
fonctionnel : aucun défaut bloquant. `verify:pr` a passé sur le code construit ;
le résultat sur le commit livré est consigné dans la PR et le reçu canonique.

## Limites et conservation

Qualification locale de Simulator/émulateur, services simulés et OTA désactivée.
Aucune équivalence affirmée avec un appareil physique, une version Play/TestFlight,
un compte réel, le backend de production ou les autres configurations Duo.
Les échecs antérieurs restent des échecs historiques ; ils ne sont pas requalifiés.

Budget autorisé : 20 Gio temporaires, une plateforme à la fois, réserve libre
ponctuelle de 60 Go. La politique globale reste inchangée. Les nouveaux
intermédiaires de build sont nettoyés après archivage des Releases ; reçus,
logs utiles, captures canoniques et sources natives nécessaires sont conservés.
