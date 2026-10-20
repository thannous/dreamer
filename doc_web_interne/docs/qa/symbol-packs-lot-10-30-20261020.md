# Lot 10 — 29 packs de symboles

Le lot conserve **29 couvertures peintes** et ajoute **203 PNG natifs sélectionnés** : un portrait dédié, une plaque sur alpha, trois scènes et deux effets par symbole. Le packer existant fournit **1 102 dérivés AVIF/WebP**, sans agrandissement artificiel. Les six langues partagent ces images et le moteur commun garde les peintures fixes.

Les originaux, prompts exacts et provenance sont conservés localement et dans **[29 archives privées Drive](https://drive.google.com/drive/folders/1fUiZ6cBJMwNNV54MYLLPhvwFd47YfT6Q)**. [Le reçu du lot](symbol-packs-lot-10-30-20261020.json) consigne leurs empreintes locales et les contrôles des métadonnées Drive ; aucun hachage distant n’est revendiqué.

**29 parcours passent** sur le candidat propre `fc0d47528b092ffae3e49cc020fbc27e902dc01b`, après intégration de master `1038406132baf06556f6abda8f1620ac4774984b`. Ils couvrent les six langues à **2560×1440 et 390×844**, les trois scènes, les deux effets indépendants dans le temps, les titres, les ratios, la peinture stable, la réduction des mouvements et le chargement du portrait mobile sans plaque masquée. Les **145 captures** et les 29 familles de sources ont été inspectées. Le build et `docs:check` passent.

Les 24 symboles sans variantes portugaises ont reçu les traductions fidèles des trois variantes existantes en anglais : **72 cartes**, relues indépendamment. Leurs interprétations longues existantes restent intactes. La scène d’accident d’avion utilise la variante italienne d’indice 6, et non celle sur les blessures. Les versions d’images remplacées restent conservées.

Reçu qualifié : `1792508452899-70673-6b32244d-b9ed-44af-8900-c696167ce241.receipt.json` ; SHA256 `6e78f33f0ebc92fefcaafc45e908bee2dd1d24ee2a9e03114bac8db686daf83b`. Les 91 autres parcours sont hors sélection. Cette preuve qualifie le navigateur local ; elle ne vaut ni campagne Release complète, ni appareil natif, ni mesure de fluidité.

Commande de rejeu :

```sh
node tools/e2e/run.mjs site web run --grep new symbol packs: (abandonment|accident|angel|arguing|apocalypse|mother|father|sibling|partner|friend|stranger|teacher|police|doctor|coworker|grandmother|birth|funeral|grandfather|classroom|bathroom|bedroom|kitchen|workplace|road|bus|bicycle|airport|suitcase) renders
```

Bateau a été intégré dans master pendant la génération et son pack est conservé. Ses sept variantes générées ici restent archivées localement, sans remplacer les images servies. Les six packs concurrents restent dans le lot 09 ; notre lot devient le lot 10.

Après ce lot : **140 packs équipés, 100 à compléter**, soit 840 pages équipées dans le cadre commun de 1 440 pages. Les 30 QA inchangées du lot 08 restent actuelles ; ce lot en ajoute 29. Aucun accord visuel personnel, fusion de ce lot ou nouvelle publication n’est déclaré.
