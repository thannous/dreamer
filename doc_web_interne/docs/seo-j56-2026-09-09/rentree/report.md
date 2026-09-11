# J56 — Rentrée : inspections et preuves CDN

Relevé du **9 septembre 2026**, inspections terminées à **09:49:34 UTC**. Lecture seule : aucune demande d’indexation, modification de contenu, réglage Cloudflare ou activation de logs.

## Résultat

Les dix URL restent non indexées dans les résultats d’inspection : **6 détectées/non indexées et 4 inconnues**, contre 9 détectées/non indexées et 1 inconnue le 7 septembre. Les pages adultes FR, DE et IT sont désormais « URL is unknown to Google ». Ce changement de statut ne prouve ni une désindexation (elles n’étaient pas indexées), ni une pénalité, ni sa cause.

| URL (sur https://noctalia.app) | 7 septembre | 9 septembre |
|---|---|---|
| /en/blog/back-to-school-dreams-meaning | Détectée, non indexée | Détectée, non indexée |
| /fr/blog/rever-retourner-ecole | Détectée, non indexée | Inconnue |
| /de/blog/traum-zurueck-in-die-schule | Détectée, non indexée | Inconnue |
| /es/blog/sonar-volver-escuela | Inconnue | Inconnue |
| /it/blog/sognare-tornare-scuola | Détectée, non indexée | Inconnue |
| /en/blog/back-to-school-nightmares-children | Détectée, non indexée | Détectée, non indexée |
| /fr/blog/cauchemars-rentree-enfant | Détectée, non indexée | Détectée, non indexée |
| /de/blog/albtraeume-schulanfang-kinder | Détectée, non indexée | Détectée, non indexée |
| /es/blog/pesadillas-vuelta-al-cole-ninos | Détectée, non indexée | Détectée, non indexée |
| /it/blog/incubi-rientro-scolastico-bambini | Détectée, non indexée | Détectée, non indexée |

Chaque inspection API a répondu HTTP200 ; aucun `lastCrawlTime` n’est fourni. Les six résultats « détectée » référencent le sitemap. Les dix vérifications HTTP publiques ont répondu **200**, avec canonical propre, meta robots `index, follow`, aucun X-Robots-Tag et présence exacte dans le sitemap. Le robots.txt public autorise `/` et référence `https://noctalia.app/sitemap.xml`. Ce sont nos requêtes HTTP ; elles ne constituent pas un test live effectué par Googlebot. Le maillage contrôlé le 7 septembre est une preuve historique, non réactualisée dans ce lot.

## Cloudflare : ce qui est observable

Zone `noctalia.app`, identifiant `0176cc0f4b4e08556d4f2de38c135594`, plan retourné `Free Website`.

Disponibilité confirmée par GraphQL : `httpRequestsAdaptiveGroups.enabled=true`, `maxDuration=86400` secondes par requête, `notOlderThan=691200` secondes (8 jours), `maxPageSize=10000`. `firewallEventsAdaptiveGroups.enabled=false`, avec durée/rétention retournées à zéro. La lecture de la liste Logpush est refusée avec code 10000 « Authentication error » ; la lecture du drapeau de rétention des logs bruts avec code 10000 « Unauthorized ». **Cela ne prouve pas qu’aucun export de logs n’existe ni que la rétention est désactivée.**

Huit fenêtres contiguës, du **2 septembre 00:00 UTC au 9 septembre 09:45 UTC**, ont été interrogées sur les dix chemins exacts et le host `noctalia.app`. Les sept premiers jours sont complets, le 9 septembre est partiel. Limite 10000 groupes, maximum constaté 86 par fenêtre : aucune troncature par cette limite. Les paramètres et résultats sont conservés dans `cloudflare-evidence.json`.

| Jour UTC | Requêtes externes estimées (`eyeball`) | Sous-requêtes Early Hints estimées |
|---|---:|---:|
| 2 septembre | 21 | 10 |
| 3 septembre | 18 | 14 |
| 4 septembre | 27 | 12 |
| 5 septembre | 21 | 8 |
| 6 septembre | 10 | 7 |
| 7 septembre | 81 | 34 |
| 8 septembre | 13 | 4 |
| 9 septembre, jusqu’à 09:45 | 12 | 9 |
| **Total** | **203** | **98** |

Les 203 requêtes externes retournées sont toutes HTTP200. Aucune ligne avec UA contenant Googlebot n’apparaît sur ces dix chemins, donc **aucun passage Googlebot authentifié ni refus 403/429/5xx Googlebot n’est observé dans cette fenêtre**. La réponse contient 263 groupes, dont six ont un intervalle d’échantillonnage moyen supérieur à 1 : il s’agit de données adaptatives, pas d’un journal exhaustif. L’absence de ligne ne démontre pas l’absence absolue de passage. Les passages antérieurs au 2 septembre, variantes de host/chemin et événements non représentés ne sont pas couverts.

Les 98 réponses 504 appartiennent exclusivement à `requestSource=earlyHintsCache`, UA `nginx-ssl early hints`. Cloudflare décrit ces réponses comme des recherches internes de cache Early Hints manquantes, sans erreur envoyée au visiteur ou requête vers l’origine. **Elles ne démontrent donc pas une panne des articles ni un refus de Googlebot.** [Documentation Cloudflare](https://developers.cloudflare.com/logs/faq/504-origin-status-0/).

Un contrôle positif limité au domaine, le **8 septembre**, retourne 353 requêtes avec UA Googlebot : 349 classées `verifiedBotCategory=Search Engine Crawler` et 4 sans catégorie vérifiée. Les 349 vérifiées ont reçu 339 HTTP200 et 10 HTTP301 ; elles comprennent 148 Googlebot-Image. Les 4 non vérifiées ne sont pas présentées comme authentiques ni comme usurpées. Ce contrôle confirme que cette source sait montrer des passages Googlebot sur le domaine ; il ne prouve aucun passage sur les dix URL et n’est pas un audit du domaine. Le champ `botManagementDecision` a été refusé pour cette zone ; la catégorie du bot vérifié est, elle, accessible. [Référence Cloudflare des catégories](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/).

## Décision J56

**Cause profonde toujours indéterminée.** La télémétrie disponible va dans le sens d’un manque de crawl observé sur ces URL plutôt que d’un refus HTTP démontré. Cette inférence est bornée aux dates, chemins et à l’échantillonnage ci-dessus ; elle n’explique pas la sélection de crawl de Google.

Conserver les pages, canonical, sitemap et liens existants. Ne pas corriger les 504 internes ni réécrire les articles sur ce seul signal. Au prochain point de mesure, reprendre en priorité les quatre URL adultes inconnues et vérifier l’apparition d’un `lastCrawlTime` ou d’un statut différent. Aucune automatisation de suivi créée. Une conclusion historique plus forte exigerait des logs archivés accessibles sur la période de publication, avec identification du bot ; leur existence et leur accès restent inconnus.

## Preuves conservées

- `inspections-http.json` : dix inspections GSC et contrôles publics J56.
- `baseline-2026-09-07.json` : résultats J52 préexistants, copiés sans modification.
- `cloudflare-evidence.json` : paramètres, fenêtres, lignes compactées sans perte de champs sélectionnés, limitations d’accès et contrôle positif ; aucune adresse IP ou information d’authentification collectée.
- `inspect.cjs` : script d’inspection repris du J52 ; réutilise l’authentification du script projet sans imprimer le jeton.

Référence de contexte local : `doc_web_interne/docs/seo-recovery-2026-09-09/j52-hospital-rentree-articles-2026-09-07.md`. Aucun fichier produit ou WIP préexistant modifié.
