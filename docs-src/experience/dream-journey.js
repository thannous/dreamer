import { createDreamAnalysisDemo } from './dream-analysis-demo.js';

/** One pinned scene: illustrated dreams, meaning, then their shared symbols. */
export function initDreamJourney(heroReady, seek = top => window.scrollTo({ top, behavior: 'instant' })) {
  if (!('IntersectionObserver' in window) || !CSS.supports('transform-style', 'preserve-3d')) return null;
  const section = document.querySelector('.oh-dreams');
  const track = section?.querySelector('.oh-dreamspace');
  const pin = track?.querySelector('.oh-dreamspace-pin');
  const cards = pin?.querySelector('.oh-dreamspace-stage');
  const head = section?.querySelector('.oh-section-head');
  const closing = pin?.querySelector('.oh-dreams-closing');
  const understanding = document.querySelector('.oh-understand');
  const map = understanding?.querySelector('.oh-starmap');
  if (!cards || !head || !map || !closing) return null;
  // Preserve the gallery/analysis distance; give each account its own reading slot.
  const dreamCount = map.querySelectorAll('.oh-starmap-dream').length;
  track.style.height = `${100 + 336 + dreamCount * 90}svh`;
  const distances = () => ({ prelude: pin.clientHeight * 3.36, map: pin.clientHeight * dreamCount * 0.9 });
  const seekProgress = (p, options) => {
    const d = distances();
    const offset = p <= 0.56 ? p / 0.56 * d.prelude : d.prelude + (p - 0.56) / 0.44 * d.map;
    seek(window.scrollY + track.getBoundingClientRect().top + offset, options);
  };
  const labels = {
    en: 'Discover what connects them', fr: 'Découvre ce qui les relie',
    de: 'Entdecke, was sie verbindet', es: 'Descubre qué los conecta',
    it: 'Scopri cosa li collega', pt: 'Descubra o que os conecta',
  };
  const copy = [head.querySelector('h2').textContent, closing.textContent,
    labels[document.documentElement.lang.slice(0, 2)] || labels.en];
  const progressLabels = {
    en: 'Scroll to explore', fr: 'Défile pour explorer', de: 'Scrollen zum Entdecken',
    es: 'Desliza para explorar', it: 'Scorri per esplorare', pt: 'Role para explorar',
  };
  const progress = document.createElement('div');
  progress.className = 'oh-journey-progress';
  progress.setAttribute('role', 'group');
  progress.setAttribute('aria-label', progressLabels[document.documentElement.lang.slice(0, 2)] || progressLabels.en);
  progress.innerHTML = '<span class="oh-journey-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span class="oh-journey-progress-fill"></span></span>';
  const meter = progress.querySelector('[role=progressbar]');
  meter.setAttribute('aria-label', progress.getAttribute('aria-label'));
  const fill = progress.querySelector('.oh-journey-progress-fill');
  const dots = copy.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'oh-journey-progress-dot';
    dot.style.top = `${i * 100 / 3}%`;
    dot.setAttribute('aria-label', copy[i]);
    dot.addEventListener('click', () => {
      seekProgress([0.015, 0.255, 0.565][i]);
    });
    progress.append(dot);
    return dot;
  });
  const title = document.createElement('h2');
  title.className = 'oh-h2 oh-journey-title';
  const phrases = copy.map((text) => {
    const phrase = document.createElement('span');
    phrase.className = 'oh-journey-phrase oh-word-reveal';
    phrase.setAttribute('aria-hidden', 'true');
    text.trim().split(/(\s+)/).forEach((word, index) => {
      if (!word.trim()) { phrase.append(document.createTextNode(word)); return; }
      const span = document.createElement('span');
      span.className = 'oh-dream-heading-word';
      span.textContent = word;
      span.style.setProperty('--word-delay', `${Math.floor(index / 2) * 70}ms`);
      phrase.append(span);
    });
    title.append(phrase);
    return phrase;
  });
  const marker = document.createComment('constellation position for static fallback');
  map.before(marker);
  pin.prepend(title);
  pin.append(map, progress);
  const analysis = createDreamAnalysisDemo(pin, cards);
  head.classList.add('oh-journey-source');
  closing.classList.add('oh-journey-source');
  understanding.classList.add('oh-journey-source');
  document.documentElement.classList.add('exp-journey');
  let ready = false, active = -1, frame = 0, seen = false;
  const state = { cardsProgress: 0, mapProgress: 0, mapActive: false, cardsActive: true };
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const setStyle = (el, name, value) => { if (el.style[name] !== value) el.style[name] = value; };
  let lastIndex = -1, lastPercent = -1;
  const update = () => {
    frame = 0;
    const rect = track.getBoundingClientRect();
    const d = distances();
    const offset = -rect.top;
    const p = clamp(offset <= d.prelude ? offset / d.prelude * 0.56 : 0.56 + (offset - d.prelude) / d.map * 0.44);
    const blend = clamp((p - 0.48) / 0.08);
    const galleryFade = clamp((p - 0.18) / 0.055);
    analysis.update(p);
    const index = p < 0.18 ? 0 : p < 0.48 ? 1 : 2;
    const sectionProgress = index === 0 ? p / 0.18 : index === 1 ? 1 + (p - 0.18) / 0.30 : 2 + (p - 0.48) / 0.52;
    fill.style.transform = `scaleY(${clamp(sectionProgress / 3)})`;
    const percent = Math.round(p * 100);
    if (percent !== lastPercent) { lastPercent = percent; meter.setAttribute('aria-valuenow', String(percent)); }
    if (index !== lastIndex) {
      lastIndex = index;
      meter.setAttribute('aria-valuetext', `${index + 1}/3 — ${copy[index]}`);
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-current', i === index);
        dot.classList.toggle('is-past', i < index);
        if (i === index) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
      });
    }
    state.cardsProgress = Math.min(0.68, p / 0.235 * 0.68);
    state.mapProgress = clamp((p - 0.56) / 0.44);
    state.mapActive = blend >= 0.5;
    const wasActive = state.cardsActive;
    state.cardsActive = galleryFade < 1;
    if (wasActive !== state.cardsActive) document.dispatchEvent(new Event('dream-journey-change'));
    setStyle(cards, 'opacity', String(1 - galleryFade));
    if (cards.inert !== !state.cardsActive) cards.inert = !state.cardsActive;
    setStyle(cards, 'visibility', state.cardsActive ? '' : 'hidden');
    setStyle(map, 'opacity', String(blend));
    setStyle(map, 'visibility', blend > 0 ? 'visible' : 'hidden');
    if (map.inert !== !state.mapActive) map.inert = !state.mapActive;
    const visible = ready && seen && !document.documentElement.matches('.exp-intro-pending, .oh-sky-expanding');
    if (progress.hidden !== !visible) progress.hidden = !visible;
    if (!visible) return;
    if (index === active) return;
    active = index;
    phrases.forEach((phrase, i) => {
      phrase.classList.toggle('is-current', i === index);
      phrase.classList.toggle('is-reading', i === index);
      phrase.setAttribute('aria-hidden', String(i !== index));
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const observer = new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting && entry.intersectionRatio >= 0.5;
    schedule();
  }, { threshold: [0, 0.5] });
  observer.observe(title);
  const gates = new MutationObserver(schedule);
  gates.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  heroReady.then(() => { ready = true; schedule(); });
  update();
  return Object.assign(state, {
    seekMap(p, options) { seekProgress(0.56 + clamp(p) * 0.44, options); },
    restore() {
      state.mapCleanup?.();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect(); gates.disconnect();
      track.style.height = '';
      marker.replaceWith(map); title.remove(); progress.remove(); analysis.destroy();
      [head, closing, understanding].forEach(el => el.classList.remove('oh-journey-source'));
      [map, cards].forEach(el => { el.style.opacity = ''; el.style.visibility = ''; el.inert = false; });
      document.documentElement.classList.remove('exp-journey');
    },
  });
}
