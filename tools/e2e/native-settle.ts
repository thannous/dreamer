import { expect, type Locator } from 'e2e';

type Box = Awaited<ReturnType<Locator['boundingBox']>>;

/** Two reads of one control at the same place and size. Native rects carry fractions. */
export const sameBox = (a: Box, b: Box) => !!a && !!b
  && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1
  && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** Waits until two reads of a control, `quietMs` apart, find it at the same place and size. */
export async function waitUntilStill(control: Locator, quietMs = 400) {
  let last: Box = null;
  await expect.poll(async () => {
    const box = await control.boundingBox();
    const still = sameBox(last, box);
    last = box;
    return still;
  }, { interval: quietMs, timeout: 10_000, message: 'the control never held still' }).toBe(true);
}

/**
 * Taps a control once it holds still. iOS takes a tap on a page that still glides after a scroll
 * for a touch that only stops it, and agent-device refuses a control on an Android sheet still
 * sliding in as covered. The engine's transition budget counts from the last action, which a
 * scroll or a sheet that opens on its own has already spent. Not for controls that keep moving.
 */
export async function tapWhenStill(control: Locator, quietMs = 400) {
  await waitUntilStill(control, quietMs);
  await control.tap();
}
