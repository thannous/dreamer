// Native-only stand-in for `culori` inside Uniwind's runtime (see
// scripts/metro-native-stubs.js). Uniwind reads hex, rgb()/rgba() and
// hsl()/hsla() theme colours and only needs parse, formatHex(8) and
// interpolate. The relative paths bypass culori's exports map; the full
// package still serves the CSS compiler and web.
import { useMode as registerMode } from '../../node_modules/culori/src/modes.js';
import modeHsl from '../../node_modules/culori/src/hsl/definition.js';
import modeRgb from '../../node_modules/culori/src/rgb/definition.js';

// Statements, not exports: tree shaking must keep the registrations.
registerMode(modeRgb);
registerMode(modeHsl);

export { default as parse } from '../../node_modules/culori/src/parse.js';
export { formatHex, formatHex8 } from '../../node_modules/culori/src/formatter.js';
export { interpolate } from '../../node_modules/culori/src/interpolate/interpolate.js';
