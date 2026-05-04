# Search Console API - pilotage SEO Noctalia

Ce workflow sert a transformer les donnees Google Search Console de `noctalia.app`
en documents exploitables pour ameliorer le referencement des pages generees depuis
`docs-src`.

## Pourquoi cette voie

L'API Search Console est la source la plus perenne pour ce besoin: elle donne un
acces programmatique aux donnees du rapport Performance, sans dependre de l'UI
Google Search Console ni d'un export manuel.

Le script local `scripts/export-search-console.js` interroge:

- la synthese globale;
- les series par date;
- les requetes;
- les pages;
- les couples page + requete;
- les pays;
- les appareils.

Il genere des CSV, un `summary.json` et un `action-plan.md` hebdomadaire.

## Authentification recommandee

Option la plus durable pour une automatisation: service account Google Cloud.

1. Creer ou choisir un projet Google Cloud.
2. Activer l'API `Google Search Console API`.
3. Creer un service account.
4. Ajouter l'adresse email du service account comme utilisateur de la propriete
   Search Console `sc-domain:noctalia.app` avec un acces en lecture.
5. Telecharger le JSON de cle localement, hors git.
6. Lancer le script avec:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/service-account.json \
npm run seo:gsc:export
```

Alternative pratique pour un usage personnel:

```bash
gcloud auth application-default login
npm run seo:gsc:export
```

Ou avec un token ponctuel:

```bash
GSC_ACCESS_TOKEN="$(gcloud auth print-access-token)" npm run seo:gsc:export
```

Le token doit avoir le scope `https://www.googleapis.com/auth/webmasters.readonly`.

## Commandes

Exporter les 90 derniers jours disponibles, avec fin a J-2:

```bash
npm run seo:gsc:export
```

Exporter la meme periode que celle lue dans Search Console le 4 mai 2026:

```bash
npm run seo:gsc:export -- --start 2026-02-03 --end 2026-05-02
```

Changer la propriete ou le dossier de sortie:

```bash
npm run seo:gsc:export -- \
  --site sc-domain:noctalia.app \
  --out marketing/seo/search-console \
  --start 2026-02-03 \
  --end 2026-05-02
```

## Sorties

Les exports sont ecrits dans:

```text
marketing/seo/search-console/<start>_to_<end>/
```

Fichiers principaux:

- `action-plan.md`: document de travail hebdomadaire.
- `pages.csv`: performance par URL, enrichie avec `entryId`, langue et source
  `docs-src` quand le manifeste local permet la correspondance.
- `page-query.csv`: requetes qui declenchent chaque page.
- `queries.csv`: requetes globales.
- `daily.csv`: evolution quotidienne.
- `summary.json`: recapitulatif machine-readable.

Ces sorties sont ignorees par git car elles contiennent des donnees business et
changent a chaque export.

## Rituel hebdomadaire

1. Lancer l'export le lundi.
2. Ouvrir `action-plan.md`.
3. Choisir 3 a 5 pages maximum dans:
   - pages a CTR faible;
   - requetes en positions 4-20;
   - couples page + requete avec impressions fortes.
4. Modifier les fichiers `docs-src` references par `sourceFile`.
5. Ajouter ou ajuster:
   - title/meta description;
   - introduction qui repond directement a la requete;
   - sections H2/H3 couvrant les sous-intentions;
   - FAQ/schema si l'intention s'y prete;
   - liens internes depuis pages proches ou hubs.
6. Valider:

```bash
npm run docs:release-check
```

7. Publier, puis comparer avec l'export de la semaine suivante.

## Interpretation rapide

- Position 4-20 + impressions fortes: meilleure opportunite court terme.
- Impressions fortes + CTR faible: travailler l'extrait SERP avant de reecrire
  tout le contenu.
- Position 10-30 + impressions: renforcer la profondeur du contenu et le
  maillage interne.
- Requete presente sur une page inattendue: verifier cannibalisation ou besoin
  d'une page dediee.

## Limites

Google indique que les resultats Search Analytics sont soumis aux limites
internes de Search Console. Les donnees peuvent aussi avoir quelques jours de
retard. Pour comparer proprement, garder les memes fenetres de dates d'une
semaine a l'autre.
