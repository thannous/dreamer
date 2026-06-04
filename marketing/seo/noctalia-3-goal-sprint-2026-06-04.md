# Noctalia SEO sprint - 3 goals - 2026-06-04

Source GSC: `marketing/seo/search-console/2026-03-05_to_2026-06-02/`
Property: `sc-domain:noctalia.app`

## Baseline globale

- Clics: 1 912
- Impressions: 565 292
- CTR moyen: 0,34 %
- Position moyenne: 10,4
- Dynamique recente: les 28 derniers jours font 1 019 clics contre 512 sur les 28 jours precedents.

## Goal 1 - Sprint CTR espagnol

Objectif: passer le CTR combine des pages espagnoles prioritaires de ~0,35 % vers 0,60 % sur la prochaine fenetre comparable, sans multiplier les changements non mesurables.

Pages traitees:

| Page | Baseline GSC | Action |
| --- | ---: | --- |
| `/es/simbolos/hospital` | 43 552 impr., CTR 0,21 %, pos. 7,3 | Recentrer title/meta/FAQ sur `soñar con hospital`, `soñar con un hospital`, `hospital lleno de gente`. |
| `/es/blog/suenos-de-agua` | 44 647 impr., CTR 0,43 %, pos. 7,7 | Recentrer title/meta/schema sur le singulier `soñar con una inundación`. |
| `/es/simbolos/puerta` | 44 030 impr., CTR 0,44 %, pos. 7,7 | Ajouter les angles `abrir una puerta cerrada`, `puerta abierta de mi casa`. |
| `/es/simbolos/puente` | 28 539 impr., CTR 0,37 %, pos. 7,1 | Ajouter les angles `puente roto`, `cruzar un puente`, `puente peligroso`. |
| `/es/blog/suenos-de-volar` | 19 255 impr., CTR 0,25 %, pos. 8,1 | Ajouter `soñar con volar` et `te elevas en el aire` dans title/meta/FAQ. |

Mesure: attendre le recrawl et comparer les pages dans GSC apres 7 a 14 jours. Le signal principal est le CTR page + requete, pas seulement la position moyenne.

## Goal 2 - Marque Noctalia

Objectif: suivre et clarifier la SERP de marque, sans optimiser pour de fausses intentions Linux.

Constat:

- Requete `noctalia`: 678 impressions, 0 clic, position 8,6 dans l'export GSC.
- Le detail page + requete ne reconstitue pas ces 678 impressions, ce qui indique probablement des limites/anonymisations GSC.
- La SERP publique montre une collision de nom: Noctalia app est visible, mais il existe aussi un `Noctalia Shell` pour Niri/CachyOS.

Actions cette semaine:

- Garder la homepage et Google Play comme entites principales de marque.
- Surveiller les requetes marque qui contiennent `niri`, `cachyos`, `shell`, `templates`, `linux`: elles ne doivent pas devenir un axe contenu pour l'app de reves.
- Au prochain export, separer `noctalia`, `noctalia app`, `noctalia dream journal` et les variantes Linux.
- Si `noctalia app` ou `noctalia dream journal` restent sans clic, renforcer les pages home/about et les `alternateName` schema. Ne pas le faire avant d'avoir ce signal.

Sources SERP verifiees le 2026-06-04:

- `https://noctalia.app/`
- `https://play.google.com/store/apps/details?id=com.tanuki75.noctalia`
- `https://docs.noctalia.dev/getting-started/compositor-settings/niri/`
- `https://packages.cachyos.org/package/cachyos/any/cachyos-niri-noctalia`

## Goal 3 - Mini-sprint italien

Objectif: faire un petit rattrapage CTR sur deux pages italiennes visibles en position 8-11, sans ouvrir un nouveau lot.

Pages traitees:

| Page | Baseline GSC | Action |
| --- | ---: | --- |
| `/it/simboli/fuoco` | 8 511 impr., CTR 0,18 %, pos. 10,4 | Recentrer sur `sognare fuoco`, `sognare il fuoco`, `incendio`, `fuoco in casa`. |
| `/it/simboli/cane` | 18 663 impr., CTR 0,43 %, pos. 9,6 | Recentrer sur `sognare cane`, `sognare cani`, `cane che ti attacca`. |

Mesure: comparer les couples page + requete, surtout `sognare fuoco significato`, `sognare il fuoco`, `sognare cani significato`, `sognare un cane che ti attacca`.

## Cadence

1. Publier les changements apres validation docs.
2. Relancer `npm run seo:gsc:export` dans 7 jours.
3. Comparer les memes pages et requetes avec `marketing/seo/search-console/2026-03-05_to_2026-06-02/`.
4. Ne pas lancer un 4e goal avant d'avoir le premier delta GSC.
