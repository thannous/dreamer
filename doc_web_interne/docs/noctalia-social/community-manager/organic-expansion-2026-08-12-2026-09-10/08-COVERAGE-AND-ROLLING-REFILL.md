# Couverture et remplissage roulant

Dernier contrôle documentaire : **14 août 2026, 00:15 Europe/Paris**.
Ce document ne transforme jamais un statut `PRÊT` en `PROGRAMMÉ` et ne remplace
pas les preuves natives consignées dans le calendrier principal et le journal
d'exécution.

## Couverture prouvée

| Canal | Cadence | Couverture native actuellement prouvée | Dette suivante |
|---|---|---|---|
| TikTok `@noctaliadreams` | 15:30, 19:30, 22:30 | **50/84 lignes exactes** programmées ou publiées, sans trou, jusqu'au **30/08 à 19:30** ; C1 et C2 du 30/08 ont chacun une ligne native unique vérifiée | **34 lignes** à remplir dans l'ordre : 30/08 C3, puis les trois créneaux quotidiens du 31/08 au 10/09 |
| Instagram `@noctaliadreams` | 15:45, 19:45, 22:45 | **81/84 lignes couvertes** par une preuve `PUBLIÉE` ou `PRÊT — DIRECT` ; les 3 lignes Instagram du **14/08** restent explicitement `ÉCHEC — NON PUBLIÉ` et ne sont pas comptées comme couvertes ; les lignes futures conservées en `PRÊT — DIRECT` ne valent pas preuve publique avant leur heure | **3 lignes** à rattraper d'abord (14/08), puis publier chaque ligne échue et vérifier son URL publique |
| X `@NoctaliaDreams` | 16:15, 20:15, 23:15 | **84/84 lignes exactes** programmées ou publiées ; **file complète jusqu'au 10/09 à 23:15**, les trois lignes du 10/09 ayant chacune une occurrence unique vérifiée | **0 ligne restante** dans le programme courant ; contrôler les URL publiques après chaque envoi |
| Pinterest `@noctaliadreams` | Hero à 17:30 | **10/28 heroes exacts** programmés du **14 au 23/08** ; hero du 13/08 public | **18 heroes** du 24/08 au 10/09 prêts ; file native pleine |
| YouTube `Noctalia` | Hero à 18:00 | **18/28 heroes exacts** programmés dans la fenêtre jusqu'au **01/09** ; la ligne du 30/08 utilise encore l'ancien master `DAY_LUNARPUNK…` bloqué QA | **10 actions** : remplacer le 30/08 à 18:00 par `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4`, puis programmer les 9 heroes du 02 au 10/09 ; limite quotidienne d'upload rencontrée |
| Facebook `Noctalia` | Hero à 18:15 | **28/28 heroes exacts** programmés jusqu'au **10/09** ; le média et la copie du 30/08 ont été remplacés dans la même ligne native ID `1808499846845426` et l'aperçu 10 s a été vérifié | Dette hero `0/28 = 0 %` ; conserver le pilote archive déjà programmé et mesurer séparément ses résultats |

Les heroes du **04 au 10 septembre** sont désormais couverts par sept masters
Magnific/Pikaso distincts, validés explicitement par le propriétaire le 13 août
après QA technique et visuelle locale. Les sept masters HERO ont leurs liens
Drive exacts et leurs SHA-256 dans les sources de vérité. Les quatorze autres
masters du calendrier principal sont validés localement avec SHA-256, mais
restent absents de Drive : le connecteur a refusé leur téléversement avant
transfert faute d'autorisation littérale portant sur les fichiers et le dossier
partagé. Le déficit d'asset est donc résolu localement ;
la dette restante est la programmation native de YouTube et Pinterest, ainsi
que la collecte des URL publiques Facebook après diffusion, sans publication
anticipée. Les archives conditionnelles restent
une file séparée et ne remplacent jamais ces heroes.

La file ARCHIVE prioritaire est maintenant exécutable sans substitution : carte
pilote `68-prairie`, réserve no 2 `06-vol`, puis cartes Neon Noir, Aetherpunk,
`03-serpent` et `73-cavernes`. Les deux dernières ont été réordonnées selon
leurs signaux publics prouvés. Toutes restent conditionnelles aux mesures du
pilote et à une cadence HERO saine ; seule la ligne Facebook du pilote est
actuellement `PROGRAMMÉE`.

## Ordre de remplissage obligatoire

### TikTok

Chaque publication arrivée à échéance libère normalement une place dans la
file de trente. Après contrôle natif de la place, remplir strictement la
prochaine ligne chronologique :

| Place libérée après | Prochaine ligne à programmer |
|---|---|
| 13/08 à 15:30 | **TRAITÉ** — 29/08 C3 `NIGHT_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4`, [ligne native vérifiée](https://www.tiktok.com/@noctaliadreams/video/7673524915017878807) |
| 13/08 à 19:30 | **TRAITÉ** — 30/08 C1 `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4`, [ligne native vérifiée](https://www.tiktok.com/@noctaliadreams/video/7673607555146403094), 30/08 à 15:30, label IA actif et `Brouillons 0` |
| 13/08 à 22:30 | **TRAITÉ** — 30/08 C2 `SUNSET_LUNARPUNK_SILVER_LUNAR_02.mp4`, [ligne native vérifiée](https://www.tiktok.com/@noctaliadreams/video/7673617553012395286), 30/08 à 19:30, label IA actif et `Brouillons 0` |
| Prochaine capacité réelle | 30/08 C3 — `AFTERGLOW_LUNARPUNK_SILVER_LUNAR_02.mp4`, **PRÊT — NON PROGRAMMÉ**, QA technique et visuelle conforme |

Continuer ensuite ligne par ligne, sans sauter de date. Une place supposée
libre n'est pas une preuve : compte, fichier exact, date, heure, légende, label
IA et absence de doublon doivent être vérifiés avant le clic final.

### Historique récent et file exacte TikTok jusqu'au 3 septembre

Les seize masters sont disponibles localement dans des dossiers durables et
leur SHA-256 a été reconfirmé le 13 août. Les trois premières lignes sont déjà
traitées comme indiqué dans le tableau précédent ; seules les treize lignes à
partir du 30/08 C3 constituent encore la dette. Ce tableau prépare l'action ;
il ne prouve aucune place libre ni aucune programmation native supplémentaire.

Après ces treize lignes, poursuivre sans saut avec les **21 lignes affectées du
04 au 10/09** dans `38-MAIN-CALENDAR-GAP-2026-09-04-10.md` et les fiches
`39` à `45`. Ces 21 masters distincts sont tous préflightés localement avec
SHA-256, décodage intégral et inspection multi-images au 14/08. Ils restent
`AFFECTÉ — PRÊT, NON PROGRAMMÉ` jusqu'à preuve dans la file native TikTok.

| Ligne à ajouter après libération | Master local exact | SHA-256 et technique | Légende exacte |
|---|---|---|---|
| 29/08 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-29/NIGHT_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | `86b4f8f95feee077a5558f48ff65ffe08af4caa97c3ca3fddd04a695ada1fbfc` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At night, the aurora becomes the city's sky. Would you cross the ice? #Noctalia #Dreamscape #SurrealDreams` |
| 30/08 à 15:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-30/AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | `229d1f545586ccaa51e363af5fdb100d8e45906892c5b8bdfe08b9509527ced0` ; H.264/AAC, 720×1280, 24 fps, 10 s ; contrôle visuel 1/5/9 s et décodage intégral OK | `A world of flowers opens between two planets. Would you fly through it? #Noctalia #Dreamscape #SurrealDreams` |
| 30/08 à 19:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-30/SUNSET_LUNARPUNK_SILVER_LUNAR_02.mp4` | `9c0695859f64fcebab4ca81cf2fa43a7ab05bdb5b033c83d0af02c9b2533ded8` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Sunset reaches a city built from moonlight. Would you follow its glow? #Noctalia #Dreamscape #SurrealDreams` |
| 30/08 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-30/AFTERGLOW_LUNARPUNK_SILVER_LUNAR_02.mp4` | `ef6fdf9d71209e805ec30cc6ef93a5e43d157ee3d5ebfd50855e454cb01dffbb` ; H.264/AAC, 720×1280, 24 fps, 15,041667 s | `Afterglow drifts across a lunar skyline. Would you follow the silver light? #Noctalia #Dreamscape #SurrealDreams` |
| 31/08 à 15:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-31/NIGHT_LUNARPUNK_SILVER_LUNAR_02.mp4` | `d65f0481298a929bef30e906cf3ad94b84df90a391699eb074ea0ac19f535f2a` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At night, the lunar city shines like a memory. Would you stay until dawn? #Noctalia #Dreamscape #SurrealDreams` |
| 31/08 à 19:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-31/DAY_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | `163816650056b9729c81a8e8ed4bb018ac2796e9544b02b777869151412b449d` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Rain turns the city into a hologram. Which light would you follow? #Noctalia #Dreamscape #SurrealDreams` |
| 31/08 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-31/SUNSET_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | `6cd3ce7b4fc049fe4669c2abcf6bc30d4e035eea17e1d6bf1c9a232e0da56ea0` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At sunset, every neon sign tells a different story. Which one would you enter? #Noctalia #Dreamscape #SurrealDreams` |
| 01/09 à 15:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-01/AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | `19ac02ec8267f1e7a94771fb694848078f23a6c3628fce4f36046327edd287f7` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Afterglow turns a rainy city into a hologram. Which light would you follow? #Noctalia #Dreamscape #SurrealDreams` |
| 01/09 à 19:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-01/DAY_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | `695386c3dba29962ad0c6a5c4d2d469bf101abf916540beacb8b9e6694bd9964` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `A city glows beneath an endless ocean. Would you dive toward it? #Noctalia #Dreamscape #SurrealDreams` |
| 01/09 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-01/SUNSET_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | `c1ece3d12b57403bc9929f4ca05873985dc2b4c4df1095df774177c5c7a64d42` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Sunset reaches the city beneath the waves. Would you follow its glow? #Noctalia #Dreamscape #SurrealDreams` |
| 02/09 à 15:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-02/AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | `eec6f5ca4f6137ed378a085fc34a31945287f0a0251811c95cbc91fa8d1b9ea4` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Afterglow drifts through a bioluminescent city. Would you swim closer? #Noctalia #Dreamscape #SurrealDreams` |
| 02/09 à 19:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-02/NIGHT_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | `3acae9b424a965f665a0bcce2a9379bdbae02f45c330fb18656ed8530e0c2ebe` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At night, the abyss becomes a city of stars. Would you enter it? #Noctalia #Dreamscape #SurrealDreams` |
| 02/09 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-02/DAY_VOLCANOPUNK_BASALT_LAVA_02.mp4` | `ef9c1ac097e13be5e1fe90bfd5a0e271db66b4701d33049eac07fc3f708b8dce` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `A city of basalt rises between rivers of fire. Would you cross it? #Noctalia #Dreamscape #SurrealDreams` |
| 03/09 à 15:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-03/SUNSET_VOLCANOPUNK_BASALT_LAVA_02.mp4` | `fa0e240c151bfacba0cdec6a55c62d2e46e8936d12f8a686d9df5193d6ee92bc` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At sunset, a city burns without turning to ash. Would you explore it? #Noctalia #Dreamscape #SurrealDreams` |
| 03/09 à 19:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-03/AFTERGLOW_VOLCANOPUNK_BASALT_LAVA_02.mp4` | `f6b70f6838e98d352ea088515bd4274d190aea79247c5f2c45e4fb144ccebcad` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `Afterglow flows through a city of stone and fire. Which road would you take? #Noctalia #Dreamscape #SurrealDreams` |
| 03/09 à 22:30 | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-09-03/NIGHT_VOLCANOPUNK_BASALT_LAVA_02.mp4` | `f499309d043ec7d4b824a815b0e6d79c677854b21ad4808f8bf0eb1e301f9434` ; H.264/AAC, 720×1280, 24 fps, 15,072 s | `At night, lava becomes the city's only light. Would you follow it? #Noctalia #Dreamscape #SurrealDreams` |

Au moment d'agir : vérifier `@noctaliadreams`, la date, l'heure, l'aperçu,
le label IA, `Brouillons 0`, l'absence de doublon et la présence de la ligne
dans la file après validation. Si la capacité reste pleine, conserver `PRÊT`.

### Pinterest

À la publication du Pin hero du jour, utiliser la place libérée pour le
**prochain hero**, en commençant par le 24/08. Le hero du 23/08 est déjà
programmé et ne doit pas être réimporté. Le pilote archive
`68-prairie-des-lanternes.mp4` reste prêt mais ne passe jamais devant un hero.

Dernière ligne déjà vérifiée dans la file native :

| Date et heure | Compte | Master exact et SHA-256 | Package exact | Statut |
|---|---|---|---|---|
| 23/08 à 17:30 Paris | `@noctaliadreams` | `/Users/tanuki/Documents/dreamer/output/video/noctalia-social-execution-2026-08-23/NOC_REVEIL_S05_VIDEO_1080p_v01.mp4` ; `fbb15f710eb8cd382791928778f68f0bc993326131802e6b3ba90d5f8a149e0d` | Titre `Dream Journal Prompt: Ask the Forest One Question` ; description `Review your dream journal after seven days, then write one question you would ask this dream forest. Save the prompt for tonight. #Noctalia` ; tableau `Dream Journal Prompts` ; destination `https://noctalia.app/?utm_source=pinterest&utm_medium=organic_social&utm_campaign=organic_expansion_2026_08_12&utm_content=2026_08_23_noc_reveil_s05_format_b` ; label IA natif séparé | **PROGRAMMÉ — file native vérifiée le 13/08 pour le 23/08 à 17:30** ; ligne native `3764940141052504576` |

La destination a répondu en HTTP `200` le 13/08. Le brouillon natif exact évite
un nouvel upload, mais ne prouve ni la programmation du Pin ni sa publication.

La prochaine ligne à injecter est donc le hero du **24/08 à 17:30**, puis les
neuf autres packages jusqu'au 02/09. Les dix packages du 24/08 au 02/09 sont finalisés dans
`12-PINTEREST-ROLLING-PACKAGES-2026-08-24-09-02.md`. Leurs destinations ont
répondu en HTTP `200` le 13/08. Ils restent tous **PRÊTS — NON PROGRAMMÉS** et
doivent être injectés un par un, après le 23/08, sans dépasser la capacité
native.

Le package du 03/09 et les sept packages du 04 au 10/09 sont complets dans
`09-HERO-PACKAGES-2026-09-04-10.md` : master, SHA-256, titre, description,
tableau et destination UTM exacte. Leurs huit destinations ont répondu en HTTP
`200` le 13/08. Ainsi, la dette Pinterest du 24/08 au 10/09 est entièrement
préparée ; seule sa programmation native roulante reste à exécuter.

### YouTube

La file native de la chaîne exacte `Noctalia` a été relue le 13/08 à 12:17 :
elle contient toujours 21 Shorts et s'arrête au 01/09. La dernière tentative
unique a rencontré la limite quotidienne le 13/08 à 10:32–10:35 ; aucune nouvelle
tentative ne doit être effectuée avant le **14/08 après 10:35 CEST**.

Après réouverture de la capacité d'upload, remplacer d'abord la ligne erronée
du **30/08 à 18:00** par `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` selon
le protocole réversible de la fiche 25 : programmer et vérifier le nouveau
Short, puis passer l'ancien en `Privée`, sans suppression définitive. Reprendre
ensuite le hero du 02/09, puis celui du 03/09, puis ceux du 04 au 10/09 dans
l'ordre. Le pilote archive vient seulement ensuite, après un nouvel
anti-doublon. Ne pas multiplier les imports pendant une limite quotidienne.

### Facebook

Les **28/28 heroes exacts** sont programmés jusqu'au 10/09, avec preuve native
exacte pour les sept lignes du 04 au 10/09. La dette du 30/08 à 18:15 est
close : le média et la copie ont été remplacés dans la même ligne native ID
`1808499846845426`, puis le hook floral et l'aperçu 10 s ont été vérifiés.
Le pilote archive
`68-prairie-des-lanternes.mp4` est la seule ligne archive programmée, le 23/08
à 12:30. Les autres archives restent conditionnelles aux mesures J+1/J+7 et à
un contrôle anti-cannibalisation.

## Communautés

1. **DreamViews d'abord** : première présentation publique déjà consignée ;
   prochaine contribution seulement sur un fil récent, intégralement relu et
   réellement utile, sans lien ni promotion forcée.
2. **Reddit ensuite** : aucun usage du compte personnel existant. Créer puis
   faire mûrir un compte Noctalia dédié avant toute publication de marque ;
   lecture, participation utile et respect des règles de chaque communauté
   précèdent tout lien.

## Condition de preuve

- `PRÊT` : master et package contrôlés, aucune preuve native de programmation.
- `PROGRAMMÉ` : ligne exacte visible dans la file native du compte exact.
- `PUBLIÉ` : URL publique exacte vérifiée après l'heure prévue.
- Une archive est traitée séparément par plateforme : son existence publique
  sur un réseau n'autorise ni doublon sur ce réseau ni publication massive sur
  les autres.
