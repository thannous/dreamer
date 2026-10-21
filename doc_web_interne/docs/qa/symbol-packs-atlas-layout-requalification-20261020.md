# Atlas — qualification du cadre paysage commun

Le cadre des scènes conserve leur format paysage quand une légende s’allonge. Le défaut était reproduit sur Masque : le recadrage mobile coupait la bougie et rendait son second effet invisible. Le correctif est commun, sans modifier les peintures ni les six configurations reprises de master.

**177 parcours passent sur 175 packs** au commit propre 34209f968444db816f75779cd5b876df002ae9d3 : 174 parcours communs dans les six langues à 2560×1440 et 390×844, et trois parcours spécifiques Tigre avec leurs dimensions consignées. Les deux effets, leur visibilité et leur mouvement, les trois variantes, les ratios, la peinture stable, les titres et la réduction des mouvements sont contrôlés. Les 24 autres parcours sont hors sélection. Build et contrôle du site passent.

**225 captures fraîches inspectées** : 29 nouveaux packs actifs du lot 11, les six packs préservés de master et dix exemples antérieurs. Les autres peintures antérieures sont inchangées ; leurs comportements sont vérifiés par les parcours. La revue indépendante ne relève aucun P1/P2 restant.

[Le reçu détaillé](symbol-packs-atlas-layout-requalification-20261020.json) conserve les identités et les empreintes. Reçu transféré : 1792519982450-96648-981aecb0-8df4-46b2-bb15-4ae165177bee.receipt.json, SHA256 c69f4a6961030bcdf5f3b0aa19c1c9888e8ac3223243b0e1015a660a4cfa4ca2. Les sources, prompts et provenance des 29 packs actifs du lot 11 sont dans [leurs archives Drive](https://drive.google.com/drive/folders/1I3ezCQgUTgPD758S_NZRMbQ5x7C7hz__). La correction du cri silencieux est incluse. L’ancienne Bague reste conservée comme alternative, et le pack master est utilisé. L’archive native des six packs hérités est référencée mais absente de ce poste ; aucune copie Drive de ces originaux n’est revendiquée.

La lecture de l’inventaire Git accepte désormais une liste supérieure à 1 Mio sans supprimer aucun fichier ou hachage. Les preuves antérieures restent immuables et deviennent historiques quand leurs entrées changent. Aucun accord visuel personnel ou publication de ce candidat n’est déclaré.

Commande de reprise :

    E2E_WEB_PORT=8129 mise exec -- node tools/e2e/run.mjs site web run --grep '(new symbol packs:|the tiger paintings each|on a phone the tiger hero|the French tiger atlas)' --no-cache
