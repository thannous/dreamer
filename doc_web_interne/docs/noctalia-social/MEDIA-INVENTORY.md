# Noctalia — inventaire média et historique CM

Dernière mise à jour : 2026-08-13.

Ce registre complète le [plan de publication](./PUBLICATION-PLAN.md) et le
[plan community manager](./community-manager/2026-08-us-europe-publication-plan.md).
Il sépare les fichiers locaux, les fichiers Drive, les contenus publiés et les
fichiers seulement candidats. Une URL de fichier Drive est conservée comme
identifiant stable même si son nom est renommé.

Le [registre vidéo par plateforme](./PLATFORM-VIDEO-INVENTORY.md) centralise
désormais, pour chaque asset trié, les URL TikTok, Instagram, X, YouTube,
Facebook et Pinterest, ainsi que le statut archive `À RATTRAPER`, `À EXCLURE`
ou `DÉJÀ PUBLIÉE`. Ce registre doit être consulté avant toute réutilisation.

## Politique de diffusion multi-plateforme — 2026-08-12

- YouTube Shorts, Facebook Reels et Pinterest conservent un seul hero quotidien.
- L'historique n'est jamais republié en masse.
- Un créneau archive progressif peut ajouter au maximum une ancienne vidéo par
  jour, après priorisation par performances, hook visuel, originalité et QA.
- Une ancienne vidéo sans preuve sur une plateforme est `À RATTRAPER`, jamais
  implicitement `DÉJÀ PUBLIÉE`.
- `POPBOT`, les variantes d'archives non validées et les assets explicitement
  exclus ne peuvent pas alimenter le créneau archive.

## Inventaire vérifié

| Source | Contenu | Quantité | État |
|---|---|---:|---|
| Local `output/video/noctalia-happy-horse-1-1-batch-3` | `01` à `10` — masters H.264/AAC, 1080×1920, 24 fps | 10 | utilisés dans le registre de publication |
| Local `output/video/noctalia-happy-horse-1-1-batch-5-sublime` | `65` à `74` — masters H.264/AAC, 1080×1920, 24 fps | 10 | séquence éditoriale / réserves |
| Drive `01_Serie_Reveil/02_Videos_1080p` | exports `NOC_REVEIL`, exports HIGGS du 05/08 et 06/08 | 28 | 25 affectés du 16 au 24/08 ; `POPBOT` exclu et 2 vidéos déjà publiques |
| Drive `03_Epic_Seedance` | exports `01` à `10` Seedance | 10 | 10 affectés du 12 au 16/08 |
| Drive `02_Rome_Ancient_Megalopolis/02_Videos_9x16` | finales Rome verticales | 4 | déjà conformes à la convention |
| Drive `02_Rome_Ancient_Megalopolis/03_Drafts_16x9` | `NIGHT_ANCIENT_ROME_MEGALOPOLIS_01_DRAFT_16x9.mp4` | 1 | brouillon, conforme et non publiable |
| Drive — inventaire Higgsfield `00_Inventory_Video_Image_Noctalia_2026` | 32 paires image/vidéo Seedance 2.5 | 32 | 2 publiques ; 30 certifiées, diffusées après les vidéos sans préfixe |
| Drive `90_Archives/2026-08-11_Magnific_Pikaso_Reconciliation` | variantes Magnific/Pikaso absentes du Drive avant audit | 35 | **ARCHIVÉES — NON PUBLIABLES SANS NOUVELLE VALIDATION** |

Les neuf masters affectés du 1er au 3 septembre ont été réconciliés le
13/08 avec leurs liens exacts dans la feuille certifiée, téléchargés puis
préflightés : neuf SHA-256 distincts, H.264 High/AAC, 720×1280, 24 fps et
15,072 s. Ils sont `PRÊTS`, pas `PROGRAMMÉS` sans preuve native.

Les fichiers Drive sont accessibles depuis le [dossier principal Noctalia](https://drive.google.com/drive/folders/1XcIaDxqf7KD-1hgZesDuNUcazIC9oxVW).

## Priorité de diffusion corrigée — 2026-08-11

Décision éditoriale : tous les fichiers commençant par `DAY_`, `SUNSET_`,
`NIGHT_` ou `AFTERGLOW_` doivent être diffusés **après** l'épuisement des
vidéos restantes sans ces préfixes. Cette règle s'applique à toutes les
familles et remplace l'ancienne priorité limitée à `AFTERGLOW`/`LUNARPUNK`.

Le contrôle live de Drive a trouvé 38 MP4 sans préfixe dans `03_Epic_Seedance`
et `01_Serie_Reveil/02_Videos_1080p`. Trois sont retirés du stock à planifier :
`POPBOT` est exclu, `WATERFALL PARADISE` et `HEAVENLY PALACE` sont déjà
publiés. Les 35 fichiers restants ont des noms et des tailles tous distincts ;
aucune taille ne correspond à celle d'un master local déjà publié. Ils sont
affectés aux créneaux du 12 au 24 août avec les quatre masters historiques déjà
programmés du 12 au 15. Les séries atmosphériques certifiées ne commencent
qu'au 25 août ; les neuf finales `_02` qui ne tiennent plus en août sont
réservées du 1er au 3 septembre.

Cette affectation éditoriale n'est pas une preuve de programmation native. Les
35 fichiers Drive restent à contrôler au préflight de leur créneau avant de
passer à `PROGRAMMÉE`, puis à `PUBLIÉE` uniquement avec une URL publique.

### Préflight Instagram consolidé — 13 au 31 août

Le 13 août, les **57 masters** affectés aux trois créneaux quotidiens du 13 au
31 août ont été récupérés depuis leur source exacte ou leur master historique
déjà référencé, puis contrôlés avec SHA-256 et `ffprobe`. Tous disposent d'un
flux vidéo H.264 vertical et d'un flux audio AAC ; leurs empreintes contrôlées
sont distinctes. Le détail fichier par fichier se trouve dans le
[calendrier community manager](./community-manager/2026-08-us-europe-publication-plan.md).

Ils sont uniquement **PRÊTS** pour la publication Instagram directe à leur
heure. Ce contrôle local ne prouve ni upload, ni programmation, ni publication.

## Réconciliation Magnific / Pikaso — 2026-08-11

Le dossier local `pikaso-creations-2026-08-11_17_27` contient 136 fichiers :
41 MP4 et 95 images. Les 41 vidéos ont été contrôlées avec `ffprobe` : elles
sont toutes lisibles, verticales, à 24 fps, avec une piste audio AAC. Le projet
Magnific `Noctalia — Semaine 1 social ads` affichait 117 assets et 39 cartes
vidéo au moment du contrôle. L'export de métadonnées Magnific n'a pas été
acheté, car il est réservé au plan Pro.

Six MP4 du téléchargement correspondaient déjà exactement, par identifiant
Magnific, aux finales Drive `18` à `23` : miroir du désert, bibliothèque
infinie, glace boréale, cité céleste, jardin du temps et montagnes de cristal.
Ils n'ont pas été dupliqués. Les **35 variantes réellement absentes** ont été
versées dans le [dossier d'archive de réconciliation](https://drive.google.com/drive/folders/19OIaHQy7joivGZTc1_lbE9ytNCWbp2tS).

Le 11 août, les 35 copies Drive ont été renommées après inspection visuelle
selon `DAY|SUNSET|AFTERGLOW|NIGHT_<THEME>_<DESCRIPTION>_<SEQUENCE>.mp4`.
Le contrôle du dossier confirme 35 noms uniques et aucun nom générique
`magnific_<identifiant>.mp4` restant. Le
[manifeste de correspondance](./MAGNIFIC-PIKASO-RECONCILIATION-2026-08-11.md)
et sa [copie Drive](https://drive.google.com/file/d/1tJIBeY6e5_FFXiQ7EkV5MF1cgpXayw1R/view?usp=drivesdk)
documentent les anciens noms, les nouveaux noms et les familles visuellement
proches. Les sources locales n'ont pas été renommées afin de conserver une
sauvegarde traçable.

Cette archive sert uniquement à éviter une perte de fichiers. Elle ne complète
pas automatiquement le stock publiable : le nom descriptif est désormais
renseigné, mais chaque variante doit encore recevoir une validation créative et
une affectation explicite au calendrier avant toute programmation. Aucun fichier
n'a été supprimé, publié ou généré lors de cette réconciliation.

## Livraison Higgsfield — 32 paires vérifiées — 2026-08-10

L'[inventaire Google Sheets vérifié](https://docs.google.com/spreadsheets/d/1rHw5WG4HVeiL-vDlV6TfSNVs5-1JW-scovcb0CZeMNk/edit)
contient 32 vidéos et 32 images, soit 32 paires dont le nom de base correspond
exactement. Le contrôle source indique pour chaque vidéo : Seedance 2.5,
15 secondes, vertical 9:16, 720p, mode Unlimited et QC paire `OK`. La livraison
est techniquement disponible, mais elle n'est pas automatiquement validée pour
publication : le CM attend le feu vert éditorial de l'utilisateur ou du
directeur créatif avant de l'affecter à un créneau.

### Contre-audit créatif du 11 août 2026

La tâche de création `019fcab8-11cb-7153-8894-2c990aef061f` a revalidé la plage
`Inventaire!A10:N41` : **32/32 paires `_02`** ont QC `OK`, et les 30 vidéos
encore disponibles ont été contrôlées localement en `720×1280`, 24 fps,
environ 15,04 secondes, avec vidéo et audio. Les deux autres vidéos du lot sont
déjà publiques : `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` et
`NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4`.

Revalidation des deux masters le 13/08 avant tout rattrapage secondaire :

| Asset exact | Fichier Drive exact | Taille | Préflight | SHA-256 |
|---|---|---:|---|---|
| `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | [Drive `1jVY-gKfLSI7-jlwkKvLfNhyUv3j8BdKq`](https://drive.google.com/file/d/1jVY-gKfLSI7-jlwkKvLfNhyUv3j8BdKq/view?usp=drivesdk) | 23 806 832 octets | H.264 High/AAC LC, 720×1280, 24 fps, 15,072 s | `d807016a05eb15619b40673880fbe12ac3432b436d753c40770ed5acb9424276` |
| `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | [Drive `1MDOfhghdgkMMMdlBc7fufdBIPBG8HrqH`](https://drive.google.com/file/d/1MDOfhghdgkMMMdlBc7fufdBIPBG8HrqH/view?usp=drivesdk) | 31 284 418 octets | H.264 High/AAC LC, 720×1280, 24 fps, 15,041667 s | `154ad8ac823cdb81bba9bfb7208551251447fd95cc66ec085a462f2332f484b2` |

Ces preuves confirment l'identité technique des masters, pas une programmation
future : l'anti-doublon par plateforme et le verdict du pilote d'archive restent
obligatoires avant toute création de ligne native.

Les fichiers `_01` repérés lors de l'exploration des dossiers Drive ne font pas
partie de cette plage source et ne sont donc **pas autorisés pour la
programmation**. Ils restent seulement des fichiers présents dans Drive tant
qu'un futur inventaire et un contrôle éditorial explicite ne les valident pas.
Le contre-audit a en outre détecté un doublon binaire exact dans cette réserve
non certifiée : `NIGHT_VOLCANOPUNK_BASALT_LAVA_01.mp4` partage le même contenu
que `DAY_LUNARPUNK_SILVER_LUNAR_02.mp4` (`MD5
e3e99df65885a9710580c92ea8025b12`). Le fichier `_01` ne doit donc jamais être
affecté comme substitution sans nouvelle QA dédiée.

Le 13/08, la QA visuelle du master certifié
`DAY_LUNARPUNK_SILVER_LUNAR_02.mp4` a révélé que ce doublon est aussi une
incohérence éditoriale : les images à 1 s, 7 s et 13 s montrent une mégalopole
volcanique parcourue de lave, incompatible avec `LUNARPUNK` et la copie lunaire.
Le fichier Drive `1jOZCgS8oRv23UehrdOF3QRKan7YJFUj4` porte le même nom et la
même taille (`29 306 847` octets) que le master local ; aucun remplacement
distinct n'est donc prouvé. Statut : **BLOQUÉ POUR NOUVELLE PROGRAMMATION**.
Les trois autres variantes LUNARPUNK contrôlées restent visuellement
cohérentes ; l'anomalie est isolée au master `DAY` à ce stade.
`POPBOT` reste strictement exclu. Le stock exploitable sans doublon de ce **lot
certifié `_02`** est donc de **29 vidéos** après exclusion éditoriale de ce
master ; ce chiffre ne compte pas les 35
vidéos sans préfixe affectées séparément après la décision éditoriale du
11 août.

Convention obligatoire pour les prochains exports :

`DAY|SUNSET|AFTERGLOW|NIGHT_<THEME>_<DESCRIPTION>_02`

L'image et la vidéo associée doivent partager exactement le même nom de base.
Les trois finales V2 ci-dessous sont les seules exceptions présentes dans ce
lot et doivent conserver leur suffixe :

- `SUNSET_AFROFUTURISM_SOLAR_CULTURAL_02_V2`
- `AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2`
- `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2`

| Thème | DAY | SUNSET | AFTERGLOW | NIGHT |
|---|---|---|---|---|
| AETHERPUNK | `DAY_AETHERPUNK_CELESTIAL_FLOATING_02` | `SUNSET_AETHERPUNK_CELESTIAL_FLOATING_02` | `AFTERGLOW_AETHERPUNK_CELESTIAL_FLOATING_02` | `NIGHT_AETHERPUNK_CELESTIAL_FLOATING_02` |
| AFROFUTURISM | `DAY_AFROFUTURISM_SOLAR_CULTURAL_02` | `SUNSET_AFROFUTURISM_SOLAR_CULTURAL_02_V2` | `AFTERGLOW_AFROFUTURISM_SOLAR_CULTURAL_02` | `NIGHT_AFROFUTURISM_SOLAR_CULTURAL_02` |
| ARCANEPUNK | `DAY_ARCANEPUNK_LUMINOUS_RUNE_02` | `SUNSET_ARCANEPUNK_LUMINOUS_RUNE_02` | `AFTERGLOW_ARCANEPUNK_LUMINOUS_RUNE_02` | `NIGHT_ARCANEPUNK_LUMINOUS_RUNE_02` |
| FROSTPUNK_CRYOPUNK | `DAY_FROSTPUNK_CRYOPUNK_ICE_AURORA_02` | `SUNSET_FROSTPUNK_CRYOPUNK_ICE_AURORA_02` | `AFTERGLOW_FROSTPUNK_CRYOPUNK_ICE_AURORA_02` | `NIGHT_FROSTPUNK_CRYOPUNK_ICE_AURORA_02` |
| LUNARPUNK | `DAY_LUNARPUNK_SILVER_LUNAR_02` | `SUNSET_LUNARPUNK_SILVER_LUNAR_02` | `AFTERGLOW_LUNARPUNK_SILVER_LUNAR_02` | `NIGHT_LUNARPUNK_SILVER_LUNAR_02` |
| NEON_NOIR | `DAY_NEON_NOIR_HOLOGRAPHIC_THRILLER_02` | `SUNSET_NEON_NOIR_HOLOGRAPHIC_THRILLER_02` | `AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2` | `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2` |
| OCEANPUNK | `DAY_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02` | `SUNSET_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02` | `AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02` | `NIGHT_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02` |
| VOLCANOPUNK | `DAY_VOLCANOPUNK_BASALT_LAVA_02` | `SUNSET_VOLCANOPUNK_BASALT_LAVA_02` | `AFTERGLOW_VOLCANOPUNK_BASALT_LAVA_02` | `NIGHT_VOLCANOPUNK_BASALT_LAVA_02` |

Pour les futures productions, réserver **15 minutes par vidéo** et lancer une
seule génération à la fois. La moyenne observée est de 10 à 12 minutes, la
fourchette habituelle de 6 à 15 minutes, avec des pointes possibles à 16 minutes.

## Historique CM et preuve de publication

L'historique complet des actions (compte, asset, légende, créneau, statut et
URL publique) reste dans le [PUBLICATION-PLAN.md](./PUBLICATION-PLAN.md). Le
dernier contrôle confirme les trois créneaux du 07/08 sur les trois réseaux :

| Créneau | Asset | TikTok | Instagram | X |
|---|---|---|---|---|
| 15:30 / 15:45 / 16:15 | WATERFALL PARADISE | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7671324629998325014) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/DbvtGKPJxGA/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2085763583296589935) |
| 19:30 / 19:45 / 20:15 | `72-raies-celestes.mp4` | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7669149752843537687) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/DbwSAdKpVFW/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2085791834949783898) |
| 22:30 / 22:45 / 23:15 | HEAVENLY PALACE | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7671325119079501059) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/DbwSKz8pk1s/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2085837133219078224) |

Les publications précédentes du 31/07 au 06/08, les lignes futures et les
contrôles anti-doublon sont documentés dans le même registre ; aucune URL
publique n'est remplacée par un simple fichier local ou une ligne programmée.

Le contrôle du 08/08 a ajouté les preuves suivantes au registre :

| Créneau | Asset | TikTok | Instagram | X |
|---|---|---|---|---|
| 15:30 / 15:45 / 16:15 | `67-atlas-vivant.mp4` | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7671723152392654102) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/DbyeDi3pDeL/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2086153435758424121) |
| 19:30 / 19:45 / 20:15 | `03-serpent.mp4` | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7669150066350820630) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/Dbye3QipcaC/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2086154222655951255) |
| 22:30 / 22:45 / 23:15 | `06-vol.mp4` | [PUBLIÉE](https://www.tiktok.com/@noctaliadreams/video/7671727826466524419) | [PUBLIÉE](https://www.instagram.com/noctaliadreams/reel/DbywSkpJx_s/) | [PUBLIÉE](https://x.com/NoctaliaDreams/status/2086199521164358059) |

Les labels natifs TikTok/X ont été activés pour ces contenus synthétiques ; les
légendes restent sans texte « AI-generated » ni `@mention`. `06-vol.mp4` est
maintenu dans la ligne éditoriale malgré la présence d'un visage, conformément
à la décision du 07/08 ; il ne doit pas être remplacé automatiquement.

Mise à jour du créneau 3 le 08/08 à 22:45 CEST : TikTok est désormais public à
`https://www.tiktok.com/@noctaliadreams/video/7671727826466524419` et Instagram
à `https://www.instagram.com/noctaliadreams/reel/DbywSkpJx_s/`. X reste
**PROGRAMMÉE** à 23:15 dans Scheduled avec `Made with AI` ; l'URL publique X
sera ajoutée après le contrôle post-diffusion.

Contrôle final du 08/08 à 23:16 CEST : les 9 lignes sont **PUBLIÉES**. L'URL
X du troisième créneau est
`https://x.com/NoctaliaDreams/status/2086199521164358059` ; elle affiche le
compte cible, la vidéo, la copie et `Made with AI`. Aucun statut ne reste
**PROGRAMMÉ** ou **EN ATTENTE** pour cette date.

## Migration des noms

| Lot | Convention actuelle | Décision |
|---|---|---|
| Rome final et draft | `NIGHT/SUNSET/AFTERGLOW/DAY_ANCIENT_ROME_MEGALOPOLIS_0N` | conforme, ne pas renommer |
| `NOC_REVEIL_S01` à `S10` | nom technique historique | proposer un nom canonique en conservant le numéro de série et le lien Drive |
| HIGGS du 05/08 et 06/08 | date + description + hash | proposer un nom canonique ; `POPBOT` reste exclu et ne doit pas être publié |
| Seedance `01` à `10` | numéro + description | proposer un nom canonique, hors calendrier actuel |
| Masters locaux `01` à `74` | noms utilisés par le pipeline et le plan | conserver les chemins locaux jusqu'à mise à jour de toutes les références |

Pour les fichiers sans ambiance explicite dans leur nom source, la proposition
est d'utiliser `DREAM` comme préfixe neutre et `NOCTALIA`/`SEEDANCE` comme type,
par exemple :

- `DREAM_REVEIL_NOCTALIA_01.mp4`
- `DREAM_CRAYON_MARKET_NOCTALIA_01.mp4`
- `DREAM_LEVITATION_SEEDANCE_01.mp4`

Cette proposition doit être confirmée avant la migration en masse : renommer
un fichier Drive est réversible et conserve normalement son identifiant, mais
change le nom affiché dans les liens et les exports. Après validation, le CM
renommera les fichiers Drive en place, alignera les images source sur le même
nom de base, puis mettra à jour ce registre et les références Markdown.

## Préflight du 09/08/2026

La cadence à trois créneaux est active, mais seul `07-horloge.mp4` est
actuellement validé dans la source de vérité pour le créneau 2. Les créneaux 1
et 3 restent **EN ATTENTE** sur les trois réseaux faute de masters distincts
validés ; aucune vidéo déjà publiée ne sera réutilisée.

| Créneau | Asset | TikTok | Instagram | X |
|---|---|---|---|---|
| 15:30 / 15:45 / 16:15 | — | **EN ATTENTE** | **EN ATTENTE** | **EN ATTENTE** |
| 19:30 / 19:45 / 20:15 | `07-horloge.mp4` | **PROGRAMMÉE** | **EN ATTENTE** jusqu'à 19:45 | **PROGRAMMÉE** |
| 22:30 / 22:45 / 23:15 | — | **EN ATTENTE** | **EN ATTENTE** | **EN ATTENTE** |
