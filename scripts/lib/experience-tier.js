/**
 * Experience tier detection for the landing pages.
 *
 * `computeTier` is serialized verbatim into an inline <script> in the <head>
 * (see renderTierInlineScript), so it must stay a self-contained plain
 * function: no closure references, no require, no modern syntax that would
 * break on the old browsers that legitimately land on the "static" tier.
 *
 * Tiers:
 * - "static": reduced motion, save-data, or very weak hardware. No JS
 *   experience layer at all, CSS fallbacks only.
 * - "light": mobile / older laptops. Simplified canvas sky, simple reveals.
 * - "full": recent desktops. Full canvas sky, Lenis + GSAP scenes.
 */
/* eslint-disable no-var -- serialized verbatim into an inline <script> that
   must run on the oldest browsers we still serve (static tier). */
function computeTier(env) {
  // Missing hardwareConcurrency is treated as weak hardware (conservative).
  var cores = typeof env.cores === 'number' && isFinite(env.cores) ? env.cores : 2;
  // deviceMemory is Chrome-only: when unknown it must not disqualify
  // Firefox/Safari desktops from the full tier.
  var ramKnown = typeof env.ram === 'number' && isFinite(env.ram);
  var ram = ramKnown ? env.ram : 4;
  var coarse = Boolean(env.coarse);
  var reducedMotion = Boolean(env.reducedMotion);
  var saveData = Boolean(env.saveData);

  if (reducedMotion || saveData || cores <= 2 || (coarse && ramKnown && ram <= 2)) {
    return 'static';
  }

  if (!coarse && cores >= 8 && (!ramKnown || ram >= 8)) {
    return 'full';
  }

  return 'light';
}

/**
 * Returns the inline <script> injected in the <head> of landing pages.
 * Runs synchronously before first paint so CSS can react to
 * `html[data-exp-tier]` without a flash of animated content.
 */
function renderTierInlineScript() {
  return [
    '    <script>',
    '      (function () {',
    `        var computeTier = ${computeTier.toString()};`,
    '        var env = {',
    '          cores: navigator.hardwareConcurrency,',
    '          ram: navigator.deviceMemory,',
    "          coarse: window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false,",
    "          reducedMotion: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,",
    '          saveData: Boolean(navigator.connection && navigator.connection.saveData),',
    '        };',
    '        var tier = computeTier(env);',
    "        document.documentElement.dataset.expTier = tier;",
    '        window.__EXP_TIER__ = tier;',
    '      })();',
    '    </script>',
  ].join('\n');
}

module.exports = {
  computeTier,
  renderTierInlineScript,
};
