# Reprise SEO Noctalia — 9 septembre 2026

Tâche source : codex://threads/019fe92b-ef67-7b32-b2d5-b3001c9d4de6 (« 📈 [SEO] Noctalia — publication J42 »).
L’API de lecture retrouve la tâche mais ne restitue aucun tour. Les documents et le diff ont été retrouvés physiquement le 9 septembre dans /Users/tanuki/.codex/worktrees/1cba/dreamer. Aucun historique complet de conversation n’est revendiqué.

## Emplacements et sauvegarde

- Source principale : /Users/tanuki/.codex/worktrees/1cba/dreamer/marketing/seo/ (277 fichiers).
- Index historique : marketing/seo/ahrefs/starter-2026-07-16/README.md.
- Lire en premier : j52-hospital-rentree-articles-2026-09-07.md (état le plus récent), puis j52-plan-editorial-2026-09-07.md et j52-ahrefs-keyword-gates-2026-09-07.csv.
- Inventaire CSV : chaque source absolue, chemin dans le ZIP, taille et SHA256. Le ZIP documents conserve toute l’arborescence SEO du worktree ; il est une sauvegarde, pas une nouvelle version validée de tous les documents historiques.
- Exports sources : /private/tmp/noctalia-j52-gsc/ et les deux JSON rentrée ; sauvegardés dans preuves-gsc-rentree-j52.zip. La fenêtre 10 août–6 septembre est incomplète (27 dates) et exclue du bilan ; conservée seulement pour traçabilité.
- Archive Drive privée existante : https://drive.google.com/drive/folders/1dZO9n8VbFIjkXwcvKeR3zuwqvJXJwwv1
- Dossier de cette reprise : https://drive.google.com/drive/folders/1HYYMA6fLrEcoX6-XU-D3JpMGFIMZ0vQ7
- Les sources originales restent en place. Aucun secret/configuration, journal de conversation ou document social n’est inclus dans cette sauvegarde.

## État SEO récupéré, daté du 7 septembre — pas de mesure live le 9

GSC sc-domain:noctalia.app, Web, période finalisée 9 août–5 septembre comparée à 12 juillet–8 août : 6 700 clics, 806 169 impressions, CTR 0,831 %, position 7,10. Clics +56,9 %, impressions +65,8 %. Croissance globale, sans attribution causale aux modifications.

Ahrefs : projet 9361004 ; dernier audit documenté 7 septembre, HS100, 1 erreur, 42 avertissements, 212 notices. Dernier compteur web 33, avec 7/10 crédits consommés dans le lot autorisé ; ce reliquat historique ne constitue pas une nouvelle autorisation. Facturation/reset observé prévu le 16 septembre, à revalider. Conserver les 50 couples Rank Tracker.

## Ordre pour continuer

1. Hospital ES : deux ajouts metadata dans data/dream-symbols.json, encore non commités dans le worktree constaté le 9 septembre. Patch sauvegardé. Build/check et revue PASS selon note du 7 septembre, non relancés aujourd’hui. Repartir du master courant et transférer seulement ces deux champs ; revérifier, puis obtenir GO publication. Ne pas fusionner toute la branche historique. Aucun état public actuel déduit du diff local.
2. Rentrée : au 7 septembre, 9 URL détectées/non indexées et 1 inconnue (ES retour école adulte). Les 10 répondaient 200 avec canonical/sitemap/robots corrects et au moins trois sources de liens dans leur langue. Cause indéterminée. Prochaine action : logs CDN/Googlebot authentifié puis nouvelle lecture GSC. Ne pas inventer une pénalité qualité ni ajouter des liens redondants.
3. Éditorial : histoire EN en premier (6 clics/3 650 impressions/position14,08), chute ES ensuite (0/1 519/9,34). Vérifier les assertions et sources ; un article par lot, revue, validation, publication autorisée, mesures J+7/J+28.
4. Casa : analyser cohortes stables, pays/appareils avant rollback ; maintenir ragno et traiter perro séparément. Préserver les expériences scuola, flying, precognitive, travail, arbol/pidocchi.
5. Checkpoints : arbol/pidocchi J+7 au 9 septembre seulement après finalisation GSC ; travail FR/DE/ES/IT J+7 au 13 septembre. Les dates de mesure ne sont pas des autorisations d’édition.
6. Nouveaux symboles : pain d’abord, œufs ensuite, tiques en réserve. Gate DE pain/tiques et FR œufs incomplet ; pas de GO multilingue ni de valeur manquante transformée en zéro.

## Cadre de reprise

Éditer docs-src/ et data/, jamais docs/ généré. Préserver le WIP. Pas de dépense Ahrefs, demande d’indexation, publication, abonnement ou envoi de prospection autorisé par cette récupération. Vérifier les métriques fraîches avant décision. Le plan J52 antérieur est supersédé sur le diagnostic rentrée par la note hospital/rentrée.
