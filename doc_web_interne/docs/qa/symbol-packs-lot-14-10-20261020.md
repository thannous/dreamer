# Lot 14 — 10 packs de symboles

Le lot conserve **10 couvertures peintes** et ajoute **70 PNG natifs** : un portrait dédié, une plaque sur alpha, trois scènes et deux effets par symbole. Le convertisseur existant fournit **380 dérivés AVIF/WebP**, sans agrandissement. Les six langues partagent les images et le moteur commun garde les peintures fixes.

Les sources, prompts exacts et provenance sont conservés localement et dans **[10 archives privées Drive](https://drive.google.com/drive/folders/1Ye1CGz0N6mZfyeyaIziRv6jiPd8u4DwI)**. [Le reçu](symbol-packs-lot-14-10-20261020.json) consigne les empreintes locales et les contrôles des métadonnées Drive, sans revendiquer de hachage distant.

**10 parcours passent** sur le candidat propre `3eadba5f121c1017c032929534d269c330aa5abb`, avec master `a51fd4fad506490fd0ca04e18ff1a1bcf6056901` intégré. Ils contrôlent les six langues à **2560×1440 et 390×844**, les trois scènes, les deux effets dans le temps, les titres, les ratios, la peinture stable, la réduction des mouvements et le portrait mobile sans téléchargement de la plaque masquée. Les **50 captures** et les 10 familles de sources ont été inspectées. Le build et `docs:check` passent.

Les variantes correspondent aux situations éditoriales existantes, avec des indices propres à chaque langue et une revue indépendante. Les interprétations longues et les nouvelles traductions concurrentes de master sont préservées. Les cartes portugaises ajoutées et celles réutilisées sont distinguées dans le reçu.

Reçu qualifié : `1792622632638-424-b316c888-73d0-442f-afed-8664f91fc696.receipt.json` ; SHA256 `1c37973071016ceb2d21391ca21343fa5e73addc1324674ccdef8b59005d41fe`. Les 256 autres parcours sont hors sélection. Cette preuve qualifie le navigateur local, sans campagne Release complète, appareil natif ou mesure de fluidité.

```sh
node tools/e2e/run.mjs site web run --grep new symbol packs: (witch|clown|gun|knife|wallet|doll|gold|coffin|sky|god) renders --no-cache
```

Après ce lot : **240 packs équipés, 0 à compléter**, soit 1440 pages équipées parmi 1 440 pages. Aucun accord visuel personnel, fusion de ce lot ou nouvelle publication n'est déclaré. Les preuves historiques restent conservées.
