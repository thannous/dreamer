# TI-524 — Première extraction des frontières du Journal

Base : `master` au commit `f101aab9f`, après fusion de #121, #122 et #123. Ce lot déplace les responsabilités établies sans migration de données ni changement de l'algorithme de synchronisation.

## Contrats et consommateurs

| Frontière | Implémentation | Consommateurs actuels |
| --- | --- | --- |
| Identité | `lib/dreamIdentity.ts`, `lib/journalReadContracts.ts` | Routes, commandes, file, pages et cache ; date locale distincte de l'identité distante |
| Mapping | `services/journalDreamMapper.ts` | Dépôt de lectures et façade d'écriture ; récit complet, métadonnées, colonnes facultatives et résultats de mutation |
| Références média | `lib/journalImageReference.ts` | Mapper et façade ; conversion de références uniquement, sans upload ni signature |
| Lectures | `services/journalRepository.ts` | Façade `supabaseDreamService.ts`, puis `useRemoteJournalList`, `useDreamPersistence`, `useDreamJournal` |
| Résultats de synchronisation | `lib/journalSyncContracts.ts` | Mapper et façade, avec réexport compatible pour les hooks existants |
| Média asynchrone | `services/dreamMediaService.ts` | Hook média, cartes, détail, partage ; séparation déjà établie par TI-520 |

La façade conserve les six exports de lecture : page légère, page complète, itérateur, snapshot exhaustif, détail et recherche par identité client. Le dépôt reçoit un getter de client et une horloge : le client actif est relu avant les requêtes et les contrôles de session, sans capturer une ancienne session au démarrage du module. Le SDK est une dépendance de type, pas une initialisation runtime du dépôt.

Le mapper et les références média sont exécutables dans Node. Leur graphe d'import ne charge ni React, ni lecteur natif, ni SDK Supabase. La projection légère lit directement ses champs et conserve le récit intégral, sans construire une analyse complète. L'horloge injectable rend les valeurs historiques de repli testables ; les dates explicites restent inchangées.

## Garanties de compatibilité

- Identifiants locaux temporels, identités distantes/client, révisions et tombstones restent inchangés.
- L'allowlist des détails d'analyse, la normalisation mémoire et les omissions de champs monotones conservent leur comportement existant.
- Les indicateurs de colonnes facultatives restent possédés par la façade et sont passés explicitement au mapper. Aucun repli de schéma distribué n'est retiré.
- La conversion des chemins média garde ses règles existantes ; ce déplacement n'élargit ni les droits Storage ni la politique de signature.
- La pagination conserve la borne initiale, l'ordre par identifiant, la fin sur page vide et les contrôles de compte avant/après requête.
- Les produits Lucid et Meditation ne reçoivent aucun nouvel accès au Journal ni modèle de données universel.

## Vérification

Les tests de mapping et du dépôt injecté s'exécutent dans le projet Jest `journal`, en environnement Node sans les initialisations Expo/React Native. Le transformateur TypeScript réutilise les dépendances de compilation existantes. Les commandes restent `npm run test:file -- ...` et `npm run test:changed` ; aucun lanceur ni téléchargement supplémentaire n'est requis.

Les suites historiques de façade, contrat HTTP, lectures et autorité d'écriture restent applicables. `TI528_LOCAL_STATUS=... npm run db:qualify:local` vérifie séparément les requêtes et mutations applicatives sur une base réelle, sous JWT clients. Les résultats finaux sont consignés dans la PR de ce lot.

La qualification Android de la base fusionnée est conservée dans [le rapport TI-531](NOCTALIA-TI531-JOURNAL-QUALIFICATION.md). Elle ne constitue pas à elle seule une validation d'un commit d'extraction ultérieur ni une preuve Play/release.

## Prochains déplacements

Les uploads, indicateurs de compatibilité, batchs de mutations et réconciliation restent dans la façade ; `useOfflineSyncQueue` conserve l'orchestration React. Leur extraction sera un lot distinct utilisant ces contrats et les tests de création/rejeu, conflit, suppression, erreur de stockage et changement de compte. Ce premier lot ne clôture donc pas globalement TI-524 et n'annonce aucun gain de performance non mesuré.

## Deuxième lot — Uploads et transitions de file

Base du lot : `ee591ed5e` (PR #124). `journalMediaUploadService` reçoit le client Storage, la configuration, l'invalidation et les opérations image par injection. `journalNativeImageAdapter` possède les API fichier et manipulation natives ; le service d'upload ne les initialise pas. La façade garde ses signatures publiques et délègue la préparation média.

`lib/journalQueueTransitions.ts` possède la normalisation historique des mutations, la classification des reprises et l'application des résultats acquittés/échoués. Ces transitions s'exécutent dans Node sans React ni stockage. `useOfflineSyncQueue` garde les abonnements, la persistance sérialisée, les contrôles de périmètre et la coordination des requêtes. Cette étape ne remplace pas l'algorithme de replay.

Les particularités historiques de l'upload sont conservées : référence principale et miniature retirées du résultat en cas d'échec, fichier temporaire de conversion partagé, compatibilités de schéma inchangées. Ce déplacement ne constitue pas une correction de ces politiques. Les tests caractérisent les références existantes, les variantes, les erreurs et les identités distinctes malgré une date identique.

Restent à extraire par lot dédié : transport des mutations et replis de schéma, puis coordination durable de la file. Les preuves Android du premier lot ne sont pas attribuées automatiquement à ce deuxième lot.

## Troisième lot — Transport des mutations

Base : `4ac7ff589` (PR #125). `createJournalMutationTransport` reçoit un getter de client et la préparation média. Le batch RPC, les accès directs de compatibilité, les alias d'identité et les indicateurs de colonnes facultatives sont déplacés ensemble afin de conserver exactement leur ordre et leur durée de vie. Une seule instance est créée dans la façade ; ses wrappers création/modification/suppression conservent leurs signatures et leurs erreurs.

Le transport importe le SDK uniquement comme type et peut être testé dans le projet Node sans initialiser Supabase ou React Native. La façade reste le point d'assemblage avec les adaptateurs réels. Le changement ne retire aucun repli destiné aux clients distribués et ne promet aucune nouvelle isolation de session au-delà des contrôles existants.

La coordination durable du hook reste à traiter séparément : sérialisation des écritures, attente des snapshots, changements de périmètre et gestion des requêtes en vol. Les tests de replay existants et la base jetable restent obligatoires pour ce futur déplacement.

## Quatrième lot — Coordination durable indépendante de React

Base : `89b856293`, après intégration des trois lots précédents. `createJournalSyncEngine` possède désormais la file, les écritures sérialisées par compte, les créations en préparation, les attentes d'identité issues des snapshots et le propriétaire du replay en vol. Les adaptateurs de stockage, transport et observabilité sont injectés ; les imports d'exécution ne chargent ni React ni les services natifs ou Supabase.

`useOfflineSyncQueue` assemble les adaptateurs et conserve seulement le cycle de vie React : activation du périmètre au commit, montage/démontage, hydratation, abonnement au snapshot et déclenchement du replay. Les bindings construisent des closures sans activer un compte pendant le rendu. Les commandes durables gardent leurs dépendances de callback historiques ; une variation réseau ne remplace pas une commande de sauvegarde. Une instance de moteur reste associée au montage du hook.

L'algorithme et ses barrières sont déplacés sans migration : marqueur durable avant réseau, conservation du reçu de création au retry, annulation d'une création jamais envoyée, attente d'une identité distante persistée avant suppression, rejet des commandes d'un ancien compte, ignore des réponses après démontage ou changement de périmètre. Les replis de transport distribués restent dans le lot précédent.

Les huit tests du moteur s'exécutent dans le projet Jest Node `journal`, sans mock de React ou du stockage natif. Ils couvrent les écritures concurrentes avec erreur disque, le reçu stable au retry, le replay concurrent, la suppression pendant préparation, la dépendance snapshot, la liaison spéculative et le changement de compte, la réponse tardive et la réactivation du cycle de vie. Les 44 tests historiques du hook sont conservés ; un test supplémentaire verrouille l'identité des callbacks lorsque seul le réseau change.

Les quatre déplacements couvrent les frontières données, médias et synchronisation prévues pour TI-524. La validation native d'un ancien commit ne vaut pas validation de ce lot ; la base réelle, les contrôles de types, les tests liés et la revue indépendante restent des preuves distinctes. Aucun gain de performance ni qualification Play n'est déduit de cette extraction.
