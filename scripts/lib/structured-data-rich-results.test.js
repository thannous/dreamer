const {
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
