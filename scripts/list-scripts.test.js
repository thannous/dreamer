'use strict';

const { buildCatalog, classifyScript, scriptSafety } = require('./list-scripts');

describe('script catalog', () => {
  it('groups the main operational families', () => {
    expect(classifyScript('start:mock')).toBe('Development');
    expect(classifyScript('test:e2e:smoke')).toBe('Android E2E');
    expect(classifyScript('docs:check')).toBe('Site');
    expect(classifyScript('subscription:qa:report')).toBe('Subscriptions');
  });

  it('surfaces commands with side effects', () => {
    expect(scriptSafety('docs:deploy:prod')).toBe('publishes');
    expect(scriptSafety('docs:build')).toBe('writes generated files');
    expect(scriptSafety('android:release:local')).toBe('builds artifacts');
    expect(scriptSafety('generate-sitemap')).toBe('writes generated files');
  });

  it('returns a stable catalog', () => {
    expect(buildCatalog({ 'docs:check': 'check', start: 'start' })).toEqual([
      { command: 'start', family: 'Development', name: 'start', safety: 'read-only or runtime' },
      { command: 'check', family: 'Site', name: 'docs:check', safety: 'read-only or runtime' },
    ]);
  });
});
