document.addEventListener('DOMContentLoaded', () => {
  const hasGSAP = typeof window !== 'undefined' && window.gsap && window.ScrollTrigger;

  if (!hasGSAP) {
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
      const observer = new IntersectionObserver((entries, activeObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('active');
          activeObserver.unobserve(entry.target);
        }
      }, { threshold: 0.1 });

      for (const element of revealElements) {
        observer.observe(element);
      }
    }
  }

  const canTrackPointer =
    window.matchMedia('(min-width: 768px)').matches &&
    window.matchMedia('(pointer: fine)').matches;
  const orbs = canTrackPointer ? Array.from(document.querySelectorAll('.orb')) : [];
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  if (orbs.length > 0) {
    document.addEventListener(
      'mousemove',
      (event) => {
        pointerX = event.clientX / window.innerWidth;
        pointerY = event.clientY / window.innerHeight;

        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
          orbs.forEach((orb, index) => {
            const speed = (index + 1) * 15;
            orb.style.transform = `translate(${pointerX * speed}px, ${pointerY * speed}px)`;
          });
          pointerFrame = 0;
        });
      },
      { passive: true }
    );
  }
});
