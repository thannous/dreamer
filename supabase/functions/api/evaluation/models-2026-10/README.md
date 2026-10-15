# Model comparison, October 2026

Synthetic-only comparison of candidate models for dream analysis and illustration.
It uses the six fictional accounts of `../ti559/followup-fixtures.json` (one per app
language) and never reads journal data.

- Analysis: the production prompt, system instruction and JSON schema, sent to
  `gemini-3.8-flash` (current), `gemini-3.5-flash-lite` and `claude-haiku-5-5`
  (adaptive thinking, effort `low`, structured outputs). The start model rotates per account.
- Illustration: the image prompt written by `gemini-3.8-flash`, rendered at 1K 9:16 by
  `gemini-3.1-flash-lite-image` (current) and `gemini-nano-banana-2.1`, both at minimal thinking.

Preview (no credentials, no requests):

```sh
deno run --no-lock --allow-read=supabase/functions/api/evaluation --allow-env \
  supabase/functions/api/evaluation/models-2026-10/compare.ts
```

Run (30 requests at most, no retries, about 0.45 USD; the output directory must not exist):

```sh
GEMINI_API_KEY=… ANTHROPIC_API_KEY=… deno run --no-lock \
  --allow-read=supabase/functions/api/evaluation --allow-env \
  --allow-write=/tmp,/private/tmp \
  --allow-net=generativelanguage.googleapis.com,api.anthropic.com \
  supabase/functions/api/evaluation/models-2026-10/compare.ts --execute --output=/tmp/models-2026-10-run
```

The run writes `results.json` (raw text, parsed response, the response as the app would show it
after production normalization, any array outside the schema bounds, latency and provider usage per
call), `request-count.json` and `images/`. Keep the output out of Git. It exits with code 1
when any analysis or image cell is not valid, including an image pair skipped for lack of a prompt.

There is deliberately no npm script: `package.json` scripts feed the Expo runtime fingerprint
(`app.json` `runtimeVersion.policy: "fingerprint"`), so adding one would cut installed builds
off OTA updates.
