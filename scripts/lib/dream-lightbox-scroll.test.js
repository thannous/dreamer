'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('an open dream preserves native touch and wheel scrolling while the background is locked', async () => {
  const dom = new JSDOM(`<section class="oh-dreams"><article class="oh-dream">
    <img class="oh-dream-img" src="/dream.webp" data-full="/dream.webp">
    <p class="oh-dream-meta">Sep 23</p><h3 class="oh-dream-title">A dream</h3>
    <p class="oh-dream-excerpt">A house.</p><p class="oh-dream-rest">An unknown staircase.</p>
    <ul class="oh-dream-symbols"><li>House</li></ul><button class="oh-dream-open">Open</button>
  </article></section>`, { url: 'https://example.org', pretendToBeVisual: true });
  const saved = {};
  for (const key of ['window', 'document', 'HTMLElement', 'Window', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    globalThis[key] = dom.window[key];
  }
  let lenis;
  try {
    const { default: Lenis } = await import('lenis');
    lenis = new Lenis({ autoResize: false, autoRaf: false });
    const source = fs.readFileSync(path.join(__dirname, '../../docs-src/experience/experience.js'), 'utf8');
    const lightbox = source.slice(source.indexOf('const initLightbox ='), source.indexOf('/* Waking:'));
    const init = new Function('document', 'window', 'Image', 'Event', 'activeLenis', 'EASE_FILM', `${lightbox}; return initLightbox;`)(
      dom.window.document, dom.window, dom.window.Image, dom.window.Event, lenis, 'ease'
    );
    init({ pause() {}, resume() {} });
    dom.window.document.querySelector('.oh-dream-open').click();
    const panel = dom.window.document.querySelector('.oh-lightbox-panel');
    assert(panel);
    assert(lenis.isStopped);
    const input = type => {
      const event = new dom.window.Event(type, { cancelable: true });
      event.composedPath = () => [panel.querySelector('.oh-lightbox-transcript'), panel, panel.parentElement, document.body, document.documentElement, window];
      lenis.onVirtualScroll({ deltaX: 0, deltaY: 80, event });
      return event.defaultPrevented;
    };
    for (const type of ['wheel', 'touchmove']) assert.equal(input(type), false, `${type} stays native in the dream`);
    // Control: demonstrate the original regression with the installed Lenis.
    panel.removeAttribute('data-lenis-prevent');
    for (const type of ['wheel', 'touchmove']) assert.equal(input(type), true, `${type} was blocked without the exclusion`);
    panel.setAttribute('data-lenis-prevent', '');
    panel.querySelector('.oh-lightbox-close').click();
    await new Promise(resolve => setTimeout(resolve, 220));
    assert.equal(lenis.isStopped, false);
    assert.equal(document.querySelector('.oh-lightbox'), null);
    assert.equal(document.documentElement.classList.contains('oh-lightbox-open'), false);
  } finally {
    lenis?.destroy(); dom.window.close();
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
