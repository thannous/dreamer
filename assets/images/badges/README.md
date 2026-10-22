# Illustrations des badges Noctalia

20 illustrations de famille pour une collection de 60 récompenses : bronze,
argent et or. Les illustrations sont originales, créées avec l’outil intégré
imagegen. Elles sont fournies sans texte, sur fond transparent.

- `catalogue.json` : identifiants, noms, critères et trois seuils proposés.
- `<family-id>-v1.png` : illustration originale de la famille.
- `generation-prompts.json` : prompts exacts de génération et provenance.
- `asset-info.json` : dimensions, transparence, taille et SHA-256 des fichiers.
- `preview.html` : planche de contrôle sur fonds sombre et clair.

Le cadre doré fait partie de l’illustration ; il ne signifie pas qu’un niveau or
est acquis. Claude décide de la présentation, des matières et effets propres aux
trois niveaux. Il peut recadrer ou adapter l’intégration. Cette planche ne définit
pas l’interface finale de l’application.

Les PNG originaux conservent leur résolution et leur transparence. Prévoir des
exports adaptés à la taille affichée lors de l’intégration mobile et conserver
les originaux comme sources. Ne pas déclarer le parcours ou les effets qualifiés
sur la seule base des images.

Le brief produit transmis à Claude est dans [PLAN.md](PLAN.md).

## Intégration dans l’app

L’app n’embarque pas ces PNG : elle utilise des exports WebP qui gardent la
transparence, `app/<family-id>.webp` (720 px, carte tenue en main) et
`app/<family-id>-small.webp` (320 px, album et rangée des niveaux). Après une
nouvelle livraison, régénérer avec `node scripts/export-badge-artwork.mjs` ;
`--check` signale un export manquant. La correspondance famille/fichier et les
habillages bronze, argent et or sont décrits dans
[les règles de la collection](../../../lib/badges/README.md).
