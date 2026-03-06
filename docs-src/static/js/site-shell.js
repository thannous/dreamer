document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  const navbar = document.getElementById('navbar');
  if (!navbar || !navbar.dataset.shrinkOnScroll) {
    return;
  }

  const expandedClass = navbar.dataset.expandedClass || 'py-6';
  const compactClass = navbar.dataset.compactClass || 'py-2';

  const syncNavbar = () => {
    const compact = window.scrollY > 50;
    navbar.classList.toggle(compactClass, compact);
    navbar.classList.toggle(expandedClass, !compact);
  };

  syncNavbar();
  window.addEventListener('scroll', syncNavbar, { passive: true });
});
