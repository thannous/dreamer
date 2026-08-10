# Noctalia — J26 synthèse des nouveaux contenus

Date : 10 août 2026

Source : GSC `page × query`, fenêtres complètes au 7 août 2026, contrôles live et SERP

## Verdict

**Nouveaux contenus validés à créer maintenant : 0.**

Le principe « requête positionnée sans contenu dédié » produit ici surtout trois faux positifs :

1. une page dédiée existe déjà et GSC l'identifie correctement ;
2. deux pages existantes se partagent une intention et doivent être départagées ;
3. la requête est hors marché ou hors produit.

Créer une page supplémentaire dans ces cas diluerait les signaux ou ajouterait du contenu faible.

## Pages qui paraissaient manquer mais existent déjà

| Intention | Page existante | Décision |
|---|---|---|
| `50 sueños y su significado` | `/es/guides/diccionario-simbolos-suenos` | page dédiée suffisante ; protéger |
| `traumsymbole a bis z` | `/de/guides/traumsymbole-lexikon` | cible GSC et Rank Tracker cohérente ; protéger |
| `traumlexikon` informationnel | `/de/guides/traumsymbole-lexikon` | propriétaire confirmé ; ancre produit explicitée dans le lot séparé autorisé |
| `sognare acqua sporca` | `/it/simboli/acqua` | mapping confirmé ; édition en HOLD pendant la mesure du basculement d'ownership |
| inondations en espagnol | `/es/blog/suenos-de-agua` | blog déjà dédié aux variantes longue traîne |
| incendie en italien | `/it/simboli/fuoco` | la fiche feu couvre déjà `incendio` |
| attaques de chiens en espagnol | `/es/simbolos/perro` | title et contenu déjà alignés ; expérience gelée |
| maison inconnue en italien | `/it/simboli/casa` | page déjà dédiée ; expérience gelée |

## Candidat conditionnel rejeté pour l'instant

### Une page italienne dédiée à `sognare acqua sporca`

La SERP externe comporte plusieurs articles exact-match, ce qui pourrait suggérer une nouvelle page. Le candidat est néanmoins **rejeté à ce stade** parce que :

- `/it/simboli/acqua` couvre déjà eau sale, trouble, propre, limpide, courante et eau dans la maison ;
- `/it/guides/simboli-sogni-acqua` couvre l'intention large ;
- les deux URL sont indexables, auto-canoniques et déjà positionnées ;
- une troisième URL augmenterait le risque de cannibalisation et aucun cross-canonical n'est justifié entre deux intentions distinctes ;
- le page-level montre déjà un basculement : fiche 94 → 909 impressions et guide 578 → 506 entre les périodes comparables ;
- la modification du 16 juillet semble donc déplacer l'ownership, alors que la fenêtre courante commence le 11 juillet et n'est pas entièrement postérieure à cette modification ;
- une nouvelle édition immédiate du contenu, des métadonnées ou des ancres empêcherait d'observer proprement ce mouvement.

Reconsidérer une nouvelle URL seulement après une fenêtre de 28 jours entièrement postérieure à la modification du 16 juillet, et si tous les critères décisionnels suivants restent réunis :

1. la fiche et le guide continuent de se partager l'intention sans propriétaire net ;
2. la SERP confirme une intention réellement distincte que les deux URL existantes ne peuvent pas servir sans brouiller leurs rôles ;
3. le nouveau contenu apporte une structure, des réponses et des scénarios incrémentaux, non redondants avec la fiche et le guide ;
4. la page présente une valeur métier explicite pour Noctalia ;
5. un volume de l'ordre de 1 000 impressions visibles persiste comme **filtre indicatif de taille**, jamais comme gate absolu, car GSC anonymise et tronque les requêtes ;
6. la position et le CTR restent défavorables dans leur contexte, sans être utilisés seuls pour déclencher la création.

## Décisions connexes après revue chef SEO

| Lot | Statut | Limite |
|---|---|---|
| IT eau sale | `HOLD_MESURE` | aucune édition immédiate ; ancres seulement si le partage persiste après une fenêtre entièrement postérieure au 16 juillet |
| DE `traumlexikon` | `GO_SEPARE` | ancre `Traumlexikon-App für Android` autorisée et appliquée dans la source ; mesurer seulement après déploiement public vérifié |
| DE `Traumdeutung` | `HOLD_ARCHITECTURE` | comparer quatre URL, dont `/de/blog/traumbedeutungen-interpretation-symbole`, avant de choisir un hub |
| EN `dream journal app` | `HOLD_POST_DEPLOIEMENT` | aucune édition avant 28 jours complets depuis le dernier déploiement public vérifié |

## Backlog de création, distinct des optimisations

| Statut | Nombre | Contenu |
|---|---:|---|
| `GO` | 0 | aucun nouveau contenu confirmé |
| `HOLD_CONDITIONAL` | 1 | éventuelle page italienne eau sale, uniquement après mesure entièrement postérieure au 16 juillet et validation de tous les critères |
| `REJECT_DUPLICATE` | 7 | dictionnaires, lexiques, eau/inondation, feu, chien, maison déjà couverts |
| `REJECT_NOISE` | 3 | Hindi, `togel`, collision `noctalia caffeine` |

Les suites réellement recommandées sont donc la mesure IT, le suivi post-déploiement de l'ancre allemande désormais corrigée, une cartographie allemande à quatre URL et le gel EN. Elles figurent dans `j26-content-opportunity-backlog-2026-08-10.csv`.
