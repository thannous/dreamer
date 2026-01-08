(() => {
  const gsapLib = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

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
    const allowDesktopAnimations = window.matchMedia('(min-width: 768px)').matches;
    return !!(gsapLib && ScrollTrigger && !prefersReducedMotion && allowDesktopAnimations);
  };

  const scheduleInit = (callback) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 1500 });
    } else {
      window.setTimeout(callback, 200);
    }
  };

  const initAnimations = () => {
    gsapLib.registerPlugin(ScrollTrigger);
    ScrollTrigger.getAll().forEach((t) => t.kill());
    ScrollTrigger.clearMatchMedia();

    const easeSoft = 'power1.out';

    const heroItems = gsapLib.utils.toArray('.hero-anim');
    if (heroItems.length) {
      gsapLib.set(heroItems, { autoAlpha: 0, y: 14 });
      gsapLib.to(heroItems, {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        ease: easeSoft,
        stagger: 0.12,
        delay: 0.15,
      });
    }

    gsapLib.utils.toArray('.reveal').forEach((el) => {
      gsapLib.fromTo(
        el,
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: easeSoft,
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
            once: true,
          },
        },
      );
    });

    const line = document.querySelector('.step-line');
    if (line) {
      gsapLib.fromTo(
        line,
        { transformOrigin: 'left center', scaleX: 0 },
        {
          scaleX: 1,
          duration: 1,
          ease: easeSoft,
          scrollTrigger: {
            trigger: line.closest('section') || line,
            start: 'top 80%',
            once: true,
          },
        },
      );
    }

    const cards = gsapLib.utils.toArray('[data-step-card], [data-phone]');
    cards.forEach((el) => {
      gsapLib.from(el, {
        autoAlpha: 0,
        y: 18,
        duration: 0.9,
        ease: easeSoft,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
          once: true,
        },
      });
    });

    gsapLib.utils.toArray('[data-phone]').forEach((phone) => {
      phone.addEventListener('mouseenter', () => {
        gsapLib.to(phone, { y: -6, duration: 0.3, ease: easeSoft });
      });
      phone.addEventListener('mouseleave', () => {
        gsapLib.to(phone, { y: 0, duration: 0.3, ease: easeSoft });
      });
    });

    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  const boot = (forceImmediate = false) => {
    if (!shouldAnimate()) {
      if (!gsapLib || !ScrollTrigger) {
        console.warn('[landing-animations] GSAP non chargé, animations par défaut.');
      }
      showStaticState();
      return;
    }

    if (forceImmediate) {
      initAnimations();
    } else {
      scheduleInit(initAnimations);
    }
  };

  boot();

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) {
      return;
    }

    const heroItems = getHeroItems();
    const heroHidden = heroItems.some((el) => window.getComputedStyle(el).opacity === '0');
    if (heroHidden) {
      boot(true);
      return;
    }

    const revealItems = getRevealItems();
    const revealHidden = revealItems.some((el) => window.getComputedStyle(el).opacity === '0');
    if (revealHidden) {
      showStaticState();
      return;
    }

    if (ScrollTrigger) {
      ScrollTrigger.refresh(true);
    }
  });
})();
