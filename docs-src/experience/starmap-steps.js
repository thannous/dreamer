import { createDreamSymbolFlight } from './dream-symbol-flight.js';

export function mapStepAt(progress, count) {
  const position = Math.max(0, Math.min(1, progress)) * count;
  const index = Math.min(count - 1, Math.floor(position));
  const local = Math.min(1, position - index);
  return { index, flight: Math.max(0, Math.min(1, (local - 0.05) / 0.75)) };
}

/** Equal reading slots, reversible comets and an exact alternative to scrolling. */
export function initStarmapSteps(root, dreams, stars, journey, setStep) {
  const flights = dreams.map(({ el }) => {
    const text = el.querySelector('.oh-starmap-text');
    const words = [];
    [...text.childNodes].forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) {
        node.classList.add('oh-type-word'); words.push(node); return;
      }
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part.trim()) { fragment.append(part); return; }
        const word = document.createElement('span');
        word.className = 'oh-type-word'; word.textContent = part;
        words.push(word); fragment.append(word);
      });
      node.replaceWith(fragment);
    });
    return createDreamSymbolFlight(words, text, stars, false);
  });
  const labels = {
    en: ['Previous dream', 'Next dream'], fr: ['Rêve précédent', 'Rêve suivant'],
    de: ['Vorheriger Traum', 'Nächster Traum'], es: ['Sueño anterior', 'Sueño siguiente'],
    it: ['Sogno precedente', 'Sogno successivo'], pt: ['Sonho anterior', 'Próximo sonho'],
  }[document.documentElement.lang.slice(0, 2)] || ['Previous dream', 'Next dream'];
  const controls = document.createElement('div');
  controls.className = 'oh-starmap-controls';
  const counter = root.querySelector('.oh-starmap-progress');
  counter.removeAttribute('aria-hidden');
  counter.setAttribute('aria-live', 'polite'); counter.setAttribute('aria-atomic', 'true');
  counter.before(controls);
  let current = 0, frame = 0, previous = -1;
  const buttons = [-1, 1].map((direction, i) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'oh-starmap-nav'; button.textContent = direction < 0 ? '←' : '→';
    button.setAttribute('aria-label', labels[i]); button.title = labels[i];
    button.addEventListener('click', event => {
      const target = Math.max(0, Math.min(dreams.length - 1, current + direction));
      const end = (target + 0.88) / dreams.length;
      const immediate = event.detail === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (immediate) {
        journey.seekMap(end, { immediate: true });
        return;
      }
      // Open the requested account first, then give its words and comets a full
      // six seconds. Linear progress avoids the default scroll easing rushing
      // the reading phase; wheel/touch input can still interrupt the sequence.
      journey.seekMap((target + 0.05) / dreams.length, { immediate: true });
      journey.seekMap(end, { duration: 6, easing: progress => progress });
    });
    return button;
  });
  controls.append(buttons[0], counter, buttons[1]);
  const update = () => {
    frame = 0;
    const { index, flight } = mapStepAt(journey.mapProgress, dreams.length);
    current = index;
    if (previous !== index) {
      if (previous >= 0) flights[previous](0, false);
      dreams.forEach(({ el }, i) => {
        el.inert = i !== index;
        el.setAttribute('aria-hidden', String(i !== index));
      });
      previous = index;
    }
    setStep(index + (flight === 1 ? 1 : 0), index);
    const arrived = flights[index](flight, journey.mapActive);
    const prior = new Set(dreams.slice(0, index).flatMap(dream => dream.syms));
    stars.forEach((star, symbol) => {
      star.classList.toggle('is-born', prior.has(symbol) || arrived.includes(symbol));
      star.classList.toggle('is-glow', arrived.includes(symbol));
    });
    buttons[0].disabled = index === 0;
    buttons[1].disabled = index === dreams.length - 1;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    flights.forEach(flight => flight.destroy());
    controls.before(counter); controls.remove();
    dreams.forEach(({ el }) => { el.inert = false; el.removeAttribute('aria-hidden'); });
  };
}
