import { readDOM, byId, expectCSS, expectInViewport, screenshotBytes, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
import { createRequire } from 'node:module';

const sharp: typeof import('sharp') = createRequire(import.meta.url)('sharp');
const test = createExactWebTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

function luminance(color: number[]) {
  const linear = color.map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Measure pixels actually behind visible copy, after temporarily hiding its ink. */
async function readable(ui: ExactWebUI, label: string) {
  const { app, browser, artifacts } = ui;
  await browser.mouse.move(0, 0);
  await browser.evaluate(async () => { await document.fonts.ready; return null; });
  let lastLayout = '';
  let stableFrames = 0;
  await expect.poll(async () => {
    const layout = await browser.evaluate(() => JSON.stringify(Array.from(document.querySelectorAll<HTMLElement>('[dir="auto"],p,input,textarea')).map(node => {
      const r = node.getBoundingClientRect();
      return [node.textContent, r.x, r.y, r.width, r.height];
    })));
    stableFrames = layout === lastLayout ? stableFrames + 1 : 0;
    lastLayout = layout;
    return stableFrames;
  }, { interval: 100 }).toBeGreaterThanOrEqual(3);
  for (let attempt = 1; ; attempt++) {
    const samples = await browser.evaluate(() => {
      const parents = new Set<HTMLElement>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const parent = text.parentElement;
        if (parent && !parent.closest('script,style,textarea') && /[\p{L}\p{N}]/u.test(text.textContent ?? '')) parents.add(parent);
      }
      const nodes = [...parents, ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea,input[type="text"],input[type="search"]')];
      const samples: { text: string; color: number[]; alpha: number; required: number; painted: boolean; rows: number[][] }[] = [];
      // Owner decision 2026-10-18 (PR #428): the header copy painted straight on the
      // artwork (NoctaliaScreenHeader's halo, `0px 1px 14px`) and the capture instruction
      // above the composer keep no local ground, so they are measured but not held to AA.
      const instruction = document.querySelector('[data-testid="recording-composer"]')?.previousElementSibling ?? null;
      let id = 0;
      for (const node of nodes) {
        const input = node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
        const placeholder = input && !node.value;
        const text = input ? node.value || node.placeholder : Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('');
        if (!/[\p{L}\p{N}]/u.test(text) || node.closest('[aria-hidden="true"],[aria-disabled="true"],[disabled]')) continue;
        const style = getComputedStyle(node);
        const bounds = node.getBoundingClientRect();
        if (style.visibility !== 'visible' || !bounds.width || !bounds.height || bounds.right <= 0 || bounds.left >= innerWidth || bounds.bottom <= 0 || bounds.top >= innerHeight) continue;
        let opacity = 1;
        for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
        if (opacity === 0) continue;
        const inkStyle = placeholder ? getComputedStyle(node, '::placeholder') : style;
        if (placeholder) opacity *= Number(inkStyle.opacity);
        const rgb = inkStyle.color.match(/^rgba?\(([^)]+)\)$/);
        if (!rgb) throw new Error(`Unsupported rendered text colour: ${inkStyle.color}`);
        const channels = rgb[1].split(/[, /]+/).map(Number);
        let boxes: DOMRect[];
        if (input) {
          // Input bounds include blank space and trailing controls. Measure the
          // lines of its value/placeholder, rather than the entire field.
          const measure = document.createElement('span');
          const left = bounds.x + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
          const width = bounds.width - (left - bounds.x) - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
          const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
          const top = node instanceof HTMLTextAreaElement ? bounds.y + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth) : bounds.y + (bounds.height - lineHeight) / 2;
          Object.assign(measure.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${width}px`, font: style.font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', visibility: 'hidden', pointerEvents: 'none' });
          measure.textContent = text;
          document.body.appendChild(measure);
          const range = document.createRange();
          range.selectNodeContents(measure);
          boxes = Array.from(range.getClientRects());
          measure.remove();
        } else {
          boxes = Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).flatMap(child => {
            const range = document.createRange();
            range.selectNodeContents(child);
            return Array.from(range.getClientRects());
          });
        }
        const fontSize = parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700 || /bold/i.test(style.fontFamily);
        const rows: number[][] = [];
        for (const box of boxes) {
          const left = Math.max(0, Math.ceil(box.x) + 1);
          const top = Math.max(0, Math.ceil(box.y) + 1);
          const right = Math.min(innerWidth, Math.floor(box.right) - 1);
          const bottom = Math.min(innerHeight, Math.floor(box.bottom) - 1);
          for (let y = top; y < bottom; y += 2) {
            let start: number | null = null;
            for (let x = left; x <= right; x += 2) {
              const hit = x < right ? document.elementFromPoint(x, y) : null;
              const visible = hit !== null && (hit === node || node.contains(hit));
              if (visible && start === null) start = x;
              if (!visible && start !== null) { rows.push([y, start, x]); start = null; }
            }
            if (start !== null) rows.push([y, start, right]);
          }
        }
        // Clipped content and copy beneath a toast or navigation are not visible.
        if (rows.length === 0) continue;
        const painted = style.textShadow.includes('0px 1px 14px') || Boolean(instruction?.contains(node));
        samples.push({ text: text.trim().slice(0, 80), color: channels.slice(0, 3), alpha: (channels[3] ?? 1) * opacity, required: fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5, painted, rows });
        node.dataset.backgroundContrast = String(id++);
        node.dataset.backgroundOriginalStyle = node.getAttribute('style') ?? '';
        node.dataset.backgroundBounds = JSON.stringify([bounds.x, bounds.y, bounds.width, bounds.height]);
      }
      // Read every inherited colour before hiding any parent Text node.
      for (const node of document.querySelectorAll<HTMLElement>('[data-background-contrast]')) {
        node.style.setProperty('color', 'transparent', 'important');
        // Keep the painted-text halo: it is part of the actual ground behind the ink.
        // Removing it measures a different, unprotected rendering of the screen.
        node.style.setProperty('caret-color', 'transparent', 'important');
      }
      const mask = document.createElement('style');
      mask.id = 'background-placeholder-mask';
      mask.textContent = '[data-background-contrast]::placeholder { color: transparent !important; }';
      document.head.appendChild(mask);
      return samples;
    });
    try {
      const buffer = await screenshotBytes(app, `${label}-masked-${attempt}`);
      // A transient element, such as the analysis outcome pill that closes 6 s after an
      // analysis settles, can leave between sampling and this screenshot. Its rows would
      // then fall on the copy it covered, which was never sampled and so keeps its ink
      // (the 2026-10-17 fr-FR Journal failure measured the Noctalia brand under the pill
      // at a ratio of 1). Measure again whenever the sampled copy moved or left.
      const unchanged = await browser.evaluate(count => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-background-contrast]'));
        return nodes.length === count && nodes.every(node => {
          if (!node.isConnected) return false;
          const r = node.getBoundingClientRect();
          return node.dataset.backgroundBounds === JSON.stringify([r.x, r.y, r.width, r.height]);
        });
      }, samples.length);
      if (!unchanged) {
        if (attempt < 3) continue;
        throw new Error(`${label}: the sampled copy kept changing during the contrast screenshot`);
      }
      const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const results = samples.map(sample => {
        let minimum = Infinity;
        let measured = 0;
        for (const [y, left, right] of sample.rows) {
          for (let x = left; x < right; x += 2) {
            const offset = (y * decoded.info.width + x) * 4;
            const ground = Array.from(decoded.data.subarray(offset, offset + 3));
            const ink = sample.color.map((channel, index) => channel * sample.alpha + ground[index] * (1 - sample.alpha));
            const a = luminance(ink);
            const b = luminance(ground);
            minimum = Math.min(minimum, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
            measured++;
          }
        }
        return { text: sample.text, color: sample.color, alpha: sample.alpha, minimum: Number(minimum.toFixed(3)), required: sample.required, painted: sample.painted, measured };
      }).filter(result => result.measured > 0);
      await artifacts.attach(`${label}-contrast`, { contentType: 'application/json', body: JSON.stringify({ method: 'Visible text lines over screenshot pixels with ink hidden; clipped, occluded and disabled copy excluded; painted header copy and the capture instruction recorded, not asserted (owner decision 2026-10-18, PR #428)', attempt, results }, null, 2) });
      try {
        expect(results.length, `${label}: visible text was actually measured`).toBeGreaterThan(0);
        for (const result of results) if (!result.painted) expect(result.minimum, `${label}: ${result.text}`).toBeGreaterThanOrEqual(result.required);
      } catch (error) {
        await artifacts.attach(`${label}-masked-failure`, { contentType: 'image/png', body: buffer });
        throw error;
      }
    } finally {
      await browser.evaluate(() => {
        document.getElementById('background-placeholder-mask')?.remove();
        for (const node of document.querySelectorAll<HTMLElement>('[data-background-contrast]')) {
          const original = node.dataset.backgroundOriginalStyle!;
          if (original) node.setAttribute('style', original);
          else node.removeAttribute('style');
          delete node.dataset.backgroundContrast;
          delete node.dataset.backgroundOriginalStyle;
          delete node.dataset.backgroundBounds;
        }
        return null;
      });
    }
    break;
  }
  await app.screenshot(`${label}.png`);
}

async function start(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function theme(ui: ExactWebUI, value: 'light' | 'dark') {
  const { screen: uiScreen, browser } = ui;
  await uiScreen.getByTestId('tab.home', { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId(`quick-settings.theme.${value}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  await expectCSS(browser, byId('screen.home'), 'background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

async function artwork(ui: ExactWebUI, scene: string, mode: 'light' | 'dark') {
  const { screen: uiScreen, browser } = ui;
  const image = uiScreen.getByTestId(`image.background.${scene}`, { visible: true });
  await expect(image).toBeVisible();
  await expect.poll(() => readDOM(browser, byId(`image.background.${scene}`), element => {
    const image = element instanceof HTMLImageElement ? element : element.querySelector('img');
    return Boolean(image?.complete && image.naturalWidth > 0);
  })).toBe(true);
  const lightness = await readDOM(browser, byId(`image.background.${scene}`), element => {
    const img = element instanceof HTMLImageElement ? element : element.querySelector('img');
    if (!img) throw new Error('Painting missing');
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 60;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 80, 60);
    const pixels = ctx.getImageData(0, 0, 80, 60).data;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    return sum / (80 * 60 * 255);
  });
  // A night painting behind the light interface reproduces the owner's defect.
  if (mode === 'light') expect(lightness, `${scene}: a luminous painting in the paper theme`).toBeGreaterThan(0.55);
  else expect(lightness, `${scene}: the night painting is retained in dark mode`).toBeLessThan(0.5);
}

/** Since the 2026-10-11 Capture redesign the painting reaches the top third behind the
 * title, the mode control and the composer: it is veiled behind copy rather than an
 * unmasked opening, and `readable` keeps every visible text over it at AA except the
 * painted header copy and instruction the owner kept on the halo alone. Here the
 * painting must reach the top edge, lie behind the whole title and still show through its
 * veil: with all text ink hidden, the header differs from the same header without it.
 */
async function paintedHeader(ui: ExactWebUI, label: string) {
  const { app, screen: uiScreen, browser, artifacts } = ui;
  const picture = uiScreen.getByTestId('image.background.capture', { visible: true });
  const title = uiScreen.getByTestId('screen.recording').getByRole('heading').first();
  const [painting, heading] = await Promise.all([picture.boundingBox(), title.boundingBox()]);
  if (!picture || !painting || !heading) throw new Error('Capture painting or title missing');
  expect(painting.y, 'The painting reaches the top edge').toBeLessThanOrEqual(0);
  expect(painting.y + painting.height, 'The painting lies behind the whole title').toBeGreaterThanOrEqual(heading.y + heading.height);
  const clip = { x: 0, y: 0, width: Math.round(painting.width), height: Math.round(heading.y + heading.height) };
  await browser.evaluate(() => {
    const mask = document.createElement('style');
    mask.id = 'painted-header-mask';
    mask.textContent = '* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } ::placeholder { color: transparent !important; }';
    document.head.appendChild(mask);
    return null;
  });
  let shots: Buffer[];
  try {
    const withPainting = await sharp(await screenshotBytes(app, `${label}-painting`)).extract({ left: clip.x, top: clip.y, width: clip.width, height: clip.height }).toBuffer();
    await readDOM(browser, byId('image.background.capture'), element => element.style.setProperty('visibility', 'hidden', 'important'));
    shots = [withPainting, await sharp(await screenshotBytes(app, `${label}-bare`)).extract({ left: clip.x, top: clip.y, width: clip.width, height: clip.height }).toBuffer()];
  } finally {
    await readDOM(browser, byId('image.background.capture'), element => element.style.removeProperty('visibility'));
    await browser.evaluate(() => { document.getElementById('painted-header-mask')?.remove(); return null; });
  }
  const [painted, bare] = await Promise.all(shots.map(shot => sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  let difference = 0;
  let count = 0;
  for (let y = 0; y < painted.info.height; y += 3) {
    for (let x = 0; x < painted.info.width; x += 3) {
      const offset = (y * painted.info.width + x) * 3;
      for (let c = 0; c < 3; c++) { difference += Math.abs(painted.data[offset + c] - bare.data[offset + c]); count++; }
    }
  }
  const meanChannelDifference = difference / count;
  await artifacts.attach(`${label}-painted-header`, { contentType: 'application/json', body: JSON.stringify({ painting, heading, meanChannelDifference, sampledChannels: count, minimum: 2 }) });
  expect(meanChannelDifference, 'The painting shows through the veil behind the header').toBeGreaterThan(2);
}

/** Browser history navigation keeps the mock session and avoids a new app launch. */
async function openRoute(ui: ExactWebUI, path: string) {
  const { browser } = ui;
  await browser.evaluate(path => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })); return null;
  }, path);
}

for (const mode of ['light', 'dark'] as const) {
  test(`contextual backgrounds stay readable throughout Dreamer in ${mode} mode`, async (ui) => {
  const { screen: uiScreen, browser } = ui;
    await start(ui);
    await theme(ui, mode);
    await artwork(ui, 'reverie', mode);
    await readable(ui, `home-${mode}`);
    await uiScreen.getByTestId('tab.addDream', { visible: true }).click();
    await artwork(ui, 'capture', mode);
    await paintedHeader(ui, `capture-${mode}`);
    await readable(ui, `capture-${mode}`);
    await uiScreen.getByTestId('input.dreamTranscript').fill('Un phare doré éclairait un lac calme.');
    await expect(uiScreen.getByTestId('btn.saveDream')).toBeEnabled();
    await readable(ui, `capture-filled-${mode}`);
    await uiScreen.getByTestId('input.dreamTranscript').fill('');
    await uiScreen.getByTestId('tab.stats', { visible: true }).click();
    await artwork(ui, 'astral', mode);
    await readable(ui, `trends-${mode}`);
    await uiScreen.getByTestId('tab.explore', { visible: true }).click();
    await artwork(ui, 'path', mode);
    await readable(ui, `explorer-${mode}`);
    await uiScreen.getByTestId('btn.explorer.guides').click();
    await artwork(ui, 'path', mode);
    await readable(ui, `guides-${mode}`);
    await uiScreen.getByTestId(/^dream-guide-/).first().click();
    await artwork(ui, 'path', mode);
    await readable(ui, `guide-reading-${mode}`);
    await browser.back();
    await browser.back();
    await uiScreen.getByTestId('btn.explorer.symbols').click();
    await artwork(ui, 'symbols', mode);
    await readable(ui, `symbols-${mode}`);
    await uiScreen.getByTestId(/^symbol\.popular\./).first().click();
    await expect(uiScreen.getByTestId('screen.symbolDetail')).toBeVisible();
    await expect(uiScreen.getByTestId('screen.symbolDetail').getByRole('heading', { name: 'Interprétation', exact: true })).toBeVisible();
    await readable(ui, `symbol-detail-offline-${mode}`);
    await browser.back();
    await browser.back();
    for (const [id, scene] of [['starter', 'ritual'], ['memory', 'journal'], ['lucid', 'astral']]) {
      if (id !== 'starter') {
        await uiScreen.getByTestId('explorer-change-ritual').click();
        await uiScreen.getByTestId(`ritual-choice-${id}`).click();
        await uiScreen.getByTestId('ritual-picker-confirm').click();
        await expect(uiScreen.getByTestId('ritual-picker-confirm')).toHaveCount(0);
      }
      await uiScreen.getByTestId('btn.explorer.ritual').click();
      await artwork(ui, scene, mode);
      await readable(ui, `ritual-${id}-${mode}`);
      const step = uiScreen.getByRole('checkbox').first();
      await step.click();
      await expect(uiScreen.getByText('1/4 étapes', { exact: true })).toBeVisible();
      await browser.back();
    }
    for (const [route, screen, scene] of [
      ['/weekly-recap', 'screen.weeklyRecap', 'astral'],
      ['/settings', 'screen.settings', 'journal'],
      ['/auth/reset-password', 'screen.auth.resetPassword', 'journal'],
    ]) {
      await openRoute(ui, route);
      await expect(uiScreen.getByTestId(screen)).toBeVisible();
      await artwork(ui, scene, mode);
      await readable(ui, `${screen}-${mode}`);
      if (screen === 'screen.settings') {
        await uiScreen.getByTestId('settings-section-subscription').click();
        await artwork(ui, 'observatory', mode);
        await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
        await readable(ui, `paywall-${mode}`);
        await uiScreen.getByTestId('btn.paywall.close').click();
        await expect(uiScreen.getByTestId('screen.settings')).toBeVisible();
      }
    }
  });

  test(`contextual backgrounds preserve journal and reflection actions in ${mode} mode`, async (ui) => {
  const { screen: uiScreen, browser } = ui;
    await start(ui);
    await theme(ui, mode);
    await uiScreen.getByTestId('btn.header.home.settings').click();
    await uiScreen.getByTestId('quick-settings.profile').click();
    await uiScreen.getByTestId('btn.mockProfile.plus').click();
    await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
    await uiScreen.getByTestId('input.dreamTranscript').fill('Une lanterne flottait entre deux arches au-dessus du lac.');
    await uiScreen.getByTestId('btn.saveDream').click();
    await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('Une lanterne flottait');
    await uiScreen.getByTestId('btn.dream.primaryCta').click();
    await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
    await expect(uiScreen.getByTestId('screen.dreamCategories')).toBeVisible();
    await artwork(ui, 'dialogue', mode);
    await readable(ui, `reflection-${mode}`);
    await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
    await artwork(ui, 'dialogue', mode);
    await expect(uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
    await readable(ui, `dialogue-${mode}`);
    await uiScreen.getByRole('button', { name: 'Retour', exact: true }).click();
    await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
    await browser.back();
    await uiScreen.getByTestId('btn.navigateJournal').click();
    await artwork(ui, 'journal', mode);
    await readable(ui, `journal-${mode}`);
    await uiScreen.getByTestId('input.searchDreams').fill('lanterne');
    await expect(uiScreen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  });
}

test('contextual backgrounds remain usable on narrow and desktop screens with a failed image', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  await start(ui);
  for (const mode of ['light', 'dark'] as const) {
    await browser.setViewport({ width: 390, height: 844 });
    await theme(ui, mode);
    for (const viewport of [{ width: 320, height: 640 }, { width: 1440, height: 900 }]) {
      await browser.setViewport(viewport);
      await uiScreen.getByTestId('tab.explore', { visible: true }).click();
      await artwork(ui, 'path', mode);
      await readable(ui, `explorer-${mode}-${viewport.width}`);
      await expectInViewport(uiScreen.getByTestId('btn.explorer.guides'), browser);
      await uiScreen.getByTestId('tab.addDream', { visible: true }).click();
      // On a desktop browser the sidebar carries the painting and Capture keeps a plain page.
      if (viewport.width < 1024) await artwork(ui, 'capture', mode);
      else await expect(uiScreen.getByTestId('image.background.capture')).toHaveCount(0);
      await readable(ui, `capture-${mode}-${viewport.width}`);
      await uiScreen.getByTestId('input.dreamTranscript').fill('Le ciel était calme.');
      await expect(uiScreen.getByTestId('btn.saveDream')).toBeEnabled();
      await uiScreen.getByTestId('input.dreamTranscript').fill('');
    }
  }
  let aborted = 0;
  await browser.route('**/*observatory-v1*', async route => { aborted++; await route.abort(); });
  await browser.setViewport({ width: 390, height: 844 });
  await uiScreen.getByTestId('tab.home', { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.all').click();
  await uiScreen.getByTestId('settings-section-subscription').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await expect(uiScreen.getByTestId('image.background.observatory')).toHaveCount(0);
  await readable(ui, 'paywall-dark-image-failed');
  await expect(uiScreen.getByTestId('btn.paywall.close')).toBeEnabled();
});
