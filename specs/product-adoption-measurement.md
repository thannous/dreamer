# Product adoption measurement

## Questions and units

Keep three separate measurements. Do not join first-party journey IDs with GA4, accounts,
Play installs, dream identifiers, transcripts or fingerprints.

1. Website → product: distinct sessions with a click to Play or the web application / measured
   sessions on the same four pages and dates. This is click-through, not installation attribution.
2. Activation: measured onboarding-completion journeys with a durable `recording_saved` in the
   following 24 hours / measured onboarding-completion journeys with 24h observation.
3. Return: `dream_save_milestone` return events / mature first-save cohort events, per platform.
   A return requires another new dream saved on a later UTC date, within 168h of the first save.
   Two dreams saved the same UTC day do not count as a return.

These are optional measurement populations, not all users or unique people. A first-save cohort
starts when a new dream is saved into an empty local journal while measurement is enabled.
Imports, pre-existing journals, failed writes and updates to an existing dream do not enroll.
Clearing a journal/storage or resetting consent can change cohort membership; this is not a
cross-device lifetime-user metric.

## Existing and new events

| Event | Trigger | Properties used |
|---|---|---|
| `onboarding_completed` (existing) | Onboarding completed | Existing categorical contract |
| `recording_saved` (existing) | Durable save succeeds | Existing categorical contract |
| `analysis_completed` (existing) | Result completes | Existing categorical contract |
| `dream_save_milestone` (new) | First save / first qualifying return | `stage: first / return_7d`, `cohort_day: integer UTC day since Unix epoch` |

The milestone's local state contains only first-save time and a returned boolean. It expires after
seven days and is pruned on startup, foreground and save, and cleared on opt-out/remote disable.
The existing journey ID still rotates after seven days. No additional identity is introduced;
cohort aggregation uses the day/platform, so a return across journey rotation remains countable.
The event ID retains existing retry deduplication. Consent withdrawal/queue loss may reduce
observed counts, which are not estimates of all users.

## Collection and privacy boundaries

- Missing preference defaults to disabled on every platform. Existing explicit choices persist.
- Existing onboarding/settings toggles enable or disable optional measurement. No new consent
  is inferred from visiting a page, recording a dream or the operator's implementation request.
- `EXPO_PUBLIC_PRODUCT_ANALYTICS_QA=true` disables collection for test builds, including queued
  delivery. Use it before starting QA; never identify QA by inspecting dream text.
- Client and server kill switches remain unchanged. This PR does not activate production collection.
- Web uses the same first-party transport after opt-in, **with authenticated delivery only**.
  Guest web events remain local until sign-in and expire after seven days; do not describe web
  counts as representative of all guest usage. Android keeps its Play Integrity guest flow.
- API/schema allowlists accept the new milestone and web platform. No RLS/grant/retention change.
- Report outputs suppress product cohorts below 10, including outcomes/complements below 10.
  No individual IDs, content, account data or raw event export are needed.

The existing `doc_web_interne/docs/product-analytics-privacy-assessment.md` remains the source of
release/privacy requirements. Opt-in implementation is technical preparation, not legal certification
or proof that Store declarations are current. Its activation checklist remains unqualified here.

## Reusable baseline

Generate a bounded, SELECT-only query:

```sh
npm run analytics:baseline -- --from 2026-09-13 --to 2026-09-19 --as-of 2026-09-21 --sql
```

Run that query with the operator's authorized read-only SQL connection. Save **only the resulting
aggregate JSON array** to a local untracked file, then:

```sh
npm run analytics:baseline -- --from 2026-09-13 --to 2026-09-19 --as-of 2026-09-21 \
  --product /absolute/path/product-counts.json --web /absolute/path/website-counts.json \
  --out /absolute/path/baseline
```

Omit `--web` when unavailable. The command writes Markdown and JSON with explicit unknowns.
Dates are UTC; `--to` is inclusive and `--as-of` is an exclusive midnight cutoff. A cohort day
matures after the whole day has had seven days of observation. Results remain provisional for
another seven days to allow offline queues. Counts are observed, not a guarantee of completeness.
Do not compare immature and mature return rates. Windows outside retained raw coverage are rejected.

## Website source

Reuse GA4 property **546804604**, exploration **SEO — clics vers le produit**:
https://analytics.google.com/analytics/web/#/analysis/a402116976p546804604/edit/PkCJo2-9QIOc-ioN94V5mA

The scope is `/de/guides/traumsymbole-lexikon`, `/es/blog/suenos-de-agua`, `/it/simboli/cane`,
`/it/simboli/fuoco`. Use the existing **Sessions mesurées** denominator and **Sessions avec clic**
numerator with identical date/page scope. Clics par emplacement supplies diagnostics only.
Never sum per-link or daily unique-session rows into a deduplicated overall numerator, and never
use GSC search clicks as the denominator. Play and web click sessions can overlap.

Input contract (illustrative values, not production data):

```json
{
  "from": "2026-09-13",
  "to": "2026-09-19",
  "scope": "four_priority_pages",
  "metric": "distinct_sessions_with_product_click",
  "sessions": 100,
  "click_sessions": 12,
  "play_click_sessions": 8,
  "web_app_click_sessions": 5,
  "processing_complete": true,
  "qa_excluded": true
}
```

Only set `qa_excluded`/`processing_complete` after verification. Incompatible windows, incomplete
processing and unqualified QA suppress the rate. Do not reuse the partial September 20 test day
as a clean baseline. API access requires `analytics.readonly`; the report can also use verified
aggregate exports from the existing exploration, without granting a new credential.

## Delivery order

1. Validate client, API and migration locally. Keep production switches off.
2. Obtain explicit publication intent and complete the existing privacy/Store activation review.
3. Apply the single additive allowlist/platform migration, then deploy the matching API.
4. Deliver the client through the approved web/mobile path; enable collection only in the
   authorized release after end-to-end consent/opt-out/QA validation.
5. Re-run baseline. Verify event delivery, without private payloads. Wait for cohort maturity.

The earlier synthetic Play dream cannot contaminate the current baseline: the production event
table was empty when audited. Future manual production tests must be separately excluded before
claiming a clean baseline; there is deliberately no private-content-based retrospective filter.
