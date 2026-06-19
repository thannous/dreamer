document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  if (!navbar) {
    return;
  }

  if (!document.getElementById('nav-scroll-style')) {
    const style = document.createElement('style');
    style.id = 'nav-scroll-style';
    style.textContent = `
      .nav-scroll-animate {
        transition: transform 0.3s ease, opacity 0.2s ease, background-color 0.2s ease, backdrop-filter 0.2s ease, box-shadow 0.2s ease;
        will-change: transform, opacity;
      }
      .nav-scroll-hidden {
        transform: translateY(-120%);
        opacity: 0;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  const expandedClass = navbar.dataset.expandedClass || 'py-6';
  const compactClass = navbar.dataset.compactClass || 'py-2';
  const shrinkOnScroll = Boolean(navbar.dataset.shrinkOnScroll);
  const canShrinkNavigation = window.matchMedia('(min-width: 768px)');
  const directionThreshold = 8;
  const hideOffset = 64;
  const showOffset = 8;
  let lastScrollY = window.scrollY;
  let ticking = false;

  const syncNavbar = () => {
    const currentScrollY = window.scrollY;
    const shouldShrink = shrinkOnScroll && canShrinkNavigation.matches;

    if (shouldShrink) {
      const compact = currentScrollY > 50;
      navbar.classList.toggle(compactClass, compact);
      navbar.classList.toggle(expandedClass, !compact);
    } else if (shrinkOnScroll) {
      navbar.classList.remove(compactClass);
      navbar.classList.add(expandedClass);
    }

    const delta = currentScrollY - lastScrollY;
    if (currentScrollY <= showOffset) {
      navbar.classList.remove('nav-scroll-hidden');
    } else if (Math.abs(delta) >= directionThreshold) {
      navbar.classList.toggle('nav-scroll-hidden', delta > 0 && currentScrollY > hideOffset);
      lastScrollY = currentScrollY;
    }

    ticking = false;
  };

  navbar.classList.add('nav-scroll-animate');
  syncNavbar();
  canShrinkNavigation.addEventListener('change', syncNavbar);
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(syncNavbar);
        ticking = true;
      }
    },
    { passive: true }
  );
});
