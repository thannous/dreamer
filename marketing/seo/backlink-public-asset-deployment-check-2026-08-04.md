# Backlink public-asset deployment stop-check — 2026-08-04

Evidence date: 2026-08-04 (Europe/Paris). This is a read-only production check. No deployment was forced, no Cloudflare setting was changed, and no outreach was sent because a localized destination asset is not yet proven current at the public edge.

## Source and provider state

- `origin/master` and the isolated checkout both point to `64e870f11703c8c9befa28727c532c57d65ad10c`.
- The tracked sources `docs-src/content/pages/page.press/{fr,es,de,it}.md` contain the 4 August 2026 date and citation section. The English public page already exposes its 4 August citation block.
- GitHub reports the Vercel context as `pending` (`Vercel is deploying your app`). The public custom domain is served through Cloudflare headers; no Cloudflare API token is available in this environment, so the Pages deployment list cannot be independently queried.

## Public edge evidence

| URL | HTTP | Visible public state | Canonical |
| --- | --- | --- | --- |
| https://noctalia.app/en/press | 200 | `Updated August 4, 2026` and `Citation and data reuse` | self-canonical |
| https://noctalia.app/fr/presse | 200 | `Mis à jour le 10 juillet 2026`; no citation section detected | self-canonical |
| https://noctalia.app/es/prensa | 200 | `Actualizado el 10 de julio de 2026`; no citation section detected | self-canonical |
| https://noctalia.app/de/presse | 200 | `Aktualisiert am 10. Juli 2026`; no citation section detected | self-canonical |
| https://noctalia.app/it/stampa | 200 | `Aggiornato il 10 luglio 2026`; no citation section detected | self-canonical |

The same old localized content is served from `noctalia.pages.dev`, so the custom-domain result is not only a browser cache artifact. All responses were HTTP 200 with `server: cloudflare` and `cf-cache-status: DYNAMIC`.

## Campaign consequence

The English press asset is public and citable. The French, Spanish, German and Italian source updates are ready in `master` but remain **queued/unverified at the public edge**. They must not be described to a publisher as freshly updated until a later check shows the 4 August content. No manual production deployment was attempted because the existing authorization covers the master push, not a separate Cloudflare fallback or credential request.

Next safe action: poll the public edge after the provider finishes. If the localized pages remain on 10 July, request explicit manual-production authorization or a scoped Cloudflare credential rather than silently bypassing the deployment gate.
