# Noctalia — J10 Ahrefs Starter : priorisation SEO

Date de consolidation : 25 juillet 2026

Projet Ahrefs : `9361004`

Portée : priorisation et intégrité éditoriale, sans modification des cinq URL SEO retenues

Crédits Ahrefs consommés pendant ce lot : `0`

## Décision

Le portefeuille J10 est retenu comme base des fiches J11–J14 : cinq URL principales et trois réserves. Pour les cinq principales, la seule variable proposée est le couple `title + meta description`. Aucun contenu, FAQ, maillage, image, donnée structurée ou URL n’est à modifier dans la même expérience.

Les données GSC disponibles couvrent 90 jours et s’arrêtent au 7 juillet 2026. Elles comportent donc un angle mort de 18 jours au moment de la consolidation. Le tableau ci-dessous reprend le snapshot J10 communiqué ; le classeur brut et son onglet E n’étaient pas présents dans le dépôt ou les archives privées accessibles à ce worktree, donc les impressions et clics manqués ne sont pas présentés comme un recalcul indépendant.

| Rang | URL | Source éditable | ID | Impressions 90 j | Position | Clics manqués | Décision |
|---|---|---|---|---:|---:|---:|---|
| P1 | `/es/simbolos/escaleras` | `data/dream-symbols.json` | `stairs` | 13 910 | 8,2 | 385 | Fiche principale |
| P2 | `/es/simbolos/boca` | `data/dream-symbols.json` | `mouth` | 8 464 | 6,3 | 340 | Fiche principale |
| P3 | `/es/simbolos/arbol` | `data/dream-symbols.json` | `tree` | 8 794 | 8,3 | 234 | Fiche principale |
| P4 | `/it/simboli/scuola` | `data/dream-symbols.json` | `school` | 3 479 | 7,1 | 111 | Fiche principale |
| P5 | `/es/simbolos/ascensor` | `data/dream-symbols.json` | `elevator` | 4 286 | 9,7 | 86 | Fiche principale |
| R1 | `/es/simbolos/caida` | `data/dream-symbols.json` | `falling` | 4 335 | 3,4 | 470 | Réserve, cannibalisation à arbitrer |
| R2 | `/it/simboli/pioggia` | `data/dream-symbols.json` | `rain` | 6 372 | 8,3 | 179 | Réserve, actualisation GSC requise |
| R3 | `/it/simboli/correre` | `data/dream-symbols.json` | `running` | 2 022 | 7,9 | 62 | Réserve |

Les enrichissements longs associés à ces symboles peuvent aussi se trouver dans `data/dream-symbols-extended.json`, mais ce fichier est hors périmètre de l’expérience `title + meta description`.

## Règles de mesure

- Faire valider séparément le nouveau `title` et la nouvelle `meta description` de chaque page avant édition.
- Ne changer qu’une seule fois les deux champs approuvés sur les cinq pages principales.
- Ne pas modifier simultanément le corps, les FAQ, le maillage, les images, le schema ou la cible canonique.
- Annoter la date de publication et conserver les snippets avant/après.
- Première fenêtre de lecture : jusqu’au 8 août 2026, sans conclure trop tôt à un effet SEO.
- Ne pas interpréter les données actuelles comme fraîches tant qu’un nouvel export GSC n’a pas été produit.

Commande locale prévue pour l’actualisation GSC :

```text
node scripts/export-search-console.js
```

Si les données fraîches confirment le potentiel de `/it/simboli/pioggia` sans brouiller sa mesure depuis le 10 juillet, cette réserve doit être réévaluée avant toute substitution dans le top 5.

## Gel et cannibalisation

Le gel doit être calculé symbole par symbole à partir de l’historique réel, et non à partir de la date du fichier monolithique `data/dream-symbols.json`. Le snapshot J10 indique 148 éléments gelés sur 220.

Actifs majeurs encore gelés :

- dictionnaire allemand : 348 clics, sortie de gel prévue entre le 6 et le 7 août ;
- article espagnol sur les rêves d’eau : 615 clics, sortie de gel prévue entre le 6 et le 7 août ;
- `/it/simboli/porta` : 515 clics, sortie de gel prévue entre le 6 et le 7 août.

`/es/simbolos/caida` reste en réserve malgré son potentiel : 10,7 % de cannibalisation observée avec `blog.falling-dreams-meaning`, lui-même gelé jusqu’au 1er août. Cette date débloque aussi les arbitrages `volare`, `examen` et `inseguimento`.

Le signal principal du portefeuille est le déficit de CTR, pas l’absence de ranking. Exemple interne à contrôler avec le prochain export : `boca` en espagnol affiche 0,48 % de CTR à la position 6,3, contre 1,30 % à la position 7,5 pour la version française.

## Contrôle des références signalées

| Référence | Résultat | Action |
|---|---|---|
| PMID `11476655` | Étude JAMA 2001 sur l’Imagery Rehearsal Therapy chez des survivantes d’agression sexuelle avec PTSD ; référence exacte mais non probante pour un guide sur l’incubation des rêves | Retirée des quatre variantes qui la citaient dans `blog.dream-incubation-guide` |
| PMID `26375320` | Cho et al. (2015), revue sur les effets de la lumière artificielle nocturne sur la santé | Conservée : titre, auteurs, année et usage sur l’environnement de sommeil sont cohérents |
| PMID `40704570` | Pasquier et al., publication 2026, étude d’un surmatelas à haute conductivité thermique pendant une nuit chaude | Conservée, mais libellé resserré dans les cinq langues pour ne plus généraliser l’étude à toute l’architecture du sommeil |
| PMID `24780135` | Lara-Carrasco et al. (2014), étude des rêves perturbants au troisième trimestre de grossesse | Ajoutée aux variantes DE, EN et IT sans retirer la source 2007 déjà valide |

Références primaires vérifiées : [PMID 11476655](https://pubmed.ncbi.nlm.nih.gov/11476655/), [PMID 26375320](https://pubmed.ncbi.nlm.nih.gov/26375320/), [PMID 40704570](https://pubmed.ncbi.nlm.nih.gov/40704570/), [PMID 24780135](https://pubmed.ncbi.nlm.nih.gov/24780135/).

## Pages corrigées à la suite de l’audit de qualité

Les corrections ci-dessous portent sur l’intégrité des affirmations et sources. Elles ne touchent aucune des huit URL du portefeuille J10.

| Famille de page | Langues modifiées | Correction |
|---|---|---|
| `blog.dream-journal-guide` | EN, ES, FR, IT | Citation attribuée non sourcée remplacée par un texte prudent |
| `blog.flying-dreams-meaning` | EN, FR, IT | Deux citations attribuées non sourcées remplacées par des formulations prudentes |
| `blog.pregnancy-dreams-meaning` | DE, EN, ES, FR, IT | Deux citations attribuées non sourcées remplacées par des formulations prudentes |
| `blog.stop-nightmares-guide` | EN, ES, FR, IT | Citation attribuée non sourcée remplacée par un texte prudent |
| `blog.dream-incubation-guide` | DE, EN, FR, IT | Retrait de PMID `11476655`, hors sujet pour l’incubation |
| `blog.heat-stress-nightmares` | DE, EN, ES, FR, IT | Libellé de PMID `40704570` aligné sur la portée réelle de l’étude |

Total : 25 fichiers éditoriaux corrigés.

## Point d’arrêt

- Les cinq pages principales ne sont pas modifiées dans ce lot.
- Les propositions exactes de `title` et `meta description` relèvent des fiches J11–J14 et nécessitent une validation explicite avant édition.
- Aucun achat, add-on, analyse Ahrefs supplémentaire ou déploiement n’est inclus.
- La fusion locale dans `master` ne vaut ni push ni publication.
