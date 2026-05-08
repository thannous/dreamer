function renderSharedComponentStyles() {
  return [
    '    <style>',
    '      .noctalia-premium-nav { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }',
    '      .noctalia-premium-nav.py-2 { background: rgba(10, 5, 20, 0.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24); }',
    '      .noctalia-premium-nav-inner { width: 100%; max-width: 1720px; margin: 0 auto; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: clamp(1rem, 3vw, 3.5rem); }',
    '      .noctalia-premium-links { justify-content: center; flex-wrap: nowrap; gap: clamp(1.4rem, 3.4vw, 4rem); min-width: 0; }',
    '      .noctalia-premium-nav-actions { justify-content: flex-end; }',
    '      .noctalia-premium-action { display: inline-flex; }',
    '      .noctalia-premium-download { display: inline-flex; align-items: center; justify-content: center; color: rgba(237, 225, 255, 0.86); background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); }',
    '      .noctalia-premium-download:hover { color: #fff; background: rgba(255, 255, 255, 0.10); border-color: rgba(253, 164, 129, 0.35); }',
    '      .mobile-menu-surface { background: #120720 !important; border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42); backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
    '      .site-footer { position: relative; z-index: 2; background: #05020a !important; }',
    '      .site-footer > .grid { position: relative; z-index: 1; }',
    '      @media (max-width: 1100px) { .noctalia-premium-download, .noctalia-premium-about { display: none; } .noctalia-premium-links { gap: clamp(1rem, 2.5vw, 2rem); } }',
    '      @media (max-width: 860px) { .noctalia-premium-nav-inner { display: flex; justify-content: space-between; } .noctalia-premium-nav-actions { margin-left: auto; } .noctalia-premium-links { display: none; } #navMobileGuideLink, #mobileMenuButton { display: inline-flex; } }',
    '      @media (max-width: 767px) { .site-footer { padding: 2rem 1rem 1.75rem !important; } .site-footer > .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem 1rem; margin-bottom: 2rem; } .site-footer > .grid > :first-child { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.45rem 1rem; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); } .site-footer > .grid > :first-child > a { grid-column: 1; grid-row: 1; margin-bottom: 0; } .site-footer > .grid > :first-child > p { grid-column: 1; grid-row: 2; margin-bottom: 0; max-width: 17rem; } .site-footer > .grid > :first-child > div.flex { grid-column: 2; grid-row: 1 / span 2; gap: 0.45rem; } .site-footer > .grid > :first-child > div.flex a { width: 2.35rem; height: 2.35rem; } .site-footer h5 { margin-bottom: 0.65rem; font-size: 0.76rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255, 247, 240, 0.92); } .site-footer ul { font-size: 0.82rem; line-height: 1.35; } .site-footer li + li { margin-top: 0.45rem; } .site-footer > .border-t:last-child { padding-top: 1rem; } }',
    '      @media (max-width: 520px) { .noctalia-premium-nav-inner { padding-left: 1rem; padding-right: 1rem; } .noctalia-premium-brand-text { font-size: 1.35rem; } #navMobileGuideLink { display: none; } }',
    '    </style>',
  ].join('\n');
}

module.exports = {
  renderSharedComponentStyles,
};
