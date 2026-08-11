const {
  validateDatasetRichResults,
  validateSoftwareApplicationRichResults,
} = require('../check-content-release-gates');

describe('Google software application rich-result contract', () => {
  it('rejects a name-only SoftwareApplication nested in an editorial ItemList', () => {
    expect(
      validateSoftwareApplicationRichResults([
        {
          '@type': 'SoftwareApplication',
          name: 'Example dream journal',
        },
      ])
    ).toEqual([
      'Example dream journal: Google Rich Results requires at least two of offers.price, aggregateRating.ratingValue, applicationCategory, operatingSystem; found none',
    ]);
  });

  it('accepts an application with two truthful eligibility signals', () => {
    expect(
      validateSoftwareApplicationRichResults([
        {
          '@type': 'SoftwareApplication',
          name: 'Example dream journal',
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Android',
        },
      ])
    ).toEqual([]);
  });

  it('does not treat named editorial ListItems as software rich-result candidates', () => {
    expect(
      validateSoftwareApplicationRichResults([
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Example dream journal',
        },
      ])
    ).toEqual([]);
  });
});

describe('Google dataset rich-result contract', () => {
  it('rejects untyped creator and publisher references and a missing license', () => {
    expect(
      validateDatasetRichResults([
        {
          '@type': 'Dataset',
          name: 'Example dataset',
          creator: { '@id': 'https://example.com/#organization' },
          publisher: { '@id': 'https://example.com/#organization' },
        },
      ])
    ).toEqual([
      'Example dataset: creator must be a Person or Organization object',
      'Example dataset: publisher must be a Person or Organization object',
      'Example dataset: license must be an absolute URL or a CreativeWork with an absolute URL',
    ]);
  });

  it('accepts typed organizations and a versioned license URL', () => {
    expect(
      validateDatasetRichResults([
        {
          '@type': 'Dataset',
          name: 'Example dataset',
          creator: {
            '@type': 'Organization',
            '@id': 'https://example.com/#organization',
          },
          publisher: {
            '@type': 'Organization',
            '@id': 'https://example.com/#organization',
          },
          license: 'https://example.com/dataset#license-v1',
        },
      ])
    ).toEqual([]);
  });
});
