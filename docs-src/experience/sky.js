/**
 * Noctalia canvas sky — twinkling stars and deep nebula haze above the hero
 * drawn on a plain 2D canvas.
 *
 * Replaces the previous three.js/WebGL scene with the same public contract
 * (`createSky` -> `{ pause, resume, dispose, resize }` or null) at a
 * fraction of the cost: no ~540 kB three.js chunk, no WebGL context, no
 * bloom post-processing. The palette stays inside the observatory theme
 * (deep plum base, cream ink, muted violets, one rare salmon star) so the
 * layer reads as depth behind the hero, never as a light show.
 *
 * Quality levels:
 * - "full": ~220 stars, occasional shooting star, pixel ratio <= 1.5.
 * - "light": ~100 stars, pixel ratio 1.
 *
 * Runtime guards: 30 fps render cap, FPS watchdog (halve stars and pin the
 * pixel ratio -> kill), pause/resume driven by the caller (hero offscreen,
 * hidden tab), and a resize path that always repaints so the canvas can
 * never sit stretched or cropped under the hero.
 */

const STAR_COUNT = { full: 220, light: 100 };
const PIXEL_RATIO_CAP = { full: 1.5, light: 1 };
const FRAME_INTERVAL_MS = 1000 / 30;
const FPS_THRESHOLD = 20;
const FPS_WINDOW_MS = 2500;
const WATCHDOG_WARMUP_MS = 3000;

/* Ivory first, then the palette's muted lavender; champagne stays rare so
 * the accent keeps its editorial scarcity. Weights must sum to 1. */
const STAR_PALETTE = [
  { color: '#fff9ef', weight: 0.6 },
  { color: '#b7aec9', weight: 0.3 },
  { color: '#ead4b4', weight: 0.1 },
];

function withAlpha(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pickStarColor() {
  let roll = Math.random();
  for (const entry of STAR_PALETTE) {
    roll -= entry.weight;
    if (roll <= 0) return entry.color;
  }
  return STAR_PALETTE[0].color;
}

/** Soft round glow sprite: sharp-ish core, wide falloff. */
function buildStarSprite(color) {
  const size = 32;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, withAlpha(color, 1));
  gradient.addColorStop(0.22, withAlpha(color, 0.85));
  gradient.addColorStop(0.55, withAlpha(color, 0.18));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

/** Irregular haze sprite built from a few overlapping radial gradients. */
function buildNebulaSprite(blobs) {
  const size = 256;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  for (const [cx, cy, radius, color, alpha] of blobs) {
    const gradient = ctx.createRadialGradient(
      cx * size, cy * size, 0,
      cx * size, cy * size, radius * size
    );
    gradient.addColorStop(0, withAlpha(color, alpha));
    gradient.addColorStop(0.6, withAlpha(color, alpha * 0.4));
    gradient.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return sprite;
}

function buildStars(count) {
  const sprites = new Map();
  const stars = [];
  for (let i = 0; i < count; i++) {
    const color = pickStarColor();
    if (!sprites.has(color)) sprites.set(color, buildStarSprite(color));
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.7 + Math.random() * 1.7,
      depth: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 1.1,
      sprite: sprites.get(color),
    });
  }
  return stars;
}

/**
 * Creates the sky inside `container`. Returns null when the 2D context is
 * unavailable so the caller can silently keep the CSS fallback.
 */
export function createSky({ container, quality = 'full', onKill } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;

  const isFull = quality === 'full';
  let pixelRatio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP[isFull ? 'full' : 'light']);

  const starCount = STAR_COUNT[isFull ? 'full' : 'light'];
  const stars = buildStars(starCount);
  let starDrawCount = starCount;

  /* Two dark hazes from the palette's veil, noir, mystical and calm tints —
   * depth, not spectacle. */
  const nebulaA = buildNebulaSprite([
    [0.42, 0.5, 0.5, '#192344', 0.55],
    [0.6, 0.36, 0.34, '#6c568f', 0.16],
    [0.3, 0.62, 0.4, '#31354f', 0.4],
  ]);
  const nebulaB = buildNebulaSprite([
    [0.5, 0.5, 0.48, '#31354f', 0.45],
    [0.36, 0.6, 0.34, '#446b8c', 0.14],
    [0.64, 0.4, 0.3, '#6c568f', 0.12],
  ]);

  const pointer = { x: 0, y: 0 };
  const pointerSmooth = { x: 0, y: 0 };
  let scrollProgress = 0;
  let width = 1;
  let height = 1;
  let running = false;
  let rafId = 0;
  let lastRenderTime = 0;
  let elapsed = 0;

  // Watchdog state.
  let degradeLevel = 0;
  let windowStart = 0;
  let windowFrames = 0;
  let watchdogArmedAt = 0;

  // Shooting star state (full tier only).
  const shooting = { active: false, x: 0, y: 0, dx: 0, dy: 0, length: 0, progress: 0 };
  let nextShootAt = 6 + Math.random() * 8;

  const spawnShootingStar = () => {
    shooting.active = true;
    shooting.progress = 0;
    shooting.x = (0.15 + Math.random() * 0.7) * width;
    shooting.y = (0.05 + Math.random() * 0.35) * height;
    const direction = Math.random() < 0.5 ? -1 : 1;
    shooting.dx = direction * (0.72 + Math.random() * 0.2);
    shooting.dy = 0.5 + Math.random() * 0.2;
    shooting.length = 110 + Math.random() * 70;
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    // Nebulas: slow drift, low alpha, scroll parallax.
    const nebulaShift = scrollProgress * height * 0.03;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(
      nebulaA,
      -width * 0.1 + Math.sin(elapsed * 0.05) * 9,
      height * 0.02 + Math.cos(elapsed * 0.04) * 7 - nebulaShift,
      width * 0.85,
      height * 0.75
    );
    ctx.globalAlpha = 0.42;
    ctx.drawImage(
      nebulaB,
      width * 0.5 + Math.cos(elapsed * 0.045) * 10,
      height * 0.3 + Math.sin(elapsed * 0.06) * 8 - nebulaShift,
      width * 0.68,
      height * 0.62
    );

    // Stars: twinkle + pointer/scroll parallax.
    const starShiftY = scrollProgress * height * 0.06;
    for (let i = 0; i < starDrawCount; i++) {
      const star = stars[i];
      const twinkle = 0.42 + 0.4 * Math.sin(elapsed * star.speed + star.phase);
      if (twinkle <= 0.05) continue;
      ctx.globalAlpha = Math.min(twinkle, 0.85);
      const drawSize = star.size * 5;
      ctx.drawImage(
        star.sprite,
        star.x * width + pointerSmooth.x * 10 * star.depth - drawSize / 2,
        star.y * height + pointerSmooth.y * 6 * star.depth - starShiftY * star.depth - drawSize / 2,
        drawSize,
        drawSize
      );
    }

    if (shooting.active) {
      const fade = Math.sin(Math.PI * shooting.progress) * 0.45;
      const headX = shooting.x + shooting.dx * shooting.length * shooting.progress * 2;
      const headY = shooting.y + shooting.dy * shooting.length * shooting.progress * 2;
      const tailX = headX - shooting.dx * shooting.length * 0.6;
      const tailY = headY - shooting.dy * shooting.length * 0.6;
      const trail = ctx.createLinearGradient(tailX, tailY, headX, headY);
      trail.addColorStop(0, 'rgba(255, 249, 239, 0)');
      trail.addColorStop(1, `rgba(255, 249, 239, ${fade})`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const resize = () => {
    // Track devicePixelRatio changes (window moved across monitors) unless
    // the watchdog already pinned the ratio down.
    if (degradeLevel === 0) {
      pixelRatio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP[isFull ? 'full' : 'light']);
    }
    width = container.clientWidth || 1;
    height = container.clientHeight || 1;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    // Repaint immediately (setting canvas.width clears the buffer): the sky
    // must never sit blank or stretched, even while paused.
    draw();
  };

  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  const onScroll = () => {
    const heroHeight = container.parentElement?.offsetHeight || window.innerHeight;
    scrollProgress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
  };

  const degrade = () => {
    degradeLevel += 1;
    if (degradeLevel === 1) {
      starDrawCount = Math.floor(starCount / 2);
      pixelRatio = 1;
      resize();
      watchdogArmedAt = performance.now();
      return;
    }
    dispose();
    if (typeof onKill === 'function') onKill();
  };

  const frame = (now) => {
    if (!running) return;
    rafId = window.requestAnimationFrame(frame);
    if (now - lastRenderTime < FRAME_INTERVAL_MS) return;

    const delta = Math.min((now - lastRenderTime) / 1000, 0.1);
    lastRenderTime = now;
    elapsed += delta;

    pointerSmooth.x += (pointer.x - pointerSmooth.x) * 0.08;
    pointerSmooth.y += (pointer.y - pointerSmooth.y) * 0.08;

    if (isFull) {
      if (shooting.active) {
        shooting.progress += delta / 1.1;
        if (shooting.progress >= 1) shooting.active = false;
      } else if (elapsed >= nextShootAt) {
        spawnShootingStar();
        nextShootAt = elapsed + 9 + Math.random() * 10;
      }
    }

    draw();

    if (now < watchdogArmedAt) return;
    windowFrames += 1;
    if (now - windowStart >= FPS_WINDOW_MS) {
      const fps = (windowFrames * 1000) / (now - windowStart);
      windowFrames = 0;
      windowStart = now;
      if (fps < FPS_THRESHOLD && degradeLevel < 2) degrade();
    }
  };

  const pause = () => {
    if (!running) return;
    running = false;
    window.cancelAnimationFrame(rafId);
  };

  const resume = () => {
    if (running) return;
    running = true;
    lastRenderTime = performance.now();
    windowStart = lastRenderTime;
    windowFrames = 0;
    watchdogArmedAt = lastRenderTime + WATCHDOG_WARMUP_MS;
    rafId = window.requestAnimationFrame(frame);
  };

  const dispose = () => {
    pause();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    canvas.remove();
  };

  container.appendChild(canvas);
  resize();
  // The container may be detached or mid-layout at creation time; observe it
  // so the canvas always matches the hero box (orientation changes, mobile
  // URL bar collapse, late font/layout shifts).
  const resizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  window.addEventListener('resize', resize, { passive: true });
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  resume();

  return { pause, resume, dispose, resize };
}
