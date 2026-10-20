# Lot 08 — 30 packs de symboles

Les 30 couvertures peintes existantes sont conservées. Le lot ajoute **210 PNG natifs** : un portrait dédié, une plaque avec alpha, trois scènes et deux effets par symbole. Les mêmes images servent les six langues ; le convertisseur commun fournit **1 140 dérivés AVIF/WebP**, sans agrandissement artificiel. Les profils et le moteur commun gardent la peinture fixe.

Les originaux, prompts, références et provenance sont sauvegardés localement et dans **30 ZIP privés sur [Drive](https://drive.google.com/drive/folders/1XzmtnMeVfBGWkT6XdLs5hGGI_kBjes0p)**. Les empreintes locales et les métadonnées des copies Drive sont consignées dans [le reçu du lot](symbol-packs-lot-08-30-20261020.json). Aucun hachage distant ni disponibilité publique de ces archives n’est affirmé.

**30 parcours passent** sur le candidat propre `9184f780a23f21687350020fa3448d58e4e0aadd`, après intégration de master `76d7e577d`. Les pages sont contrôlées dans les six langues à **2560×1440 et 390×844**. Les assertions françaises vérifient aussi les trois scènes, les deux canaux variables dans le temps sur chaque surface visible, les ratios, la peinture stable, la réduction des mouvements et le portrait mobile sans téléchargement de la plaque masquée. Les **150 captures** et les 30 familles de sources ont été inspectées. Le build et `docs:check` passent.

Le premier passage avait exposé deux divergences de ponctuation en portugais : le panneau applique désormais la normalisation déjà utilisée par la carte, sans affaiblir le test. La revue indépendante a également corrigé deux associations de variantes : hôpital en espagnol, école en italien. La scène d’école retenue correspond à une interrogation non préparée dans les six langues ; le contenu italien existant reste intact. Les versions sources précédentes sont conservées.

Le reçu qualifié est `1792498137105-10628-33a436f1-1e0c-4b44-be1e-93a49ecc84a6.receipt.json` (SHA256 `928dc1d72746b5aef67665dbd546ddb54e9102f738c938eb238b09c631fa0a91`), conservé avec une copie canonique des preuves. TesterArmy 0.21.2, moteur web 0.15.2. Les **55 autres parcours sont hors sélection** : ce résultat ne vaut pas campagne Release complète, qualification native ou mesure de fluidité.

Commande de rejeu :

```sh
E2E_WEB_PORT=8129 E2E_WORKERS=4 mise exec -- npm run test:testerarmy:site -- run --grep 'new symbol packs: (death|chase|spider|flood|exam|nudity|deceased-person|sun|tree|lion|money|blood|child|clothes|path|phone|plane|night|mouth|wedding|hospital|running|school|pregnancy|swimming|crying|cliff|lost|ex-partner|rainbow) renders'
```

Après ce lot : **105 packs équipés, 135 à compléter**. Le cadre commun des 1 440 pages était déjà livré ; ce lot reste en branche. Le registre, le CSV et l’Excel séparent les 30 QA actuelles des reçus historiques périmés pour ce candidat. Aucun accord visuel personnel, fusion ou nouvelle publication n’est déclaré.
