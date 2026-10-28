// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { webLocale } from '../web-engine';
import { test } from '../traced-parity-test';
const options = { tags: ['historical-parity', 'locale-en-US'], skip: webLocale !== 'en-US' ? 'Requires the real en-US browser context; run E2E_WEB_LOCALE=en-US' : false, timeout: 180_000 };
type Fixtures = { app: App; screen: Screen; browser: Browser };
const artwork = '../../e2e/fixtures/home-dream.png';
const dreamTitle = 'L’éléphant au sommet de la grande roue';
const story = 'An elephant lands on top of a Ferris wheel among turquoise and coral clouds.';

async function prepareReflection({ app, screen, browser }: Fixtures, media: 'loaded' | 'failed' | 'absent' = 'loaded') {
  await browser.route('https://picsum.photos/**', route => media === 'failed' ? route.abort() : route.fulfill({ path: artwork }));
  // Generated mock illustrations are the bundled 9:16 dream art, not picsum.
  if (media === 'failed') await browser.route(/mock-data(?:%2F|\/)assets(?:%2F|\/)dreams(?:%2F|\/)/, route => route.abort());
  await browser.setViewport(media === 'failed' ? { width: 320, height: 640 } : { width: 390, height: 844 });
  await app.open();
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
  await browser.reload();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); } finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId('btn.recording.home', { visible: true }).or(screen.getByTestId('tab.home', { visible: true })).tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.profile').tap();
  await screen.getByTestId('btn.mockProfile.plus').tap();
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await screen.getByTestId('btn.dream.primaryCta').tap();
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  if (media !== 'absent') {
    await screen.getByTestId('btn.journal.illustrate').tap();
    // Painted in the seal's window, the illustration leaves it for the plate at the top of the page.
    if (media !== 'failed') {
      await screen.getByTestId('component.dreamDetail.savedMoment').scrollIntoView();
      await expect(screen.getByTestId('btn.journal.illustration.expand')).toBeVisible();
    }
    await expect(screen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
    if (media === 'failed') {
      await screen.getByTestId('component.metadataCard').scrollIntoView();
      await expect(screen.getByTestId('journal.detail.image.unavailable')).toBeVisible();
    }
  }
  await screen.getByTestId('btn.editDream').tap();
  await screen.getByTestId('input.dreamTitle').fill(dreamTitle);
  await screen.getByTestId('btn.saveDreamEdit').tap();
  await screen.getByTestId('component.transcriptCard').scrollIntoView();
  await screen.getByTestId('component.dreamDetail.actionCard').tap();
  await expect(screen.getByTestId('screen.dreamCategories')).toBeVisible();
}

async function appearance({ screen, browser }: Fixtures, mode: 'dark' | 'light') {
  // Mock dreams are session-scoped: navigate through the UI without reloading.
  await browser.back();
  await browser.back();
  await screen.getByTestId('btn.recording.home', { visible: true }).or(screen.getByTestId('tab.home', { visible: true })).tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.language').tap();
  await screen.getByTestId('quick-settings.language.fr').tap();
  await screen.getByTestId(`quick-settings.theme.${mode}`).tap();
  await screen.getByTestId('quick-settings.close').tap();
  await screen.getByTestId('btn.home.today.cta').tap();
  await screen.getByTestId('component.transcriptCard').scrollIntoView();
  await screen.getByTestId('component.dreamDetail.actionCard').tap();
  await expect.poll(() => background(browser)).toBe(mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

function background(browser: Browser) {
  return browser.evaluate(() => {
    const element = document.querySelector('[data-testid="screen.dreamCategories"]');
    return element ? getComputedStyle(element).backgroundColor : null;
  });
}
function viewportRatio(browser: Browser, id: string) {
  return browser.evaluate(testId => {
    const element = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).find(node => node.getBoundingClientRect().width > 0);
    if (!element) return 0;
    return new Promise<number>(resolve => {
      const observer = new IntersectionObserver(([entry]) => { observer.disconnect(); resolve(entry.intersectionRatio); }, { threshold: [0, 1] });
      observer.observe(element);
    });
  }, id);
}
function imageWidth(browser: Browser) {
  return browser.evaluate(() => document.querySelector<HTMLImageElement>('[data-testid="image.reflection.dream"] img')?.naturalWidth ?? 0);
}

test('reflection preserves the artwork across themes and offers a recap after one successful angle', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await prepareReflection(fixtures);
  const categories = screen.getByTestId('screen.dreamCategories');
  const image = browser.locator('[data-testid="image.reflection.dream"] img');
  await expect(image).toBeVisible();
  await expect.poll(() => imageWidth(browser)).toBeGreaterThan(0);
  const originalSource = await image.getAttribute('src');
  await expect(screen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(screen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  for (const mode of ['dark', 'light'] as const) {
    await browser.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' });
    await appearance(fixtures, mode);
    await expect(image).toHaveAttribute('src', originalSource!);
    await expect(screen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
    for (const angle of ['symbols', 'emotions', 'growth']) {
      await expect(screen.getByTestId(`btn.dreamCategory.${angle}`)).toHaveCount(1);
    }
    await expect(screen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
    await app.screenshot(`reflection-before-${mode}.png`);
  }
  await screen.getByTestId('btn.dreamCategory.readAnalysis').tap();
  await expect(screen.getByTestId('analysis.reading.body')).toBeVisible();
  await screen.getByTestId('analysis.reading.close').tap();
  await screen.getByTestId('btn.dreamCategory.symbols').tap();
  await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await screen.getByRole('button', { name: 'Retour', exact: true }).tap();
  await expect(categories).toBeVisible();
  await expect(screen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(screen.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expect.poll(() => viewportRatio(browser, 'btn.exploration360.synthesis')).toBeGreaterThan(0);
  await app.screenshot('reflection-light.png');
  await screen.getByTestId('btn.exploration360.synthesis').tap();
  await expect(screen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Retour', exact: true }).tap();
  await expect(categories).toBeVisible();
  await expect(screen.getByTestId('btn.reflection.readRecap')).toBeVisible();
  await expect(screen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
});

test('reflection stays usable with failed artwork on a narrow screen', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await prepareReflection(fixtures, 'failed');
  await expect(screen.getByTestId('image.reflection.dream')).toHaveCount(0);
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await screen.getByTestId(`btn.dreamCategory.${angle}`).scrollIntoView();
    await expect.poll(() => viewportRatio(browser, `btn.dreamCategory.${angle}`)).toBeGreaterThan(0);
  }
  await screen.getByTestId('btn.dreamCategory.emotions').tap();
  await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await screen.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(screen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await screen.getByTestId('btn.exploration360.synthesis').scrollIntoView();
  await expect.poll(() => viewportRatio(browser, 'btn.exploration360.synthesis')).toBeGreaterThan(0);
  await app.screenshot('reflection-narrow.png');
});

test('reflection without an illustration keeps reading and all angles available before the first exchange', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await prepareReflection(fixtures, 'absent');
  await expect(screen.getByTestId('image.reflection.dream')).toHaveCount(0);
  await expect(screen.getByTestId('screen.dreamCategories').getByRole('heading', { name: dreamTitle, exact: true })).toBeVisible();
  await expect(screen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(screen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  await screen.getByTestId('btn.dreamCategory.readAnalysis').tap();
  await expect(screen.getByTestId('analysis.reading.body')).toBeVisible();
  await screen.getByTestId('analysis.reading.close').tap();
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await expect(screen.getByTestId(`btn.dreamCategory.${angle}`)).toBeEnabled();
  }
  await app.screenshot('reflection-without-artwork.png');
});

// The completed-dream Home CTA opens Journal; its existing mobile FlashList
// CSSStyleDeclaration baseline is outside this surface. Capture the dark state
// independently instead of routing a completed dream through that broken list.
test('reflection shows the completed exchange and original artwork in explicit dark mode', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await prepareReflection(fixtures);
  await browser.emulateMedia({ colorScheme: 'light' });
  await appearance(fixtures, 'dark');
  await screen.getByTestId('btn.dreamCategory.symbols').tap();
  await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await screen.getByRole('button', { name: 'Retour', exact: true }).tap();
  await expect(screen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(screen.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expect(browser.locator('[data-testid="image.reflection.dream"] img')).toBeVisible();
  await expect.poll(() => viewportRatio(browser, 'btn.exploration360.synthesis')).toBeGreaterThan(0);
  await app.screenshot('reflection-dark.png');
});
