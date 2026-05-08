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
    '      @media (max-width: 1100px) { .noctalia-premium-download, .noctalia-premium-about { display: none; } .noctalia-premium-links { gap: clamp(1rem, 2.5vw, 2rem); } }',
    '      @media (max-width: 860px) { .noctalia-premium-nav-inner { display: flex; justify-content: space-between; } .noctalia-premium-nav-actions { margin-left: auto; } .noctalia-premium-links { display: none; } #navMobileGuideLink, #mobileMenuButton { display: inline-flex; } }',
    '      @media (max-width: 520px) { .noctalia-premium-nav-inner { padding-left: 1rem; padding-right: 1rem; } .noctalia-premium-brand-text { font-size: 1.35rem; } #navMobileGuideLink { display: none; } }',
    '    </style>',
  ].join('\n');
}

module.exports = {
  renderSharedComponentStyles,
};
