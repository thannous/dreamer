import { isSymbolAtlas, type SymbolAtlas } from '@/lib/symbolAtlas';

// Web keeps the bundled copy, like the symbol texts: a cross-origin fetch to noctalia.app
// would need CORS headers. The paintings themselves load from the site as images.
import atlasJson from '@/data/app/symbol-atlas.json';

const atlas: SymbolAtlas | undefined = isSymbolAtlas(atlasJson) ? atlasJson : undefined;

export function peekSymbolAtlas(): SymbolAtlas | undefined {
  return atlas;
}

export function subscribeSymbolAtlas(): () => void {
  return () => undefined;
}

export function loadSymbolAtlas(): Promise<SymbolAtlas | undefined> {
  return Promise.resolve(atlas);
}
