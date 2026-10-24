# Progression Dreamer — intégration du 22 octobre 2026

## Correctifs de sélection des badges et d’édition des notes — 23 octobre

Candidat applicatif : `860925b27fba42cfbd5b2d56ed62db14033f48c9`, sur la base
`bf198b6ec`. L’ancien client web a confirmé deux défauts : les radios de palier
n’exposaient pas leur sélection, et le dock de lecture pouvait intercepter les
clics sur les actions de note. Le champ multiligne natif pouvait aussi grandir
jusqu’à exiger six défilements pour atteindre son compteur.

Les radios transmettent désormais `aria-checked` sur le web en conservant
l’état accessible natif. Pendant l’édition ou la confirmation de suppression
d’une note, le dock est masqué et le changement de page verrouillé. Le champ
est borné, compteur et erreur sont placés au-dessus ; « Terminé » sur iOS ferme
le clavier sans modifier le brouillon. Aucun texte n’est tronqué.

**Web ciblé : 5/5 PASS**, run `01a1679c-43ae-7ddc-91b6-87a16c848c39`.
Le parcours Collection exige exactement un radio coché, Bronze → Argent → Bronze
avec Entrée, focus conservé et état correct après rechargement. Les quatre
parcours notes couvrent 1920×907 et 390×844 : géométrie et hit-test avant clic,
CRUD/dates/récit conservé, vrai collage 4001 intact et refusé, réduction à 4000,
sauvegarde/rechargement et annulation d’une modification invalide.

Commande depuis la racine :
`E2E_WEB_PORT=8134 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'a written dream earns its card face down|personal notes survive reload|an over-limit pasted personal note'`.
Rapport canonique :
`tools/e2e/.e2e/dreamer-web/1792739655347-66343-bfd50396-8ef9-416b-ad6b-c1ea45877652/report.json`.
Le run a testé la base avec les cinq fichiers modifiés ; son empreinte de delta
`0582407684f0b5b3ebeb76265a22b7eb28a44b0aa2411feb9364653d8cc63e38`
correspond au commit applicatif ci-dessus. e2e 0.21.2, web 0.15.2,
Playwright 1.64.0 ; stockage mock persistant, sans preuve serveur.
Les deux captures 4001 ont été inspectées. Revues croisées du code/tests sans
constat restant.

`verify:pr` sur `860925b27` : **PASS, 7 exécutés, 5 réutilisés, 10 hors périmètre**.

**iPhone physique : 1/1 PASS ciblé**, run `01a167af-d3da-7c74-924d-859d9ef962fa`,
Release QA 3.7.0(14) du candidat ci-dessus, OTA désactivée. Quatorze lignes,
111 caractères : un petit geste expose compteur et « Terminé », qui ferme
réellement le clavier en conservant le brouillon exact ; les actions sont alors
accessibles sans autre geste. Annuler restaure le dock, sans sauvegarde.
Les captures avant/après ont été inspectées ; la hauteur native est bornée.
Le boundingBox avant fermeture du clavier ne mesure que la partie visible du champ.
Ce résultat n’affirme pas une exposition automatique sans défilement.
Rapport : `tools/e2e/.e2e/progression-iphone-inputs/runs/note-polish-04/report.json`.

À la demande du propriétaire, aucun nouveau test natif de limite 4000/4001 ni
campagne CRUD n’est lancé : leur logique est inchangée et leurs preuves antérieures
restent réutilisées. Les pilotes iPhone 01–03 conservent leurs échecs d’injection
ou de placement du pilote ; aucun succès rétroactif. L’app personnelle est préservée.

**Moto physique : 1/1 PASS ciblé**, run `01a167b6-a47b-741e-a402-32f161a204fe`,
69 secondes, Release QA 3.7.0(83), même source applicative, OTA désactivée.
APK `916c293fe83de187503aec127b32550821cf3ac39a38d14ce57825c747c05b42`,
installation de signature compatible sans effacement. Un brouillon de quatorze
lignes/620 caractères reste exact après fermeture du clavier ; champ borné,
compteur et actions entièrement visibles, dock absent puis restauré après Annuler.
Aucune sauvegarde ni campagne de limites/CRUD. Les deux captures sont inspectées.
Rapport : `tools/e2e/.e2e/progression-moto-polish-inputs/runs/pilot-01/report.json`.
L’app personnelle est inchangée ; les données QA existantes sont préservées.

Les deux FAIL hébergés sont historiques : aucun nouveau déploiement et aucune
qualification VoiceOver/TalkBack ne sont déduits de ce lot.

## Historique — suite de publication, Explorer et carte Collection

Le contrôle Release du merge `59b1796e` passe le backend local (22/22), le site
(269/269) et la première passe Dreamer (120 exécutés, 27 réservés aux autres
contextes). La passe française fait 24/25 : une ancienne assertion exige que les
deux actions du rituel soient visibles sans défilement à 390 × 844, avant l’ajout
de la carte Collection. La page possède déjà un défilement et un dégagement de navigation.

Le test conserve les vérifications de thèmes, descriptions et cibles tactiles,
confirme l’entrée Collection visible, puis effectue un vrai défilement. Les deux
actions du rituel doivent alors être entièrement au-dessus de la navigation et
leur centre doit recevoir les clics. Rejeu ciblé : **1/1 PASS**, run
`01a16588-c3fe-769a-9278-4d5b9ffc37b7`. Contre-exemple : retirer temporairement le
dégagement bas fait échouer le nouveau test avec une action encore masquée de
23 px, run `01a16589-7155-7f75-a37f-d64da93ca4d4`. Le fichier applicatif est restauré
octet pour octet ; cette suite ne change que le test et ce rapport. Commande :
`EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=fr-FR E2E_WEB_PORT=8134 mise exec -- npm run test:testerarmy -- run --grep 'compact resources keep'`.

Les contrôles complets de publication doivent encore passer sur le nouveau HEAD.
Les résultats natifs du même code applicatif sont une union datée de runs QA :
persistance invitée notes/guide/carte sur iPhone, guide/carte sur Moto et suppression
de note iPhone ; la limite 4001, la convergence serveur hors ligne et la restauration
A/B natives restent non qualifiées. Aucun déploiement d’app n’est déduit de ces preuves.


Responsable : lot parent Codex, branche `codex/dreamer-progression-20261022`, PR #555. Les trois priorités ont été développées en parallèle dans le checkout isolé `dreamer-progression` ; le travail en cours du checkout principal est préservé. Base historique : `master` `4403a8b16` (PR #552), complétée par le correctif Claude repris sous `5589e72ef`.

**État courant :** les trois défauts A1–A3 sont corrigés et qualifiés localement. Backend réel : **13/13 PASS sur `db8f8ea0ce31ea36134cf170ca6803f47a04860c`**. Candidat intégrant la finition badges/guides de Claude : **`0b474baf87320532df5b0d951d16921bf49027b0`, checkout propre, 4/4 parcours web mock et 3/3 parcours guides français PASS**. Le P2 de focus web est corrigé par Claude dans `d03d3b2a73a7fbdd2fec70183a67a5f2c6f8744e`, intégré sous **`94fb8c954bc7b2455cc97d8e9e12ea471fcb59c6`** : revue du delta sans constat restant et **1/1 parcours collection clavier PASS** sur cette source propre. Ce dernier commit est le candidat applicatif ; les changements documentaires suivants ne modifient pas les entrées testées. Les quatre migrations sont déployées ; aucune publication de l’application ni qualification native n’en est déduite.

## Fonctionnalités et corrections

- **Badges** : sauvegarde par compte, restauration, union des progrès et conservation des dates d’acquisition ; état de sauvegarde, reprise hors ligne, isolation et suppression avec le compte.
- **Redécouverte et notes** : invitation à relire un rêve d’au moins 30 jours, sans condition d’analyse ; notes datées séparées du récit et du contexte IA, modifiables/supprimables et synchronisées.
- **Guides** : huit guides avec visite, signet de section, reprise et achèvement explicite. Les exercices restent facultatifs ; une simple ouverture ne crée plus de récompense de lecture. Finition Claude `f6f905ded659f408bd74d96667e1b36ab78071b5`, relue et intégrée sous `0b474baf8` : lecture/reprise et révélation des cartes améliorées ; delta de focus `94fb8c954` intégré et requalifié.

Les interfaces sont traduites dans les six langues. Détails antérieurs : [badges](badge-continuity-20261022.md), [redécouverte et notes](dream-rediscovery-personal-notes-20261022.md), [guides](../guide-reading-progression.md).

| Défaut | Correction et portée de la preuve |
| --- | --- |
| **A1 — reçu ancien acquittant sans notes** | L’ACK incomplet conserve l’identité/révision reconnue du même rêve et permet une nouvelle identité de reçu, sans réutiliser indéfiniment l’ancien ACK. La reprise conserve sa clé lors d’une simple perte de réponse. Les écritures en ligne, la file et la migration invité suivent ce contrat. La copie invitée et son attribution à A restent durables jusqu’à confirmation des notes ; un identifiant distant seul ne justifie pas leur nettoyage. Une modification locale plus récente ou un conflit ne sont pas écrasés. **PASS backend local**, compte connecté et invité, reload, absence de doublon et second profil. |
| **A2 — une note invalide annule tout le lot** | La RPC valide `personal_notes` par mutation après le rejeu d’un reçu existant, avant écriture. Refus explicite `DREAM_PERSONAL_NOTES_INVALID` sans reçu bloquant ; les mutations valides continuent. Autorisation, quotas, verrouillage, contrôle des révisions et contrainte de table restent en place. **PASS backend local** : lot mixte, intégrité des refus, correction/rejeu et confidentialité. Migration corrective déployée, relecture hébergée concordante. |
| **A3 — collage tronqué à 4 000 caractères** | Suppression de `maxLength` ; brouillon intégral, compteur et limite sur sa longueur brute, message accessible dans six langues, sauvegarde désactivée au-delà de 4 000. Les espaces extérieurs sont retirés seulement à la sauvegarde d’un brouillon valide. **PASS web mock intégré** : vrai collage 4 001 intact, réduction à 4 000, sauvegarde/reload et annulation d’une édition invalide. Natif non qualifié. |

**Pourquoi conserver des contrôles isolés :** les E2E réels prouvent les parcours et la persistance ; ils ne permettent pas de déclencher de manière déterministe chaque ACK perdu, ordre de réponses, écriture de marqueur en échec ou changement de propriétaire pendant une opération. Les contrôles ciblés de transport, file, service et hooks couvrent ces contre-exemples : clé de reprise stable, nouveau brouillon face à un reçu ancien, conflit conservé, propriétaire A non transféré à B et copie invitée non nettoyée avant durabilité. Ils complètent les E2E, sans les remplacer ni prouver le stockage natif. Le contrôle RPC local des payloads invalides observe aussi les reçus privés que l’UI ne peut produire ou consulter.

## Preuves fraîches et échecs conservés

Runtime : Node **24.22.1**, Supabase CLI **2.121.0**, TesterArmy **0.21.2**, moteur web **0.15.2**, Playwright **1.64.0**. Le backend utilise Auth/Postgres/PostgREST réels sur une stack locale possédée et des comptes synthétiques ; le runner détruit sa stack après exécution. Aucun appel externe IA/OAuth/paiement. Les parcours web mock ne prouvent pas une synchronisation distante.

Chaque artefact, sous `tools/e2e/.e2e/`, conserve `report.json`, `evidence.json`, traces et captures. Les rapports machine ci-dessous ont été relus ; un résultat partiellement en échec reste un échec.

| Artefact | Source et résultat |
| --- | --- |
| `backend-web/1792695801671-65727-433e4d11-5dde-4be6-aadf-5a9ffe65a8a1` | `f0c6a71e` : **9 PASS / 3 FAIL**. Deux nouveaux tests A2 échouent sur des fixtures sans `interpretation` (23502) ; A1 rencontre un conflit réel à la reprise. Fixtures et reprise corrigées ensuite, sans reclasser ce run. |
| `backend-web/1792697516396-91147-33a46eaa-8295-45bc-9c0e-810bb91826bb` | `db8f8ea0c`, propre : **13/13 sélectionnés PASS**, exit 0 ; neuf cas exclus ne comptent pas comme PASS. Deux reprises A1 (compte connecté/invité), deux cas A2 (lot/validation-confidentialité), six régressions journal/notes et trois thèmes/analyse. Preuve backend réutilisée pour les fichiers inchangés du candidat visuel suivant. |
| `dreamer-web/1792697239674-86764-c663a8a3-21f9-48ef-a09c-dfa5a8d437d0` | Checkout QA notes sur `f0c6a71e` : **1 PASS CRUD / 1 FAIL collage**. `Write permission denied` avant le collage, donc échec de préparation du profil de test et non verdict applicatif A3. |
| `dreamer-web/1792697380163-89183-4230a17a-3046-45c4-8598-71732999e846` | Checkout QA notes, `ac12b5a4b4bc7f2353682a1e00896aaac7b6e900`, propre : **1/1 PASS**, collage uniquement. Permission presse-papiers temporaire limitée au profil/origine locale, retirée ensuite. Le CRUD n’a pas été rejoué dans ce run. |
| `dreamer-web/1792697800324-93289-ce4efd9a-f4f1-47ec-92ab-db582147670c` | Candidat intégré `0b474baf8`, propre : **4/4 PASS**. Collection/révélation/reload, guides/reprise/achèvement explicite, CRUD/redécouverte, vrai collage/limite/reload/annulation. |
| `dreamer-web/1792697868239-93866-5be2f2cf-e392-45e4-9549-163873d1037f` | Même candidat propre `0b474baf8` : **3/3 PASS**. Guides français clairs/sombres, préférence système ; destinations et géométrie du texte contrôlées à 390 puis 320 px, stress texte 200 % dans le navigateur. Ce n’est pas une preuve de Dynamic Type natif. |
| `dreamer-web/1792698770677-2814-21a0df2a-2d01-4837-b10a-1fee8b50ff26` | `94fb8c954`, propre : **1/1 PASS**. Rejeu collection avec Entrée, focus initial sur le dos puis sur la face révélée, hors de tout ancêtre `aria-hidden`, conservation après reload et capture stabilisée. Les trois autres cas du run à quatre parcours et les trois guides français restent réutilisés sur code inchangé. |

A1 observe notamment un ancien reçu réellement stocké sans notes, puis le reload et la convergence avec notes exactes sur un second profil. Le parcours invité lit sa copie IndexedDB et son attribution avant reprise, puis leur nettoyage après ACK ; aucun rêve dupliqué. A2 vérifie les mutations valides avant/après les refus, l’absence de reçu pour les refus, le rejeu et l’intégrité d’un rêve étranger. Les régressions couvrent aussi le brouillon pendant la promotion d’identité, le hors ligne et les réponses d’analyse obsolètes.

Les captures A3 montrent le compteur, le message et l’action désactivée ; sauvegarde/restauration restent prouvées par les assertions. Les captures prises pendant une transition **ne constituent ni une preuve visuelle stabilisée ni une qualification de fluidité**. Les assertions de mise en page françaises attendent une géométrie stable ; aucune mesure FPS, VoiceOver ou TalkBack n’est revendiquée. La nouvelle capture de carte a été inspectée après fin du retournement : face lisible, fond opaque, dos et gerbe disparus, anneau de focus clavier visible.

## Historique d’intégration réutilisé

Avant les contre-exemples A1–A3, l’union était de neuf scénarios backend et trois mock, à des révisions distinctes. Elle reste utile pour les comportements inchangés, sans couvrir les nouveaux défauts.

| Artefact sous `tools/e2e/.e2e/` | Révision et résultat historique |
| --- | --- |
| `backend-web/1792690908954-46418-7d7f52fb-abc6-42d9-892e-74006a52cba8` | `46cd3fae2` : **8 PASS / 1 échec**. Badges, notes et deux guides réussis ; helper du second compte arrêté sur son accueil. |
| `backend-web/1792691270209-59497-6ba252f2-90be-44ee-8252-f2c4f192db5f` | `30e93d170` : **2 PASS / 1 échec**. Droits/signets/restauration guides réussis ; visite facultative de B masquant Passer. |
| `backend-web/1792691367910-64228-3135d6aa-0774-4f39-9ec3-c0aaa1fdc552` | `68f42e56a` : **1 PASS**. Invité → A → déconnexion → B, guides fermés ; A conserve sa progression, B n’en hérite pas. |
| `dreamer-web/1792691090345-53110-193ca76b-2b8f-480b-ab72-359fd138da67` | `46cd3fae2` + seul helper backend modifié : **3 PASS**. Collection/révélation, guides/exercice et CRUD/redécouverte. |

Revue initiale : portée produit restrictive badges, éditeur stable pendant promotion d’identité, hôte permanent des guides, protection du signet contre une visite zéro. Contrôles ciblés historiques : 14 transfert/reprise guides et 25 stockage/sync/suppression badges PASS, non rejoués ici. Les corrections de tutoiement français, portugais brésilien et du double Auth des routes guides restent en place. Les claims produit contrôlés localement ne qualifient pas l’obtention de vrais jetons OAuth hébergés.

`verify:pr` PASS sur `5425184f6929ebed1661db99bed3aa5ca9c33487` : **9 contrôles exécutés, 4 réutilisés, 9 hors périmètre**, 195 suites/2 589 tests Jest PASS (une suite/un test ignorés), 354 tests Deno PASS, types et lint sans nouvel avertissement. Le delta de focus a ensuite reçu une revue indépendante ciblée sans constat restant ; les types TesterArmy passent également. Le reçu obligatoire du HEAD final, vérifié avant push, est reporté dans la PR lors de la livraison avec son SHA complet et les réutilisations d’entrées inchangées. Les résultats ci-dessus ne constituent pas une publication.

## Migrations déployées

Autorisation du propriétaire reçue dans ce lot. Le 22 octobre 2026, heure de Paris :

| Source | Historique hébergé | État |
| --- | --- | --- |
| `20261022170231_badge_ledger_continuity.sql` | `20261022180520` | Déployée à 20:05:20 ; schéma/RLS/droits relus. |
| `20261022170242_dream_personal_notes.sql` | `20261022180532` | Déployée à 20:05:32 ; colonne/contrainte/RPC relues. |
| `20261022170346_guide_reading_progress.sql` | `20261022180535` | Déployée à 20:05:35 ; schéma/RLS/droits relus. |
| `20261022185001_isolate_invalid_personal_notes.sql` | `20261022193644` | Correction A2 déployée à 21:36:44. Ancienne RPC vérifiée avant application ; corps attendu, droits, sécurité, `search_path`, helpers et contrainte concordent après relecture. |

Les versions attribuées à l’application diffèrent des préfixes source ; aucune réparation aveugle d’historique. Reçus privés canoniques dans `outputs/progression-priorities-20261022/` : `migration-deployment-20261022.json` et `note-batch-migration-deployment-20261022.json`, conservés hors Git. Le premier contrôle comprend un smoke SQL en lecture seule et refus d’accès ; le quatrième déploiement est validé par catalogue/droits/historique. **Aucun parcours utilisateur positif hébergé n’a été exécuté pour ce lot.** Aucun compte/contenu de production n’a été créé ou modifié pour les tests.

## Rejouer et limites

Depuis le checkout d’intégration ; `test:e2e:backend` possède et détruit sa stack locale. Ne jamais le rediriger vers la production. `E2E_SUPABASE_HOME` peut désigner le répertoire CLI local déjà préparé, sans recopier d’identifiants dans la commande.

```sh
mise exec -- npm run test:e2e:backend -- --grep 'personal[- ]note|invalid notes fail|malformed note|pre-notes receipt|a saved dream survives|another account and an anonymous|an offline save|an older app reads|a completed reading keeps|an edit during model'
E2E_WEB_PORT=8134 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'a written dream earns|guide reading resumes|personal notes survive|over-limit pasted personal note'
E2E_WEB_LOCALE=fr-FR E2E_WEB_PORT=8134 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --tag locale-fr-FR --grep 'guides preserve|guides follow the system'
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npm run verify:pr
```

Le suivi privé conserve les 27 cas demandés à Claude : son reclassement historique était 27 BLOQUÉS dans les environnements requis ; les retests locaux qualifient maintenant Q03, et Q01 reste partiel au-delà des contre-exemples corrigés. La matrice ne devient pas une campagne hébergée ou native réussie.

Publication de l’application, installation/réinstallation native, VoiceOver/TalkBack, qualité des animations sur appareil et parcours hébergés **non qualifiés**. Aucune opération Store ni fusion effectuée par ce lot. Le registre de badges ne peut reconstruire des identités historiques jamais enregistrées par les anciennes versions.
