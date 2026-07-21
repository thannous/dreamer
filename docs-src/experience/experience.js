/**
 * Noctalia experience layer — adaptive orchestrator for the landing pages.
 *
 * The tier is decided by an inline script in the <head> (see
 * scripts/lib/experience-tier.js) and exposed as `window.__EXP_TIER__`:
 * - "static": do nothing. CSS makes the content visible and provides
 *   scroll-driven reveals where supported. Zero libraries downloaded.
 * - "light": Lenis smooth scroll, IntersectionObserver reveals, simplified
 *   canvas sky (fewer stars, pixel ratio 1).
 * - "full": everything above plus GSAP/ScrollTrigger scenes (vendored,
 *   loaded on demand), Lenis driven by the GSAP ticker, magnetic buttons,
 *   orb pointer parallax, and the full canvas sky.
 *
 * Hard rules enforced here:
 * - nothing heavy loads before the LCP (load event + idle callback);
 * - the sky pauses when the hero leaves the viewport or the tab is hidden;
 * - any failure silently falls back to the static CSS experience.
 */

const html = document.documentElement;
const tier = window.__EXP_TIER__ || html.dataset.expTier || 'static';

const HERO_SELECTOR = '.noctalia-observatory > header';

const STEP_SECTION_SELECTOR = [
  '#how-it-works',
  '#comment-ca-marche',
  '#como-funciona',
  '#so-funktioniert-es',
  '#come-funziona',
].join(',');

const FEATURE_SECTION_SELECTOR = [
  '#features',
  '#fonctionnalites',
  '#caracteristicas',
  '#funktionen',
  '#funzionalita',
].join(',');

const withSuffix = (selectorList, suffix) =>
  selectorList
    .split(',')
    .map((selector) => `${selector.trim()} ${suffix}`)
    .join(',');

const getHeroItems = () => Array.from(document.querySelectorAll('.hero-anim'));
const getRevealItems = () => Array.from(document.querySelectorAll('.reveal'));

const showStaticState = () => {
  getHeroItems().forEach((el) => {
    el.classList.remove('opacity-0');
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.transform = '';
  });

  getRevealItems().forEach((el) => {
    el.classList.add('active');
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.transform = '';
  });
};

const scheduleIdle = (callback) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 2000 });
  } else {
    window.setTimeout(callback, 200);
  }
};

/**
 * Runs `callback` only after the largest contentful paint: the WebGL layer
 * must never sit in the critical rendering path.
 */
const afterLcp = (callback) => {
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    scheduleIdle(callback);
  };

  try {
    const observer = new PerformanceObserver((list) => {
      if (list.getEntries().length > 0) {
        observer.disconnect();
        fire();
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // PerformanceObserver unsupported: the load listener below covers it.
  }

  if (document.readyState === 'complete') {
    window.setTimeout(fire, 0);
  } else {
    window.addEventListener('load', () => window.setTimeout(fire, 0), { once: true });
  }
  window.setTimeout(fire, 4000);
};

const loadScript = (src) => {
  const absoluteSrc = new URL(src, window.location.href).href;
  const existing = Array.from(document.scripts).find((script) => script.src === absoluteSrc);

  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.dynamicAnimation = 'true';
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
};

/* ------------------------------------------------------------------ */
/* Light tier: IO reveals (no GSAP).                                   */
/* ------------------------------------------------------------------ */

const initLightMotion = () => {
  const heroItems = getHeroItems();
  heroItems.forEach((el, index) => {
    el.classList.remove('opacity-0');
    el.style.opacity = '0';
    el.style.visibility = 'visible';
    el.style.transform = 'translate3d(0, 14px, 0)';
    el.style.transition = 'opacity 700ms ease, transform 700ms ease';
    el.style.transitionDelay = `${Math.min(index * 90, 360)}ms`;
  });

  window.requestAnimationFrame(() => {
    heroItems.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0, 0, 0)';
    });
  });

  const revealItems = getRevealItems();
  if (!revealItems.length) return;

  if (!('IntersectionObserver' in window)) {
    showStaticState();
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('active');
        entry.target.style.opacity = '1';
        entry.target.style.visibility = 'visible';
        entry.target.style.transform = 'translate3d(0, 0, 0)';
        activeObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );

  revealItems.forEach((el) => {
    if (el.classList.contains('active')) return;
    el.style.opacity = '0';
    el.style.visibility = 'visible';
    el.style.transform = 'translate3d(0, 18px, 0)';
    el.style.transition = 'opacity 650ms ease, transform 650ms ease';
    observer.observe(el);
  });
};

/* ------------------------------------------------------------------ */
/* Full tier: GSAP scenes (ported from landing-animations.js).         */
/* ------------------------------------------------------------------ */

const initGsapScenes = (gsapLib, ScrollTrigger, lenis) => {
  gsapLib.registerPlugin(ScrollTrigger);
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsapLib.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsapLib.ticker.lagSmoothing(0);
  }

  // Hero intro.
  const heroItems = gsapLib.utils.toArray('.hero-anim');
  if (heroItems.length) {
    gsapLib.set(heroItems, { opacity: 0, visibility: 'visible', y: 16 });
    gsapLib.to(heroItems, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power2.out',
      stagger: 0.12,
      delay: 0.12,
      onComplete: () => {
        heroItems.forEach((el) => {
          el.style.visibility = 'visible';
        });
      },
    });

    gsapLib.fromTo(
      '.noctalia-observatory > header picture',
      { scale: 0.94, opacity: 0.8 },
      { scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.35 }
    );
  }

  // Section reveals.
  gsapLib.utils.toArray('.reveal').forEach((el) => {
    gsapLib.fromTo(
      el,
      { autoAlpha: 0, y: 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: el,
          start: 'top 86%',
          toggleActions: 'play none none none',
          once: true,
        },
      }
    );
  });

  // Steps: staggered scrub reveals. The heading is intentionally NOT pinned:
  // a transparent pinned layer let the phone screenshots slide behind the
  // heading text, which read as a rendering bug.
  const stepSection = document.querySelector(STEP_SECTION_SELECTOR);
  if (stepSection && window.matchMedia('(min-width: 768px)').matches) {
    const galleryItems = gsapLib.utils.toArray(withSuffix(STEP_SECTION_SELECTOR, '[data-step]'));
    if (galleryItems.length) {
      galleryItems.forEach((item, index) => {
        gsapLib.fromTo(
          item,
          { autoAlpha: 0.55, y: 54, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: item,
              start: 'top 88%',
              end: 'bottom 42%',
              scrub: true,
            },
            delay: index * 0.04,
          }
        );
      });
    }
  }

  // Media scrub.
  gsapLib.utils
    .toArray('.noctalia-observatory picture img, .noctalia-observatory [data-phone]')
    .forEach((item) => {
      gsapLib.fromTo(
        item,
        { scale: 0.94, opacity: 0.72 },
        {
          scale: 1,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: item,
            start: 'top 92%',
            end: 'center 48%',
            scrub: true,
          },
        }
      );
    });

  // Card hover physics.
  gsapLib.utils
    .toArray(`${withSuffix(FEATURE_SECTION_SELECTOR, '.glass-panel')}, .noctalia-observatory a.glass-panel`)
    .forEach((card) => {
      card.addEventListener('mouseenter', () => {
        gsapLib.to(card, { y: -6, duration: 0.32, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', () => {
        gsapLib.to(card, { y: 0, duration: 0.32, ease: 'power2.out' });
      });
    });

  window.requestAnimationFrame(() => ScrollTrigger.refresh());
};

/* ------------------------------------------------------------------ */
/* Full tier: magnetic buttons and orb parallax (pointer: fine only).  */
/* ------------------------------------------------------------------ */

const initMagneticButtons = async () => {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const buttons = Array.from(document.querySelectorAll('.hero-cta a'));
  if (!buttons.length) return;

  const { animate } = await import('motion/mini');
  const strength = 14;

  buttons.forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      const rect = button.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * strength;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * strength;
      animate(button, { x, y }, { type: 'spring', stiffness: 250, damping: 18 });
    });
    button.addEventListener('pointerleave', () => {
      animate(button, { x: 0, y: 0 }, { type: 'spring', stiffness: 250, damping: 18 });
    });
  });
};

const initOrbParallax = () => {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const orbs = Array.from(document.querySelectorAll('.orb'));
  if (!orbs.length) return;

  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  document.addEventListener(
    'mousemove',
    (event) => {
      pointerX = event.clientX / window.innerWidth;
      pointerY = event.clientY / window.innerHeight;

      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        orbs.forEach((orb, index) => {
          const speed = (index + 1) * 15;
          orb.style.transform = `translate(${pointerX * speed}px, ${pointerY * speed}px)`;
        });
        pointerFrame = 0;
      });
    },
    { passive: true }
  );
};

/* ------------------------------------------------------------------ */
/* Canvas sky (dynamic import, guarded).                               */
/* ------------------------------------------------------------------ */

const initSky = async (quality) => {
  const heroHeader = document.querySelector(HERO_SELECTOR);
  if (!heroHeader) return null;

  const stage = document.createElement('div');
  stage.className = 'sky-stage';
  stage.setAttribute('aria-hidden', 'true');

  let sky = null;
  try {
    const { createSky } = await import('./sky.js');
    sky = createSky({
      container: stage,
      quality,
      onKill: () => {
        html.classList.remove('exp-sky-on');
        html.classList.add('exp-sky-off');
        stage.remove();
      },
    });
  } catch {
    sky = null;
  }

  if (!sky) {
    stage.remove();
    return null;
  }

  heroHeader.prepend(stage);
  // The stage was detached when the sky measured it: measure again now that
  // it fills the hero.
  sky.resize();
  html.classList.add('exp-sky-on');

  // Pause when the hero leaves the viewport or the tab is hidden.
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (document.hidden) return;
          if (entry.isIntersecting) {
            sky.resume();
          } else {
            sky.pause();
          }
        });
      },
      { threshold: 0.02 }
    );
    heroObserver.observe(heroHeader);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sky.pause();
    } else {
      sky.resume();
    }
  });

  return sky;
};

/* ------------------------------------------------------------------ */
/* Boot.                                                               */
/* ------------------------------------------------------------------ */

const bootStatic = () => {
  html.classList.add('exp-static');
  // The CSS layer makes hero/reveal content visible for this tier. The JS
  // pass below only guards against a stale cached stylesheet.
  window.setTimeout(showStaticState, 1200);
};

const bootEnhanced = async (currentTier) => {
  const isFull = currentTier === 'full';
  const moduleScript = document.querySelector('script[data-animation-module="experience"]');

  try {
    const skyPromise = initSky(isFull ? 'full' : 'light');

    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ autoRaf: !isFull, anchors: true });

    if (!isFull) {
      initLightMotion();
      await skyPromise;
      return;
    }

    const gsapSrc = moduleScript?.dataset.gsapSrc || '/js/gsap.min.js';
    const scrollTriggerSrc = moduleScript?.dataset.scrollTriggerSrc || '/js/ScrollTrigger.min.js';
    await loadScript(gsapSrc);
    await loadScript(scrollTriggerSrc);
    if (!window.gsap || !window.ScrollTrigger) {
      throw new Error('GSAP failed to load');
    }

    initGsapScenes(window.gsap, window.ScrollTrigger, lenis);
    initMagneticButtons();
    initOrbParallax();
    await skyPromise;
  } catch {
    showStaticState();
  }
};

if (tier === 'static') {
  bootStatic();
} else {
  afterLcp(() => {
    bootEnhanced(tier).catch(() => showStaticState());
  });
}

// BFCache: pages restored from the back/forward cache need a refresh, not a
// full re-boot (the tier script has already run again anyway).
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (tier === 'static') {
    showStaticState();
    return;
  }
  if (window.ScrollTrigger) {
    window.ScrollTrigger.refresh(true);
  }
});
