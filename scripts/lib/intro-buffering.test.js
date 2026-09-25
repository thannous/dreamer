const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../docs-src/experience/experience.js'), 'utf8');
const code = source.slice(source.indexOf('const playIntro ='), source.indexOf('const FILM_BASE ='));

function setup({ warmed = true, rejected = false } = {}) {
  const elements = [];
  const element = () => {
    const handlers = new Map();
    const classes = new Set();
    const el = {
      currentTime: 0, duration: 4.2, buffered: { length: 1, start: () => 0, end: () => 1.2 },
      children: [], classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) },
      append(...children) { this.children.push(...children); },
      setAttribute() {}, remove: jest.fn(), pause: jest.fn(),
      play: jest.fn(() => rejected ? Promise.reject(new Error('autoplay')) : Promise.resolve()),
      addEventListener(name, fn, options) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push({ fn, once: options?.once }); },
      removeEventListener(name, fn) { handlers.set(name, (handlers.get(name) || []).filter(h => h.fn !== fn)); },
      emit(name) { for (const h of [...(handlers.get(name) || [])]) { h.fn(); if (h.once) this.removeEventListener(name, h.fn); } },
    };
    elements.push(el); return el;
  };
  const intro = element(), loop = element(), film = element();
  const createVideo = jest.fn(() => intro);
  const waitForFilmFrame = jest.fn(() => Promise.resolve(true));
  const context = {
    document: { createElement: element, body: { append() {} }, addEventListener() {}, removeEventListener() {} },
    window: { __expIntroVideo: warmed ? intro : null, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} },
    html: { lang: 'en' }, SKIP_LABELS: { en: 'Skip intro' }, INTRO_BASE: '/intro',
    createVideo, waitForFilmFrame, revealDreamsAfterIntro: jest.fn(),
  };
  vm.createContext(context); vm.runInContext(code + '\nglobalThis.run = playIntro;', context);
  const result = context.run(film, loop, '1280');
  return { context, result, intro, loop, film, createVideo, waitForFilmFrame, overlay: elements[3], skip: elements[4] };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('adopts the warmed video and waits for the full intro buffer before preparing the synchronized loop', async () => {
  const s = setup();
  expect(s.createVideo).not.toHaveBeenCalled(); expect(s.context.window.__expIntroVideo).toBeNull();
  s.intro.emit('playing'); s.intro.emit('progress');
  expect(s.waitForFilmFrame).not.toHaveBeenCalled();
  s.intro.buffered.end = () => 4.2;
  s.intro.emit('timeupdate'); s.intro.emit('canplaythrough');
  expect(s.waitForFilmFrame).toHaveBeenCalledTimes(1);
  await Promise.resolve(); expect(s.loop.pause).toHaveBeenCalledTimes(1);
  s.intro.emit('ended'); await jest.advanceTimersByTimeAsync(720);
  expect(await s.result).toEqual({ played: true, unavailable: false });
  expect(s.loop.play).toHaveBeenCalledTimes(1); expect(s.overlay.remove).toHaveBeenCalledTimes(1);
});

test('skipping during loading removes listeners and never waits for a background download', async () => {
  const s = setup(); s.intro.emit('playing'); s.skip.emit('click');
  s.intro.buffered.end = () => 4.2; s.intro.emit('progress');
  await jest.advanceTimersByTimeAsync(280);
  expect(await s.result).toEqual({ played: true, unavailable: false });
  expect(s.waitForFilmFrame).not.toHaveBeenCalled(); expect(s.overlay.remove).toHaveBeenCalledTimes(1);
});

test('a blocked autoplay still releases the intro gate and enables retry', async () => {
  const s = setup({ warmed: false, rejected: true });
  await jest.advanceTimersByTimeAsync(280);
  expect(await s.result).toEqual({ played: false, unavailable: true });
  expect(s.context.revealDreamsAfterIntro).toHaveBeenCalledTimes(1);
});

test('does not prepare the loop when the last range reaches the end but playback still has a gap', () => {
  const s = setup();
  s.intro.currentTime = 1;
  s.intro.buffered = { length: 2, start: i => i ? 3 : 0, end: i => i ? 4.2 : 1.5 };
  s.intro.emit('playing'); s.intro.emit('progress');
  expect(s.waitForFilmFrame).not.toHaveBeenCalled();
});

describe('background frame preparation', () => {
  function frameSetup() {
    let deliverFrame;
    const video = {
      play: () => Promise.resolve(), removeEventListener() {},
      requestVideoFrameCallback: fn => { deliverFrame = fn; return 7; },
      cancelVideoFrameCallback: jest.fn(),
    };
    const context = { window: { setTimeout, clearTimeout } };
    const frameCode = source.slice(source.indexOf('const waitForFilmFrame ='), source.indexOf('const playIntro ='));
    vm.createContext(context); vm.runInContext(frameCode + '\nglobalThis.wait = waitForFilmFrame;', context);
    return { video, context, frame: () => deliverFrame() };
  }
  test('uses the available intro time instead of cancelling preparation after 1.2 seconds', async () => {
    const s = frameSetup(); const done = jest.fn();
    const result = s.context.wait(s.video, 3000).then(done);
    await jest.advanceTimersByTimeAsync(1800); expect(done).not.toHaveBeenCalled();
    s.frame(); await result; expect(done).toHaveBeenCalledWith(true);
  });
  test('still releases the handoff when no frame can load', async () => {
    const s = frameSetup(); const result = s.context.wait(s.video);
    await jest.advanceTimersByTimeAsync(1200);
    expect(await result).toBe(false); expect(s.video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });
});
