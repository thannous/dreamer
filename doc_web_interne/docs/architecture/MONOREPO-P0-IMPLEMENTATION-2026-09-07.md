# Monorepo — premier lot d'optimisation implémenté

Suite à l'autorisation d'implémentation de l'audit. Branche isolée
`codex/monorepo-build-optimization`, base `795878a7`. La PR #114 est conservée
dans sa tâche et sa branche ; aucune modification de celle-ci.

## Résultat

P0-B est implémenté et validé localement : les générateurs SEO et symboles
responsifs réutilisent les dérivés selon leurs empreintes, indépendamment des
dates de checkout. Source, recette effective, code des générateurs/helpers et
versions des bibliothèques Sharp participent à l'empreinte d'entrée. Une sortie
manquante ou corrompue est régénérée. Les manifestes sont écrits atomiquement à
la fin d'une génération réussie ; `--force` conserve son comportement.

Les manifestes suivables sous `docs-src/config/image-build-cache/` proviennent
d'une vraie génération, pas d'un enregistrement aveugle des fichiers existants.
La génération initiale n'a modifié **aucun fichier image déjà suivi par Git**.
Le registre parcourt 630 variantes SEO correspondant à 610 chemins distincts,
et 640 variantes symboles ; les deux manifestes décrivent donc 1 250 fichiers
déjà suivis. Ils ne sont pas copiés dans le site public.

P0-A est préparé dans la configuration suivie : inclusion générale `*`,
exclusion des répertoires applicatifs et documentaires identifiés. Tous les
scripts, données partagées, manifests, fichiers Node, assets racine et chemins
inconnus restent inclus. `npm run docs:build-impact -- --base SHA --head SHA`
permet un rejeu sans changer le fournisseur ni annuler un job. Le diagnostic
traite les deux côtés des renommages, les suppressions et les replis Pages.

**Les règles Cloudflare ne sont pas activées à distance.** Aucune configuration
CircleCI, Vercel ou fournisseur n'a été modifiée. Le champ JSON est la proposition
versionnée à appliquer lors d'une opération d'hébergement autorisée. Il ne faut
pas confondre cette préparation avec une baisse déjà obtenue des builds distants.

## Preuves locales

| Vérification | Résultat |
| --- | --- |
| Tests ciblés cache, générateurs réels Sharp et règles Pages | 4 suites, 48 tests PASS |
| ESLint sur tous les scripts touchés | PASS |
| Génération initiale / création de provenance | `docs:build` PASS, 230,10 s |
| Même build avec réutilisation des dérivés | PASS, 6,24 s |
| Copie indépendante des sources/sorties, 3 344 dates changées | 0 variante régénérée sur 1 270 ; manifestes identiques |
| Générateurs dans cette copie | SEO 0,369 s ; symboles 0,332 s |
| Contrats complets du site | `docs:check` PASS, 7,97 s |
| Rejeu de 20 transitions first-parent avant `795878a7` | 5 ignorées / 15 conservées par les règles proposées |
| Rejeu du diff PR114 connu | Build conservé, notamment à cause du manifest et des scripts partagés |

Commandes de validation :

```bash
npm run test:file -- scripts/check-pages-build-impact.test.js scripts/image-build-cache.test.js scripts/generate-image-seo-assets.test.js scripts/generate-symbol-responsive-images.test.js --watchman=false
npm run docs:build
npm run docs:check
npm run docs:build-impact -- --base 795878a7 --head 49cfe2b2
```

Les cas de test couvrent les dates changées avec contenu identique, les octets
changés avec date conservée, la recette/code/version modifiée, la corruption ou
l'absence de sortie, l'échec d'encodage, le manifeste invalide et les chemins
partagés/inconnus. La copie fraîche utilise une installation Node existante ;
elle vérifie l'indépendance des chemins et dates, pas une installation Linux.

Les versions publiées de `@img/sharp-libvips-linux-x64@1.2.4` ont été comparées
à Sharp local : elles correspondent toutes. Le runtime Linux n'a pas été
exécuté (daemon Docker local indisponible). Toute différence future d'encodeur
invalidera volontairement les empreintes.

Les mesures comparent l'initialisation et la réutilisation du **même code
modifié sur la même machine**. Elles ne sont pas un avant/après de production.
Le rejeu Git n'est pas une liste des événements push fournisseur et ne prédit
donc ni les économies mensuelles ni la baisse exacte du nombre de builds.

[Preuves structurées et empreintes des fichiers](./MONOREPO-P0-EVIDENCE-2026-09-07.json).

## Revue, intégration et suite

Revue indépendante du code et des artefacts finaux par Astra, distinct des
auteurs : PASS, sans défaut actionnable. Le reviewer a vérifié les sept hashes
de fichiers consignés, les 1 250 hashes de sorties, leur présence dans Git et
l'absence de changement d'asset suivi. La limite d'exécution Linux demeure.
Aucun commit, push, déploiement ou réglage fournisseur n'est effectué dans ce
lot local.

Les prochaines étapes de l'audit restent distinctes : activation contrôlée des
watch paths, package site indépendant (P1-A), sélection de consommateurs/tests,
puis préparation des workspaces et extraction Lucid/Journal après intégration
du lot B et qualification native. Aucun identifiant, stockage, droit ou contrat
applicatif n'a été modifié pour obtenir ces gains de build.

Retour arrière local : retirer la réutilisation par empreintes des deux
générateurs et les deux manifestes ; les dérivés existants restent inchangés.
Pour les futures règles fournisseur, enregistrer l'état live avant application
afin de pouvoir restaurer seulement les champs de chemins modifiés.
