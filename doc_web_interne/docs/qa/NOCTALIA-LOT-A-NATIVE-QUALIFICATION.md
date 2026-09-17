# TI-531 — Préflight natif du lot A

Date : 7 septembre 2026. Référence source examinée : `795878a76881732fd1f9c449b679839667bb2089` (fusion PR #113). QA indépendante, aucune modification applicative.

## Verdict

**Qualification native du lot A en attente.** Le téléphone est accessible ; aucun binaire ou update JS exécuté n'a été relié au SHA du lot A. Le préflight ne constitue donc pas un test des correctifs.

## Preuves observées

- Worktree au SHA de référence au début du préflight.
- ADB liste un Motorola edge 60 fusion et un Honor. Seul le package Journal du Motorola a été interrogé, en lecture seule.
- Le wrapper `scripts/android-device-lock.js wrap --owner dreamer --device <serial>` a réservé l'appareil pendant l'interrogation PackageManager ; aucun verrou préexistant, aucun vol, aucun verrou restant après la commande.
- Package Journal : `com.tanuki75.noctalia`, version `3.1.0`, versionCode `65`, dernière mise à jour native `2026-09-05 12:46:50`, installateur et initiateur `com.android.vending`.
- PackageManager retourne une signature v3 et un identifiant interne. Ce n'est **pas** une empreinte SHA-256 du certificat vérifiée ; aucune compatibilité d'installation locale n'est attestée.
- Le binaire natif précède la fusion. La configuration utilise Expo Updates avec runtime fingerprint : la date native seule ne permet pas d'identifier le code JS actif. Aucun identifiant d'update lié au SHA cible n'a été établi.
- Aucun lancement, tap, lecture du journal, capture d'écran, achat, installation, suppression de données ou modification du réseau du téléphone.
- Le worktree cible n'a pas `android/gradlew`. Des APK existent dans le checkout principal, mais aucune provenance vérifiée ne les relie à cette référence ; ils n'ont pas été installés.
- `npm run test:e2e:release:ti429:validate` réussit : 14 cas automatisés, 17 manuels, 4 bloqués dans la matrice. Cela valide le harnais local, **pas** l'exécution de ces cas sur téléphone.

## Prérequis de reprise

1. Identifier un artefact ou update JS contenant précisément la référence cible, avec provenance, version/runtime et certificat SHA-256. Vérifier la compatibilité avec l'installation Play existante sans désinstallation ni effacement.
2. Si la génération native est nécessaire, préparer cette étape séparément : aucun `expo prebuild`, EAS ou déploiement n'a été exécuté dans cette qualification.
3. Résoudre le protocole partagé avec BodyLab avant des interactions mutantes. Le verrou Noctalia est identifié ; son interopérabilité avec un éventuel owner BodyLab n'a pas été établie.
4. Pour Meditation, résoudre son profil propre (`com.noctalia.meditation` dans la source) et ses preuves d'artefact. Ne pas étendre le scope Dreamer. Aucun préflight package Meditation ni test audio n'a été exécuté.

## Scénarios ciblés à exécuter après attribution du code

| Surface | Vérification observable | Évidence attendue |
| --- | --- | --- |
| Journal | Enregistrer un texte témoin non personnel, relancer, retrouver exactement le contenu | Version/code attestés et résultat de relecture |
| Journal | Échec d'écriture injecté dans un environnement de test, brouillon conservé, nouvelle tentative réussie | État d'erreur distinct de sauvegarde confirmée, une seule entrée durable |
| Journal | Échec de lecture contrôlé, journal non présenté comme vide, réessai | Aucun effacement et récupération des données |
| Journal | Migration invité avec modification concurrente, reprise après erreur et changement de compte | Propriété de migration conservée, aucune association au mauvais compte |
| Meditation | Offres indisponibles avec droits connus, puis droits inconnus | Démarrage utilisable, droits connus conservés, récupération explicite |
| Meditation | Restauration après initialisation tardive | SDK configuré avant restauration, sans achat réel |
| Meditation | Lecture, pause/reprise, arrière-plan, minuterie | Continuité et absence de reprise non sollicitée |

Les injections d'erreurs doivent utiliser des fixtures dédiées ; ne pas altérer les données personnelles ou le backend de production pour provoquer un échec. Les scénarios compte/achat demandent une identité de test et un mode commercial attestés. Aucun résultat Store, paiement ou performance n'est revendiqué.
