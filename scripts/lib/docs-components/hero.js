const { escapeHtml } = require('../docs-source-utils');

function renderHeroActions(actions = []) {
  return actions
    .map((action) => {
      const variant = action.variant === 'secondary' ? 'secondary' : 'primary';
      const className = variant === 'secondary'
        ? 'inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-purple-100 hover:bg-white/10 transition-colors'
        : 'inline-flex items-center justify-center gap-2 rounded-full bg-dream-salmon px-6 py-3 text-sm font-bold text-dream-dark hover:bg-dream-salmon/90 transition-colors';
      const icon = action.icon ? ` <i data-lucide="${escapeHtml(action.icon)}" class="w-4 h-4"></i>` : '';
      const target = action.target ? ` target="${escapeHtml(action.target)}"` : '';
      const rel = action.rel ? ` rel="${escapeHtml(action.rel)}"` : '';
      return `                <a href="${escapeHtml(action.href)}" class="${className}"${target}${rel}>${escapeHtml(action.label)}${icon}</a>`;
    })
    .join('\n');
}

function renderPageHero(context) {
  const { meta } = context;
  const hero = meta.hero;

  if (meta.layout === 'landing' || !hero) return '';

  const eyebrow = hero.eyebrow
    ? `            <p class="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-dream-salmon">${escapeHtml(hero.eyebrow)}</p>`
    : '';
  const subtitle = hero.subtitle
    ? `            <p class="mx-auto mt-6 max-w-3xl text-lg leading-8 text-purple-100/75">${escapeHtml(hero.subtitle)}</p>`
    : '';
  const actions = Array.isArray(hero.ctas) && hero.ctas.length > 0
    ? [
      '            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">',
      renderHeroActions(hero.ctas),
      '            </div>',
    ].join('\n')
    : '';
  const extraClass = hero.variant ? ` page-hero-${escapeHtml(hero.variant)}` : '';

  return [
    `    <section class="page-hero${extraClass} px-6 pb-16 pt-32 text-center">`,
    '        <div class="mx-auto max-w-5xl">',
    eyebrow,
    `            <h1 class="font-serif text-4xl font-light leading-tight text-dream-cream md:text-6xl">${escapeHtml(hero.title || meta.title)}</h1>`,
    subtitle,
    actions,
    '        </div>',
    '    </section>',
  ].filter(Boolean).join('\n');
}

module.exports = {
  renderPageHero,
};
