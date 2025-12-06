(() => {
  const gsapLib = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  if (!gsapLib || !ScrollTrigger) {
    console.warn('[landing-animations] GSAP non chargé, les animations sont désactivées.');
    document.querySelectorAll('.hero-anim').forEach((el) => el.classList.remove('opacity-0'));
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
    return;
  }

  gsapLib.registerPlugin(ScrollTrigger);
  // Nettoyage défensif si le script est rechargé (évite les pin-spacers fantômes)
  ScrollTrigger.getAll().forEach((t) => t.kill());
  ScrollTrigger.clearMatchMedia();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
    document.querySelectorAll('.hero-anim').forEach((el) => el.classList.remove('opacity-0'));
    return;
  }

  const heroItems = gsapLib.utils.toArray('.hero-anim');
  if (heroItems.length) {
    gsapLib.set(heroItems, { autoAlpha: 0, y: 24 });
    gsapLib.to(heroItems, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.08,
      ease: 'power2.out',
      delay: 0.15,
    });
  }

  gsapLib.utils.toArray('.reveal').forEach((el) => {
    gsapLib.fromTo(
      el,
      { autoAlpha: 0, y: 40 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          toggleActions: 'play none none none',
          once: true,
        },
      },
    );
  });

  const line = document.querySelector('.step-line');
  if (line) {
    gsapLib.set(line, { transformOrigin: 'left center', scaleX: 0 });
    gsapLib.to(line, {
      scaleX: 1,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '#comment-ca-marche',
        start: 'top 80%',
      },
    });
  }

  const steps = ['record', 'analyze', 'explore'];
  const phones = steps.map((step) => document.querySelector(`[data-phone="${step}"]`));
  const stepBlocks = steps.map((step) => document.querySelector(`[data-step="${step}"]`));

  // Narration au scroll : desktop uniquement ; mobile = entrées simples
  ScrollTrigger.matchMedia({
    '(min-width: 1024px)': () => {
      const availableSteps = stepBlocks.filter(Boolean);
      const recordPhone = document.querySelector('[data-phone="record"]');
      const analyzePhone = document.querySelector('[data-phone="analyze"]');
      const explorePhone = document.querySelector('[data-phone="explore"]');
      const disposables = [];

      // États de base (pas de translateY)
      gsapLib.set(availableSteps, { opacity: 0.5 });
      if (recordPhone) gsapLib.set(recordPhone, { opacity: 1, scale: 1, zIndex: 3 });
      if (analyzePhone) gsapLib.set(analyzePhone, { opacity: 0.35, scale: 0.97, zIndex: 2 });
      if (explorePhone) gsapLib.set(explorePhone, { opacity: 0.35, scale: 0.97, zIndex: 1 });

      const narrativeTl = gsapLib.timeline({
        defaults: { duration: 2.4, ease: 'power2.out' },
        scrollTrigger: {
          trigger: '#comment-ca-marche',
          start: 'top 15%',
          end: '+=420vh',
          pin: true,
          scrub: true,
          anticipatePin: 1,
        },
      });
      disposables.push(narrativeTl.scrollTrigger);

      if (availableSteps.length) {
        narrativeTl
          .to(availableSteps, { opacity: (i) => (i === 0 ? 1 : 0.4), duration: 0.2 }, 'record')
          .to(availableSteps, { opacity: (i) => (i === 1 ? 1 : 0.4), duration: 0.2 }, 'analyze')
          .to(availableSteps, { opacity: (i) => (i === 2 ? 1 : 0.4), duration: 0.2 }, 'explore');
      }

      narrativeTl
        .addLabel('record', 0)
        .to(recordPhone, { opacity: 1, scale: 1, duration: 0.6 }, 'record')
        .to(analyzePhone, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 'record')
        .to(explorePhone, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 'record')
        .addLabel('analyze')
        .to(recordPhone, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 'analyze')
        .to(analyzePhone, { opacity: 1, scale: 1, duration: 0.6 }, 'analyze')
        .to(explorePhone, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 'analyze')
        .addLabel('explore')
        .to(recordPhone, { opacity: 0.3, scale: 0.96, duration: 0.6 }, 'explore')
        .to(analyzePhone, { opacity: 0.35, scale: 0.97, duration: 0.6 }, 'explore')
        .to(explorePhone, { opacity: 1, scale: 1, duration: 0.6 }, 'explore');

      if (recordPhone) {
        const glow = gsapLib.fromTo(
          recordPhone,
          { boxShadow: '0 0 0 rgba(253,164,129,0)' },
          {
            boxShadow: '0 0 32px rgba(253,164,129,0.25)',
            duration: 0.9,
            ease: 'power2.out',
            repeat: 1,
            yoyo: true,
            scrollTrigger: {
              trigger: '#comment-ca-marche',
              start: 'top 90%',
              end: 'top 60%',
              scrub: true,
            },
          },
        );
        disposables.push(glow.scrollTrigger);
      }

      return () => {
        disposables.forEach((st) => st?.kill && st.kill());
        narrativeTl.kill();
      };
    },

    '(max-width: 1023px)': () => {
      // Reset pour mobile : tout visible, entrées simples sans scrub
      gsapLib.set(stepBlocks, { opacity: 1 });
      gsapLib.set(phones, { opacity: 1, scale: 1, clearProps: 'zIndex' });

      const anims = [];
      gsapLib.utils.toArray('[data-phone]').forEach((phone) => {
        const anim = gsapLib.from(phone, {
          autoAlpha: 0,
          y: 30,
          duration: 0.7,
          ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: {
            trigger: phone,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
        anims.push(anim);
      });

      return () => anims.forEach((a) => a.kill());
    },
  });

  // (Parallax retiré pour éviter tout blocage ou décalage de scroll)

  gsapLib.utils.toArray('[data-phone]').forEach((phone) => {
    phone.addEventListener('mouseenter', () => {
      gsapLib.to(phone, { y: -8, duration: 0.35, ease: 'power2.out' });
    });
    phone.addEventListener('mouseleave', () => {
      gsapLib.to(phone, { y: 0, duration: 0.35, ease: 'power2.out' });
    });
  });

  // Rafraîchit les triggers après init pour recalculer les distances (pin)
  ScrollTrigger.refresh();
})();
