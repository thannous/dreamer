# Noctalia Search Console - suivi juillet

Date: 2026-07-11 09:30 CEST.
Propriete: `sc-domain:noctalia.app`.

## Production

- Sitemap live cache-buste: HTTP 200, `application/xml`, 1160 URLs.
- Les 20 URLs publiees en juillet sont presentes dans le sitemap live.
- `version.txt` live: `2866f3066c1f`.
- Le controle HTTP simultane des pages a rencontre des timeouts Cloudflare transitoires. Aucun signal GSC ne montre un blocage robots ou un echec de fetch sur les pages deja explorees.

## Vague initiale de 15 URLs

- 14 URLs sont `Submitted and indexed`.
- Seule `https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos` reste `Crawled - currently not indexed`.
- Derniere exploration de cette URL: `2026-07-09T11:47:42Z`; fetch reussi et robots autorise.
- Aucune nouvelle demande manuelle n'est necessaire pour les 14 URLs indexees.

## Cauchemars chaleur et stress

| Langue | URL | Etat Search Console au 2026-07-11 | Derniere exploration | Action |
|---|---|---|---|---|
| FR | https://noctalia.app/fr/blog/cauchemars-chaleur-stress | Submitted and indexed | 2026-07-10T15:25:52Z | Aucune |
| EN | https://noctalia.app/en/blog/heat-stress-nightmares | Submitted and indexed | 2026-07-10T16:59:27Z | Aucune |
| ES | https://noctalia.app/es/blog/pesadillas-calor-estres | Discovered - currently not indexed | Sans objet | Demande manuelle a faire |
| DE | https://noctalia.app/de/blog/albtraeume-hitze-stress | Crawled - currently not indexed | 2026-07-11T00:00:06Z | Demande manuelle a faire |
| IT | https://noctalia.app/it/blog/incubi-caldo-stress | Discovered - currently not indexed | Sans objet | Demande manuelle a faire |

## Tentative UI

La demande ES a atteint le test d'indexabilite puis l'envoi, mais Search Console a affiche `Impossible d'etablir une connexion avec le service reCAPTCHA`. Aucune confirmation finale n'a ete obtenue. Cette tentative n'est donc pas comptee comme envoyee.

Liste exacte a reprendre dans l'UI Search Console:

1. `https://noctalia.app/es/blog/pesadillas-calor-estres`
2. `https://noctalia.app/de/blog/albtraeume-hitze-stress`
3. `https://noctalia.app/it/blog/incubi-caldo-stress`

Ne pas redemander FR ou EN, deja indexees. Reinspecter le reliquat ES du reveil nocturne lors du prochain run, sans nouvelle demande tant que son etat technique reste sain.
