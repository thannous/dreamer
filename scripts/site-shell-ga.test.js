/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const RAW_SITE_SHELL_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'docs-src', 'static', 'js', 'site-shell.js'),
  'utf8'
);
const GA_TEST_ID = 'G-TEST123456';
const SITE_SHELL_SOURCE = RAW_SITE_SHELL_SOURCE.replace(
  /const GA_MEASUREMENT_ID = '[^']*';/,
  `const GA_MEASUREMENT_ID = '${GA_TEST_ID}';`
);
const CONSENT_STORAGE_KEY = 'noctalia.analytics-consent.v1';

describe('site shell Google Analytics consent control', () => {
  beforeAll(() => {
    expect(SITE_SHELL_SOURCE).toContain(GA_TEST_ID);
    window.eval(SITE_SHELL_SOURCE);
  });

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    window.localStorage.clear();
    delete window.clarity;
    delete window.gtag;
    delete window.dataLayer;
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      configurable: true,
      value: false,
    });
  });

  const storedPreference = (analytics, expiresAt = Date.now() + 60_000) =>
    JSON.stringify({
      version: 1,
      analytics,
      updatedAt: Date.now(),
      expiresAt,
    });

  const renderConsent = ({ language = 'en', stored = null, gpc = false } = {}) => {
    document.documentElement.lang = language;
    document.body.innerHTML = '<footer class="site-footer"></footer>';
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      configurable: true,
      value: gpc,
    });
    if (stored) {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, stored);
    }
    window.NoctaliaAnalyticsConsent.init();
  };

  const dataLayerCalls = () => (window.dataLayer || []).map((args) => Array.from(args));

  it('keeps Google Analytics absent before a decision', () => {
    renderConsent();

    expect(document.querySelector('script[src*="googletagmanager.com/gtag"]')).toBeNull();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it('loads gtag.js once after an opt-in with advertising consent denied', () => {
    renderConsent();

    document.querySelector('[data-consent="granted"]').click();
    window.NoctaliaAnalyticsConsent.update(true);

    const scripts = document.querySelectorAll('script[src*="googletagmanager.com/gtag"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe('noctalia-ga');
    expect(scripts[0].async).toBe(true);
    expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_TEST_ID}`);

    const calls = dataLayerCalls();
    expect(calls[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      },
    ]);
    expect(calls[1][0]).toBe('js');
    expect(calls[2]).toEqual(['config', GA_TEST_ID]);
  });

  it('restores a valid opt-in on a later page', () => {
    renderConsent({ stored: storedPreference('granted') });

    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag"]')).toHaveLength(1);
  });

  it('restores a refusal without loading Google Analytics', () => {
    renderConsent({ stored: storedPreference('denied') });

    expect(document.querySelector('script[src*="googletagmanager.com/gtag"]')).toBeNull();
    expect(window.gtag).toBeUndefined();
  });

  it('respects Global Privacy Control even when an opt-in was stored', () => {
    renderConsent({ gpc: true, stored: storedPreference('granted') });
    window.NoctaliaAnalyticsConsent.update(true);

    expect(document.querySelector('script[src*="googletagmanager.com/gtag"]')).toBeNull();
  });

  it('removes a blocked loader so a later opt-in can retry safely', () => {
    renderConsent();
    window.NoctaliaAnalyticsConsent.update(true);
    const script = document.getElementById('noctalia-ga');

    expect(() => script.dispatchEvent(new Event('error'))).not.toThrow();
    expect(document.getElementById('noctalia-ga')).toBeNull();

    window.NoctaliaAnalyticsConsent.update(true);
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag"]')).toHaveLength(1);
  });

  it('sends a denied consent update and clears _ga cookies on withdrawal', () => {
    jest.useFakeTimers();
    document.cookie = '_ga=GA1.1.123.456; path=/';
    document.cookie = `_ga_${GA_TEST_ID.slice(2)}=GS1.1.123; path=/`;
    renderConsent({ stored: storedPreference('granted') });

    document.getElementById('noctalia-analytics-preferences').click();
    document.querySelector('[data-consent="denied"]').click();

    const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(stored.analytics).toBe('denied');
    expect(dataLayerCalls().at(-1)).toEqual([
      'consent',
      'update',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    ]);
    expect(document.cookie).not.toContain('_ga');

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
