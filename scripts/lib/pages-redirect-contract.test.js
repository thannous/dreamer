const {
  parseRedirectRules,
  validateCloudflarePagesRedirects,
} = require('./pages-redirect-contract');

describe('Cloudflare Pages redirect contract', () => {
  it('accepts path redirects supported by Pages', () => {
    const source = `
      # Paths are handled by the Pages asset layer.
      /en / 301
      /blog/* /articles/:splat 301
    `;

    expect(parseRedirectRules(source)).toEqual([
      { from: '/en', to: '/', status: '301' },
      { from: '/blog/*', to: '/articles/:splat', status: '301' },
    ]);
    expect(validateCloudflarePagesRedirects(source)).toEqual([]);
  });

  it('rejects host and protocol sources unsupported by Pages', () => {
    expect(
      validateCloudflarePagesRedirects(
        'http://www.noctalia.app/* https://noctalia.app/:splat 301'
      )
    ).toEqual([
      'unsupported domain-level redirect source "http://www.noctalia.app/*"; configure host/protocol redirects in Cloudflare zone or account rules',
    ]);
  });
});
