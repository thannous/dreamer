# Charte éditoriale noctalia.app

Version 1, 8 octobre 2026. S'applique aux articles (`docs-src/content/blog/`), aux fiches
symboles (`data/dream-symbols*.json`) et aux guides (`docs-src/static/data/curation-pages.json`),
dans toutes les langues du site. La page d'accueil, réécrite récemment, sert de référence de voix.

## La voix Noctalia en une phrase

Un guide de nuit attentif : il part de ce que la personne a vécu, l'aide à le regarder de près
et ne prétend jamais savoir à sa place ce que son rêve « veut dire ».

| Noctalia est | Noctalia n'est pas |
| --- | --- |
| Concrète : une scène, une sensation, un geste à faire ce soir | Abstraite : « l'un des symboles les plus universels » |
| Nuancée : « peut », « souvent associé à », des questions | Oraculaire : « votre inconscient vous dit », « cela révèle » |
| Sobre et chaleureuse, avec une image forte de temps en temps | Lyrique à chaque phrase, ou froide comme une notice |
| Honnête sur la science : ce qui est mesuré, ce qui est hypothèse | Pseudo-savante : chiffres et citations sans source |
| Utile au réveil : quoi noter, quoi se demander | Remplie pour faire du volume |

## Règles d'écriture

1. **Ouvrir sur la scène.** La première phrase décrit ce que le lecteur a vécu (le vide, le réveil
   en sursaut, le miroir qui ne renvoie pas le bon visage). Pas d'introduction générale sur
   « les rêves depuis la nuit des temps ».
2. **Répondre tôt.** La « réponse rapide » d'un article et la description courte d'une fiche
   donnent la réponse en deux ou trois phrases. Elles ne recopient pas la meta description.
3. **Une idée par paragraphe**, phrases courtes, verbes actifs. Un intertitre dit ce que la
   section apporte, idéalement sous forme de question que le lecteur se pose.
4. **Proposer, pas décréter.** Chaque lecture symbolique est une piste, reliée à une émotion ou à
   un contexte, et suivie d'une question pour la vérifier. Jamais de prédiction, jamais de
   présage, jamais de diagnostic.
5. **Variantes en phrases complètes** : ce qu'il faut observer, la piste possible, sa limite.
6. **Un exemple de journal fictif, signalé comme tel**, par article ou fiche longue : scène,
   émotion, contexte possible, question. C'est la marque de fabrique de la méthode Noctalia.
7. **Séparer les registres.** « Ce que dit la recherche » (sourcé), « lectures symboliques »
   (traditions, psychanalyse, présentées comme des points de vue) et « ce que vous pouvez faire ».
8. **Santé et sommeil.** Ton rassurant mais exact. Dire quand un symptôme mérite un avis
   médical (cauchemars fréquents qui abîment le sommeil, mouvements nocturnes répétés,
   détresse au réveil). Le rêve ne remplace jamais une consultation.
9. **CTA honnêtes.** Un bénéfice que l'app tient réellement : noter à la voix ou par écrit,
   illustrer, relire, repérer ce qui revient. Pas de « Noctalia identifie ce que votre
   inconscient traite ». Un seul CTA principal par page, verbe + bénéfice.

## Preuves et sources

- Tout chiffre a une source cliquable, de préférence primaire (étude, revue, organisme de santé).
  Sans source vérifiable, on retire le chiffre ou on le reformule sans fausse précision.
- **Aucune citation entre guillemets attribuée à une personne réelle sans source vérifiable.**
  On paraphrase et on cite le travail (« selon la théorie de la simulation de la menace d'Antti
  Revonsuo… »).
- Les théories classiques (Freud, Jung) sont présentées comme des grilles de lecture
  historiques, avec exactitude, et non comme des faits.
- La section Sources liste ce qui est réellement utilisé dans le texte.

## Mots et tournures à éviter

Ils sonnent traduits, publicitaires ou générés automatiquement.

- FR : « plongez dans », « découvrez ce que… révèle », « votre inconscient essaie de vous dire »,
  « paysage émotionnel », « naviguer » (au sens figuré), « crucial », « accablant »,
  « faire confiance au processus », « Que cherche à vous dire votre esprit ? »
- EN : *delve*, *unlock*, *journey*, *realm*, *tapestry*, *navigate*, *crucial*,
  *your subconscious is telling you*, *discover what … reveals*
- ES, DE, IT : les mêmes calques (*descubre lo que revela*, *tauchen Sie ein*,
  *il tuo subconscio ti sta dicendo*).

## Typographie

- Intertitres en casse de phrase dans toutes les langues (« Pourquoi on se réveille en sursaut »,
  pas « Pourquoi On Se Réveille En Sursaut »). Les balises `<title>` suivent la même règle lors
  d'une réécriture, sans changer leur mot-clé.
- Français : espace insécable avant `: ; ? !`, guillemets « », tiret demi-cadratin ou virgule
  à la place du trait d'union isolé « - ».
- Guillemets par langue : “ ” (EN), « » (ES, IT), „ “ (DE).
- Adresse au lecteur : vous (FR), you (EN), tú (ES), tu (IT), Sie (DE). Ne pas mélanger.

## Gabarits par format

**Article** : accroche (2-3 phrases, la scène) · réponse rapide · sections en questions ·
variantes · exemple de journal fictif · ce que dit la recherche · que faire · quand consulter
(si pertinent) · FAQ de 3 à 5 questions, identique au JSON-LD · sources.

**Fiche symbole** : description courte (la réponse, 120 caractères minimum) · trois questions
« Posez-vous la question » concrètes · interprétation complète de 3 à 5 paragraphes ouverts par
une question en gras · exemple fictif · paragraphe méthode court · variantes en phrases complètes
· FAQ · meta dédiée de 110 à 160 caractères.
Le paragraphe méthode est le même texte standard pour toutes les fiches d'une langue. Il doit se
lire sans ses liens, car l'app affiche ce texte en clair : pas de « voir notre méthodologie ».

**Guide** : titre · meta · introduction (la promesse et comment lire les cartes) · conclusion
(un geste concret pour la prochaine nuit).

## Garde-fous SEO

- Ne jamais changer un slug ni une URL. Garder le mot-clé principal dans le titre, le H1 et
  l'introduction.
- Un titre ne change que si la réécriture le rend nettement meilleur pour la même requête.
- Meta description de 110 à 160 caractères, propre à la page, jamais générée par gabarit.
- FAQ visible et JSON-LD identiques. `dateModified` et la date affichée suivent le vrai jour
  de publication, jamais antidatés.
- Ne pas réécrire les pages protégées par le programme SEO en cours (lots en mesure, dix
  perdantes, pages préservées, lexique allemand) sans décision explicite de Thanh.
- Publier par lots, hors des fenêtres de mesure, chaque lot avec son propre T0.

## Traduction

Adapter, ne pas traduire mot à mot. Chaque langue garde ses requêtes locales, ses exemples et sa
typographie. Une version peut être plus courte qu'une autre si elle reste complète.

## Relecture avant livraison

- [ ] La première phrase décrit une scène vécue.
- [ ] Aucune affirmation déterministe, aucune prédiction, aucun diagnostic.
- [ ] Chaque chiffre a sa source, aucune citation non vérifiable.
- [ ] Les CTA ne promettent que ce que l'app fait.
- [ ] Intertitres en casse de phrase, typographie de la langue respectée.
- [ ] FAQ visible = JSON-LD, meta de 110 à 160 caractères, slug inchangé.
- [ ] `npm run docs:build` et `npm run docs:check` passent.
