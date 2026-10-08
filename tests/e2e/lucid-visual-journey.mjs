// Run in the Browser node_repl after setupBrowserRuntime(), using the iab browser.
// A fresh origin is required: this journey creates fictional local mock fixtures.
import fs from 'node:fs/promises';

export async function runLucidVisualJourney({ browser, base, output, revision, onboarding = true }) {
  const tab = await browser.tabs.new();
  const viewport = await browser.capabilities.get('viewport');
  const report = { revision, base, profile: '.env.lucid.mock', fixtures: 'fresh guest; 22:30–07:00; beginner; fictional notes only', assertions: [], captures: [] };
  await fs.mkdir(output, { recursive: true });
  const check = (name, passed, evidence) => {
    report.assertions.push({ name, passed, evidence });
    if (!passed) throw new Error(name);
  };
  const observe = () => tab.playwright.domSnapshot();
  const shot = async (name) => {
    const snapshot = await observe();
    await fs.writeFile(`${output}/${name}.jpg`, await tab.screenshot({ fullPage: false }));
    report.captures.push({ name, url: await tab.url(), snapshot, time: new Date().toISOString() });
  };
  const goto = async (path, theme = 'dark') => {
    await tab.goto(`${base}${path}${path.includes('?') ? '&' : '?'}ambience=${theme}`);
    await new Promise(r => setTimeout(r, 1500));
    await tab.playwright.getByText('NOCTALIA', { exact: true }).waitFor({ state: 'hidden', timeoutMs: 15000 });
    await observe();
  };
  const press = async (name) => {
    await tab.playwright.getByRole('button', { name, exact: true }).click();
    return observe();
  };
  try {
    await viewport.set({ width: 390, height: 844 });
    if (onboarding) {
    await goto('/lucid/onboarding', 'light');
    check('Fresh onboarding opens at step 1', (await observe()).includes('Étape 1 / 4'));
    await shot('01-onboarding-light');
    await tab.playwright.getByRole('radio', { name: /^Mieux remarquer/ }).click();
    await observe();
    await tab.playwright.getByRole('radio', { name: /^Débutant/ }).click();
    await observe();
    await press('Continuer');
    await goto('/lucid/onboarding', 'dark');
    for (const [name, value] of [['Coucher', '22:30'], ['Réveil', '07:00']]) {
      await press(name);
      const style = await tab.playwright.evaluate(() => {
        const input = document.querySelector('input[type=time]');
        if (!input) return null;
        const css = getComputedStyle(input);
        let parent = input.parentElement;
        while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        return { color: css.color, colorScheme: css.colorScheme, background: parent ? getComputedStyle(parent).backgroundColor : null };
      });
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(style.color), b = luminance(style.background);
      style.contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      check(`${name}: dark time field has explicit readable text`, style && style.contrast >= 4.5 && style.colorScheme === 'dark', style);
      await tab.playwright.getByRole('textbox').fill(value);
      await observe();
      await shot(`02-${name}`);
      await press('Terminé');
      check(`${name}: selected time reaches schedule`, (await observe()).includes(value));
    }
    await tab.playwright.getByRole('radio', { name: /^Non, généralement/ }).click();
    await observe();
    await press('Continuer');
    await shot('03-plan');
    await press('Continuer');
    await shot('04-local');
    await press('Créer ma première semaine');
    }
    for (const width of [320, 360, 390]) {
      await viewport.set({ width, height: 844 });
      await goto('/lucid');
      const labels = await tab.playwright.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).map(el => {
        const descendants = Array.from(el.querySelectorAll('*'));
        const label = descendants.find(n => n.textContent === el.getAttribute('aria-label'));
        if (!label) return { text: el.getAttribute('aria-label'), missing: true };
        const rect = label.getBoundingClientRect();
        return { text: label.textContent, height: rect.height, lineHeight: getComputedStyle(label).lineHeight.replace('px', '') * 1, width: rect.width, scrollWidth: label.scrollWidth };
      }));
      check(`${width}px: four complete tab labels`, labels.length === 4 && labels.every(l => !l.missing && l.height >= l.lineHeight && l.scrollWidth <= l.width + 1), labels);
      const fonts = await tab.playwright.evaluate(() => Array.from(document.querySelectorAll('[data-testid=lucid-today-shortcuts] *')).filter(el => el.children.length === 0 && el.textContent?.trim()).map(el => ({ text: el.textContent, font: getComputedStyle(el).fontFamily, height: el.getBoundingClientRect().height, scroll: el.scrollHeight, width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth })));
      check(`${width}px: shortcuts have no clipped copy or missing font`, fonts.filter(f => f.font.includes('SpaceGrotesk')).every(f => f.scroll <= f.height + 1 && f.scrollWidth <= f.width + 1), fonts);
      await shot(`05-today-${width}`);
    }
    await viewport.set({ width: 390, height: 844 });
    for (const path of ['/lucid/program/mild', '/lucid/program/ssild', '/lucid/program/wbtb']) {
      for (const theme of ['dark', 'light']) {
        await goto(path, theme);
        check(`${path}: journey and safety details reachable`, (await observe()).includes('Méthode et sécurité'));
        await shot(`${path.split('/').pop()}-${theme}`);
      }
    }
    await goto('/lucid/session/wbtb/1');
    check('WBTB practice stays unavailable for beginner', (await observe()).includes('Séance indisponible'));
    await goto('/lucid/account', 'light');
    await shot('34-account-light');
    await tab.playwright.getByTestId('settings-account-open-signin').click();
    await observe();
    await shot('34-account-sheet-light');
    const sheet = await tab.playwright.evaluate(() => {
      const el = document.querySelector('[data-testid=settings-account-sheet]');
      if (!el) return null;
      const surface = Array.from(el.querySelectorAll('*')).find(n => getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)' && n.getBoundingClientRect().width > el.getBoundingClientRect().width * 0.8 && n.getBoundingClientRect().height > 200);
      return { background: surface ? getComputedStyle(surface).backgroundColor : getComputedStyle(el).backgroundColor, text: el.textContent };
    });
    check('Account sheet uses Lucid light surface', sheet?.background === 'rgb(255, 255, 255)', sheet);
    await new Promise(r => setTimeout(r, 400));
    await observe();
    await tab.playwright.getByTestId('input.auth.email').click();
    await observe();
    await tab.playwright.getByTestId('input.auth.email').pressSequentially('invalid-email');
    await observe();
    await tab.playwright.getByTestId('input.auth.password').click();
    await observe();
    await tab.playwright.getByTestId('input.auth.password').pressSequentially('short');
    await observe();
    const form = await tab.playwright.evaluate(() => {
      const button = document.querySelector('[data-testid="btn.auth.signIn"]');
      return { disabled: button?.getAttribute('aria-disabled'), text: document.body.textContent };
    });
    check('Invalid auth input keeps submission disabled', form.disabled === 'true', form);
    await shot('34-invalid-form');
    await press('Terminé');
    const notes = ['Fixture Lucid : un jardin calme et une porte lumineuse.', 'Fixture Lucid : je traverse le jardin et je remarque la porte lumineuse.'];
    for (const note of notes) {
      await goto('/lucid/morning', 'light');
      await tab.playwright.getByRole('radio', { name: /Écrire Notez/ }).click();
      await observe();
      await tab.playwright.getByRole('textbox', { name: 'Écrivez ce qui reste', exact: true }).fill(note);
      await observe();
      await press('Continuer');
      await tab.playwright.getByRole('radio', { name: /Non entendue/ }).click();
      await observe();
      await press('Continuer');
      await press('Enregistrer la capture');
      await new Promise(r => setTimeout(r, 500));
    }
    await goto('/lucid/journal', 'light');
    for (const note of notes) check('Saved fictional morning appears after navigation', (await observe()).includes(note), note);
    await shot('06-journal-filled');
    await goto('/lucid/dream-signs', 'light');
    const sign = tab.playwright.getByTestId('lucid-dream-sign-sign:lucid:jardin');
    await sign.getByRole('button', { name: 'Confirmer le signe', exact: true }).click();
    await observe();
    await goto('/lucid/dream-atlas', 'light');
    check('Confirmed sign and dream sources reach Atlas', (await observe()).includes('jardin') && (await observe()).includes('Rêves sources'));
    await shot('22-atlas-filled');
    for (const path of ['/lucid/morning-voice', '/lucid/permissions']) {
      await goto(path);
      const dom = await observe();
      check(`${path}: no technical qualification text in main UI`, !dom.includes('Ne jamais inventer') && !dom.includes('avant release') && !dom.includes('Échantillons utilisables'));
      await shot(path.split('/').pop());
    }
    // v1 ships no Apple Health import: the route is guarded off and lands on Lucid home.
    await goto('/lucid/sleep-integration');
    await observe();
    const healthScreen = await tab.playwright.evaluate(() => Boolean(document.querySelector('[data-testid=lucid-sleep-connect]')));
    check('Health import route is unreachable in v1', !healthScreen);
    await goto('/lucid/stabilization-lab');
    await tab.playwright.getByTestId('lucid-stabilization-lab-primary').click();
    check('Stabilization starts at hands', (await observe()).includes('mains'));
    await shot('24-active');
    await tab.playwright.getByTestId('lucid-stabilization-lab-pause').click();
    check('Stabilization pause is persisted', (await observe()).includes('En pause'));
    await goto('/lucid/stabilization-lab');
    check('Stabilization pause survives reload', (await observe()).includes('En pause'));
    await tab.playwright.getByTestId('lucid-stabilization-lab-primary').click();
    check('Stabilization resumes with pause control', (await observe()).includes('Pause'));
    await shot('24-resumed');
    await goto('/lucid/ssild-lab');
    await tab.playwright.getByTestId('lucid-ssild-lab-primary').click();
    check('Sensory lab starts with a visible phase', (await observe()).includes('progressbar \"Sens 1 sur'));
    await shot('25-active');
    await tab.playwright.getByTestId('lucid-ssild-lab-pause').click();
    check('Sensory lab pause is visible', (await observe()).includes('En pause'));
    await goto('/lucid/ssild-lab');
    check('Sensory lab pause survives reload', (await observe()).includes('En pause'));
    await tab.playwright.getByTestId('lucid-ssild-lab-primary').click();
    check('Sensory lab resumes', (await observe()).includes('Pause'));
    await shot('25-resumed');
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    report.error = String(error);
    await shot('failure').catch(() => {});
    throw error;
  } finally {
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await viewport.reset();
    await tab.close();
  }
  return report;
}
