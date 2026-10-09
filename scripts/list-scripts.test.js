'use strict';

const { buildCatalog, classifyScript, scriptSafety } = require('./list-scripts');

describe('script catalog', () => {
  it('groups the main operational families', () => {
    expect(classifyScript('start:mock')).toBe('Development');
    expect(classifyScript('test:e2e:smoke')).toBe('Android E2E');
    expect(classifyScript('docs:check')).toBe('Site');
    expect(classifyScript('subscription:qa:report')).toBe('Subscriptions');
    expect(classifyScript('verify:pr')).toBe('Quality');
    expect(classifyScript('verify:release')).toBe('Quality');
  });

  it('surfaces commands with side effects', () => {
    expect(scriptSafety('docs:deploy:prod')).toBe('publishes');
    expect(scriptSafety('docs:build')).toBe('writes generated files');
    expect(scriptSafety('verify:pr')).toBe('writes a local proof');
    expect(scriptSafety('verify:release')).toBe('writes a local proof');
    expect(scriptSafety('android:release:local')).toBe('builds artifacts');
    expect(scriptSafety('generate-sitemap')).toBe('writes generated files');
    expect(scriptSafety('prepare')).toBe('writes local Git config');
  });

  it('separates web, backend and native E2E entry points', () => {
    expect(classifyScript('test:e2e:web')).toBe('Web E2E');
    expect(classifyScript('test:e2e:web:report')).toBe('Web E2E');
    expect(classifyScript('test:e2e:backend')).toBe('Backend E2E');
    expect(classifyScript('start:backend-e2e')).toBe('Backend E2E');
    expect(classifyScript('test:e2e:journeys')).toBe('Android E2E');
    expect(classifyScript('release:build')).toBe('Mobile release');
    expect(classifyScript('release:check')).toBe('Mobile release');
  });

  it('distinguishes release preparation, remote builds and counter synchronization', () => {
    expect(scriptSafety('release:prepare')).toBe('writes release manifests');
    expect(scriptSafety('release:build')).toBe('starts a remote build');
    expect(scriptSafety('release:versions:sync')).toBe('writes local version mirrors');
    expect(scriptSafety('release:plan')).toBe('read-only or runtime');
    expect(scriptSafety('release:check')).toBe('read-only or runtime');
    expect(scriptSafety('release:versions:check')).toBe('read-only or runtime');
  });

  it('returns a stable catalog', () => {
    expect(buildCatalog({ 'docs:check': 'check', start: 'start' })).toEqual([
      { command: 'start', family: 'Development', name: 'start', safety: 'read-only or runtime' },
      { command: 'check', family: 'Site', name: 'docs:check', safety: 'read-only or runtime' },
    ]);
  });
});
