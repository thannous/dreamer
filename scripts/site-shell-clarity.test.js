/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const SITE_SHELL_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'docs-src', 'static', 'js', 'site-shell.js'),
  'utf8'
);
const CONSENT_STORAGE_KEY = 'noctalia.analytics-consent.v1';

describe('site shell Clarity consent control', () => {
  beforeAll(() => {
    window.eval(SITE_SHELL_SOURCE);
  });

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    window.localStorage.clear();
    delete window.clarity;
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

  const grantAnalyticsConsent = () => {
    window.dispatchEvent(
      new CustomEvent('noctalia:analytics-consent', {
        detail: { analytics: true },
      })
    );
  };

  it('shows an equal-choice control and keeps Clarity absent before a decision', () => {
    renderConsent();

    const panel = document.getElementById('noctalia-analytics-consent');
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.querySelectorAll('[data-consent]')).toHaveLength(2);
    expect(document.querySelector('script[src*="clarity.ms/tag"]')).toBeNull();
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector('footer #noctalia-analytics-preferences')).not.toBeNull();
  });

  it('persists an opt-in for six months and loads Clarity asynchronously once', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    renderConsent();

    document.querySelector('[data-consent="granted"]').click();
    window.NoctaliaAnalyticsConsent.update(true);

    const scripts = document.querySelectorAll('script[src*="clarity.ms/tag"]');
    const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe('noctalia-clarity');
    expect(scripts[0].async).toBe(true);
    expect(scripts[0].src).toBe('https://www.clarity.ms/tag/xnb1iax99j');
    expect(stored).toEqual({
      version: 1,
      analytics: 'granted',
      updatedAt: now,
      expiresAt: now + 180 * 24 * 60 * 60 * 1000,
    });

    scripts[0].dispatchEvent(new Event('load'));
    const [command, consent] = Array.from(window.clarity.q[0]);
    expect(command).toBe('consentv2');
    expect(consent).toEqual({
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });

    Date.now.mockRestore();
  });

  it('restores a valid opt-in on a later page', () => {
    renderConsent({ stored: storedPreference('granted') });

    expect(document.getElementById('noctalia-analytics-consent').hidden).toBe(true);
    expect(document.querySelectorAll('script[src*="clarity.ms/tag"]')).toHaveLength(1);
  });

  it('restores a refusal without loading Clarity', () => {
    renderConsent({ stored: storedPreference('denied') });

    expect(document.getElementById('noctalia-analytics-consent').hidden).toBe(true);
    expect(document.querySelector('script[src*="clarity.ms/tag"]')).toBeNull();
    expect(window.clarity).toBeUndefined();
  });

  it('expires an old decision and asks again without loading Clarity', () => {
    renderConsent({ stored: storedPreference('granted', Date.now() - 1) });

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    expect(document.getElementById('noctalia-analytics-consent').hidden).toBe(false);
    expect(document.querySelector('script[src*="clarity.ms/tag"]')).toBeNull();
  });

  it('respects Global Privacy Control even when an opt-in was stored', () => {
    renderConsent({ gpc: true, stored: storedPreference('granted') });
    window.NoctaliaAnalyticsConsent.update(true);

    expect(document.querySelector('script[src*="clarity.ms/tag"]')).toBeNull();
    document.getElementById('noctalia-analytics-preferences').click();
    expect(document.querySelector('[data-consent="granted"]').disabled).toBe(true);
    expect(document.querySelector('.noctalia-consent-gpc')).not.toBeNull();
  });

  it('uses localized copy and the matching privacy policy', () => {
    renderConsent({ language: 'fr' });

    expect(document.getElementById('noctalia-analytics-consent-title').textContent).toBe(
      "Cookies de mesure d'audience"
    );
    expect(document.querySelector('[data-consent="granted"]').textContent).toBe(
      'Améliorer Noctalia'
    );
    expect(document.querySelector('[data-consent="denied"]').textContent).toBe('Refuser');
    expect(document.getElementById('noctalia-analytics-consent-description').textContent).not.toContain(
      'Microsoft Clarity'
    );
    expect(document.querySelector('#noctalia-analytics-consent a').getAttribute('href')).toBe(
      '/fr/politique-confidentialite'
    );
  });

  it('removes a blocked loader so a later opt-in can retry safely', () => {
    renderConsent();
    grantAnalyticsConsent();
    const script = document.getElementById('noctalia-clarity');

    expect(() => script.dispatchEvent(new Event('error'))).not.toThrow();
    expect(document.getElementById('noctalia-clarity')).toBeNull();

    grantAnalyticsConsent();
    expect(document.querySelectorAll('script[src*="clarity.ms/tag"]')).toHaveLength(1);
  });

  it('keeps analytics denied when consent is withdrawn before loading completes', () => {
    renderConsent();
    grantAnalyticsConsent();
    const script = document.getElementById('noctalia-clarity');

    window.NoctaliaAnalyticsConsent.update(false);
    script.dispatchEvent(new Event('load'));

    const calls = window.clarity.q.map((args) => Array.from(args));
    expect(calls.at(-1)).toEqual([
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'denied' },
    ]);
  });

  it('persists a withdrawal and sends a denied signal to a loaded Clarity instance', () => {
    jest.useFakeTimers();
    renderConsent({ stored: storedPreference('granted') });
    const script = document.getElementById('noctalia-clarity');
    script.dispatchEvent(new Event('load'));

    document.getElementById('noctalia-analytics-preferences').click();
    document.querySelector('[data-consent="denied"]').click();

    const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    const calls = window.clarity.q.map((args) => Array.from(args));
    expect(stored.analytics).toBe('denied');
    expect(calls.at(-1)).toEqual([
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'denied' },
    ]);

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
