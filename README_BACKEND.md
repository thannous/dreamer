# Backend entry point

The application resolves its API URL in [lib/config.ts](lib/config.ts):
`EXPO_PUBLIC_API_URL`, then `app.json`'s `expo.extra.apiUrl`, then the local
fallback. HTTP requests use [lib/http.ts](lib/http.ts).

For the current server contract, follow the actual dispatcher and route modules
in [supabase/functions/api/index.ts](supabase/functions/api/index.ts) and
[supabase/functions/api/routes/](supabase/functions/api/routes/). The client
integration is in [services/geminiServiceReal.ts](services/geminiServiceReal.ts).
Authentication, guest admission, quotas and durable job handling are defined by
those implementations and their tests; this entry point does not duplicate an
older public-endpoint contract or a standalone Express substitute.

Run the existing browser and database qualification against an owned disposable
stack on the native Supabase runtime (the only runtime; the project uses no Docker):

```sh
mise exec -- npm run test:e2e:backend -- --qualify-ti528
```

Local Supabase ports are assigned per local project (`supabase/config.toml` sets
`[experimental] stack = true` and no fixed port): read them from `supabase status`
instead of assuming 54321/54322.

The [backend qualification guide](doc_web_interne/docs/e2e-backend-qualification.md)
covers prerequisites, target guards, fixture migrations, seven browser journeys,
six TI528 integration cases and cleanup. The [database contract manifest](supabase/db-contract.manifest.json)
records the database objects checked by `db:contract:check`.

For architecture and implementation entry points, use the
[architecture index](doc_web_interne/docs/architecture/README.md) and the
[repository task index](doc_web_interne/docs/README.md). Production deployment
follows [AGENTS.md](AGENTS.md) and requires its existing publication authorization.
