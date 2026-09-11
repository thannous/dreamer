# Noctalia — bilan J56, 9 septembre 2026

J1 = 16 juillet ; J56 = 9 septembre. Le précédent nom de lot J52 désignait des analyses du 7 septembre (J54 réel). Ce bilan reprend ces analyses sans confondre leurs dates avec les relevés du jour.

Dossier Drive : https://drive.google.com/drive/folders/1THK2zOMCFhT-GjVB1WbuJ4jmDkenhc2O

## 1. Performance GSC : données finalisées au 6 septembre

Lecture API directe sc-domain:noctalia.app, Web. Le 7 septembre est la première date incomplète. Comparaisons sur URL exacte sans fragments, mêmes jours de semaine ; jour de publication exclu.

| Page | Avant / après | Clics avant → après | Impressions avant → après | Décision |
|---|---|---|---|---|
| Árbol ES | 27–30 août / 3–6 septembre | 43 → 46 | 4 979 → 4 752 | Conserver, seulement quatre jours post-publication. |
| Pidocchi IT | 27–30 août / 3–6 septembre | 2 → 2 | 807 → 823 | Volume trop faible, conserver. |
| Travail EN | 26–30 août / 2–6 septembre | 0 → 0 | 189 → 172 | Cinq jours seulement ; aucun verdict. |
| False-awakening EN | 26–30 août / 2–6 septembre | 0 → 0 | 0 → 0 | Nouvelle URL : état avant nul, pas un test CTR comparable à une page existante. Aucune impression renvoyée. |

Les dates de publication reprises des journaux sont cohérentes avec Git ; les déploiements historiques Cloudflare exacts n’ont pas été reconstitués. État public actuel des quatre URL : HTTP200 et canonical propre.

J+7 complet hors jour de publication : attendre la finalisation du 8 septembre pour travail/false-awakening et du 9 septembre pour árbol/pidocchi. Les petits écarts ne prouvent pas un effet du patch.

Bilan site sur 28 jours : 10 août–6 septembre = 6 885 clics / 822 858 impressions ; période précédente 13 juillet–9 août = 4 273 / 491 150. Ce bilan global n’est pas une baseline causale de casa.

Détails et données : gsc/report.md et fichiers GSC associés.

## 2. Hospital ES : prêt pour décision de publication

Master distant rafraîchi 84c85a9aa77bc24a6a4a05723a623600dc519b7e. Patch de deux champs préparé et validé dans une copie isolée, durable dans hospital/hospital-es.patch. Aucun report global de la branche historique.

- Titre rendu : **Soñar con un hospital: estar allí o verlo lleno | Noctalia**.
- Description : **¿Qué significa soñar con un hospital? Compara estar allí, verlo lleno de gente, enfermos o personal médico según tu emoción y contexto, sin predicciones.**
- Build et contrôles finaux PASS : 1 261 URL sitemap, zéro erreur et avertissement.
- Revue indépendante PASS sur l’arbre final : seuls les deux champs hospital.es changent. Sorties de build hors périmètre restaurées et exclues.
- Aucun commit, push ou déploiement. Détails : hospital/report.md et independent-review.md.

## 3. Rentrée : découverte toujours non résolue

Au 9 septembre : 6 URL détectées/non indexées et 4 inconnues, contre 9/1 au 7 septembre. FR/DE/IT adultes passent à « inconnue », ES adulte le reste. Ce changement ne prouve pas une désindexation : aucune de ces pages n’était déclarée indexée au relevé précédent.

Les dix pages répondent 200, canonical/robots/sitemap restent corrects. Aucune date de crawl n’est fournie par les inspections. Du 2 septembre au 9 septembre 09:45 UTC, les données Cloudflare montrent 203 requêtes externes estimées, toutes HTTP200, et aucun UA Googlebot sur les dix chemins. Les 98 réponses 504 sont des sous-requêtes Early Hints internes, pas des erreurs envoyées aux visiteurs. Le contrôle positif trouve bien des Googlebot classés vérifiés ailleurs sur le domaine. Données adaptatives et accès logs bruts limités : absence de passage observé, pas preuve absolue d’absence. Cause profonde toujours indéterminée. Voir rentree/report.md.

## 4. Casa : pas de rollback justifié

Baseline strictement pré-publication : 11 juillet–7 août, contre 9 août–5 septembre (28 jours, 8 août exclu). Page : 39 → 32 clics, 5 482 → 9 588 impressions.

99 cohortes identiques requête × pays × appareil : 9 → 7 clics, 1 133 → 1 656 impressions, CTR 0,794 % → 0,423 %. Après pondération par les impressions initiales, CTR après 0,409 % : le simple changement de mix n’explique pas toute la baisse dans ce sous-ensemble.

Mais les lignes détaillées ne couvrent que 22,27 % puis 18,78 % des impressions page ; échantillon de clics faible, requêtes anonymisées et autres facteurs non contrôlés. Aucun lien causal avec le title n’est établi. Conserver casa et suivre les mêmes cohortes ; les requêtes eau/inondation prennent davantage de place, sans créer de nouvelle page ni toucher aux propriétaires existants.

## 5. Histoire EN : préparation sourcée livrée

history-en.md contient le tableau affirmation/source et huit blocs de texte proposés, sans modification produit.

Correction majeure : le 65 % de l’étude Fosse concerne 299 rapports recueillis auprès de 29 personnes, pas 65 % du contenu des rêves. Le lien Freud actuel pointe vers un autre ouvrage. Les généralisations culturelles et les interprétations certaines doivent être réduites ou sourcées précisément. Vérification directe du catalogue British Museum encore requise avant d’intégrer sa date.

Prochain lot éditorial : implémenter cette révision EN bornée et synchroniser FAQ/bibliographie ; chute ES reste ensuite. Les propositions restent des brouillons agent, non des textes publiés.

## 6. Ahrefs

Relevé authentifié terminé, compteur web **33 → 33**, aucun crédit général supplémentaire observé. Starter mensuel, reset affiché le 16 septembre à 00:00 UTC. Les 50 couples suivis et tags sont sauvegardés ; aucun changement.

- Dernier Site Audit toujours celui du 7 septembre : HS100, 1 709 URL, 1 267 internes, 1 erreur, 42 avertissements, 212 notices. Aucun nouveau crawl J56. Prochain créneau attendu le lundi 14 septembre d’après la planification affichée.
- Rank Tracker desktop, toutes localisations, comparaison affichée 9 septembre/9 août : Share of Voice 1,8 % (−1,5 point), trafic estimé 335 (−272), 20/50 dans le top10 et 27 non classés.
- Ces positions sont marquées « 3 d ago » ; l’incident Ahrefs de données de classement Google reste affiché. **Ne pas conclure à une chute réelle ni modifier les expériences sur ces seules alertes.**
- Trois couples hospital affichent la position1 ; travail/histoire EN sont indiqués Lost. Aucun suivi dédié casa IT, árbol, pidocchi ou false-awakening : GSC reste la mesure pertinente.
- Aucun nouveau rapport payant Site Explorer/Keywords Explorer. Les volumes pain/œufs/tiques restent ceux du 7 septembre, non rafraîchis.

Détails, limites et sources : ahrefs/README.md et trois réponses API archivées.

## Périmètre et limites

Aucune dépense Ahrefs, demande d’indexation, modification des 50 suivis ou envoi externe n’est autorisée par ce bilan. Le WIP initial du dépôt principal et l’ancien worktree est préservé. Source produit hospital uniquement dans la copie isolée ; patch durable ci-joint. Les preuves techniques locales, revue, CI, production et mesures restent des états distincts.


## Mise à jour : implémentation locale après validation du plan

Hospital ES et histoire EN sont désormais implémentés dans le worktree persistant /Users/tanuki/Documents/noctalia-j56-implementation, branche codex/seo-j56-implementation. Build, contrôles et revue indépendante PASS. Aucun commit, push ou déploiement. Les anciennes sections de préparation ci-dessus décrivent le relevé initial ; ce statut d’implémentation les complète. Preuves et patch, sans ZIP : https://drive.google.com/drive/folders/1vzPPqVuLh0x3hi1qX7hTWnNNg_GN9H68


## Livraison finale autorisée — 9 septembre 2026

Hospital ES et histoire EN sont publiés : PR #161 fusionnée sur master (`b800c3a`), Cloudflare production PASS sur `e84dff0`, qui inclut cette fusion sans modifier les deux fichiers SEO. Vérification publique à 12:37 Paris : HTTP 200, metadata/canonical/sitemap et corrections éditoriales conformes. Les états locaux et brouillons décrits précédemment sont historiques. Détails et preuves : publication/README.md et https://drive.google.com/drive/folders/1I-XVbbuB5q_9v7IChJYuggEUhPpmfJ6H
