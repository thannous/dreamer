import { Asset } from 'expo-asset';

/** The text of a bundled asset, served next to the web app (and precached by its service worker). */
export async function readSymbolContentAsset(source: number): Promise<string> {
  const response = await fetch(Asset.fromModule(source).uri);
  if (!response.ok) throw new Error(`Symbol content returned ${response.status}`);
  return response.text();
}
