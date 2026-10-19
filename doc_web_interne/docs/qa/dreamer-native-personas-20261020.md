# Dreamer — quatre personas natifs avec Sol

Campagne du 20 octobre 2026 (heure de Paris) : **4/4 sur iOS et 4/4 sur Android**, sans retry, replay ni cas ignoré.

## Candidat et portée

Master récupéré à `ce62eb9d405aec4ba3087b1ca58f711c5d5fac08` dans un checkout isolé ; les modifications du checkout principal sont conservées.

| Cible | Appareil de QA | Release local embarqué |
| --- | --- | --- |
| iOS | `Noctalia_Framerate_QA`, iPhone 17 Simulator, iOS 27.0 | 3.7.0 (14), ARM64, signature désactivée pour Simulator |
| Android | `Noctalia_Personas_QA`, `emulator-5558`, Android 17 / API 37 | 3.7.0 (83), ARM64 |

Source des deux binaires : `597f4fef8a83aa4358826287a709ad6b51636898`.
Source des tests natifs : `bc1b3e9b4b185fa35cdd60b5c9aa4f1fde3d04c5`.
Profil `mock-persistent`, audio simulé, fiches d’introduction désactivées, fixtures QA standard, OTA désactivée. Les builds incluent les données embarquées du dernier master. Les modifications de la PR concernent le harnais E2E ; un suivi documentaire ne modifie pas ces binaires.

SHA-256 Android : `fade331a408ca959c824d92334a046ee02bdf32b02b81bdfe6be20fa7082b5fe`.
SHA-256 iOS : `4843c62352c8e1fb5ad61f118ad68c6d4b2c183ae899a3d4e04b2e9b97160183`.

Modèle : `chatgpt.responses/gpt-6.1-sol`, connexion ChatGPT existante. Un worker par appareil, aucun replay ni retry ; 16 actions et 12 appels modèle maximum par objectif, 32 000 tokens d’entrée maximum par requête. Les saisies, contrôles de persistance et assertions exactes passent par le SDK sans modèle.

## Résultats

| Persona | Invariant contrôlé | iOS | Android |
| --- | --- | --- | --- |
| Camille | Conserver sans lecture IA, retrouver l’unique entrée et son texte éditable exact | Réussi | Réussi |
| Alex | Retrouver le jardin, l’ajouter aux favoris, rouvrir depuis le filtre avec son récit intact | Réussi | Réussi |
| Samira | Envoyer une question, attendre la réponse complète, reprendre le même échange, saisir puis effacer un brouillon sans doublon | Réussi | Réussi |
| Lucas | Refuser Plus, conserver le rêve, rester à 3/3 et constater zéro achat/restauration | Réussi | Réussi |

Les verdicts exigent les assertions exactes après les objectifs de l’agent, l’identité du binaire installé avant/après, la provenance du modèle, la stabilité des sources et la fin du nettoyage SDK.

## Adaptations vérifiées pendant les pilotes

- Annulation de la proposition Android de pack vocal français, puis accès direct à Tous les paramètres.
- Un bouton iOS partiellement recouvert peut être annoncé accessible. Le geste d’édition part dans la zone du récit calculée au-dessus du panneau fixe ; le champ est ensuite rendu visible avant de lire sa valeur.
- Le retour flottant est utilisé lorsque l’en-tête passe sous la barre d’état ; l’affichage du journal est ensuite exigé.
- Le consentement natif est reconnu malgré les majuscules Android. Dans le simulateur iOS, le bouton Envoyer est utilisé avec le clavier de discussion ouvert.
- La recherche précédente laissée par Sol est effacée, remise à l’écran quand les résultats déplacent la barre de recherche, puis son état vide est confirmé avant la saisie exacte. Les échos Text du titre iOS sont désambiguïsés dans la page du rêve ; la transition depuis le journal est attendue.
- Un échec de préparation avant tout appel modèle peut prouver le nettoyage SDK tout en restant non qualifiant pour l’application. Un contrôle isolé reproduit cette frontière et refuse un faux succès ou un nettoyage incomplet.

## Reproduction et preuves

Les commandes et prérequis sont dans [tools/e2e/README.md](../../../tools/e2e/README.md#native-personas-with-sol). À partir du checkout et des projets natifs correspondant aux reçus :

```sh
E2E_PERSONAS=1 E2E_PERSONA_MODEL=gpt-6.1-sol \
  E2E_DEVICE=9ACD9962-82C0-4AEB-8F9B-EC99327F6B45 \
  E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-ios/1792449016247-95372-c8ce7fc5-fbeb-49be-830f-5a5fa12fd573/release.json \
  mise exec -- npm run test:testerarmy:mobile -- dreamer ios run --tag personas
E2E_PERSONAS=1 E2E_PERSONA_MODEL=gpt-6.1-sol \
  E2E_DEVICE=emulator-5558 E2E_AVD_NAME=Noctalia_Personas_QA \
  E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-android/1792449017753-95660-1ad82a56-a996-44ff-ae30-49a17987dc3f/release.json \
  mise exec -- npm run test:testerarmy:mobile -- dreamer android run --tag personas
```

Campagnes finales, toutes deux sur `bc1b3e9b4b185fa35cdd60b5c9aa4f1fde3d04c5` :

- iOS : `tools/e2e/.e2e/dreamer-ios/1792449807288-38740-4ec39722-99a1-40f1-a9f1-535676ced786/`, run `01a15655-8fe3-751c-948f-24aa9dce407a`.
- Android : `tools/e2e/.e2e/dreamer-android/1792449805790-38568-bd85e281-e72a-4e6d-961d-446e3f23e11c/`, run `01a15655-83d8-7fd4-bde9-ee0c5b41073c`.

Sept objectifs agent par plateforme ; provenance `chatgpt.responses/gpt-6.1-sol` vérifiée sur chacun. Les deux campagnes qualifient les quatre parcours : sources propres et stables, identité installée avant/après, nettoyage complet et verrou libéré. Les copies des campagnes et builds dans le checkout principal ont été contrôlées à leur transfert ; ce sont les mêmes preuves, pas de nouvelles exécutions. Les artefacts privés restent ignorés par Git : `report.json`, `qualification.json`, `evidence.json`, `end.json`, traces et captures, avec leurs empreintes dans `files.json`.

`TMPDIR=/private/tmp mise exec -- npm run verify:pr` passe sur `bc1b3e9b4b` : 4 contrôles exécutés, 8 preuves inchangées réutilisées et 5 contrôles hors périmètre. La PR porte le commit de livraison et sa preuve finale. Les contrôles incluent types, lint, contrats et gardes du harnais ; aucune protection n’est contournée. Relecture indépendante du diff puis de ses corrections : aucun défaut concret restant. Les tests isolés de provenance couvrent les rapports falsifiés, une mauvaise plateforme ou un mauvais modèle et le nettoyage incomplet, impossibles à reproduire utilement par un parcours d’interface.

## Limites

Les parcours exercent les interfaces natives avec auth, IA et facturation simulées. Ils ne qualifient ni le backend, les achats Store, la restauration après réinstallation, les téléphones physiques, ni les performances ou le framerate. Le rendu logiciel de l’émulateur Android sert à cette campagne fonctionnelle.
