# J46 — micro-gate Ahrefs avant publication

Date d'exécution : 1er septembre 2026

Verdict : `GO_PUBLISH_CANDIDATE` pour le cluster **faux réveil** ;
`HOLD_RESEARCH` pour **jet lag + rêves**.

## Limites et usage

Lecture live dans la session Ahrefs authentifiée, projet Noctalia `9361004` :

| Contrôle | Avant | Après |
|---|---:|---:|
| Crédits généraux utilisés | 23 | 25 |
| Rank Tracker | 50/50 | 50/50 |
| Crédits Site Audit | 1 500/10 000 | 1 500/10 000 |

- plan : Starter, facturation mensuelle ;
- prochaine facturation/remise à zéro affichée : 16 septembre 2026 UTC ;
- exactement deux rapports groupés ont été ouverts ;
- aucun Update, crawl, achat, add-on, changement d'abonnement, changement Rank
  Tracker ou demande d'indexation n'a été effectué.

## Rapport 1 — États-Unis

Identifiant Ahrefs : `b4b760cb71d59566314a9eff9feb0571`.

| Requête | Intention | KD | Volume US | Volume global | TP | GTP | Parent topic |
|---|---|---:|---:|---:|---:|---:|---|
| `false awakening` | informationnelle | 2 | 2 200 | 4 900 | 1 900 | 2 700 | `false awakening` |
| `false awakening dream` | informationnelle | 3 | 80 | 150 | 250 | 450 | `false awakening dreams` |
| `jet lag vivid dreams` | non fourni | N/A | 10 | 10 | N/A | N/A | non fourni |
| `jet lag dreams` | non fourni | N/A | 10 | 10 | N/A | N/A | non fourni |

## Rapport 2 — Espagne

Identifiant Ahrefs : `67068034940847c758ce31f50ace6b77`.

| Requête | Intention | KD | Volume ES | Volume global | TP | GTP | Parent topic |
|---|---|---:|---:|---:|---:|---:|---|
| `falso despertar` | informationnelle | 0 | 40 | 450 | 20 | 20 | `falso despertar` |
| `soñar que te despiertas` | informationnelle | N/A | 0–10 | 0–10 | N/A | N/A | non fourni |
| `desfase horario sueños` | non indexée dans la base Ahrefs | N/A | N/A | N/A | N/A | N/A | non fourni |
| `jet lag sueños` | non indexée dans la base Ahrefs | N/A | N/A | N/A | N/A | N/A | non fourni |

`N/A` signifie que la valeur n'était pas fournie par le rapport ; aucune
valeur manquante n'est estimée.

## Décision éditoriale

### Faux réveil — `GO_PUBLISH_CANDIDATE`

Le sujet satisfait le gate : intention informationnelle explicite, difficulté
faible, demande US significative, signal ES positif, propriétaire Noctalia
distinct et réponse prudente déjà localisée en EN/FR/ES/DE/IT. Le candidat J46
comprend cinq routes, le maillage descriptif depuis les guides rêve lucide et
le refresh borné des propriétaires rêve lucide EN/ES.

### Jet lag + rêves — `HOLD_RESEARCH`

Les deux requêtes US exactes ne montrent que 10 recherches mensuelles chacune,
sans KD, TP, intention ou parent topic. Les deux requêtes ES exactes ne sont pas
indexées dans la base Ahrefs. Ce niveau de preuve ne justifie pas cinq nouvelles
routes aujourd'hui. Les cinq localisations sont conservées comme brouillons
hors du build dans `drafts/j46-jet-lag-sleep-dreams/` ; elles ne figurent ni
dans les manifests, ni dans le sitemap, ni dans le lot de publication J46.

## État Git et publication

- branche synchronisée par fast-forward sur `origin/master`
  `7eb91a0819266be0cfc358c3897ef8879003b75c` ;
- WIP réappliqué sans conflit ;
- stash de sécurité conservé :
  `backup-j46-publication-before-master-sync-2026-09-01` ;
- aucun commit, push, déploiement ou publication effectué ;
- la publication reste soumise à un `GO publication J46` explicite.
