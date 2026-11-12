import { afterEach, test } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { type NativeBackgroundFixtures, FLEET_PHONE, PHONE_SETTINGS_SKIP, restore, billingTap, billingSettings, billingGuest, restoreDeviceSettings } from '../dreamer-native-fixtures';

afterEach(restoreDeviceSettings);

// PR #633: actual native collection UI and the Android cold/offline fallback.
// Accessible image assertions alone do not prove artwork pixels: qualification also
// requires inspection of these captures and the exact CDN image in the native cache.
// The guarded runner permits this synthetic profile only on owned QA targets.
async function collection633Start(fixtures: NativeBackgroundFixtures) {
  const { screen } = fixtures;
  await billingGuest(fixtures);
  await billingSettings(screen);
  await billingTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('btn.mockProfile.new', { visible: true }).tap();
  const story = 'PR633 native: a glass beach under an enormous moon.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true }).tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  // iOS exposes a separate drop cap and an object-replacement marker in the transcript.
  await expect(screen.getByTestId('text.dreamDetail.transcript')).toContainText(story.slice(1));
  await screen.getByTestId('btn.savedDream.returnToJournal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
}

async function collection633Open(screen: TestFixtures['screen']) {
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await screen.getByTestId('btn.explore.collection', { visible: true }).tap();
  await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('collection.summary.count')).toHaveText('1 card of 43');
  const bounds = await screen.getByTestId('screen.collection', { visible: true }).boundingBox();
  if (!bounds) throw new Error('Native collection frame is missing');
  return bounds;
}

for (const offline of [false, true]) {
  test(`PR633 native collection: grid, reveal and retained detail ${offline ? 'offline with cold cache' : 'online'}`, {
    tags: ['pr633-collection'], timeout: 240_000,
    platforms: offline ? ['android'] : ['ios', 'android'],
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires owned mock-persistent Release.'
      : offline && FLEET_PHONE ? PHONE_SETTINGS_SKIP : false,
  }, async (fixtures) => {
    const { app, screen, device } = fixtures;
    // collection633Start begins with app.open() through billingGuest.
    await collection633Start(fixtures);
    if (offline) {
      restore.airplane = true;
      await device.setAirplaneMode(true);
    }
    const collectionFrame = await collection633Open(screen);
    await expect(screen.getByRole('button', 'New Bronze card: Night Journal. Ready to reveal.', { visible: true })).toBeVisible();
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-grid`);
    await screen.getByTestId('collection.summary.new', { visible: true }).tap();
    await screen.getByTestId('collection.detail.reveal', { visible: true }).tap();
    await expect(screen.getByTestId('collection.detail.tier.bronze', { visible: true })).toBeVisible();
    await expect(screen.getByRole('image', 'Night Journal, Bronze', { visible: true })).toBeVisible();
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-revealed`);
    const close = screen.getByTestId('collection.detail.close', { visible: true });
    const closeFrame = await close.boundingBox();
    if (!closeFrame) throw new Error('Card close control frame is missing');
    expect(closeFrame.x).toBeGreaterThanOrEqual(collectionFrame.x);
    expect(closeFrame.x + closeFrame.width).toBeLessThanOrEqual(collectionFrame.x + collectionFrame.width);
    await close.tap();
    await expect(screen.getByTestId('collection.detail', { visible: true })).toHaveCount(0);
    await expect(screen.getByTestId('collection.summary.new')).toHaveCount(0);
    await screen.scrollUntilVisible(screen.getByTestId('collection.card.night-journal', { visible: true }));
    await screen.getByTestId('collection.card.night-journal', { visible: true }).tap();
    await expect(screen.getByRole('image', 'Night Journal, Bronze', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('collection.detail.reveal')).toHaveCount(0);
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-reopened`);
  });
}
