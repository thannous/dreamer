import { test } from '@e2e-dev/web';
import { answerAnalytics, expectNewSymbolPack, packsOfFile } from '../site-fixtures';

test.beforeEach(answerAnalytics);

// Every sixth new symbol pack of site-fixtures.ts, starting with the fifth.
for (const page of packsOfFile(5)) {
  test('new symbol packs: ' + page.id + ' renders every surface and its two effects', { timeout: 180_000 }, async ({ app, browser, screen }) => {
    await expectNewSymbolPack(page, { app, browser, screen });
  });
}
