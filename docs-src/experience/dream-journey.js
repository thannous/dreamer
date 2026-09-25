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
      const rect = track.getBoundingClientRect();
      seek(window.scrollY + rect.top + [0.015, 0.255, 0.565][i] * Math.max(1, rect.height - window.innerHeight));
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
  const update = () => {
    frame = 0;
    const rect = track.getBoundingClientRect();
    const p = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
    const blend = clamp((p - 0.48) / 0.08);
    const galleryFade = clamp((p - 0.18) / 0.055);
    analysis.update(p);
    const index = p < 0.18 ? 0 : p < 0.48 ? 1 : 2;
    const sectionProgress = index === 0 ? p / 0.18 : index === 1 ? 1 + (p - 0.18) / 0.30 : 2 + (p - 0.48) / 0.52;
    fill.style.transform = `scaleY(${clamp(sectionProgress / 3)})`;
    meter.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    meter.setAttribute('aria-valuetext', `${index + 1}/3 — ${copy[index]}`);
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.classList.toggle('is-past', i < index);
      if (i === index) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    state.cardsProgress = Math.min(0.68, p / 0.235 * 0.68);
    state.mapProgress = clamp((p - 0.56) / 0.44);
    state.mapActive = blend >= 0.5;
    state.cardsActive = galleryFade < 1;
    cards.style.opacity = String(1 - galleryFade);
    cards.inert = !state.cardsActive;
    cards.style.visibility = state.cardsActive ? '' : 'hidden';
    map.style.opacity = String(blend);
    map.style.visibility = blend > 0 ? 'visible' : 'hidden';
    map.inert = !state.mapActive;
    const visible = ready && seen && !document.documentElement.matches('.exp-intro-pending, .oh-sky-expanding');
    progress.hidden = !visible;
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
    restore() {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect(); gates.disconnect();
      marker.replaceWith(map); title.remove(); progress.remove(); analysis.destroy();
      [head, closing, understanding].forEach(el => el.classList.remove('oh-journey-source'));
      [map, cards].forEach(el => { el.style.opacity = ''; el.style.visibility = ''; el.inert = false; });
      document.documentElement.classList.remove('exp-journey');
    },
  });
}
