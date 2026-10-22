# Progression Dreamer — intégration du 22 octobre 2026

Responsable : lot parent Codex. Trois priorités développées en parallèle et réunies dans le checkout isolé `dreamer-progression`, branche `codex/dreamer-progression-20261022`. Base : `master` `4403a8b16` (PR #552). Le correctif final Claude `d432ff0e5`, absent de cette fusion déjà effectuée, a été repris sous `5589e72ef`. Fonctionnalités et correctifs de continuité : `30e93d170` ; ajustement final de navigation E2E : `68f42e56a`. Les corrections finales de registre linguistique et de fixture de test sont décrites ci-dessous. Le checkout principal et son travail en cours sont préservés.

## Fonctionnalités

- **Conservation des badges** : sauvegarde par compte, restauration sur un navigateur vierge, union des progrès de plusieurs appareils et conservation des dates d’acquisition. État de sauvegarde visible, reprise hors ligne, isolation des comptes et suppression avec le compte.
- **Redécouverte et notes personnelles** : invitation discrète à relire un rêve d’au moins 30 jours, sans condition d’analyse. Notes datées ajoutables, modifiables et supprimables, séparées du récit original et du contexte IA ; persistance locale et synchronisation du journal existantes.
- **Parcours de guides** : huit guides avec visite, signet de section, reprise et achèvement explicite. Les exercices restent facultatifs. Une simple ouverture ne débloque plus de nouvelle récompense de lecture ; les badges déjà acquis restent conservés.

Détails : [badges](badge-continuity-20261022.md), [redécouverte et notes](dream-rediscovery-personal-notes-20261022.md), [guides](../guide-reading-progression.md). Les interfaces sont traduites dans les six langues.

## Preuves fonctionnelles intégrées

Runtime : Supabase **local natif** possédé par le runner, Auth/Postgres/PostgREST réels, trois comptes synthétiques par scénario, aucun appel externe IA/OAuth/paiement. Node **24.22.1**, Supabase CLI **2.121.0**, TesterArmy **0.21.2**, moteur web **0.15.2**, Playwright **1.64.0**. Les stacks locales sont détruites par leur runner après chaque exécution.

Les preuves ci-dessous constituent une **union de 9 scénarios backend et 3 scénarios web mockés**, avec réutilisation des résultats dont le comportement n’a pas changé. Les exécutions partiellement en échec restent signalées ; elles ne sont pas renommées PASS.

| Artefact sous `tools/e2e/.e2e/` | Révision et résultat |
| --- | --- |
| `backend-web/1792690908954-46418-7d7f52fb-abc6-42d9-892e-74006a52cba8` | `46cd3fae2` : **8 PASS / 1 échec**, code 1. Les trois cas badges, trois notes et deux guides passent. Le dernier test attendait l’enregistrement alors que le second compte neuf affichait son accueil propre. |
| `backend-web/1792691270209-59497-6ba252f2-90be-44ee-8252-f2c4f192db5f` | `30e93d170` : **2 PASS / 1 échec**, code 1. Droits, signets et restauration des guides requalifiés après correction du transfert invité. Le dernier helper ouvrait la visite facultative de B, qui masquait ensuite le bouton Passer. |
| `backend-web/1792691367910-64228-3135d6aa-0774-4f39-9ec3-c0aaa1fdc552` | `68f42e56a` : **1 PASS**, code 0. Dernier cas invité → A → déconnexion → B, guides fermés entre les comptes ; accueil de B terminé par son action visible Passer. A conserve ses guides, B n’en hérite pas. |
| `dreamer-web/1792691090345-53110-193ca76b-2b8f-480b-ab72-359fd138da67` | `46cd3fae2`, avec modification du seul helper backend : **3 PASS**, code 0. Collection et révélation conservées après rechargement ; reprise/achèvement explicite/exercice ; redécouverte et CRUD des notes sans altérer le rêve. Les nouveaux cas d’erreur de transfert des guides sont couverts ensuite par les tests ciblés et le backend ci-dessus. |

Chaque répertoire contient `report.json`, `evidence.json`, `summary.md`, traces et captures. Les anciens runs de développement restent détaillés dans les rapports spécialisés ; cette table est la référence d’intégration.

Assertions backend : limites et concurrence des écritures de badges, restauration après indisponibilité avec dates d’origine, isolement comptes/produits, suppression avec le compte ; notes hors ligne et navigateur vierge, compatibilité anciens clients, concurrence et confidentialité, conservation du brouillon pendant l’attribution d’un identifiant serveur ; droits, signets, achèvements explicites et attribution invité des guides. Les tests de portée produit vérifient RLS/RPC avec des claims contrôlés localement, sans prétendre qualifier la signature OAuth réelle.

## Revue et corrections

Revue indépendante des trois lots, puis contrôle ciblé des corrections :

- **P1 badges** : politiques restrictives Dreamer sur table et RPC ; refus des autres produits du même compte, confirmé sur le backend local.
- **P1 notes** : suppression de la clé instable qui remontait l’éditeur pendant l’attribution de l’identité serveur ; le brouillon reste ouvert, confirmé en E2E.
- **P2 guides** : hôte permanent pour suivre les transitions d’authentification lorsque les guides sont fermés ; une visite à la section zéro ne remplace plus un signet réel ni son horodatage, côté client et SQL.
- **P2 transfert invité** : l’intention d’attribuer à A survit à l’échec de la première écriture du marqueur, au retry et à l’ouverture de B ; suppression et démarrage froid couverts. Correction `30e93d170`, revue du delta et **14 tests ciblés PASS**.
- **Continuité des badges pendant une lecture différée** : les actions réussies restent attribuées au compte original ; retries, version inconnue et suppression ne provoquent ni perte ni attribution à B. Correction `46cd3fae2`, **25 tests stockage/sync/suppression PASS**.

Le premier contrôle global sur `ecfa0b667` a aussi détecté le vouvoiement de cinq nouveaux textes français, une expression portugaise européenne et une dépendance Auth non isolée dans l’ancien test de routes des guides. Les textes sont corrigés pour respecter le tutoiement français et le portugais brésilien ; le test de routes isole le nouveau hook, tout en conservant ses assertions de contenu et de navigation. Les parcours réels de progression restent couverts par les E2E ci-dessus.

Types app/tests, types TesterArmy et lint ciblé : PASS. La vérification obligatoire `verify:pr` est exécutée après le commit de ce rapport ; son SHA exact et son reçu sont consignés dans la PR. Les captures prises pendant les transitions ne constituent pas une qualification de la fluidité des animations.

## Rejouer

Depuis le checkout d’intégration, le runner crée et détruit sa propre stack locale :

```sh
E2E_SUPABASE_HOME='/Users/timax/Projects/noctalia/test-results/backend-e2e-cli-home' mise exec -- npm run test:e2e:backend -- --grep 'personal[- ]note|badge RPC|saved and reading badges|Dreamer badge and guide|backend guide progress'
E2E_WEB_PORT=8134 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'a written dream earns|guide reading resumes|personal notes survive reload'
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npm run verify:pr
```

## Livraison et limites

Trois migrations sont préparées : `20261022170231_badge_ledger_continuity.sql`, `20261022170242_dream_personal_notes.sql`, `20261022170346_guide_reading_progress.sql`. Leur installation en production et la publication de l’application nécessitent le **go explicite du propriétaire**. Les essais locaux n’ont déployé aucun backend de production.

Qualité native, vraie réinstallation sur téléphone et disponibilité en production **non qualifiées**. Aucune publication, opération Store ni fusion n’a été effectuée par ce lot. Le registre conserve les acquis disponibles ; il ne peut reconstruire des identités historiques que les anciennes versions n’ont jamais enregistrées.
