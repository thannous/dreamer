# Noctalia — Sources de vérité et prochaines actions

- Dernière consolidation : **2026-09-05**.
- [Classeur Drive partagé — onglet Pilotage agents](https://docs.google.com/spreadsheets/d/1acoGpbZCg89Wy3SR4JioJg0_exyNyVqp3R5QagdQTTs/edit?gid=904202609#gid=904202609)
- Dossier Drive : `ChatGPT`.

## Règle d'autorité

Le dépôt Markdown reste la source de vérité opérationnelle. Le classeur Drive
est le miroir partagé pour l'agenda, les métriques et l'analyse ; il ne peut pas
transformer seul une ligne en `PROGRAMMÉE` ou `PUBLIÉE`.

- `PROGRAMMÉE` exige une ligne visible dans la file native du compte exact.
- `PUBLIÉE` exige l'ouverture de l'URL publique exacte.
- Une cellule vide dans le classeur signifie « donnée non exposée », jamais
  automatiquement zéro.
- En cas de contradiction, la preuve native la plus récente est consignée dans
  le registre Markdown compétent avant d'être recopiée dans Drive.

## Hiérarchie des sources de vérité

| Autorité | Document | Décide | Ne décide pas |
|---|---|---|---|
| Mandat | [`ACCOUNTS-AND-MANDATE.md`](../ACCOUNTS-AND-MANDATE.md) | Comptes, actions organiques autorisées, actions sensibles interdites | Connexion effective ou succès d'une publication |
| Calendrier principal actif | [`2026-08-us-europe-publication-plan.md`](../2026-08-us-europe-publication-plan.md) | Date, heure, asset et copie affectés à chaque ligne principale | Preuve native de programmation ou de publication |
| Registre parent historique | [`PUBLICATION-PLAN.md`](../../PUBLICATION-PLAN.md) | Historique éditorial et renvoi vers le calendrier actif | État courant lorsqu'une fiche plus récente existe |
| Preuve publique quotidienne | `PUBLIC-PROOF-AAAA-MM-JJ.md` | URL ouverte, statut final et échec explicite après échéance | Programmation future |
| Couverture et dette | [`08-COVERAGE-AND-ROLLING-REFILL.md`](./08-COVERAGE-AND-ROLLING-REFILL.md) | Ordre chronologique, couverture prouvée et dette restante | Autorisation de sauter une ligne ou de supposer une place native |
| Anti-doublon par plateforme | [`PLATFORM-VIDEO-INVENTORY.md`](../../PLATFORM-VIDEO-INVENTORY.md) | URL par plateforme, triage `À RATTRAPER` / `À EXCLURE` / `DÉJÀ PUBLIÉE` | Date et heure du calendrier principal |
| Masters et fichiers Drive | [`MEDIA-INVENTORY.md`](../../MEDIA-INVENTORY.md) | Identité des masters, provenance et état des assets | Publication publique |
| Réseaux secondaires | [`05-EXECUTION-LOG.md`](./05-EXECUTION-LOG.md) | Exécution YouTube, Facebook et Pinterest | Cadence des réseaux principaux |
| Décision deux publications | [`77-OPTIMAL-POSTING-TIMES-ANALYSIS-2026-09-03.md`](./77-OPTIMAL-POSTING-TIMES-ANALYSIS-2026-09-03.md) | Horaires à tester à partir du 11 septembre et seuils de revalidation | Optimum causal définitivement prouvé |
| Calendrier du prochain cycle | [`79-TWO-POSTS-PER-DAY-CALENDAR-2026-09-11-24.md`](./79-TWO-POSTS-PER-DAY-CALENDAR-2026-09-11-24.md) | Deux lignes quotidiennes, ordre commun aux trois réseaux et état d'affectation des masters | Programmation native tant que les lignes restent bloquées |
| Miroir Drive | Onglets `Agenda complet`, `Historique`, `Instagram Insights 90j`, `Analyse 2 par jour`, `Calendrier 2 par jour` et `Pilotage agents` | Lecture partagée, mesures, calendrier bloqué et synthèse | Remplacement d'une preuve native ou du Markdown compétent |

## Décision de cadence enregistrée

À partir du **11 septembre 2026**, les réseaux principaux utilisent les mêmes
deux assets quotidiens et conservent leur ordre :

| Ordre | TikTok | Instagram | X |
|---|---:|---:|---:|
| Vidéo A | 15:30 | 19:45 | 16:15 |
| Vidéo B | 19:30 | 22:45 | 20:15 |

Les files déjà programmées jusqu'au 10 septembre inclus restent intactes. Les
plateformes secondaires restent à un seul HERO quotidien : Pinterest `17:30`,
YouTube `18:00`, Facebook `18:15`.

## État de la transition

1. **TERMINÉ — réconciliation des preuves** : les registres quotidiens,
   l'inventaire multi-plateforme et la couverture séparent désormais la file
   native d'une URL publique manquante. Deux TikTok du 01/09 initialement
   classés en échec ont été rouverts sur le compte exact et sont désormais
   `OBSERVÉ — PUBLIÉ HORS FILE`. Le contrôle natif YouTube du 05/09 annule la
   qualification publique antérieure du remplacement floral du 30/08 :
   `WZk8x9CN_fA` est un brouillon privé, tandis que l'ancien Short
   `8-m-p4qXG_g` reste public. La couverture YouTube est donc `18/28` avec
   `10` actions restantes. Le registre du 04/09 est désormais clos à `3/12` :
   X C3 est prouvé par l'URL `2095983993594290489`, tandis que TikTok et
   Instagram C3 sont des échecs explicites après contrôle public. La couverture
   Instagram était alors à `58/84`, avec `26/84` lignes en dette. Au contrôle
   C1 du 05/09, le Mac verrouillé empêche toute preuve native et les recherches
   publiques ne fournissent aucune URL exploitable : les trois lignes C1 sont
   consignées en échec de preuve, la programmation X historique restant
   distincte. La couverture Instagram était alors à `57/84`, avec `27/84`
   lignes en dette. Le C2 du 05/09 ne peut pas être exécuté sur le Mac toujours
   verrouillé : TikTok et Instagram passent en échec explicite. X C2 est public
   à l'URL `2096301082913968323`, avec compte, hook, vidéo, heure `20:15` et label
   `Made with AI` exacts ; le premier relevé expose 1 vue. La couverture
   Instagram courante devient `56/84`, avec `28/84` lignes en dette. Les métriques
   absentes restent vides.
2. **STRUCTURE TERMINÉE, ASSETS BLOQUÉS** : le calendrier du 11 au 24 septembre
   contient exactement 28 lignes et le même ordre A/B sur TikTok, Instagram et
   X. Il reste interdit de programmer tant que les masters, SHA-256, copies et
   contrôles anti-doublon ne sont pas affectés.
3. **TERMINÉ — automation alignée** : l'automation consolidée
   `noctalia-tiktok-programmation-roulante-ao-t` suit les onze checkpoints
   principaux et HERO du pilote jusqu'au 24 septembre, respecte les lignes
   bloquées et conserve une notification limitée aux changements matériels et
   échecs.
   Le miroir Drive contient également l'onglet `Calendrier 2 par jour` avec les
   28 lignes bloquées et les champs `Nom de la vidéo`, `Fichier master`,
   `SHA-256` et `Copie anglaise` à compléter après validation.
4. **À FAIRE — standardiser les relevés J+1 et J+7** pour comparer les horaires à âge de
   publication égal. Instagram doit continuer à être relevé Reel par Reel.
5. **TERMINÉ — indisponibilité du Reel Instagram `Dcgy8tmJbpv` reconfirmée** :
   sa preuve historique reste conservée, sa page native est indisponible au
   contrôle du 04/09 et aucune métrique n'est inventée.
6. **À FAIRE — renforcer l'échantillon X** : obtenir au moins cinq mesures par horaire
   avant de qualifier `16:15` et `20:15` d'horaires optimaux.
7. **ACTION PROPRIÉTAIRE REQUISE — valider les assets** : trois candidats forts
   restent en réserve, sans affectation automatique. Le pilote nécessite 28
   masters distincts, donc 25 nouveaux masters après validation éventuelle des
   trois réserves, ou 28 si elles sont écartées.

## Critère de clôture de la transition

La structure et l'automation sont prêtes. La transition devient exécutable
uniquement après affectation des 28 masters et reste complète lorsque
`social:health` et `social:automation:check` passent, puis que les premières
mesures J+1/J+7 sont présentes dans le dépôt et dans le classeur Drive.
