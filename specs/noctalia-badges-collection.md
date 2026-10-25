# Noctalia Dreamer — Collection de badges
Date : 22 octobre 2026. Proposition produit et contrat de collaboration.

## Demande du propriétaire
Créer **20 familles de badges avec trois niveaux bronze, argent, or**, soit **60 récompenses**. Le propriétaire a explicitement choisi cette quantité. Il souhaite une collection immersive, avec l’attrait des cartes à collectionner et des effets holographiques pour les niveaux prestigieux. Il laisse **Claude libre de choisir la présentation et les effets qui conviennent le mieux à Noctalia**. La référence aux cartes Pokémon porte sur le plaisir de collection et les matières, pas sur leurs personnages, logos ou mise en page.

Répartition : **Codex produit les 20 illustrations originales et ce plan. Claude implémente le système, les interfaces, les effets et la validation.** Une illustration stable par famille ; les trois niveaux sont habillés par Claude. Les noms et seuils ci-dessous sont des propositions de Codex, pas une revue détaillée déjà effectuée par le propriétaire.

## Catalogue proposé
La dernière colonne donne les seuils bronze / argent / or. Les jours, semaines et mois n’ont jamais besoin d’être consécutifs.

| # | Identifiant stable | Famille | Action comptée | Bronze / Argent / Or |
|---|---|---|---|---|
| 1 | `night-journal` | Journal des nuits | Rêves sauvegardés distincts | 1 / 25 / 100 |
| 2 | `gentle-rhythm` | À son rythme | Jours locaux distincts avec au moins une sauvegarde | 3 / 14 / 50 |
| 3 | `night-thread` | Fil des semaines | Semaines civiles distinctes avec une sauvegarde | 2 / 8 / 26 |
| 4 | `moon-cycles` | Cycles de lune | Mois calendaires distincts avec une sauvegarde | 2 / 6 / 12 |
| 5 | `ink-dreamer` | Plume de nuit | Rêves distincts sauvegardés depuis la saisie texte | 3 / 15 / 50 |
| 6 | `night-voice` | Voix des rêves | Rêves distincts sauvegardés après une capture vocale réussie | 1 / 10 / 30 |
| 7 | `memory-keeper` | Souvenirs retrouvés | Rêves distincts explicitement saisis comme souvenirs anciens | 1 / 5 / 15 |
| 8 | `dream-reader` | Entre les lignes | Rêves distincts rouverts au moins un jour après leur sauvegarde | 1 / 10 / 30 |
| 9 | `time-traveler` | Voyage dans le temps | Ancienneté en jours du rêve rouvert : seuil maximal atteint | 7 / 30 / 90 |
| 10 | `treasure-keeper` | Trésors de nuit | Rêves distincts marqués favoris au moins une fois | 1 / 5 / 15 |
| 11 | `favorite-echoes` | Échos précieux | Favoris distincts rouverts au moins un jour après sauvegarde | 1 / 5 / 15 |
| 12 | `dream-weaver` | Tisseur de récits | Récits distincts réellement modifiés et sauvegardés après création | 1 / 5 / 15 |
| 13 | `dream-namer` | Nommeur d’étoiles | Rêves distincts dont le titre a été personnellement modifié et sauvegardé | 1 / 5 / 15 |
| 14 | `night-cartographer` | Cartographe des nuits | Rêves distincts dont le type ou le thème est choisi ou corrigé manuellement puis sauvegardé | 1 / 5 / 15 |
| 15 | `dream-seeker` | Chercheur de souvenirs | Jours distincts avec recherche non vide puis ouverture d’un résultat du journal | 3 / 10 / 30 |
| 16 | `path-finder` | Passeur de chemins | Jours distincts avec filtre explicite du journal puis ouverture d’un résultat | 3 / 10 / 30 |
| 17 | `symbol-explorer` | Explorateur des symboles | Fiches distinctes du dictionnaire dont le contenu a été affiché | 3 / 15 / 40 |
| 18 | `night-scholar` | Bibliothèque des rêves | Guides distincts dont le contenu a été affiché | 2 / 4 / 8 |
| 19 | `observatory` | Observatoire intérieur | Jours distincts avec exploration explicite des Tendances contenant des données | 3 / 10 / 30 |
| 20 | `dream-painter` | Images choisies | Rêves distincts auxquels une image personnelle est ajoutée avec succès | 1 / 5 / 15 |

Le premier niveau de Journal des nuits remplit le rôle de « premier rêve » ; ne pas ajouter un 61e badge. Pour Voyage dans le temps, conserver le maximum d’ancienneté réellement atteint au moment d’une réouverture. Vérifier que le nombre de guides disponibles permet chaque seuil, dans chaque langue ; proposer un ajustement si nécessaire, sans inventer des guides ou des lectures passées.

## Expérience et liberté créative
- Concevoir une collection à découvrir et à manipuler, avec une identité nocturne, poétique et soignée. L’emplacement (Tendances ou autre entrée pertinente), le format carte/médaillon, la mise en scène et la hiérarchie appartiennent à Claude.
- Bronze, argent et or doivent se distinguer. Claude choisit librement matières, reflets, relief, holographie, gestes, transitions et célébration selon ce qui sert Noctalia. Aucune formule d’animation, technologie de shader ou durée n’est imposée par Codex.
- Une famille reste reconnaissable à travers ses niveaux. Montrer le niveau acquis, la progression et la condition suivante en mots compréhensibles.
- Ne pas empiler une seconde taxonomie commune/rare/épique/légendaire sur les métaux sans bénéfice clair : la rareté peut être ressentie dans la présentation.
- Célébrer après la réussite effective de l’action, sans voler le focus pendant l’écriture. Regrouper les déblocages simultanés et historiques.
- Respecter les réglages de mouvement réduit, la lisibilité dans les deux thèmes, les lecteurs d’écran, le grand texte, le clavier web et les performances sur mobile. L’effet ne doit pas être la seule manière de comprendre le niveau.

## Règles de progression
1. Un niveau acquis reste acquis malgré une pause, le retrait d’un favori ou la suppression d’un rêve ; la suppression du compte ou une suppression explicite de toutes les données suit le contrat de confidentialité. Ne jamais recréer un rêve supprimé pour conserver son badge.
2. N’attribuer qu’après succès de la persistance concernée. Une sauvegarde échouée, annulée, un brouillon ou un rendu intermédiaire ne comptent pas.
3. Dédupliquer par identité stable de rêve/événement et par scope utilisateur ; une resynchronisation, un remontage React, un retry, une édition répétée ou le passage clientRequestId/remoteId ne créent pas de progression supplémentaire.
4. Les événements historiques prouvables peuvent être repris. Les rêves et favoris existants fournissent des faits ; une ancienne lecture, une recherche, une saisie vocale ou un changement de titre ne doivent pas être inventés. Ne pas annoncer une progression historique exhaustive à partir d’une liste paginée incomplète.
5. Les fenêtres calendaires utilisent le jour local de l’événement, une semaine du lundi au dimanche et le mois local, avec clés conservées et gestion explicite des changements de fuseau. L’âge d’un rêve repose sur sa sauvegarde d’origine, pas sur la date racontée ou une dernière modification. Les dates futures invalides ne donnent pas de progrès.
6. Réouverture = navigation utilisateur vers un rêve existant avec contenu affiché, hors arrivée automatique immédiatement après la capture. Une fiche consultée n’est pas présentée comme une lecture terminée ou comprise.
7. Un changement de récit/titre/type/thème doit être réel et persisté. Ne pas compter une simple ouverture de formulaire ni une différence uniquement composée d’espaces. Ne pas noter la qualité, la longueur, l’émotion ou la valeur d’un rêve.
8. Voix, souvenirs anciens et images personnelles sont des chemins facultatifs. Aucun achat, partage public, permission accordée, analyse IA, notification activée, compte créé ou action dans Lucid/Meditation ne constitue une condition. L’app reste pleinement utilisable sans chercher à tout collectionner.
9. Les compteurs ne contiennent pas les récits, requêtes de recherche, titres personnels ou médias. Stocker uniquement ce qui est nécessaire à la déduplication et aux dates/niveaux, dans le bon scope. Pas de nouveau fournisseur, d’envoi de contenu personnel ni d’appel d’IA pour calculer les badges.

## Architecture attendue de Claude
Inspecter la version courante du dépôt avant de choisir l’implémentation. Réutiliser les contrats de sauvegarde, complétude, synchronisation et identité ; ne pas ajouter un simple compteur global AsyncStorage partagé entre comptes.

Séparer un catalogue déclaratif versionné, une évaluation déterministe, la persistance des niveaux acquis et les points d’émission des événements. Modèle minimal par famille : niveau acquis, progression, dates d’acquisition, état de célébration ; les événements doivent être idempotents. Définir explicitement le comportement invité, connexion, déconnexion, compte A vers B, restauration et multiappareil. Les écritures tardives d’un ancien compte ne doivent jamais contaminer le suivant. Ne pas promettre de synchronisation distante si elle n’est pas livrée et testée.

Les points d’entrée observés dans le checkout local sont :
- capture : app/recording.tsx, hooks/useDreamSaving.ts et la persistance existante ;
- journal et filtres : app/(tabs)/journal.tsx et components/journal/ ;
- relecture, édition et favoris : app/journal/[id].tsx ;
- statistiques : app/(tabs)/statistics.tsx, lib/dreamTrends.ts ;
- découverte : app/(tabs)/explore.tsx, app/dream-guides.tsx, app/dream-guide/[id].tsx et le dictionnaire ;
- données : context/DreamsContext.tsx, lib/types.ts ;
- palette et mouvement : constants/noctaliaPalette.ts, components/motion/.

Ces références sont des repères, pas une prescription d’architecture. Suivre AGENTS.md et les skills pertinents. Toute évolution de schéma nécessaire se prépare et se teste localement ; aucune migration/déploiement de production n’est autorisée ici.

## Contrat des images
20 illustrations originales, une par identifiant de famille, sans texte ni numéro. Fichiers prévus : assets/images/badges/<family-id>-v1.png. Codex conserve les sources avec transparence et un manifeste. Les couleurs de bronze/argent/or et les effets animés sont gérés par Claude ; l’image centrale reste une illustration, pas une capture d’animation. Ne pas traiter un fichier encore absent comme livré, ne pas appeler un générateur à la place de Codex. Pendant la livraison des images, développer avec un emplacement temporaire explicitement identifié puis remplacer avant qualification visuelle finale.

Claude Cloud ne voit pas automatiquement le checkout local de Codex. La disponibilité des fichiers doit être prouvée par un transfert ou une branche reçue ; un chemin local mentionné dans le message ne prouve pas ce transfert.

## Lots et preuves
1. Lire le produit actuel, arrêter les détails techniques et créer le catalogue des 20 familles/60 niveaux.
2. Implémenter progression/persistance et reprise historique prouvable, puis la collection et le détail.
3. Brancher les points d’entrée, les traductions dans les six langues et les illustrations livrées ; réaliser librement les effets.
4. Valider avec TesterArmy les parcours réels touchés : déblocage et progression jusqu’à l’or, redémarrage, hors ligne et reprise, aucun doublon, sauvegarde ratée, historique incomplet, suppression sans perte de niveau acquis et séparation de comptes. Couvrir les limites calendaires et courses difficiles à exercer avec des contrôles ciblés justifiés.
5. Vérifier présentation et interactions sur web et cible native possédée pertinente, mouvement réduit et grand texte ; garder SHA/binaire/environnement/commande/assertions/résultat et preuve visuelle. Les fixtures de niveaux ne prouvent pas à elles seules l’acquisition réelle.
6. Livrer selon AGENTS.md : travail isolé si conflit, préservation du WIP, types/lint pertinents, revue ciblée proportionnée, verify:pr sur le commit avant tout push, PR avec preuve. **Aucune fusion, publication, EAS/Store ou opération destructive n’est demandée ici.**

## État
Plan prêt à transmettre. Illustrations en cours de production par Codex. Implémentation confiée à Claude ; aucun résultat fonctionnel n’est encore déclaré.

