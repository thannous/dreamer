const VIEW_TRANSITION_MARKER = '@view-transition';

function renderViewTransitionHeadStyles() {
  return [
    '    <style>',
    '      /* @view-transition: cross-document transitions stay disabled. When a',
    '         transition aborts (fast navigation, reload race), Chrome can leave the',
    '         old/new snapshots stuck in plus-lighter blending, washing the whole',
    '         page out to white. Re-enable only when that behavior is fixed. */',
    '      @media (prefers-reduced-motion: reduce) {',
    '        ::view-transition-group(*),',
    '        ::view-transition-old(*),',
    '        ::view-transition-new(*) {',
    '          animation: none !important;',
    '        }',
    '      }',
    '    </style>',
  ].join('\n');
}

function injectViewTransitionHeadStyles(html) {
  if (html.includes(VIEW_TRANSITION_MARKER)) {
    return html;
  }

  const styleBlock = `${renderViewTransitionHeadStyles()}\n`;
  const stylesheetPattern =
    /(<link rel="stylesheet" href="\/css\/(?:language-dropdown|styles\.min)\.css\?v=[^"]+">\s*)/i;

  if (!stylesheetPattern.test(html)) {
    throw new Error('Missing stylesheet anchor for view transition styles');
  }

  stylesheetPattern.lastIndex = 0;
  return html.replace(stylesheetPattern, `$1${styleBlock}`);
}

module.exports = {
  injectViewTransitionHeadStyles,
  renderViewTransitionHeadStyles,
};
