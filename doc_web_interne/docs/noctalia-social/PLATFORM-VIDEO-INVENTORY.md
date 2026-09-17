# Noctalia — inventaire vidéo par plateforme

Dernière mise à jour : 2026-08-14, 00:45 Europe/Paris.

Ce registre est l'index anti-doublon par vidéo. Le
[calendrier principal](./community-manager/2026-08-us-europe-publication-plan.md)
reste la source de vérité pour les dates, les heures et les assets affectés.
Le [journal d'extension organique](./community-manager/organic-expansion-2026-08-12-2026-09-10/05-EXECUTION-LOG.md)
reste la source de vérité pour les files YouTube, Facebook et Pinterest.

## Règle de diffusion

- Conserver une seule vidéo **HERO** quotidienne sur YouTube Shorts, Facebook
  Reels et Pinterest.
- Ne jamais republier automatiquement tout l'historique.
- Ajouter au maximum une vidéo **ARCHIVE** supplémentaire par jour, uniquement
  après contrôle anti-doublon, préflight et sélection éditoriale.
- Une archive ne passe à `PROGRAMMÉE` qu'après vérification dans la file native,
  puis à `PUBLIÉE` uniquement avec une URL publique.
- Les trois statuts de triage archive sont : `À RATTRAPER`, `À EXCLURE` et
  `DÉJÀ PUBLIÉE`.
- `À EXCLURE` signifie exclue du rattrapage automatique ; une réutilisation
  exceptionnelle exige une nouvelle validation explicite.

## Priorisation des archives

Une vidéo `À RATTRAPER` est classée avant programmation selon quatre signaux :

1. performance publique déjà observée sur TikTok, Instagram ou X ;
2. qualité du hook visuel dans les trois premières secondes ;
3. originalité par rapport aux héros déjà diffusés ;
4. qualité technique et adéquation 9:16.

Les priorités sont `A` (à tester en premier), `B` (réserve solide) et `C`
(attendre davantage de données). L'ordre n'est jamais fondé uniquement sur
l'ancienneté du fichier.

Les priorités initiales sont provisoires. Elles doivent être réordonnées avec
les métriques publiques J+1/J+7 dès qu'elles sont disponibles ; une préférence
éditoriale seule ne constitue jamais une preuve de performance.

### File opérationnelle complète des archives

Le triage de tout le stock historique est clos. L'ordre d'exécution ci-dessous
évite que les assets moins documentés passent devant les vidéos ayant déjà
produit un signal public. Il s'applique seulement aux plateformes secondaires
où la cellule d'URL reste vide.

| Vague | Assets dans l'ordre | Gate avant programmation |
|---|---|---|
| Pilote | `68-prairie-des-lanternes.mp4` | Facebook déjà programmé le 23/08 ; YouTube et Pinterest après libération de capacité ; mesures J+1 et J+7 obligatoires |
| A mesurée | `06-vol.mp4`, `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4`, `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | Une archive maximum par jour ; vérifier rétention, favoris, commentaires et collision avec la HERO |
| B narrative | `03-serpent.mp4`, `73-cavernes-de-nacre.mp4`, `07-horloge.mp4`, `02-escalier-vortex.mp4` | Recontrôler les compteurs manquants et l'originalité du hook avant affectation |
| B historique | `01-escalier.mp4`, `04-train.mp4`, `09-cle.mp4`, `10-labyrinthe.mp4`, `65-nef-des-nuages.mp4`, `02-ascenseur.mp4`, `05-maison.mp4` | Packaging natif à finaliser seulement si les vagues précédentes ne dégradent pas la HERO quotidienne |
| C visuelle | `72-raies-celestes.mp4`, `67-atlas-vivant.mp4`, `08-tempete.mp4` | Faibles signaux mesurés : conserver en réserve, ne pas programmer tant qu'un meilleur asset reste disponible |
| Dette Instagram affectée | `66-fleuve-aerien.mp4`, `69-cascade-ascendante.mp4` | Rattrapage primaire séparé selon `49-INSTAGRAM-PRIMARY-DEBT-CARD.md` ; toute extension secondaire reste gelée jusqu'aux URL Instagram et mesures J+1/J+7 |
| Exclusion | `HIGGS_2026-08-05_140043_POPBOT_1068d59d.mp4`, `WATERFALL PARADISE`, `HEAVENLY PALACE` | Ne jamais rattraper automatiquement |

Un asset ne quitte cette file que pour devenir `PROGRAMMÉ` avec preuve native
ou `PUBLIÉ` avec URL publique. L'absence de compteur ou d'URL n'est jamais
interprétée comme zéro ni comme une autorisation de republication.

## Stratégie de rattrapage des plateformes en retard — 2026-08-13

Les vidéos déjà publiques sur TikTok, Instagram et X ne sont pas considérées
comme épuisées sur YouTube, Facebook ou Pinterest lorsqu'aucune URL n'existe sur
ces plateformes. Leur potentiel est exploité dans une **file ARCHIVE distincte**
de la vidéo HERO quotidienne :

- conserver la HERO quotidienne à 17:30 / 18:00 / 18:15 ;
- ajouter au maximum **une archive distincte par jour** sur les plateformes où
  elle n'a jamais été publiée ;
- ne jamais republier cette archive sur une plateforme où son URL est déjà
  enregistrée ;
- espacer la diffusion archive de la HERO ; le pilote documentaire retient
  **12:30 Europe/Paris**, avec contrôle de la capacité et de l'anti-doublon
  natifs avant toute programmation ;
- adapter titre, hook, couverture et CTA au canal au lieu de copier la légende
  historique ;
- relever les métriques à J+1 et J+7, puis accélérer, maintenir ou réduire la
  file selon la rétention, les sauvegardes, les partages et l'intention ;
- suspendre automatiquement le rattrapage si la cadence principale accumule un
  retard supérieur à 10 %.

### Première vague prioritaire

| Ordre | Asset | Priorité | Préflight local | Destination de rattrapage | Statut |
|---:|---|---|---|---|---|
| 1 | `68-prairie-des-lanternes.mp4` | A | SHA-256 `925da1a7b7134cce7264adea6d0686551a38e90a54d2771efdec02cc6c7255a7`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 25 J’aime, 1 commentaire, 3 favoris, 0 partage | YouTube, Facebook, Pinterest | **FACEBOOK PROGRAMMÉ le 23/08 à 12:30 ; YouTube sous limite d’upload ; Pinterest sous limite de file** |
| 2 | `06-vol.mp4` | A | SHA-256 `70250114e3e1887849ad356b328df13c5484a56885111fb8c85243acacb28fe1`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 25 J’aime, 1 commentaire, 1 favori, 0 partage ; Instagram : 4 J’aime, 0 commentaire | YouTube, Facebook, Pinterest | **PRÊT — meilleure réserve mesurée après le pilote** |
| 3 | `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | A | SHA-256 `154ad8ac823cdb81bba9bfb7208551251447fd95cc66ec085a462f2332f484b2`, H.264/AAC 720×1280, 24 fps, 15,041667 s ; TikTok public contrôlé le 13/08 : 21 J’aime, 2 commentaires, 2 favoris, 0 partage ; Instagram : 2 J’aime, 0 commentaire | YouTube, Facebook, Pinterest | **PRÊT CONDITIONNEL — surveiller le scintillement** |
| 4 | `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | A | SHA-256 `d807016a05eb15619b40673880fbe12ac3432b436d753c40770ed5acb9424276`, H.264/AAC 720×1280, 24 fps, 15,072000 s ; TikTok public contrôlé le 13/08 : 17 J’aime, 0 commentaire, 4 favoris, 0 partage ; Instagram : 3 J’aime, 0 commentaire | YouTube, Facebook, Pinterest | **PRÊT CONDITIONNEL — fort signal de favoris** |
| 5 | `03-serpent.mp4` | B | SHA-256 `62fd4db3f1a868fecae19bc6c5b01ec7b033cc094990076466403bae48b15995`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 16 J’aime, 0 commentaire, 1 favori, 0 partage ; Instagram : compteur J’aime non exposé, 0 commentaire | YouTube, Facebook, Pinterest | **PRÊT CONDITIONNEL — meilleur signal narratif restant** |
| 6 | `73-cavernes-de-nacre.mp4` | B | SHA-256 `84af9e32dde18e29e761628e976e4248742aa938b39966e94759f20b2cdb085e`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 8 J’aime, 0 commentaire, 0 favori, 0 partage ; Instagram : 2 J’aime, 0 commentaire | YouTube, Facebook, Pinterest | **PRÊT — réserve exploration** |
| 7 | `72-raies-celestes.mp4` | C | SHA-256 `4b13457eb8a1130f690474827acbc201cb60d1b7524776c7d0c09837bdea65a5`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 2 J’aime, 0 commentaire, 0 favori, 0 partage | YouTube, Facebook, Pinterest | **PRÊT — réserve visuelle à réévaluer** |
| 8 | `07-horloge.mp4` | B | SHA-256 `17300522e93adfb19ed609100c46961269af68b31058209f669d4366f38b60b0`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; compteurs TikTok non lisibles au contrôle public du 13/08 | YouTube, Facebook, Pinterest | **PRÊT — métriques à recontrôler avant affectation** |
| 9 | `67-atlas-vivant.mp4` | C | SHA-256 `18fbca9a74e3b0f83d5b3ab7025e3aaf87b74376a4c77a3d855dea2d364c0bdb`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 0 J’aime, 0 commentaire, 0 favori, 0 partage | YouTube, Facebook, Pinterest | **PRÊT — réserve visuelle basse priorité mesurée** |
| 10 | `08-tempete.mp4` | C | SHA-256 `3b8a2136027ad36c469af8c121b999eda5c2dc8cbf95a74a68d946991e6ad21d`, H.264/AAC 1080×1920, 24 fps, 12,122667 s ; TikTok public contrôlé le 13/08 : 0 J’aime, 0 commentaire, 0 favori, 0 partage | YouTube, Facebook, Pinterest | **PRÊT — réserve action basse priorité mesurée** |

### Packaging natif du pilote archive

Le pilote reste affecté au **23/08/2026 à 12:30 Europe/Paris**. Ces copies sont
propres à chaque plateforme et ne modifient pas les publications historiques
déjà publiques sur TikTok, Instagram et X.

| Plateforme | Asset exact | Packaging validé | Destination / conformité | Statut |
|---|---|---|---|---|
| YouTube Shorts | `68-prairie-des-lanternes.mp4` | Titre : `A Field That Remembers the Stars #Shorts` ; description : `Lanterns drift across a field that remembers the stars. What detail would you write down first? #Noctalia` | Audience `Not made for kids` ; contrôler le champ natif `Altered content` ; aucun lien promotionnel dans la description | **PRÊT — anti-doublon reconfirmé le 13/08 dans les 21 Shorts ; non programmé, reprendre après levée de la limite quotidienne d'upload** |
| Facebook Reels | `68-prairie-des-lanternes.mp4` | `A field that remembers the stars. Which lantern would you follow? #Noctalia #Dreamscape` | Audience publique ; master propre ; ne pas partager vers un profil personnel ; label IA natif selon conformité | **PROGRAMMÉ — ligne native exacte vérifiée le 13/08 après chargement complet : 23/08 à 12:30, page Noctalia, public** |
| Pinterest | `68-prairie-des-lanternes.mp4` | Titre : `Surreal Dreamscape: A Field of Lanterns` ; description : `Lanterns drift across a surreal field beneath the stars. Save this dreamscape as a prompt for your next dream journal entry. #Noctalia` | Tableau `Surreal Dreamscapes` ; URL UTM : `https://noctalia.app/?utm_source=pinterest&utm_medium=organic&utm_campaign=noctalia_archive_2026_08&utm_content=2026_08_23_68_prairie_lanternes_archive_a` ; label IA natif à contrôler | **PRÊT — anti-doublon reconfirmé le 13/08 ; file native pleine avec 10 Pins du 13 au 22/08, programmer seulement après libération d'une place** |

Cette première vague ne constitue pas encore une programmation. Avant chaque
ligne : vérifier l'absence d'URL sur la plateforme, le compte, le fichier exact,
la capacité de file et l'écart avec la HERO du jour.

### Réserve archive no 2 — conditionnelle

`06-vol.mp4` reste **PRÊT — NON PROGRAMMÉ**. Sa première date
possible est le **31/08/2026 à 12:30 Europe/Paris**, uniquement si les revues
J+1 et J+7 du pilote du 23/08 ne montrent ni erreur de packaging, ni collision
avec la HERO, ni baisse opérationnelle de la cadence principale. Cette date est
une borne de décision, pas une programmation.

| Plateforme | Packaging préparé | Destination / conformité |
|---|---|---|
| YouTube Shorts | Titre `Would You Let Go in This Dream? #Shorts` ; description `A dream lifts you above the world. Would you let go or search for the ground? #Noctalia` | Audience `Not made for kids` ; champ natif `Altered content` à contrôler ; aucun lien promotionnel |
| Facebook Reels | `A dream lifts you above the world. Would you let go? #Noctalia #Dreamscape` | Page Noctalia ; audience publique ; audio original ; label IA natif selon conformité |
| Pinterest | Titre `Surreal Dreamscape: Letting Go` ; description `A dream carries you above the world. Save this scene as a prompt for your next dream-journal entry. #Noctalia` | Tableau `Surreal Dreamscapes` ; URL `https://noctalia.app/?utm_source=pinterest&utm_medium=organic&utm_campaign=noctalia_archive_2026_08&utm_content=2026_08_31_06_vol_archive_a` |

Avant toute programmation : confirmer le SHA-256 déjà préflighté, l'absence
d'URL et de ligne native exacte sur chaque plateforme, puis réévaluer la
priorité à partir des mesures stabilisées du pilote. Aucun compteur X exploitable
n'était exposé dans la vue publique contrôlée le 13/08 ; ce signal reste
`INDÉTERMINÉ`, pas zéro.

### Réserves suivantes — packages prêts, dates conditionnelles

Ces quatre lignes sont techniquement préflightées mais ne sont pas encore
affectées définitivement. Elles peuvent remplir progressivement le retard des
plateformes secondaires **uniquement après** le verdict J+7 du pilote du 23/08,
à raison d'une archive maximum par jour et seulement sur les plateformes où la
vidéo est absente. Les dates ci-dessous sont des fenêtres possibles, pas des
programmations natives.

| Fenêtre possible | Asset exact | YouTube Shorts | Facebook Reels | Pinterest | État |
|---|---|---|---|---|---|
| 04/09 · 12:30 | `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | Titre `Would You Follow This Neon Dream? #Shorts` ; description `Rain turns a midnight city into a hologram. Which light would you follow? #Noctalia` | `Rain turns a midnight city into a hologram. Would you follow the neon? #Noctalia #Dreamscape` | Titre `Surreal Dreamscape: Neon Noir City` ; description `A rainy neon city becomes a cinematic dreamscape. Save it as inspiration for a future dream-journal entry. #Noctalia` ; tableau `Surreal Dreamscapes` ; UTM `2026_09_04_night_neon_noir_archive_a` | **PRÊT CONDITIONNEL — NON PROGRAMMÉ** |
| 05/09 · 12:30 | `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | Titre `Would You Cross This Floating Dream City? #Shorts` ; description `A celestial city rises above the clouds. Which path would you take? #Noctalia` | `A celestial city rises above the clouds. Would you cross it? #Noctalia #Dreamscape` | Titre `Surreal Dreamscape: Celestial Floating City` ; description `Explore a celestial city floating above the clouds. Save it as inspiration for your next dream-journal entry. #Noctalia` ; tableau `Surreal Dreamscapes` ; UTM `2026_09_05_day_aetherpunk_archive_a` | **PRÊT CONDITIONNEL — NON PROGRAMMÉ** |
| 06/09 · 12:30 | `03-serpent.mp4` | Titre `Would You Follow This Serpent Through a Dream? #Shorts` ; description `A serpent moves through a world that should not exist. Would you follow it? #Noctalia` | `A serpent moves through a world that should not exist. Would you follow it? #Noctalia #Dreamscape` | Titre `Surreal Dreamscape: Follow the Serpent` ; description `A serpent crosses a surreal world and leaves a new dream-journal prompt behind. #Noctalia` ; tableau `Surreal Dreamscapes` ; UTM `2026_09_06_03_serpent_archive_b` | **PRÊT CONDITIONNEL — NON PROGRAMMÉ** |
| 07/09 · 12:30 | `73-cavernes-de-nacre.mp4` | Titre `How Deep Would You Go? #Shorts` ; description `Pearl-lit caverns open beneath the dream. Which path would you explore first? #Noctalia` | `Pearl-lit caverns open beneath the dream. How deep would you go? #Noctalia #Dreamscape` | Titre `Surreal Dreamscape: Pearl-Lit Caverns` ; description `Explore luminous caverns beneath a surreal dream world. Save this scene as inspiration for your next dream-journal entry. #Noctalia` ; tableau `Surreal Dreamscapes` ; UTM `2026_09_07_73_pearl_caverns_archive_b` | **PRÊT CONDITIONNEL — NON PROGRAMMÉ** |

`06-vol.mp4` et `03-serpent.mp4` ont été revalidés localement en H.264/AAC,
`1080×1920`, `24 fps`, `12,122667 s`, avec les SHA-256
`70250114e3e1887849ad356b328df13c5484a56885111fb8c85243acacb28fe1` et
`62fd4db3f1a868fecae19bc6c5b01ec7b033cc094990076466403bae48b15995`.
Les deux masters préfixés ont été téléchargés depuis leur fichier Drive exact
et revalidés le 13/08 :

- [`NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4`](https://drive.google.com/file/d/1MDOfhghdgkMMMdlBc7fufdBIPBG8HrqH/view?usp=drivesdk), 31 284 418 octets, H.264 High/AAC LC, `720×1280`, `24 fps`, `15,041667 s`, SHA-256 `154ad8ac823cdb81bba9bfb7208551251447fd95cc66ec085a462f2332f484b2` ;
- [`DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4`](https://drive.google.com/file/d/1jVY-gKfLSI7-jlwkKvLfNhyUv3j8BdKq/view?usp=drivesdk), 23 806 832 octets, H.264 High/AAC LC, `720×1280`, `24 fps`, `15,072000 s`, SHA-256 `d807016a05eb15619b40673880fbe12ac3432b436d753c40770ed5acb9424276`.

Les descriptions Pinterest recevront
l'URL `https://noctalia.app/` avec `utm_source=pinterest`,
`utm_medium=organic` et `utm_campaign=noctalia_archive_2026_09` au moment de la
programmation native. Les labels IA restent dans les contrôles natifs, jamais
dans le texte.

## Registre consolidé

Une cellule `—` signifie qu'aucune URL publique n'est encore enregistrée pour
ce couple vidéo/plateforme. Une ligne programmée sans URL publique reste
documentée dans les journaux d'exécution et n'est pas assimilée à une
publication.

Le tableau couvre les anciennes vidéos déjà identifiées, les exclusions et tous
les assets affectés dans le calendrier faisant foi jusqu'au 3 septembre. Les
cellules restent vides tant qu'aucune preuve publique exacte n'est disponible.

Audit de triage du 13/08 : `20` assets historiques sont classés `À RATTRAPER`,
`3` sont `À EXCLURE` et `1` est `DÉJÀ PUBLIÉE` sur les six plateformes. Les
`73` lignes avec triage `—` comprennent les assets futurs du calendrier
principal et les sept heroes secondaires validés du 4 au 10 septembre ; ce ne
sont pas des archives oubliées. Deux lignes historiques, `66-fleuve-aerien.mp4` et
`69-cascade-ascendante.mp4`, ont une dette Instagram distincte : TikTok et X
sont publics, mais aucune URL Instagram n'a jamais été prouvée et le contrôle
du profil du 13/08 n'a retrouvé aucun des deux hooks. Elles sont désormais
**AFFECTÉES À UN RATTRAPAGE PRIMAIRE CONTRÔLÉ** : `66` le 16/08 à 12:45 et
`69` le 23/08 à 12:45. La fiche
`49-INSTAGRAM-PRIMARY-DEBT-CARD.md` impose compte exact, créneau dédié,
préflight, nouvel anti-doublon et URL publique. Toute extension secondaire
reste gelée jusqu'à la clôture Instagram et aux mesures J+1/J+7.

Contre-audit Magnific/Pikaso du 13/08 : les 28 variantes restantes après retrait
des copies déjà inventoriées et des sept heroes secondaires ont toutes été
décodées intégralement et possèdent 28 SHA-256 distincts. Le tri visuel a produit
`18 CANDIDATS FORTS`, `3 RÉSERVES` et `7 EXCLUSIONS`. Le propriétaire a validé
les 14 candidats retenus le 13/08 ; ils ont été copiés sous leurs noms définitifs
et leurs SHA après copie correspondent aux sources. L'affectation des 21 lignes
principales du 4 au 10 septembre est détaillée
dans [`38-MAIN-CALENDAR-GAP-2026-09-04-10.md`](./community-manager/organic-expansion-2026-08-12-2026-09-10/38-MAIN-CALENDAR-GAP-2026-09-04-10.md).
Ces lignes sont `AFFECTÉES — PRÊTES APRÈS PRÉFLIGHT NATIF`, pas `PROGRAMMÉES`.

| Asset exact | Rôle | Triage archive | Priorité | TikTok | Instagram | X | YouTube | Facebook | Pinterest | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| `01-levitation-envol.mp4` | HERO 12/08 | **DÉJÀ PUBLIÉE** | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7672845593449893142) | [URL](https://www.instagram.com/noctaliadreams/reel/Db8dSsRpbyH/) | [URL](https://x.com/NoctaliaDreams/status/2087543376233324924) | [URL](https://youtube.com/shorts/jWP6_xh4Tsw) | [URL](https://www.facebook.com/reel/1815431659804855) | [URL](https://fr.pinterest.com/pin/1127940669217695342/) | Hero complet sur les six plateformes. |
| `68-prairie-des-lanternes.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7669511051330768150) | [URL](https://www.instagram.com/noctaliadreams/reel/Db84qSIJt1J/) | [URL](https://x.com/NoctaliaDreams/status/2087603774147715546) | — | **PROGRAMMÉ — 23/08 à 12:30** | — | Pilote archive ; Instagram contrôlé le 13/08 : 9 J'aime et aucun commentaire, signal propre à Instagram. Ligne Facebook exacte vérifiée dans la file native avec audience `Public`. Elle n'est pas encore publiée : l'URL Facebook sera inscrite seulement après diffusion. YouTube et Pinterest restent à programmer dans leur capacité native. |
| `02-escalier-vortex.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7672846296939646230) | [URL](https://www.instagram.com/noctaliadreams/reel/Db915M6p0gy/) | [URL](https://x.com/NoctaliaDreams/status/2087649072635117724) | — | — | — | Diffusion principale complète sur TikTok, Instagram et X ; reste candidate au rattrapage sélectif sur les canaux d'extension, sans réutilisation automatique. |
| `72-raies-celestes.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7669149752843537687) | [URL](https://www.instagram.com/noctaliadreams/reel/DbwSAdKpVFW/) | [URL](https://x.com/NoctaliaDreams/status/2085791834949783898) | — | — | — | Bon candidat visuel, à départager par métriques. |
| `67-atlas-vivant.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7671723152392654102) | [URL](https://www.instagram.com/noctaliadreams/reel/DbyeDi3pDeL/) | [URL](https://x.com/NoctaliaDreams/status/2086153435758424121) | — | — | — | Bon candidat visuel, à départager par métriques. |
| `03-serpent.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669150066350820630) | [URL](https://www.instagram.com/noctaliadreams/reel/Dbye3QipcaC/) | [URL](https://x.com/NoctaliaDreams/status/2086154222655951255) | — | — | — | Réserve narrative. Instagram contrôlé le 13/08 : compteur J'aime non exposé, aucun commentaire ; ne pas convertir cette absence d'affichage en zéro. |
| `06-vol.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7671727826466524419) | [URL](https://www.instagram.com/noctaliadreams/reel/DbywSkpJx_s/) | [URL](https://x.com/NoctaliaDreams/status/2086199521164358059) | — | — | — | TikTok contrôlé le 13/08 : 25 J'aime, 1 commentaire, 1 favori, 0 partage. Instagram : 4 J'aime, aucun commentaire. Meilleure réserve après le pilote. |
| `07-horloge.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7669150296035183894) | [URL](https://www.instagram.com/noctaliadreams/reel/Db1OdU6pT0F/) | [URL](https://x.com/NoctaliaDreams/status/2086516610505048347) | — | — | — | Hook temporel distinctif. |
| `08-tempete.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669151005212151062) | [URL](https://www.instagram.com/noctaliadreams/reel/Db3zI6iJuHs/) | [URL](https://x.com/NoctaliaDreams/status/2086878998340997468) | — | — | — | Réserve action/orage. |
| `DAY_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7672578329249156374) | [URL](https://www.instagram.com/noctaliadreams/reel/Db4Z_TeJJNC/) | [URL](https://x.com/NoctaliaDreams/status/2086987370335760713) | — | — | — | TikTok contrôlé le 13/08 : 17 J'aime, 0 commentaire, 4 favoris, 0 partage. Instagram : 3 J'aime, aucun commentaire. [Master Drive exact](https://drive.google.com/file/d/1jVY-gKfLSI7-jlwkKvLfNhyUv3j8BdKq/view?usp=drivesdk) préflighté ; SHA-256 `d807016a05eb15619b40673880fbe12ac3432b436d753c40770ed5acb9424276`. |
| `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | ARCHIVE candidate | **À RATTRAPER** | A | [URL](https://www.tiktok.com/@noctaliadreams/video/7672579626975251734) | [URL](https://www.instagram.com/noctaliadreams/reel/Db4afsypfzD/) | [URL](https://x.com/NoctaliaDreams/status/2086988510112677987) | — | — | — | TikTok contrôlé le 13/08 : 21 J'aime, 2 commentaires, 2 favoris, 0 partage. Instagram : 2 J'aime, aucun commentaire. [Master Drive exact](https://drive.google.com/file/d/1MDOfhghdgkMMMdlBc7fufdBIPBG8HrqH/view?usp=drivesdk) préflighté ; SHA-256 `154ad8ac823cdb81bba9bfb7208551251447fd95cc66ec085a462f2332f484b2`. Fort contraste ; surveiller le scintillement. |
| `73-cavernes-de-nacre.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669510452715474198) | [URL](https://www.instagram.com/noctaliadreams/reel/Db6TxYRJwIG/) | [URL](https://x.com/NoctaliaDreams/status/2087241386164662725) | — | — | — | Réserve exploration. Instagram contrôlé le 13/08 : 2 J'aime, aucun commentaire. |
| `HIGGS_2026-08-05_140043_POPBOT_1068d59d.mp4` | EXCLU | **À EXCLURE** | — | — | — | — | — | — | — | Hors ligne éditoriale Noctalia ; ne jamais publier. |
| `WATERFALL PARADISE` | EXCLU du rattrapage automatique | **À EXCLURE** | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7671324629998325014) | [URL](https://www.instagram.com/noctaliadreams/reel/DbvtGKPJxGA/) | [URL](https://x.com/NoctaliaDreams/status/2085763583296589935) | — | — | — | Déjà utilisé ; aucune réutilisation automatique. |
| `HEAVENLY PALACE` | EXCLU du rattrapage automatique | **À EXCLURE** | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7671325119079501059) | [URL](https://www.instagram.com/noctaliadreams/reel/DbwSKz8pk1s/) | [URL](https://x.com/NoctaliaDreams/status/2085837133219078224) | — | — | — | Déjà utilisé ; aucune réutilisation automatique. |
| `01-escalier.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7668792098266680598) | [URL](https://www.instagram.com/noctaliadreams/reel/Dbd5dCKp-AC/) | [URL](https://x.com/NoctaliaDreams/status/2083255119722815645) | — | — | — | Historique principal ; extension organique à vérifier. |
| `04-train.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7668797188658466070) | [URL](https://www.instagram.com/noctaliadreams/reel/DbgqlzWpSUv/) | [URL](https://x.com/NoctaliaDreams/status/2083617507479351664) | — | — | — | Historique principal ; extension organique à vérifier. |
| `09-cle.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7668798403010104598) | [URL](https://www.instagram.com/noctaliadreams/reel/Dbi-87dp0P2/) | [URL](https://x.com/NoctaliaDreams/status/2083979895391056296) | — | — | — | Historique principal ; extension organique à vérifier. |
| `10-labyrinthe.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7668799559723846934) | [URL](https://www.instagram.com/noctaliadreams/reel/DblpuQWJnXB/) | [URL](https://x.com/NoctaliaDreams/status/2084342283244097729) | — | — | — | Historique principal ; extension organique à vérifier. |
| `65-nef-des-nuages.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669148164967992598) | [URL](https://www.instagram.com/noctaliadreams/reel/DboK5wCJ4zw/) | [URL](https://x.com/NoctaliaDreams/status/2084704671365472680) | — | — | — | Historique principal ; extension organique à vérifier. |
| `66-fleuve-aerien.mp4` | DETTE INSTAGRAM / archive secondaire gelée | **À RATTRAPER SUR INSTAGRAM — AFFECTÉ 16/08 À 12:45** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669148993233898774) | **PRÊT — NON PUBLIÉ** ; exécuter uniquement selon `49-INSTAGRAM-PRIMARY-DEBT-CARD.md` | [URL](https://x.com/NoctaliaDreams/status/2085067058983919967) | — | — | — | Absence prouvée sur la grille complète ; master local exact et SHA revalidés. Une URL Instagram publique reste obligatoire avant clôture. Extension secondaire toujours gelée. |
| `69-cascade-ascendante.mp4` | DETTE INSTAGRAM / archive secondaire gelée | **À RATTRAPER SUR INSTAGRAM — AFFECTÉ 23/08 À 12:45** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7669149481555725590) | **PRÊT — NON PUBLIÉ** ; exécuter uniquement selon `49-INSTAGRAM-PRIMARY-DEBT-CARD.md` | [URL](https://x.com/NoctaliaDreams/status/2085429447122174447) | — | — | — | Absence prouvée sur la grille complète ; master local exact et SHA revalidés. Une URL Instagram publique reste obligatoire avant clôture. Extension secondaire toujours gelée. |
| `02-ascenseur.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7670972792111648022) | [URL](https://www.instagram.com/noctaliadreams/reel/Dbtdw1xp6jh/) | [URL](https://x.com/NoctaliaDreams/status/2085452095994597431) | — | — | — | Rattrapage historique principal terminé ; extension organique absente. |
| `05-maison.mp4` | ARCHIVE candidate | **À RATTRAPER** | B | [URL](https://www.tiktok.com/@noctaliadreams/video/7670973164867947798) | [URL](https://www.instagram.com/noctaliadreams/reel/Dbtm7VtJFtY/) | [URL](https://x.com/NoctaliaDreams/status/2085474745403707705) | — | — | — | Historique principal ; extension organique à vérifier. |
| `03-ville-engloutie-eruption.mp4` | HERO calendrier 13/08 C1 | **DÉJÀ PUBLIÉE SUR LES SIX PLATEFORMES** | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7672900166269046039) | [URL](https://www.instagram.com/noctaliadreams/reel/Db_Y9_wpnJS/) | [URL](https://x.com/NoctaliaDreams/status/2087905764786520085) | [URL](https://youtube.com/shorts/RNY9UIozIKE) | [URL](https://www.facebook.com/reel/1544614401039270) | [URL](https://fr.pinterest.com/pin/1127940669217775129/) | Six preuves publiques vérifiées séparément ; Reel Instagram publié en rattrapage à 20:32 après anti-doublon et preuve X C2. |
| `70-cathedrale-solaire.mp4` | PUBLICATION PRINCIPALE calendrier 13/08 C2 | — | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7669511356776844566) | [URL](https://www.instagram.com/noctaliadreams/reel/Db_TvvmpRrl/) | [URL](https://x.com/NoctaliaDreams/status/2087966162046910588) | — | — | — | TikTok, Instagram et X publics vérifiés séparément après leurs heures : comptes, hooks, durée vidéo et labels IA concordants. |
| `04-ocean-ciel-tempete.mp4` | PUBLICATION PRINCIPALE calendrier 13/08 C3 | — | — | [URL](https://www.tiktok.com/@noctaliadreams/video/7672900511825415446) | [URL](https://www.instagram.com/noctaliadreams/reel/Db_oYftpXmx/) | [URL](https://x.com/NoctaliaDreams/status/2088011460479688877) | — | — | — | TikTok, Instagram et X publics vérifiés séparément après leurs heures : comptes, hook, vidéo, audio et labels IA concordants. |
| `05-foret-bioluminescente-embrasement.mp4` | HERO calendrier 14/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `71-ballons-de-laube.mp4` | PUBLICATION PRINCIPALE calendrier 14/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `06-chute-infinie-traversee.mp4` | PUBLICATION PRINCIPALE calendrier 14/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `07-couloir-portes-deferlement.mp4` | HERO calendrier 15/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `74-ocean-de-plumes.mp4` | PUBLICATION PRINCIPALE calendrier 15/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `08-baleines-celestes-impact.mp4` | PUBLICATION PRINCIPALE calendrier 15/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `09-monde-miroir-brisure.mp4` | HERO calendrier 16/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `10-constellation-naissance.mp4` | PUBLICATION PRINCIPALE calendrier 16/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_130802_CRAYON_MARKET_b09972e9.mp4` | PUBLICATION PRINCIPALE calendrier 16/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_143033_JUNGLE_CRYSTAL_FPV_4c148b7e.mp4` | HERO calendrier 17/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_155812_CITY_POV_A_2c5b1abd.mp4` | PUBLICATION PRINCIPALE calendrier 17/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_161541_CITY_POV_B_a7ea3391.mp4` | PUBLICATION PRINCIPALE calendrier 17/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_171605_CITY_POV_C_cecd94a1.mp4` | HERO calendrier 18/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_174658_CITY_POV_D_749127f1.mp4` | PUBLICATION PRINCIPALE calendrier 18/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_162633_TSUNAMI_NEWS_14edcce9.mp4` | PUBLICATION PRINCIPALE calendrier 18/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_183301_TIME_FREEZE_CITY_073670c9.mp4` | HERO calendrier 19/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-05_212002_MAGIC_DOOR_b3d4a35f.mp4` | PUBLICATION PRINCIPALE calendrier 19/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_001_FP_CITY.mp4` | PUBLICATION PRINCIPALE calendrier 19/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_002_FP_CITY.mp4` | HERO calendrier 20/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_003_FP_CITY.mp4` | PUBLICATION PRINCIPALE calendrier 20/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_004_FP_CITY.mp4` | PUBLICATION PRINCIPALE calendrier 20/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_005_FP_CITY.mp4` | HERO calendrier 21/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `HIGGS_2026-08-06_006_FP_CITY.mp4` | PUBLICATION PRINCIPALE calendrier 21/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S01_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 21/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S02_VIDEO_1080p_v01.mp4` | HERO calendrier 22/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S03_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 22/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S04_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 22/08 C3 | — | — | — | **PUBLIÉE — [DcW0OAuJszM](https://www.instagram.com/noctaliadreams/reel/DcW0OAuJszM/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 1 842 vues, 22 J'aime, 0 commentaire, 0 partage, 3 sauvegardes. |
| `NOC_REVEIL_S05_VIDEO_1080p_v01.mp4` | HERO calendrier 23/08 C1 | — | — | — | **PUBLIÉE — [DcYouwQp_od](https://www.instagram.com/noctaliadreams/reel/DcYouwQp_od/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 390 vues, 8 J'aime, 0 commentaire, 0 partage, 1 sauvegarde. |
| `NOC_REVEIL_S06_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 23/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S07_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 23/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S08_VIDEO_1080p_v01.mp4` | HERO calendrier 24/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S09_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 24/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S10_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 24/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | HERO calendrier 25/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | PUBLICATION PRINCIPALE calendrier 25/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_AETHERPUNK_CELESTIAL_FLOATING_02.mp4` | PUBLICATION PRINCIPALE calendrier 25/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_AFROFUTURISM_SOLAR_CULTURAL_02.mp4` | HERO calendrier 26/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_AFROFUTURISM_SOLAR_CULTURAL_02_V2.mp4` | PUBLICATION PRINCIPALE calendrier 26/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_AFROFUTURISM_SOLAR_CULTURAL_02.mp4` | PUBLICATION PRINCIPALE calendrier 26/08 C3 | — | — | — | **PUBLIÉE — [DchHP7sJw24](https://www.instagram.com/noctaliadreams/reel/DchHP7sJw24/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 262 vues, 8 J'aime, 0 commentaire, 0 partage, 3 sauvegardes. |
| `NIGHT_AFROFUTURISM_SOLAR_CULTURAL_02.mp4` | HERO calendrier 27/08 C1 | — | — | — | **PUBLIÉE — [Dci9FiTJzJi](https://www.instagram.com/noctaliadreams/reel/Dci9FiTJzJi/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 790 vues, 15 J'aime, 3 commentaires, 0 partage, 4 sauvegardes. |
| `DAY_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 27/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 27/08 C3 | — | — | — | **PUBLIÉE — [DcjscO2JBkA](https://www.instagram.com/noctaliadreams/reel/DcjscO2JBkA/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 346 vues, 11 J'aime, 0 commentaire, 0 partage, 0 sauvegarde. |
| `AFTERGLOW_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | HERO calendrier 28/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 28/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 28/08 C3 | — | — | — | **PUBLIÉE TARDIVEMENT — [DcnRjkUJH7c](https://www.instagram.com/noctaliadreams/reel/DcnRjkUJH7c/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 764 vues, 9 J'aime, 0 commentaire, 0 partage, 2 sauvegardes ; publication observée le 29/08 à 08:17 Europe/Paris. |
| `SUNSET_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | HERO calendrier 29/08 C1 | — | — | — | **PUBLIÉE — [DcoItzTJhcy](https://www.instagram.com/noctaliadreams/reel/DcoItzTJhcy/)** | — | — | — | — | TikTok **PROGRAMMÉE** — [ligne Studio](https://www.tiktok.com/@noctaliadreams/video/7673364997099064598), 29/08 à 15:30. Reel Instagram retrouvé dans Insights le 04/09 : 330 vues, 9 J'aime, 0 commentaire, 0 partage, 1 sauvegarde. |
| `AFTERGLOW_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 29/08 C2 | — | — | — | — | — | — | — | — | TikTok **PROGRAMMÉE** — [ligne Studio](https://www.tiktok.com/@noctaliadreams/video/7673366283458596118), 29/08 à 19:30 ; renseigner les URL publiques après diffusion. |
| `NIGHT_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 29/08 C3 | — | — | — | **PUBLIÉE — [Dco3sKnJmIV](https://www.instagram.com/noctaliadreams/reel/Dco3sKnJmIV/)** | — | — | — | — | Reel retrouvé dans Instagram Insights le 04/09 : 1 489 vues, 19 J'aime, 0 commentaire, 0 partage, 3 sauvegardes. |
| `DAY_LUNARPUNK_SILVER_LUNAR_02.mp4` | ANCIEN HERO 30/08 C1 | **À EXCLURE — SUPPLANTÉ** | — | **BLOQUÉ QA** | **BLOQUÉ QA** | **ANCIENNE PROGRAMMATION ANNULÉE LE 14/08 — AUTORISATION CIBLÉE CONSOMMÉE** | **PUBLIÉE — À REMPLACER — ANCIEN SHORT [8-m-p4qXG_g](https://www.youtube.com/shorts/8-m-p4qXG_g)** | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE LE 14/08** | **BLOQUÉ QA** | Le master montre une mégalopole volcanique, pas lunaire. Supplanté par `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4`. X : ancienne occurrence retirée et remplacement exact recréé. YouTube Studio, contrôlé le 05/09 sur la chaîne exacte `Noctalia` / `@noctaliadreams`, montre l'ancien Short `8-m-p4qXG_g` toujours `Publique`; le remplacement floral `WZk8x9CN_fA` reste un brouillon privé. Une fois le remplacement floral programmé et vérifié, l'ancienne occurrence sera alors passée en `Privée`, jamais supprimée. Facebook : média et copie remplacés directement dans la ligne native ID `1808499846845426`, même horaire. |
| `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | HERO principal et secondaire 30/08 C1 | **RÉAFFECTÉ — PROGRAMMATION PARTIELLE** | A | [**PUBLIÉE — 30/08 15:30**](https://www.tiktok.com/@noctaliadreams/video/7673607555146403094) | **PUBLIÉE — [DcqqeL4JMXo](https://www.instagram.com/noctaliadreams/reel/DcqqeL4JMXo/)** | **PUBLIÉE — [2094066358413574355](https://x.com/NoctaliaDreams/status/2094066358413574355), 30/08 16:15, Made with AI** | **BROUILLON PRIVÉ — NON PUBLIÉ — ID `WZk8x9CN_fA`** | **PROGRAMMÉ — 30/08 18:15, LIGNE NATIVE ÉDITÉE ET VÉRIFIÉE** | **PRÊT — FILE ROULANTE** | [Drive exact](https://drive.google.com/file/d/1-u2rUCDdfBv325IyHSszcrc4gOG5olQV/view?usp=drivesdk), SHA-256 `229d1f545586ccaa51e363af5fdb100d8e45906892c5b8bdfe08b9509527ced0`, H.264/AAC 720×1280, 24 fps, 10 s. TikTok, Instagram et X C1 : pages publiques ouvertes sur les comptes exacts ; TikTok expose `aigcLabelType=1`/`ShowAIGC=true`, X `Made with AI`, Instagram légende exacte. Facebook : page `Noctalia`, ID `1808499846845426`, copie florale exacte et aperçu `0:10` vérifiés après édition. YouTube Studio, contrôlé le 05/09 sur la chaîne exacte, confirme le fichier, le titre et la description exacts, l'upload et les vérifications terminés, mais indique `Brouillon` et « Enregistrée en tant que vidéo privée ». L'étape native `Visibilité` et l'option `Programmer` sont disponibles ; aucune visibilité n'a été modifiée et aucune publication n'est revendiquée. |
| `SUNSET_LUNARPUNK_SILVER_LUNAR_02.mp4` | PUBLICATION PRINCIPALE calendrier 30/08 C2 | — | — | [**PUBLIÉE — 30/08 19:30**](https://www.tiktok.com/@noctaliadreams/video/7673617553012395286) | **PUBLIÉE — [DcrG2dnp82-](https://www.instagram.com/noctaliadreams/reel/DcrG2dnp82-/)** | **PUBLIÉE — [2094126755695194350](https://x.com/NoctaliaDreams/status/2094126755695194350), 30/08 20:15, Made with AI** | — | — | — | Pages TikTok, Instagram et X ouvertes sur les comptes exacts après leurs heures. TikTok expose la durée 15 s et le label IA natif ; Instagram expose la légende exacte, `il y a 1 heure` et le badge `Creator avec IA`. La copie publique X exacte est « Sunset reaches a city built from moonlight. Would you stay? #Noctalia #Dreamscape », avec vidéo 15 s et `Made with AI`. |
| `AFTERGLOW_LUNARPUNK_SILVER_LUNAR_02.mp4` | PUBLICATION PRINCIPALE calendrier 30/08 C3 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [DcraOvWJgod](https://www.instagram.com/noctaliadreams/reel/DcraOvWJgod/)** | **PUBLIÉE — [2094172054304051311](https://x.com/NoctaliaDreams/status/2094172054304051311), 30/08 23:15, Made with AI** | — | — | — | Reel Instagram publié à 22:45 Europe/Paris après contrôle anti-doublon sur le compte exact ; page publique ouverte, durée 15 s, badge `Creator avec IA`, et copie visible normalisée par Instagram avec `#surrealdreamscapes`. X est ouvert sur `@NoctaliaDreams` à 23:15 avec vidéo 15 s, `Made with AI` et copie publique « Where would it lead? ». TikTok a été contrôlé après 22:30 : Studio affiche `Publications 0`/`Brouillons 0`, sans identité ni capacité native libre prouvée ; aucun upload ni URL, statut d'échec conservé. |
| `NIGHT_LUNARPUNK_SILVER_LUNAR_02.mp4` | HERO calendrier 31/08 C1 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [DctTWzYpt6o](https://www.instagram.com/noctaliadreams/reel/DctTWzYpt6o/)** | **PUBLIÉE — [2094428746379845882](https://x.com/NoctaliaDreams/status/2094428746379845882)** | **PUBLIÉE — [dK0vOKr7PzY](https://www.youtube.com/shorts/dK0vOKr7PzY)** | **PROGRAMMÉ — ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | `NIGHT_LUNARPUNK_SILVER_LUNAR_02.mp4` SHA `d65f0481298a929bef30e906cf3ad94b84df90a391699eb074ea0ac19f535f2a`, H.264/AAC 720×1280, 24 fps, 15.072 s. Instagram : compte exact, hook exact, vidéo 15 s et badge `Creator avec IA`. X : compte exact, `4:15 PM · Aug 31, 2026`, vidéo 14 s, `Made with AI`; copie publique « At night, the lunar city shines like a memory. Would you return? #Noctalia #Dreamscape ». YouTube : chaîne exacte, titre `Give This Lunar Dream a Five-Word Title #Shorts`, badge IA ; horodatage natif non exposé. TikTok Studio : `Publications 0`/`Brouillons 0`, sans identité ni capacité native libre prouvée ; aucun upload. Pinterest : profil public ouvert, onglet `Créées` sans Pin et session déconnectée. Facebook : surfaces publiques indisponibles (« Ce contenu n’est pas disponible pour le moment »). |
| `DAY_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | PUBLICATION PRINCIPALE calendrier 31/08 C2 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [DctrDKzpjJZ](https://www.instagram.com/noctaliadreams/reel/DctrDKzpjJZ/)** | **PUBLIÉE — [2094489143535714524](https://x.com/NoctaliaDreams/status/2094489143535714524), 31/08 20:15, Made with AI** | — | — | — | SHA `163816650056b9729c81a8e8ed4bb018ac2796e9544b02b777869151412b449d`, H.264/AAC 720×1280, 24 fps, 15.072 s. Instagram : compte exact, hook exact, vidéo publique et badge `Creator avec IA`. X : compte exact, `8:15 PM · Aug 31, 2026`, vidéo 15 s, `Made with AI`; copie publique « Rain turns the city into a hologram. Which light would you follow? #Noctalia #Dreamscape ». TikTok Studio : `Publications 0`/`Brouillons 0`, sans identité ni capacité native libre prouvée ; aucun upload ni URL. |
| `SUNSET_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | PUBLICATION PRINCIPALE calendrier 31/08 C3 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [Dct_CQDJF-T](https://www.instagram.com/noctaliadreams/reel/Dct_CQDJF-T/)** | **PUBLIÉE — [2094534442081517575](https://x.com/NoctaliaDreams/status/2094534442081517575), 31/08 23:15, Made with AI** | — | — | — | SHA-256 `6cd3ce7b4fc049fe4669c2abcf6bc30d4e035eea17e1d6bf1c9a232e0da56ea0`, H.264/AAC 720×1280, 24 fps, 15.072 s. Instagram : compte exact, hook et légende exacts, vidéo publique 15 s, badge `Creator avec IA` ; légende corrigée immédiatement après partage pour rétablir `#SurrealDreams`. TikTok Studio : `Publications 0`/`Brouillons 0`, sans identité ni capacité native libre prouvée ; aucun upload ni URL. X : compte exact, `11:15 PM · Aug 31, 2026` (23:15 Europe/Paris), vidéo publique 13 s, `Made with AI`; copie publique « At sunset, every neon sign tells a different story. Which one is yours? #Noctalia #Dreamscape ». |
| `AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | HERO calendrier 01/09 C1 | — | — | **PUBLIÉE — [7680254233572068630](https://www.tiktok.com/@noctaliadreams/video/7680254233572068630), observée hors file** | **PUBLIÉE — [Dcv0cXKp8aq](https://www.instagram.com/noctaliadreams/reel/Dcv0cXKp8aq/)** | **PUBLIÉE — [2094791133453009220](https://x.com/NoctaliaDreams/status/2094791133453009220), 01/09 16:15, Made with AI** | **PUBLIÉE — [gMMaTH_-hog](https://www.youtube.com/shorts/gMMaTH_-hog)** | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | SHA-256 `19ac02ec8267f1e7a94771fb694848078f23a6c3628fce4f36046327edd287f7`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : compte exact, hook exact, vidéo 15 s, label IA natif, `7` likes, `0` commentaire, `0` favori et `0` partage au relevé du 04/09 ; publication publique observée hors file, capacité native non vérifiable. Instagram : compte exact, légende exacte, vidéo publique et badge `Creator avec IA`. X : compte exact, `4:15 PM · Sep 1, 2026` (16:15 Europe/Paris), vidéo 15 s, `Made with AI`; copie publique « Afterglow turns a rainy city into a hologram. Which light would you follow? #Noctalia #Dreamscape ». YouTube : Short [gMMaTH_-hog](https://www.youtube.com/shorts/gMMaTH_-hog) ouvert sur la chaîne exacte `@noctaliadreams`, titre `Would You Follow the Neon Deeper Into This Dream? #Shorts` et badge natif `IA : le contenu a été créé avec l'IA`. Pinterest : profil public `Noctalia` ouvert sur l’onglet `Créées`, aucune épingle du hero exposée ; session déconnectée et capacité native non vérifiable. Facebook : `/NoctaliaDreams/reels` et `/NoctaliaDreams/videos` affichent « Ce contenu n’est pas disponible pour le moment », aucune URL publique. |
| `DAY_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 01/09 C2 | — | — | **PUBLIÉE — [7680580474598673686](https://www.tiktok.com/@noctaliadreams/video/7680580474598673686)** | **PUBLIÉE — [DcwQlhzpsij](https://www.instagram.com/noctaliadreams/reel/DcwQlhzpsij/)** | **PUBLIÉE — [2094851531405402163](https://x.com/NoctaliaDreams/status/2094851531405402163), 01/09 20:15, Made with AI** | — | — | — | SHA-256 `695386c3dba29962ad0c6a5c4d2d469bf101abf916540beacb8b9e6694bd9964`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : compte exact, hook exact, `Il y a 1 h`, durée 15 s et label IA natif. Instagram : compte exact, légende exacte, `1 h`, badge `Creator avec IA`. X : compte exact, `8:15 PM · Sep 1, 2026` (20:15 Europe/Paris), vidéo 15 s et `Made with AI`, copie publique exacte « A city glows beneath an endless ocean. Would you dive toward it? #Noctalia #Dreamscape ». Publication TikTok observée publiquement ; file native et capacité non vérifiables. |
| `SUNSET_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 01/09 C3 | — | — | **PUBLIÉE — [7680626112761695490](https://www.tiktok.com/@noctaliadreams/video/7680626112761695490), observée hors file** | **PUBLIÉE — [DcwjqDxpRaO](https://www.instagram.com/noctaliadreams/reel/DcwjqDxpRaO/)** | **PUBLIÉE — [2094896830425260175](https://x.com/NoctaliaDreams/status/2094896830425260175)** | — | — | — | SHA-256 `c1ece3d12b57403bc9929f4ca05873985dc2b4c4df1095df774177c5c7a64d42`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : compte exact, hook exact, vidéo 15 s, label IA natif, `13` likes, `0` commentaire, `0` favori et `0` partage au relevé du 04/09 ; publication publique observée hors file, capacité native non vérifiable. Instagram : compte exact, hook et légende exacts, vidéo publique et badge `Creator avec IA`, contrôlé après 22:45 Europe/Paris. X : compte exact, `11:15 PM · Sep 1, 2026` (23:15 Europe/Paris), vidéo 15 s, `Made with AI` et copie publique exacte `Sunset reaches the city beneath the waves. Would you follow its glow?`. |
| `AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | HERO calendrier 02/09 C1 | — | — | **PUBLIÉE — [7680669597275573526](https://www.tiktok.com/@noctaliadreams/video/7680669597275573526)** | **PUBLIÉE — [Dcyb8zrJ3v3](https://www.instagram.com/noctaliadreams/reel/Dcyb8zrJ3v3/)** | **PUBLIÉE — [2095153522245300629](https://x.com/NoctaliaDreams/status/2095153522245300629), 02/09 16:15, Made with AI** | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | SHA-256 `eec6f5ca4f6137ed378a085fc34a31945287f0a0251811c95cbc91fa8d1b9ea4`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : compte exact, hook exact, `Il y a 2 h`, lecteur `00:02 / 00:15` et label IA natif ; aucune capacité de file native vérifiable, publication observée hors file. Instagram : compte exact, légende exacte, `1 h`, badge `Creator avec IA`. X : compte exact, `4:15 PM · Sep 2, 2026` (16:15 Europe/Paris), vidéo 14 s et `Made with AI`, copie publique exacte « Afterglow drifts through a bioluminescent city. Would you swim closer? #Noctalia #Dreamscape ». Pinterest : profil public `Noctalia` ouvert sur l'onglet `Créées` après 17:30, aucune épingle du hero exposée et session déconnectée. YouTube : chaîne exacte `@noctaliadreams` contrôlée après 18:00, 21 Shorts visibles mais aucun hero exact du 02/09 ; aucune URL nouvelle. Facebook : `/NoctaliaDreams/reels` et `/NoctaliaDreams/videos` rouverts après 18:15, chacun affiche « Ce contenu n’est pas disponible pour le moment » ; aucune URL publique ni capacité de preuve contrôlable. |
| `NIGHT_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 02/09 C2 | — | — | **PUBLIÉE — [7680939909875649795](https://www.tiktok.com/@noctaliadreams/video/7680939909875649795)** | **PUBLIÉE — [Dcy9ozApXiM](https://www.instagram.com/noctaliadreams/reel/Dcy9ozApXiM/)** | **PUBLIÉE — [2095213919682146783](https://x.com/NoctaliaDreams/status/2095213919682146783), 02/09 20:15, Made with AI** | — | — | — | Affecté au calendrier principal ; SHA-256 `3acae9b424a965f665a0bcce2a9379bdbae02f45c330fb18656ed8530e0c2ebe`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : compte exact, hook exact, `Il y a 1 h`, lecteur `00:01 / 00:15` et label IA natif ; publication observée hors file, capacité native non vérifiable. Instagram : compte exact, légende exacte, `13 min`, badge `Creator avec IA`. X : compte exact, `8:15 PM · Sep 2, 2026` (20:15 Europe/Paris), vidéo 14 s et `Made with AI`, copie publique exacte « At night, the abyss becomes a city of stars. Would you enter it? #Noctalia #Dreamscape ». |
| `DAY_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 02/09 C3 | — | — | **PUBLIÉE — [7680994913994968322](https://www.tiktok.com/@noctaliadreams/video/7680994913994968322)** | **PUBLIÉE — [DczIb4HpPcf](https://www.instagram.com/noctaliadreams/reel/DczIb4HpPcf/)** | — | — | — | — | SHA-256 `ef9c1ac097e13be5e1fe90bfd5a0e271db66b4701d33049eac07fc3f708b8dce`, H.264/AAC 720×1280, 24 fps, durée vidéo 15.041667 s et durée audio/format 15.072000 s. TikTok : compte exact, hook exact, lecteur `00:02 / 00:15`, label IA natif « Le créateur a indiqué que ce contenu était généré par IA » ; publication observée hors file, file native et capacité non vérifiables. Instagram : compte exact, légende exacte `A city of basalt rises between rivers of fire. Would you cross it? #Noctalia #Dreamscape #SurrealDreams`, vidéo publique et badge `Creator avec IA`. X C3 reste programmé à 23:15. |
| `SUNSET_VOLCANOPUNK_BASALT_LAVA_02.mp4` | HERO calendrier 03/09 C1 | — | — | **PUBLIÉE — [7681042462269361430](https://www.tiktok.com/@noctaliadreams/video/7681042462269361430)** | **PUBLIÉE — [Dc1Dd6ep9I4](https://www.instagram.com/noctaliadreams/reel/Dc1Dd6ep9I4/)** | **PUBLIÉE — [2095515909188391155](https://x.com/NoctaliaDreams/status/2095515909188391155)** | **ÉCHEC — NON PUBLIÉ** | **PROGRAMMÉ — ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | SHA-256 `fa0e240c151bfacba0cdec6a55c62d2e46e8936d12f8a686d9df5193d6ee92bc`. TikTok, Instagram et X : comptes et hook exacts, pages publiques et labels IA natifs vérifiés. Relevé à 21:29 : TikTok `164` vues ; Instagram `137` vues, `1` like, `0` partage/commentaire/enregistrement ; X `1` vue, `0` like/repost/réponse. Pinterest et YouTube : publication exacte absente. Facebook : surfaces `Reels` et `Vidéos` indisponibles après l'heure, sans URL publique. |
| `AFTERGLOW_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 03/09 C2 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [Dc1aVYTJzHq](https://www.instagram.com/noctaliadreams/reel/Dc1aVYTJzHq/)** | **PUBLIÉE — [2095576307316797737](https://x.com/NoctaliaDreams/status/2095576307316797737)** | — | — | — | SHA-256 `f6b70f6838e98d352ea088515bd4274d190aea79247c5f2c45e4fb144ccebcad`, H.264/AAC 720×1280, 24 fps, 15.072 s. TikTok : hook absent du profil exact après 19:30, aucune URL ni capacité native prouvée. Instagram : compte et légende exacts, badge `Creator avec IA`; `93` vues, `81` spectateurs, `3` likes, `0` partage/commentaire/enregistrement. X : compte et copie exacts, vidéo 15 s, `Made with AI`; `3` vues, `0` like/repost/réponse. |
| `NIGHT_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 03/09 C3 | — | — | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [2095621605690912855](https://x.com/NoctaliaDreams/status/2095621605690912855), 03/09 23:15, Made with AI** | — | — | — | SHA-256 `f499309d043ec7d4b824a815b0e6d79c677854b21ad4808f8bf0eb1e301f9434`, H.264 720×1280, 24 fps, 15.041667 s. TikTok et Instagram : hook exact absent des profils publics après leurs heures ; aucune URL, publication tardive ni capacité native supposée. X : compte et copie exacts, `11:15 PM · Sep 3, 2026`, vidéo 15 s, `Made with AI`; relevé du 04/09 à 00:48 : `1` vue, `0` like/repost/réponse. |
| `NIGHT_ARCANEPUNK_LIVING_LIBRARY_01.mp4` | HERO principal et secondaire 04/09 | — | — | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [2095878299251531935](https://x.com/NoctaliaDreams/status/2095878299251531935)** | **ÉCHEC — NON PUBLIÉ** | **PROGRAMMÉ — ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | [Master Drive exact](https://drive.google.com/file/d/1IToR6CMGhWWoa-TV497Dx0eSmxXtEEnM/view?usp=drivesdk), validé le 13/08 ; SHA-256 `7c26be7b564603af2b76c3133c2fcc121f6d1eb395dd397dd2657b071d3e5920`. X C1 ouvert le 04/09 à 17:26 sur `@NoctaliaDreams` : copie exacte, vidéo 10 s, `Made with AI`, 1 vue et 0 like/repost/réponse. Les hooks TikTok et Instagram sont absents après échéance. Pinterest : profil public ouvert après 17:30, onglet `Créées` vide et session déconnectée, sans URL ni capacité native prouvée. YouTube : chaîne exacte `@noctaliadreams` contrôlée après 18:00, 21 Shorts visibles mais aucun titre exact du hero du 04/09. Facebook : ligne native exacte conservée sur la page `Noctalia`, audience `Public`, mais les surfaces publiques `Reels` et `Vidéos` affichent « Ce contenu n'est pas disponible pour le moment » après 18:45 ; aucune URL publique vérifiable. |
| `AFTERGLOW_DREAMSCAPE_INFINITE_STAIRCASE_01.mp4` | HERO secondaire 05/09 | — | — | — | — | — | **ÉCHEC — NON PUBLIÉ** | **PROGRAMMÉ — ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | [Master Drive exact](https://drive.google.com/file/d/1k_qPjARP7oxA7lrSoCb3oioeOhA1Uidl/view?usp=drivesdk), validé le 13/08 ; SHA-256 `558b60cc8b18efe4921330254cb117004798e5b625ea244a159a7eda63869800`. Après les checkpoints du 05/09, aucune URL publique exacte Pinterest, YouTube ou Facebook n'est vérifiable. La page YouTube publique confirme la chaîne exacte, mais pas le titre attendu. Le Mac verrouillé empêche le contrôle natif ; la ligne Facebook historique reste conservée, sans métrique supposée ni publication tardive. |
| `NIGHT_COSMIC_STAR_OCEAN_01.mp4` | HERO principal et secondaire 06/09 C1 | — | — | **ÉCHEC — NON PUBLIÉ** | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [2096603072898478203](https://x.com/NoctaliaDreams/status/2096603072898478203), 06/09 16:15, Made with AI** | **ÉCHEC — NON PUBLIÉ** | **PROGRAMMÉ — ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [1127940669219704199](https://www.pinterest.com/pin/1127940669219704199/)** | [Master Drive exact](https://drive.google.com/file/d/1WyLKbViyiZHwn4kfuwXLgo1h7EzSHJaT/view?usp=drivesdk), validé le 13/08 ; SHA-256 `1751df4ccee45adccf3fce04050ac6e77f3317da4b04c64d1cbd9053ca0a24c1`. TikTok et Instagram : hook C1 absent des profils exacts après échéance, sans publication tardive. X : copie exacte, vidéo 10 s, label `Made with AI`, 1 vue et 0 engagement visible. Pinterest : session exacte authentifiée, absence de doublon, titre, description, tableau `How to Remember Dreams`, UTM et label IA conformes ; 0 impression, 0 enregistrement et 0 clic au premier relevé. YouTube : chaîne publique exacte à 21 vidéos et Studio exact à 22 lignes contrôlés après 18:00 ; le titre du HERO du 06/09 est absent et aucune URL publique n'est disponible. Ligne Facebook exacte conservée dans la file native sur la page `Noctalia`, audience `Public`, mais `/NoctaliaDreams/reels` et `/NoctaliaDreams/videos` restent indisponibles après le checkpoint de 18:45 ; aucune URL publique ni métrique contrôlable. |
| `NIGHT_CLOCKPUNK_TIME_PORTAL_01.mp4` | PUBLICATION PRINCIPALE calendrier 06/09 C2 | — | — | **ÉCHEC — NON PUBLIÉ** | **PUBLIÉE — [Dc9HLH3JFUm](https://www.instagram.com/noctaliadreams/reel/Dc9HLH3JFUm/)** | **PUBLIÉE — [2096663470704119901](https://x.com/NoctaliaDreams/status/2096663470704119901), 06/09 20:15, Made with AI** | — | — | — | SHA-256 `7600e0f948df42450006360ab3a955fd2b19387a194fcd33bd911b5e8354dc8c`, H.264/AAC 720×1280, 24 fps, 10 s. TikTok : hook absent du profil exact après 19:30 et capacité native non prouvée ; aucun upload tardif. Instagram : compte, légende et vidéo exacts, badge `Creator avec IA` ; vues non encore renseignées, 0 like, 0 commentaire, 0 enregistrement et 0 partage au premier relevé. X : compte et copie exacts, `8:15 PM · Sep 6, 2026`, vidéo 10 s et `Made with AI` ; 1 vue et 0 like/repost/réponse/enregistrement. |
| `NIGHT_COSMIC_PLANETARY_STAIRCASE_01.mp4` | HERO secondaire 07/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 07/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/19E15ulgE8i_z6Qa_mlyFePsMZQSXWboo/view?usp=drivesdk), validé le 13/08 ; SHA-256 `453343ffc13eec3d29a210076dfd60e43577a3e7c688c5c416a57b236b9a1319`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
| `AFTERGLOW_COSMIC_GALAXY_STEPPING_STONES_01.mp4` | HERO secondaire 08/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 08/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1Zl2PSDuU-yhcF_O7lPvMaYt0uj1yjbDn/view?usp=drivesdk), validé le 13/08 ; SHA-256 `faebf677a52aef62bb7a0525d1afcbcbdc4d929c3b01379595d85d525ecdac9d`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
| `AFTERGLOW_SURREAL_PLANET_FLOWER_RUN_01.mp4` | HERO secondaire 09/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 09/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1Z2J4wPdFNcj4H04C0SKNj-AEYAKqxBL4/view?usp=drivesdk), validé le 13/08 ; SHA-256 `45f03cb3f536713421f62e116f4c0b627c28c906522dfe855d28933394357787`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
| `NIGHT_COSMIC_PEARL_CONSTELLATION_01.mp4` | HERO secondaire 10/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 10/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1GmQ8f5w_S_D3boOY_e3b56pXIU8SX4y-/view?usp=drivesdk), validé le 13/08 ; SHA-256 `2539f1eee67d8491b15093bc866fb3d5a9c247a805384c25ecbac9347c22174f`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |

## Audit de couverture et d'unicité — 2026-08-13, 07:20 CEST

- le registre contient **97 lignes d'asset et 97 noms uniques** ;
- les **60 références** du calendrier principal du 12 au 31 août sont toutes
  présentes dans ce registre ;
- les **sept heroes secondaires** du 4 au 10 septembre sont présents avec leur
  lien Drive exact, leur SHA-256 et un statut séparé par plateforme ;
- aucune référence du calendrier d'août ne manque dans l'inventaire à six
  plateformes ;
- les colonnes TikTok, Instagram, X, YouTube, Facebook et Pinterest sont
  conservées séparément afin qu'une preuve sur un réseau ne soit jamais
  propagée implicitement aux autres ;
- aucun doublon SHA-256 n'a été détecté dans l'ensemble des masters locaux
  préflightés du 13 au 31 août ; les noms et empreintes exacts restent consignés
  dans le calendrier principal.

Cet audit prouve la couverture documentaire et l'unicité des fichiers contrôlés.
Il ne transforme aucune ligne `PRÊT` ou `PROGRAMMÉE` en `PUBLIÉE` : une URL
publique exacte reste obligatoire pour chaque plateforme.

Recontrôle structurel du 13/08 à 09:55 CEST : le tableau contient toujours
**97 lignes et 97 noms uniques**, sans doublon de nom. Les comptes restent
`20` archives `À RATTRAPER`, `3` exclusions et `1` hero déjà public sur les six
plateformes. Les 67 lignes sans URL dans les six colonnes sont des assets futurs
ou secondaires documentés, pas une preuve de publication manquante à propager
automatiquement.

## Processus quotidien

```text
HERO du calendrier → contrôle anti-doublon → publication/programmation native
                    → URL publique → registre

ARCHIVE candidate → métriques + score éditorial → triage
                  → max. 1 archive/jour → URL publique → registre
```

Le créneau archive pilote est fixé à **12:30 Europe/Paris**, cinq heures avant
le premier hero secondaire de 17:30. Il s'agit d'un garde-fou expérimental, pas
d'une heure optimale prouvée : une seule archive doit être testée, puis évaluée
à J+1 et J+7 avant extension. Aucune archive n'est `PROGRAMMÉE` tant que son
absence de doublon et sa présence dans la file native ne sont pas vérifiées.
