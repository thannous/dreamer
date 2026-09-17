import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/tanuki/Documents/dreamer/outputs/019faebf-16c7-7d52-8c71-cdb4296c3b6a";
const outputPath = `${outputDir}/historique-performances-sociales-noctalia-2026-09-03.xlsx`;

const d = (iso) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

const rows = [
  // TikTok Studio — snapshot observed on 2026-09-03.
  ["TikTok", d("2025-12-26"), "", "", "7588263110427905302", "Lancement Noctalia", "", "https://www.tiktok.com/@noctaliadreams/video/7588263110427905302", "Vues", 989, 2, null, null, null, "TikTok Studio — contenu trié par vues (extrait)", d("2026-09-03"), "Mesure native; heure et partages non exposés dans le relevé"],
  ["TikTok", d("2025-12-30"), "", "", "7589690934741290262", "Avatar trend", "", "https://www.tiktok.com/@noctaliadreams/video/7589690934741290262", "Vues", 838, 7, null, null, null, "TikTok Studio — contenu trié par vues (extrait)", d("2026-09-03"), "Mesure native; heure et partages non exposés dans le relevé"],
  ["TikTok", d("2026-08-06"), "22:30", "C3", "7670973164867947798", "A house that should not exist. Would you step inside?", "05-maison.mp4", "https://www.tiktok.com/@noctaliadreams/video/7670973164867947798", "Vues", 810, 9, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-08"), "19:30", "C2", "7669150066350820630", "What did the serpent become in your dream?", "03-serpent.mp4", "https://www.tiktok.com/@noctaliadreams/video/7669150066350820630", "Vues", 813, 16, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-17"), "19:30", "C2", "7672908734812753174", "A dream city unfolds below. Where would you land first?", "HIGGS_2026-08-05_155812_CITY_POV_A_2c5b1abd.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672908734812753174", "Vues", 756, 24, null, 2, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-17"), "22:30", "C3", "7672908815154662678", "The city keeps changing around you. Which way would you turn?", "HIGGS_2026-08-05_161541_CITY_POV_B_a7ea3391.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672908815154662678", "Vues", 256, 12, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-18"), "15:30", "C1", "7672909813348568342", "A city shifts beneath your feet. Where would you go first?", "HIGGS_2026-08-05_171605_CITY_POV_C_cecd94a1.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672909813348568342", "Vues", 250, 8, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-18"), "19:30", "C2", "7672909895074630934", "Neon streets stretch into the horizon", "HIGGS_2026-08-05_174658_CITY_POV_D_749127f1.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672909895074630934", "Vues", 780, 23, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-18"), "22:30", "C3", "7672909972921011459", "A wave rises above the city. Would you wake up or keep watching?", "HIGGS_2026-08-05_162633_TSUNAMI_NEWS_14edcce9.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672909972921011459", "Vues", 228, 4, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-19"), "15:30", "C1", "7672911514487033110", "Time stops across the city. What would you do first?", "HIGGS_2026-08-05_183301_TIME_FREEZE_CITY_073670c9.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672911514487033110", "Vues", 777, 8, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-21"), "15:30", "C1", "7672913676256496918", "Flying through a city of glass and steel. Which path would you take?", "HIGGS_2026-08-06_005_FP_CITY.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672913676256496918", "Vues", 801, 26, null, null, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; commentaires et partages non exposés dans ce relevé"],
  ["TikTok", d("2026-08-21"), "19:30", "C2", "7672913741863800086", "A neon city moves faster than thought. Would you ride through it?", "HIGGS_2026-08-06_006_FP_CITY.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672913741863800086", "Vues", 807, 23, null, 2, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-08-24"), "15:30", "C1", "7672916773661838614", "The ocean pauses under a single star. What would you wish for?", "NOC_REVEIL_S08_VIDEO_1080p_v01.mp4", "https://www.tiktok.com/@noctaliadreams/video/7672916773661838614", "Vues", 798, 15, null, null, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; commentaires et partages non exposés dans ce relevé"],
  ["TikTok", d("2026-09-01"), "15:30", "C1", "7680254233572068630", "Afterglow turns a rainy city into a hologram. Which light would you follow?", "AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680254233572068630", "Vues", 133, 7, null, 0, null, "TikTok Studio — liste de contenu", d("2026-09-03"), "Publication visible dans Studio; registre local à réconcilier; partages non exposés"],
  ["TikTok", d("2026-09-01"), "19:30", "C2", "7680580474598673686", "A city glows beneath an endless ocean. Would you dive toward it?", "DAY_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680580474598673686", "Vues", 494, 15, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-09-01"), "22:30", "C3", "7680626112761695490", "Sunset reaches the city beneath the waves. Would you follow its glow?", "SUNSET_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680626112761695490", "Vues", 172, 13, null, 0, null, "TikTok Studio — liste de contenu", d("2026-09-03"), "Publication visible dans Studio; registre local à réconcilier; partages non exposés"],
  ["TikTok", d("2026-09-02"), "15:30", "C1", "7680669597275573526", "Afterglow drifts through a bioluminescent city. Would you swim closer?", "AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680669597275573526", "Vues", 252, 4, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-09-02"), "19:30", "C2", "7680939909875649795", "At night, the abyss becomes a city of stars. Would you enter it?", "NIGHT_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680939909875649795", "Vues", 352, 17, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-09-02"), "22:30", "C3", "7680994913994968322", "A city of basalt rises between rivers of fire. Would you cross it?", "DAY_VOLCANOPUNK_BASALT_LAVA_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7680994913994968322", "Vues", 122, 2, null, 0, null, "TikTok Studio + registre Noctalia", d("2026-09-03"), "Mesure native; partages non exposés"],
  ["TikTok", d("2026-09-03"), "15:30", "C1", "7681042462269361430", "At sunset, a city burns without turning to ash. Would you explore it?", "SUNSET_VOLCANOPUNK_BASALT_LAVA_02.mp4", "https://www.tiktok.com/@noctaliadreams/video/7681042462269361430", "Vues", 0, 0, null, 0, null, "TikTok Studio — ligne du jour", d("2026-09-03"), "Mesure très précoce/non stabilisée; ne pas utiliser pour conclure sur le créneau"],

  // Instagram Professional Dashboard — 30-day top content snapshot.
  ["Instagram", d("2026-08-23"), "19:45", "C2", "3970221749469266345", "A memory circles you like smoke. Would you follow it?", "NOC_REVEIL_S06_VIDEO_1080p_v01.mp4", "https://www.instagram.com/noctaliadreams/reel/DcZD6VgpUGp/", "Vues", 2474, 18, 0, 0, 2, "Instagram Professional Dashboard — 30 jours", d("2026-09-03"), "Mesure native: 2 101 comptes touchés, 22 engagés, 6 nouveaux abonnés"],
  ["Instagram", d("2026-08-22"), "22:45", "C3", "3969589782839217356", "Your reflection wakes before you do. What would it say?", "NOC_REVEIL_S04_VIDEO_1080p_v01.mp4", "https://www.instagram.com/reel/DcW0OAuJszM/", "Vues", 1842, 22, 0, 0, 3, "Instagram Professional Dashboard — 30 jours", d("2026-09-03"), "Mesure native: 1 444 comptes touchés, 24 engagés, 7 nouveaux abonnés; registre local à réconcilier"],

  // X public counters — partial, non-owner search.
  ["X", d("2026-07-31"), "20:15", "C2", "2083255119722815645", "Escalier impossible", "01-escalier.mp4", "https://x.com/NoctaliaDreams/status/2083255119722815645", "Vues", 21, 0, 0, null, null, "Recherche publique X — from:NoctaliaDreams filter:videos", d("2026-09-03"), "Échantillon public partiel; pas d'analytics propriétaire"],
  ["X", d("2026-08-06"), "20:15", "C2", "2085429447122174447", "Cascade ascendante", "69-cascade-ascendante.mp4", "https://x.com/NoctaliaDreams/status/2085429447122174447", "Vues", 7, null, null, null, null, "Recherche publique X — from:NoctaliaDreams filter:videos", d("2026-09-03"), "Échantillon public partiel; réactions non exposées dans le relevé"],
  ["X", d("2026-08-12"), "16:15", "C1", "2087543376233324924", "Would you follow this dream above the clouds?", "01-levitation-envol.mp4", "https://x.com/NoctaliaDreams/status/2087543376233324924", "Vues", 10, null, null, null, null, "Recherche publique X — from:NoctaliaDreams filter:videos", d("2026-09-03"), "Échantillon public partiel; réactions non exposées dans le relevé"],
  ["X", d("2026-08-16"), "16:15", "C1", "2088992927599222981", "What would your reflection do in this dream?", "09-monde-miroir-brisure.mp4", "https://x.com/NoctaliaDreams/status/2088992927599222981", "Vues", 18, 1, 1, null, null, "Recherche publique X — from:NoctaliaDreams filter:videos", d("2026-09-03"), "Échantillon public partiel; pas d'analytics propriétaire"],

  // YouTube Studio — top Shorts by views.
  ["YouTube", d("2026-08-13"), "18:00", "HERO", "RNY9UIozIKE", "How to Remember Three Dream Details #Shorts", "03-ville-engloutie-eruption.mp4", "https://youtube.com/shorts/RNY9UIozIKE", "Vues", 622, null, null, 0, null, "YouTube Studio — Shorts triés par vues", d("2026-09-03"), "Likes et partages non exposés dans le tableau relevé"],
  ["YouTube", d("2026-08-18"), "18:00", "HERO", "od7v_J3fPZQ", "Where Would You Go First in This Dream City? #Shorts", "HIGGS_2026-08-05_171605_CITY_POV_C_cecd94a1.mp4", "https://www.youtube.com/shorts/od7v_J3fPZQ", "Vues", 316, null, null, 0, null, "YouTube Studio — Shorts triés par vues", d("2026-09-03"), "Likes et partages non exposés dans le tableau relevé"],

  // Facebook Meta Business Suite — 28 days, 2026-08-05 to 2026-09-01.
  ["Facebook", d("2026-08-31"), "18:16", "HERO", "4662153027439937", "Do not force an interpretation on the first morning", "NIGHT_LUNARPUNK_SILVER_LUNAR_02.mp4", "https://www.facebook.com/reel/4662153027439937", "Vues", 51308, 661, 2, 1, 6, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native: 34 213 spectateurs, 670 interactions, durée moyenne 10 s; registre local à réconcilier"],
  ["Facebook", d("2026-08-23"), "12:30", "ARCHIVE", "1548642119710246", "Prairie des lanternes", "68-prairie-des-lanternes.mp4", "https://www.facebook.com/reel/1548642119710246", "Vues", 1462, 57, 4, 0, 1, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native: 1 253 spectateurs, 62 interactions, durée moyenne 4 s"],
  ["Facebook", d("2026-08-21"), "18:15", "HERO", "", "Set one intention before sleep", "HIGGS_2026-08-06_005_FP_CITY.mp4", "https://www.facebook.com/reel/1324844283189236", "Vues", 1042, 9, 5, 1, 1, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native"],
  ["Facebook", d("2026-08-13"), "18:16", "HERO", "1544614401039270", "Before moving, name three details from your dream", "03-ville-engloutie-eruption.mp4", "https://www.facebook.com/reel/1544614401039270", "Vues", 692, 13, 0, 0, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; enregistrements non exposés dans le relevé"],
  ["Facebook", d("2026-08-20"), "18:15", "HERO", "1416489937207759", "What rule of reality breaks first here?", "HIGGS_2026-08-06_002_FP_CITY.mp4", "https://www.facebook.com/reel/1416489937207759", "Vues", 593, 4, 4, 1, 2, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native"],
  ["Facebook", d("2026-09-02"), "18:15", "HERO", "", "Try a sixty-second dream recall", "AFTERGLOW_OCEANPUNK_ABYSSAL_BIOLUMINESCENT_02.mp4", "", "Vues", 576, 6, null, null, null, "Meta Business Suite — contenu", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-29"), "18:16", "HERO", "", "Name three details from this frozen dream", "SUNSET_FROSTPUNK_CRYOPUNK_ICE_AURORA_02.mp4", "", "Vues", 471, 4, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-18"), "18:16", "HERO", "2313760082756350", "Where would you go first in this dream city?", "HIGGS_2026-08-05_171605_CITY_POV_C_cecd94a1.mp4", "https://www.facebook.com/reel/2313760082756350", "Vues", 446, 6, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; partages/commentaires non exposés dans le relevé"],
  ["Facebook", d("2026-08-12"), "18:15", "HERO", "1815431659804855", "Would you follow this dream above the clouds?", "01-levitation-envol.mp4", "https://www.facebook.com/reel/1815431659804855", "Vues", 414, 5, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; partages/commentaires non exposés dans le relevé"],
  ["Facebook", d("2026-08-14"), "18:15", "HERO", "875602548747781", "Would this dream forest feel peaceful or dangerous?", "05-foret-bioluminescente-embrasement.mp4", "https://www.facebook.com/reel/875602548747781", "Vues", 382, 7, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; partages/commentaires non exposés dans le relevé"],
  ["Facebook", d("2026-08-23"), "18:16", "HERO", "", "Ask the dream forest one question", "NOC_REVEIL_S05_VIDEO_1080p_v01.mp4", "", "Vues", 336, 1, null, null, 1, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-22"), "18:15", "HERO", "", "Would you stay in this underwater dream?", "NOC_REVEIL_S02_VIDEO_1080p_v01.mp4", "", "Vues", 334, 1, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-30"), "18:15", "HERO", "", "Flowers between planets", "DAY_LUNARPUNK_SILVER_LUNAR_02.mp4", "", "Vues", 317, 5, 1, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; titre/asset à réconcilier avec la QA du calendrier; URL non capturée"],
  ["Facebook", d("2026-08-24"), "18:15", "HERO", "", "Wake up or keep exploring?", "NOC_REVEIL_S08_VIDEO_1080p_v01.mp4", "", "Vues", 273, 3, 1, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-28"), "18:16", "HERO", "", "Would you enter this city of runes?", "AFTERGLOW_ARCANEPUNK_LUMINOUS_RUNE_02.mp4", "", "Vues", 249, 2, 2, 1, 1, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-09-01"), "18:15", "HERO", "", "Would you follow the neon deeper into this dream?", "AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2.mp4", "", "Vues", 149, 4, null, null, null, "Meta Business Suite — contenu", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-26"), "18:15", "HERO", "", "Which path would you take through this solar city?", "DAY_AFROFUTURISM_SOLAR_CULTURAL_02.mp4", "", "Vues", 43, 1, null, null, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-27"), "18:15", "HERO", "", "Write the dream in the present tense", "NIGHT_AFROFUTURISM_SOLAR_CULTURAL_02.mp4", "", "Vues", 36, 1, 3, 1, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],
  ["Facebook", d("2026-08-25"), "18:15", "HERO", "", "Note recurring places in your dream journal", "SUNSET_AETHERPUNK_CELESTIAL_FLOATING_02.mp4", "", "Vues", 25, 1, 2, 1, null, "Meta Business Suite — 28 jours (05/08–01/09)", d("2026-09-03"), "Mesure native; URL publique non capturée dans le relevé"],

  // Pinterest Analytics — 30 days, metric is impressions (not views).
  ["Pinterest", d("2026-08-14"), "17:30", "HERO", "1127940669217848264", "Surreal Dreamscape: A Bioluminescent Forest", "05-foret-bioluminescente-embrasement.mp4", "https://www.pinterest.com/pin/1127940669217848264/", "Impressions", 148, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-12"), "17:30", "HERO", "1127940669217695342", "Surreal Dreamscape: Floating Above the Clouds", "01-levitation-envol.mp4", "https://fr.pinterest.com/pin/1127940669217695342/", "Impressions", 140, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-15"), "17:30", "HERO", "1127940669217929058", "Dream Journal Prompt: Write the Nouns First", "07-couloir-portes-deferlement.mp4", "https://fr.pinterest.com/pin/1127940669217929058/", "Impressions", 106, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-13"), "17:30", "HERO", "1127940669217775129", "How to Remember Dreams: Name Three Details Before Moving", "03-ville-engloutie-eruption.mp4", "https://fr.pinterest.com/pin/1127940669217775129/", "Impressions", 47, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-16"), "17:30", "HERO", "1127940669218007660", "Surreal Dreamscape: A Breaking Mirror World", "09-monde-miroir-brisure.mp4", "https://www.pinterest.com/pin/1127940669218007660/", "Impressions", 37, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-17"), "17:30", "HERO", "1127940669218087267", "How to Remember Dreams: Record the Emotion First", "HIGGS_2026-08-05_143033_JUNGLE_CRYSTAL_FPV_4c148b7e.mp4", "https://www.pinterest.com/pin/1127940669218087267/", "Impressions", 30, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
  ["Pinterest", d("2026-08-18"), "17:30", "HERO", "1127940669218169309", "Surreal Dreamscape: A Crystal Dream City", "HIGGS_2026-08-05_171605_CITY_POV_C_cecd94a1.mp4", "https://fr.pinterest.com/pin/1127940669218169309/", "Impressions", 7, null, null, null, null, "Pinterest Analytics — 30 jours (03/08–02/09)", d("2026-09-03"), "Likes/partages/enregistrements par Pin non exposés dans le tableau relevé"],
];

const storedRows = rows.map((row) => {
  const copy = [...row];
  copy[4] = row[4] ? `${row[0]}:${row[4]}` : "";
  return copy;
});

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Synthèse");
const schedule = workbook.worksheets.add("Horaires");
const history = workbook.worksheets.add("Historique");
const sources = workbook.worksheets.add("Sources et définitions");

const titleColor = "#17151E";
const accent = "#B89553";
const headerFill = "#F1F3F4";
const borderColor = "#DADCE0";
const noteFill = "#FFF8E7";
const muted = "#5F6368";

function styleTitle(sheet, range, title) {
  sheet.getRange(range).merge();
  sheet.getRange(range).values = [[title]];
  sheet.getRange(range).format = {
    font: { bold: true, size: 18, color: titleColor },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeightPx = 34;
}

function styleHeader(range) {
  range.format = {
    fill: headerFill,
    font: { bold: true, color: titleColor },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: borderColor },
  };
  range.format.rowHeightPx = 34;
}

// Historique source data.
styleTitle(history, "A1:R1", "Noctalia — historique des performances sociales");
history.getRange("A2:R2").merge();
history.getRange("A2:R2").values = [["Valeurs relevées dans les interfaces natives au 3 septembre 2026. Les cellules vides signifient “métrique non exposée”, jamais zéro supposé."]];
history.getRange("A2:R2").format = { fill: noteFill, font: { italic: true, color: muted }, wrapText: true };
history.getRange("A4:R4").values = [[
  "Plateforme", "Date publication", "Heure Paris", "Créneau", "ID publication", "Nom de la vidéo", "Fichier vidéo", "Vidéo publique", "Métrique portée", "Vues / impressions", "Likes / réactions", "Partages / reposts", "Commentaires", "Enregistrements", "Source native", "Date du relevé", "Qualité / limites", "Clé de synthèse"
]];
styleHeader(history.getRange("A4:R4"));
history.getRangeByIndexes(4, 0, storedRows.length, 17).values = storedRows;
for (let i = 0; i < rows.length; i += 1) {
  const rowNum = i + 5;
  history.getRange(`R${rowNum}`).formulas = [[`=A${rowNum}&"|"&TEXT(J${rowNum},"0")`]];
}
history.getRange(`B5:B${rows.length + 4}`).format.numberFormat = "yyyy-mm-dd";
history.getRange(`E5:E${rows.length + 4}`).format.numberFormat = "@";
history.getRange(`P5:P${rows.length + 4}`).format.numberFormat = "yyyy-mm-dd";
history.getRange(`J5:N${rows.length + 4}`).format.numberFormat = "#,##0";
history.getRange(`A5:R${rows.length + 4}`).format = {
  verticalAlignment: "top",
  wrapText: true,
  borders: { insideHorizontal: { style: "thin", color: "#ECEFF1" } },
};
history.getRange(`J5:J${rows.length + 4}`).conditionalFormats.add("dataBar", { color: accent, gradient: true });
history.freezePanes.freezeRows(4);
history.freezePanes.freezeColumns(2);
history.showGridLines = false;

const histWidths = [90, 96, 84, 68, 175, 290, 290, 300, 110, 112, 105, 110, 100, 110, 260, 100, 290, 160];
histWidths.forEach((width, idx) => history.getRangeByIndexes(0, idx, rows.length + 4, 1).format.columnWidthPx = width);

// Summary.
styleTitle(summary, "A1:J1", "Noctalia — synthèse par réseau");
summary.getRange("A2:J2").merge();
summary.getRange("A2:J2").values = [["Chaque réseau conserve sa propre définition de portée. Les vues Facebook ne sont pas additionnées aux impressions Pinterest ni aux vues des autres plateformes."]];
summary.getRange("A2:J2").format = { fill: noteFill, font: { italic: true, color: muted }, wrapText: true };
summary.getRange("A4:J4").values = [["Plateforme", "Lignes documentées", "Métrique", "Pic observé", "Nom de la vidéo", "Fichier vidéo", "Vidéo publique", "Likes / réactions", "Partages / reposts", "Périmètre"]];
styleHeader(summary.getRange("A4:J4"));

const platforms = [
  ["TikTok", "Vues", "Extrait TikTok Studio; historique partiel"],
  ["Instagram", "Vues", "Top contenus Instagram sur 30 jours"],
  ["X", "Vues", "Recherche publique partielle, sans analytics propriétaire"],
  ["YouTube", "Vues", "Top Shorts visibles dans YouTube Studio"],
  ["Facebook", "Vues", "Meta Business Suite, fenêtre 28 jours"],
  ["Pinterest", "Impressions", "Pinterest Analytics, fenêtre 30 jours"],
];
platforms.forEach(([platform, metric, scope], index) => {
  const row = index + 5;
  summary.getRange(`A${row}`).values = [[platform]];
  summary.getRange(`B${row}`).formulas = [[`=COUNTIF('Historique'!$A$5:$A$200,A${row})`]];
  summary.getRange(`C${row}`).values = [[metric]];
  summary.getRange(`D${row}`).formulas = [[`=MAXIFS('Historique'!$J$5:$J$200,'Historique'!$A$5:$A$200,A${row})`]];
  summary.getRange(`E${row}`).formulas = [[`=INDEX('Historique'!$F$5:$F$200,MATCH(A${row}&"|"&TEXT(D${row},"0"),'Historique'!$R$5:$R$200,0))`]];
  summary.getRange(`F${row}`).formulas = [[`=INDEX('Historique'!$G$5:$G$200,MATCH(A${row}&"|"&TEXT(D${row},"0"),'Historique'!$R$5:$R$200,0))`]];
  summary.getRange(`G${row}`).formulas = [[`=INDEX('Historique'!$H$5:$H$200,MATCH(A${row}&"|"&TEXT(D${row},"0"),'Historique'!$R$5:$R$200,0))`]];
  summary.getRange(`H${row}`).formulas = [[`=INDEX('Historique'!$K$5:$K$200,MATCH(A${row}&"|"&TEXT(D${row},"0"),'Historique'!$R$5:$R$200,0))`]];
  summary.getRange(`I${row}`).formulas = [[`=INDEX('Historique'!$L$5:$L$200,MATCH(A${row}&"|"&TEXT(D${row},"0"),'Historique'!$R$5:$R$200,0))`]];
  summary.getRange(`J${row}`).values = [[scope]];
});
summary.getRange("A5:J10").format = { verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: "#ECEFF1" } } };
summary.getRange("B5:B10").format.numberFormat = "#,##0";
summary.getRange("D5:I10").format.numberFormat = "#,##0";
summary.getRange("D5:D10").conditionalFormats.add("dataBar", { color: accent, gradient: true });
summary.freezePanes.freezeRows(4);
summary.showGridLines = false;
const summaryWidths = [100, 115, 95, 110, 300, 290, 310, 110, 115, 300];
summaryWidths.forEach((width, idx) => summary.getRangeByIndexes(0, idx, 11, 1).format.columnWidthPx = width);

// Slot analysis for the three primary networks.
styleTitle(schedule, "A1:H1", "Analyse des créneaux — réseaux principaux");
schedule.getRange("A2:H2").merge();
schedule.getRange("A2:H2").values = [["Moyennes calculées uniquement sur les lignes documentées. Elles servent d'indice de décision, pas de preuve causale; les tailles d'échantillon diffèrent selon le réseau."]];
schedule.getRange("A2:H2").format = { fill: noteFill, font: { italic: true, color: muted }, wrapText: true };
schedule.getRange("A4:H4").values = [["Plateforme", "Créneau", "Heure Paris", "Publications mesurées", "Moyenne vues", "Moyenne likes / réactions", "Moyenne partages / reposts", "Lecture"]];
styleHeader(schedule.getRange("A4:H4"));
const slotRows = [
  ["TikTok", "C1", "15:30"], ["TikTok", "C2", "19:30"], ["TikTok", "C3", "22:30"],
  ["Instagram", "C1", "15:45"], ["Instagram", "C2", "19:45"], ["Instagram", "C3", "22:45"],
  ["X", "C1", "16:15"], ["X", "C2", "20:15"], ["X", "C3", "23:15"],
];
slotRows.forEach(([platform, slot, time], index) => {
  const row = index + 5;
  schedule.getRange(`A${row}:C${row}`).values = [[platform, slot, time]];
  schedule.getRange(`D${row}`).formulas = [[`=COUNTIFS('Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row})`]];
  schedule.getRange(`E${row}`).formulas = [[`=IF(D${row}=0,"",SUMIFS('Historique'!$J$5:$J$200,'Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row})/D${row})`]];
  schedule.getRange(`F${row}`).formulas = [[`=IF(COUNTIFS('Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row},'Historique'!$K$5:$K$200,"<>")=0,"",SUMIFS('Historique'!$K$5:$K$200,'Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row})/COUNTIFS('Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row},'Historique'!$K$5:$K$200,"<>"))`]];
  schedule.getRange(`G${row}`).formulas = [[`=IF(COUNTIFS('Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row},'Historique'!$L$5:$L$200,"<>")=0,"",SUMIFS('Historique'!$L$5:$L$200,'Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row})/COUNTIFS('Historique'!$A$5:$A$200,A${row},'Historique'!$D$5:$D$200,B${row},'Historique'!$L$5:$L$200,"<>"))`]];
  schedule.getRange(`H${row}`).formulas = [[`=IF(D${row}=0,"Pas de données",IF(D${row}<3,"Échantillon très faible","Échantillon partiel"))`]];
});
schedule.getRange("D5:G13").format.numberFormat = "#,##0";
schedule.getRange("A5:H13").format = { verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: "#ECEFF1" } } };
schedule.getRange("E5:E13").conditionalFormats.add("dataBar", { color: accent, gradient: true });
schedule.freezePanes.freezeRows(4);
schedule.showGridLines = false;
const scheduleWidths = [100, 80, 95, 140, 120, 160, 165, 180];
scheduleWidths.forEach((width, idx) => schedule.getRangeByIndexes(0, idx, 14, 1).format.columnWidthPx = width);

// Sources and definitions.
styleTitle(sources, "A1:F1", "Sources, fenêtres et définitions");
sources.getRange("A3:F3").values = [["Plateforme", "Compte / propriété", "Fenêtre", "Métrique principale", "Source", "Limites à retenir"]];
styleHeader(sources.getRange("A3:F3"));
const sourceRows = [
  ["TikTok", "@noctaliadreams", "Instantané au 2026-09-03", "Vues vidéo", "TikTok Studio + registres Noctalia", "Extrait, pas l'intégralité des 98 publications; partages non exposés dans le relevé"],
  ["Instagram", "@noctaliadreams", "30 jours", "Vues", "Instagram Professional Dashboard", "Deux meilleurs contenus relevés; les métriques sont natives et peuvent évoluer"],
  ["X", "@NoctaliaDreams", "Recherche publique", "Vues publiques", "Recherche X from:NoctaliaDreams filter:videos", "Pas de session propriétaire; classement partiel et non exhaustif"],
  ["YouTube", "UCQZsVAOggq_meTWYG-4dHfw", "Shorts visibles", "Vues", "YouTube Studio", "Deux meilleurs Shorts documentés; likes/partages non exposés dans le tableau relevé"],
  ["Facebook", "Page 1266183263247451", "28 jours, 2026-08-05–2026-09-01", "Vues", "Meta Business Suite", "Réactions utilisées dans la colonne likes/réactions; certaines URL publiques manquent au relevé"],
  ["Pinterest", "@noctaliadreams", "30 jours, 2026-08-03–2026-09-02", "Impressions", "Pinterest Analytics", "Ne pas appeler les impressions des vues; likes/partages par Pin non exposés"],
];
sources.getRangeByIndexes(3, 0, sourceRows.length, 6).values = sourceRows;
sources.getRange("A4:F9").format = { verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: "#ECEFF1" } } };

sources.getRange("A12:F12").merge();
sources.getRange("A12:F12").values = [["Règles de lecture"]];
sources.getRange("A12:F12").format = { fill: headerFill, font: { bold: true, color: titleColor }, borders: { preset: "outside", style: "thin", color: borderColor } };
const definitionRows = [
  ["Cellule vide", "La plateforme ou le relevé n'exposait pas la métrique. Ce n'est pas un zéro."],
  ["Vues", "Compteur natif de lecture vidéo propre à la plateforme; les règles de comptage diffèrent."],
  ["Impressions Pinterest", "Nombre d'affichages du Pin; cette mesure n'est pas directement comparable aux vues vidéo."],
  ["Likes / réactions", "Likes sur TikTok/Instagram/X; réactions sur Facebook."],
  ["Partages / reposts", "Partages natifs sur Instagram/Facebook; reposts sur X."],
  ["Vidéo publique", "Lien cliquable vers la publication. Quand il est vide, l'URL n'a pas été capturée dans le relevé natif."],
  ["Nom de la vidéo", "Titre, hook ou description lisible de la publication."],
  ["Fichier vidéo", "Nom du master/asset exact lorsqu'il est connu."],
];
definitionRows.forEach(([term, definition], index) => {
  const row = index + 13;
  sources.getRange(`A${row}`).values = [[term]];
  sources.getRange(`B${row}:F${row}`).merge();
  sources.getRange(`B${row}:F${row}`).values = [[definition]];
});
sources.getRange("A13:A20").format = { font: { bold: true, color: titleColor }, fill: "#FAFAFA" };
sources.getRange("A13:F20").format.wrapText = true;
sources.getRange("A13:F20").format.verticalAlignment = "top";
sources.getRange("A13:F20").format.borders = { insideHorizontal: { style: "thin", color: "#ECEFF1" } };
sources.freezePanes.freezeRows(3);
sources.showGridLines = false;
const sourceWidths = [135, 180, 180, 140, 270, 390];
sourceWidths.forEach((width, idx) => sources.getRangeByIndexes(0, idx, 21, 1).format.columnWidthPx = width);

await fs.mkdir(outputDir, { recursive: true });

const checks = [];
checks.push((await workbook.inspect({ kind: "table", range: "Synthèse!A1:J10", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 10 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "Horaires!A1:H13", include: "values,formulas", tableMaxRows: 15, tableMaxCols: 8 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: `Historique!A1:R${rows.length + 4}`, include: "values,formulas", tableMaxRows: 8, tableMaxCols: 18 })).ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
checks.push(errors.ndjson);
await fs.writeFile(`${outputDir}/verification.txt`, checks.join("\n"), "utf8");

for (const [sheetName, range, file] of [
  ["Synthèse", "A1:J10", "preview-synthese.png"],
  ["Horaires", "A1:H13", "preview-horaires.png"],
  ["Historique", "A1:R18", "preview-historique.png"],
  ["Sources et définitions", "A1:F20", "preview-sources.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.2, format: "png" });
  await fs.writeFile(`${outputDir}/${file}`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, rowCount: rows.length, sheets: ["Synthèse", "Horaires", "Historique", "Sources et définitions"] }));
