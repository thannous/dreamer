# TI559 — Évaluation réelle du corpus synthétique

Douze requêtes, douze réponses JSON valides, sans relance fournisseur ni fallback. Modèle `gemini-3.7-flash`, prompt courant `analysis-2026-09-08.1`, baseline `d2bc25936`. Six récits inventés en six langues, une paire avant/après chacun. Clé existante Dreamweaver utilisée uniquement en mémoire après identification de cet environnement par le propriétaire.

Deux préflights se sont arrêtés avant envoi : permission du renommage atomique, puis énumération de l’environnement par le SDK. Les dossiers étaient vides et aucun reçu de réservation n’avait été écrit. Les probes sans réseau ont reproduit les deux causes. Le lancement final a produit le reçu de douze requêtes et les douze résultats conservés ici. Aucun récit privé, appel Edge, accès DB ou déploiement n’a eu lieu.

## Mesures descriptives

Mots de l’interprétation uniquement, découpage par espaces, titres Markdown inclus. Ces nombres ne mesurent ni une qualité clinique ni des performances générales.

| Cas | Avant | Après | Type après | Émotions après |
|---|---:|---:|---|---:|
| en-short | 222 | 59 | Unknown | 0 |
| fr-rich | 214 | 104 | Unknown | 2 |
| es-short | 221 | 72 | Unknown | 0 |
| de-rich | 210 | 124 | Lucid Dream | 1 |
| it-short | 175 | 66 | Unknown | 0 |
| pt-rich | 204 | 114 | Unknown | 1 |

Les trois récits brefs passent de 175–222 à 59–72 mots et n’inventent plus d’émotions dans le tableau dédié. Les récits plus riches restent plus développés (104–124 mots après). La lucidité explicitement racontée en allemand est conservée ; les cinq classifications non établies deviennent Unknown. La répétition d’un trajet dans le seul récit portugais ne devient pas un rêve récurrent.

## Lecture fonctionnelle du parent

Le gain principal est la séparation entre ce qui est raconté et des pistes présentées comme possibles. La baseline prête aux récits courts des états intérieurs ou des transitions de vie : la seule porte bleue devient une invitation profonde du subconscient, et la lumière blanche une guérison spirituelle. Le candidat réduit nettement ces affirmations.

Le résultat ne doit pas être présenté comme parfait. Les champs de symboles conservent des associations culturelles générales (porte/seuil, bleu/calme) ; elles restent des hypothèses, sans établir le sens personnel du rêve. Le récit français transforme l’absence de peur en sérénité ou sécurité dans une explication émotionnelle : cette extension légère mérite attention. Les prompts d’image ajoutent un habillage visuel ; ils ne sont pas un compte rendu factuel. Aucune image n’a été générée.

Les six réponses candidates posent deux questions facultatives, sans présupposer un traumatisme, une maladie ou un événement personnel. Ce corpus ne démontre pas que le modèle sait toujours ne poser aucune question. Il ne couvre ni toutes les longueurs dans chaque langue, ni la variabilité entre générations, ni des attaques de prompt, ni le rendu sur appareil.

## Décision après revue indépendante

La revue indépendante confirme le gain et retient des écarts de fidélité : FR ajoute sérénité/sécurité et un quai ; IT transforme un souvenir partiel en totalité du rêve et invente une relation spatiale ; DE attribue un motif de protection à une action. Pour la fidélité stricte après changement : EN/ES/PT passent, FR/IT échouent sur ces ajouts, DE reste indéterminé sur une reformulation mineure. Aucun diagnostic ni promesse clinique n’est relevé dans les réponses révisées.

TI559 reste ouvert. La prochaine correction doit empêcher les ajouts dans les observations, préserver la distinction entre souvenir et rêve complet et éviter d’étendre une émotion absente ou négative en état positif. Les cas de cauchemar, demande de diagnostic et instructions malveillantes font encore partie de la qualification restante. Les douze requêtes de ce run sont consommées ; aucune nouvelle génération n’a été lancée.

Voir `ti559-evaluation-2026-09-08/independent-review.md` pour les appréciations détaillées. La fusion du harnais et de cette preuve ne vaut pas activation d’une nouvelle version en production.
