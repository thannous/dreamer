import { readFileSync } from 'node:fs';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';

// What the site journeys (tests/site*.web.e2e.ts) share. The engine runs each test file on one
// worker, so the long site campaign is split into files that run side by side.

// Every built page loads the production Ahrefs script (scripts/lib/ahrefs-analytics.js):
// answer it with an empty script so local runs send it nothing, without logging an
// aborted request on each page. scripts/check-docs-shell.js still checks the tag.
export const answerAnalytics = ({ browser }: { browser: Browser }) => browser.route(/^https:\/\/analytics\.ahrefs\.com\//, route => route.fulfill({ contentType: 'text/javascript', body: '' }));

export const mediaPathname = (url: string) => new URL(url, 'https://noctalia.app').pathname.replace(/^\/releases\/[a-f0-9]{64}(?=\/img\/)/, '');

export function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' });
  return window.scrollY;
}

export function readAtlasSix() {
  const hero = document.querySelector<HTMLElement>('.symbol-hero')!;
  const figure = hero.querySelector<HTMLElement>('.symbol-hero-figure')!;
  const img = hero.querySelector<HTMLImageElement>('.symbol-hero-media img')!;
  const config = JSON.parse(document.getElementById('symbol-living-config')?.textContent ?? 'null') as {
    surfaces: Array<{ name: string; depth?: number; scenes: Record<string, { match: string; layers: { channel: string; src: string }[] }> }>;
  } | null;
  const flat = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, '');
  const box = (node: Element | null) => {
    if (!node || getComputedStyle(node).display === 'none') return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width, height: r.height };
  };
  const shown = Array.from(document.querySelectorAll<HTMLElement>('.atlas-scene-result')).filter(node => getComputedStyle(node).display !== 'none');
  const checked = document.querySelector<HTMLInputElement>('.atlas-scene-input:checked');
  // The label and the card title may differ only by a non-breaking space (French « : »).
  const spaced = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const label = checked ? spaced(document.querySelector(`label[for="${checked.id}"] .atlas-scene-label`)) : null;
  const card = Array.from(document.querySelectorAll('#variations .variation-card')).find(node => spaced(node.querySelector('h3')) === label);
  const transform = getComputedStyle(figure).transform.match(/^matrix\(([^)]+)\)$/);
  const animations = document.getAnimations().filter(animation => animation instanceof CSSAnimation && (animation.effect as KeyframeEffect | null)?.target?.closest('.slp-stage'));
  const cs = getComputedStyle(img);
  const painted = cs.objectFit === 'cover' && img.naturalWidth
    ? img.naturalWidth * Math.max(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
    : img.clientWidth;
  return {
    config,
    living: hero.getAttribute('data-living'),
    scene: hero.getAttribute('data-living-scene'),
    state: hero.getAttribute('data-living-motion-state'),
    reasons: hero.getAttribute('data-living-motion-reasons'),
    src: img.currentSrc,
    objectFit: cs.objectFit,
    painted,
    hero: box(hero)!,
    viewport: { width: document.documentElement.clientWidth, height: innerHeight },
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollY: window.scrollY,
    figureShift: transform ? Number(transform[1].split(',')[5]) : 0,
    paintingAnimations: img.getAnimations().length + figure.getAnimations().filter(animation => animation instanceof CSSAnimation).length,
    // Every layer animation moves transform and opacity only.
    properties: [...new Set(animations.flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes().flatMap(frame => Object.keys(frame).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)))))].sort(),
    // A moving layer swings around its rest position: it starts on the mirror of its last translation
    // (a start the browser rejected reads as none).
    unbalanced: animations.filter(animation => {
      const frames = (animation.effect as KeyframeEffect).getKeyframes();
      if (!frames.some(frame => frame.transform && frame.transform !== 'none')) return false;
      const at = (frame: ComputedKeyframe) => String(frame.transform ?? '').match(/^translate3d\((-?[\d.]+)%, (-?[\d.]+)%, 0px\)$/);
      const start = at(frames[0]), end = at(frames[frames.length - 1]);
      return !start || !end || Number(start[1]) !== -Number(end[1]) || Number(start[2]) !== -Number(end[2]);
    }).map(animation => (animation as CSSAnimation).animationName),
    playStates: [...new Set(animations.map(animation => animation.playState))],
    toggles: hero.querySelectorAll('.slp-toggle').length,
    article: box(document.querySelector('article.atlas')),
    rail: box(document.querySelector('.atlas-rail')),
    list: box(document.querySelector('.atlas-scene-list')),
    reflection: box(document.querySelector('.atlas-reflection')),
    reading: box(document.querySelector('.atlas-reading')),
    decor: box(document.querySelector('.atlas-decor')),
    plate: document.querySelector('.atlas-decor')?.getAttribute('data-living-surface') ?? null,
    // Each thumbnail keeps its effects inside its own frame, clear of its label.
    thumbsClear: Array.from(document.querySelectorAll('.atlas-scene-thumb')).map(thumb => {
      const frame = thumb.getBoundingClientRect(), text = thumb.closest('label')!.querySelector('.atlas-scene-text')!.getBoundingClientRect();
      return getComputedStyle(thumb).overflow === 'hidden' && frame.right <= text.left + 0.5;
    }),
    // The tiger's UI colours, never a per-symbol tint.
    colours: [
      getComputedStyle(document.querySelector('.aurora-bg')!).backgroundImage,
      getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.querySelector('.atlas-kicker')!).color,
      getComputedStyle(document.querySelector('article.atlas .symbol-h2')!).color,
      getComputedStyle(document.querySelector('.atlas-scene-input:checked + .atlas-scene')!).borderTopColor,
      getComputedStyle(document.querySelector('.atlas-scene-input:checked + .atlas-scene .atlas-scene-mark')!).backgroundColor,
      getComputedStyle(document.querySelector('.atlas-primary')!).backgroundColor,
    ],
    zones: { meaning: flat(document.querySelector('#meaning')), lecture: flat(document.querySelector('#lecture')), variations: flat(document.querySelector('#variations')) },
    counts: {
      opening: document.querySelectorAll('#meaning .prose > p').length,
      continuation: document.querySelectorAll('#lecture .prose > p').length,
      variations: document.querySelectorAll('#variations .variation-card').length,
      questions: document.querySelectorAll('#questions .symbol-question-item').length,
      faq: document.querySelectorAll('#faq .symbol-faq-card').length,
      faqSchema: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(node => JSON.parse(node.textContent!)).find(node => node['@type'] === 'FAQPage')?.mainEntity.length ?? 0,
      thumbnails: document.querySelectorAll('.atlas-scene-thumb').length,
    },
    checked: checked?.value ?? null,
    shown: shown.map(node => ({ scene: node.dataset.scene ?? '', inReading: Boolean(node.closest('.atlas-reflection')), text: flat(node.querySelector('.atlas-scene-question')) + flat(node.querySelector('.atlas-scene-excerpt')) })),
    card: card ? flat(card.querySelector('p')) : null,
    navGround: getComputedStyle(document.querySelector('#navbar')!).backgroundColor,
  };
}

export type AtlasSix = Awaited<ReturnType<typeof readAtlasSix>>;

// The reading beside the list is the chosen published variation card, whole.
export const expectSixScene = (read: AtlasSix, scene: string) => {
  expect(read.checked).toBe(scene);
  expect(read.shown.map(shown => [shown.scene, shown.inReading])).toEqual([[scene, true]]);
  expect(read.shown[0].text).toBe(read.card ?? 'no card');
};

export const ATLAS_SIX_PAUSE = 'Pause des animations des illustrations';

// Every painting of the page (hero, side illustration, thumbnails): its state, and for each
// effect of the scene it shows, its channel, its texture (decoded, with visible pixels where the
// page shows it) and its current opacity and transform.
export function readSurfaces() {
  return Array.from(document.querySelectorAll<HTMLElement>('.symbol-hero, [data-living-surface]')).map(node => {
    const layers = Array.from(node.querySelectorAll<HTMLElement>('.slp-scene'))
      .filter(scene => getComputedStyle(scene).display !== 'none')
      .flatMap(scene => Array.from(scene.querySelectorAll<HTMLElement>('.slp-l')));
    // The texture's visible pixels: as rendered now (its motion included), cut to every box that clips
    // it up to the surface (its layer, the stage on the painted frame, the frame of a thumbnail), and on
    // a masked stage (the side illustration) kept only where the painting's own alpha lets it through.
    // A texture moved off the frame or into a hole of the mask counts none.
    const opaque = (texture: HTMLImageElement | null) => {
      if (!texture || !texture.naturalWidth) return 0;
      const drawn = texture.getBoundingClientRect();
      const clip = { left: drawn.left, top: drawn.top, right: drawn.right, bottom: drawn.bottom };
      for (let box = texture.parentElement; box && box !== node.parentElement; box = box.parentElement) {
        const style = getComputedStyle(box), r = box.getBoundingClientRect();
        if (style.overflowX !== 'visible') [clip.left, clip.right] = [Math.max(clip.left, r.left), Math.min(clip.right, r.right)];
        if (style.overflowY !== 'visible') [clip.top, clip.bottom] = [Math.max(clip.top, r.top), Math.min(clip.bottom, r.bottom)];
      }
      if (clip.right - clip.left < 1 || clip.bottom - clip.top < 1) return 0;
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = Math.max(8, Math.round(96 * (clip.bottom - clip.top) / (clip.right - clip.left)));
      const context = canvas.getContext('2d')!;
      const scaleX = canvas.width / (clip.right - clip.left), scaleY = canvas.height / (clip.bottom - clip.top);
      const paint = (image: HTMLImageElement, r: DOMRect) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (r.left - clip.left) * scaleX, (r.top - clip.top) * scaleY, r.width * scaleX, r.height * scaleY);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const pixels = paint(texture, drawn);
      // The mask is the painting stretched over the stage (mask-size: 100% 100%).
      const stage = texture.closest('.slp-stage');
      const painting = node.querySelector<HTMLImageElement>('img:not(.slp-t)');
      const mask = stage?.classList.contains('slp-stage--masked') && painting ? paint(painting, stage.getBoundingClientRect()) : null;
      let count = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 8 && (!mask || mask[index] > 8)) count += 1;
      return count;
    };
    return {
      name: node.dataset.livingSurface ?? 'hero',
      living: node.dataset.living ?? null,
      state: node.dataset.livingMotionState ?? null,
      reasons: (node.dataset.livingMotionReasons ?? '').split(' ').filter(Boolean),
      channels: layers.map(layer => layer.dataset.livingChannel ?? ''),
      animationStates: node.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation).map(animation => animation.playState),
      textures: layers.map(layer => layer.querySelector<HTMLImageElement>('img.slp-t')?.currentSrc.replace(/^.*\//, '') ?? ''),
      opaque: layers.map(layer => opaque(layer.querySelector<HTMLImageElement>('img.slp-t'))),
      frames: layers.map(layer => { const style = getComputedStyle(layer.querySelector('.slp-t')!); return style.opacity + ' ' + style.transform; }),
      // How far each texture's drawn ratio departs from its own (0: never stretched).
      stretch: layers.map(layer => {
        const texture = layer.querySelector<HTMLImageElement>('img.slp-t');
        const drawn = texture?.getBoundingClientRect();
        if (!texture || !drawn || !drawn.height || !texture.naturalHeight) return 1;
        return Math.abs(drawn.width / drawn.height / (texture.naturalWidth / texture.naturalHeight) - 1);
      }),
    };
  });
}

export const surfaceNamed = (all: Awaited<ReturnType<typeof readSurfaces>>, name: string) => all.find(surface => surface.name === name)!;

export async function expectReducedSurfaces(browser: Browser) {
  // Hidden expanded choices can remain unmounted until selected. They have no
  // effects to stop; every mounted painting and every original surface must stop.
  await expect.poll(() => browser.evaluate(readSurfaces).then(all => all.every(surface =>
    surface.animationStates.length === 0 && (surface.state === 'reduced'
      || (surface.name.endsWith('-expanded') && surface.state === null && surface.channels.length === 0))
  ))).toBe(true);
}

// Missing-symbol work package: the literal list stays independent of the activation config.
// These journeys catch a decoded-but-wrong portrait, a transparent rectangle, an effect placed
// entirely outside a crop, a scene with the wrong editorial reading, and a moving base painting.
export const NEW_SYMBOL_PACKS = [
  {"id": "god", "slug": "dieu", "name": "Dieu", "scenes": ["hearing-god-s-voice", "seeing-god-as-a-light-or-a-figure", "praying-to-god"]},
  {"id": "sky", "slug": "ciel", "name": "Ciel", "scenes": ["a-clear-blue-sky", "a-dark-or-stormy-sky", "strange-lights-or-objects-in-the-sky"]},
  {"id": "coffin", "slug": "cercueil", "name": "Cercueil", "scenes": ["a-closed-coffin", "lying-in-a-coffin-yourself", "an-empty-coffin"]},
  {"id": "gold", "slug": "or", "name": "Or", "scenes": ["finding-gold-or-a-treasure", "receiving-gold-jewelry", "gold-coins"]},
  {"id": "doll", "slug": "poupee", "name": "Poupée", "scenes": ["a-doll-from-your-childhood", "a-doll-that-moves-talks-or-comes-alive", "a-broken-or-damaged-doll"]},
  {"id": "wallet", "slug": "portefeuille", "name": "Portefeuille", "scenes": ["losing-your-wallet", "finding-a-wallet", "an-empty-wallet"]},
  {"id": "knife", "slug": "couteau", "name": "Couteau", "scenes": ["being-threatened-or-chased-with-a-knife", "holding-a-knife-or-stabbing-someone", "a-knife-in-the-kitchen-or-on-the-table"]},
  {"id": "gun", "slug": "arme-a-feu", "name": "Arme à feu / Pistolet", "scenes": ["a-gun-that-jams-or-won-t-fire", "finding-or-carrying-a-gun", "gunshots-in-the-distance"]},
  {"id": "clown", "slug": "clown", "name": "Clown", "scenes": ["a-scary-or-evil-clown", "a-sad-or-crying-clown", "a-clown-at-a-party-or-a-circus"]},
  {"id": "witch", "slug": "sorciere", "name": "Sorcière", "scenes": ["a-witch-casting-a-spell-on-you", "a-kind-witch-or-a-healer", "a-witch-s-house-cauldron-or-potion"]},
  {"id": "crush", "slug": "crush", "name": "Crush", "scenes": ["your-crush-likes-you-back", "your-crush-ignores-or-rejects-you", "your-crush-with-someone-else"]},
  {"id": "boss", "slug": "patron", "name": "Patron / Chef", "scenes": ["being-fired-by-your-boss", "arguing-with-your-boss-or-being-yelled", "your-boss-praising-or-promoting-you"]},
  {"id": "celebrity", "slug": "celebrite", "name": "Célébrité", "scenes": ["meeting-a-celebrity", "a-celebrity-who-ignores-you", "becoming-famous-yourself"]},
  {"id": "alien", "slug": "extraterrestre", "name": "Extraterrestre", "scenes": ["being-abducted-by-aliens", "seeing-a-ufo-in-the-sky", "talking-with-a-friendly-alien"]},
  {"id": "swimming-pool", "slug": "piscine", "name": "Piscine", "scenes": ["swimming-in-clear-calm-water", "cloudy-or-dirty-pool-water", "an-empty-swimming-pool"]},
  {"id": "beach", "slug": "plage", "name": "Plage", "scenes": ["a-deserted-beach", "a-beach-at-night", "rising-waves-or-a-storm-on-the-beach"]},
  {"id": "church", "slug": "eglise", "name": "Église", "scenes": ["an-empty-silent-church", "praying-or-confessing-in-a-church", "a-church-in-ruins-or-abandoned"]},
  {"id": "toilet", "slug": "toilettes", "name": "Toilettes", "scenes": ["a-blocked-or-overflowing-toilet", "a-toilet-in-full-view-or-with-no-door", "cleaning-a-toilet"]},
  {"id": "bat", "slug": "chauve-souris", "name": "Chauve-souris", "scenes": ["a-bat-flying-in-the-house", "many-bats-or-a-swarm-at-dusk", "a-bat-hanging-upside-down"]},
  {"id": "lizard", "slug": "lezard", "name": "Lézard", "scenes": ["a-lizard-in-the-house-or-in-bed", "a-large-lizard-or-an-iguana", "a-lizard-basking-in-the-sun"]},
  {"id": "monkey", "slug": "singe", "name": "Singe", "scenes": ["a-monkey-stealing-something", "a-monkey-copying-you", "a-baby-monkey-or-a-pet-monkey"]},
  {"id": "pig", "slug": "cochon", "name": "Cochon", "scenes": ["a-pig-in-the-mud", "piglets", "a-pig-in-the-house"]},
  {"id": "deer", "slug": "cerf", "name": "Cerf / Biche", "scenes": ["a-deer-on-the-road-at-night", "a-deer-coming-closer-or-eating-from-you", "a-stag-with-large-antlers"]},
  {"id": "tsunami", "slug": "tsunami", "name": "Tsunami / Raz-de-marée", "scenes": ["seeing-a-giant-wave-on-the-horizon", "running-from-a-tsunami", "surviving-a-tsunami"]},
  {"id": "nails", "slug": "ongles", "name": "Ongles", "scenes": ["a-broken-or-split-nail", "long-or-painted-nails", "cutting-your-nails"]},
  {"id": "vomiting", "slug": "vomir", "name": "Vomir", "scenes": ["vomiting-in-public", "vomiting-and-feeling-relief", "feeling-sick-but-unable-to-vomit"]},
  {"id": "war", "slug": "guerre", "name": "Guerre", "scenes": ["bombs-sirens-or-an-air-raid", "fleeing-a-war-or-hiding", "the-war-ends-or-peace-returns"]},
  {"id": "moving-house", "slug": "demenagement", "name": "Déménagement", "scenes": ["moving-into-a-new-home", "packing-boxes-that-never-end", "moving-back-to-an-old-home"]},
  {"id": "kidnapping", "slug": "enlevement", "name": "Enlèvement", "scenes": ["being-kidnapped-by-a-stranger", "being-held-captive", "escaping-from-kidnappers"]},
  {"id": "eating", "slug": "manger", "name": "Manger / Nourriture", "scenes": ["a-feast-or-a-generous-table", "being-hungry-and-never-getting-to-eat", "sharing-a-meal-with-someone"]},
  {"id": "fighting", "slug": "se-battre", "name": "Se battre / Bagarre", "scenes": ["fighting-a-stranger", "punches-with-no-strength", "watching-others-fight-or-trying-to-stop"]},
  {"id": "killing", "slug": "tuer", "name": "Tuer quelqu'un", "scenes": ["killing-in-self-defense", "killing-someone-by-accident", "hiding-a-body-or-running-from-the-polic"]},
  {"id": "attack", "slug": "etre-attaque", "name": "Être attaqué / Agression", "scenes": ["attacked-by-a-stranger", "attacked-by-someone-you-know", "an-intruder-attacking-you-at-home"]},
  {"id": "kissing", "slug": "embrasser", "name": "Embrasser / Baiser", "scenes": ["kissing-your-crush", "kissing-an-ex", "kissing-a-friend"]},
  {"id": "cheating", "slug": "infidelite", "name": "Infidélité / Être trompé", "scenes": ["your-partner-cheating-on-you", "your-partner-cheating-with-your-best-fr", "cheating-on-your-partner"]},
  {"id": "sex", "slug": "sexe", "name": "Sexe / Faire l'amour", "scenes": ["sex-with-your-partner", "sex-with-a-stranger", "being-interrupted-or-walked-in-on"]},
  {"id": "wasp", "slug": "guepes", "name": "Guêpes", "scenes": ["a-wasp-sting", "a-wasp-nest", "a-calm-wasp-that-does-not-sting"]},
  {"id": "cemetery", "slug": "cimetiere", "name": "Cimetière", "scenes": ["walking-through-a-cemetery-at-night", "looking-for-a-specific-grave", "a-peaceful-cemetery-in-daylight"]},
  {"id": "scorpion", "slug": "scorpion", "name": "Scorpion", "scenes": ["a-scorpion-sting", "a-calm-scorpion", "many-scorpions"]},
  {"id": "lice", "slug": "poux", "name": "Poux", "scenes": ["lice-in-your-hair", "removing-or-killing-lice", "many-lice"]},
  {"id": "crocodile", "slug": "crocodile", "name": "Crocodile", "scenes": ["a-crocodile-in-the-water", "being-chased-by-a-crocodile", "a-calm-or-friendly-crocodile"]},
  {"id": "shoes", "slug": "chaussures", "name": "Chaussures", "scenes": ["lost-shoes", "new-shoes", "broken-or-worn-out-shoes"]},
  {"id": "cockroach", "slug": "cafard", "name": "Cafard", "scenes": ["a-single-cockroach", "many-cockroaches-or-an-infestation", "a-cockroach-in-bed-or-on-your-body"]},
  {"id": "worms", "slug": "vers", "name": "Vers", "scenes": ["worms-in-the-soil", "maggots-or-white-worms", "worms-in-food"]},
  {"id": "excrement", "slug": "caca", "name": "Caca", "scenes": ["poop-in-a-toilet", "cleaning-poop", "poop-in-the-mouth-or-on-the-body"]},
  {"id": "lake", "slug": "lac", "name": "Lac", "scenes": ["a-calm-clear-lake", "a-dark-or-murky-lake", "swimming-in-a-lake"]},
  {"id": "river", "slug": "riviere", "name": "Rivière", "scenes": ["a-calm-clear-river", "a-fast-or-raging-river", "swept-away-by-the-current"]},
  {"id": "island", "slug": "ile", "name": "Île", "scenes": ["stranded-on-a-deserted-island", "a-paradise-island", "unable-to-leave-the-island"]},
  {"id": "garden", "slug": "jardin", "name": "Jardin", "scenes": ["a-garden-in-bloom", "an-overgrown-or-neglected-garden", "a-dry-or-dying-garden"]},
  {"id": "crow", "slug": "corbeau", "name": "Corbeau", "scenes": ["a-crow-watching-you", "a-crow-calling-loudly", "a-flock-of-crows"]},
  {"id": "eagle", "slug": "aigle", "name": "Aigle", "scenes": ["an-eagle-soaring-high", "flying-with-an-eagle", "a-caged-eagle"]},
  {"id": "ant", "slug": "fourmi", "name": "Fourmi", "scenes": ["a-long-line-of-ants", "ants-in-the-house", "an-ant-carrying-a-heavy-load"]},
  {"id": "frog", "slug": "grenouille", "name": "Grenouille", "scenes": ["a-frog-jumping", "a-frog-in-the-house", "lots-of-frogs"]},
  {"id": "dolphin", "slug": "dauphin", "name": "Dauphin", "scenes": ["swimming-with-dolphins", "being-rescued-by-a-dolphin", "a-pod-of-dolphins"]},
  {"id": "shark", "slug": "requin", "name": "Requin", "scenes": ["a-fin-on-the-surface", "a-shark-circling-you", "swimming-calmly-among-sharks"]},
  {"id": "fish", "slug": "poisson", "name": "Poisson", "scenes": ["a-fish-swimming-in-clear-water", "catching-a-fish", "a-fish-in-a-bowl-or-an-aquarium"]},
  {"id": "elephant", "slug": "elephant", "name": "Éléphant", "scenes": ["a-calm-elephant", "a-baby-elephant", "a-herd-of-elephants"]},
  {"id": "bear", "slug": "ours", "name": "Ours", "scenes": ["being-chased-by-a-bear", "a-calm-or-friendly-bear", "a-sleeping-bear-or-a-den"]},
  {"id": "rat", "slug": "rat", "name": "Rat", "scenes": ["a-rat-running-past", "many-rats", "a-white-or-pet-rat"]},
  {"id": "mouse", "slug": "souris", "name": "Souris", "scenes": ["a-mouse-running-across-the-room", "mice-in-the-house", "a-white-mouse"]},
  {"id": "rabbit", "slug": "lapin", "name": "Lapin", "scenes": ["a-rabbit-running-away", "holding-or-stroking-a-rabbit", "a-white-rabbit"]},
  {"id": "cow", "slug": "vache", "name": "Vache", "scenes": ["a-cow-grazing-peacefully", "a-cow-charging-or-chasing-you", "milking-a-cow"]},
  {"id": "mall", "slug": "centre-commercial", "name": "Centre commercial", "scenes": ["getting-lost-in-a-mall", "looking-for-a-particular-shop", "shopping-with-pleasure"]},
  {"id": "hotel", "slug": "hotel", "name": "Hôtel", "scenes": ["looking-for-your-room-and-not-finding-i", "arriving-at-reception-with-no-booking", "a-luxury-hotel"]},
  {"id": "tornado", "slug": "tornade", "name": "Tornade", "scenes": ["a-tornado-on-the-horizon", "hiding-from-a-tornado", "being-swept-up-by-a-tornado"]},
  {"id": "snake", "slug": "serpent", "name": "Serpent", "scenes": ["morsure", "calme", "mue"]},
  {"id": "ocean", "slug": "mer", "name": "Mer / Océan", "scenes": ["calme", "tempete", "vague"]},
  {"id": "forest", "slug": "foret", "name": "Forêt", "scenes": ["sombre", "perdu", "chemin"]},
  {"id": "house", "slug": "maison", "name": "Maison", "scenes": ["inconnue", "enfance", "pieces"]},
  {"id": "falling", "slug": "chute", "name": "Chute", "scenes": ["hauteur", "sursaut", "voler"]},
  {"id": "butterfly", "slug": "papillon", "name": "Papillon", "scenes": ["pose", "chrysalide", "prisonnier"]},
  {"id": "moon", "slug": "lune", "name": "Lune", "scenes": ["pleine", "croissant", "double"]},
  {"id": "door", "slug": "porte", "name": "Porte", "scenes": ["ouverte", "verrouillee", "choix"]},
  {"id": "fire", "slug": "feu", "name": "Feu", "scenes": ["reconfort", "incendie", "fumee"]},
  {"id": "bird", "slug": "oiseau", "name": "Oiseau", "scenes": ["libre", "cage", "chant"]},
  {"id": "train", "slug": "train", "name": "Train", "scenes": ["voyage", "gare", "tunnel"]},
  {"id": "water", "slug": "eau", "name": "Eau", "scenes": ["claire", "trouble", "montee"]},
  {"id": "dog", "slug": "chien", "name": "Chien", "scenes": ["poursuite", "familier", "meute"]},
  {"id": "teeth", "slug": "dents", "name": "Dents (perdre ses dents)", "scenes": ["chute", "casse", "repousse"]},
  {"id": "flying", "slug": "voler", "name": "Voler", "scenes": ["libre", "difficile", "ras-sol"]},
  {"id": "car", "slug": "voiture", "name": "Voiture", "scenes": ["conduite", "passager", "panne"]},
  {"id": "bridge", "slug": "pont", "name": "Pont", "scenes": ["traversee", "rupture", "hesitation"]},
  {"id": "cat", "slug": "chat", "name": "Chat", "scenes": ["affectueux", "griffes", "noir"]},
  {"id": "mountain", "slug": "montagne", "name": "Montagne", "scenes": ["ascension", "sommet", "obstacle"]},
  {"id": "key", "slug": "cle", "name": "Clé", "scenes": ["trouver", "perdre", "serrure"]},
  {"id": "rain", "slug": "pluie", "name": "Pluie", "scenes": ["douce", "averse", "fenetre"]},
  {"id": "stairs", "slug": "escalier", "name": "Escalier", "scenes": ["monter", "descendre", "infini"]},
  {"id": "mirror", "slug": "miroir", "name": "Miroir", "scenes": ["reflet", "brise", "absent"]},
  {"id": "horse", "slug": "cheval", "name": "Cheval", "scenes": ["balade", "emballe", "liberte"]},
  {"id": "castle", "slug": "chateau", "name": "Château", "scenes": ["exploration", "grille", "ruine"]},
  {"id": "stars", "slug": "etoiles", "name": "Étoiles", "scenes": ["ciel", "filante", "guide"]},
  {"id": "flowers", "slug": "fleurs", "name": "Fleurs", "scenes": ["bouquet", "fanees", "prairie"]},
  {"id": "baby", "slug": "bebe", "name": "Bébé", "scenes": ["soins", "pleurs", "trouver"]},
  {"id": "storm", "slug": "orage", "name": "Orage", "scenes": ["approche", "expose", "abri"]},
  {"id": "wolf", "slug": "loup", "name": "Loup", "scenes": ["solitaire", "meute", "poursuite"]},
  {"id": "elevator", "slug": "ascenseur", "name": "Ascenseur", "scenes": ["montee", "descente", "bloque"]},
  {"id": "book", "slug": "livre", "name": "Livre", "scenes": ["illisible", "blanches", "bibliotheque"]},
  {"id": "snow", "slug": "neige", "name": "Neige", "scenes": ["chute", "bloque", "marche"]},
  {"id": "desert", "slug": "desert", "name": "Désert", "scenes": ["seul", "tempete", "oasis"]},
  {"id": "owl", "slug": "hibou", "name": "Hibou", "scenes": ["regard", "cri", "blanc"]},
  {"id": "boat", "slug": "bateau", "name": "Bateau", "scenes": ["calme", "tempete", "naufrage"]},
  {"id": "cave", "slug": "grotte", "name": "Grotte", "scenes": ["abri", "bloquee", "exploration"]},
  {"id": "rose", "slug": "rose", "name": "Rose", "scenes": ["rouge", "fanee", "epine"]},
  {"id": "lightning", "slug": "eclair", "name": "Éclair", "scenes": ["lointain", "arbre", "abri"]},
  {"id": "whale", "slug": "baleine", "name": "Baleine", "scenes": ["proche", "echouee", "saut"]},
  {"id": "bee", "slug": "abeille", "name": "Abeille", "scenes": ["butinage", "piqure", "essaim"]},
  {"id": "volcano", "slug": "volcan", "name": "Volcan", "scenes": ["endormi", "eruption", "lave"]},
  {"id": "waterfall", "slug": "cascade", "name": "Cascade", "scenes": ["contemplation", "sous-eau", "chute"]},
  {"id": "turtle", "slug": "tortue", "name": "Tortue", "scenes": ["nage", "carapace", "lenteur"]},
  {"id": "mask", "slug": "masque", "name": "Masque", "scenes": ["porter", "colle", "carnaval"]},
  {"id": "earthquake", "slug": "tremblement-de-terre", "name": "Tremblement de terre", "scenes": ["your-house-collapsing", "the-ground-splitting-open", "protecting-someone-during-an-earthquake"]},
  {"id": "prison", "slug": "prison", "name": "Prison", "scenes": ["being-locked-in-a-cell", "being-imprisoned-for-something-you-did", "escaping-from-prison"]},
  {"id": "zombie", "slug": "zombie", "name": "Zombie", "scenes": ["a-zombie-apocalypse", "a-loved-one-turned-into-a-zombie", "hiding-from-zombies"]},
  {"id": "monster", "slug": "monstre", "name": "Monstre", "scenes": ["being-chased-by-a-monster", "a-monster-under-the-bed-or-in-the-close", "a-giant-monster"]},
  {"id": "demon", "slug": "demon", "name": "Démon", "scenes": ["being-chased-by-a-demon", "fighting-a-demon", "talking-or-bargaining-with-a-demon"]},
  {"id": "ghost", "slug": "fantome", "name": "Fantôme", "scenes": ["seeing-the-ghost-of-a-loved-one-who-die", "being-haunted-by-a-ghost", "a-haunted-house"]},
  {"id": "shadow", "slug": "ombre", "name": "Ombre", "scenes": ["being-followed-by-a-shadow", "your-shadow-breaking-away", "a-faceless-dark-figure"]},
  {"id": "hiding", "slug": "se-cacher", "name": "Se cacher", "scenes": ["hiding-from-a-threat", "hiding-from-someone-you-know", "being-found"]},
  {"id": "screaming", "slug": "cri", "name": "Cri", "scenes": ["screaming-in-fear", "screaming-in-anger", "a-scream-that-will-not-come-out"]},
  {"id": "paralysis", "slug": "paralysie", "name": "Paralysie", "scenes": ["frozen-in-front-of-a-danger", "legs-that-will-not-run", "waking-up-unable-to-move"]},
  {"id": "unable-to-speak", "slug": "incapable-de-parler", "name": "Incapable de parler", "scenes": ["a-voice-that-will-not-come-out", "speaking-but-no-one-hears-you", "unable-to-call-for-help"]},
  {"id": "missing-train", "slug": "rater-un-train", "name": "Rater un train", "scenes": ["watching-the-train-leave", "waiting-on-the-wrong-platform", "running-for-a-train"]},
  {"id": "late", "slug": "etre-en-retard", "name": "Être en retard", "scenes": ["late-for-work", "late-for-an-exam", "late-for-a-flight-or-a-train"]},
  {"id": "attic", "slug": "grenier", "name": "Grenier", "scenes": ["climbing-into-the-attic", "finding-old-belongings", "a-dark-or-frightening-attic"]},
  {"id": "trapped", "slug": "piege", "name": "Piégé", "scenes": ["trapped-in-a-room", "trapped-in-an-elevator", "trapped-while-danger-comes-closer"]},
  {"id": "drowning", "slug": "noyade", "name": "Noyade", "scenes": ["drowning-in-the-sea-or-deep-water", "drowning-in-a-pool-or-bathtub", "someone-else-drowning"]},
  {"id": "bleeding", "slug": "saignement", "name": "Saignement", "scenes": ["a-nosebleed", "bleeding-without-pain-or-visible-wound", "stopping-the-bleeding"]},
  {"id": "surgery", "slug": "chirurgie", "name": "Chirurgie", "scenes": ["being-operated-on", "performing-surgery", "a-loved-one-having-surgery"]},
  {"id": "basement", "slug": "sous-sol", "name": "Sous-sol", "scenes": ["dark-basement", "flooded-basement", "locked-in-a-basement"]},
  {"id": "illness", "slug": "maladie", "name": "Maladie", "scenes": ["being-ill-yourself", "a-loved-one-who-is-ill", "a-serious-or-incurable-illness"]},
  {"id": "pregnancy-test", "slug": "test-de-grossesse", "name": "Test de grossesse", "scenes": ["positive-test", "negative-test", "a-result-you-cannot-read"]},
  {"id": "heart", "slug": "coeur", "name": "Cœur", "scenes": ["a-racing-heart", "a-broken-heart", "giving-or-receiving-a-heart"]},
  {"id": "feet", "slug": "pieds", "name": "Pieds", "scenes": ["walking-barefoot", "unable-to-move-your-feet", "washing-feet-or-having-them-washed"]},
  {"id": "hands", "slug": "mains", "name": "Mains", "scenes": ["hands-that-will-not-obey", "holding-someone-s-hand", "dirty-hands-or-washing-your-hands"]},
  {"id": "eyes", "slug": "yeux", "name": "Yeux", "scenes": ["being-watched", "not-being-able-to-open-your-eyes", "going-blind"]},
  {"id": "hair", "slug": "cheveux", "name": "Cheveux", "scenes": ["hair-falling-out", "cutting-your-own-hair", "someone-cutting-your-hair"]},
  {"id": "letter", "slug": "lettre", "name": "Lettre", "scenes": ["receiving-a-letter", "a-sealed-letter-you-dare-not-open", "an-unreadable-letter"]},
  {"id": "watch", "slug": "montre", "name": "Montre", "scenes": ["a-stopped-watch", "not-being-able-to-read-the-time", "checking-your-watch-again-and-again"]},
  {"id": "ring", "slug": "bague", "name": "Bague", "scenes": ["perdue", "fiancailles", "serree"]},
  {"id": "passport", "slug": "passeport", "name": "Passeport", "scenes": ["losing-your-passport", "an-expired-passport", "being-turned-away-at-the-border"]},
  {"id": "suitcase", "slug": "valise", "name": "Valise", "scenes": ["packing-a-suitcase", "a-heavy-suitcase", "lost-luggage"]},
  {"id": "airport", "slug": "aeroport", "name": "Aéroport", "scenes": ["missing-a-flight", "not-finding-your-gate", "losing-your-passport-or-ticket"]},
  {"id": "bicycle", "slug": "velo", "name": "Vélo", "scenes": ["riding-a-bicycle-with-ease", "falling-off-a-bike", "pedaling-uphill"]},
  {"id": "bus", "slug": "bus", "name": "Bus", "scenes": ["missing-the-bus", "taking-the-wrong-bus", "not-knowing-where-to-get-off"]},
  {"id": "road", "slug": "route", "name": "Route", "scenes": ["a-long-or-endless-road", "a-fork-in-the-road", "a-blocked-or-broken-road"]},
  {"id": "workplace", "slug": "lieu-de-travail", "name": "Lieu de travail", "scenes": ["your-real-workplace", "an-old-job", "being-late-or-unprepared-at-work"]},
  {"id": "kitchen", "slug": "cuisine", "name": "Cuisine", "scenes": ["cooking-a-meal", "a-messy-or-dirty-kitchen", "your-childhood-kitchen"]},
  {"id": "bedroom", "slug": "chambre", "name": "Chambre", "scenes": ["your-childhood-bedroom", "an-unfamiliar-bedroom", "someone-comes-into-your-bedroom"]},
  {"id": "bathroom", "slug": "salle-de-bain", "name": "Salle de bain", "scenes": ["can-t-find-a-toilet", "a-toilet-with-no-door-or-walls", "someone-walks-in"]},
  {"id": "classroom", "slug": "salle-de-classe", "name": "Salle de classe", "scenes": ["called-to-the-board", "being-the-teacher", "your-old-classroom"]},
  {"id": "grandfather", "slug": "grand-pere", "name": "Grand-père", "scenes": ["talking-with-your-grandfather", "a-deceased-grandfather", "a-sick-or-ageing-grandfather"]},
  {"id": "funeral", "slug": "enterrement", "name": "Enterrement", "scenes": ["your-own-funeral", "the-funeral-of-someone-who-is-alive", "the-funeral-of-someone-who-has-died"]},
  {"id": "birth", "slug": "naissance", "name": "Naissance", "scenes": ["giving-birth", "watching-someone-else-give-birth", "a-difficult-or-painful-birth"]},
  {"id": "grandmother", "slug": "grand-mere", "name": "Grand-mère", "scenes": ["talking-with-your-grandmother", "a-grandmother-who-has-died", "your-grandmother-s-house"]},
  {"id": "coworker", "slug": "collegue", "name": "Collègue", "scenes": ["working-with-a-coworker", "arguing-with-a-coworker", "a-coworker-taking-credit-for-your-work"]},
  {"id": "doctor", "slug": "medecin", "name": "Médecin", "scenes": ["being-examined-by-a-doctor", "getting-bad-news-from-a-doctor", "a-doctor-who-does-not-listen"]},
  {"id": "police", "slug": "police", "name": "Police", "scenes": ["calling-the-police-for-help", "being-chased-by-the-police", "being-stopped-or-questioned"]},
  {"id": "teacher", "slug": "professeur", "name": "Professeur", "scenes": ["a-former-teacher", "being-scolded-by-a-teacher", "being-asked-a-question-you-cannot-answe"]},
  {"id": "stranger", "slug": "inconnu", "name": "Inconnu", "scenes": ["being-followed-by-a-stranger", "a-stranger-in-your-house", "a-kind-or-helpful-stranger"]},
  {"id": "friend", "slug": "ami", "name": "Ami", "scenes": ["spending-time-with-a-close-friend", "an-old-friend-you-no-longer-see", "fighting-with-a-friend"]},
  {"id": "partner", "slug": "partenaire", "name": "Partenaire", "scenes": ["an-ordinary-moment-with-your-partner", "your-partner-cheating-on-you", "your-partner-leaving-you"]},
  {"id": "sibling", "slug": "frere-ou-soeur", "name": "Frère ou sœur", "scenes": ["playing-or-laughing-with-your-sibling", "fighting-with-your-brother-or-sister", "your-sibling-as-a-child"]},
  {"id": "father", "slug": "pere", "name": "Père", "scenes": ["your-father-as-he-is-today", "a-younger-father-or-a-childhood-scene", "an-angry-or-disappointed-father"]},
  {"id": "mother", "slug": "mere", "name": "Mère", "scenes": ["your-mother-as-she-is-today", "your-mother-younger-or-in-your-childhoo", "arguing-with-your-mother"]},
  {"id": "apocalypse", "slug": "apocalypse", "name": "Apocalypse", "scenes": ["a-natural-disaster-ending-the-world", "nuclear-war-or-a-huge-explosion", "a-zombie-apocalypse"]},
  {"id": "arguing", "slug": "dispute", "name": "Dispute", "scenes": ["arguing-with-your-partner", "arguing-with-a-parent-or-with-your-chil", "arguing-with-a-friend"]},
  {"id": "angel", "slug": "ange", "name": "Ange", "scenes": ["an-angel-speaking-to-you", "a-guardian-angel-protecting-you", "becoming-an-angel"]},
  {"id": "accident", "slug": "accident", "name": "Accident", "scenes": ["car-accident-while-driving", "witnessing-an-accident", "a-plane-crash"]},
  {"id": "abandonment", "slug": "abandon", "name": "Abandon", "scenes": ["a-partner-leaving-you", "being-left-behind-by-a-group", "a-parent-who-does-not-come-back"]},
  {"id": "crying", "slug": "pleurer", "name": "Pleurer", "scenes": ["crying-from-sadness-or-grief", "tears-of-joy-or-relief", "crying-in-front-of-others"]},
  {"id": "cliff", "slug": "falaise", "name": "Falaise", "scenes": ["standing-at-the-edge", "falling-off-a-cliff", "jumping-on-purpose"]},
  {"id": "lost", "slug": "perdu", "name": "Être Perdu", "scenes": ["lost-in-a-city", "can-t-find-your-way-home", "lost-in-a-building-or-a-maze"]},
  {"id": "ex-partner", "slug": "ex-partenaire", "name": "Ex-Partenaire", "scenes": ["getting-back-together-with-your-ex", "your-ex-with-someone-new", "arguing-with-your-ex"]},
  {"id": "rainbow", "slug": "arc-en-ciel", "name": "Arc-en-ciel", "scenes": ["rainbow-after-a-storm", "double-rainbow", "a-rainbow-that-fades"]},
  {"id": "phone", "slug": "telephone", "name": "Téléphone", "scenes": ["a-phone-ringing", "not-being-able-to-make-a-call", "missing-a-call"]},
  {"id": "school", "slug": "ecole", "name": "École", "scenes": ["can-t-find-your-classroom", "unprepared-for-a-test", "back-at-school-as-an-adult"]},
  {"id": "pregnancy", "slug": "grossesse", "name": "Grossesse", "scenes": ["finding-out-you-are-pregnant", "being-heavily-pregnant", "someone-else-is-pregnant"]},
  {"id": "swimming", "slug": "nager", "name": "Nager", "scenes": ["swimming-effortlessly", "struggling-to-swim", "swimming-underwater"]},
  {"id": "blood", "slug": "sang", "name": "Sang", "scenes": ["blood-on-your-hands", "bloodstained-clothes-or-objects", "someone-else-s-blood"]},
  {"id": "child", "slug": "enfant", "name": "Enfant", "scenes": ["a-happy-playing-child", "a-crying-or-upset-child", "a-lost-child"]},
  {"id": "clothes", "slug": "vetements", "name": "Vêtements", "scenes": ["being-underdressed-in-public", "wearing-someone-else-s-clothes", "not-finding-the-right-outfit"]},
  {"id": "path", "slug": "chemin", "name": "Chemin / Route", "scenes": ["a-clear-open-path", "an-overgrown-or-blocked-path", "a-fork-or-crossroads"]},
  {"id": "plane", "slug": "avion", "name": "Avion", "scenes": ["smooth-flight", "turbulence-during-the-flight", "plane-crash-or-emergency-landing"]},
  {"id": "night", "slug": "nuit", "name": "Nuit / Obscurité", "scenes": ["walking-alone-in-the-dark", "a-starry-or-moonlit-night", "total-darkness"]},
  {"id": "mouth", "slug": "bouche", "name": "Bouche", "scenes": ["unable-to-open-your-mouth-or-speak", "something-stuck-in-your-mouth", "a-mouth-that-will-not-close"]},
  {"id": "wedding", "slug": "mariage", "name": "Mariage", "scenes": ["your-own-wedding", "someone-else-s-wedding", "being-late-for-the-wedding"]},
  {"id": "hospital", "slug": "hopital", "name": "Hôpital", "scenes": ["being-in-a-hospital", "a-hospital-with-doctors-or-nurses", "a-hospital-full-of-sick-people"]},
  {"id": "running", "slug": "courir", "name": "Courir", "scenes": ["running-away-from-danger", "running-but-moving-slowly", "running-towards-a-goal"]},
  {"id": "chase", "slug": "poursuite", "name": "Poursuite / Être poursuivi", "scenes": ["being-chased-by-a-stranger", "being-chased-by-an-animal", "being-chased-by-someone-you-know"]},
  {"id": "spider", "slug": "araignee", "name": "Araignée", "scenes": ["a-spider-spinning-its-web", "being-caught-in-a-web", "being-bitten-by-a-spider"]},
  {"id": "flood", "slug": "inondation", "name": "Inondation", "scenes": ["floodwater-coming-into-your-home", "being-swept-away-by-floodwater", "escaping-a-flood"]},
  {"id": "exam", "slug": "examen", "name": "Examen / Test", "scenes": ["being-unprepared-for-an-exam", "arriving-late-to-an-exam", "an-exam-in-a-subject-you-never-studied"]},
  {"id": "nudity", "slug": "nudite", "name": "Nudité", "scenes": ["naked-and-embarrassed", "naked-but-no-one-notices", "partly-dressed-or-wearing-the-wrong-clo"]},
  {"id": "deceased-person", "slug": "defunt", "name": "Défunt / Personne décédée", "scenes": ["a-peaceful-visit", "a-deceased-person-who-seems-alive", "receiving-a-message"]},
  {"id": "sun", "slug": "soleil", "name": "Soleil", "scenes": ["bright-warm-sun", "sunrise", "sunset"]},
  {"id": "tree", "slug": "arbre", "name": "Arbre", "scenes": ["large-healthy-tree", "dead-or-dying-tree", "climbing-a-tree"]},
  {"id": "lion", "slug": "lion", "name": "Lion", "scenes": ["a-calm-majestic-lion", "a-lion-attacking-or-chasing-you", "taming-or-befriending-a-lion"]},
  {"id": "money", "slug": "argent", "name": "Argent", "scenes": ["finding-money", "losing-money-or-a-wallet", "counting-money"]},
  {"id": "death", "slug": "mort", "name": "Mort", "scenes": ["your-own-death", "a-loved-one-dying", "a-stranger-dying"]},
  {"id": "light", "slug": "lumiere", "name": "Lumière", "scenes": ["a-light-switch-that-does-nothing", "a-light-going-out", "a-blinding-light"]},
  {"id": "lighthouse", "slug": "phare", "name": "Phare", "scenes": ["a-lighthouse-beam-sweeping-the-night", "a-lighthouse-that-goes-dark", "seeing-a-lighthouse-from-a-boat-in-a-s"]},
  {"id": "window", "slug": "fenetre", "name": "Fenêtre", "scenes": ["looking-out-of-a-window", "someone-at-the-window", "a-window-that-will-not-close"]},
  {"id": "train-station", "slug": "gare", "name": "Gare", "scenes": ["missing-the-train", "waiting-on-a-platform", "the-wrong-platform-or-the-wrong-train"]},
  {"id": "wall", "slug": "mur", "name": "Mur", "scenes": ["a-wall-blocking-your-way", "climbing-over-a-wall", "a-crumbling-or-collapsing-wall"]},
  {"id": "library", "slug": "bibliotheque", "name": "Bibliothèque", "scenes": ["searching-for-a-book-you-cannot-find", "an-endless-library", "a-silent-library-at-night"]},
  {"id": "neighbor", "slug": "voisin", "name": "Voisin", "scenes": ["an-argument-with-a-neighbor", "a-neighbor-coming-into-your-home", "a-friendly-or-helpful-neighbor"]},
  {"id": "hallway", "slug": "couloir", "name": "Couloir", "scenes": ["an-endless-hallway", "doors-on-both-sides", "a-dark-hallway-at-night"]},
  {"id": "city", "slug": "ville", "name": "Ville", "scenes": ["an-unknown-city", "being-lost-in-a-city", "a-city-at-night"]},
  {"id": "street", "slug": "rue", "name": "Rue", "scenes": ["an-empty-street-at-night", "a-busy-crowded-street", "the-street-where-you-grew-up"]},
  {"id": "tunnel", "slug": "tunnel", "name": "Tunnel", "scenes": ["a-dark-tunnel", "light-at-the-end-of-the-tunnel", "a-tunnel-that-narrows"]},
  {"id": "maze", "slug": "labyrinthe", "name": "Labyrinthe", "scenes": ["lost-in-a-maze-with-no-way-out", "a-hedge-maze-or-garden-maze", "a-maze-of-corridors-or-rooms"]},
  {"id": "tower", "slug": "tour", "name": "Tour", "scenes": ["climbing-a-tower-or-endless-stairs", "stuck-at-the-top-of-a-tower", "a-tower-collapsing-or-leaning"]},
  {"id": "wind", "slug": "vent", "name": "Vent", "scenes": ["a-strong-wind-pushing-you-back", "being-lifted-by-the-wind", "wind-blowing-through-the-house"]},
  {"id": "fog", "slug": "brouillard", "name": "Brouillard", "scenes": ["driving-in-fog", "being-lost-in-fog", "someone-appearing-out-of-the-fog"]},
  {"id": "ice", "slug": "glace", "name": "Glace / Gel", "scenes": ["thin-ice-cracking-under-you", "falling-through-the-ice", "slipping-or-unable-to-stand-on-ice"]},
  {"id": "clouds", "slug": "nuages", "name": "Nuages", "scenes": ["white-clouds-drifting-in-a-blue-sky", "dark-clouds-gathering", "walking-or-lying-on-clouds"]},
  {"id": "waves", "slug": "vagues", "name": "Vagues", "scenes": ["watching-huge-waves-from-the-shore", "being-knocked-over-by-a-wave", "a-wave-about-to-break-over-you"]},
  {"id": "outer-space", "slug": "espace", "name": "Espace / Planètes", "scenes": ["floating-weightless-in-space", "travelling-to-another-planet", "seeing-the-earth-from-far-away"]},
  {"id": "burglar", "slug": "cambrioleur", "name": "Voleur / Cambrioleur", "scenes": ["hearing-a-burglar-in-the-house-at-nigh", "being-robbed", "hiding-from-a-burglar"]},
  {"id": "royalty", "slug": "roi-reine", "name": "Roi / Reine", "scenes": ["meeting-a-king-or-queen", "being-crowned-king-or-queen", "a-king-or-queen-giving-you-an-order"]},
  {"id": "crowd", "slug": "foule", "name": "Foule", "scenes": ["being-lost-in-a-crowd", "a-crowd-staring-at-you", "speaking-or-performing-in-front-of-a-c"]},
  {"id": "twins", "slug": "jumeaux", "name": "Jumeaux", "scenes": ["being-pregnant-with-twins", "having-a-twin-you-never-had", "seeing-identical-twins"]},
  {"id": "dragon", "slug": "dragon", "name": "Dragon", "scenes": ["a-dragon-attacking-or-chasing-you", "fighting-or-slaying-a-dragon", "riding-or-flying-on-a-dragon"]},
  {"id": "unicorn", "slug": "licorne", "name": "Licorne", "scenes": ["seeing-a-unicorn", "riding-a-unicorn", "a-wounded-black-or-dark-unicorn"]},
  {"id": "fox", "slug": "renard", "name": "Renard", "scenes": ["a-fox-crossing-the-road", "a-fox-watching-you", "a-fox-biting-or-attacking-you"]},
  {"id": "fly", "slug": "mouche", "name": "Mouche", "scenes": ["a-swarm-of-flies", "killing-a-fly", "flies-on-food"]},
  {"id": "jellyfish", "slug": "meduse", "name": "Méduse", "scenes": ["being-stung-by-a-jellyfish", "swimming-among-many-jellyfish", "a-glowing-jellyfish-in-the-dark"]},
  {"id": "octopus", "slug": "pieuvre", "name": "Pieuvre / Poulpe", "scenes": ["tentacles-wrapping-around-you", "an-octopus-watching-you", "a-cloud-of-ink"]},
  {"id": "broken-glass", "slug": "verre-brise", "name": "Verre brisé", "scenes": ["walking-on-broken-glass", "breaking-a-glass-yourself", "glass-in-your-mouth"]},
  {"id": "gift", "slug": "cadeau", "name": "Cadeau", "scenes": ["receiving-an-unexpected-gift", "opening-an-empty-box", "a-gift-from-someone-who-has-died"]},
  {"id": "bag", "slug": "sac", "name": "Sac / Sac à main", "scenes": ["losing-your-bag", "a-stolen-bag", "a-bag-that-is-too-heavy"]},
  {"id": "explosion", "slug": "explosion", "name": "Explosion / Bombe", "scenes": ["a-sudden-explosion-out-of-nowhere", "a-bomb-you-have-to-defuse", "an-explosion-in-the-house"]},
  {"id": "searching", "slug": "chercher", "name": "Chercher quelque chose", "scenes": ["looking-for-your-keys-or-your-phone", "looking-for-your-car-in-a-car-park", "searching-and-never-finding"]},
  {"id": "driving", "slug": "conduire", "name": "Conduire / Perdre le contrôle", "scenes": ["brakes-that-stop-working", "driving-without-a-licence-or-without-k", "someone-else-grabbing-the-wheel"]},
  {"id": "climbing", "slug": "grimper", "name": "Grimper", "scenes": ["climbing-a-mountain", "climbing-a-ladder", "never-reaching-the-top"]},
  {"id": "breakup", "slug": "rupture", "name": "Rupture", "scenes": ["being-left-by-your-current-partner", "breaking-up-with-your-partner", "an-ex-breaking-up-with-you-again"]},
  {"id": "stage", "slug": "etre-sur-scene", "name": "Être sur scène", "scenes": ["forgetting-your-lines-on-stage", "stage-fright-before-going-on", "performing-without-rehearsing"]},
  {"id": "clock", "slug": "horloge", "name": "Horloge", "scenes": ["arretee", "aiguilles", "clocher"]},
  {"id": "candle", "slug": "bougie", "name": "Bougie", "scenes": ["seule", "anniversaire", "ceremonie"]},
] as const;

// Six files share these packs, each taking every sixth one (site-packs-1 to -6.web.e2e.ts), so a
// pack added to the list lands in one of them and the files stay about the same length.
export const PACK_FILES = 6;
export const packsOfFile = (file: number) => NEW_SYMBOL_PACKS.filter((_, index) => index % PACK_FILES === file - 1);

export async function expectNewSymbolPack(page: typeof NEW_SYMBOL_PACKS[number], { app, browser, screen }: { app: App; browser: Browser; screen: Screen }) {
  await browser.setViewport({ width: 2560, height: 1440 });
  await app.open('/fr/symboles/' + page.slug + '.html');
  await browser.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(page.name);
  // Keep the art review clear of the consent banner, using the real opt-out control.
  if (await browser.evaluate(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Continuer sans mesure'))) {
    await screen.getByRole('button', { name: 'Continuer sans mesure', exact: true }).tap();
  }
  const moving = async (name: string) => {
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => {
      const s = surfaceNamed(all, name);
      return s && [s.living, s.state];
    })).toEqual(['ready', 'running']);
    const start = surfaceNamed(await browser.evaluate(readSurfaces), name);
    expect(start.channels).toEqual(['a', 'b']);
    expect(start.textures[0]).not.toBe(start.textures[1]);
    expect(start.opaque.every(count => count > 0)).toBe(true);
    expect(start.stretch.every(gap => gap < 0.01)).toBe(true);
    await expect.poll(() => browser.evaluate(readSurfaces).then(all => surfaceNamed(all, name).frames.map((frame, i) => frame !== start.frames[i]))).toEqual([true, true]);
  };
  await moving('hero');
  const wide = await browser.evaluate(readAtlasSix);
  expect(wide.src).toContain('/' + page.id + '/hero-');
  expect(wide.overflow).toBe(false);
  expect(wide.paintingAnimations).toBe(0);
  expect(wide.hero.top).toBe(0);
  expect(wide.hero.width).toBe(2560);
  await app.screenshot('pack-' + page.id + '-2560-hero');

  for (const name of ['plate', ...page.scenes.map(scene => 'scene-' + scene)]) {
    await browser.evaluate((surface: string) => {
      document.querySelector('[data-living-surface="' + surface + '"]')!.scrollIntoView({ block: 'center', behavior: 'instant' });
      return window.scrollY;
    }, name);
    await moving(name);
    if (name === 'plate') await app.screenshot('pack-' + page.id + '-2560-plate');
  }
  for (const scene of page.scenes) {
    const label = await browser.evaluate((id: string) => document.querySelector('label[for="atlas-scene-' + id + '"] .atlas-scene-label')!.textContent!.trim(), scene);
    await screen.getByText(label, { exact: true }).first().tap();
    expectSixScene(await browser.evaluate(readAtlasSix), scene);
  }
  await app.screenshot('pack-' + page.id + '-2560-scenes');
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await expectReducedSurfaces(browser);

  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/fr/symboles/' + page.slug + '.html');
  await browser.emulateMedia({ reducedMotion: 'no-preference' });
  await moving('hero');
  const phone = await browser.evaluate(readAtlasSix);
  expect(phone.src).toContain('/' + page.id + '/portrait-');
  expect(phone.hero.top).toBe(0);
  expect(phone.hero.height).toBeCloseTo(844 * 0.75, 0);
  expect(phone.overflow).toBe(false);
  expect(await browser.evaluate(() => performance.getEntriesByType('resource').some(e => /\/plate-[0-9]+-/.test(e.name)))).toBe(false);
  await app.screenshot('pack-' + page.id + '-390-hero');
  await app.open('/fr/symboles/' + page.slug + '.html#scenes');
  await expect(screen.getByRole('heading', { name: 'Scènes courantes', exact: true })).toBeVisible();
  await expect.poll(() => browser.evaluate(() => {
    const covers = ['#navbar', '.symbol-jump-nav'].map(selector => document.querySelector(selector)!.getBoundingClientRect())
      .filter(rect => rect.height > 0 && rect.bottom > 0).map(rect => rect.bottom);
    const title = document.querySelector('#atlas-scenes-title')!.getBoundingClientRect();
    const hit = document.elementFromPoint(title.left + 8, title.top + title.height / 2);
    return title.top >= Math.max(0, ...covers) && title.bottom <= innerHeight && Boolean(hit?.closest('#atlas-scenes-title'));
  }), { timeout: 15_000 }).toBe(true);
  for (const scene of page.scenes) await moving('scene-' + scene);
  await app.screenshot('pack-' + page.id + '-390-scenes');

  const catalog = JSON.parse(readFileSync(new URL('../../data/dream-symbols.json', import.meta.url), 'utf8')).symbols.find((s: {id: string}) => s.id === page.id);
  const paths: Record<string,string> = { en: 'symbols', es: 'simbolos', de: 'traumsymbole', it: 'simboli', 'pt-br': 'simbolos' };
  for (const [lang, route] of Object.entries(paths)) {
    const content = catalog[lang === 'pt-br' ? 'pt' : lang];
    for (const viewport of [{ width: 2560, height: 1440 }, { width: 390, height: 844 }]) {
      await browser.setViewport(viewport);
      await app.open('/' + lang + '/' + route + '/' + content.slug + '.html');
      await expect(screen.getByRole('heading', { level: 1 })).toHaveText(content.name);
      await expect.poll(() => browser.evaluate(() => {
        const img = document.querySelector<HTMLImageElement>('.symbol-hero img');
        return Boolean(img?.complete && img.naturalWidth && document.querySelectorAll('.atlas-scene-input').length === 3);
      })).toBe(true);
      const localized = await browser.evaluate(readAtlasSix);
      expect(localized.src).toContain('/' + page.id + '/' + (viewport.width === 390 ? 'portrait-' : 'hero-'));
      expect(localized.overflow).toBe(false);
      expectSixScene(localized, page.scenes[0]);
    }
  }
}
