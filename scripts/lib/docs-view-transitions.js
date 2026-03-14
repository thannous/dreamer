const VIEW_TRANSITION_MARKER = '@view-transition';

function renderViewTransitionHeadStyles() {
  return [
    '    <style>',
    '      @view-transition {',
    '        navigation: auto;',
    '      }',
    '',
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
