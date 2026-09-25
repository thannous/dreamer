/** One-shot, viewport-triggered word reveals for the dream-gallery headings. */
export function initDreamHeadings(heroReady) {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const head = document.querySelector('.oh-dreams > .oh-section-head');
  const targets = [...document.querySelectorAll('.oh-dreams > .oh-section-head > .oh-h2, .oh-dreams-closing')];
  if (!head || !targets.length) return;
  head.classList.remove('reveal');
  head.style.setProperty('--heading-follow-delay', `${targets[0].textContent.trim().split(/\s+/).length * 70}ms`);
  const pending = new Set(targets);
  const visible = new Set();
  let ready = false;
  targets.forEach((target) => {
    target.classList.remove('reveal');
    const parts = target.textContent.trim().split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    let index = 0;
    parts.forEach((part) => {
      if (!part.trim()) { fragment.append(document.createTextNode(part)); return; }
      const word = document.createElement('span');
      word.className = 'oh-dream-heading-word';
      word.textContent = part;
      word.style.setProperty('--word-delay', `${index++ * 70}ms`);
      fragment.append(word);
    });
    target.replaceChildren(fragment);
    target.classList.add('oh-word-reveal');
  });
  const root = document.documentElement;
  const revealVisible = () => {
    if (!ready || document.hidden || root.classList.contains('exp-intro-pending') || root.classList.contains('oh-sky-expanding')) return;
    for (const target of visible) {
      if (!pending.has(target)) continue;
      target.classList.add('is-reading');
      pending.delete(target);
      observer.unobserve(target);
    }
    if (!pending.size) {
      gates.disconnect();
      document.removeEventListener('visibilitychange', revealVisible);
    }
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    revealVisible();
  }, { threshold: [0, 0.5], rootMargin: '0px 0px -5% 0px' });
  const gates = new MutationObserver(revealVisible);
  gates.observe(root, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', revealVisible);
  targets.forEach((target) => observer.observe(target));
  heroReady.then(() => { ready = true; revealVisible(); });
}
