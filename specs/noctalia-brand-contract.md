# Noctalia — contrat de marque et responsabilités produit

Décision de cadrage confirmée le 6 septembre 2026 ; revue des sources au commit
`4e2b57334756c992fe132568fbb53127263d190c` (8 septembre). Suivi :
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
| Capturer et retrouver son récit | Journal : [enregistrement](../app/recording.tsx), [persistance](../hooks/useDreamPersistence.ts) | Invité local ; synchronisation distante distincte. Une erreur d'écriture doit rester visible et retentable | Texte sans micro ; voix selon autorisation. Les accès d'analyse ne conditionnent pas une sauvegarde réussie | TI-514/515 fusionnés ; lot Journal TI-531 qualifié sur émulateur Android debug, sans preuve Play ni panne disque native injectée |
| Réflexion facultative et associations personnelles | Journal : [détail](../app/journal/[id].tsx), [lecture personnelle](../lib/personalReading.ts) | Récit local disponible ; analyse distante dépend du réseau et des droits Journal | Micro non requis pour lire ; aucune analyse imposée | Codé, TI-421/426 ; calibration des hypothèses à poursuivre dans TI-559 |
| Prochaine action, plan explicable et récupération | Lucid : [action](../lib/lucid/todayAction.ts), [personnalisation](../lib/lucid/personalization.ts), [sécurité](../lib/lucid/safety.ts) | Calcul local sur les observations ; compte non requis | Refus notifications compatible avec la pratique manuelle ; pas d'achat Journal requis | Codé, TI-381/383/384 ; qualification TI-531 |
| Observation matinale texte et voix | Lucid : [matin](../app/lucid/morning.tsx), [voix](../app/lucid/morning-voice.tsx), [stockage](../services/lucidMorningVoiceNoteStorage.ts) | État propre au scope invité ou compte ; fichiers voix locaux, sans transcription distante | Micro demandé pour enregistrer, jamais pour le texte | Codé ; autonomie runtime livrée dans TI-518, smoke natif Lucid et permissions TI-529 encore à qualifier |
| Signes confirmés, Atlas et laboratoires | Lucid : [signes](../lib/lucid/dreamSigns.ts), [Atlas](../lib/lucid/dreamAtlas.ts), [répétition](../lib/lucid/dreamRehearsal.ts) | Algorithmes locaux alimentés par les observations Lucid et les notes vocales locales ; scope invité/compte propre, sans lecture implicite du Journal | Suggestions à confirmer ; aucun diagnostic ou accès commercial interproduits déduit | Codé, TI-399/400/518 ; projection locale et conservation des références historiques couvertes par les tests du lot B ; preuve native distincte |
| Choisir une intention et une séance adaptée | Meditation : [parcours d'univers](../apps/meditation/lib/worldJourneys.ts), [accueil](<../apps/meditation/app/(drawer)/(tabs)/index.tsx>) | Préférences et catalogue locaux ; pistes distantes non déjà disponibles nécessitent réseau | Compte désactivé par défaut ; ancien accès Plus gratuit tant que les abonnements restent désactivés | Codé, TI-388/396/398 ; ne pas promettre tout le catalogue audio hors ligne |
| Écouter, reprendre, minuterie et sortie calme | Meditation : [lecteur](../apps/meditation/context/PlayerContext.tsx), [audio](../apps/meditation/services/audioService.ts) | Reprise dépend de la disponibilité réelle de la piste ; historique local | Aucun micro requis ; commandes et interruptions à vérifier écran verrouillé | Codé ; qualification native TI-531, séparation état/progression TI-525 |
| Conserver un univers acheté | Meditation : [droits](../apps/meditation/context/WorldPurchaseContext.tsx), [configuration](../apps/meditation/lib/env.ts) | Droits connus distincts des offres ; état inconnu ne vaut pas refus. Achat/restauration dépend du store | Achat unique d'univers distinct d'un abonnement ; prix/offres uniquement ceux du store courant | Correctif TI-516 fusionné ; démarrage natif et preuve d'achat/restauration réelle encore à qualifier |

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

## Registre des preuves au 8 septembre 2026

Le [lot B](../doc_web_interne/docs/architecture/NOCTALIA-LOT-B-VALIDATION.md) documente l'autonomie runtime Lucid et les frontières testées ; son absence de preuve native reste explicite. Le [lot Journal TI-531](https://github.com/thannous/dreamer/blob/ee591ed5e1d8224164ad56489f664e0087a1b65a/doc_web_interne/docs/architecture/NOCTALIA-TI531-JOURNAL-QUALIFICATION.md) qualifie le jeu initial de 2 501 rêves, la pagination, la suppression hors ligne et les changements de compte sur émulateur Android API 36. Après la suppression volontaire, 2 500 rêves restent dans le compte A et un dans B.

Cette qualification du Journal ne valide ni le lecteur Meditation ni le parcours Lucid et ne prouve aucune publication Play/App Store. Les anciens états « source Journal encore couplée » sont remplacés ici par le comportement du code fusionné ; le suivi natif reste dans TI-518/531. Les noms publics, tarifs affichés par les stores et textes marketing publiés ne sont pas modifiés par cette mise à jour.


## Consolidation de preuve — 8 septembre 2026

La [matrice de capacités et de données](../doc_web_interne/docs/architecture/NOCTALIA-CAPABILITIES-2026-09-08.md), intégrée par #135, précise par produit permissions, refus, stockage, transmission, partage et suppression. Les descriptions caméra/photothèque et Face ID inutiles sont retirées de la configuration Lucid ; l’enregistrement est désactivé dans Meditation. Ces retraits sont vérifiés par introspection et nécessitent un prochain binaire pour modifier les permissions installées.

Le partage individuel texte/image d’un rêve Journal ne constitue pas un export structuré exhaustif du journal. L’export structuré Lucid n’inclut pas son snapshot HealthKit ni une sauvegarde exhaustive de ses fichiers audio. Aucun export universel des trois produits n’est promis.

La synchronisation Journal a achevé son extraction dans #132 (TI-524). Le lecteur et la persistance Meditation sont intégrés via #133 : [contrat de persistance](../doc_web_interne/docs/architecture/NOCTALIA-TI526-LIBRARY-PERSISTENCE.md) et [mesures de rendu](../doc_web_interne/docs/qa/TI525-PLAYER-RENDER-QUALIFICATION-2026-09-08.md). Ces preuves de source et de tests ne clôturent pas les interruptions natives : la qualification du 8 septembre a identifié une ancienne piste restant active après changement de séance, en cours de correction dans TI-525/531.

La réflexion proportionnelle TI-559 et la découverte facultative TI-523 sont des livraisons distinctes du contrat de marque. Une promotion ne lit pas les rêves, ne relie pas les comptes et ne vaut pas consentement à l’import. TI-560 doit établir l’identité client et les droits serveur avant l’activation de l’import distant TI-522 ; la compatibilité des sessions historiques doit être explicitement traitée.

Le cadrage de marque peut être accepté indépendamment des qualifications de chaque fonctionnalité. Les travaux natifs, la qualité réelle des générations et les publications restent suivis dans leurs tickets respectifs, sans transformer « codé » ou « fusionné » en « distribué ».
