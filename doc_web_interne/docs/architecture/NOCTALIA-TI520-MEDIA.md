# TI-520 — Lire le journal avant ses images

Base : TI-519 (`9182972c4`, PR #121). Ce lot conserve les références média stables dans les données. Les lectures du journal, du détail et les acquittements de synchronisation ne demandent plus de signature d’image. Les cartes montées par FlashList, le détail et le partage résolvent leurs médias séparément ; le préchargement voisin est limité à huit rêves par passage.

## Contrat et bornes

- API installée : `@supabase/supabase-js` et `storage-js` 2.89.0. `createSignedUrls(paths, expiresIn)` renvoie un état par chemin. Documentation vérifiée : https://supabase.com/docs/reference/javascript/file-buckets-createsignedurls ; changelog consulté : https://supabase.com/changelog.md.
- Lots de 50 chemins, au plus deux requêtes actives. Ce sont des choix applicatifs conservateurs, pas une limite serveur annoncée.
- Image et miniature partageant un chemin utilisent une seule signature. Une miniature distincte reste une ressource distincte.
- Cache mémoire LRU limité à 256 ressources, compte actif uniquement. TTL existant de 24 heures conservé avec marge de 60 secondes, mesurée depuis le départ de la requête. Les composants montés renouvellent leurs URL à l’expiration.
- Changement de compte/déconnexion, remplacement ou version d’image invalident les résultats concernés. Les gardes sont vérifiées avant la signature et avant publication. Aucune URL signée ne devient une identité durable.
- Les erreurs partielles conservent le cadre visuel et la lecture du texte. La résolution reprend au retour de connectivité. Les compteurs ne contiennent que des nombres : lots, chemins, cache, déduplications, erreurs, occupation.
- Les références stables utilisées pour supprimer l’ancienne image sont traduites en URL canonique au point d’envoi des demandes de génération. Le contrat serveur et son contrôle du propriétaire restent applicables, même avant résolution visuelle.

## Mesures contrôlées

Avant/après exécuté avec les mêmes mocks Jest et les mêmes lignes de journal, contre le service extrait de `9182972c4`. Chaque rêve possède une image et une miniature de même référence. Le signer est retardé de 100 ms simulées.

| Rêves | Signatures individuelles avant | Signatures bloquant le texte après | Lots après, si tous les médias sont demandés |
| --- | ---: | ---: | ---: |
| 10 | 20 | 0 | 1 |
| 100 | 200 | 0 | 2 |
| 1 000 | 2 000 | 0 | 20 |

Le texte était disponible après les 100 ms injectées ; il l’est désormais dès la lecture des lignes, sans avancer l’horloge simulée. Le pic d’appels individuels avant était 20/200/2 000. Le résolveur après limite les requêtes actives à deux ; son test de saturation vérifie le plafond de 256 entrées en cache. Si image et miniature diffèrent, les mêmes jeux demandent 1/4/40 lots.

Ces mesures vérifient l’ordre d’exécution, les requêtes et les bornes structurelles de mémoire. Elles ne mesurent ni la latence réelle, ni le heap en octets, ni les performances de production. Harness et résultats temporaires conservés dans `/private/tmp/ti520Measurement.tmp.test.ts`, `/private/tmp/ti520Baseline.tmp.ts`, `/private/tmp/ti520-measure-before.log` et `/private/tmp/ti520-measure-after.log`. Les tests permanents du résolveur reproduisent les comptes de lots.

## Validation

308 tests sur douze suites passent : résolveur média, services Supabase/génération, hooks média/persistance/journal/file de synchronisation, contexte Auth, cartes/partage et routes journal/détail. TypeScript application et tests passent. Lint ciblé : zéro erreur et 13 avertissements React Hooks, non résolus par ce lot. La revue indépendante accepte le changement après correction du nettoyage d’image et de la reprise réseau.

Parcours web en mode mock vérifié le 8 septembre 2026 : capture d’un récit fictif, ouverture du détail, analyse et illustration simulées, retour à la carte illustrée du journal. Texte, illustration et navigation restent visibles et utilisables. Les signatures privées lentes sont couvertes par les tests contrôlés, pas par ce parcours mock. Aucun compte réel, publication ou génération payante n’a été utilisé.

## Corrections de revue du 8 septembre

Les médias privés invités conservent seulement les capacités signées correspondant à leur propriétaire local et à leur chemin, jusqu'à expiration ; aucune signature anonyme n'est tentée. La résolution en ligne bénéficie de deux reprises bornées. Le partage natif attend la signature puis le chargement du composite et propose une reprise après échec, même lorsque l'URL reste identique.

Au montage hors ligne, un consommateur authentifié consulte maintenant le cache chaud du résolveur, sans réseau ni bootstrap. Compte, version et expiration restent contrôlés. Les tests du résolveur et du hook couvrent le remontage, l'expiration et le changement de compte : 38 tests passent sur le correctif, types et lint ciblé passent, revue indépendante acceptée. Un invité déjà monté conserve sa capacité valide ; un nouvel invité monté hors ligne ne récupère pas de cache de capacités invitées.

## Limites restantes

- Pas de validation native ni de mesure mémoire/latence sur appareil dans ce lot.
- Le SDK utilisé n’expose pas d’annulation par requête pour `createSignedUrls`. Deux transports déjà partis et bloqués peuvent retarder les médias du compte suivant jusqu’à leur terminaison ; les promesses clientes obsolètes sont invalidées immédiatement et le texte reste disponible. Un timeout artificiel qui libérerait les slots sans annuler les transports ne garantirait plus la borne réseau.
- La pagination et le parcours exhaustif restent le chantier TI-521. Aucun changement de schéma, de CI ou de déploiement serveur n’est nécessaire pour ce lot.
