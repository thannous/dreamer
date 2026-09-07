# Noctalia — contrat de marque et responsabilités produit

Décision de cadrage confirmée le 6 septembre 2026 ; revue des sources au commit
`795878a76881732fd1f9c449b679839667bb2089` (7 septembre). Suivi :
[TI-558](https://linear.app/ti-max/issue/TI-558), epic
[TI-513](https://linear.app/ti-max/issue/TI-513).

Noctalia accompagne le repos et l'exploration personnelle des rêves. Chaque
application doit apporter sa valeur seule. « Noctalia Journal », « Noctalia
Lucid » et « Noctalia Meditation » sont les noms de travail de cette matrice,
pas une décision de renommage public, de domaine ou d'identifiant natif.

## Promesses et frontières

| Produit | Promesse | Données possédées | Pont facultatif |
| --- | --- | --- | --- |
| Journal | Conserver un rêve, le retrouver et réfléchir à ce qu'il évoque pour soi | Récits, médias, hypothèses d'analyse, associations personnelles | Import choisi et explicité vers Lucid, prévu par TI-522 ; pas de transfert implicite |
| Lucid | Développer une pratique du rêve lucide en protégeant son repos | Observations matinales, notes vocales locales, décisions sur les signes, plans et récupération | Le compte commun ne donne pas consentement au chargement du Journal ; synchronisation Lucid et import Journal sont distincts |
| Meditation | Préparer le repos avec une pratique simple et une écoute fiable | Préférences, historique de pratique, progression, position de lecture, droits d'univers | Découvrir les autres apps reste facultatif ; aucun abonnement commun requis |

Une observation Lucid est utile à l'entraînement et n'est pas un doublon à
supprimer du Journal. Les Atlas, laboratoires et univers existants restent
accessibles par découverte progressive. Ce cadrage ne retire aucune de ces
capacités et ne crée pas un nouvel onboarding général.

## Matrice de capacités et preuves

« Codé » signifie présent dans les sources citées. « Testé localement » exige un
résultat associé à un arbre ou SHA ; la présence d'un fichier de test seule
n'est pas ce résultat. « Publié » exige une preuve distincte du binaire, de la
version et du canal distribué. Aucune publication native n'est attestée ici.

| Capacité / besoin | App et source | Sans compte / hors ligne | Permission / accès commercial | Preuve et suite |
| --- | --- | --- | --- | --- |
| Capturer et retrouver son récit | Journal : [enregistrement](../app/recording.tsx), [persistance](../hooks/useDreamPersistence.ts) | Invité local ; synchronisation distante distincte. Une erreur d'écriture doit rester visible et retentable | Texte sans micro ; voix selon autorisation. Les accès d'analyse ne conditionnent pas une sauvegarde réussie | TI-514/515 fusionnés ; qualification native TI-531 encore distincte |
| Réflexion facultative et associations personnelles | Journal : [détail](../app/journal/[id].tsx), [lecture personnelle](../lib/personalReading.ts) | Récit local disponible ; analyse distante dépend du réseau et des droits Journal | Micro non requis pour lire ; aucune analyse imposée | Codé, TI-421/426 ; calibration des hypothèses à poursuivre dans TI-559 |
| Prochaine action, plan explicable et récupération | Lucid : [action](../lib/lucid/todayAction.ts), [personnalisation](../lib/lucid/personalization.ts), [sécurité](../lib/lucid/safety.ts) | Calcul local sur les observations ; compte non requis | Refus notifications compatible avec la pratique manuelle ; pas d'achat Journal requis | Codé, TI-381/383/384 ; qualification TI-531 |
| Observation matinale texte et voix | Lucid : [matin](../app/lucid/morning.tsx), [voix](../app/lucid/morning-voice.tsx), [stockage](../services/lucidMorningVoiceNoteStorage.ts) | État propre au scope invité ou compte ; fichiers voix locaux, sans transcription distante | Micro demandé pour enregistrer, jamais pour le texte | Codé ; autonomie des lectures Journal en cours dans TI-518, permissions TI-529 |
| Signes confirmés, Atlas et laboratoires | Lucid : [signes](../lib/lucid/dreamSigns.ts), [Atlas](../lib/lucid/dreamAtlas.ts), [répétition](../lib/lucid/dreamRehearsal.ts) | Algorithmes locaux ; au SHA de référence, source Journal encore couplée. TI-518 remplace cette source par les observations Lucid | Suggestions à confirmer ; aucun diagnostic ou accès commercial interproduits déduit | Codé, TI-399/400 ; nouvelle source et préservation legacy à vérifier dans TI-518 |
| Choisir une intention et une séance adaptée | Meditation : [parcours d'univers](../apps/meditation/lib/worldJourneys.ts), [accueil](../apps/meditation/app/(drawer)/(tabs)/index.tsx) | Préférences et catalogue locaux ; pistes distantes non déjà disponibles nécessitent réseau | Compte désactivé par défaut ; ancien accès Plus gratuit tant que les abonnements restent désactivés | Codé, TI-388/396/398 ; ne pas promettre tout le catalogue audio hors ligne |
| Écouter, reprendre, minuterie et sortie calme | Meditation : [lecteur](../apps/meditation/context/PlayerContext.tsx), [audio](../apps/meditation/services/audioService.ts) | Reprise dépend de la disponibilité réelle de la piste ; historique local | Aucun micro requis ; commandes et interruptions à vérifier écran verrouillé | Codé ; qualification native TI-531, séparation état/progression TI-525 |
| Conserver un univers acheté | Meditation : [droits](../apps/meditation/context/WorldPurchaseContext.tsx), [configuration](../apps/meditation/lib/env.ts) | Droits connus distincts des offres ; état inconnu ne vaut pas refus. Achat/restauration dépend du store | Achat unique d'univers distinct d'un abonnement ; prix/offres uniquement ceux du store courant | TI-516 fusionné ; preuve d'achat/restauration réelle encore à qualifier |

## Trois parcours d'acceptation

| Produit | Première utilisation | Retour | Refus de permission | Réseau absent |
| --- | --- | --- | --- | --- |
| Journal | Saisir un fragment, sauvegarder, le rouvrir ; réflexion facultative | Retrouver le récit et ses associations après redémarrage | Refus micro : saisie texte disponible | Récit conservé localement ; échec visible et nouvelle tentative sans perte de brouillon |
| Lucid | Quatre écrans d'entrée, prochaine action expliquée, observation matinale locale | Relire l'observation, confirmer un signe traçable, suivre un exercice ou récupérer | Refus micro/notifications : texte et pratique manuelle conservés | Boucle locale après redémarrage ; zéro lecture/synchronisation Journal même connecté |
| Meditation | Choisir intention/durée puis une séance disponible | Reprendre à la bonne position sans relance spontanée | Refus notifications : écoute manuelle intacte | Lire les pistes effectivement disponibles ; afficher honnêtement une indisponibilité, conserver les droits connus |

Indicateur principal Journal : sauvegarde retrouvée. Lucid : exercice compris
sans dégradation déclarée du repos. Meditation : séance lancée ou reprise sans
interruption inattendue. Aucun objectif de temps passé maximal, score
psychologique ou garantie de rêve lucide. Ces indicateurs sont des critères de
qualification ; ce document n'affirme pas qu'une instrumentation existe déjà.

## Ton, accessibilité et règles de preuve

- Distinguer « tu as rapporté » (observation), « une possibilité serait »
  (hypothèse IA), « cela m'évoque » (association personnelle), et une information
  éducative sourcée. Ne pas présenter une déduction comme un souvenir vécu.
- En français, privilégier le tutoiement calme déjà utilisé par les catalogues ;
  corriger progressivement les écrans qui alternent avec le vouvoiement. Garder
  le même sens prudent dans les langues effectivement prises en charge : six
  dans Journal/Meditation, cinq dans Lucid (portugais non pris en charge).
- Écarter les promesses de diagnostic, vérité cachée, guérison ou résultat lucide
  garanti de l'interface et du site eux-mêmes. Une mention légale en bas de page
  ne corrige pas une promesse excessive dans un titre.
- Partager les rôles sémantiques des tokens, le contraste, la lisibilité et le
  respect des préférences système. Conserver les palettes et compositions propres
  aux apps. Champagne est un accent de surface ; employer le token de texte
  accessible prévu par chaque thème. Aucun store applicatif ou tarif partagé
  n'est déduit de ces primitives visuelles.

## Écarts documentaires et décisions restantes

Les spécifications [Lucid](noctalia-lucid-trainer.md) et
[Meditation](noctalia-meditation.md) décrivent les contrats propres aux apps.
Leurs corrections ciblées remplacent l'interdiction historique du microphone
Lucid, les sept étapes d'entrée et la parité normative avec Zen ; les anciennes
offres Plus ne constituent plus la politique active de Meditation.

Les chaînes commerciales historiques (par exemple
`world.purchase.notPlus.detail` dans le catalogue Meditation) et les formulations
d'analyse/site nécessitent une revue des surfaces réellement affichées et de
toutes leurs traductions, rattachée à TI-559 et aux tickets de parcours existants.
Le présent cadrage ne certifie pas un audit exhaustif des textes publics et ne
réactive aucun tarif. TI-522/560 doivent établir consentement et autorisation
interapps avant tout import ; TI-561 traitera les surfaces de build après TI-518/527.
