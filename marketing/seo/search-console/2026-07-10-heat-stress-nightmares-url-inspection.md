# Search Console - cauchemars chaleur et stress - 2026-07-10

Publication anticipee autorisee le 2026-07-10.

## Production

- Commit `master`: `5afeeb4f1`.
- Cloudflare Pages: `20260710-171822`.
- Sitemap live: HTTP 200, `application/xml`, 1160 URLs.
- Les cinq nouvelles URLs repondent HTTP 200, utilisent un canonical auto-reference et sont presentes dans le sitemap.

## Search Console

- Sitemap `https://noctalia.app/sitemap.xml` resoumis via API: HTTP 204.
- Inspection API juste apres publication: FR/EN/ES sont d'abord `Google ne reconnait pas cette URL`; DE/IT sont `Detected - currently not indexed`. Apres la resoumission et l'action UI, la reinspection finale donne FR `Crawled - currently not indexed`, EN/ES/DE `Detected - currently not indexed`, IT `Google ne reconnait pas cette URL`.
- Demande manuelle FR confirmee dans l'UI: URL ajoutee a la file d'exploration prioritaire.
- La tentative suivante sur EN a renvoye `Quota depasse`: aucune nouvelle demande manuelle ne peut etre traitee le 10 juillet.

| Langue | URL | Etat initial | Action manuelle |
|---|---|---|---|
| FR | https://noctalia.app/fr/blog/cauchemars-chaleur-stress | Exploree, actuellement non indexee; crawl 2026-07-10 15:25:52 UTC | Confirmee le 10 juillet |
| EN | https://noctalia.app/en/blog/heat-stress-nightmares | Detectee, actuellement non indexee dans l'UI | Bloquee par quota quotidien |
| ES | https://noctalia.app/es/blog/pesadillas-calor-estres | Detectee, actuellement non indexee | A retenter le 11 juillet si non indexee |
| DE | https://noctalia.app/de/blog/albtraeume-hitze-stress | Detectee, actuellement non indexee | A retenter le 11 juillet si non indexee |
| IT | https://noctalia.app/it/blog/incubi-caldo-stress | Google ne reconnait pas cette URL | A retenter le 11 juillet si non indexee |

## Prochaine action

Le 11 juillet, reinspecter les cinq URLs. Ne pas redemander FR. Pour EN/ES/DE/IT, envoyer une demande manuelle seulement si l'URL n'est pas encore indexee et si le quota Search Console est de nouveau disponible.
