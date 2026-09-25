const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../docs-src/experience/experience.js'), 'utf8');
const code = source.slice(source.indexOf('let replayIntroOnReturn = null;'), source.indexOf('/* Boot.'));
function setup(allowAuto = true) {
  const buttons = [];
  const append = jest.fn();
  const film = { isConnected: true, classList: { add() {}, remove() {} }, setAttribute() {}, append() {}, remove() {} };
  const video = { pause() {}, play: () => Promise.resolve(), addEventListener() {} };
  const playIntro = jest.fn().mockResolvedValue({ unavailable: true });
  const context = {
    HERO_SELECTOR: 'header', FILM_BASE: 'loop', canPlayFilm: manual => manual || allowAuto,
    createVideo: () => video, holdDreamsForIntro() {}, revealDreamsAfterIntro() {}, activeLenis: null,
    html: { lang: 'fr', classList: { contains: () => false } },
    document: {
      hidden: false, querySelector: () => ({ prepend() {}, querySelector: () => ({ append }) }), addEventListener() {},
      createElement(tag) {
        if (tag !== 'button') return film;
        const button = { events: {}, addEventListener(name, fn) { this.events[name] = fn; }, remove() {} };
        buttons.push(button); return button;
      },
    },
    window: { location: { hash: '' }, matchMedia: () => ({ matches: false }), scrollTo() {} }, playIntro,
  };
  vm.createContext(context);
  vm.runInContext(code + '\nglobalThis.init = initFilm;', context);
  return { context, buttons, append, playIntro };
}
test('autoplay rejection exposes an intro retry activated directly by the user', async () => {
  const { context, buttons, append, playIntro } = setup();
  await context.init(false);
  expect(buttons).toHaveLength(1);
  expect(append).toHaveBeenCalledWith(buttons[0]);
  playIntro.mockResolvedValue({ unavailable: false });
  buttons[0].events.click();
  expect(playIntro).toHaveBeenCalledTimes(2);
  await Promise.resolve();
});
test('a slow connection offers manual playback without starting an automatic download', async () => {
  const { context, buttons, playIntro } = setup(false);
  await context.init(false);
  expect(playIntro).not.toHaveBeenCalled();
  expect(buttons).toHaveLength(1);
  buttons[0].events.click();
  expect(playIntro).toHaveBeenCalledTimes(1);
  await Promise.resolve();
});
