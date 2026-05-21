/**
 * Mobile Menu (hamburger) for Noctalia header.
 * Uses matchMedia to toggle desktop/mobile layout.
 */
(() => {
  const SVG_ATTRS =
    'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  const ICONS = {
    menu: `<svg ${SVG_ATTRS} data-lucide="menu" id="mobileMenuIcon" class="lucide lucide-menu w-5 h-5"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg>`,
    x: `<svg ${SVG_ATTRS} data-lucide="x" id="mobileMenuIcon" class="lucide lucide-x w-5 h-5"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`,
  };

  document.addEventListener('DOMContentLoaded', () => {
    const desktopLinks = document.getElementById('navDesktopLinks');
    const mobileGuideLink = document.getElementById('navMobileGuideLink');
    const desktopLangDropdown = document.getElementById('navDesktopLangDropdown');
    const menuButton = document.getElementById('mobileMenuButton');
    const menuPanel = document.getElementById('mobileMenuPanel');
    const menuBackdrop = document.getElementById('mobileMenuBackdrop');
    const navbar = document.getElementById('navbar');
    if (!menuButton || !menuPanel) return;

    const mql = window.matchMedia('(min-width: 768px)');
    let panelOpen = false;
    let openedAt = 0;
    let openedAtScrollY = 0;

    function show(el) {
      if (el) el.classList.remove('hidden');
    }

    function hide(el) {
      if (el) el.classList.add('hidden');
    }

    function swapIcon(name) {
      const current = document.getElementById('mobileMenuIcon');
      if (!current) return;
      current.outerHTML = ICONS[name] || ICONS.menu;
    }

    function closePanel() {
      panelOpen = false;
      hide(menuPanel);
      hide(menuBackdrop);
      menuBackdrop?.classList.remove('is-visible');
      navbar?.classList.remove('mobile-menu-open');
      document.body.classList.remove('mobile-menu-lock');
      setPageInert(false);
      swapIcon('menu');
      menuButton.setAttribute('aria-expanded', 'false');
    }

    function setPageInert(isInert) {
      document.querySelectorAll('main, footer').forEach((el) => {
        if ('inert' in el) el.inert = isInert;
        if (isInert) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });
    }

    function syncLayout(isDesktop) {
      if (isDesktop) {
        show(desktopLinks);
        hide(mobileGuideLink);
        show(desktopLangDropdown);
        hide(menuButton);
        closePanel();
      } else {
        hide(desktopLinks);
        show(mobileGuideLink);
        hide(desktopLangDropdown);
        show(menuButton);
      }
    }

    function openPanel() {
      panelOpen = true;
      openedAt = Date.now();
      openedAtScrollY = window.scrollY;
      show(menuBackdrop);
      show(menuPanel);
      window.requestAnimationFrame(() => menuBackdrop?.classList.add('is-visible'));
      navbar?.classList.add('mobile-menu-open');
      document.body.classList.add('mobile-menu-lock');
      setPageInert(true);
      swapIcon('x');
      menuButton.setAttribute('aria-expanded', 'true');
    }

    menuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (panelOpen) closePanel();
      else openPanel();
    });

    document.addEventListener('click', (event) => {
      if (panelOpen && !menuPanel.contains(event.target) && !menuButton.contains(event.target)) {
        closePanel();
      }
    });

    menuBackdrop?.addEventListener('click', closePanel);

    document.addEventListener('keydown', (event) => {
      if ((event.key === 'Escape' || event.key === 'Esc') && panelOpen) {
        closePanel();
        menuButton.focus();
      }
    });

    window.addEventListener(
      'scroll',
      () => {
        if (!panelOpen) return;
        const openedRecently = Date.now() - openedAt < 180;
        const movedMeaningfully = Math.abs(window.scrollY - openedAtScrollY) > 24;
        if (!openedRecently && movedMeaningfully) closePanel();
      },
      { passive: true }
    );

    mql.addEventListener('change', (event) => syncLayout(event.matches));
    syncLayout(mql.matches);
  });
})();
