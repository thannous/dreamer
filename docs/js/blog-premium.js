(() => {
  let gsapLib = window.gsap;
  let ScrollTrigger = window.ScrollTrigger;
  let desktopInitialized = false;
  let lightInitialized = false;
  let scrollRefreshScheduled = false;

  const moduleScript = document.querySelector('script[data-animation-module="blog-premium"]');
  const gsapSrc = moduleScript?.dataset.gsapSrc || '/js/gsap.min.js';
  const scrollTriggerSrc = moduleScript?.dataset.scrollTriggerSrc || '/js/ScrollTrigger.min.js';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMotion = window.matchMedia('(min-width: 768px)');
  const carousel = document.querySelector('[data-blog-carousel]');
  const prevButton = document.querySelector('[data-carousel-prev]');
  const nextButton = document.querySelector('[data-carousel-next]');
  const cards = Array.from(
    document.querySelectorAll('.blog-premium .article-card, .blog-premium-hub-grid a')
  );
  const articleCards = Array.from(document.querySelectorAll('#articlesGrid .article-card'));
  const nonArticleGridItems = Array.from(document.querySelectorAll('#articlesGrid > :not(.article-card)'));
  const carouselCards = Array.from(document.querySelectorAll('.blog-carousel-card'));
  const searchInput = document.querySelector('#blogSearch');
  const filterButtons = Array.from(document.querySelectorAll('#categoryFilters .filter-chip'));
  const sortButton = document.querySelector('#sortButton');
  const sortMenu = document.querySelector('#sortMenu');
  const sortOptions = Array.from(document.querySelectorAll('#sortMenu .sort-option'));
  const sortLabel = document.querySelector('#sortLabel');
  const resultsCount = document.querySelector('#resultsCount');
  const resultsNumber = document.querySelector('#resultsNumber');
  const articlesGrid = document.querySelector('#articlesGrid');
  let activeCategory = 'all';
  let activeSort = 'recent';

  const shouldUseDesktopMotion = () => desktopMotion.matches && !prefersReducedMotion.matches;

  const normalizeText = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const cardSearchText = new Map(
    articleCards.map((card) => [
      card,
      normalizeText(`${card.dataset.title || ''} ${card.dataset.category || ''} ${card.textContent || ''}`),
    ])
  );

  const categoryGroup = (category) => {
    const normalized = normalizeText(category);
    if (['reve-lucide', 'lucid-dreams', 'suenos-lucidos'].includes(normalized)) return 'lucid';
    if (['guide', 'guia'].includes(normalized)) return 'guide';
    if (['science', 'ciencia'].includes(normalized)) return 'science';
    if (['interpretation', 'interpretacion'].includes(normalized)) return 'interpretation';
    if (['reference', 'referencia'].includes(normalized)) return 'reference';
    return normalized;
  };

  const showStaticState = () => {
    [...cards, ...carouselCards].forEach((card) => {
      card.style.opacity = '1';
      card.style.visibility = 'visible';
      card.style.transform = '';
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

  const scheduleScrollRefresh = () => {
    if (!ScrollTrigger || !shouldUseDesktopMotion() || scrollRefreshScheduled) return;

    scrollRefreshScheduled = true;
    window.requestAnimationFrame(() => {
      scrollRefreshScheduled = false;
      ScrollTrigger.refresh?.();
    });
  };

  if (carousel && prevButton && nextButton) {
    const getScrollAmount = () => Math.max(280, Math.round(carousel.clientWidth * 0.72));
    prevButton.addEventListener('click', () => {
      carousel.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
    });
    nextButton.addEventListener('click', () => {
      carousel.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
    });
  }

  const setFilterButtonState = () => {
    filterButtons.forEach((button) => {
      const isActive = button.dataset.category === activeCategory;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const setSortOptionState = () => {
    sortOptions.forEach((option) => {
      const isActive = option.dataset.sort === activeSort;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', String(isActive));
    });
  };

  const sortArticles = () => {
    if (!articlesGrid) return;

    const sortedCards = [...articleCards].sort((a, b) => {
      if (activeSort === 'reading-time-asc' || activeSort === 'reading-time-desc') {
        const aTime = Number(a.dataset.readingTime || 0);
        const bTime = Number(b.dataset.readingTime || 0);
        return activeSort === 'reading-time-asc' ? aTime - bTime : bTime - aTime;
      }

      return articleCards.indexOf(a) - articleCards.indexOf(b);
    });

    sortedCards.forEach((card) => articlesGrid.appendChild(card));
    nonArticleGridItems.forEach((item) => articlesGrid.appendChild(item));
  };

  const applyArticleControls = () => {
    const query = normalizeText(searchInput?.value);
    const controlsActive = categoryGroup(activeCategory) !== 'all' || Boolean(query);
    let visibleCount = 0;

    articleCards.forEach((card) => {
      const matchesCategory =
        categoryGroup(activeCategory) === 'all' ||
        categoryGroup(card.dataset.category) === categoryGroup(activeCategory);
      const matchesSearch = !query || (cardSearchText.get(card) || '').includes(query);
      const isVisible = matchesCategory && matchesSearch;

      card.classList.toggle('is-hidden', !isVisible);
      card.setAttribute('aria-hidden', String(!isVisible));
      if (isVisible) {
        card.style.opacity = '1';
        card.style.visibility = 'visible';
        card.style.transform = '';
        visibleCount += 1;
      }
    });

    nonArticleGridItems.forEach((item) => {
      item.classList.toggle('is-hidden', controlsActive);
      item.setAttribute('aria-hidden', String(controlsActive));
    });

    if (resultsCount && resultsNumber) {
      resultsNumber.textContent = String(visibleCount);
      resultsCount.classList.toggle(
        'hidden',
        visibleCount === articleCards.length && activeCategory === 'all' && !query
      );
    }

    scheduleScrollRefresh();
  };

  filterButtons.forEach((button) => {
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'all';
      setFilterButtonState();
      applyArticleControls();
    });
  });

  searchInput?.addEventListener('input', applyArticleControls);

  sortButton?.addEventListener('click', () => {
    const isHidden = sortMenu?.classList.contains('hidden');
    sortMenu?.classList.toggle('hidden', !isHidden);
    sortButton.setAttribute('aria-expanded', String(isHidden));
  });

  sortOptions.forEach((option) => {
    option.setAttribute('type', 'button');
    option.addEventListener('click', () => {
      activeSort = option.dataset.sort || 'recent';
      if (sortLabel) {
        sortLabel.textContent = option.textContent.trim();
      }
      sortMenu?.classList.add('hidden');
      sortButton?.setAttribute('aria-expanded', 'false');
      setSortOptionState();
      sortArticles();
      applyArticleControls();
    });
  });

  document.addEventListener('click', (event) => {
    if (!sortMenu || !sortButton) return;
    if (!sortMenu.contains(event.target) && !sortButton.contains(event.target)) {
      sortMenu.classList.add('hidden');
      sortButton.setAttribute('aria-expanded', 'false');
    }
  });

  const initLightMotion = () => {
    if (lightInitialized) return;
    lightInitialized = true;

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
      showStaticState();
      return;
    }

    const lightTargets = [...carouselCards, ...cards].filter((card) => !card.classList.contains('is-hidden'));
    lightTargets.forEach((card) => {
      card.style.opacity = '0';
      card.style.visibility = 'visible';
      card.style.transform = 'translate3d(0, 16px, 0)';
      card.style.transition = 'opacity 620ms ease, transform 620ms ease';
    });

    const observer = new IntersectionObserver(
      (entries, activeObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translate3d(0, 0, 0)';
          activeObserver.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );

    lightTargets.forEach((card) => observer.observe(card));
  };

  const initDesktopAnimations = () => {
    if (!gsapLib || !ScrollTrigger || desktopInitialized || !shouldUseDesktopMotion()) {
      if (!shouldUseDesktopMotion()) initLightMotion();
      return;
    }

    desktopInitialized = true;
    gsapLib.registerPlugin(ScrollTrigger);

    gsapLib.fromTo(
      '.blog-premium-eyebrow, .blog-premium-hero h1, .blog-premium-hero p, .blog-premium-hero-actions, .blog-premium-hero-panel a',
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'power2.out',
        stagger: 0.12,
      }
    );

    gsapLib.fromTo(
      '.blog-premium-carousel-header, .blog-carousel-card',
      { autoAlpha: 0, y: 16 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.68,
        ease: 'power2.out',
        stagger: 0.08,
        delay: 0.16,
      }
    );

    cards.forEach((card) => {
      if (card.classList.contains('is-hidden')) return;

      gsapLib.fromTo(
        card,
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.72,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 88%',
            once: true,
          },
        }
      );
    });

    gsapLib.utils.toArray('.blog-premium .article-card img').forEach((image) => {
      gsapLib.fromTo(
        image,
        { scale: 0.96, opacity: 0.76 },
        {
          scale: 1,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: image,
            start: 'top 92%',
            end: 'center 48%',
            scrub: true,
          },
        }
      );
    });

    scheduleScrollRefresh();
  };

  const bootAnimations = () => {
    if (!shouldUseDesktopMotion()) {
      initLightMotion();
      return;
    }

    scheduleIdle(async () => {
      try {
        const loaded = await loadAnimationLibraries();
        if (!loaded) {
          initLightMotion();
          return;
        }
        initDesktopAnimations();
      } catch {
        initLightMotion();
      }
    });
  };

  setFilterButtonState();
  setSortOptionState();
  applyArticleControls();
  bootAnimations();

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (ScrollTrigger && shouldUseDesktopMotion()) {
      ScrollTrigger.refresh(true);
    } else {
      showStaticState();
    }
  });
})();
