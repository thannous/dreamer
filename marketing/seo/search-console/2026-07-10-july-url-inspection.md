# Noctalia Search Console - reinspection vague juillet

Date: 2026-07-10 16:08 CEST.
Propriete: `sc-domain:noctalia.app`.
Sitemap live: `https://noctalia.app/sitemap.xml`, HTTP 200, 1155 URLs.
Version live: `20260710-010011`.

## Resultat

- 15 URLs juillet verifiees en production: 15 reponses HTTP 200 et 15 presences dans le sitemap live.
- 14 URLs sur 15: `Submitted and indexed` (`PASS`).
- 1 URL sur 15: `Crawled - currently not indexed` (`NEUTRAL`).
- Robots.txt autorise l'exploration des 15 URLs.
- Aucune URL ne reste `URL is unknown to Google` ou `Discovered - currently not indexed`.
- Pour l'URL ES restante, Google rapporte un fetch mobile reussi et quatre URLs de reference. La page live est auto-canonique, sans en-tete `X-Robots-Tag` bloquant, et expose 6 hreflang reciproques (`en`, `fr`, `es`, `de`, `it`, `x-default`).

## URL restant a reinspecter

| Langue | URL | Etat Search Console | Derniere exploration |
|---|---|---|---|
| ES | https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos | Crawled - currently not indexed | 2026-07-09 11:47:42 UTC |

## Decision

Les 10 demandes manuelles envoyees le 9 juillet ont abouti. Aucune nouvelle demande `Request indexing` n'a ete envoyee: l'unique URL restante a deja ete exploree et ne releve plus d'un etat `unknown` ou `discovered`. La reinspecter le 11 juillet ou avant la prochaine publication editoriale.
