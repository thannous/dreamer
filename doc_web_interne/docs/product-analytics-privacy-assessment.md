# Mesure produit first-party — dossier de conformité avant activation

Date d’évaluation : 12 juillet 2026
Périmètre : Android, onboarding Noctalia v2
État de livraison : **désactivé par défaut** côté client et serveur

Ce document décrit l’implémentation technique et les vérifications externes à terminer avant toute activation en production. Il ne constitue ni un avis juridique, ni une validation de la CNIL.

## Configuration livrée

- Transport first-party vers Supabase, sans SDK analytics tiers.
- Aucun transcript, titre, interprétation, prompt, identifiant de rêve, identifiant utilisateur, email, fingerprint, adresse IP persistée, URL complète ou texte libre dans les événements.
- Identifiant de parcours aléatoire, indépendant du fingerprint de quota, conservé sept jours au maximum.
- File locale limitée à 200 événements, avec une durée de vie de sept jours.
- Événements bruts supprimés après 90 jours ; agrégats anonymes supprimés après 24 mois.
- Rapports interdits sous dix parcours.
- Opposition disponible dans l’introduction et les réglages ; l’opposition purge la file locale et demande la suppression des parcours encore connus.
- Arrêt immédiat possible par `EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED=false` ou `PRODUCT_ANALYTICS_INGEST_ENABLED=false`.

## Auto-évaluation au regard du cadre CNIL

Références officielles :

- [Solutions pour les outils de mesure d’audience](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience)
- [Outil d’auto-évaluation de juillet 2025](https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf)

| Critère | Constat Noctalia v1 | Statut |
| --- | --- | --- |
| Finalité limitée à la mesure de l’application | Mesure de l’ergonomie, de l’activation et des fonctionnalités consultées, pour Noctalia uniquement. Aucun ciblage, publicité, acquisition ou personnalisation. | Conforme sous réserve de maintenir cette allowlist. |
| Minimisation | Événements fonctionnels typés et propriétés en allowlist ; aucun contenu de rêve ou texte libre. | Conforme par conception ; preuve automatisée requise avant activation. |
| Pas d’import ou de croisement externe | Aucun UTM, CRM, referrer, URL complète ou intégration analytics tierce. | Conforme par conception. |
| Pas d’identifiant cross-site ou fingerprint | Identifiant aléatoire propre à Noctalia, expirant après sept jours ; fingerprint de quota explicitement interdit. | Conforme par conception. |
| Statistiques anonymes seulement | Les sorties sont agrégées et aucune cohorte sous dix parcours n’est affichée. Les événements bruts comportent toutefois un `journey_id` permettant de relier plusieurs actions pendant sept jours. | **À confirmer juridiquement.** |
| Aucun suivi individuel de navigation | Le calcul J1/J7, du deuxième rêve et de `first_value_viewed` repose précisément sur un parcours pseudonyme sur sept jours. | **Non conforme au critère technique recommandé d’absence de suivi unique.** |
| Opposition durable | Contrôle in-app, préférence persistée, purge locale immédiate et suppression serveur des identifiants encore connus. | Conforme sous réserve du test bout en bout. |
| Durées limitées | Identifiant et file locale : 7 jours ; brut : 90 jours ; agrégats : 24 mois. | Plus court que les maxima recommandés de 13 et 25 mois. |

### Conclusion

La configuration ne doit pas être présentée comme « exemptée », « certifiée » ou « validée par la CNIL ». Le suivi pseudonyme d’un parcours pendant sept jours ne satisfait pas, en l’état, le critère technique recommandé d’absence de suivi individuel. Avant activation, il faut choisir et documenter l’une de ces voies :

1. obtenir un avis juridique et mettre en œuvre le mécanisme de consentement requis ; ou
2. supprimer la mesure J1/J7 et tout chaînage individuel, puis refaire l’auto-évaluation sur une collecte agrégée sans `journey_id`.

Tant que ce choix n’est pas validé, les deux feature flags restent à `false`.

## Google Play Data Safety — brouillon à reporter dans Play Console

Référence : [Provide information for Google Play’s Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469).

Pour la seule mesure produit décrite ici, vérifier puis déclarer avant diffusion :

- collecte de **l’activité dans l’application / interactions avec l’application** ;
- collecte d’un **identifiant d’application ou autre identifiant** aléatoire et temporaire (`journey_id`) ;
- finalité : **Analytics** ;
- données collectées par Noctalia, non vendues et non partagées avec un fournisseur analytics tiers ;
- collecte facultative grâce au contrôle d’opposition ;
- transfert chiffré ;
- suppression disponible pour les identifiants de parcours encore connus.

La déclaration finale doit couvrir la somme de toutes les collectes de la version distribuée, pas seulement ce module. Elle doit donc être comparée au formulaire actuellement publié et aux autres traitements de l’application avant soumission.

## Preuves obligatoires avant activation

- [ ] Les cinq politiques publiques correspondent aux sources FR, EN, ES, DE et IT.
- [ ] Le contrôle d’opposition est accessible depuis l’introduction et les réglages dans les cinq langues.
- [ ] Un test montre que l’opposition purge la file et bloque immédiatement toute nouvelle émission.
- [ ] Un test montre qu’aucun champ interdit n’est accepté par le client ou l’Edge Function.
- [ ] Un test réseau Android réel montre l’absence de contenu de rêve dans les requêtes.
- [ ] La suppression serveur est vérifiée avec un parcours invité et un parcours authentifié.
- [ ] La rétention brute de 90 jours et celle des agrégats de 24 mois sont exécutées et observables.
- [ ] Le seuil de dix parcours est appliqué à chaque rapport et combinaison de filtres.
- [ ] La fiche Google Play Data Safety est mise à jour et relue contre le binaire de release.
- [ ] La base juridique et, si nécessaire, le recueil du consentement sont validés par le responsable de traitement.
- [ ] Le kill switch serveur est testé en staging puis en production avant activation client.
