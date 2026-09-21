'use strict';
const DAY = 86400_000;
const MIN_COHORT = 10;
const WEB_PAGES = [
  '/de/guides/traumsymbole-lexikon', '/es/blog/suenos-de-agua',
  '/it/simboli/cane', '/it/simboli/fuoco',
];
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('Expected a valid YYYY-MM-DD date');
  }
  return value;
}
function windowOptions({ from, to, asOf }) {
  [from, to, asOf].forEach(date);
  if (from > to || to >= asOf || Date.parse(to) - Date.parse(from) > 30 * DAY) {
    throw new Error('Use a 1–31 day cohort window ending before the as-of UTC date');
  }
  if (Date.parse(asOf) - Date.parse(from) > 80 * DAY) throw new Error('Window exceeds raw-event coverage');
  return { from, to, asOf };
}
function buildProductSql(options) {
  const { from, to, asOf } = windowOptions(options);
  // SELECT only. Identifiers and properties never leave the database. The release
  // flag may be disabled: empty storage is not a zero-percent activation rate.
  return `WITH bounds AS (
    SELECT '${from}'::date AS start_date, '${to}'::date AS end_date,
      '${asOf}'::date::timestamp AT TIME ZONE 'UTC' AS as_of
  ), events AS (
    SELECT event_id, event_name, occurred_at, journey_id, platform, properties
    FROM public.product_analytics_events, bounds
    WHERE received_at < as_of AND occurred_at < as_of
      AND occurred_at >= (start_date::timestamp AT TIME ZONE 'UTC')
      AND event_name IN ('onboarding_completed', 'recording_saved', 'analysis_completed', 'dream_save_milestone')
      AND platform IN ('android','ios','web')
  ), starts AS (
    SELECT platform, journey_id, min(occurred_at) AS started_at
    FROM events WHERE event_name = 'onboarding_completed' AND journey_id IS NOT NULL
    GROUP BY platform, journey_id
  ), activation AS (
    SELECT s.platform, s.journey_id,
      EXISTS (SELECT 1 FROM events e WHERE e.platform=s.platform AND e.journey_id=s.journey_id
        AND e.event_name='recording_saved' AND e.occurred_at>=s.started_at
        AND e.occurred_at<s.started_at+interval '24 hours') AS saved
    FROM starts s, bounds
    WHERE s.started_at < ((end_date+1)::timestamp AT TIME ZONE 'UTC')
      AND s.started_at+interval '24 hours' <= as_of
  ), milestone AS (
    SELECT platform, event_id, properties->>'stage' AS stage,
      CASE WHEN (properties->>'cohort_day') ~ '^[0-9]{5}$'
        THEN date '1970-01-01' + (properties->>'cohort_day')::int END AS cohort_date
    FROM events WHERE event_name='dream_save_milestone'
  ), platforms AS (SELECT unnest(ARRAY['android','ios','web']) AS platform), counts AS (
    SELECT p.platform,
      (SELECT count(*) FROM events e WHERE e.platform=p.platform) AS received_events,
      (SELECT count(*) FROM activation a WHERE a.platform=p.platform) AS onboarding_journeys,
      (SELECT count(*) FROM activation a WHERE a.platform=p.platform AND a.saved) AS saved_within_24h,
      (SELECT count(DISTINCT m.event_id) FROM milestone m, bounds b WHERE m.platform=p.platform
        AND m.stage='first' AND m.cohort_date BETWEEN b.start_date AND b.end_date) AS first_saves,
      (SELECT count(DISTINCT m.event_id) FROM milestone m, bounds b WHERE m.platform=p.platform
        AND m.stage='first' AND m.cohort_date BETWEEN b.start_date AND b.end_date
        AND ((m.cohort_date+8)::timestamp AT TIME ZONE 'UTC')<=b.as_of) AS mature_first_saves,
      (SELECT count(DISTINCT m.event_id) FROM milestone m, bounds b WHERE m.platform=p.platform
        AND m.stage='return_7d' AND m.cohort_date BETWEEN b.start_date AND b.end_date
        AND ((m.cohort_date+8)::timestamp AT TIME ZONE 'UTC')<=b.as_of) AS returned_within_7d
    FROM platforms p
  )
  SELECT platform,
    CASE WHEN received_events=0 THEN 'no_events_received' ELSE 'events_received' END AS collection_status,
    CASE WHEN onboarding_journeys>=10 THEN onboarding_journeys END AS onboarding_journeys,
    CASE WHEN onboarding_journeys>=10 AND saved_within_24h>=10
      AND onboarding_journeys-saved_within_24h>=10 THEN saved_within_24h END AS saved_within_24h,
    CASE WHEN first_saves>=10 THEN first_saves END AS first_saves,
    CASE WHEN mature_first_saves>=10 THEN mature_first_saves END AS mature_first_saves,
    CASE WHEN mature_first_saves>=10 AND returned_within_7d>=10
      AND mature_first_saves-returned_within_7d>=10 THEN returned_within_7d END AS returned_within_7d,
    CASE WHEN first_saves=0 THEN 'no_cohort'
      WHEN mature_first_saves=0 THEN 'immature'
      WHEN ((end_date+15)::timestamp AT TIME ZONE 'UTC')>(SELECT as_of FROM bounds)
        THEN 'provisional_late_delivery' ELSE 'mature_observed' END AS return_status
  FROM counts, bounds ORDER BY platform;`;
}
function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function safeCount(value) { const n = count(value); return n !== null && n >= MIN_COHORT ? n : null; }
function rate(n, d) { return n !== null && d !== null && d > 0 && n <= d ? +(100 * n / d).toFixed(2) : null; }
function normalizeProduct(rows) {
  if (!Array.isArray(rows)) throw new Error('Product input must be the aggregate SQL result array');
  return ['android','ios','web'].map(platform => {
    const r = rows.find(x => x.platform === platform);
    if (!r) return { platform, status: 'unavailable', activation_rate: null, return_rate: null };
    const denominator = safeCount(r.onboarding_journeys);
    const rawSaved = safeCount(r.saved_within_24h);
    const saved = denominator !== null && rawSaved !== null && denominator-rawSaved>=MIN_COHORT ? rawSaved : null;
    const mature = safeCount(r.mature_first_saves);
    const rawReturned = safeCount(r.returned_within_7d);
    const returned = mature !== null && rawReturned !== null && mature-rawReturned>=MIN_COHORT ? rawReturned : null;
    const noEvents = r.collection_status === 'no_events_received';
    return { platform, status: noEvents ? 'no_events_received' : 'observed_with_suppression',
      onboarding_journeys: noEvents ? null : denominator, saved_within_24h: noEvents ? null : saved,
      activation_rate: noEvents ? null : rate(saved,denominator), first_saves: noEvents ? null : safeCount(r.first_saves),
      mature_first_saves: noEvents ? null : mature, returned_within_7d: noEvents ? null : returned,
      return_rate: noEvents ? null : rate(returned,mature),
      return_status: ['no_cohort','immature','provisional_late_delivery','mature_observed'].includes(r.return_status)
        ? r.return_status : 'unknown' };
  });
}
function normalizeWeb(input, options) {
  if (!input) return { status: 'unavailable', sessions: null, click_sessions: null, click_rate: null };
  if (input.from !== options.from || input.to !== options.to) {
    return { status: 'window_mismatch', sessions: null, click_sessions: null, click_rate: null };
  }
  const sessions = count(input.sessions), clicks = count(input.click_sessions);
  const valid = sessions !== null && clicks !== null && clicks <= sessions &&
    input.scope === 'four_priority_pages' && input.metric === 'distinct_sessions_with_product_click';
  const complete = input.processing_complete === true && input.qa_excluded === true;
  return { status: !valid ? 'invalid_or_incompatible_metrics' : complete ? 'observed' : 'provisional_or_qa_unqualified',
    sessions: valid ? sessions : null, click_sessions: valid ? clicks : null,
    click_rate: valid && complete ? rate(clicks,sessions) : null,
    play_click_sessions: valid ? count(input.play_click_sessions) : null,
    web_app_click_sessions: valid ? count(input.web_app_click_sessions) : null };
}
function buildReport({ product = [], web = null, ...options }) {
  const window = windowOptions(options);
  return { schema_version: 1, window, website: normalizeWeb(web,window), product: normalizeProduct(product),
    web_delivery: 'Web delivery: authenticated sessions only; guest events remain local until sign-in and expire after seven days',
    attribution: 'No website-to-install or cross-platform identity join',
    population: 'Optional first-party measurement; journeys and empty-journal cohorts are not unique people',
    definitions: { activation: 'Save within 24h after measured onboarding completion in the same journey',
      return: 'A further new dream saved on a later UTC date within 168h of the first save',
      maturity: 'All saves in a UTC cohort date receive 168h observation; allow another 7 days for queued events',
      suppression: 'Product counts below 10 and rates exposing complements below 10 are suppressed',
      qa: 'QA builds must set EXPO_PUBLIC_PRODUCT_ANALYTICS_QA=true; unflagged manual tests cannot be identified retrospectively' } };
}
function markdown(report) {
  const show = x => x === null || x === undefined ? 'unknown / suppressed' : String(x);
  return `# Noctalia adoption baseline\n\nCohort: ${report.window.from}–${report.window.to}; observed before ${report.window.asOf} 00:00 UTC.\n\n`+
    `## Website → product\n\nStatus: **${report.website.status}**. Sessions: ${show(report.website.sessions)}; distinct sessions with product click: ${show(report.website.click_sessions)}; rate: ${show(report.website.click_rate)}%. These are clicks, not installs.\n\n`+
    `## Product first save and return\n\n| Platform | Collection | Onboarding journeys | Saved within 24h | Activation % | Mature first saves | Returned within 7d | Return % | Maturity |\n|---|---|---:|---:|---:|---:|---:|---:|---|\n`+
    report.product.map(r=>`| ${r.platform} | ${r.status} | ${show(r.onboarding_journeys)} | ${show(r.saved_within_24h)} | ${show(r.activation_rate)} | ${show(r.mature_first_saves)} | ${show(r.returned_within_7d)} | ${show(r.return_rate)} | ${r.return_status ?? 'unknown'} |`).join('\n')+
    `\n\n${report.web_delivery}. No retrospective first-save or return rate is claimed.\n\n`+
    `## Interpretation\n\n${report.population}. ${report.attribution}.\n\n`+
    Object.entries(report.definitions).map(([key,value])=>`- **${key}:** ${value}`).join('\n')+
    '\n\nMissing collection, missing consent, suppressed cohorts and immature windows must not be interpreted as zero conversion.\n';
}
module.exports={WEB_PAGES,windowOptions,buildProductSql,normalizeProduct,normalizeWeb,buildReport,markdown};
