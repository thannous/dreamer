(() => {
  const gsapLib = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  const stepSectionSelector = [
    '#how-it-works',
    '#comment-ca-marche',
    '#como-funciona',
    '#so-funktioniert-es',
    '#come-funziona',
  ].join(',');

  const featureSectionSelector = [
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

  const shouldAnimate = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !!(gsapLib && ScrollTrigger && !prefersReducedMotion);
  };

  const scheduleInit = (callback) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 1500 });
    } else {
      window.setTimeout(callback, 180);
    }
  };

  const initHero = () => {
    const heroItems = gsapLib.utils.toArray('.hero-anim');
    if (!heroItems.length) return;

    gsapLib.set(heroItems, { autoAlpha: 0, y: 16 });
    gsapLib.to(heroItems, {
      autoAlpha: 1,
      y: 0,
      duration: 1,
      ease: 'power2.out',
      stagger: 0.12,
      delay: 0.12,
    });

    gsapLib.fromTo(
      '.noctalia-observatory > header picture',
      { scale: 0.94, opacity: 0.8 },
      {
        scale: 1,
        opacity: 1,
        duration: 1.2,
        ease: 'power2.out',
        delay: 0.35,
      },
    );
  };

  const initReveals = () => {
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
        },
      );
    });
  };

  const initPinnedSteps = () => {
    const stepSection = document.querySelector(stepSectionSelector);
    if (!stepSection || !window.matchMedia('(min-width: 768px)').matches) return;

    const heading = stepSection.querySelector('.text-center.mb-16');
    const galleryItems = gsapLib.utils.toArray(withSuffix(stepSectionSelector, '[data-step]'));
    if (!heading || !galleryItems.length) return;

    ScrollTrigger.create({
      trigger: stepSection,
      start: 'top 12%',
      end: 'bottom 72%',
      pin: heading,
      pinSpacing: false,
    });

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
        },
      );
    });
  };

  const initMediaScroll = () => {
    const mediaItems = gsapLib.utils.toArray(
      '.noctalia-observatory picture img, .noctalia-observatory [data-phone]',
    );

    mediaItems.forEach((item) => {
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
        },
      );
    });
  };

  const initCardPhysics = () => {
    const cards = gsapLib.utils.toArray(
      `${withSuffix(featureSectionSelector, '.glass-panel')}, .noctalia-observatory a.glass-panel`,
    );

    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => {
        gsapLib.to(card, { y: -6, duration: 0.32, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', () => {
        gsapLib.to(card, { y: 0, duration: 0.32, ease: 'power2.out' });
      });
    });
  };

  const initAnimations = () => {
    gsapLib.registerPlugin(ScrollTrigger);
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

    initHero();
    initReveals();
    initPinnedSteps();
    initMediaScroll();
    initCardPhysics();

    window.requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  const boot = (forceImmediate = false) => {
    if (!shouldAnimate()) {
      showStaticState();
      return;
    }

    if (forceImmediate) {
      initAnimations();
      return;
    }

    scheduleInit(initAnimations);
  };

  boot();

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;

    const heroHidden = getHeroItems().some((el) => window.getComputedStyle(el).opacity === '0');
    if (heroHidden) {
      boot(true);
      return;
    }

    const revealHidden = getRevealItems().some((el) => window.getComputedStyle(el).opacity === '0');
    if (revealHidden) {
      showStaticState();
      return;
    }

    if (ScrollTrigger) {
      ScrollTrigger.refresh(true);
    }
  });
})();
