/**
 * Mobile Menu (hamburger) for Noctalia header
 * Uses matchMedia to toggle desktop/mobile layout.
 *
 * Because language-dropdown.css defines `.hidden { display: none !important }`,
 * we must add/remove the `hidden` class rather than using inline styles.
 */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const desktopLinks = document.getElementById('navDesktopLinks');
    const mobileGuideLink = document.getElementById('navMobileGuideLink');
    const desktopLangDropdown = document.getElementById('navDesktopLangDropdown');
    const menuButton = document.getElementById('mobileMenuButton');
    const menuPanel = document.getElementById('mobileMenuPanel');
    const navbar = document.getElementById('navbar');
    if (!menuButton || !menuPanel) return;

    const mql = window.matchMedia('(min-width: 768px)');
    let panelOpen = false;
    let openedAt = 0;
    let openedAtScrollY = 0;

    function show(el) { if (el) el.classList.remove('hidden'); }
    function hide(el) { if (el) el.classList.add('hidden'); }

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
      show(menuPanel);
      navbar?.classList.add('mobile-menu-open');
      swapIcon('x');
      menuButton.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
      panelOpen = false;
      hide(menuPanel);
      navbar?.classList.remove('mobile-menu-open');
      swapIcon('menu');
      menuButton.setAttribute('aria-expanded', 'false');
    }

    function swapIcon(name) {
      // Always re-query: lucide replaces <i> with <svg>, staling old refs
      const current = document.getElementById('mobileMenuIcon');
      if (!current) return;
      const parent = current.parentElement;
      if (!parent) return;
      const fresh = document.createElement('i');
      fresh.setAttribute('data-lucide', name);
      fresh.id = 'mobileMenuIcon';
      fresh.className = 'w-5 h-5';
      parent.replaceChild(fresh, current);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ nodes: [fresh] });
      }
    }

    // Toggle on click
    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panelOpen) closePanel();
      else openPanel();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (panelOpen && !menuPanel.contains(e.target) && !menuButton.contains(e.target)) {
        closePanel();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.key === 'Esc') && panelOpen) {
        closePanel();
        menuButton.focus();
      }
    });

    // Close on scroll
    window.addEventListener('scroll', () => {
      if (!panelOpen) return;
      const openedRecently = Date.now() - openedAt < 180;
      const movedMeaningfully = Math.abs(window.scrollY - openedAtScrollY) > 24;
      if (!openedRecently && movedMeaningfully) closePanel();
    }, { passive: true });

    // React to viewport changes
    mql.addEventListener('change', (e) => syncLayout(e.matches));

    // Initial sync
    syncLayout(mql.matches);
  });
})();
