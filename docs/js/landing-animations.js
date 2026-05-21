(() => {
  let gsapLib = window.gsap;
  let ScrollTrigger = window.ScrollTrigger;
  let desktopInitialized = false;
  let lightInitialized = false;

  const moduleScript = document.querySelector('script[data-animation-module="landing"]');
  const gsapSrc = moduleScript?.dataset.gsapSrc || '/js/gsap.min.js';
  const scrollTriggerSrc = moduleScript?.dataset.scrollTriggerSrc || '/js/ScrollTrigger.min.js';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMotion = window.matchMedia('(min-width: 768px)');

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

  const shouldUseDesktopMotion = () => desktopMotion.matches && !prefersReducedMotion.matches;

  const keepHeroAccessibleDuringMotion = () => {
    getHeroItems().forEach((el) => {
      el.style.visibility = 'visible';
    });
  };

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
      window.requestIdleCallback(callback, { timeout: 1600 });
    } else {
      window.setTimeout(callback, 180);
    }
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

  const loadAnimationLibraries = async () => {
    if (!window.gsap) {
      await loadScript(gsapSrc);
    }
    gsapLib = window.gsap;

    if (!window.ScrollTrigger) {
      await loadScript(scrollTriggerSrc);
    }
    ScrollTrigger = window.ScrollTrigger;

    return Boolean(gsapLib && ScrollTrigger);
  };

  const initLightMotion = () => {
    if (prefersReducedMotion.matches) {
      showStaticState();
      return;
    }

    if (lightInitialized) return;
    lightInitialized = true;

    getHeroItems().forEach((el, index) => {
      el.classList.remove('opacity-0');
      el.style.opacity = '0';
      el.style.visibility = 'visible';
      el.style.transform = 'translate3d(0, 14px, 0)';
      el.style.transition = 'opacity 700ms ease, transform 700ms ease';
      el.style.transitionDelay = `${Math.min(index * 90, 360)}ms`;
    });

    window.requestAnimationFrame(() => {
      getHeroItems().forEach((el) => {
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

  const initHero = () => {
    const heroItems = gsapLib.utils.toArray('.hero-anim');
    if (!heroItems.length) return;

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
      {
        scale: 1,
        opacity: 1,
        duration: 1.2,
        ease: 'power2.out',
        delay: 0.35,
      }
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
        }
      );
    });
  };

  const initPinnedSteps = () => {
    const stepSection = document.querySelector(stepSectionSelector);
    if (!stepSection || !desktopMotion.matches) return;

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
        }
      );
    });
  };

  const initMediaScroll = () => {
    const mediaItems = gsapLib.utils.toArray(
      '.noctalia-observatory picture img, .noctalia-observatory [data-phone]'
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
        }
      );
    });
  };

  const initCardPhysics = () => {
    const cards = gsapLib.utils.toArray(
      `${withSuffix(featureSectionSelector, '.glass-panel')}, .noctalia-observatory a.glass-panel`
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
    if (!gsapLib || !ScrollTrigger || desktopInitialized || !shouldUseDesktopMotion()) {
      if (!shouldUseDesktopMotion()) initLightMotion();
      return;
    }

    desktopInitialized = true;
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
    keepHeroAccessibleDuringMotion();

    if (!shouldUseDesktopMotion()) {
      initLightMotion();
      return;
    }

    const start = async () => {
      try {
        const loaded = await loadAnimationLibraries();
        if (!loaded) {
          initLightMotion();
          return;
        }
        initAnimations();
      } catch {
        initLightMotion();
      }
    };

    if (forceImmediate) {
      start();
    } else {
      scheduleIdle(start);
    }
  };

  boot();

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;

    if (!shouldUseDesktopMotion()) {
      initLightMotion();
      return;
    }

    if (ScrollTrigger) {
      ScrollTrigger.refresh(true);
      return;
    }

    boot(true);
  });
})();
