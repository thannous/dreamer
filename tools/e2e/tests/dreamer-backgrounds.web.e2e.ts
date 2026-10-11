import { createRequire } from 'node:module';
import type { Page } from 'playwright/test';
import { createParityTest, expect, type ParityInfo } from '../web-parity-fixtures';

const sharp: typeof import('sharp') = createRequire(import.meta.url)('sharp');
const test = createParityTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

function luminance(color: number[]) {
  const linear = color.map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Measure pixels actually behind visible copy, after temporarily hiding its ink. */
async function readable(page: Page, info: ParityInfo, label: string) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  let lastLayout = '';
  let stableFrames = 0;
  await expect.poll(async () => {
    const layout = await page.evaluate(() => JSON.stringify(Array.from(document.querySelectorAll<HTMLElement>('[dir="auto"],p,input,textarea')).map(node => {
      const r = node.getBoundingClientRect();
      return [node.textContent, r.x, r.y, r.width, r.height];
    })));
    stableFrames = layout === lastLayout ? stableFrames + 1 : 0;
    lastLayout = layout;
    return stableFrames;
  }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
  const samples = await page.evaluate(() => {
    const parents = new Set<HTMLElement>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const parent = text.parentElement;
      if (parent && !parent.closest('script,style,textarea') && /[\p{L}\p{N}]/u.test(text.textContent ?? '')) parents.add(parent);
    }
    const nodes = [...parents, ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea,input[type="text"],input[type="search"]')];
    const samples: { text: string; color: number[]; alpha: number; required: number; rows: number[][] }[] = [];
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
      samples.push({ text: text.trim().slice(0, 80), color: channels.slice(0, 3), alpha: (channels[3] ?? 1) * opacity, required: fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5, rows });
      node.dataset.backgroundContrast = String(id++);
      node.dataset.backgroundOriginalStyle = node.getAttribute('style') ?? '';
    }
    // Read every inherited colour before hiding any parent Text node.
    for (const node of document.querySelectorAll<HTMLElement>('[data-background-contrast]')) {
      node.style.setProperty('color', 'transparent', 'important');
      node.style.setProperty('text-shadow', 'none', 'important');
      node.style.setProperty('caret-color', 'transparent', 'important');
    }
    const mask = document.createElement('style');
    mask.id = 'background-placeholder-mask';
    mask.textContent = '[data-background-contrast]::placeholder { color: transparent !important; }';
    document.head.appendChild(mask);
    return samples;
  });
  try {
    const buffer = await page.screenshot({ scale: 'css' });
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
      return { text: sample.text, color: sample.color, alpha: sample.alpha, minimum: Number(minimum.toFixed(3)), required: sample.required, measured };
    }).filter(result => result.measured > 0);
    await info.attach(`${label}-contrast`, { contentType: 'application/json', body: JSON.stringify({ method: 'Visible text lines over screenshot pixels with ink hidden; clipped, occluded and disabled copy excluded', results }, null, 2) });
    try {
      expect(results.length, `${label}: visible text was actually measured`).toBeGreaterThan(0);
      for (const result of results) expect(result.minimum, `${label}: ${result.text}`).toBeGreaterThanOrEqual(result.required);
    } catch (error) {
      await info.attach(`${label}-masked-failure`, { contentType: 'image/png', body: buffer });
      throw error;
    }
  } finally {
    await page.evaluate(() => {
      document.getElementById('background-placeholder-mask')?.remove();
      for (const node of document.querySelectorAll<HTMLElement>('[data-background-contrast]')) {
        const original = node.dataset.backgroundOriginalStyle!;
        if (original) node.setAttribute('style', original);
        else node.removeAttribute('style');
        delete node.dataset.backgroundContrast;
        delete node.dataset.backgroundOriginalStyle;
      }
    });
  }
  await page.screenshot({ path: info.outputPath(`${label}.png`), scale: 'css' });
}

async function start(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function theme(page: Page, value: 'light' | 'dark') {
  await page.getByTestId('tab.home').filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId(`quick-settings.theme.${value}`).click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByTestId('screen.home')).toHaveCSS('background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

async function artwork(page: Page, scene: string, mode: 'light' | 'dark') {
  const image = page.getByTestId(`image.background.${scene}`).filter({ visible: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => {
    const image = element instanceof HTMLImageElement ? element : element.querySelector('img');
    return Boolean(image?.complete && image.naturalWidth > 0);
  })).toBe(true);
  const lightness = await image.evaluate(element => {
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

/** The picture must retain its actual colour, not merely exist beneath a wash.
 * Compare the clear part of Capture's opening to the same decoded image in a
 * browser canvas; the former 75–90% veils fail this observable assertion.
 */
async function immersivePainting(page: Page, info: ParityInfo, label: string) {
  const picture = page.getByTestId('image.background.capture').filter({ visible: true });
  const expectedPng = await picture.evaluate(element => {
    const img = element instanceof HTMLImageElement ? element : element.querySelector('img');
    if (!img) throw new Error('Decoded painting missing');
    const bounds = element.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.width);
    canvas.height = Math.round(bounds.height);
    const ctx = canvas.getContext('2d')!;
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const actual = await picture.screenshot({ scale: 'css' });
  const baseline = await sharp(Buffer.from(expectedPng, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rendered = await sharp(actual).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(rendered.info.width).toBe(baseline.info.width);
  expect(rendered.info.height).toBeGreaterThanOrEqual(120);
  let difference = 0;
  let count = 0;
  // The last 40 points blend into the reading surface; keep them out of this comparison.
  for (let y = 12; y < rendered.info.height - 48; y += 3) {
    for (let x = 12; x < rendered.info.width - 12; x += 3) {
      const offset = (y * rendered.info.width + x) * 3;
      for (let c = 0; c < 3; c++) { difference += Math.abs(rendered.data[offset + c] - baseline.data[offset + c]); count++; }
    }
  }
  const meanChannelDifference = difference / count;
  await info.attach(`${label}-painting-colour`, { contentType: 'application/json', body: JSON.stringify({ meanChannelDifference, sampledChannels: count, maximum: 8 }) });
  expect(meanChannelDifference, 'The scene keeps its own colour in either theme').toBeLessThan(8);
}

/** Browser history navigation keeps the mock session and avoids a new app launch. */
async function openRoute(page: Page, path: string) {
  await page.evaluate(path => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, path);
}

for (const mode of ['light', 'dark'] as const) {
  test(`contextual backgrounds stay readable throughout Dreamer in ${mode} mode`, async ({ page }, info) => {
    await start(page);
    await theme(page, mode);
    await artwork(page, 'reverie', mode);
    await readable(page, info, `home-${mode}`);
    await page.getByTestId('tab.addDream').filter({ visible: true }).click();
    await artwork(page, 'capture', mode);
    await immersivePainting(page, info, `capture-${mode}`);
    await readable(page, info, `capture-${mode}`);
    await page.getByTestId('input.dreamTranscript').fill('Un phare doré éclairait un lac calme.');
    await expect(page.getByTestId('btn.saveDream')).toBeEnabled();
    await readable(page, info, `capture-filled-${mode}`);
    await page.getByTestId('input.dreamTranscript').fill('');
    await page.getByTestId('tab.stats').filter({ visible: true }).click();
    await artwork(page, 'astral', mode);
    await readable(page, info, `trends-${mode}`);
    await page.getByTestId('tab.explore').filter({ visible: true }).click();
    await artwork(page, 'path', mode);
    await readable(page, info, `explorer-${mode}`);
    await page.getByTestId('btn.explorer.guides').click();
    await artwork(page, 'path', mode);
    await readable(page, info, `guides-${mode}`);
    await page.getByTestId(/^dream-guide-/).first().click();
    await artwork(page, 'path', mode);
    await readable(page, info, `guide-reading-${mode}`);
    await page.goBack();
    await page.goBack();
    await page.getByTestId('btn.explorer.symbols').click();
    await artwork(page, 'symbols', mode);
    await readable(page, info, `symbols-${mode}`);
    await page.getByTestId(/^symbol\.popular\./).first().click();
    await expect(page.getByTestId('screen.symbolDetail')).toBeVisible();
    await expect(page.getByTestId('screen.symbolDetail').getByRole('heading', { name: 'Interprétation', exact: true })).toBeVisible();
    await readable(page, info, `symbol-detail-offline-${mode}`);
    await page.goBack();
    await page.goBack();
    for (const [id, scene] of [['starter', 'ritual'], ['memory', 'journal'], ['lucid', 'astral']]) {
      if (id !== 'starter') {
        await page.getByTestId('explorer-change-ritual').click();
        await page.getByTestId(`ritual-choice-${id}`).click();
        await page.getByTestId('ritual-picker-confirm').click();
        await expect(page.getByTestId('ritual-picker-confirm')).toHaveCount(0);
      }
      await page.getByTestId('btn.explorer.ritual').click();
      await artwork(page, scene, mode);
      await readable(page, info, `ritual-${id}-${mode}`);
      const step = page.getByRole('checkbox').first();
      await step.click();
      await expect(page.getByText('1/4 étapes', { exact: true })).toBeVisible();
      await page.goBack();
    }
    for (const [route, screen, scene] of [
      ['/weekly-recap', 'screen.weeklyRecap', 'astral'],
      ['/settings', 'screen.settings', 'journal'],
      ['/auth/reset-password', 'screen.auth.resetPassword', 'journal'],
    ]) {
      await openRoute(page, route);
      await expect(page.getByTestId(screen)).toBeVisible();
      await artwork(page, scene, mode);
      await readable(page, info, `${screen}-${mode}`);
      if (screen === 'screen.settings') {
        await page.getByTestId('settings-section-subscription').click();
        await artwork(page, 'observatory', mode);
        await expect(page.getByTestId('screen.paywall')).toBeVisible();
        await readable(page, info, `paywall-${mode}`);
        await page.getByTestId('btn.paywall.close').click();
        await expect(page.getByTestId('screen.settings')).toBeVisible();
      }
    }
  });

  test(`contextual backgrounds preserve journal and reflection actions in ${mode} mode`, async ({ page }, info) => {
    await start(page);
    await theme(page, mode);
    await page.getByTestId('btn.header.home.settings').click();
    await page.getByTestId('quick-settings.profile').click();
    await page.getByTestId('btn.mockProfile.plus').click();
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await page.getByTestId('input.dreamTranscript').fill('Une lanterne flottait entre deux arches au-dessus du lac.');
    await page.getByTestId('btn.saveDream').click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText('Une lanterne flottait');
    await page.getByTestId('btn.dream.primaryCta').click();
    await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await page.getByTestId('component.dreamDetail.actionCard').click();
    await expect(page.getByTestId('screen.dreamCategories')).toBeVisible();
    await artwork(page, 'dialogue', mode);
    await readable(page, info, `reflection-${mode}`);
    await page.getByTestId('btn.dreamCategory.symbols').click();
    await artwork(page, 'dialogue', mode);
    await expect(page.getByTestId('btn.exploration360.synthesis').filter({ visible: true })).toBeEnabled();
    await readable(page, info, `dialogue-${mode}`);
    await page.getByRole('button', { name: 'Retour', exact: true }).click();
    await expect(page.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
    await page.goBack();
    await page.getByTestId('btn.navigateJournal').click();
    await artwork(page, 'journal', mode);
    await readable(page, info, `journal-${mode}`);
    await page.getByTestId('input.searchDreams').fill('lanterne');
    await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(1);
  });
}

test('contextual backgrounds remain usable on narrow and desktop screens with a failed image', async ({ page }, info) => {
  await start(page);
  for (const mode of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await theme(page, mode);
    for (const viewport of [{ width: 320, height: 640 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId('tab.explore').filter({ visible: true }).click();
      await artwork(page, 'path', mode);
      await readable(page, info, `explorer-${mode}-${viewport.width}`);
      await expect(page.getByTestId('btn.explorer.guides')).toBeInViewport();
      await page.getByTestId('tab.addDream').filter({ visible: true }).click();
      await artwork(page, 'capture', mode);
      await readable(page, info, `capture-${mode}-${viewport.width}`);
      await page.getByTestId('input.dreamTranscript').fill('Le ciel était calme.');
      await expect(page.getByTestId('btn.saveDream')).toBeEnabled();
      await page.getByTestId('input.dreamTranscript').fill('');
    }
  }
  let aborted = 0;
  await page.route('**/*observatory-v1*', async route => { aborted++; await route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('tab.home').filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-section-subscription').click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await expect(page.getByTestId('image.background.observatory')).toHaveCount(0);
  await readable(page, info, 'paywall-dark-image-failed');
  await expect(page.getByTestId('btn.paywall.close')).toBeEnabled();
});
