(() => {
  const getHashTarget = (hash = window.location.hash) => {
    if (!hash || hash.length < 2) return null;

    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return document.getElementById(hash.slice(1));
    }
  };

  const scrollToHash = (smooth = false) => {
    const target = getHashTarget();
    if (!target) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const headerOffset = window.innerWidth < 720 ? 84 : 112;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset);

    window.scrollTo({
      top,
      behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const tocLinks = document.querySelectorAll('.toc-link');

    for (const link of tocLinks) {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return;

        const target = getHashTarget(href);
        if (!target) return;

        event.preventDefault();
        window.history.pushState(null, '', href);
        scrollToHash(true);
      });
    }

    if (window.location.hash) {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToHash(false)));

      if (document.fonts?.ready) {
        document.fonts.ready.then(() => scrollToHash(false));
      }
    }
  });

  window.addEventListener('load', () => {
    if (!window.location.hash) return;

    window.setTimeout(() => {
      const target = getHashTarget();
      if (!target) return;

      const distance = Math.abs(target.getBoundingClientRect().top);
      if (distance > window.innerHeight * 0.45) scrollToHash(false);
    }, 80);

    window.setTimeout(() => scrollToHash(false), 360);
  });

  window.addEventListener('hashchange', () => scrollToHash(false));
})();
