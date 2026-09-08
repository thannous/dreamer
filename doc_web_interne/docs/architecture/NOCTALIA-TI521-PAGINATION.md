# TI-521 — Pagination et exhaustivité du Journal

Implémentation du 8 septembre 2026, sur TI-520 (`3ee41cdde`). Contrats partagés avec TI-524, sans migration SQL ni changement de plafond en production.

## Contrats utilisés

| Besoin | Contrat | Autorité |
| --- | --- | --- |
| Premières lignes sur cache vide | `fetchDreamListPage` → `JournalPage<DreamListItem>` ; `useRemoteJournalList` | Projection séparée : jamais enregistrée comme un `DreamAnalysis` |
| Ouverture depuis cette liste | `loadRemoteDreamForPreview` → `fetchDreamFromSupabase(remoteId, userId)` | Seul le détail intégral peut être ajouté au cache, après contrôle du compte et de la file |
| Synchronisation du cache | `fetchDreamFullPage`, parcours reprenable dans `useDreamPersistence` | Remplacement et `remoteSnapshot` uniquement après épuisement du parcours |
| Consommateur exhaustif en flux | `iterateDreamPages` | Une page complète à la fois, curseur conservable après consommation |
| Façade historique | `fetchDreamsFromSupabase` | Tableau complet ou erreur ; aucun tableau partiel retourné |
| Résolution de conflit | Détail par `remoteId`, sinon `fetchDreamByClientRequestId` | Lecture ciblée et explicitement liée au compte |

Le contrat versionné est dans `lib/journalReadContracts.ts`. La liste sélectionne explicitement ses colonnes et exclut interprétation, conversations et détails d'analyse. Le récit original est conservé intégralement ; `numberOfLines` limite seulement son affichage. Les médias restent des références stables, sans signature bloquant la lecture.

Le cache complet reste nécessaire aux usages hors ligne existants. Cette livraison ne remplace pas son stockage par une nouvelle base paginée : la synchronisation agrège encore les données complètes en mémoire. L'itérateur permet aux consommateurs qui n'en ont pas besoin de traiter les pages sans cette agrégation.

## Ordre, fin et modifications concurrentes

- Curseur v1 : compte, plus grand identifiant observé, dernier identifiant consommé. Ordre distant `id DESC`, identifiant serveur unique et immuable ; aucun offset ni dépendance à une date identique ou éditée.
- Après la première page, les nouveaux identifiants supérieurs à la borne sont réservés à une nouvelle actualisation. Une suppression non encore visitée ne décale aucune page suivante. Chaque identifiant est visité au plus une fois.
- Les modifications sont lues au moment de chaque requête : ce parcours n'est **pas** un instantané transactionnel MVCC. Une ligne modifiée ou supprimée après sa lecture est corrigée lors d'une nouvelle actualisation. Même limite pour une transaction d'insertion retardée dont l'identifiant aurait déjà été dépassé.
- Une réponse courte ne signifie jamais la fin : seule une réponse vide valide termine le parcours. Une réponse malformée, une erreur HTTP, une session absente ou un changement de compte sont des erreurs, jamais un journal vide.
- Session vérifiée avant et après chaque requête, filtre `user_id` systématique, curseurs refusés pour un autre compte.

## Cache, reprise et interface

Une erreur intermédiaire conserve le cache, la file de mutations et les tombstones. Le préfixe déjà lu et le curseur restent seulement en mémoire ; Réessayer reprend la page échouée. Un changement de compte ou une écriture locale invalide ce checkpoint pour éviter qu'un ancien préfixe remplace une modification plus récente. Les pages partielles ne deviennent jamais une preuve de suppression ni un `remoteSnapshot`.

Sur cache vide, sans mutation en attente ni erreur de lecture, la liste distante légère devient disponible pendant le parcours complet. Les résumés ne sont jamais confondus avec des détails. Toute écriture locale désactive ce chemin pour éviter de réafficher un rêve masqué par une suppression. L'ouverture vérifie également la file courante et le compte après la réponse réseau. Si une actualisation complète a déjà fourni le rêve, sa version acceptée est conservée.

Avec un cache, la liste applique d'abord tous ses filtres et la recherche sur l'ensemble connu, puis affiche des fenêtres de 40 lignes. Le bouton de continuation et la fin de défilement agrandissent la fenêtre ; les filtres et le compte la réinitialisent. Les clés privilégient l'identifiant serveur puis la clé client. Le découpage d'affichage ne touche ni le cache ni les statistiques.

La recherche dans les aperçus distants annonce explicitement son périmètre limité aux lignes chargées et permet de charger la suite même sans résultat. Les filtres avancés continuent à utiliser les données complètes connues. Journal et Tendances indiquent quand l'exhaustivité n'est pas encore établie, y compris pour la période sélectionnée. `complete` signifie parcours accepté pour les données affichées, pas fraîcheur permanente du serveur.

## Inventaire des consommateurs exhaustifs

- Journal : recherche, facettes, filtres et tri sur tout le cache ; fenêtres uniquement après filtrage.
- Accueil : `buildPersonalReading`, `resolveTodayState`, profils et rappels sur le cache complet connu.
- Tendances : `buildDreamTrends`, statistiques et récapitulatif hebdomadaire ne reçoivent jamais la fenêtre d'affichage.
- Synchronisation : `useOfflineSyncQueue` reçoit exclusivement un snapshot distant exhaustif, notamment pour résoudre les tombstones sans identifiant serveur.
- Export Journal : aucune interface d'export Journal n'existait dans ce périmètre. Le test de contrat consomme les pages comme un export, échoue puis reprend sans doublon. Il ne constitue pas une nouvelle fonctionnalité d'export utilisateur.
- Lucid : observations, exports JSON/CSV et passage volontaire minimal restent propres à Lucid. Aucun nouveau chargement du Journal dans Lucid et aucun import implicite.

## Vérifications et limites

Les tests couvrent 0, 1, 1 000, 1 001 et 2 501 rêves ; plafonds inférieurs à la taille demandée ; dates identiques ; insertion, suppression et modification pendant le parcours ; erreur et reprise ; compte changé ; récit de 10 000 caractères ; recherche après la première fenêtre ; absence de remplacement du cache partiel ; invalidation après écriture locale ; ouverture distante protégée.

`journalReadHttp.test.ts` utilise le véritable SDK PostgREST installé et un transport simulant un plafond de 700 pour une demande de 1 000 : 2 501 identifiants exportés une fois, après une erreur intermédiaire et reprise. Cela valide le contrat HTTP généré, pas une base RLS réelle.

Le plafond local déclaré est `supabase/config.toml` : `max_rows = 1000`. La documentation officielle autorise une réponse plus courte que demandée : https://postgrest.org/en/stable/references/api/pagination_count.html . Le plafond réellement appliqué à l'API de production n'a pas été mesuré ni modifié. Après la validation initiale sans Docker, TI-528 a reconstruit une base jetable et exécuté les lectures et mutations réelles sous JWT clients : voir [qualification locale](NOCTALIA-TI528-LOCAL-QUALIFICATION.md).

La vérification web en mode mock ne remplace pas une qualification Android ni une session distante réelle. Aucun déploiement, build EAS ou changement de CI n'est inclus.

Validation initiale : 255 tests dans 12 suites passent ; vérifications TypeScript application et tests passent. La revue indépendante a accepté la version intégrant l'aperçu distant et la reprise exhaustive toujours accessible. Lint ciblé sans erreur ; avertissements React Hooks conservés et explicitement distincts d'un échec de validation.

## Identité des rêves partageant une date

La qualification à dates identiques a reproduit un détail erroné sur Android et une suppression dirigée vers une autre ligne dans le batch applicatif réel. `DreamAnalysis.id` conserve sa sémantique temporelle ; `DreamTarget` porte l'identité distante ou client dans les routes, commandes et mutations. Une ancienne référence numérique ambiguë échoue sans sélectionner la première ligne. Les identités connues distinctes ne partagent plus d'alias de timestamp dans les reçus serveur.

Les cartes, aperçus, détails, catégories, conversations, lectures personnelles et récapitulatifs transportent cette identité. Les anciens liens Today, indicateur d'analyse et notifications restent numériques : en cas de collision ils affichent introuvable, sans sélectionner ou modifier un autre rêve. Leur migration complète est une limite explicite.

Les nouveaux brouillons de rappel des rêves identifiés utilisent une clé stable compte + identité client, avec identité distante en secours. Les anciens brouillons numériques ne portent pas de preuve du compte propriétaire : ils sont conservés mais ne sont pas automatiquement réattribués. Aucun récit, réponse ou brouillon existant n'est supprimé. Ce changement de clé est distinct de la persistance du journal.
