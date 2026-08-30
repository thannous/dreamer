// CocoaPods needs modular headers for the Google Sign-In / App Check
// Objective-C pods that AppCheckCore imports as Swift modules.
const { withPodfile } = require('expo/config-plugins');

const GOOGLE_SIGNIN_MODULAR_HEADER_PODS = ['GoogleUtilities', 'RecaptchaInterop'];

function podDeclaration(podName) {
  return `pod '${podName}', :modular_headers => true`;
}

function applyLucidGoogleSignInModularHeaders(contents) {
  const source = String(contents);
  const missing = GOOGLE_SIGNIN_MODULAR_HEADER_PODS.filter(
    (podName) => !source.includes(podDeclaration(podName))
  );

  if (missing.length === 0) {
    return source;
  }

  const targetBlock = /^(\s*)use_expo_modules!\s*$/m;
  if (!targetBlock.exec(source)) {
    throw new Error(
      'Unable to locate use_expo_modules! in the iOS Podfile for Google Sign-In modular headers.'
    );
  }

  return source.replace(targetBlock, (line, indent) => {
    const insertion = missing
      .map((podName) => `${indent}${podDeclaration(podName)}`)
      .join('\n');
    return `${line}\n${insertion}`;
  });
}

module.exports = function withLucidGoogleSignInModularHeaders(config) {
  return withPodfile(config, (nextConfig) => {
    nextConfig.modResults.contents = applyLucidGoogleSignInModularHeaders(
      nextConfig.modResults.contents
    );
    return nextConfig;
  });
};

module.exports.GOOGLE_SIGNIN_MODULAR_HEADER_PODS = GOOGLE_SIGNIN_MODULAR_HEADER_PODS;
module.exports.applyLucidGoogleSignInModularHeaders =
  applyLucidGoogleSignInModularHeaders;
