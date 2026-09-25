/** Continuous hero backdrop, synchronized with the opening film. */
function createSkyMotion(doc, shared, media) {
      const win = doc.defaultView;
      const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
      let raf = 0, last = 0, introStart = null, intro = 0;
      let scroll = 0, target = 0, height = win.innerHeight, range = 1, top = 0;
      const clamp = (value) => Math.max(0, Math.min(1, value));
      const blocked = () => win.__EXP_TIER__ === 'static' || reduced.matches || doc.hidden || doc.querySelector('.oh-intro-overlay') || doc.documentElement.classList.contains('exp-intro-pending');
      const schedule = () => {
        if (!raf && !blocked()) raf = win.requestAnimationFrame(tick);
      };
      function tick(now) {
        raf = 0;
        if (blocked()) { last = 0; return; }
        const dt = last ? Math.min(50, now - last) : 16;
        last = now;
        let growing = false;
        if (introStart !== null) {
          const t = clamp((now - introStart) / 2000);
          // Zero speed and acceleration at both ends of the opening move.
          intro = t * t * t * (t * (6 * t - 15) + 10);
          growing = t < 1;
          if (!growing) {
            introStart = null;
            doc.documentElement.classList.remove('oh-sky-expanding');
          }
        }
        scroll += (target - scroll) * (1 - Math.exp(-dt / 140));
        if (Math.abs(target - scroll) < 0.0001) scroll = target;
        // A single transform owns the opening zoom and scroll parallax.
        const scale = 1 + 0.10 * intro + 0.18 * scroll;
        media.style.transform = `translate3d(0, ${(-height * 0.04 * scroll).toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
        if (growing || scroll !== target) schedule();
        else last = 0;
      }
      const onScroll = () => {
        target = clamp((win.scrollY - top) / range);
        schedule();
      };
      const refresh = () => {
        height = win.innerHeight;
        top = shared.getBoundingClientRect().top + win.scrollY;
        range = Math.max(1, shared.offsetHeight - height);
        onScroll();
      };
      const reset = () => {
        win.cancelAnimationFrame(raf);
        raf = 0; last = 0; introStart = null; intro = 0; scroll = 0;
        media.style.transform = 'translate3d(0, 0, 0) scale(1)';
        doc.documentElement.classList.remove('oh-sky-expanding');
      };
      const onPreference = () => { reset(); refresh(); };
      win.addEventListener('scroll', onScroll, { passive: true });
      win.addEventListener('resize', refresh, { passive: true });
      doc.addEventListener('visibilitychange', refresh);
      reduced.addEventListener('change', onPreference);
      refresh();
      return {
        refresh,
        reset,
        expand() {
          if (win.__EXP_TIER__ === 'static' || reduced.matches) return;
          introStart = win.performance.now();
          doc.documentElement.classList.add('oh-sky-expanding');
          schedule();
        },
        destroy() {
          reset();
          win.removeEventListener('scroll', onScroll);
          win.removeEventListener('resize', refresh);
          doc.removeEventListener('visibilitychange', refresh);
          reduced.removeEventListener('change', onPreference);
        }
      };
    }

export function initSharedSky() {
  const doc = document;
  const main = doc.querySelector('.noctalia-observatory');
  const header = main?.querySelector(':scope > header');
  const dreams = main?.querySelector('.oh-dreams');
  if (!header || !dreams) return;
  const shared = doc.createElement('div');
  shared.className = 'oh-shared-sky';
  shared.setAttribute('aria-hidden', 'true');
  const poster = doc.createElement('div');
  poster.className = 'oh-sky-poster';
  const media = doc.createElement('div');
  media.className = 'oh-sky-media';
  poster.append(media);
  shared.append(poster);
  main.prepend(shared);
  main.classList.add('oh-has-shared-sky');
  const motion = createSkyMotion(doc, shared, media);
  const placeFilm = () => {
    const film = main.querySelector('.oh-hero-film');
    if (film && film.parentElement !== media) media.prepend(film);
    shared.style.height = `${dreams.offsetTop + dreams.offsetHeight}px`;
    motion.refresh();
  };
  const observer = new MutationObserver((records) => {
    placeFilm();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.classList?.contains('oh-intro-overlay')) motion.reset();
      }
      for (const node of record.removedNodes) {
        if (node.classList?.contains('oh-intro-overlay')) {
          if (!node.classList.contains('is-cut')) motion.expand();
          else motion.refresh();
        }
      }
    }
  });
  observer.observe(header, { childList: true });
  observer.observe(doc.body, { childList: true });
  const sizes = new ResizeObserver(placeFilm);
  sizes.observe(header);
  sizes.observe(dreams);
  placeFilm();
}
