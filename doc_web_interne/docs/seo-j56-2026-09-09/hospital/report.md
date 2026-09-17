# Hospital ES — J56, 9 septembre 2026

Correctif préparé sur master distant rafraîchi `84c85a9aa77bc24a6a4a05723a623600dc519b7e`. Copie de validation isolée : `/private/tmp/noctalia-j56-hospital`. Le dépôt principal et l’ancien worktree conservent leur WIP. Patch durable : `hospital-es.patch` dans ce dossier.

## Modification proposée

Deux ajouts seulement dans `data/dream-symbols.json`, `hospital.es` :

- `documentTitle` : `Soñar con un hospital: estar allí o verlo lleno`
- `documentMetaDescription` : `¿Qué significa soñar con un hospital? Compara estar allí, verlo lleno de gente, enfermos o personal médico según tu emoción y contexto, sin predicciones.`

Titre rendu : `Soñar con un hospital: estar allí o verlo lleno | Noctalia` (58 caractères). Description : 153 caractères. Canonical : `https://noctalia.app/es/simbolos/hospital`.

## Preuves

- Comparaison JSON master/candidat : exactement deux champs ajoutés, aucun changement corps/FAQ/slug/date/autre langue (`source-diff.json`).
- `npm run docs:build` : PASS (`build.log`).
- `npm run docs:check` : PASS ; 1 264 pages HTML, 1 261 URL sitemap, zéro erreur, zéro avertissement (`check.log`).
- Le build a régénéré `docs-src/static/js/experience/experience.js`. La revue a aussi repéré deux anciens chunks supprimés par le build (`lenis-EYMXDREL.js`, `mini-VBHZKDYU.js`). Les trois fichiers ont été restaurés depuis master dans la copie isolée ; ces effets de build ne figurent pas dans le patch. Le contrôle `docs:check` final repassé : PASS (`check-final.log`).
- `git apply --check` du patch et `git diff --check` : PASS.
- Revue indépendante : PASS du patch final, comparaison de 5 852 fichiers suivis ; voir independent-review.md.

## Décision restant à prendre

Le présent lot prépare la décision de publication. Aucun commit, push ou déploiement n’a été exécuté. Avant livraison autorisée, revalider que master n’a pas changé sur ces champs, appliquer ce seul patch, puis distinguer CI, déploiement et preuve HTTP publique. Ne pas fusionner l’ancienne branche SEO entière.
