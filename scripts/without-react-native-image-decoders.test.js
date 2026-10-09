'use strict';

const appConfig = require('../app.json');
const { disableImageDecoders } = require('../plugins/withoutReactNativeImageDecoders');

const property = (key, value) => ({ type: 'property', key, value });

describe('React Native image decoders on Android', () => {
  it('is registered for the app build', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withoutReactNativeImageDecoders');
  });

  it('turns off the template GIF and WebP add-ons and keeps other properties', () => {
    const output = disableImageDecoders([
      { type: 'comment', value: 'Enable GIF support in React Native images' },
      property('expo.gif.enabled', 'true'),
      property('expo.webp.enabled', 'true'),
      property('expo.webp.animated', 'false'),
      property('hermesEnabled', 'true'),
    ]);

    expect(output.filter((item) => item.type === 'property')).toEqual([
      property('expo.gif.enabled', 'false'),
      property('expo.webp.enabled', 'false'),
      property('expo.webp.animated', 'false'),
      property('hermesEnabled', 'true'),
    ]);
    expect(disableImageDecoders(output)).toEqual(output);
  });

  it('adds the properties when the template has none', () => {
    expect(disableImageDecoders([])).toEqual([
      property('expo.gif.enabled', 'false'),
      property('expo.webp.enabled', 'false'),
      property('expo.webp.animated', 'false'),
    ]);
  });
});
