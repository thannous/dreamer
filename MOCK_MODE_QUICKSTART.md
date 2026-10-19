# Mock Mode — Quick Start

Start the app with the tracked mock profile:

```sh
mise exec -- npm run start:mock
```

The canonical runner loads `.env.mock` for this process and selects the simulated
services. It handles profile loading on Windows, macOS and Linux; copying profile
files into `.env.local` is unnecessary.

For a web preview:

```sh
mise exec -- npm run start:mock -- --web
```

Use the existing guest, new-user, existing-user and Plus personas exposed by the
mock sign-in controls. The existing-user profile loads the catalogue from
[mock-data/predefinedDreams.ts](mock-data/predefinedDreams.ts). Normal mock storage
is in memory. To exercise persistence across reloads, start the dedicated profile:

```sh
mise exec -- npm run start:mock:dogfood -- --web
```

`EXPO_PUBLIC_MOCK_PERSISTENCE=true` enables the mock persistence implementation;
profile switches remain deliberate fixture changes. Some fixture images use
remote URLs, so media availability also depends on those sources.

To select the real runtime profile:

```sh
mise exec -- npm run start:real
```

This loads `.env.real` through the same runner. Credentials and backend readiness
follow the [backend entry point](README_BACKEND.md).

The mock journeys exercise simulated authentication, analysis, notifications and
purchase behavior. Native storage, real backend access and purchase transactions
have their own qualification paths in the [repository task index](doc_web_interne/docs/README.md).

For fixtures and generators, use [mock-data/README.md](mock-data/README.md).
The runtime profile implementation lives in [scripts/expo-safe-runner.js](scripts/expo-safe-runner.js);
[AGENTS.md](AGENTS.md) defines contribution and delivery rules.
