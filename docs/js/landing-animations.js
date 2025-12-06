(() => {
  const gsapLib = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  const showStaticState = () => {
    document.querySelectorAll('.hero-anim').forEach((el) => el.classList.remove('opacity-0'));
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
  };

  if (!gsapLib || !ScrollTrigger) {
    console.warn('[landing-animations] GSAP non chargé, animations par défaut.');
    showStaticState();
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    showStaticState();
    return;
  }

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

  ScrollTrigger.refresh();
})();
