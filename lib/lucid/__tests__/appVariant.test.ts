import { resolveAppVariant } from '@/lib/appVariant';

describe('resolveAppVariant', () => {
  it('resolves the default Noctalia application when both markers are absent', () => {
    expect(
      resolveAppVariant({ expoProduct: undefined, publicVariant: undefined, isDev: false })
    ).toEqual({
      variant: 'noctalia',
      configVariant: 'noctalia',
      environmentVariant: 'noctalia',
      mismatch: false,
    });
  });

  it('resolves Lucid Trainer when the Expo product and public variant agree', () => {
    expect(
      resolveAppVariant({
        expoProduct: 'lucid-trainer',
        publicVariant: 'lucid',
        isDev: false,
      })
    ).toEqual({
      variant: 'lucid-trainer',
      configVariant: 'lucid-trainer',
      environmentVariant: 'lucid-trainer',
      mismatch: false,
    });
  });

  it('allows the existing Noctalia client to run Lucid Trainer for development QA', () => {
    expect(
      resolveAppVariant({ expoProduct: undefined, publicVariant: 'lucid', isDev: true })
    ).toEqual({
      variant: 'lucid-trainer',
      configVariant: 'noctalia',
      environmentVariant: 'lucid-trainer',
      mismatch: true,
    });
  });

  it('uses the embedded Lucid product in development when the public marker is absent', () => {
    expect(
      resolveAppVariant({
        expoProduct: 'lucid-trainer',
        publicVariant: undefined,
        isDev: true,
      })
    ).toMatchObject({ variant: 'lucid-trainer', mismatch: true });
  });

  it('fails explicitly on a production mismatch in either direction', () => {
    expect(() =>
      resolveAppVariant({ expoProduct: undefined, publicVariant: 'lucid', isDev: false })
    ).toThrow('Production variant mismatch');
    expect(() =>
      resolveAppVariant({
        expoProduct: 'lucid-trainer',
        publicVariant: undefined,
        isDev: false,
      })
    ).toThrow('Production variant mismatch');
  });

  it('rejects unsupported source values instead of silently selecting a product', () => {
    expect(() =>
      resolveAppVariant({ expoProduct: 'other-product', publicVariant: undefined, isDev: true })
    ).toThrow('Unsupported expoConfig.extra.product');
    expect(() =>
      resolveAppVariant({ expoProduct: undefined, publicVariant: 'other', isDev: true })
    ).toThrow('Unsupported EXPO_PUBLIC_APP_VARIANT');
  });
});
