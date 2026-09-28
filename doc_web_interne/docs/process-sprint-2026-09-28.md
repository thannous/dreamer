# Quatre leviers pour le prochain sprint

Plan établi le 28 septembre 2026 à partir de la rétrospective Noctalia.
Les règles associées figurent dans [AGENTS.md](../../AGENTS.md).
Les livrables ci-dessous sont à réaliser pendant le prochain sprint ; ce document
ne signifie pas que les automatisations ou les qualifications sont déjà terminées.

Objectif : réduire les reprises évitables et qualifier les parcours réellement livrés.
Les indicateurs servent à la rétrospective ; ils n'ajoutent pas de seuils bloquants
aux critères de livraison. La [validation proportionnée](validation-proportionnee.md)
continue de s'appliquer : aucun parcours mobile requis pour une modification documentaire.

## 1. Relier chaque validation à la version réellement installée

**Problème observé :** une fusion, un binaire disponible, une OTA reçue et un backend
déployé ont parfois été difficiles à distinguer lors des reprises de travail.

**Action :** le responsable de la livraison renseigne une fiche dans le rapport
existant avant la qualification, puis actualise uniquement les champs modifiés :

- SHA source, plateforme, version et numéro du binaire, provenance de l'installation ;
- identifiant OTA, runtime et canal si applicables ;
- révision des fonctions et migrations pertinentes, vérifiées ou explicitement inconnues ;
- périmètre du changement et mode de livraison nécessaire : natif, OTA, backend, ou combinaison ;
- statut distinct de chaque étape demandée : construit, envoyé, disponible, installé, testé.

**Livrable :** une fiche par candidat envoyé en test interne, réutilisée par les tests.
**Réussite :** une autre personne peut déterminer si le correctif visé est présent
sur le téléphone et quelles preuves couvrent cette version.
**Indicateur :** candidats qualifiés avec une identité complète / candidats qualifiés.

## 2. Préparer les tests et rendre les parcours principaux rejouables

**Problème observé :** quotas épuisés, données invité à préserver, provenance du
binaire et entrées UI ont retardé les tests ou rendu leur résultat ambigu.

**Action :** le responsable QA vérifie les préconditions avant de lancer le parcours :
compte existant autorisé, sauvegarde des données concernées, droits et quotas,
mode de paiement de test, version installée et entrée supportée. Réutiliser les
scripts du dépôt, dont `android:play-qa-device`, et la coordination du téléphone.
Privilégier les identifiants UI stables ; relire l'écran après une transition asynchrone.

La matrice de référence couvre, sur les plateformes concernées par la livraison :

- invité : enregistrer un rêve, vérifier l'analyse et l'image attendues, relancer
  l'application et retrouver le contenu ;
- compte connecté : retrouver le rêve après synchronisation, vérifier l'absence
  de doublon et relancer analyse ou illustration selon le parcours produit ;
- abonnement : achat de test autorisé sans débit réel, droits reconnus et restauration ;
- reprise : quota refusé ou erreur réseau, message compréhensible, rêve conservé
  et nouvelle tentative possible lorsque la condition bloquante est levée.

Choisir les parcours affectés selon le risque. Un reset de quota ou une modification
de droits exige un périmètre autorisé et une vérification avant/après ; ne pas créer
un autre compte ou supprimer des données pour rendre le test artificiellement vert.

**Livrable :** une matrice passé/échoué/bloqué/non exécuté, avec préconditions,
commande ou étapes exactes, assertions et artefact privé reproductible.
**Réussite :** les parcours retenus peuvent être rejoués sur le candidat identifié ;
un écran affiché ne suffit pas à prouver une sauvegarde, une synchronisation ou un achat.
**Indicateur :** temps perdu pour préconditions manquantes et parcours restant bloqués.

## 3. Transformer les incidents de livraison en contrôles préalables

**Problème observé :** soumission dupliquée, entrées de build polluées, déclarations
iOS manquantes et historique de migrations divergent ont occasionné des reprises.

**Action :** le responsable de la surface concernée utilise les contrôles existants
avant une opération coûteuse. Pour chaque échec, conserver l'étape, l'erreur exacte,
la cause confirmée ou l'hypothèse, et la condition modifiée avant la nouvelle tentative.
Si l'échec est transitoire, vérifier que le service a récupéré et que l'opération
précédente n'a pas déjà abouti. Voir le [garde de soumission EAS](qa/EAS-SUBMISSION-GUARD-2026-09-26.md).

Pour Supabase, inventorier les écarts entre SQL suivi, historique appliqué et schéma
réel. Proposer une réparation avec vérification et stratégie de récupération ;
une date de migration présente ne prouve pas que son contenu est équivalent.
L'application de la réparation reste soumise à l'autorisation adaptée.

**Livrable :** un registre court des incidents récurrents, relié au contrôle existant
ou à une tâche ciblée d'automatisation. Priorité à la réconciliation documentée des
migrations ; pas de nouveau wrapper si le script canonique couvre déjà le besoin.
**Réussite :** chaque incident retenu dispose d'une cause étayée et d'un contrôle
capable de détecter sa récidive, ou d'un blocage explicite avec prochaine action.
**Indicateur :** nouvelles tentatives faites sans changement vérifié ; récidives
d'une cause déjà corrigée. Objectif de travail : zéro.

## 4. Faciliter les reprises et limiter les validations répétées

**Problème observé :** changements de contexte, autorisations déjà données et preuves
éparses ont provoqué des demandes répétées et des doutes sur ce qui restait à faire.

**Action :** le responsable de l'intégration maintient un seul résumé par lot de travail :

> Objectif et périmètre · responsable d'intégration · autorisations et limites ·
> candidat testé · preuves encore valides · blocage précis · prochaine action.

Actualiser ce résumé lors d'un changement significatif ou avant une passation.
Réutiliser les autorisations dans leur périmètre et les preuves pour le code inchangé.
Coordonner les écritures sur une même branche et l'utilisation du téléphone.
Après une correction, rejouer les vérifications invalidées par cette correction ;
conserver les contrôles obligatoires sur le SHA final avant fusion.

**Livrable :** un résumé de reprise dans le rapport existant, sans document parallèle
redondant. Les captures, contenus de rêves, identifiants de compte/appareil et logs
restent dans l'emplacement privé ignoré par Git, notamment `dogfood-output/`.
**Réussite :** la reprise permet d'exécuter la prochaine action autorisée sans
redemander une décision déjà fournie ni annoncer une étape non vérifiée.
**Indicateur :** demandes de confirmation répétées et relances de tests sans changement
de code, de configuration, d'environnement ou de risque qui les justifie.
