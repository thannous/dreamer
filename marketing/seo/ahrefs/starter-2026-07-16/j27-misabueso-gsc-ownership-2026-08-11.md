# J27 — ownership espagnol après analyse Misabueso

Date de collecte : 11 août 2026

Propriété GSC : `sc-domain:noctalia.app`

Dernière journée complète : 9 août 2026

Fenêtre courante : 13 juillet–9 août 2026

Fenêtre précédente comparable : 15 juin–12 juillet 2026

## Résumé décisionnel

La lecture GSC confirme que le frein n'est pas un défaut technique générique. Les propriétaires existants doivent être protégés avant toute nouvelle page : le hub dictionnaire détient l'intention informationnelle générique, `perro` détient son cluster, et le guide `/es/blog/suenos-de-agua` détient déjà `inundación` et `lluvia`.

Le seul changement immédiatement justifié est la différenciation d'une ancre interne vers la page produit `/es/diccionario-de-suenos-app`. Aucun contenu de fiche, canonical, titre ou introduction du hub n'est modifié dans ce lot.

## Baseline globale

| Mesure | 13 juil.–9 août | 15 juin–12 juil. |
|---|---:|---:|
| Clics | 4 273 | 2 519 |
| Impressions | 491 150 | 315 202 |
| CTR moyen | 0,9 % | 0,8 % |
| Position moyenne | 7,3 | 8,3 |

## Verdict par propriétaire

| URL ou intention | Verdict | Preuve GSC | Action |
|---|---|---|---|
| `/es/guides/diccionario-simbolos-suenos` | `ADJUST` | page : 15 clics, 682 impressions, CTR 2,2 %, position 6,8 ; cluster générique : 2 clics, 66 impressions, position 8,7 ; le hub porte 49 impressions du cluster | préserver titre, introduction et canonical ; clarifier seulement l'ancre qui envoie actuellement un signal générique vers l'app |
| `/es/diccionario-de-suenos-app` | `ADJUST` | 0 clic, 6 impressions, position 7,7 ; aucune présence dans les pages du cluster générique | garder l'intention produit et renommer l'ancre entrante en `app de diccionario de sueños` |
| `/es/simbolos/perro` | `HOLD_EXPERIMENT` | page : 42 clics, `11,4 k` impressions, position 8,2 ; cluster : 6 clics, `2,04 k` impressions, position 9,8 contre 15,5 | propriétaire confirmé ; aucune édition pendant le gel metadata du 8 août |
| `/es/simbolos/zombi` | `HOLD_EVIDENCE` | page : 0 impression ; cluster : 1 impression vers une page italienne adjacente | ne pas enrichir sans requêtes espagnoles observées |
| `/es/simbolos/abeja` | `HOLD_EVIDENCE` | 0 impression page et cluster | ne pas inventer de scénarios |
| `/es/simbolos/zapatos` | `HOLD_POST_DEPLOYMENT` | 0 donnée ; route publiée le 11 août, après la coupure GSC du 9 août | mesurer une fenêtre complètement postérieure au déploiement |
| `/es/simbolos/rata` | `HOLD_EVIDENCE` | page : 1 impression ; cluster : 26 impressions dispersées sur des URL adjacentes, sans propriétaire espagnol fiable | attendre une ownership observable |
| `/es/simbolos/dientes` | `ADJUST_BACKLOG` | page : 10 impressions, position 23,1 ; cluster : 5 impressions, position 37,4, avec variantes `sin dientes` | conserver le propriétaire ; réévaluer après davantage de données |
| `/es/simbolos/accidente` | `HOLD_EVIDENCE` | 0 impression | ne pas créer de doublon et ne pas enrichir sans preuve |
| `/es/simbolos/coche` | `ADJUST_BACKLOG` | page : 4 clics, `1,23 k` impressions, CTR 0,3 %, position 8,9 ; cluster régional : 58 impressions, position 27,1 | candidat ultérieur pour `carro/coche/conducir`, hors premier lot |
| `/es/simbolos/inundacion` | `HOLD_OWNER` | fiche : 2 clics, 397 impressions, position 18 ; cluster : 393 clics, `19,6 k` impressions, position 3,2, presque entièrement porté par `/es/blog/suenos-de-agua` | ne pas renforcer la fiche sur l'intention déjà détenue par le guide eau |
| `/es/simbolos/lluvia` | `HOLD_OWNER` | fiche : 1 impression ; cluster : 7 clics, `1,16 k` impressions, position 4,6, porté par `/es/blog/suenos-de-agua` | protéger le guide eau comme propriétaire |
| `/es/simbolos/nieve` | `HOLD_EVIDENCE` | fiche : 1 impression masquée au niveau requête ; cluster : 0 impression courante | attendre davantage de données |

Les fragments `#tipos`, `#simbolismo`, `#interpretaciones` et `#estado` du guide eau apparaissent séparément dans le tableau GSC. Ils appartiennent à la même URL canonique et ne sont pas comptés comme des pages concurrentes.

Le détail chiffré est conservé dans [`j27-misabueso-gsc-ownership-matrix-2026-08-11.csv`](./j27-misabueso-gsc-ownership-matrix-2026-08-11.csv).

## Lot local autorisé

Source unique modifiée : `docs-src/content/pages/page.android-dream-analysis-app/es.md`.

```diff
- empieza por el diccionario de sueños
+ empieza por la app de diccionario de sueños
```

Cette modification renforce la séparation entre le hub informationnel et la page produit. Elle ne touche ni les 50 suivis Rank Tracker, ni leurs tags ou emplacements, ni les expériences `casa`, `ragno`, `perro`, `scuola`, eau IT ou EN.

## Périmètre externe

- Les 13 URL contrôlées répondent HTTP 200 publiquement le 11 août.
- Aucun appel Ahrefs supplémentaire n'a été effectué ; le dernier compteur fourni reste `119/200` avant nouvelle vérification autorisée.
- Aucune mutation GSC, demande d'indexation, modification d'abonnement ou outreach n'a été effectuée.
- Les nouvelles pages `moscas`, `garrapatas`, `brujas`, `iglesia`, `fiesta`, `cementerio/panteón` et `alacrán` restent en `HOLD` tant qu'un propriétaire existant n'a pas été exclu dans GSC et dans les cinq langues du catalogue.
