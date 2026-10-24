/** Scrub an account and its symbol flights with the scroll position. */
export function createDreamSymbolFlight(words, first, stars, manageStars = true) {
  const clamp = value => Math.max(0, Math.min(1, value));
  const flights = [...first.querySelectorAll('.oh-sym-word')].map(mark => {
    const star = stars.get(Number(mark.dataset.sym));
    if (!star) return null;
    const ghost = document.createElement('span');
    ghost.textContent = mark.textContent;
    ghost.className = 'oh-sym-ghost oh-symbol-comet';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.hidden = true;
    document.body.append(ghost);
    const trail = Array.from({ length: 7 }, () => {
      const dot = document.createElement('span');
      dot.className = 'oh-comet-trail';
      dot.setAttribute('aria-hidden', 'true');
      dot.hidden = true;
      document.body.append(dot);
      return dot;
    });
    const arrival = document.createElement('span');
    arrival.className = 'oh-comet-arrival';
    arrival.setAttribute('aria-hidden', 'true');
    arrival.hidden = true;
    document.body.append(arrival);
    return { mark, star, picture: star.querySelector('img'), ghost, trail, arrival };
  }).filter(Boolean);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = (progress, visible = true) => {
    const landed = [];
    const p = clamp(progress);
    const animate = visible && !reduced.matches;
    // Read every live flight before changing classes, visibility or transforms.
    // Interleaved reads/writes forced a style/layout flush for each following comet.
    const positions = flights.map(({ mark, picture }, index) => {
      const start = 0.5 + index / Math.max(1, flights.length) * 0.24;
      const t = clamp((p - start) / 0.25);
      const burst = clamp((p - start - 0.21) / 0.13);
      if (!animate || ((t <= 0 || t === 1) && (burst <= 0 || burst >= 1))) return null;
      return { from: mark.getBoundingClientRect(), to: picture.getBoundingClientRect() };
    });
    words.forEach((word, index) => {
      word.classList.toggle('is-in', p >= (index + 1) / words.length * 0.48);
    });
    flights.forEach(({mark, star, ghost, trail, arrival}, index) => {
      const start = 0.5 + index / Math.max(1, flights.length) * 0.24;
      const t = clamp((p - start) / 0.25);
      const arrived = t === 1;
      mark.classList.toggle('is-marked', p >= 0.48);
      if (arrived) landed.push(Number(mark.dataset.sym));
      if (manageStars) {
        star.classList.toggle('is-flown', arrived);
        star.classList.toggle('is-born', arrived);
        star.classList.toggle('is-glow', arrived);
      }
      ghost.hidden = !animate || t <= 0 || arrived;
      trail.forEach(dot => { dot.hidden = ghost.hidden; });
      const burst = clamp((p - start - 0.21) / 0.13);
      arrival.hidden = !animate || burst <= 0 || burst >= 1;
      if (ghost.hidden && arrival.hidden) return;
      const { from, to } = positions[index];
      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const x1 = to.left + to.width / 2;
      const y1 = to.top + to.height / 2;
      const point = u => ({
        x: x0 + (x1 - x0) * u,
        y: y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 40,
      });
      const head = point(t);
      // Keep the word horizontal and readable; only the light trail follows the arc.
      ghost.style.transform = `translate3d(${head.x}px, ${head.y}px, 0) translate(-50%, -50%) scale(${1 - clamp((t - 0.8) / 0.2) * 0.15})`;
      ghost.style.opacity = String(clamp(t / 0.12) * (1 - clamp((t - 0.88) / 0.12)));
      trail.forEach((dot, i) => {
        const u = Math.max(0, t - (i + 1) * 0.023);
        const here = point(u);
        const ahead = point(Math.min(1, u + 0.01));
        const angle = Math.atan2(ahead.y - here.y, ahead.x - here.x);
        dot.style.transform = `translate3d(${here.x}px, ${here.y}px, 0) rotate(${angle}rad) scale(${1 - i * 0.1})`;
        dot.style.opacity = String(clamp(t / 0.12) * (1 - i / trail.length) * 0.65 * (1 - clamp((t - 0.85) / 0.15)));
      });
      arrival.style.transform = `translate3d(${x1}px, ${y1}px, 0) translate(-50%, -50%) scale(${0.9 + burst * 1.1})`;
      arrival.style.opacity = String(Math.sin(burst * Math.PI) * 0.8);
    });
    return landed;
  };
  update.destroy = () => flights.forEach(({ ghost, trail, arrival }) => {
    [ghost, ...trail, arrival].forEach(element => element.remove());
  });
  return update;
}
