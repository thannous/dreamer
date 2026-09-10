# TI-599 — Reprise après connexion et notification à froid

État : correctif local qualifié ; validation du nouveau code sur une installation Play encore requise. Le ticket ne doit pas être clôturé sur la seule preuve de Play 65.

## Changement

Depuis une fiche Journal ou une conversation introuvable en mode invité, « Se connecter » conserve la destination et ses paramètres d’identité avant d’ouvrir les Paramètres. Après connexion, la navigation racine attend les gates d’authentification et la persistance de l’onboarding, puis reprend le lien une seule fois. L’acquittement compare le chemin et les paramètres, pas le chemin seul.

L’intention utilise le stockage applicatif existant, expire après dix minutes et est annulée quand l’invité quitte les Paramètres/le parcours d’authentification. Les destinations externes, callbacks, identités ambiguës et paramètres déclenchant des actions sont refusés. Un échec d’écriture empêche de quitter l’écran pour la connexion ; un échec de lecture ne supprime aucune donnée.

Le callback d’authentification laisse la navigation racine reprendre le lien. Un ancien lien de lancement déjà traité n’est plus rejoué à une connexion ultérieure. Si l’intention expire pendant la sauvegarde de l’onboarding, sa sortie normale reste assurée, y compris « Passer » après sélection du dictionnaire.

## Preuve sur Motorola — installation Play existante

Le 10 septembre 2026 à 21:59 UTC, package de base `com.tanuki75.noctalia`, version 3.1.0 (65), installateur `com.android.vending`, connexion ADB Wi-Fi.

1. Notifications temporairement autorisées avec accord explicite du propriétaire ; rappel de test déclenché depuis les Paramètres Noctalia.
2. `am stop-app com.tanuki75.noctalia` : arrêt ciblé sans annulation des alarmes/jobs. `pidof` confirme l’absence du processus après arrêt puis immédiatement avant l’appui.
3. Appui sur la vraie notification « Rappel du journal de rêves » : ouverture de Capture, brouillon strictement identique à la sauvegarde.
4. Premier retour Android : sortie de Noctalia, sans boucle.
5. Rappel désactivé et permission notifications révoquée pour rétablir l’état initial.

Preuve structurée : [TI599-PLAY65-NOTIFICATION-PROCESS-2026-09-10.json](TI599-PLAY65-NOTIFICATION-PROCESS-2026-09-10.json). Aucun contenu de rêve ni jeton conservé dans cet artefact.

Cette preuve valide la notification avec processus réellement arrêté et le retour Android sur Play 65. Elle ne valide pas le nouveau correctif de reprise après authentification.

## Vérification locale du correctif

- 110 tests ciblés passent, répartis sur dix suites : intention persistée, URLs, identité, concurrence d’acquittement, navigation racine, authentification, callback, onboarding, notifications et bouton de connexion.
- Typechecks application et tests passent ; lint ciblé sans erreur et 14 avertissements préexistants confirmés par comparaison avec la base ; `git diff --check` passe.
- Revue indépendante : courses liées à la persistance de l’onboarding et à l’expiration corrigées, puis régressions couvertes par tests. Dernier ajustement de la sortie « Passer » conforme à la proposition du reviewer et validé sur les deux statuts.
- Interface web locale en mode mock : lien de rêve absent → Se connecter → profil existant simulé → onboarding → Passer → reprise exacte de `/journal/999999999` avec écran introuvable attendu ; Retour → Journal sans boucle. Le contrôle ne prouve ni OAuth réel ni persistance native. Les fixtures de navigation et d’onboarding utilisées uniquement pour ce contrôle ont été retirées.

## Gate de clôture restant

Tester le parcours de reprise après connexion sur une Release contenant ce code, installable sans supprimer les données du Motorola. L’installation actuelle est signée par Google Play ; un APK local signé autrement ne peut pas la remplacer en conservant les données.

Le chemin prévu est une nouvelle build Android AAB via le profil EAS `production`, puis une distribution Google Play **internal** via le profil de soumission `internal`. Cela nécessite une autorisation explicite avant build EAS et soumission. Aucune publication OTA, build EAS, soumission Store ou modification backend n’a été effectuée pour ce correctif.

Après mise à jour Play : confirmer signature/version, reprendre un lien vers un rêve du propriétaire après connexion réelle, vérifier la reprise unique et le retour Android, puis restaurer et contrôler le compte et le brouillon avant clôture de TI-599.
