import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

/** The text of a bundled asset: embedded in the app, or downloaded with an update. */
export async function readSymbolContentAsset(source: number): Promise<string> {
  const asset = Asset.fromModule(source);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error(`Asset ${asset.name} has no local copy`);
  return new File(asset.localUri).text();
}
