import {
  DREAMER_QA_ANDROID_PACKAGE,
  DREAMER_QA_APP_NAME,
  DREAMER_QA_IOS_BUNDLE_IDENTIFIER,
  DREAMER_QA_SCHEME,
} from '@/app.config';
import { getNoctaliaIdentity } from '@/identity';

const buildAndroidReleaseLocal = require('../../scripts/build-android-release-local.js') as {
  DREAMER_QA_ANDROID_PACKAGE: string;
  PRODUCTION_ANDROID_PACKAGE: string;
};

describe('consumer identity anchors', () => {
  const dreamProduction = getNoctaliaIdentity('dream', 'production');
  const dreamQa = getNoctaliaIdentity('dream', 'qa');

  it('derives Dream QA app.config exports from the identity matrix', () => {
    expect({
      name: DREAMER_QA_APP_NAME,
      androidApplicationId: DREAMER_QA_ANDROID_PACKAGE,
      iosBundleIdentifier: DREAMER_QA_IOS_BUNDLE_IDENTIFIER,
      scheme: DREAMER_QA_SCHEME,
    }).toEqual({
      name: dreamQa.name,
      androidApplicationId: dreamQa.androidApplicationId,
      iosBundleIdentifier: dreamQa.iosBundleIdentifier,
      scheme: dreamQa.scheme,
    });
  });

  it('keeps the local Android release script on the Dream production and QA matrix rows', () => {
    expect(buildAndroidReleaseLocal.PRODUCTION_ANDROID_PACKAGE).toBe(
      dreamProduction.androidApplicationId
    );
    expect(buildAndroidReleaseLocal.DREAMER_QA_ANDROID_PACKAGE).toBe(
      dreamQa.androidApplicationId
    );
  });
});
