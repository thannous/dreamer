import test from 'node:test';
import assert from 'node:assert/strict';
import { sameBox } from './native-settle.ts';

test('a native control holds still only at the same place and size, within a pixel', () => {
  const box = { x: 16, y: 412.33, width: 343, height: 62 };
  assert.equal(sameBox(box, { ...box, y: 412.9 }), true);
  // A page still gliding, a sheet still rising, a control still growing.
  assert.equal(sameBox(box, { ...box, y: 398 }), false);
  assert.equal(sameBox(box, { ...box, x: 18 }), false);
  assert.equal(sameBox(box, { ...box, height: 64 }), false);
  // The first read has nothing to compare with; a control without geometry cannot be tapped.
  assert.equal(sameBox(null, box), false);
  assert.equal(sameBox(box, null), false);
});
