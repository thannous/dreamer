import { afterEach, test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { openApp } from '../test-support/open-app';
import { FLEET_PHONE, PHONE_SETTINGS_SKIP, restore, openBackgroundRoute, restoreDeviceSettings } from '../dreamer-native-fixtures';

afterEach(restoreDeviceSettings);

// This journey retains the existing owned synthetic SQLite fixture. It never seeds,
// clears an account, starts audio, submits an analysis or opens a Store operation.
test('Dreamer Release scroll dogfood preserves its journal and painted resource screens', {
  tags: ['framerate'], timeout: 600_000,
  skip: process.env.E2E_SCROLL_DOGFOOD !== 'synthetic200'
    ? 'Requires the work package’s owned 200-dream Release fixture.' : FLEET_PHONE ? PHONE_SETTINGS_SKIP : false,
}, async (fixtures) => {
  const { app, screen, device } = fixtures;
  await openApp(app);
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'Noctalia performance 001' });
  await expect(card).toHaveCount(1);
  await app.screenshot('scroll-dogfood-journal');
  await card.tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  await expect(screen.getByRole('heading', 'Noctalia performance 001', { visible: true })).toBeVisible();
  await app.screenshot('scroll-dogfood-detail');
  await screen.swipe({ direction: 'up', momentum: 'slow' });
  await screen.swipe({ direction: 'down', momentum: 'slow' });
  await device.back();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
  await screen.scrollUntilVisible(card, { direction: 'up' });
  await expect(card).toHaveCount(1);
  for (const [tab, root, label] of [
    ['tab.home', 'screen.home', 'home'], ['tab.stats', 'screen.trends', 'trends'],
    ['tab.explore', 'screen.explore', 'explore'],
  ]) {
    await screen.getByTestId(tab, { visible: true }).tap();
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    await app.screenshot(`scroll-dogfood-${label}-top`);
    await screen.swipe({ direction: 'up', momentum: 'slow' });
    await screen.swipe({ direction: 'down', momentum: 'slow' });
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    if (label === 'trends') {
      const all = screen.getByTestId('trends.period.all');
      await screen.scrollUntilVisible(all, { direction: 'up' });
      await all.tap();
      await expect(screen.getByTestId('trends.figure.dreams.value')).toHaveText('200');
    }
    await app.screenshot(`scroll-dogfood-${label}-return`);
  }
  for (const [route, root] of [
    ['dream-guides', 'screen.dreamGuides'], ['symbol-dictionary', 'screen.symbolDictionary'],
  ]) {
    await openBackgroundRoute(fixtures, route);
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    await app.screenshot(`scroll-dogfood-${route}`);
  }
  // This production-apk profile leaves the audio feature disabled. Its direct
  // link must retain the existing safe return to Today, without starting audio.
  await openBackgroundRoute(fixtures, 'sleep-sounds');
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await openApp(app);
  await screen.getByTestId('tab.home', { visible: true }).tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  restore.portrait = true;
  await device.setOrientation('landscape-left');
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await app.screenshot('scroll-dogfood-landscape');
  await device.setOrientation('portrait');
  restore.portrait = false;
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
});
