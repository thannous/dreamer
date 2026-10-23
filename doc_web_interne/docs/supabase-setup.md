# Supabase : sources, configuration et qualification

Le [point d'entrée backend](../../README_BACKEND.md) décrit le runtime actuel.
Le schéma se construit à partir des [migrations](../../supabase/migrations/) et
se vérifie contre le [contrat de base](../../supabase/db-contract.manifest.json).
Ne pas recréer `dreams` avec un ancien exemple SQL isolé : il ne représente pas
les migrations, droits et fonctions actuels.

## Développement local

Pour une qualification reproductible, suivre le
[guide backend](e2e-backend-qualification.md). Son runner possède une pile locale
jetable, rejoue les migrations en fixtures et nettoie sa propre pile :

```sh
mise exec -- npm run test:e2e:backend -- --qualify-ti528
```

Pour le profil applicatif Supabase, utiliser un `.env.supabase` privé contenant
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` et
`EXPO_PUBLIC_API_URL`, puis `mise exec -- npm run start:supabase`.
Le [runner](../../scripts/expo-safe-runner.js) peut dériver l'URL API de
`SUPABASE_PROJECT_REF` si l'override est absent. Le profil choisi désactive le
chargement implicite de `.env.local`. Un profil ne crée ni compte ni projet.

Les routes et leurs autorisations sont dans
[le dispatcher](../../supabase/functions/api/index.ts) et
[ses modules](../../supabase/functions/api/routes/). Les secrets des fournisseurs
restent côté serveur. La sauvegarde locale précède la catégorisation facultative ;
l'illustration n'est plus le placeholder de l'ancien tutoriel.
Pour Google, suivre [la procédure unique](google-sign-in.md).

Une migration ou un déploiement distant exige son autorisation et une comparaison
préalable du schéma et de l'historique appliqué. Ce guide n'exécute aucune opération
distante ; une preuve locale ne qualifie pas les services de production.

## Droits des migrations

Le dépôt configure `auto_expose_new_tables = false` dans
[supabase/config.toml](../../supabase/config.toml). Une nouvelle table publique
explicite ses droits pour `anon`, `authenticated` et `service_role`, ses politiques
RLS et les droits de sa séquence le cas échéant. Le contrôle
`npm run migrations:grants`, intégré à `verify:pr`, vérifie ces déclarations ;
[scripts/check-migration-grants.cjs](../../scripts/check-migration-grants.cjs)
porte les règles et les exceptions historiques. Une absence de privilège ne se
corrige pas en désactivant RLS.

A `security definer` function in `public` (created, or switched with `alter function ...
security definer`) keeps EXECUTE for PUBLIC and anon unless revoked. The same migration must
`revoke execute on function public.X(...) from public, anon`, grant EXECUTE explicitly to the
roles that call it (for example `authenticated` or `service_role`), and set a safe
`search_path`: `set search_path = ''` (then qualify every object in the body) or a list ending
with `pg_temp`, in the definition or with `alter function ... set search_path`. Never give such a function to `anon`, `authenticated` or `service_role` as owner. For an owner-only function (a trigger function), write the decision as `grant execute on function ... to postgres`. The same lint
enforces it, with its own list of earlier migrations.

## iOS guest App Attest release preparation

The iOS `/guest/session` route requires an Apple App Attest proof before issuing
a guest AI token. Its short-lived challenge is signed by the Edge Function;
only a valid attestation or assertion writes the challenge digest to the
service-role-only database table. The key is bound to its first guest quota
fingerprint, and each assertion must advance its stored counter.

Configure the Edge Function with the existing `GUEST_SESSION_SECRET`,
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Set
`IOS_APP_ATTEST_ALLOWED_APPS` to a JSON array of exact identities. Each entry
has `teamId` (the 10-character Apple App ID prefix), `bundleId`,
`environment` (`development` or `production`), and
`allowedBundleVersions` (exact native `CFBundleVersion` strings). For example,
replace every illustrative Team ID and build number before use:

```json
[
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia",
    "environment": "production",
    "allowedBundleVersions": ["123"]
  },
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia.qa",
    "environment": "development",
    "allowedBundleVersions": ["7"]
  },
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia.lucid",
    "environment": "production",
    "allowedBundleVersions": ["1"]
  }
]
```

Lucid iOS uses the same App Attest exchange for consented guest analytics.
Its `lucid-production` build uses the production environment; a `lucid-preview`
ad-hoc build uses development and needs a separate exact allowlist entry if it
talks to this backend. Add the Lucid identity only when its signed binary and
analytics journey have been qualified. The guest token includes the attested
App ID; Lucid tokens can exchange for analytics sessions but cannot call
Dreamer guest quota or AI routes. Old iOS guest tokens without this binding
are rejected, so qualify fresh sessions when changing the server.

An internal ad-hoc build of the main bundle needs its own exact
`development` entry if it calls the same backend. The structured allowlist
takes precedence over the older single-app variables
`IOS_APP_ATTEST_TEAM_ID`, `IOS_APP_ATTEST_BUNDLE_ID`,
`IOS_APP_ATTEST_ENVIRONMENT` and
`IOS_APP_ATTEST_ALLOWED_BUNDLE_VERSIONS`; those four remain a fallback when
the JSON variable is absent. An invalid or missing configuration fails closed.
Keep all server secrets out of `EXPO_PUBLIC_*` and out of Git.
Apple's authenticated bundle-version extension is absent on some supported
iOS versions. In that case the verifier still checks the signed App ID and
environment, but it cannot enforce `allowedBundleVersions`; do not use that
list as a universal binary-version gate.

For a release, apply
`supabase/migrations/20261021201025_ios_guest_app_attest.sql` after checking
migration history, then configure the exact server identities. Enable the App
Attest capability and renew provisioning profiles for each Apple App ID used
by a native build. Check the signed binary's bundle ID, entitlement,
`CFBundleVersion`, distribution method and destination API. TestFlight and
App Store use Apple's production App Attest environment; development and
ad-hoc builds use the development environment. EAS remote build counters
can differ from the checked-in `app.json` value.

Qualify attestation, refresh assertion, quota access and refusal paths on an
owned physical iOS device against a matching non-production backend before
production activation. A Simulator cannot provide App Attest proof. The new
Edge route rejects old iOS v1 guest tokens immediately, while a new binary
needs its challenge endpoint; coordinate Edge activation and binary
availability with an explicit expectation that old iOS builds lose guest AI
until updated. Local dream recording remains separate. Local fixture and
database tests do not establish native or production qualification.

Apple references: [validating App Attest objects](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server),
[App Attest environment](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment).
