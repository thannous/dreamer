'use strict';

const {
  analyzeHtml,
  auditRow,
  evaluateEvidence,
  normalizeLinkedUrl,
  parseArgs,
  parseCsv,
  summarize,
} = require('./check-backlink-results');

const CSV_HEADERS =
  'domain,referring_page,linked_url,http_status,indexability,canonical,link_rel,authority_treatment,first_verified,last_verified,next_check,external_action_status,notes';

function row(overrides = {}) {
  return {
    authority_treatment: 'followed',
    canonical: 'self',
    domain: 'example.com',
    external_action_status: 'none_required',
    first_verified: '2026-07-31',
    http_status: '200',
    indexability: 'indexable',
    last_verified: '2026-07-31',
    link_rel: 'noopener',
    linked_url: 'https://noctalia.app/',
    next_check: '2026-08-14',
    notes: 'fixture',
    referring_page: 'https://example.com/noctalia',
    ...overrides,
  };
}

describe('check-backlink-results', () => {
  it('parses quoted CSV fields, commas, escaped quotes, and line breaks', () => {
    const parsed = parseCsv(
      `${CSV_HEADERS}\nexample.com,https://example.com/noctalia,https://noctalia.app/,200,indexable,self,noopener,followed,2026-07-31,2026-07-31,2026-08-14,none_required,"note, with ""proof""\nand a second line"\n`
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].notes).toBe('note, with "proof"\nand a second line');
  });

  it('extracts indexability, canonical, and mixed Noctalia link treatment', () => {
    const evidence = analyzeHtml({
      html: `<!doctype html>
        <link rel="canonical" href="https://example.com/noctalia">
        <meta name="robots" content="noindex, follow">
        <a href="https://noctalia.app/" rel="noopener">Primary</a>
        <a href="https://noctalia.app/en/press" rel="nofollow noopener">Press</a>`,
      pageUrl: 'https://example.com/noctalia',
      status: 200,
    });

    expect(evidence.indexability).toBe('non_indexable');
    expect(evidence.canonical).toBe('https://example.com/noctalia');
    expect(evidence.followedLinks).toHaveLength(1);
    expect(evidence.nonFollowedLinks).toHaveLength(1);
    expect(evidence.observedTreatment).toBe('non_indexable');
  });

  it('detects when an expected followed backlink becomes nofollow', () => {
    const evidence = analyzeHtml({
      html: `<!doctype html>
        <link rel="canonical" href="https://example.com/noctalia">
        <a href="https://noctalia.app" rel="nofollow noopener">Noctalia</a>`,
      pageUrl: 'https://example.com/noctalia',
      status: 200,
    });

    expect(evaluateEvidence(row(), evidence)).toEqual([
      'authority is nofollow, expected followed',
    ]);
  });

  it('ignores common campaign parameters when matching the expected backlink', () => {
    const evidence = analyzeHtml({
      html: `<!doctype html>
        <link rel="canonical" href="https://example.com/noctalia">
        <a href="https://noctalia.app/?utm_source=peerpush&amp;ref=peerpush" rel="noopener">Noctalia</a>`,
      pageUrl: 'https://example.com/noctalia',
      status: 200,
    });

    expect(normalizeLinkedUrl(evidence.noctaliaLinks[0].href)).toBe('https://noctalia.app/');
    expect(evaluateEvidence(row(), evidence)).toEqual([]);
  });

  it('accepts a known access-blocked store-derived citation without link evidence', () => {
    const blockedRow = row({
      authority_treatment: 'store_derived_unverified',
      canonical: 'unverified',
      http_status: '403',
      indexability: 'unverified',
      link_rel: 'unverified',
    });
    const evidence = analyzeHtml({
      html: '<!doctype html><title>Forbidden</title>',
      pageUrl: blockedRow.referring_page,
      status: 403,
    });

    expect(evaluateEvidence(blockedRow, evidence)).toEqual([]);
  });

  it('accepts an explicitly tracked lost link and alerts if it returns', () => {
    const lostRow = row({ authority_treatment: 'lost', link_rel: 'missing' });
    const missingEvidence = analyzeHtml({
      html: '<!doctype html><link rel="canonical" href="https://example.com/noctalia">',
      pageUrl: lostRow.referring_page,
      status: 200,
    });
    const restoredEvidence = analyzeHtml({
      html: '<!doctype html><link rel="canonical" href="https://example.com/noctalia"><a href="https://noctalia.app/">Noctalia</a>',
      pageUrl: lostRow.referring_page,
      status: 200,
    });

    expect(evaluateEvidence(lostRow, missingEvidence)).toEqual([]);
    expect(evaluateEvidence(lostRow, restoredEvidence)).toEqual([
      'authority is followed, expected missing_link',
    ]);
  });

  it('tracks a page that is both non-indexable and missing the expected link', () => {
    const compoundRow = row({
      authority_treatment: 'non_indexable_missing_link',
      indexability: 'noindex, follow',
      link_rel: 'missing',
    });
    const currentEvidence = analyzeHtml({
      html: '<!doctype html><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://example.com/noctalia">',
      pageUrl: compoundRow.referring_page,
      status: 200,
    });
    const linkReturnedEvidence = analyzeHtml({
      html: '<!doctype html><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://example.com/noctalia"><a href="https://noctalia.app/">Noctalia</a>',
      pageUrl: compoundRow.referring_page,
      status: 200,
    });

    expect(evaluateEvidence(compoundRow, currentEvidence)).toEqual([]);
    expect(evaluateEvidence(compoundRow, linkReturnedEvidence)).toEqual([
      'authority is non_indexable with 1 Noctalia link(s), expected non_indexable_missing_link',
    ]);
  });

  it('audits a row through an injected fetch implementation', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(
        '<!doctype html><link rel="canonical" href="https://example.com/noctalia"><a href="https://noctalia.app/">Noctalia</a>',
        { headers: { 'content-type': 'text/html' }, status: 200 }
      )
    );

    const result = await auditRow(row(), { fetchImpl, timeoutMs: 1_000 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
    expect(result.mismatches).toEqual([]);
    expect(summarize([result])).toEqual({
      checked: 1,
      mismatched: 0,
      treatments: { followed: 1 },
    });
  });

  it('validates numeric CLI limits', () => {
    expect(parseArgs(['--timeout-ms=500', '--concurrency=2', '--strict'])).toMatchObject({
      concurrency: 2,
      strict: true,
      timeoutMs: 500,
    });
    expect(() => parseArgs(['--concurrency=0'])).toThrow(/between 1 and 20/);
  });
});
