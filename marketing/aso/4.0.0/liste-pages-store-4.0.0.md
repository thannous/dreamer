# Pages Store Noctalia 4.0.0 : liste à faire

18 novembre 2026

## En bref

Les builds candidates sont prêtes : iPhone 4.0.0 (26) sur TestFlight et Android 4.0.0 (90) en test interne Play. Les textes sont prêts, et les 22 captures iPhone FR et EN de la 4.0 sont faites (18 nov., thème sombre). Restent deux retouches de captures, les captures Android, l'image de présentation Google Play, puis la saisie et la soumission dans les deux consoles, par Thanh.

Ordre proposé :

1. Captures iPhone FR et EN : faites le 18 nov. Restent la barre du haut à nettoyer, Tendances en anglais à refaire, et les captures Android.
2. Remplir App Store Connect : fiche, captures, confidentialité, âge, abonnements rattachés à la version, notes de revue et comptes de démonstration, puis soumettre le build 26.
3. Remplir la Play Console : titre français (n°10), captures, image de présentation, notes de version ci-dessous, puis passer la 90 en production.
4. Me dire que c'est parti, pour enregistrer la publication dans le dépôt.

La vidéo d'en-tête App Store est facultative. Si on la veut un jour, la première doit partir avec une version : c'est maintenant ou à la prochaine mise à jour.

## Pour l'agent qui reprend cette liste

Cette liste est à jour au 18 novembre au soir. Un agent peut préparer les images et relire les textes ; seul Thanh saisit, soumet et publie dans les consoles.

**Où sont les choses**

- Dépôt sur le Mac mini : `/Users/timax/Projects/noctalia`, branche master (à jour au commit `b57dc32b`).
- Captures du 18 nov. : `outputs/store-captures-20261118/fr/` et `en/` dans ce dossier, 22 images en thème sombre, prises sur la build 26. Refaites ce soir en anglais : `en/03-dream.png`, `en/05b-more.png`, `en/06b-chat.png`.
- Textes des fiches : `textes-fiches-store-4.0.0.md` et ses deux JSON, dans ce même dossier. Fiches App Store FR/EN et Google Play FR/pt-BR : dans le dépôt, `marketing/aso/` (liens en bas).
- Builds candidates : iPhone 4.0.0 (26) et Android 4.0.0 (90), faites depuis le commit `e68c03017`.

**Reste à faire**

- [ ] Nettoyer la barre du haut des captures : c'est celle du vrai iPhone (5G, batterie, pastille verte, « ◀ TestFlight »).
- [ ] Refaire la capture Tendances en anglais : elle mélange des rêves de test en français.
- [ ] Faire les captures Android (2 à 8 par langue, plan des 7 captures dans la fiche Google Play FR) et l'image de présentation 1024 × 500.
- [ ] Relire les textes espagnols, allemands, italiens et portugais.
- [ ] Thanh : remplir puis soumettre App Store Connect (build 26) et la Play Console (build 90).

**À ne pas faire**

- Ne pas utiliser le rêve anglais du train pour une capture de son récit : le texte s'arrête à « and I felt I had ».
- Ne rien soumettre ni envoyer en vérification, ne passer aucune build en production : c'est Thanh qui le fait.
- Ne publier aucune mise à jour à distance (`mobile-release.js update` sans `--dry-run`) et ne rien déployer.
- Ne pas créer les comptes de démonstration, ne jamais utiliser le compte de Thanh pour la revue, n'accepter aucun accord dans les consoles.
- Ne pas changer les réglages des téléphones de Thanh : Noctalia y reste en langue automatique et en thème sombre.
- Dans les textes visibles, aucun nom d'outil technique et aucun tiret long.

## Tests avant soumission : faits ou pas

Les candidates sont maintenant l'iPhone 4.0.0 (26) et l'Android 4.0.0 (90), qui ne changent que les guillemets selon la langue. Sur les builds précédents, iPhone (25) et Android (89), la plupart des corrections sont vues sur téléphone ; restent à faire la connexion Apple, la dictée, la suppression de compte et l'analyse en invité complète, et les achats n'ont été testés que sur les builds 24 et 88. « Fait » veut dire vu de mes yeux sur l'appareil ou dans le résultat d'une commande, jamais déduit du code.

| Test | iPhone 25 | Moto 89 |
| --- | --- | --- |
| Mise à jour depuis TestFlight ou le test interne Play, données gardées | Fait | Fait |
| Tutoiement dans l'analyse et la discussion | Fait | Fait |
| Guillemets selon la langue autour de la phrase-résumé (builds 26 et 90) | Fait sur la 26, en anglais (“ ”) | Fait sur la 90, en français (« ») |
| Fin de « très tentative » | Fait | Fait ; « association tentative » (n°18) corrigé par la PR #718, en ligne et vérifié le 18 nov. |
| Bouton « Réessayer » après coupure réseau | Pas fait | Fait |
| Journal mis à jour d'un téléphone à l'autre | Pas fait dans ce sens | Fait (rêve créé sur l'iPhone) |
| Restauration avec abonnement actif, « Achats restaurés. » | Fait | Fait (message 2,5 à 4 s) |
| Restauration sans abonnement, message long | Pas fait | Pas fait (vu sur la 88, avant la correction) |
| Contrôle d'Apple en invité (App Attest) | Fait, 18 nov. 13:18 UTC | Sans objet |
| Analyse en invité jusqu'au bout | Pas fait (quota de l'appareil) | Pas fait, ni le contrôle Google (Play Integrity) |
| Achat test, activation de Plus, reconnu sur l'autre téléphone | Fait sur la 24, pas refait | Fait sur la 88, pas refait |
| Fin d'abonnement et retour à l'offre gratuite | Pas fait | Fait sur la 88, pas refait |
| Connexion Google | Pas fait | Fait sur la 88, pas refait |
| Connexion avec Apple, vrai compte | Pas fait (à toi) | Sans objet |
| Suppression de compte | Pas fait | Pas fait |
| Dictée à voix haute | Pas fait (à toi) | Pas fait (à toi) |
| Widgets, Siri, minuterie des sons sur l'écran verrouillé | Pas refait (simulateur le 25 oct., ancienne version) | Sans objet |

Sur simulateur et en vérification automatique :

| Contrôle | Commit | État |
| --- | --- | --- |
| Vérification complète avant build (verify:release) | da2787a3, celui des builds | Fait, 36 sur 36 |
| iPhone, comptes simulés | Final | Fait, 23 sur 23 |
| iPhone Duo fermé et ouvert (n°14 à 16) | Final | Fait |
| iPhone Duo mi-ouvert, thème clair sur le Duo | Aucun | Pas fait |
| Android, trois couches | PR #714, le précédent | Fait, pas rejoué sur le final |
| iPhone, configuration production | PR #714, le précédent | Fait, 11 sur 11, pas rejoué sur le final |
| iPhone, couche « serveur local » | Aucun | Jamais passée en entier (échecs de l'outil de test, pas de l'app) |

Entre le commit précédent et le final, seuls ont changé les guillemets de la discussion, les retouches du Duo et l'épinglage de la version.

Preuves, sur le Mac mini dans `outputs/` : captures des builds 25 et 89 dans `device-smoke-400-25-89-20261118/`, achats sur 24 et 88 dans `device-smoke-380-20261114/`, Duo dans `duo-400-20261117/master-ad6f8aa0a/`, rapports des simulateurs dans `release-simulators/` (iPhone « serveur local » : 5 sur 9, échecs de l'outil).

## App Store

C'est la première version iOS : pas de champ « Nouveautés », mais une fiche complète et tout le dossier de revue.

| Élément | État | À faire |
| --- | --- | --- |
| Nom, sous-titre, texte promotionnel, mots-clés, description | Prêts en FR et EN, limites d'Apple respectées | Coller. Espagnol, allemand, italien et portugais (Brésil) rédigés le 18 nov. dans textes-fiches-store-4.0.0.md, à relire |
| URL d'assistance, confidentialité, conditions, suppression de compte | Prêtes | Coller |
| Captures iPhone 6,9 pouces (1320 × 2868) | Faites le 18 nov. : 22 captures FR et EN, thème sombre, build 26 (Mac mini) | Nettoyer la barre du haut, refaire Tendances en anglais, puis envoyer ; les 4 autres langues plus tard |
| Captures iPad | Non concerné | L'app est iPhone seulement |
| Captures iPhone Duo | Facultatives | Exigées à partir d'avril 2027 |
| Vidéo d'en-tête (21:9, 3840 × 1646, 5 à 30 s, muette) et version recherche (3:2) | Pas faite, scénario proposé le 30 octobre | Facultative ; la première part avec une version |
| Vidéos d'aperçu classiques | Aucune | Facultatives |
| Icône 1024 × 1024 | Faite (dans le build) | Rien |
| Abonnements Plus mensuel et annuel | À rattacher à la version | Noms et descriptions FR/EN, prix, capture de l'offre pour chaque produit, état « Prêt à être soumis » |
| Confidentialité de l'app, questionnaire d'âge, droits sur le contenu, catégorie | Propositions dans la préparation du 5 novembre | Remplir et vérifier |
| Notes de revue (en anglais) et deux comptes de démonstration | Notes rédigées, comptes pas créés | Créer un compte gratuit et un compte Plus dédiés, jamais le tien |
| Accords, banque, statut de commerçant (UE) | À vérifier | Contrat « Paid Apps » actif, statut de commerçant déclaré |
| Build | 4.0.0 (26) sur TestFlight | Le choisir sur la version, puis « Soumettre pour vérification » |

La description décrit Plus comme « davantage d'analyses, de conversations et d'illustrations », sans promettre d'illimité : elle reste juste avec les plafonds de l'app, rien à changer.

## Google Play

Sur Google Play, la 4.0.0 est une mise à jour : d'après la note du 9 août, la production est encore la 3.1.0 (versionCode 54). Les utilisateurs Android sautent donc tout ce qui est sorti depuis, et la fiche date de cette époque.

| Élément | État | À faire |
| --- | --- | --- |
| Titre français (n°10) | La feuille d'achat en français montre « Noctalia: Dream Journal » | Ajouter la fiche française avec le titre « Noctalia : Journal de rêves » (prêt dans le dépôt) |
| Description courte et longue | FR et pt-BR du 9 août dans le dépôt ; EN dans la Console | Nouvelles versions dans les six langues dans textes-fiches-store-4.0.0.md (240 symboles, pleine lune, Tendances, IA nommée, paiement Google Play), à relire puis coller |
| Espagnol, allemand, italien | Rédigées le 18 nov. | Ajouter ces langues à la fiche dans la Console |
| Captures téléphone | À refaire depuis la 4.0 | 2 à 8 par langue, interface Android, selon les 7 captures prévues dans la fiche FR (journal, symboles, évolution, page du rêve, image, réflexion, capture), micro jamais au premier plan dans les trois premières |
| Image de présentation (1024 × 500) | Pas trouvée dans le dépôt ni les fichiers du projet | À vérifier dans la Console ; obligatoire pour la fiche |
| Icône 512 × 512 | À vérifier | Reprendre l'icône 1024 de l'app |
| Vidéo (lien YouTube) | Aucune | Facultative ; la vidéo d'en-tête App Store peut servir de base |
| Sécurité des données, classification, public cible | À vérifier dans la Console | Relire : l'IA, le compte et les achats ont changé depuis la 3.1.0 |
| Notes de version 4.0.0 | Prêtes en six langues | Coller la section suivante |
| Production | 4.0.0 (90) en test interne | Passer de test interne à production, avec un pourcentage de déploiement |

Les dimensions des images sont celles que je connais des règles de Google : la Console affiche les siennes au moment de l'envoi.

## Notes de version Google Play 4.0.0

Le bloc se colle tel quel dans le champ des notes de version de la Play Console, qui répartit chaque langue grâce aux balises. Les phrases reprennent la fenêtre « Nouveautés » de l'app, déjà relue, sans les widgets qui n'existent que sur iPhone. Chaque langue fait entre 345 et 375 caractères, sous la limite de 500.

```
<fr-FR>
• Chaque rêve s’affiche avec sa grande image.
• Dès l’ouverture, tu retrouves ton dernier rêve et ta semaine.
• Après chaque pleine lune, une lettre te parle de tes rêves du mois.
• Dans Tendances, chaque rêve devient une étoile.
• Le dictionnaire explique maintenant 240 symboles, comme l’eau, la maison ou le serpent.
• Gagne des cartes à collectionner en notant tes rêves.
</fr-FR>
<en-US>
• Each dream now shows its full picture.
• As soon as you open the app, you see your latest dream and your week.
• After each full moon, a letter tells you about your dreams of the month.
• In Trends, each dream becomes a star.
• The dictionary now explains 240 symbols, like water, a house or a snake.
• Earn collectible cards by writing down your dreams.
</en-US>
<es-ES>
• Cada sueño se muestra con su imagen grande.
• Nada más abrir la app, ves tu último sueño y tu semana.
• Después de cada luna llena, una carta te habla de tus sueños del mes.
• En Tendencias, cada sueño se convierte en una estrella.
• El diccionario ahora explica 240 símbolos, como el agua, la casa o la serpiente.
• Gana cartas coleccionables anotando tus sueños.
</es-ES>
<de-DE>
• Jeder Traum zeigt jetzt sein großes Bild.
• Gleich beim Öffnen siehst du deinen letzten Traum und deine Woche.
• Nach jedem Vollmond erzählt dir ein Brief von deinen Träumen des Monats.
• Unter Trends wird jeder Traum zu einem Stern.
• Das Lexikon erklärt jetzt 240 Symbole, zum Beispiel Wasser, Haus oder Schlange.
• Sammle Karten, indem du deine Träume festhältst.
</de-DE>
<it-IT>
• Ogni sogno ora si mostra con la sua immagine grande.
• Appena apri l’app, ritrovi il tuo ultimo sogno e la tua settimana.
• Dopo ogni luna piena, una lettera ti racconta i sogni del mese.
• In Tendenze, ogni sogno diventa una stella.
• Il dizionario ora spiega 240 simboli, come l’acqua, la casa o il serpente.
• Vinci carte da collezionare annotando i tuoi sogni.
</it-IT>
<pt-BR>
• Cada sonho aparece com sua imagem grande.
• Assim que você abre o app, vê seu último sonho e sua semana.
• Depois de cada lua cheia, uma carta fala dos seus sonhos do mês.
• Em Tendências, cada sonho vira uma estrela.
• O dicionário agora explica 240 símbolos, como a água, a casa ou a cobra.
• Ganhe cartas colecionáveis anotando seus sonhos.
</pt-BR>
```

Si la Console refuse le bloc, retire les langues que la fiche Play ne contient pas encore.

## Où sont les fichiers

| Fichier | Contenu |
| --- | --- |
| [app-store-listing-2026-11-05.json](https://github.com/thannous/dreamer/blob/master/marketing/aso/app-store-listing-2026-11-05.json) | Fiche App Store FR et EN à coller, URLs |
| [2026-11-05-soumission-ios.md](https://github.com/thannous/dreamer/blob/master/doc_web_interne/docs/app-store/2026-11-05-soumission-ios.md) | Étapes App Store Connect, confidentialité, notes de revue, règles des captures |
| [google-play-fr-2026-08-09.json](https://github.com/thannous/dreamer/blob/master/marketing/aso/google-play-fr-2026-08-09.json) | Fiche Google Play FR et plan des 7 captures |
| [google-play-pt-br-2026-08-09.md](https://github.com/thannous/dreamer/blob/master/marketing/aso/google-play-pt-br-2026-08-09.md) | Fiche Google Play portugais (Brésil) |
| Fichiers du projet : captures-app-store-fr.zip et captures-app-store-en.zip | Captures du 7 octobre (3.6.0), remplacées par celles du 18 nov. sur le Mac mini |
| Fichiers du projet : app-store-3.6.0/a-coller-dans-app-store-connect.md | Ancienne fiche 3.6.0, pour mémoire |

Nouveaux textes du 18 novembre, dans les fichiers du projet sous release-4.0.0 : textes-fiches-store-4.0.0.md (App Store en espagnol, allemand, italien et portugais ; Google Play dans les six langues, champ par champ), et les mêmes en JSON.
