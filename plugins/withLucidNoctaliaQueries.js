// Allow the Lucid Trainer companion to test the narrow Noctalia recording
// deep link on Android 11+ without declaring broad package visibility.
const { withAndroidManifest } = require('expo/config-plugins');

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = function withLucidNoctaliaQueries(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const queryBlocks = asArray(manifest.queries);
    const queryBlock = queryBlocks[0] ?? {};
    const intents = asArray(queryBlock.intent);
    const alreadyDeclared = intents.some((intent) => {
      const hasViewAction = asArray(intent.action).some(
        (action) => action?.$?.['android:name'] === 'android.intent.action.VIEW'
      );
      const hasNoctaliaScheme = asArray(intent.data).some(
        (data) => data?.$?.['android:scheme'] === 'noctalia'
      );
      return hasViewAction && hasNoctaliaScheme;
    });

    if (!alreadyDeclared) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'noctalia' } }],
      });
    }

    queryBlock.intent = intents;
    manifest.queries = queryBlocks.length > 0 ? queryBlocks : [queryBlock];
    return nextConfig;
  });
};
