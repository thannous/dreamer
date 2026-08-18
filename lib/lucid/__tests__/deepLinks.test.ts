import {
  buildNoctaliaHandoffLinks,
  getNoctaliaHandoffFallbackUrl,
  parseNoctaliaHandoffUrl,
  type NoctaliaHandoffPayload,
} from '@/lib/lucid/deepLinks';

const payload: NoctaliaHandoffPayload = {
  schemaVersion: 1,
  technique: 'mild',
  outcome: 'lucid',
  lucidity: 'high',
  recall: 'medium',
};

describe('Noctalia handoff deep links', () => {
  it('does not build a transfer without narrow explicit consent', () => {
    expect(buildNoctaliaHandoffLinks(payload, { dataTransfer: false })).toBeNull();
    expect(buildNoctaliaHandoffLinks(payload, true)).toBeNull();
    expect(
      buildNoctaliaHandoffLinks(payload, {
        dataTransfer: true,
        analytics: true,
      })
    ).toBeNull();
  });

  it('builds canonical app and HTTPS fallback links with only coarse fields', () => {
    const links = buildNoctaliaHandoffLinks(payload, { dataTransfer: true });

    expect(links).toEqual({
      appUrl:
        'noctalia://recording?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium',
      fallbackUrl:
        'https://dream.noctalia.app/?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium',
    });
    expect(parseNoctaliaHandoffUrl(links?.appUrl)).toEqual(payload);
    expect(parseNoctaliaHandoffUrl(links?.fallbackUrl)).toEqual(payload);
    expect(getNoctaliaHandoffFallbackUrl(links?.appUrl)).toBe(links?.fallbackUrl);
  });

  it('rejects malformed, duplicate, extra, private, and non-canonical input', () => {
    const canonical =
      'noctalia://recording?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium';
    const invalidUrls = [
      canonical.replace('noctalia:', 'http:'),
      canonical.replace('recording', 'settings'),
      canonical.replace('source=lucid_trainer', 'source=other'),
      `${canonical}&note=private`,
      `${canonical}&occurredAt=1700000000000`,
      `${canonical}&v=1`,
      `${canonical}#fragment`,
      canonical.replace('noctalia://', 'noctalia://user:secret@'),
      `noctalia://recording?${'x'.repeat(600)}`,
    ];

    for (const url of invalidUrls) {
      expect(parseNoctaliaHandoffUrl(url)).toBeNull();
    }
  });

  it('enforces outcome consistency without transferring raw scores', () => {
    expect(
      buildNoctaliaHandoffLinks(
        { ...payload, outcome: 'no_recall', lucidity: 'none', recall: 'none' },
        { dataTransfer: true }
      )
    ).not.toBeNull();
    expect(
      buildNoctaliaHandoffLinks(
        { ...payload, outcome: 'no_recall', lucidity: 'low', recall: 'none' },
        { dataTransfer: true }
      )
    ).toBeNull();
    expect(
      buildNoctaliaHandoffLinks(
        { ...payload, outcome: 'remembered', recall: 'none' },
        { dataTransfer: true }
      )
    ).toBeNull();
  });
});
