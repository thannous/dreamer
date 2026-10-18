const { replaceFile } = require('./replace-file.cjs');

// Browser E2E cannot impose a transient filesystem sharing violation. These
// contracts run the same error scenarios on every OS; concurrent real readers
// and generators are exercised in generate-shared-route-types.test.js.
it.each(['EPERM', 'EACCES', 'EBUSY'])('keeps the old file until atomic replacement succeeds after %s', (code) => {
  let content = 'old', attempts = 0;
  const pause = jest.fn(() => expect(content).toBe('old'));
  replaceFile('temporary', 'destination', {
    rename: (from, to) => {
      expect([from, to]).toEqual(['temporary', 'destination']);
      if (++attempts < 3) throw Object.assign(new Error('shared handle'), { code });
      content = 'complete new file';
    }, pause, equivalent: () => false,
  });
  expect(content).toBe('complete new file');
  expect(attempts).toBe(3);
  expect(pause.mock.calls).toEqual([[20], [20]]);
});

it.each(['EPERM', 'EACCES', 'EBUSY'])('fails within the bound when %s persists', (code) => {
  const error = Object.assign(new Error('permanent denial'), { code });
  const rename = jest.fn(() => { throw error; });
  const pause = jest.fn();
  expect(() => replaceFile('temporary', 'destination', { rename, pause, equivalent: () => false })).toThrow(error);
  expect(rename.mock.calls.length).toBeGreaterThan(1);
  expect(pause.mock.calls.reduce((total, [ms]) => total + ms, 0)).toBeLessThanOrEqual(1000);
});

it('fails immediately for a non-transient filesystem error', () => {
  const error = Object.assign(new Error('missing source'), { code: 'ENOENT' });
  const rename = jest.fn(() => { throw error; });
  const pause = jest.fn();
  expect(() => replaceFile('temporary', 'destination', { rename, pause })).toThrow(error);
  expect(rename).toHaveBeenCalledTimes(1);
  expect(pause).not.toHaveBeenCalled();
});

it('does not wait after a successful atomic replacement', () => {
  const rename = jest.fn(), pause = jest.fn();
  replaceFile('temporary', 'destination', { rename, pause });
  expect(rename).toHaveBeenCalledTimes(1);
  expect(pause).not.toHaveBeenCalled();
});

it.each(['EPERM', 'EACCES', 'EBUSY'])('accepts the exact complete bytes already installed by a peer after %s', (code) => {
  const rename = jest.fn(() => { throw Object.assign(new Error('peer replaced it'), { code }); });
  const pause = jest.fn(), equivalent = jest.fn(() => true);
  replaceFile('temporary', 'destination', { rename, pause, equivalent });
  expect(rename).toHaveBeenCalledTimes(1);
  expect(equivalent).toHaveBeenCalledWith('temporary', 'destination');
  expect(pause).not.toHaveBeenCalled();
});
