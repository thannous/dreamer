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
| `NOC_REVEIL_S04_VIDEO_1080p_v01.mp4` | PUBLICATION PRINCIPALE calendrier 22/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NOC_REVEIL_S05_VIDEO_1080p_v01.mp4` | HERO calendrier 23/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
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
| `AFTERGLOW_AFROFUTURISM_SOLAR_CULTURAL_02.mp4` | PUBLICATION PRINCIPALE calendrier 26/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_AFROFUTURISM_SOLAR_CULTURAL_02.mp4` | HERO calendrier 27/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 27/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 27/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | HERO calendrier 28/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_ARCANEPUNK_LUMINOUS_RUNE_02.mp4` | PUBLICATION PRINCIPALE calendrier 28/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 28/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | HERO calendrier 29/08 C1 | — | — | — | — | — | — | — | — | TikTok **PROGRAMMÉE** — [ligne Studio](https://www.tiktok.com/@noctaliadreams/video/7673364997099064598), 29/08 à 15:30 ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 29/08 C2 | — | — | — | — | — | — | — | — | TikTok **PROGRAMMÉE** — [ligne Studio](https://www.tiktok.com/@noctaliadreams/video/7673366283458596118), 29/08 à 19:30 ; renseigner les URL publiques après diffusion. |
| `NIGHT_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4` | PUBLICATION PRINCIPALE calendrier 29/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_LUNARPUNK_SILVER_LUNAR_02.mp4` | ANCIEN HERO 30/08 C1 | **À EXCLURE — SUPPLANTÉ** | — | **BLOQUÉ QA** | **BLOQUÉ QA** | **ANCIENNE PROGRAMMATION ANNULÉE LE 14/08 — AUTORISATION CIBLÉE CONSOMMÉE** | [PROGRAMMÉ — À REMPLACER](https://youtube.com/shorts/8-m-p4qXG_g) | **ANCIEN MÉDIA REMPLACÉ DANS LA MÊME LIGNE LE 14/08** | **BLOQUÉ QA** | Le master montre une mégalopole volcanique, pas lunaire. Supplanté par `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4`. X : ancienne occurrence retirée et remplacement exact recréé. YouTube : brouillon floral privé `WZk8x9CN_fA` préparé le 15/08, mais ancienne ligne conservée jusqu'à preuve de la nouvelle programmation. Facebook : média et copie remplacés directement dans la ligne native ID `1808499846845426`, même horaire. |
| `AFTERGLOW_SURREAL_FLOWER_WORLD_FLIGHT_01.mp4` | HERO principal et secondaire 30/08 C1 | **RÉAFFECTÉ — PROGRAMMATION PARTIELLE** | A | [**PROGRAMMÉ — 30/08 15:30**](https://www.tiktok.com/@noctaliadreams/video/7673607555146403094) | **PRÊT — DIRECT À 15:45** | **PROGRAMMÉ — 30/08 16:15, FILE NATIVE VÉRIFIÉE** | **PRÊT — BROUILLON PRIVÉ `WZk8x9CN_fA` CONTRÔLÉ, PROGRAMMATION NON VALIDÉE** | **PROGRAMMÉ — 30/08 18:15, LIGNE NATIVE ÉDITÉE ET VÉRIFIÉE** | **PRÊT — FILE ROULANTE** | [Drive exact](https://drive.google.com/file/d/1-u2rUCDdfBv325IyHSszcrc4gOG5olQV/view?usp=drivesdk), SHA-256 `229d1f545586ccaa51e363af5fdb100d8e45906892c5b8bdfe08b9509527ced0`, H.264/AAC 720×1280, 24 fps, 10 s. X : copie exacte, label `Made with AI`, occurrence unique. Facebook : page `Noctalia`, ID `1808499846845426`, copie florale exacte et aperçu `0:10` vérifiés après édition. YouTube : import privé, package, label IA et droits conformes ; cliquer `Programmer` puis privatiser l'ancien uniquement après confirmation et preuve native. |
| `SUNSET_LUNARPUNK_SILVER_LUNAR_02.mp4` | PUBLICATION PRINCIPALE calendrier 30/08 C2 | — | — | [**PROGRAMMÉ — 30/08 19:30**](https://www.tiktok.com/@noctaliadreams/video/7673617553012395286) | — | — | — | — | — | Ligne TikTok vérifiée dans Studio : copie exacte, durée 0:15, label IA natif actif et `Brouillons 0`; renseigner l'URL publique seulement après diffusion. |
| `AFTERGLOW_LUNARPUNK_SILVER_LUNAR_02.mp4` | PUBLICATION PRINCIPALE calendrier 30/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_LUNARPUNK_SILVER_LUNAR_02.mp4` | HERO calendrier 31/08 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | PUBLICATION PRINCIPALE calendrier 31/08 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_NEON_NOIR_HOLOGRAPHIC_THRILLER_02.mp4` | PUBLICATION PRINCIPALE calendrier 31/08 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4` | HERO calendrier 01/09 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 01/09 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 01/09 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | HERO calendrier 02/09 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4` | PUBLICATION PRINCIPALE calendrier 02/09 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `DAY_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 02/09 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `SUNSET_VOLCANOPUNK_BASALT_LAVA_02.mp4` | HERO calendrier 03/09 C1 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `AFTERGLOW_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 03/09 C2 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_VOLCANOPUNK_BASALT_LAVA_02.mp4` | PUBLICATION PRINCIPALE calendrier 03/09 C3 | — | — | — | — | — | — | — | — | Affecté au calendrier principal ; renseigner les URL publiques après diffusion. |
| `NIGHT_ARCANEPUNK_LIVING_LIBRARY_01.mp4` | HERO secondaire 04/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 04/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1IToR6CMGhWWoa-TV497Dx0eSmxXtEEnM/view?usp=drivesdk), validé le 13/08 ; SHA-256 `7c26be7b564603af2b76c3133c2fcc121f6d1eb395dd397dd2657b071d3e5920`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
| `AFTERGLOW_DREAMSCAPE_INFINITE_STAIRCASE_01.mp4` | HERO secondaire 05/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 05/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1k_qPjARP7oxA7lrSoCb3oioeOhA1Uidl/view?usp=drivesdk), validé le 13/08 ; SHA-256 `558b60cc8b18efe4921330254cb117004798e5b625ea244a159a7eda63869800`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
| `NIGHT_COSMIC_STAR_OCEAN_01.mp4` | HERO secondaire 06/09 | — | — | — | — | — | **PRÊT** | **PROGRAMMÉ — 06/09 à 18:15** | **PRÊT** | [Master Drive exact](https://drive.google.com/file/d/1WyLKbViyiZHwn4kfuwXLgo1h7EzSHJaT/view?usp=drivesdk), validé le 13/08 ; SHA-256 `1751df4ccee45adccf3fce04050ac6e77f3317da4b04c64d1cbd9053ca0a24c1`. Ligne Facebook exacte vérifiée dans la file native sur la page `Noctalia`, audience `Public`. |
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
