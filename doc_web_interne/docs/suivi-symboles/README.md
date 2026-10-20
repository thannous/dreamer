# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV lisible dans GitHub](symbol-rollout.csv) · [Passation Codex / Claude](HANDOFF.md)

Le 20 octobre 2026, le cadre commun a été publié pour **240 symboles dans six langues, soit 1 440 pages**. **75 packs d'images** comprennent la plaque latérale et trois scènes illustrées. Les **74 packs du moteur commun** ont deux effets par surface ; le Tigre historique anime seulement son hero et reste à compléter. **165 packs restent à créer** : ces pages utilisent leur illustration statique existante, sans plaque ou scènes inventées. Les langues sont FR, EN, ES, DE, IT et PT-BR.

Version publiée : `1a63ecf787bc8d20e322314e1ba17987c83b1198`, après la PR [478](https://github.com/thannous/dreamer/pull/478). [Preuve de livraison](../qa/symbol-pages-uniform-20261020.json) : validation de publication passée, campagne navigateur complète, contrôles publics des 1 440 pages et échantillon mobile / 2560 px. Les 74 packs communs ont une QA actuelle dans les six langues ; les 240 pages ont une publication actuelle. Cela n'ajoute aucun accord visuel personnel de Thanh.

## Lire les états

- **Atlas / pack d'images** : huit rôles et six langues intégrés ; 450 pages équipées.
- **Commun** : cadre partagé publié avec l'illustration existante ; le pack reste à compléter.
- **QA / accord / publication** : chaque étape garde sa preuve propre. La présence d'images ne vaut pas validation.
- **Historique** : les 40 contrôles de la PR474 et les 37 publications antérieures sont conservés ; une preuve périmée n'est jamais effacée ou comptée comme actuelle.
- **Archive référencée** : les 304 PNG des 38 nouveaux packs PR474 sont décrits dans leur reçu ; leur disponibilité locale n'est pas affirmée. Les dérivés versionnés sont présents et permettent les réglages d'animation.

## Mettre à jour après chaque lot

1. Préparer six packs complets : paysage, portrait, plaque avec alpha, trois scènes et deux textures. Suivre [le guide](../symbol-atlas-guidelines.md), avec Codex pour les images et Claude pour l'intégration.
2. Consigner les preuves réelles dans [le registre](../../../docs-src/config/symbol-rollout.json), puis régénérer le rapport :

   ```sh
   npm run symbols:rollout --prefix apps/site -- --out /tmp/noctalia-symbol-rollout
   ```

3. Actualiser le classeur existant et son CSV à partir du même rapport : 240 IDs uniques, huit rôles par pack, six langues, étapes actuelles et historiques. Conserver formules, filtres et volets. Le classeur est un export, le registre fait autorité.
4. Publier le master autorisé avec la garde canonique, vérifier le site public, puis actualiser `snapshot.json` avec les empreintes des fichiers exportés. Recalculer, exporter et rouvrir le XLSX.

Sources : [profils et scènes](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [cadrages des pages sans pack](../../../docs-src/config/symbol-hero-portrait.json). Un cadrage modifié ne périme que la fiche concernée ; les mots propres aux scènes ne périment pas les pages sans scènes.
