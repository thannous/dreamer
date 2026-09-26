import { initStarmapSteps } from './starmap-steps.js';
import { initDreamJourney } from './dream-journey.js';
import { initDreamHeadings } from './dream-headings.js';
import { attachDreamDrag } from './dream-drag.js';
import { initSharedSky } from './shared-sky.js';

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

const revealDreamsAfterIntro = () => {
  window.clearTimeout(window.__expIntroGateTimer);
  html.classList.remove('exp-intro-pending');
};

const holdDreamsForIntro = () => {
  html.classList.add('exp-intro-pending');
  window.clearTimeout(window.__expIntroGateTimer);
  window.__expIntroGateTimer = window.setTimeout(revealDreamsAfterIntro, 9000);
};

const showStaticState = () => {
  revealDreamsAfterIntro();
  html.classList.remove('exp-starmap');
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
  if (!headline || headline.querySelector('.oh-word')) return;
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

    gsapLib.ticker.lagSmoothing(0);
  }

  // Hero sequence: the headline surfaces word by word, then the supporting
  // copy follows on the same restrained curve
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (t) => t * t * (3 - 2 * t);
let activeLenis = null;

/* Dawn: one fixed layer whose opacity follows the night's progress, from
 * ink in the dream to a champagne dawn once the page wakes. Opacity only. */
const initDawn = () => {
  const main = document.querySelector('.noctalia-observatory');
  if (!main) return;
  const dawn = document.createElement('div');
  dawn.className = 'oh-dawn';
  dawn.setAttribute('aria-hidden', 'true');
  main.prepend(dawn);
  const stops = [
    ['.oh-dreams', 0, 0.55],
    ['.oh-understand', 0.55, 0.5],
    ['.oh-waking', 1, 0.5],
    ['.oh-remember', 0.8, 0.5],
    ['.oh-ending', 1, 0.5],
  ]
    .map(([selector, value, anchor]) => ({ el: document.querySelector(selector), value, anchor }))
    .filter((stop) => stop.el && !stop.el.classList.contains('oh-journey-source'));
  if (!stops.length) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const mid = window.innerHeight * 0.5;
    const points = stops.map(({ el, value, anchor }) => {
      const rect = el.getBoundingClientRect();
      return { y: rect.top + rect.height * anchor - mid, value };
    });
    let value = points[0].y > 0 ? 0 : points[points.length - 1].value;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (a.y <= 0 && b.y > 0) {
        value = a.value + (b.value - a.value) * smooth(-a.y / (b.y - a.y));
        break;
      }
    }
    dawn.style.opacity = value.toFixed(3);
  };
  const request = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
};

/* ------------------------------------------------------------------ */
/* Dream: the example entries float on a Fibonacci sphere in CSS 3D.   */
/* ------------------------------------------------------------------ */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const initDreamSpace = (journey) => {
  const space = document.querySelector('.oh-dreamspace');
  const list = space?.querySelector('.oh-dream-list');
  if (!space || !list || !CSS.supports('transform-style', 'preserve-3d')) return null;
  const slots = Array.from(list.querySelectorAll('.oh-dream-slot'));
  if (slots.length < 4) return null;
  html.classList.add('exp-3d');

  const vectors = slots.map((slot, i) => {
    const y = 1 - ((i + 0.5) * 2) / slots.length;
    const r = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });

  let radius = 300;
  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cardWidth = w < 700 ? 150 : w < 1100 ? 188 : 214;
    radius = clamp(Math.min(w * 0.46, h * 0.5), 175, 440);
    space.style.setProperty('--card-w', `${cardWidth}px`);
    slots.forEach((slot, i) => {
      const { x, y, z } = vectors[i];
      const yaw = Math.atan2(x, z);
      const pitch = -Math.asin(y);
      slot.style.transform = `rotateY(${yaw.toFixed(4)}rad) rotateX(${pitch.toFixed(4)}rad) translateZ(${radius.toFixed(0)}px)`;
    });
  };
  layout();
  window.addEventListener('resize', layout);

  const state = { drift: 0, dragYaw: 0, dragPitch: 0, velocity: 0, dragging: false, paused: false, visible: false };
  let last = performance.now();
  let raf = 0;
  let fading = false;
  const canAnimate = () => state.visible && !state.paused && !document.hidden && (!journey || journey.cardsActive) && !html.classList.contains('exp-intro-pending');
  const opacities = slots.map(() => -1);

  const tick = (now) => {
    raf = 0;
    if (!canAnimate()) return;
    const dt = Math.min(64, now - last);
    last = now;
    if (!state.dragging) {
      state.drift += dt * 0.00007;
      state.dragYaw += state.velocity;
      state.velocity *= 0.94;
    }
    // The journey already measured scroll geometry this frame.
    const rect = journey ? null : space.getBoundingClientRect();
    const p = journey ? journey.cardsProgress : clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
    const approach = smooth(clamp(p / 0.72, 0, 1));
    const wake = smooth(clamp((p - 0.74) / 0.26, 0, 1));
    const yaw = state.drift + p * Math.PI * 1.1 + state.dragYaw;
    const pitch = 0.16 * Math.sin(state.drift * 0.8) + (p - 0.4) * 0.4 + state.dragPitch;
    const dolly = -radius * 0.85 + approach * radius * 0.95 - wake * radius * 2.6;
    list.style.transform = `translate3d(0, 0, ${dolly.toFixed(1)}px) rotateX(${pitch.toFixed(4)}rad) rotateY(${yaw.toFixed(4)}rad)`;

    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    vectors.forEach((v, i) => {
      const z1 = -v.x * sy + v.z * cy;
      const zc = v.y * sp + z1 * cp;
      const facing = clamp((zc + 0.15) / 1.15, 0, 1);
      const opacity = Math.round((0.28 + 0.72 * facing) * (1 - wake) * 100) / 100;
      if (opacity !== opacities[i]) {
        opacities[i] = opacity;
        slots[i].style.opacity = String(opacity);
        slots[i].classList.toggle('is-back', zc < -0.05);
      }
    });
    if (fading !== (wake > 0.15)) {
      fading = wake > 0.15; space.classList.toggle('is-fading', fading);
    }
    if (canAnimate()) raf = window.requestAnimationFrame(tick);
  };
  const start = () => {
    if (!raf && canAnimate()) {
      last = performance.now();
      raf = window.requestAnimationFrame(tick);
    }
  };
  new IntersectionObserver((entries) => {
    state.visible = entries[0].isIntersecting;
    start();
  }).observe(space.querySelector('.oh-dreamspace-stage'));
  document.addEventListener('visibilitychange', start);
  document.addEventListener('dream-journey-change', start);
  document.addEventListener('dream-sky-visibility-change', start);
  new MutationObserver(start).observe(html, { attributes: true, attributeFilter: ['class'] });

  attachDreamDrag(space.querySelector('.oh-dreamspace-stage'), state, clamp);

  return {
    pause: () => {
      state.paused = true;
    },
    resume: () => {
      state.paused = false;
      start();
    },
  };
};

/* FLIP lightbox: an entry grows from its card into the full page the app
 * would show. Transform and opacity only; Escape or the backdrop closes. */
const initLightbox = (space) => {
  const section = document.querySelector('.oh-dreams');
  if (!section) return;
  let labels = {};
  try {
    labels = JSON.parse(section.dataset.labels || '{}');
  } catch {
    labels = {};
  }
  const buttons = Array.from(section.querySelectorAll('.oh-dream-open'));
  buttons.forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => open(button.closest('.oh-dream'), button));
  });

  const open = (card, trigger) => {
    const img = card.querySelector('.oh-dream-img');
    const overlay = document.createElement('div');
    overlay.className = 'oh-lightbox';
    const titleId = `oh-lightbox-title-${Date.now()}`;
    overlay.innerHTML = `
      <div class="oh-lightbox-backdrop"></div>
      <div class="oh-lightbox-panel" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <img class="oh-lightbox-img" alt="" width="800" height="1000">
        <div class="oh-lightbox-body">
          <p class="oh-dream-meta"></p>
          <h3 class="oh-lightbox-title" id="${titleId}"></h3>
          <p class="oh-lightbox-label"></p>
          <div class="oh-lightbox-transcript"></div>
          <p class="oh-lightbox-label oh-lightbox-label--symbols"></p>
          <ul class="oh-dream-symbols"></ul>
          <p class="oh-lightbox-note"></p>
        </div>
        <button class="oh-lightbox-close" type="button"></button>
      </div>`;
    const panel = overlay.querySelector('.oh-lightbox-panel');
    const full = overlay.querySelector('.oh-lightbox-img');
    full.src = img.currentSrc || img.src;
    const upgrade = new Image();
    upgrade.onload = () => {
      full.src = upgrade.src;
    };
    upgrade.src = img.dataset.full;
    overlay.querySelector('.oh-dream-meta').innerHTML = card.querySelector('.oh-dream-meta').innerHTML;
    overlay.querySelector('.oh-lightbox-title').textContent = card.querySelector('.oh-dream-title').textContent;
    overlay.querySelector('.oh-lightbox-label').textContent = labels.transcript || '';
    const transcript = overlay.querySelector('.oh-lightbox-transcript');
    [card.querySelector('.oh-dream-excerpt'), card.querySelector('.oh-dream-rest')].forEach((source) => {
      const p = document.createElement('p');
      p.textContent = source.textContent;
      transcript.append(p);
    });
    overlay.querySelector('.oh-lightbox-label--symbols').textContent = labels.symbols || '';
    overlay.querySelector('.oh-dream-symbols').innerHTML = card.querySelector('.oh-dream-symbols').innerHTML;
    overlay.querySelector('.oh-lightbox-note').textContent = labels.example || '';
    const close = overlay.querySelector('.oh-lightbox-close');
    close.setAttribute('aria-label', labels.close || 'Close');
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    space?.pause();
    activeLenis?.stop();
    document.documentElement.classList.add('oh-lightbox-open');
    document.dispatchEvent(new Event('dream-dialog-change'));
    document.body.append(overlay);

    const first = card.getBoundingClientRect();
    const lastRect = panel.getBoundingClientRect();
    const invert = () =>
      `translate(${first.left - lastRect.left}px, ${first.top - lastRect.top}px) scale(${first.width / lastRect.width}, ${first.height / lastRect.height})`;
    panel.style.transformOrigin = '0 0';
    panel.style.transform = invert();
    panel.style.opacity = '0.4';
    card.style.visibility = 'hidden';
    panel.getBoundingClientRect();
    overlay.classList.add('is-open');
    panel.style.transition = `transform 280ms ${EASE_FILM}, opacity 200ms ease`;
    panel.style.transform = 'none';
    panel.style.opacity = '1';
    close.focus({ preventScroll: true });

    let closing = false;
    const dismiss = () => {
      if (closing) return;
      closing = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('is-open');
      const back = card.getBoundingClientRect();
      const now = panel.getBoundingClientRect();
      const visible = back.bottom > 0 && back.top < window.innerHeight && back.width > 0;
      panel.style.transition = `transform 180ms ${EASE_FILM}, opacity 180ms ease`;
      panel.style.transform = visible
        ? `translate(${back.left - now.left}px, ${back.top - now.top}px) scale(${back.width / now.width}, ${back.height / now.height})`
        : 'scale(0.94)';
      panel.style.opacity = visible ? '0.6' : '0';
      window.setTimeout(() => {
        card.style.visibility = '';
        overlay.remove();
        document.documentElement.classList.remove('oh-lightbox-open');
        document.dispatchEvent(new Event('dream-dialog-change'));
        activeLenis?.start();
        space?.resume();
        trigger.focus({ preventScroll: true });
      }, 190);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') dismiss();
      if (event.key === 'Tab') {
        event.preventDefault();
        close.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    close.addEventListener('click', dismiss);
    overlay.querySelector('.oh-lightbox-backdrop').addEventListener('click', dismiss);
  };
};

/* Waking: while the section is on screen the waveform breathes, the timer
 * runs and the example transcript appears word by word, once. */
const initWaking = () => {
  const rec = document.querySelector('.oh-rec');
  if (!rec || !('IntersectionObserver' in window)) return;
  const text = rec.querySelector('.oh-rec-text');
  const time = rec.querySelector('.oh-rec-time');
  rec.querySelectorAll('.oh-rec-wave span').forEach((bar, i) => bar.style.setProperty('--i', String(i)));
  const words = text.textContent.trim().split(/\s+/);
  text.textContent = '';
  const spans = words.map((word) => {
    const span = document.createElement('span');
    span.className = 'oh-rec-word';
    span.textContent = `${word} `;
    text.append(span);
    return span;
  });
  let seconds = 14;
  let timer = 0;
  let typed = false;
  new IntersectionObserver(
    (entries) => {
      const live = entries[0].isIntersecting;
      rec.classList.toggle('is-live', live);
      window.clearInterval(timer);
      if (!live) return;
      timer = window.setInterval(() => {
        seconds += 1;
        time.textContent = `00:${String(seconds % 60).padStart(2, '0')}`;
      }, 1000);
      if (typed) return;
      typed = true;
      spans.forEach((span, i) => window.setTimeout(() => span.classList.add('is-in'), 500 + i * 120));
    },
    { threshold: 0.45 }
  ).observe(rec);
};

/* Understanding: a 2D star map of the example dreams. The finished map is
 * the HTML default; here it is rebuilt on scroll. The first dream types out
 * and its symbol words fly into the sky, then each dream lights its stars and
 * draws its lines, which thicken as symbols recur. Transform, opacity and
 * stroke only. */
const initStarmap = (journey) => {
  const root = document.querySelector('.oh-starmap');
  if (!root) return;
  const stars = new Map(Array.from(root.querySelectorAll('.oh-star-item')).map((li) => [Number(li.dataset.sym), li]));
  const initPinning = () => {
    const clear = () => stars.forEach((li) => li.classList.remove('is-pinned'));
    stars.forEach((li) => {
      li.querySelector('.oh-star').addEventListener('click', (event) => {
        event.stopPropagation();
        const pinned = li.classList.contains('is-pinned');
        clear();
        li.classList.toggle('is-pinned', !pinned);
      });
    });
    document.addEventListener('click', clear);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      clear();
      if (root.contains(document.activeElement)) document.activeElement.blur();
    });
  };
  initPinning();
  if (!('IntersectionObserver' in window) || typeof ResizeObserver !== 'function') return;

  html.classList.add('exp-starmap');
  const dreams = Array.from(root.querySelectorAll('.oh-starmap-dream')).map((el) => ({
    el,
    syms: el.dataset.symbols.split(',').map(Number),
  }));
  const links = Array.from(root.querySelectorAll('.oh-link')).map((path) => ({
    path,
    tip: path.nextElementSibling,
    a: Number(path.dataset.a),
    b: Number(path.dataset.b),
    dream: Number(path.dataset.dream),
    drawn: false,
  }));
  const stepLabel = root.querySelector('.oh-starmap-step');
  let step = -1;

  // Dash lengths only follow pathLength without non-scaling strokes, so the
  // staged map draws in real pixels and is re-laid out on resize.
  const svg = root.querySelector('.oh-starmap-lines');
  const segments = [...links.flatMap(({ path, tip }) => [path, tip])].map((el) => ({
    el,
    pts: el.getAttribute('d').match(/[\d.]+/g).map(Number),
  }));
  const layoutLines = () => {
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute('viewBox', `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`);
    segments.forEach(({ el, pts: [x1, y1, x2, y2] }) => {
      el.setAttribute(
        'd',
        `M${((x1 * width) / 100).toFixed(1)} ${((y1 * height) / 100).toFixed(1)} L${((x2 * width) / 100).toFixed(1)} ${((y2 * height) / 100).toFixed(1)}`
      );
    });
  };
  layoutLines();
  new ResizeObserver(layoutLines).observe(svg);

  const setStep = (k, selected = Math.max(0, k - 1)) => {
    const key = `${k}:${selected}`;
    if (key === step) return;
    step = key;
    const counts = new Map();
    dreams.slice(0, k).forEach(({ syms }) => syms.forEach((s) => counts.set(s, (counts.get(s) || 0) + 1)));
    const current = selected;
    const glowing = k > 0 ? dreams[current].syms : [];
    dreams.forEach(({ el }, i) => el.classList.toggle('is-current', i === current));
    stars.forEach((li, sym) => {
      const count = counts.get(sym) || 0;
      li.classList.toggle('is-born', count > 0 || li.classList.contains('is-flown'));
      li.classList.toggle('is-glow', glowing.includes(sym));
      li.style.setProperty('--c', String(Math.max(1, count)));
    });
    links.forEach((link) => {
      const drawn = link.dream < k;
      if (drawn && !link.drawn) {
        link.tip.classList.remove('is-running');
        link.tip.getBoundingClientRect();
        link.tip.classList.add('is-running');
      }
      link.drawn = drawn;
      link.path.classList.toggle('is-drawn', drawn);
      const ca = counts.get(link.a) || 1;
      const cb = counts.get(link.b) || 1;
      link.path.style.setProperty('--w-now', (1 + 0.6 * (ca - 1 + cb - 1)).toFixed(2));
    });
    const label = String(selected + 1);
    if (stepLabel.textContent !== label) stepLabel.textContent = label;
  };

  if (journey) {
    journey.mapCleanup = initStarmapSteps(root, dreams, stars, journey, setStep);
    return;
  }

  // Intro: the first dream's words appear one by one; symbol words underline
  // and fly to their stars.
  const first = dreams[0].el.querySelector('.oh-starmap-text');
  const words = [];
  Array.from(first.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.textContent.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.append(part);
          return;
        }
        const span = document.createElement('span');
        span.className = 'oh-type-word';
        span.textContent = part;
        frag.append(span);
        words.push(span);
      });
      node.replaceWith(frag);
    } else {
      node.classList.add('oh-type-word');
      words.push(node);
    }
  });

  let introStarted = false;
  let introDone = false;
  const timers = [];
  const fly = (mark) => {
    const star = stars.get(Number(mark.dataset.sym));
    if (!star) return;
    const from = mark.getBoundingClientRect();
    const to = star.querySelector('img').getBoundingClientRect();
    const ghost = mark.cloneNode(true);
    ghost.classList.add('oh-sym-ghost');
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px` });
    document.body.append(ghost);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const flight = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 1100, easing: EASE_FILM, fill: 'forwards' }
    );
    flight.onfinish = () => ghost.remove();
    timers.push(
      window.setTimeout(() => {
        star.classList.add('is-flown', 'is-born', 'is-glow');
      }, 800)
    );
  };
  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    timers.forEach((t) => window.clearTimeout(t));
    words.forEach((w) => w.classList.add('is-in'));
    first.querySelectorAll('.oh-sym-word').forEach((mark) => {
      mark.classList.add('is-marked');
      stars.get(Number(mark.dataset.sym))?.classList.add('is-flown');
    });
    step = -1;
    update();
  };
  const startIntro = () => {
    introStarted = true;
    setStep(0);
    let delay = 300;
    words.forEach((word) => {
      timers.push(window.setTimeout(() => word.classList.add('is-in'), delay));
      if (word.classList.contains('oh-sym-word')) {
        timers.push(window.setTimeout(() => word.classList.add('is-marked'), delay + 250));
        timers.push(window.setTimeout(() => fly(word), delay + 700));
        delay += 500;
      }
      delay += 110;
    });
    timers.push(window.setTimeout(finishIntro, delay + 1400));
  };

  const progress = () => {
    if (journey) return journey.mapProgress;
    const rect = root.getBoundingClientRect();
    return clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
  };
  const update = () => {
    const p = progress();
    const rect = root.getBoundingClientRect();
    if (!introStarted) {
      if (journey ? journey.mapActive : rect.top < window.innerHeight * 0.35) startIntro();
      else return setStep(0);
    }
    if (!introDone) {
      if (p > 0.16) finishIntro();
      return undefined;
    }
    return setStep(1 + clamp(Math.floor(((p - 0.14) / 0.76) * 10), 0, 9));
  };
  let frame = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (!frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    },
    { passive: true }
  );
  if (journey) setStep(0);
  update();
};

/* Remembering: the journal cascades in, the emotion lines draw across six
 * weeks and the streak counts up, each once. */
const initRemember = () => {
  const section = document.querySelector('.oh-remember');
  if (!section || !('IntersectionObserver' in window)) return;
  section.querySelectorAll('.oh-timeline-item').forEach((item, i) => item.style.setProperty('--i', String(i)));
  section.querySelectorAll('.oh-regularity span').forEach((cell, i) => cell.style.setProperty('--i', String(i)));
  const onceVisible = (el, run, threshold = 0.35) => {
    if (!el) return;
    new IntersectionObserver(
      (entries, observer) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        run();
      },
      { threshold }
    ).observe(el);
  };
  section.classList.add('is-staged');
  onceVisible(section.querySelector('.oh-journal'), () => section.querySelector('.oh-journal').classList.add('is-in'), 0.2);
  onceVisible(section.querySelector('.oh-chart'), () => section.querySelector('.oh-chart').classList.add('is-drawn'));
  const streak = section.querySelector('.oh-streak');
  onceVisible(streak, () => {
    streak.classList.add('is-in');
    streak.querySelectorAll('.oh-streak-num').forEach((num) => {
      const target = Number(num.textContent);
      const started = performance.now();
      const step = (now) => {
        const t = clamp((now - started) / 1200, 0, 1);
        num.textContent = String(Math.round(target * smooth(t)));
        if (t < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    });
  });
};

const INTRO_BASE = '/video/intro/noctalia-intro';
const EYES_OPEN_BASE = '/video/intro/noctalia-eyes-open';

const canPlayFilm = (allowSlowConnection = false) => {
  if (typeof HTMLVideoElement === 'undefined') return false;
  const connection = navigator.connection;
  if (connection && (connection.saveData || (!allowSlowConnection && /(^|-)2g$/.test(connection.effectiveType || '')))) return false;
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
  const formats = [['mp4', 'video/mp4'], ['webm', 'video/webm; codecs="vp9"']];
  // The existing VP9 intro has the same framing at half the transfer size.
  if (className === 'oh-intro-video') formats.reverse();
  formats.forEach(([extension, type]) => {
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

const SKIP_LABELS = {
  en: 'Skip intro',
  fr: 'Passer l’intro',
  es: 'Saltar la intro',
  de: 'Intro überspringen',
  it: 'Salta l’intro',
  pt: 'Pular a intro',
};

/**
 * On each landing-page visit: a ~4s film pushes into a sleeping eye, the lid closes,
 * stars bloom, then the viewport overlay dissolves onto the page. The
 * headline and CTAs are real HTML underneath;
 * Skip, Escape, scrolling or a slow network end the intro at once.
 */
const waitForFilmFrame = (video, timeoutMs = 1200) => new Promise((resolve) => {
  video.preload = 'auto';
  let frameId;
  let settled = false;
  const done = (ready) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    video.removeEventListener('playing', onPlaying);
    if (frameId !== undefined) video.cancelVideoFrameCallback?.(frameId);
    resolve(ready);
  };
  const onPlaying = () => window.requestAnimationFrame(() => done(true));
  const timeout = window.setTimeout(() => done(false), timeoutMs);
  if (typeof video.requestVideoFrameCallback === 'function') {
    frameId = video.requestVideoFrameCallback(() => done(true));
  } else {
    video.addEventListener('playing', onPlaying, { once: true });
  }
  video.play().catch(() => done(false));
});

const playIntro = (film, loop, variant) =>
  new Promise((resolve) => {
    // Attach to body: the hero's clipping and stacking context must never
    // constrain the opening film to the height of its text content.
    const overlay = document.createElement('div');
    overlay.className = 'oh-intro-overlay';
    const warmed = window.__expIntroVideo;
    window.__expIntroVideo = null;
    const intro = warmed && !warmed.error ? warmed : createVideo(INTRO_BASE, variant, 'oh-intro-video');
    intro.className = 'oh-intro-video';
    intro.setAttribute('muted', '');
    intro.setAttribute('playsinline', '');
    intro.setAttribute('aria-hidden', 'true');
    intro.setAttribute('tabindex', '-1');
    intro.disablePictureInPicture = true;
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'oh-intro-skip';
    skip.textContent = SKIP_LABELS[(html.lang || 'en').slice(0, 2).toLowerCase()] || SKIP_LABELS.en;

    let finished = false;
    let preparedLoop;
    let played = false;
    let slowStartTimer = 0;
    let maximumTimer = 0;
    let playbackRequested = false;
    let firstFrameTimer = 0;
    let playbackAttempt = 0;
    let triedMp4 = false;
    const retryMp4 = () => {
      if (finished || played || triedMp4 || !intro.currentSrc.endsWith('.webm')) return false;
      triedMp4 = true;
      playbackAttempt += 1;
      playbackRequested = false;
      window.clearTimeout(firstFrameTimer);
      // Some WebKit versions download VP9 fully but never decode its first frame.
      // A source change aborts the old play promise; only the new attempt may fail.
      intro.src = `${INTRO_BASE}-${variant}.mp4`;
      intro.load();
      return true;
    };
    const beginPlayback = () => {
      if (finished || playbackRequested || !Number.isFinite(intro.duration)) return;
      // Keep a short reserve: Chrome may otherwise start on a few frames and
      // immediately stop while fonts, scripts and the remaining film arrive.
      for (let i = 0; i < intro.buffered.length; i += 1) {
        if (intro.buffered.start(i) > 0.05 || intro.buffered.end(i) < Math.min(2, intro.duration - 0.05)) continue;
        playbackRequested = true;
        const attempt = ++playbackAttempt;
        firstFrameTimer = window.setTimeout(() => {
          if (!played) retryMp4();
        }, 1200);
        intro.play().catch(() => {
          if (attempt === playbackAttempt && !finished && !retryMp4()) finish(true, true);
        });
        break;
      }
    };
    const prepareLoop = () => {
      if (finished || preparedLoop || !played) return;
      // The opening film owns the bandwidth until it can finish without more
      // data. Preparing both videos at `playing` starves it on slow mobile links.
      if (!Number.isFinite(intro.duration)) return;
      let bufferedToEnd = false;
      for (let i = 0; i < intro.buffered.length; i += 1) {
        if (intro.buffered.start(i) <= intro.currentTime + 0.05 &&
            intro.buffered.end(i) >= intro.duration - 0.05) bufferedToEnd = true;
      }
      if (!bufferedToEnd) return;
      loop.currentTime = 0;
      preparedLoop = waitForFilmFrame(loop, Math.max(1200, (intro.duration - intro.currentTime) * 1000 + 500)).then((ready) => {
        if (!finished) loop.pause();
        return ready;
      });
    };
    const finish = async (cut = false, unavailable = false) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(slowStartTimer);
      window.clearTimeout(maximumTimer);
      window.clearTimeout(firstFrameTimer);
      skip.remove();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
      for (const event of ['progress', 'loadeddata', 'canplaythrough']) intro.removeEventListener(event, beginPlayback);
      intro.removeEventListener('progress', prepareLoop);
      intro.removeEventListener('timeupdate', prepareLoop);
      intro.removeEventListener('canplaythrough', prepareLoop);
      // Decode the loop during the intro, so the handoff never starts
      // with a new seek or a wait on the final frame of the opening film.
      if (!cut && await (preparedLoop || waitForFilmFrame(loop))) {
        film.classList.add('is-handoff', 'is-playing');
        loop.play().catch(() => {});
      }
      if (cut) overlay.classList.add('is-cut');
      overlay.classList.add('is-leaving');
      window.setTimeout(() => {
        intro.pause();
        overlay.remove();
        film.classList.remove('is-handoff');
        revealDreamsAfterIntro();
        resolve({ played, unavailable });
      }, cut ? 280 : 720);
    };
    const onScroll = () => {
      if (window.scrollY > 80) finish(true);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(true);
    };

    intro.addEventListener('playing', () => {
      if (finished) return;
      played = true;
      window.clearTimeout(firstFrameTimer);
      overlay.classList.add('is-playing');
      overlay.append(skip);
      prepareLoop();
    }, { once: true });
    // Demuxing can extend buffered ranges after the final network progress event.
    intro.addEventListener('timeupdate', prepareLoop);
    intro.addEventListener('progress', prepareLoop);
    intro.addEventListener('canplaythrough', prepareLoop);
    intro.addEventListener('ended', () => finish(), { once: true });
    intro.addEventListener('error', () => {
      if (!retryMp4()) finish(true, true);
    });
    skip.addEventListener('click', () => finish(true));
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    // Never make a slow connection wait for the film.
    slowStartTimer = window.setTimeout(() => {
      if (!played) finish(true, true);
    }, 6000);
    maximumTimer = window.setTimeout(() => finish(true, !played), 12000);

    for (const event of ['progress', 'loadeddata', 'canplaythrough']) intro.addEventListener(event, beginPlayback);
    overlay.append(intro);
    document.body.append(overlay);
    beginPlayback();
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
 * the hero is off screen or the tab is hidden. On each visit the intro film
 * plays in a separate viewport overlay first. Resolves when the hero headline may
 * reveal.
 */
let replayIntroOnReturn = null;

const initFilm = (isFull) => {
  const heroHeader = document.querySelector(HERO_SELECTOR);
  if (!heroHeader || !canPlayFilm(true)) {
    revealDreamsAfterIntro();
    return Promise.resolve();
  }

  const wide = window.matchMedia('(min-width: 900px)').matches;
  const film = document.createElement('div');
  film.className = 'oh-hero-film';
  film.setAttribute('aria-hidden', 'true');
  const video = createVideo(FILM_BASE, isFull && wide ? '1280' : '854', 'oh-hero-loop');
  video.loop = true;
  // Prioritize the opening film; prepare the loop once the remaining intro is buffered.
  video.preload = 'none';
  video.poster = '/img/hero/noctalia-observatory-bg.webp';
  film.append(video);

  let started = false;
  let introPlaying = false;
  const remove = () => {
    video.pause();
    film.remove();
  };
  video.addEventListener('playing', () => film.classList.add('is-playing'), { once: true });
  video.addEventListener('error', remove, { once: true });
  heroHeader.prepend(film);
  let filmVisible = true;
  const sync = () => {
    if (!film.isConnected || !started || introPlaying) return;
    if (filmVisible && !document.hidden && !html.classList.contains('oh-lightbox-open') && document.querySelector('.oh-shared-sky')?.style?.visibility !== 'hidden') {
      video.play().catch(remove);
    } else {
      video.pause();
    }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        filmVisible = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.02 }
    ).observe(film);
  }
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('dream-dialog-change', sync);
  document.addEventListener('dream-sky-visibility-change', sync);

  const startLoop = () => {
    started = true;
    sync();
  };
  let retry;
  const showRetry = () => {
    if (!retry) {
      retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'oh-btn-secondary oh-intro-retry';
      const labels = { fr: 'Voir l’intro', en: 'Play intro', de: 'Intro ansehen', es: 'Ver intro', it: 'Guarda l’intro', pt: 'Ver introdução' };
      retry.textContent = labels[(html.lang || 'en').slice(0, 2)] || labels.en;
      retry.addEventListener('click', () => {
        activeLenis?.scrollTo(0, { immediate: true });
        window.scrollTo(0, 0);
        startIntro();
      });
    }
    heroHeader.querySelector('.oh-hero-inner').append(retry);
  };
  const startIntro = () => {
    if (introPlaying) return Promise.resolve();
    retry?.remove();
    holdDreamsForIntro();
    introPlaying = true;
    video.pause();
    // The landscape master and loop share a composition; object-fit: cover
    // applies the same viewport crop on phones and desktops.
    return playIntro(film, video, '1280').then((result) => {
      if (result.unavailable) showRetry();
      introPlaying = false;
      startLoop();
    });
  };
  replayIntroOnReturn = () => {
    activeLenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    startIntro();
  };
  if (!canPlayFilm()) {
    revealDreamsAfterIntro();
    showRetry();
    return Promise.resolve();
  }
  if (!window.location.hash) window.scrollTo(0, 0);
  return startIntro();
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

const bootEnhanced = async (currentTier, heroReady) => {
  const isFull = currentTier === 'full';
  const moduleScript = document.querySelector('script[data-animation-module="experience"]');
  let journey;

  try {
    const skyPromise = Promise.resolve();
    journey = initDreamJourney(heroReady, (top, options = { immediate: true }) => {
      if (activeLenis) activeLenis.scrollTo(top, options);
      else window.scrollTo({ top, behavior: options.immediate ? 'instant' : 'smooth' });
    });
    if (!journey) initDreamHeadings(heroReady);
    initFeatureMedia();
    initDawn();
    const space = initDreamSpace(journey);
    initLightbox(space);
    initWaking();
    initStarmap(journey);
    initRemember();
    initEnding();

    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ autoRaf: true, anchors: true });
    activeLenis = lenis;

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
    journey?.restore();
    showStaticState();
  }
};

// Re-enter the static tier if the OS preference changes while this page is
// open. Reloading disposes every active controller, including Lenis, GSAP,
// canvas, and requestAnimationFrame loops, then the head script selects static.
if (tier !== 'static' && typeof window.matchMedia === 'function') {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReducedMotionChange = (event) => {
    if (!event.matches) return;
    showStaticState();
    window.location.reload();
  };
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', onReducedMotionChange);
  } else {
    reducedMotion.addListener?.(onReducedMotionChange);
  }
}

initSharedSky();
// Start the lightweight video immediately; defer the heavier 3D scenes to idle.
const heroReady = tier === 'static' ? Promise.resolve() : initFilm(tier === 'full');
if (tier !== 'static') heroReady.then(revealHeadline);

if (tier === 'static') {
  bootStatic();
} else {
  afterLcp(() => {
    bootEnhanced(tier, heroReady).catch(() => showStaticState());
  });
}

// BFCache: replay the opening film when returning via browser Back, then
// refresh scroll-driven scenes without booting duplicate controllers.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (tier === 'static') {
    showStaticState();
    return;
  }
  replayIntroOnReturn?.();
  if (window.ScrollTrigger) {
    window.ScrollTrigger.refresh(true);
  }
});
