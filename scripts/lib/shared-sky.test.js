const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../docs-src/experience/shared-sky.js'), 'utf8');

function setup() {
  const listeners = new Map();
  const raf = new Map();
  let next = 0;
  const win = {
    innerHeight: 844, scrollY: 0, __EXP_TIER__: 'light', performance: { now: () => 0 },
    Event: class { constructor(type) { this.type = type; } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener: (name, cb) => listeners.set(name, cb),
    requestAnimationFrame: cb => { raf.set(++next, cb); return next; },
    cancelAnimationFrame: id => raf.delete(id),
  };
  const classes = new Set();
  const doc = {
    defaultView: win, hidden: false, querySelector: () => null, addEventListener() {},
    documentElement: { classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) } },
    dispatchEvent: jest.fn(),
  };
  const shared = { clientHeight: 844, style: {} }, media = { style: {} };
  const main = { getBoundingClientRect: jest.fn(() => ({ top: -win.scrollY })) };
  const dreams = { getBoundingClientRect: jest.fn(() => ({ bottom: 6233 - win.scrollY })) };
  const context = { module: { exports: null } };
  vm.createContext(context);
  vm.runInContext(source.slice(0, source.indexOf('export function')) + '\nmodule.exports = createSkyMotion;', context);
  const motion = context.module.exports(doc, shared, media, main, dreams);
  return { win, shared, media, doc, dreams, main, motion, classes,
    scroll(y) { win.scrollY = y; listeners.get('scroll')(); },
    frame(now) { const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(cb => cb(now)); },
  };
}

test('keeps the sky opaque throughout the journey, fades at its end and restores it on reverse scroll', () => {
  const s = setup();
  s.scroll(3000); expect(s.shared.style.opacity).toBe('1');
  s.scroll(6233 - 422); expect(Number(s.shared.style.opacity)).toBeCloseTo(.5);
  s.scroll(6300); expect(s.shared.style.visibility).toBe('hidden');
  s.scroll(1000); expect(s.shared.style.visibility).toBe(''); expect(s.shared.style.opacity).toBe('1');
  expect(s.doc.dispatchEvent).toHaveBeenCalledTimes(2);
});

test('scroll and parallax frames reuse layout measurements and retain the opening zoom', () => {
  const s = setup(); s.motion.expand(); s.frame(1000); s.frame(2000);
  expect(s.media.style.transform).toContain('scale(1.10000)');
  expect(s.classes.has('oh-sky-expanding')).toBe(false);
  for (const y of [400, 800, 1500]) { s.scroll(y); s.frame(2100 + y); }
  expect(s.dreams.getBoundingClientRect).toHaveBeenCalledTimes(1);
  expect(s.main.getBoundingClientRect).toHaveBeenCalledTimes(1);
  s.motion.refresh(); expect(s.dreams.getBoundingClientRect).toHaveBeenCalledTimes(2);
});
