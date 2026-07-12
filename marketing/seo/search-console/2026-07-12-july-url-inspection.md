# Noctalia Search Console - suivi juillet

Date: 2026-07-12.
Propriete: `sc-domain:noctalia.app`.

## Production

- Sitemap live cache-buste: HTTP 200, `application/xml`, 1160 URLs.
- Les 20 URLs publiees en juillet sont presentes dans le sitemap live et repondent 200.
- `version.txt` live: `20260711-194440`.

## Vague initiale de 15 URLs

- Les 15 URLs sont maintenant `Submitted and indexed`.
- Le dernier reliquat, `https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos`, a ete explore le `2026-07-11T12:33:29Z` puis indexe.
- Aucune nouvelle demande manuelle n'est necessaire pour cette vague.

## Cauchemars chaleur et stress

| Langue | URL | Etat Search Console au 2026-07-12 | Derniere exploration | Action |
|---|---|---|---|---|
| FR | https://noctalia.app/fr/blog/cauchemars-chaleur-stress | Submitted and indexed | 2026-07-10T15:25:52Z | Aucune |
| EN | https://noctalia.app/en/blog/heat-stress-nightmares | Submitted and indexed | 2026-07-10T16:59:27Z | Aucune |
| ES | https://noctalia.app/es/blog/pesadillas-calor-estres | URL is unknown to Google | Sans objet | Demande manuelle confirmee |
| DE | https://noctalia.app/de/blog/albtraeume-hitze-stress | Crawled - currently not indexed | 2026-07-11T00:00:06Z | Demande manuelle confirmee |
| IT | https://noctalia.app/it/blog/incubi-caldo-stress | URL is unknown to Google | Sans objet | Demande manuelle confirmee |

## Demandes UI

Les demandes ES, DE et IT ont passe le test d'indexabilite puis affiche la confirmation `Indexation demandee`. Les trois URLs ont ete ajoutees a la file d'attente d'exploration prioritaire.

Ne pas redemander FR ou EN, deja indexees. Reinspecter uniquement ES/DE/IT lors du prochain run; les 15 URLs de la vague initiale ne sont plus bloquantes.
