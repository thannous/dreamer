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

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
// easeOutCubic: the restrained curve for the cinematic hero sequence.
const EASE_FILM = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const WORD_STAGGER_MS = 85;
const HEADLINE_LEAD_MS = 450;

const getHeroItems = () => Array.from(document.querySelectorAll('.hero-anim:not(.oh-hero-title)'));
const getHeadline = () => document.querySelector('.oh-hero-title');
const getRevealItems = () => Array.from(document.querySelectorAll('.reveal'));
const getFeatureMedia = () => Array.from(document.querySelectorAll('.oh-feature-media'));

const showStaticState = () => {
  getFeatureMedia().forEach((el) => el.classList.add('is-inview'));
  getHeadline()?.classList.add('is-revealed');

  Array.from(document.querySelectorAll('.hero-anim')).forEach((el) => {
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
/* Headline: per-word focus pull (full & light tiers).                 */
/* ------------------------------------------------------------------ */

/**
 * Wraps each word of the headline in `.oh-word` so it can rise out of a
 * soft blur, one word after another, like a dream coming back. Spaces stay
 * as text nodes so wrapping, balancing and the accessible name are intact.
 */
const revealHeadline = () => {
  const headline = getHeadline();
  if (!headline) return;
  const walker = document.createTreeWalker(headline, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  let index = 0;
  textNodes.forEach((node) => {
    const parts = node.textContent.split(/(\s+)/);
    if (!parts.some((part) => part.trim())) return;
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (!part.trim()) {
        fragment.append(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'oh-word';
      word.textContent = part;
      word.style.transitionDelay = `${index * WORD_STAGGER_MS}ms`;
      index += 1;
      fragment.append(word);
    });
    node.replaceWith(fragment);
  });

  html.classList.add('exp-words');
  // Two frames: the collapsed state must be committed before it transitions.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => headline.classList.add('is-revealed'));
  });
};

/* ------------------------------------------------------------------ */
/* Light tier: IO reveals (no GSAP).                                   */
/* ------------------------------------------------------------------ */

const initLightMotion = (heroReady) => {
  const heroItems = getHeroItems();
  heroItems.forEach((el, index) => {
    el.classList.remove('opacity-0');
    el.style.opacity = '0';
    el.style.visibility = 'visible';
    el.style.transform = 'translate3d(0, 14px, 0)';
    el.style.transition = `opacity 900ms ${EASE_FILM}, transform 900ms ${EASE_FILM}`;
    el.style.transitionDelay = `${HEADLINE_LEAD_MS + index * 120}ms`;
  });

  heroReady.then(() => {
    revealHeadline();
    window.requestAnimationFrame(() => {
      heroItems.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'translate3d(0, 0, 0)';
      });
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
      let batchIndex = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // Siblings entering together cascade instead of landing at once.
        entry.target.style.transitionDelay = `${Math.min(batchIndex * 80, 320)}ms`;
        batchIndex += 1;
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
    el.style.transition = `opacity 650ms ${EASE_OUT}, transform 650ms ${EASE_OUT}`;
    observer.observe(el);
  });
};

/* ------------------------------------------------------------------ */
/* Feature illustrations: one-shot bar entrance (full & light tiers).  */
/* ------------------------------------------------------------------ */

const initFeatureMedia = () => {
  const media = getFeatureMedia();
  if (!media.length) return;
  if (!('IntersectionObserver' in window)) {
    media.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  media.forEach((el) => {
    // Already on screen when the layer boots: show it settled, never shrink it.
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-inview');
    Array.from(el.querySelectorAll('rect')).forEach((bar, index) => {
      bar.style.transitionDelay = `${Math.min(index * 30, 540)}ms`;
    });
  });
  html.classList.add('exp-motion');

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        activeObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -15% 0px', threshold: 0.6 }
  );
  media.forEach((el) => observer.observe(el));
};

/* ------------------------------------------------------------------ */
/* Full tier: GSAP scenes (ported from landing-animations.js).         */
/* ------------------------------------------------------------------ */

const initGsapScenes = (gsapLib, ScrollTrigger, lenis, heroReady) => {
  gsapLib.registerPlugin(ScrollTrigger);
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsapLib.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsapLib.ticker.lagSmoothing(0);
  }

  // Hero sequence: the headline surfaces word by word, then the supporting
  // copy and the product shot follow on the same restrained curve
  // (GSAP power2.out is the cubic ease-out used by EASE_FILM).
  const heroItems = getHeroItems();
  gsapLib.set(heroItems, { opacity: 0, visibility: 'visible', y: 16 });
  heroReady.then(() => {
    revealHeadline();
    gsapLib.to(heroItems, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power2.out',
      stagger: 0.12,
      delay: HEADLINE_LEAD_MS / 1000,
      onComplete: () => {
        heroItems.forEach((el) => {
          el.style.visibility = 'visible';
        });
      },
    });

    gsapLib.fromTo(
      '.noctalia-observatory > header picture',
      { scale: 0.94, opacity: 0.8 },
      { scale: 1, opacity: 1, duration: 1.4, ease: 'power2.out', delay: 0.8 }
    );
  });

  // Dream fragments drift at their own depth while the steps scroll past,
  // then dissolve as the page wakes up. Transform and opacity only.
  const fragmentsHost = document.querySelector(STEP_SECTION_SELECTOR);
  gsapLib.utils.toArray('.oh-fragment').forEach((fragment) => {
    const depth = Number(fragment.dataset.depth || 1);
    gsapLib.fromTo(
      fragment,
      { y: 90 * depth },
      {
        y: -90 * depth,
        ease: 'none',
        scrollTrigger: { trigger: fragmentsHost, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
    gsapLib.to(fragment, {
      opacity: 0,
      scale: 1.35,
      ease: 'none',
      scrollTrigger: { trigger: fragmentsHost, start: 'bottom 75%', end: 'bottom 15%', scrub: true },
    });
  });

  // Section reveals: elements entering together cascade 80ms apart; section
  // heads also pull focus. `.active` drives the CSS hairline draws.
  const isHead = (el) => el.matches('.oh-section-head, .oh-pricing-head');
  const revealItems = gsapLib.utils.toArray('.reveal');
  gsapLib.set(revealItems, { autoAlpha: 0, y: 24 });
  ScrollTrigger.batch(revealItems, {
    start: 'top 86%',
    once: true,
    onEnter: (batch) => {
      batch.forEach((el) => el.classList.add('active'));
      gsapLib.fromTo(
        batch,
        { autoAlpha: 0, y: 24, filter: (i, el) => (isHead(el) ? 'blur(6px)' : 'blur(0px)') },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1,
          ease: 'power2.out',
          stagger: 0.08,
          clearProps: 'filter',
        }
      );
    },
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
/* One night: chapters, dawn, dream fragments, constellation, ending.  */
/* ------------------------------------------------------------------ */

const CHAPTER_SELECTORS = [
  ['dream', `${HERO_SELECTOR}, ${STEP_SECTION_SELECTOR}`],
  ['waking', FEATURE_SECTION_SELECTOR],
  ['understanding', '#symbols, #symboles, #simbolos, #traumsymbole, #simboli, .oh-section[aria-labelledby]'],
  ['remembering', '.oh-section:not([aria-labelledby])'],
  ['ending', '.oh-ending'],
];

/** Tracks which chapter crosses the middle of the viewport. CSS turns the
 * chapter into a slow ink-to-dawn tint; nothing is scroll-scrubbed here. */
const initChapters = () => {
  if (!('IntersectionObserver' in window)) return;
  const main = document.querySelector('.noctalia-observatory');
  if (!main) return;
  const dawn = document.createElement('div');
  dawn.className = 'oh-dawn';
  dawn.setAttribute('aria-hidden', 'true');
  main.prepend(dawn);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) html.dataset.chapter = entry.target.dataset.nightChapter;
      });
    },
    { rootMargin: '-50% 0px -50% 0px' }
  );
  CHAPTER_SELECTORS.forEach(([chapter, selector]) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.nightChapter) return;
      el.dataset.nightChapter = chapter;
      observer.observe(el);
    });
  });
  html.dataset.chapter = 'dream';
};

const FRAGMENTS = [
  // [left %, top %, size rem, kind, depth]
  [3, 24, 0.35, 'star', 1.4],
  [84, 6, 7, 'wisp', 0.6],
  [96, 38, 0.3, 'star', 1.8],
  [10, 52, 9, 'orb', 0.5],
  [94, 66, 0.4, 'star', 1.1],
  [1, 82, 6, 'wisp', 0.9],
  [97, 92, 0.3, 'star', 1.6],
];

const initFragments = () => {
  const host = document.querySelector(STEP_SECTION_SELECTOR);
  if (!host) return;
  const layer = document.createElement('div');
  layer.className = 'oh-fragments';
  layer.setAttribute('aria-hidden', 'true');
  FRAGMENTS.forEach(([left, top, size, kind, depth]) => {
    const fragment = document.createElement('span');
    fragment.className = `oh-fragment oh-fragment--${kind}`;
    fragment.dataset.depth = String(depth);
    fragment.style.left = `${left}%`;
    fragment.style.top = `${top}%`;
    fragment.style.width = `${size}rem`;
    fragment.style.height = `${size}rem`;
    layer.append(fragment);
  });
  host.prepend(layer);
};

// Pairs of symbol indexes joined by a line: a loose chain across the grid.
const CONSTELLATION = [0, 5, 2, 7, 11, 14, 9, 12, 8];

/** Links a few symbols with hairlines that draw in once, like a constellation
 * found in the night sky. Recomputed on resize without replaying. */
const initConstellation = () => {
  const grid = document.querySelector('.oh-symbols');
  if (!grid || !('IntersectionObserver' in window)) return;
  const names = Array.from(grid.querySelectorAll('.oh-symbol-name'));
  if (names.length < 10) return;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'oh-constellation');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('pathLength', '1');
  svg.append(path);
  grid.prepend(svg);

  const draw = () => {
    const box = grid.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.querySelectorAll('circle').forEach((dot) => dot.remove());
    const points = CONSTELLATION.filter((i) => names[i]).map((i) => {
      const r = names[i].getBoundingClientRect();
      return [r.left - box.left - 10, r.top - box.top + r.height * 0.55];
    });
    path.setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '));
    points.forEach(([x, y], i) => {
      const dot = document.createElementNS(svgNs, 'circle');
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('r', '2.2');
      dot.style.transitionDelay = `${200 + i * 140}ms`;
      svg.append(dot);
    });
  };
  draw();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(draw, 200);
  });
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      svg.classList.add('is-drawn');
      observer.disconnect();
    },
    { threshold: 0.35 }
  ).observe(grid);
};

const INTRO_BASE = '/video/intro/noctalia-intro';
const EYES_OPEN_BASE = '/video/intro/noctalia-eyes-open';

const canPlayFilm = () => {
  if (typeof HTMLVideoElement === 'undefined') return false;
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const createVideo = (base, variant, className) => {
  const video = document.createElement('video');
  video.className = className;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('tabindex', '-1');
  video.setAttribute('aria-hidden', 'true');
  [
    ['webm', 'video/webm; codecs="vp9"'],
    ['mp4', 'video/mp4'],
  ].forEach(([extension, type]) => {
    const source = document.createElement('source');
    source.src = `${base}-${variant}.${extension}`;
    source.type = type;
    video.append(source);
  });
  return video;
};

/** The eyes open onto the app screen: a reversed segment of the intro
 * plays once when the closing section arrives, then dissolves. */
const initEnding = () => {
  const portal = document.querySelector('.oh-ending-portal');
  if (!portal || !canPlayFilm() || !('IntersectionObserver' in window)) return;
  const eye = document.createElement('div');
  eye.className = 'oh-ending-eye';
  const video = createVideo(EYES_OPEN_BASE, '854', 'oh-ending-video');
  video.preload = 'none';
  eye.append(video);
  portal.append(eye);
  const dissolve = () => eye.classList.add('is-done');
  video.addEventListener('ended', dissolve, { once: true });
  video.addEventListener('error', dissolve, { once: true });
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      video.preload = 'auto';
      video.play().then(() => eye.classList.add('is-playing')).catch(dissolve);
    },
    { threshold: 0.5 }
  ).observe(portal);
};

const INTRO_KEY = 'noctalia.intro.v1';
const SKIP_LABELS = {
  en: 'Skip intro',
  fr: 'Passer l’intro',
  es: 'Saltar la intro',
  de: 'Intro überspringen',
  it: 'Salta l’intro',
  pt: 'Pular a intro',
};

const introAlreadySeen = () => {
  try {
    return Boolean(window.localStorage.getItem(INTRO_KEY));
  } catch {
    return true;
  }
};

/**
 * First visit only: a ~4s film pushes into a sleeping eye, the lid closes,
 * stars bloom and it lands on the hero loop's first frame, so the loop takes
 * over with no visible cut. The headline and CTAs are real HTML underneath;
 * Skip, Escape, scrolling or a slow network end the intro at once.
 */
const playIntro = (heroHeader, film, loop, variant) =>
  new Promise((resolve) => {
    const intro = createVideo(INTRO_BASE, variant, 'oh-intro-video');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'oh-intro-skip';
    skip.textContent = SKIP_LABELS[(html.lang || 'en').slice(0, 2).toLowerCase()] || SKIP_LABELS.en;

    let finished = false;
    const finish = (cut) => {
      if (finished) return;
      finished = true;
      skip.remove();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
      loop.currentTime = 0;
      if (cut) {
        intro.classList.add('is-leaving');
        window.setTimeout(() => intro.remove(), 700);
      } else {
        intro.remove();
      }
      resolve();
    };
    const onScroll = () => {
      if (window.scrollY > 80) finish(true);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(true);
    };

    intro.addEventListener('playing', () => {
      try {
        window.localStorage.setItem(INTRO_KEY, String(Date.now()));
      } catch {
        // Storage blocked: the intro may replay, which is harmless.
      }
      film.classList.add('is-intro', 'is-playing');
      heroHeader.append(skip);
    }, { once: true });
    intro.addEventListener('ended', () => finish(false), { once: true });
    intro.addEventListener('error', () => finish(true), { once: true });
    skip.addEventListener('click', () => finish(true));
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    // Never make a slow connection wait for the film.
    window.setTimeout(() => {
      if (intro.paused) finish(true);
    }, 2500);

    film.append(intro);
    intro.play().catch(() => finish(true));
  });

/* ------------------------------------------------------------------ */
/* Hero film (full & light tiers).                                     */
/* ------------------------------------------------------------------ */

const FILM_BASE = '/video/hero/noctalia-dream-loop';

/**
 * A muted, looping clip rendered from the hero still, so its first frame is
 * the poster the page already painted: once it plays, it crossfades in over
 * the still with no visible cut. Injected after the LCP, never on the static
 * tier (reduced motion, save-data) or slow connections, and paused whenever
 * the hero is off screen or the tab is hidden. On a first visit the intro
 * film plays in the same layer first. Resolves when the hero headline may
 * reveal.
 */
const initFilm = (isFull) => {
  const heroHeader = document.querySelector(HERO_SELECTOR);
  if (!heroHeader || !canPlayFilm()) return Promise.resolve();

  const wide = isFull && window.matchMedia('(min-width: 900px)').matches;
  const film = document.createElement('div');
  film.className = 'oh-hero-film';
  film.setAttribute('aria-hidden', 'true');
  const video = createVideo(FILM_BASE, wide ? '1280' : '854', 'oh-hero-loop');
  video.loop = true;
  film.append(video);

  let started = false;
  const remove = () => {
    video.pause();
    film.remove();
  };
  video.addEventListener('playing', () => film.classList.add('is-playing'), { once: true });
  video.addEventListener('error', remove, { once: true });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (event) => {
    if (event.matches) remove();
  });

  heroHeader.prepend(film);
  let heroVisible = true;
  const sync = () => {
    if (!film.isConnected || !started) return;
    if (heroVisible && !document.hidden) {
      video.play().catch(remove);
    } else {
      video.pause();
    }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        heroVisible = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.02 }
    ).observe(heroHeader);
  }
  document.addEventListener('visibilitychange', sync);

  const startLoop = () => {
    started = true;
    sync();
  };
  if (introAlreadySeen() || window.scrollY > 80) {
    startLoop();
    return Promise.resolve();
  }
  return playIntro(heroHeader, film, video, wide ? '1280' : '540x960').then(startLoop);
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
    const heroReady = initFilm(isFull);
    initFeatureMedia();
    initChapters();
    initFragments();
    initConstellation();
    initEnding();

    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ autoRaf: !isFull, anchors: true });

    if (!isFull) {
      initLightMotion(heroReady);
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

    initGsapScenes(window.gsap, window.ScrollTrigger, lenis, heroReady);
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
