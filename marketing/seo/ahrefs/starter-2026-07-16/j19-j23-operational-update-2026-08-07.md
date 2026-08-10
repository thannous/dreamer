# Noctalia — mise à jour opérationnelle Ahrefs Starter, J19 à J23

Date de consolidation : 7 août 2026
Projet Ahrefs : Noctalia `9361004`
Périmètre : synthèse durable sans données GSC brutes ni requêtes détaillées

## Résumé exécutif

J19 à J23 ont servi à mesurer la progression organique, relire le dernier crawl, trier les opportunités de maillage et préparer le point de décision du 8 août. Aucun test de métadonnées n'a été publié : les mouvements observés restent donc des baselines et non une preuve d'impact causal.

Le diagnostic au 7 août est stable : `/it/simboli/scuola` est le premier candidat provisoire pour un test limité au document `<title>` et à la meta description ; `/es/simbolos/ascensor` reste le second. Les autres pages dont la croissance organique est déjà forte ne doivent pas être perturbées.

## État Ahrefs vérifié

- plan : Starter, facturé mensuellement ;
- prochaine facturation et remise à zéro : 16 août 2026 UTC ;
- crédits généraux utilisés : 63 ;
- Rank Tracker : 50/50 ;
- Site Audit : 1 147/10 000 ;
- dernier crawl visible : 3 août 2026 ;
- Health Score du dernier crawl : 100 ;
- crédit général confirmé consommé par J19–J23 : 0 ;
- nouveau crawl lancé par J19–J23 : 0.

Le passage antérieur de 62 à 63 crédits n'est attribué à aucun lot faute de relevé immédiatement avant l'événement. Il n'est pas imputé artificiellement à J19.

## J19 — nouveau snapshot Rank Tracker

Le snapshot mobile du 2 août est le premier relevé nouveau depuis J16 : 7 progressions, 6 reculs, 6 nouvelles entrées et aucune disparition. La France présente trois gains et trois nouvelles entrées sans recul dans le portefeuille suivi, ce qui soutient son statut de prochain marché d'exécution sans autoriser une édition.

Le portefeuille des cinq priorités et trois réserves n'est couvert par aucun couple direct. Rank Tracker ne peut donc pas servir de KPI pour `scuola` ou `ascensor` ; GSC reste l'autorité de mesure.

## J20 — mesure GSC

Deux fenêtres consécutives de 28 jours ont été comparées, ainsi qu'un contexte de 90 jours et une première lecture de la vague éditoriale 2.

| Indicateur global | 6 juillet–2 août | 8 juin–5 juillet |
|---|---:|---:|
| Clics | 4 162 | 2 042 |
| Impressions | 453 212 | 289 085 |
| CTR | 0,918 % | 0,706 % |
| Position moyenne | 7,25 | 8,87 |

La shortlist 5+3 passe de 82 à 296 clics et de 20 317 à 42 286 impressions. Cette croissance est antérieure à tout test metadata. Les cinq articles de la vague éditoriale 2 restent gelés jusqu'au 25 août : six jours de données ne suffisent pas pour attribuer un effet à l'audit de qualité.

## J21 — Site Audit et France

Le crawl du 3 août affiche un Health Score de 100, 0 erreur, 44 avertissements et 1 314 notices. Les trois candidats français préparés sont :

1. `/fr/symboles/porte` — candidat principal, aucune édition autorisée ;
2. `/fr/blog/guide-journal-reves` — attendre le 9 août ;
3. `/fr/blog/signification-reves-recurrents` — attendre le 17 août.

Les intentions françaises étudiées sont déjà couvertes par des URL existantes. Il n'y a donc pas de justification pour créer une « vague éditoriale 3 » ; le travail futur doit rester un lot d'optimisation des pages existantes.

## J22 — maillage interne

Le rapport natif contenait six lignes, soit quatre couples source-cible uniques après déduplication. Aucun ne ciblait les cinq priorités, les trois réserves ou les trois candidates françaises.

- une suggestion anglaise reste au backlog ;
- deux suggestions allemandes attendent un arbitrage d'intention ;
- une suggestion espagnole attend l'arbitrage article contre fiche symbole ;
- la cible `/Inicio/Símbolos` a été rejetée car elle répond HTTP 404.

Aucun lien interne ne doit être ajouté pendant la même fenêtre qu'un test metadata.

## J23 — baseline préparatoire

La fenêtre courante GSC du 9 juillet au 5 août a été comparée au 11 juin–8 juillet.

| Indicateur global | Courant | Précédent |
|---|---:|---:|
| Clics | 4 247 | 2 224 |
| Impressions | 467 656 | 298 904 |
| CTR | 0,908 % | 0,744 % |
| Position moyenne | 7,20 | 8,70 |

Pour la shortlist 5+3 : 317 clics contre 85, 44 648 impressions contre 21 111, CTR 0,710 % contre 0,403 %, position 6,10 contre 7,51.

Les onze URL de décision répondaient HTTP 200, étaient indexables, auto-canoniques et dotées des hreflang attendus. Leurs sources éditables étaient inchangées depuis la clôture J10.

## Décision au 7 août

| Cible | État | Motif |
|---|---|---|
| `/it/simboli/scuola` | premier candidat provisoire | demande stable, CTR 0,322 %, position 5,99 |
| `/es/simbolos/ascensor` | second test seulement | demande +8,80 %, CTR déjà à 0,787 % |
| `escaleras`, `boca`, `arbol`, `pioggia`, `correre` | observer | croissance organique déjà forte |
| `/es/simbolos/caida` | maintenir en réserve | demande en baisse et intention à clarifier |
| candidats France | suivre leurs gels propres | contrat de test distinct requis |

## Point d'arrêt

La prochaine étape est J24 le 8 août : actualiser la dernière journée GSC complète, vérifier une dernière fois `scuola`, puis rendre un verdict `GO / WAIT / DROP`. Même un verdict `GO` n'autorise aucune modification sans une autorisation locale distincte. Commit, push, déploiement et demande d'indexation restent également séparés.
