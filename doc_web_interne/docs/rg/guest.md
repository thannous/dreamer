# Mode invité : données et quotas

Le mode invité permet une première utilisation sans compte. Les limites sont
centralisées dans [constants/limits.ts](../../../constants/limits.ts) et appliquées
par [GuestQuotaProvider](../../../services/quota/GuestQuotaProvider.ts).
Relecture des sources : 23 octobre 2026 ; aucune nouvelle qualification distante.

## Limites et admission

| Usage | Contrat actuel |
| --- | --- |
| Rêves enregistrés | Cinq sauvegardes locales cumulées ; supprimer un rêve ne rend pas de place. |
| Analyse IA | Deux analyses ; la suppression du rêve ne remet pas le compteur à zéro. |
| Illustration | Deux images selon le quota invité. |
| Chat | Dix messages utilisateur par rêve ; `exploration` est une métrique de compatibilité, sans plafond produit séparé. |

[GuestDreamCounter](../../../services/quota/GuestDreamCounter.ts) réserve la place
avant écriture, sous verrou. La réservation est réconciliée avec le journal durable
après un échec ou un redémarrage. Une lecture impossible ne devient pas un quota
vide. À la limite, la capture conserve le brouillon et propose l'accès au compte.

Les compteurs locaux ne remplacent pas l'autorisation serveur : les appels IA
exigent une session invitée vérifiée et l'admission du backend. Voir le
[contrat des commandes IA](../architecture/ai-call-hardening/implementation/server-owned-ai-command.md).

## Stockage et passage au compte

Les rêves invités restent sur l'appareil : [record store natif, KV web et
migration historique](../storage-kv-store.md). Ils ne sont pas transférés sur un
autre appareil sans synchronisation ; désinstaller ou effacer les données locales
peut les détruire.

[useDreamPersistence](../../../hooks/useDreamPersistence.ts) attribue la migration
à un compte et à un ensemble de rêves avant envoi. Les identités de requête sont
stables ; les échecs et conflits conservent une copie récupérable. Le nettoyage
local ne retire que les éléments acquittés de cette migration, sans effacer un
nouveau rêve capturé entre-temps. Une migration déjà attribuée à un autre compte
n'est pas reprise silencieusement.

Une session connectée utilise le provider de quotas du compte ; les compteurs
invités ne deviennent pas ses quotas mensuels. Tester les reprises après erreur,
redémarrage et changement de compte avec des données QA possédées, sans effacer
les données personnelles pour contourner un blocage.
