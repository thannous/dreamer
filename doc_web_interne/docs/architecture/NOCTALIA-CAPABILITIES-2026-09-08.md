# Capacités et données Noctalia — TI-529 / TI-558

Revue source du 8 septembre 2026, base `d2bc25936`. Ce document complète les spécifications canoniques, sans attester un binaire distribué. `expo config --type introspect` exécute les plugins en mémoire ; aucun prebuild, build natif ou envoi store n’a été exécuté pour cette revue.

## Permissions et valeur de base

| Variante / capacité | Demande et refus | Origine / stockage / transmission | Export et suppression |
|---|---|---|---|
| Journal : récit texte | Aucune permission média pour écrire | Saisie, cache/file durables ; compte et synchronisation Journal peuvent transmettre au backend | Partage individuel du rêve ; export structuré du journal non attesté ; suppression synchronisée, distincte d’une simple suppression de cache |
| Journal : voix / transcription | Microphone et reconnaissance vocale à la capture ; texte reste l’alternative | Enregistrement/reconnaissance via les services de capture ; ne pas promettre « uniquement local » pour la transcription ou la réflexion distante | Partage individuel texte/image ; médias et suppression suivent le service Journal |
| Journal : image de référence | Caméra/photothèque à la sélection pertinente | Fichier choisi puis transport média Journal selon l’action | Contrat médias Journal, pas une donnée Lucid |
| Lucid : observation et entraînement | Ni microphone ni HealthKit nécessaires | État Lucid local ; synchronisation optionnelle des données structurées avec compte et consentement ; confirmations de signes et réglages Atlas restent locaux | JSON/CSV de l’état structuré ; reset local et suppression cloud explicite |
| Lucid : note vocale | `expo-audio`, après « Parler » ; refus récupérable sans fausse note ; saisie matinale texte disponible | Fichier audio dans le répertoire local du profil ; métadonnées protégées sur stockage natif ; aucun upload ou transcription automatique dans ce service | Partage individuel via feuille système : cette action peut transmettre au destinataire choisi. Suppression note ou reset Lucid efface fichier et métadonnées |
| Lucid : historique sommeil | Bouton connexion/import HealthKit, iOS seulement ; lecture `sleepAnalysis`, aucun `toShare` | Snapshot local séparé, protégé sur natif ; aucune synchronisation via le transport Lucid | Non inclus dans JSON/CSV structuré. Désactivation conserve ; suppression dédiée ou reset Lucid efface |
| Lucid : rappels / signaux | Autorisation notifications et choix explicites ; sécurité audio et sommeil indépendantes | Plan et sons locaux ; opt-out annule les rappels Lucid | Reset annule les notifications possédées par Lucid |
| Meditation : lecture | Pas de microphone nécessaire ; arrière-plan audio pour séance/minuterie | Catalogue/audio distant ou contenu disponible ; bibliothèque et reprise locales ; achats d’univers via fournisseur commercial distinct | Bibliothèque locale et contrôles de retrait ; ne pas promettre un export universel absent |

Sources : partage individuel dans `app/journal/[id].tsx` (`handleShare`), `app.config.ts`, `app.json`, `apps/meditation/app.json`, `hooks/useLucidMorningVoiceRecorder.ts`, `services/lucidMorningVoiceNoteStorage.ts`, `services/lucidMorningVoiceNoteExport.ts`, `services/lucidHealthKit.ts`, `services/lucidHealthKitStorage.ts`, `services/lucidTrainerStorage.ts`, `services/lucidTrainerSync.ts`, `services/lucidTrainerNotifications.ts`, `services/journalMediaUploadService.ts`, `services/journalMutationTransport.ts`, `apps/meditation/context/LibraryContext.tsx` et `apps/meditation/services/libraryPersistence.ts`.

« Protégé sur natif » décrit ici les appels effectifs à `protectLucidTrainerStoredValue`, pas le nom d’un service. L’audio lui-même est un fichier local : aucune promesse de chiffrement applicatif de ce fichier. Un partage système volontaire n’est pas une synchronisation implicite. L’export structuré n’est pas une sauvegarde exhaustive de tous les magasins locaux.

## Configuration résolue et corrections

- Lucid conserve microphone local, audio arrière-plan, notifications et entitlement HealthKit lecture seule. Reconnaissance vocale retirée. Les descriptions caméra/photothèque héritées de Journal sont retirées de la variante Lucid ; elles restent présentes dans Journal.
- Meditation désactive explicitement les options microphone iOS et enregistrement Android du plugin `expo-audio`. Leur valeur par défaut ajoutait une capacité d’enregistrement inutile. La lecture arrière-plan reste activée. Le blocage Android explicite produit `tools:node="remove"` pour `RECORD_AUDIO` dans le manifeste introspecté, car un plugin automatique peut encore l’ajouter à la liste de permissions source.
- `expo-secure-store` ajoute une description Face ID ; la clé Lucid utilise `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, sans `requireAuthentication`. L’option `faceIDPermission: false` retire donc cette déclaration pour Lucid uniquement. Une future fonction biométrique devra la rétablir explicitement ; le chiffrement ne constitue pas une authentification biométrique.
- Ces changements de configuration nécessitent un prochain binaire pour modifier les capacités installées. Une mise à jour JavaScript seule ne retire pas une permission native.
- Les dépendances natives partagées ne sont pas toutes supprimées par un retrait de plugin ; l’inventaire du manifeste fusionné et des frameworks du binaire reste un contrôle de release TI-561/TI-531.

## Frontières et limites de preuve

TI-522 (import volontaire Journal) et TI-523 (découverte progressive) ne sont pas livrés par ce document. Le lien catégoriel historique de `lib/lucid/deepLinks.ts` ne constitue pas un import de récits. La connexion au même compte n’autorise pas implicitement l’accès au Journal.

Les tests locaux vérifient les configurations résolues, l’autorisation sommeil strictement en lecture, les réponses vides ambiguës et le refus microphone sans persistance fictive. Ils ne remplacent pas les dialogues iOS/Android, une révocation dans les réglages système, un manifeste de release ou les déclarations des stores. La lecture HealthKit refusée et un magasin réellement vide restent indiscernables ; ne pas afficher un diagnostic de permission à partir du seul résultat vide.

## Checklist avant publication

- [ ] Identifier SHA, variante, package, signature et source d’installation du binaire.
- [ ] Comparer manifeste fusionné, Info.plist, entitlements et frameworks aux capacités utilisées.
- [ ] Premier lancement sans compte ni permission ; valeur de base accessible.
- [ ] Refus puis révocation microphone : texte accessible et aucun faux enregistrement.
- [ ] HealthKit iOS : demande après action, lecture seule, vide/refus ambigu, suppression du snapshot ; Android reste utilisable sans module.
- [ ] Vérifier séparément export structuré, partage audio volontaire, reset local et suppression cloud.
- [ ] Mode hors ligne et reprise sans dépendance à l’installation d’une autre app.
- [ ] Réconcilier les langues distribuées et les déclarations store avec les capacités activées dans ce binaire.

Aucune case native/store n’est cochée par les tests de configuration de cette livraison.

## Vérification locale de ce lot

- 41 tests ciblés réussis (configuration, microphone et HealthKit), puis recontrôle du blocage Meditation.
- Types application et tests, lint des fichiers TypeScript modifiés et `git diff --check` réussis.
- Introspection Meditation avec ses propres dépendances verrouillées : description microphone iOS absente, arrière-plan audio conservé, permission Android `RECORD_AUDIO` marquée `tools:node="remove"`.
- Introspection Journal/Lucid automatisée : capture Journal préservée ; Lucid conserve microphone sans blocage, HealthKit en lecture, retire caméra/photothèque et Face ID.
