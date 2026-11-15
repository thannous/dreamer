// A dream whose illustration failed keeps its story and analysis, says so in place of the
// picture and offers to try again. The retry paints the dream; the failure notice and its
// button leave, and the next visit opens on the picture.
import { expect } from 'e2e';
import { MOCK_PAINTING } from '../dreamer-release-fixtures';
import { journeyTest } from '../traced-parity-test';
import { journal, openDream, selectProfile } from '../web-journeys';
const test = journeyTest({ tags: ['zone-journal'] });

// The mock's one dream analysed without a picture (mock-data/predefinedDreams.ts).
const DREAM = 'Garden in the Clouds';

// The button that opens the picture is there before the picture is: wait for decoded pixels
// from the network, not the blurred placeholder.
const PAINTED = `Array.from(document.querySelectorAll('[data-testid="btn.dreamDetail.savedMoment.open"] img, [data-testid="btn.journal.illustration.expand"] img'))
  .some(img => img.complete && img.naturalWidth > 0 && /^https?:/.test(img.currentSrc))`;

test('a failed illustration offers a retry that paints the dream', async ({ app, screen, browser }) => {
  // The mock paints with a remote placeholder, which isolation blocks: serve one of the app's own.
  await browser.route('https://picsum.photos/**', route => route.fulfill({ path: MOCK_PAINTING, contentType: 'image/webp' }));
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  await openDream(screen, DREAM);
  const retry = screen.getByTestId('btn.journal.imageRetry');
  await retry.scrollIntoView();
  await expect(screen.getByText('The illustration couldn’t be created')).toBeVisible();
  await expect(screen.getByText('The illustration for this dream couldn’t be created. You can try again.')).toBeVisible();
  await expect(retry).toContainText('Try the illustration again');
  await app.screenshot('image-retry-offered');
  await retry.tap();
  // The picture arrives in the seal's window first; a later visit shows it on the plate.
  const picture = screen.getByTestId('btn.dreamDetail.savedMoment.open').or(screen.getByTestId('btn.journal.illustration.expand'));
  await expect(picture).toHaveCount(1);
  await expect(picture).toHaveAccessibleName('View illustration full screen');
  await expect.poll(() => browser.evaluate<boolean>(PAINTED)).toBe(true);
  await expect(retry).toHaveCount(0);
  await expect(screen.getByText('The illustration couldn’t be created')).toHaveCount(0);
  await app.screenshot('image-retry-painted');
  // The story the reader wrote is untouched, and the picture is still there on the next visit.
  await journal(screen);
  await openDream(screen, DREAM);
  await expect(screen.getByTestId('component.transcriptCard')).toContainText('I was walking through a beautiful garden');
  await expect(retry).toHaveCount(0);
  await expect(picture).toHaveCount(1);
  await expect.poll(() => browser.evaluate<boolean>(PAINTED)).toBe(true);
  await app.screenshot('image-retry-revisit');
});
