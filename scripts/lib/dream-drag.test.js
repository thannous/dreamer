const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../docs-src/experience/dream-drag.js'), 'utf8');
const context = { module: { exports: {} } };
vm.runInNewContext(source.replace('export function', 'function') + '\nmodule.exports = attachDreamDrag;', context);
const attach = context.module.exports;
function setup() {
  const handlers = {};
  const captured = new Set();
  const state = { dragging: false, velocity: 0, dragYaw: 0, dragPitch: 0 };
  const stage = {
    addEventListener: (name, callback) => { handlers[name] = callback; },
    classList: { add() {}, remove() {} },
    hasPointerCapture: id => captured.has(id),
    setPointerCapture: id => captured.add(id),
    releasePointerCapture: id => captured.delete(id),
  };
  attach(stage, state, (value, min, max) => Math.max(min, Math.min(max, value)));
  const send = (name, props = {}) => handlers[name]({ pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: 0, clientY: 0, ...props });
  return { state, send, captured };
}
test('horizontal touch rotates and suppresses the following card click', () => {
  const { state, send, captured } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 40, clientY: 3 });
  expect(state.dragYaw).toBeCloseTo(0.18);
  expect(state.dragPitch).toBe(0);
  expect(captured.has(1)).toBe(true);
  send('pointerup');
  const preventDefault = jest.fn();
  const stopPropagation = jest.fn();
  send('click', { detail: 1, preventDefault, stopPropagation });
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(state.dragging).toBe(false);
});
test('vertical touch leaves page scrolling to the browser', () => {
  const { state, send, captured } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 3, clientY: 40 });
  expect(state.dragYaw).toBe(0);
  expect(captured.size).toBe(0);
  expect(state.dragging).toBe(false);
});
test('a tap opens the card normally; secondary pointers cannot hijack a drag', () => {
  const { state, send } = setup();
  send('pointerdown');
  send('pointermove', { pointerId: 2, clientX: 100 });
  send('pointerup');
  const preventDefault = jest.fn();
  send('click', { detail: 1, preventDefault, stopPropagation() {} });
  expect(preventDefault).not.toHaveBeenCalled();
  expect(state.dragYaw).toBe(0);
});
test('cancel stops inertial motion and releases pointer capture', () => {
  const { state, send, captured } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 30 });
  send('pointercancel');
  expect(state.velocity).toBe(0);
  expect(state.dragging).toBe(false);
  expect(captured.size).toBe(0);
});
