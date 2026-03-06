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

  document.addEventListener('mousemove', (event) => {
    const orbs = document.querySelectorAll('.orb');
    if (orbs.length === 0) return;

    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;

    orbs.forEach((orb, index) => {
      const speed = (index + 1) * 15;
      orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
    });
  });
});
