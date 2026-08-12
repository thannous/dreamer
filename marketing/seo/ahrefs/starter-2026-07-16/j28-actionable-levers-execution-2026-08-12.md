# Noctalia — leviers actionnables J28

Date : 12 août 2026

Projet Ahrefs : `9361004`

Propriété GSC : `sc-domain:noctalia.app`

## Décision du jour

Trois actions sont retenues sur des preuves fraîches et sans toucher aux expériences en cours :

| Levier | Décision | État |
|---|---|---|
| propriétaire ES `/es/simbolos/coche` | optimiser uniquement le titre et la meta description pour `coche`, `carro`, conduite et perte du véhicule | `LIVE_VERIFIED` |
| nouveau propriétaire `scorpion` | créer cinq routes localisées, avec contenu, image, curation animaux et contrat URL | `LIVE_VERIFIED` |
| avertissements Site Audit PT-BR | accepter les deux absences de `x-default` comme intentionnelles, faute d'équivalent EN | `NO_ACTION_ACCEPTED` |

Aucun envoi externe, changement Rank Tracker, achat, add-on, changement d'abonnement, crawl manuel ou demande d'indexation n'est inclus.

## Lecture GSC fraîche

La dernière journée complète disponible est le 10 août. La propriété entière affiche sur les 28 jours du 14 juillet au 10 août : 4 275 clics, 495 430 impressions, CTR 0,9 % et position 7,3. La fenêtre précédente du 16 juin au 13 juillet affiche 2 634 clics, 319 664 impressions, CTR 0,8 % et position 8,2 %. Ces agrégats décrivent la propriété ; ils ne prouvent pas l'effet d'un lot particulier.

### `/es/simbolos/coche`

| Fenêtre | Clics | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 14 juillet–10 août | 4 | 1 251 | 0,3 % | 8,9 |
| 16 juin–13 juillet | 5 | 613 | 0,8 % | 11,7 |

La visibilité a plus que doublé et la position s'est améliorée, tandis que le CTR s'est contracté. Le filtre de requêtes `coche|coches|carro|carros|conducir|conduciendo|manejando|automóvil|automovil` affiche 64 impressions récentes, toutes portées par la fiche `coche`; les anciens signaux sur `/es/simbolos/puente` et l'article sur la chute sont nuls dans la fenêtre courante. L'ownership est donc propre.

Le traitement conserve slug, canonical, corps, ancres et date éditoriale. Seuls les champs suivants changent :

- titre : `Soñar con coche o carro: significado y escenarios` ;
- description : `Soñar con coche o carro: compara conducir, perder el coche, viajar de pasajero, averías y accidentes según la emoción y el contexto del sueño.`

Le commit `240689ebc` est poussé sur `master`. Le run Quality `31622526211` et le déploiement Vercel du même SHA sont réussis. Le déploiement Cloudflare Pages `96373ff6-bc97-48c4-beed-c2050a34e49b` a terminé son build avant le basculement de l'alias. À 17:41 UTC, `https://noctalia.app/es/simbolos/coche` répond HTTP 200 avec le nouveau titre, la nouvelle description, son canonical inchangé et `index, follow`. Cette preuve établit la publication, pas un gain de CTR.

### `scorpion`

Le filtre GSC multilingue `scorpion|scorpioni|skorpion|escorpiones|scorpions` renvoie 0 clic et 0 impression sur 28 jours, puis 0 clic et 0 impression sur toute la fenêtre « 12 mois » disponible du 5 décembre 2025 au 10 août 2026. Aucun propriétaire ou conflit mesurable n'est identifié.

Les cinq lectures Ahrefs ciblées donnent :

| Marché | Requête | KD | Volume pays | Volume global | Potentiel trafic observé |
|---|---|---:|---:|---:|---:|
| US | `dreaming about scorpions` | 1 | 100 | 200 | 600 |
| FR | `rêver de scorpion` | 0 | 60 | 100 | 150 |
| ES | `soñar con escorpiones` | 0 | 250 | 2 100 | 250 |
| DE | `traumdeutung skorpion` | non disponible | 50 | 70 | non disponible |
| IT | `sognare scorpioni` | 0 | 450 | 450 | 350 |

La SERP espagnole place déjà une fiche DR 0 en huitième position et l'italienne une fiche DR 0 en troisième position, toutes deux sans backlink affiché. La mise à jour allemande exigeait un passage à Standard : elle a été refusée et n'a consommé aucun crédit.

Routes préparées :

| Langue | Route |
|---|---|
| EN | `/en/symbols/scorpions` |
| FR | `/fr/symboles/scorpion` |
| ES | `/es/simbolos/escorpiones` |
| DE | `/de/traumsymbole/skorpion` |
| IT | `/it/simboli/scorpioni` |

Chaque page possède un titre et une description uniques, trois questions, quatre FAQ et quatre scénarios développés. Les angles couverts sont animal calme ou caché, piqûre, grand nombre et présence dans la maison. Le contenu distingue déclencheurs récents et interprétation personnelle et n'affirme ni trahison, ni danger futur, ni prédiction.

L'actif éditorial `docs-src/static/img/symbols/editorial-2026-08-j27/scorpion-v1.webp` mesure 1 600 × 900. Ses variantes responsives 240, 480, 800 et 1 200 pixels sont générées sous `docs-src/static/img/seo/symbols-v2/`. L'image montre un seul scorpion calme dans un décor nocturne, sans humain, attaque, sang, autre animal, texte, logo, filigrane ou symbole astrologique.

Contrôles locaux avant extension du contrat :

- titres rendus de 48 à 56 caractères et descriptions de 128 à 146 caractères ;
- cinq auto-canoniques et six alternates uniques avec `x-default` ;
- `npm run docs:build` vert : 158 symboles, 790 pages de détail et 1 236 URL sitemap ;
- 15 tests du registre de contenu verts ;
- contrat des images vert ;
- `npm run docs:check` arrêté uniquement par la porte additive attendue des cinq nouvelles routes.

Le contenu est isolé dans `bb0a08ab1` (`feat(seo): add localized scorpion ranking owners`). Le contrat public est ensuite étendu additivement dans `c1a83dcc0` : 1 236 routes manifeste, 1 236 pages canoniques, 1 236 entrées sitemap et 1 241 sorties HTML. `npm run docs:check` passe alors avec 0 erreur, 0 avertissement et 0 lien interne cassé. La release-check sur export Git propre passe également avec 0 lien interne ou externe cassé et conserve 70 avertissements de profondeur DE non bloquants déjà connus.

Le push fast-forward porte `master` à `475f4b892`. Le run Quality exact `31623935279` est entièrement vert et Cloudflare Pages confirme le déploiement `cc12fbc9-7c72-4ca1-93a9-ed49d9391c4f` en succès. Les cinq routes répondent publiquement HTTP 200 avec leur titre attendu, canonical auto-référent, `index, follow` et les six alternates uniques `en`, `fr`, `es`, `de`, `it`, `x-default`. Le master éditorial et les quatre variantes responsives répondent HTTP 200 en `image/webp`; la curation anglaise des rêves d'animaux contient le lien vers le nouveau propriétaire. Aucune demande d'indexation n'a été envoyée.

## Site Audit et crédits

Le dernier crawl visible est celui du 10 août à 16:12, comparé au 3 août : Health Score 100, 0 erreur et 1 615 URL crawlées, dont 1 201 internes et 414 ressources. Le workspace affiche `3 627/10 000` URL crawlées, soit 6 373 disponibles.

Les deux nouvelles alertes `x-default hreflang missing` concernent uniquement `/pt-br/funcionalidades` et `/pt-br/perguntas-frequentes`. Elles sont conformes au contrat du dépôt : ces pages PT-BR sans équivalent anglais n'inventent pas de destination `x-default`. Aucune correction n'est appliquée.

Le compteur général Ahrefs est passé de `119/200` à `126/200` : deux crédits pour l'étude `coche` et cinq pour les marchés `scorpion`. Il reste 74 crédits nominaux avant la remise à zéro observée le 16 août 2026 UTC. Les 50 suivis, leurs emplacements et leurs tags restent inchangés.

## Frontières et mesure

- `casa`, `ragno`, `perro` restent gelés jusqu'à leur lecture dédiée ; `scuola` reste séparée et non modifiée.
- Les dossiers Marika Pech, DreamWell, Atlas/ILTY et les routes éditoriales DE/ES restent en préparation sans envoi. Chaque message exige son contrôle frais et son autorisation dédiée.
- Aucun correctif de redirection italienne mal encodée n'est repris sans preuve GSC positive.
- Une réponse HTTP 200 et des balises correctes prouveront la publication de `coche` et `scorpion`, pas leur indexation ni un gain de ranking.
- La première lecture GSC exploitable des nouveaux propriétaires se fera sur des journées complètes, puis sur une fenêtre comparative à 28 jours sans mélanger les expériences existantes.
