/**
 * Noctalia WebGL sky — stars, nebula and moon rendered with three.js.
 *
 * This module is code-split by esbuild and only ever downloaded on devices
 * whose experience tier is "full" or "light". It never contains any SEO
 * content: the canvas is a purely decorative layer over the static hero.
 *
 * Quality levels:
 * - "full": ~5000 stars, bloom post-processing, pixel ratio <= 2.
 * - "light": ~800 stars, no bloom, pixel ratio <= 1.5.
 *
 * Runtime guards: FPS watchdog (halve particles -> bloom off -> kill),
 * pause/resume driven by the caller (hero offscreen, hidden tab), and a
 * hard pixel-ratio cap (the #1 source of mobile heat).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const STAR_COUNT = { full: 5000, light: 800 };
const PIXEL_RATIO_CAP = { full: 2, light: 1.5 };
const FPS_THRESHOLD = 40;
const FPS_WINDOW_MS = 2000;
const WATCHDOG_WARMUP_MS = 3000;

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;
    float twinkle = 0.72 + 0.28 * sin(uTime * aSpeed + aPhase);
    vTwinkle = twinkle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (140.0 / -mvPosition.z) * twinkle;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.05, dist) * vTwinkle;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const NEBULA_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.04 + vec2(13.7, 7.1);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 drift = vec2(uTime * 0.008, uTime * -0.005);
    float cloud = fbm(vUv * 3.1 + drift);
    cloud = smoothstep(0.32, 0.85, cloud);
    float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x)
      * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    vec3 color = mix(uColorA, uColorB, cloud);
    gl_FragColor = vec4(color, cloud * edge * 0.55);
  }
`;

const MOON_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MOON_FRAGMENT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - vec2(0.5);
    float dist = length(centered);
    float disc = smoothstep(0.145, 0.125, dist);
    float halo = smoothstep(0.5, 0.12, dist) * 0.26;
    vec3 cream = vec3(1.0, 0.968, 0.925);
    vec3 color = cream * (disc * 0.8 + halo);
    gl_FragColor = vec4(color, disc * 0.8 + halo);
  }
`;

const STAR_PALETTE = [
  new THREE.Color('#ffffff'),
  new THREE.Color('#e9d5ff'),
  new THREE.Color('#c4b5fd'),
  new THREE.Color('#93c5fd'),
  new THREE.Color('#fda481'),
];

function buildStars(count) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 170;
    positions[i * 3 + 1] = (Math.random() - 0.35) * 100;
    positions[i * 3 + 2] = -75 + Math.random() * 90;
    sizes[i] = 1.1 + Math.random() * 2.6;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.35 + Math.random() * 1.1;
    const color = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function buildNebula(seed, colorA, colorB, position, scale) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSeed: { value: seed },
    },
    vertexShader: NEBULA_VERTEX,
    fragmentShader: NEBULA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.position.copy(position);
  mesh.scale.set(scale.x, scale.y, 1);
  return mesh;
}

function buildMoon() {
  const material = new THREE.ShaderMaterial({
    vertexShader: MOON_VERTEX,
    fragmentShader: MOON_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.position.set(29, 19, -48);
  mesh.scale.set(20, 20, 1);
  return mesh;
}

/**
 * Creates the sky inside `container`. Returns null when WebGL is unavailable
 * so the caller can silently keep the CSS fallback.
 */
export function createSky({ container, quality = 'full', onKill } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  const isFull = quality === 'full';
  const pixelRatioCap = PIXEL_RATIO_CAP[isFull ? 'full' : 'light'];
  let pixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
  camera.position.set(0, 0, 32);

  const starCount = STAR_COUNT[isFull ? 'full' : 'light'];
  const stars = buildStars(starCount);
  stars.material.uniforms.uPixelRatio.value = pixelRatio;
  scene.add(stars);

  const nebulas = [
    buildNebula(3.1, '#2e1065', '#7c3aed', new THREE.Vector3(-28, 6, -62), { x: 130, y: 75 }),
    buildNebula(11.7, '#1e1b4b', '#fda481', new THREE.Vector3(34, -10, -70), { x: 120, y: 68 }),
  ];
  nebulas.forEach((nebula) => scene.add(nebula));
  scene.add(buildMoon());

  let composer = null;
  let bloomEnabled = false;
  if (isFull) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.3);
    composer.addPass(bloom);
    bloomEnabled = true;
  }

  const pointer = { x: 0, y: 0 };
  let scrollProgress = 0;
  let running = false;
  let rafId = 0;
  let lastFrameTime = 0;
  let elapsed = 0;

  // Watchdog state.
  let degradeLevel = 0;
  let windowStart = 0;
  let windowFrames = 0;
  let watchdogArmedAt = 0;

  const resize = () => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
  };

  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  const onScroll = () => {
    const heroHeight = container.parentElement?.offsetHeight || window.innerHeight;
    scrollProgress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
  };

  const render = () => {
    if (composer && bloomEnabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  };

  const degrade = () => {
    degradeLevel += 1;
    if (degradeLevel === 1) {
      // Halve the particle count and pin the pixel ratio to 1.
      stars.geometry.setDrawRange(0, Math.floor(starCount / 2));
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      stars.material.uniforms.uPixelRatio.value = 1;
      if (composer) composer.setPixelRatio(1);
      resize();
      watchdogArmedAt = performance.now();
      return;
    }
    if (degradeLevel === 2) {
      bloomEnabled = false;
      watchdogArmedAt = performance.now();
      return;
    }
    dispose();
    if (typeof onKill === 'function') onKill();
  };

  const frame = (now) => {
    if (!running) return;
    rafId = window.requestAnimationFrame(frame);

    const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;
    elapsed += delta;

    stars.material.uniforms.uTime.value = elapsed;
    nebulas.forEach((nebula) => {
      nebula.material.uniforms.uTime.value = elapsed;
    });

    camera.position.x += (pointer.x * 2.4 - camera.position.x) * 0.035;
    camera.position.y += (-pointer.y * 1.5 - camera.position.y) * 0.035;
    stars.position.y = scrollProgress * 9;
    camera.lookAt(0, scrollProgress * 4, -30);

    render();

    if (now < watchdogArmedAt) return;
    windowFrames += 1;
    if (now - windowStart >= FPS_WINDOW_MS) {
      const fps = (windowFrames * 1000) / (now - windowStart);
      windowFrames = 0;
      windowStart = now;
      if (fps < FPS_THRESHOLD && degradeLevel < 3) degrade();
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
    lastFrameTime = performance.now();
    windowStart = lastFrameTime;
    windowFrames = 0;
    watchdogArmedAt = lastFrameTime + WATCHDOG_WARMUP_MS;
    rafId = window.requestAnimationFrame(frame);
  };

  const dispose = () => {
    pause();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    stars.geometry.dispose();
    stars.material.dispose();
    nebulas.forEach((nebula) => {
      nebula.geometry.dispose();
      nebula.material.dispose();
    });
    scene.traverse((object) => {
      if (object.isMesh && object !== stars) {
        object.geometry?.dispose();
        object.material?.dispose();
      }
    });
    composer?.dispose?.();
    renderer.dispose();
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
