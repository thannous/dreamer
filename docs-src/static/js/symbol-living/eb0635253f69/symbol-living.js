/*!
 * symbol-living.js — Noctalia · premier lot de fiches Atlas (serpent, mer, forêt, maison, chute, papillon)
 * Moteur commun, paramètres par fiche : <script type="application/json" id="symbol-living-config">.
 * Amélioration progressive : sans JS, image absente ou calque en échec → l'image reste telle quelle.
 * Uniquement transform et opacity animés en CSS ; aucun travail JS hors défilement et redimensionnement.
 * Les peintures ne s'animent jamais (aucun zoom) : seul le héros descend avec ses calques au défilement.
 *
 * Surfaces : chaque image animée (héros, illustration latérale, vignette de scène) porte deux canaux
 * raster distincts, a (calque) et b (accent), et ne s'anime que lorsqu'elle est elle-même à l'écran.
 * La pause de l'utilisateur, l'onglet caché et le mouvement réduit valent pour toutes ; une même
 * commande de pause, présente sur chaque groupe d'images, les arrête et les reprend ensemble.
 * Contrôle, sur chaque surface : [data-living="pending|ready|off"] [data-living-scene]
 *            [data-living-motion-state="running|paused|reduced"] [data-living-motion-reasons="user hidden offscreen"]
 *            calques : .slp-l[data-living-channel="a|b"]
 *
 * Configuration (boîtes en fractions de la peinture affichée, 0..1) :
 *   { label, surfaces: [surface…], toggles: { nom: { host, after? } } }
 *   surface = { name, selector, img, figure?, depth?, mask?, clip?, phase?, toggle,
 *               scenes: { nom: { match, layers: [layer…] } } }
 *   layer = { channel: 'a'|'b', src, box: [x, y, w, h], tex?: [w, h], motion: 'drift'|'flow'|'pulse',
 *             move?: [dx, dy] (en boîtes), dur, op: [min, max], copies?, depth?: [dx, dy], blend? }
 *   drift : aller-retour lent ; flow : passage dans un sens avec fondu d'entrée et de sortie (copies
 *   décalées : le flux ne s'interrompt jamais) ; pulse : respiration de l'opacité. Les animations
 *   démarrent en cours de cycle (décalé de phase par surface) : le mouvement se voit dès l'arrivée.
 */
(function () {
  'use strict';

  var STYLE_ID = 'symbol-living-style';
  var MQ_REDUCED = '(prefers-reduced-motion: reduce)';
  var ICONS =
    '<svg class="slp-i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>' +
    '<svg class="slp-i-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.5v13L19 12z"/></svg>';

  function num(v) { return +(+v).toFixed(4); }
  function pct(v) { return num(v * 100) + '%'; }
  function el(tag, cls) { var n = document.createElement(tag); n.className = cls; return n; }
  function mql(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  function onChange(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  function readConfig() {
    var node = document.getElementById('symbol-living-config');
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (e) { return null; }
  }

  // Une règle d'animation par calque : nom, durée, courbe, délai négatif (en cours de cycle) et répétition.
  function anim(name, dur, delay, easing, alternate) {
    return 'animation:' + name + ' ' + num(dur) + 's ' + easing + ' -' + num(delay) + 's infinite' + (alternate ? ' alternate' : '') + ';';
  }

  function layerCss(key, layer, phase) {
    var pre = '.slp-l-' + key;
    var b = layer.box, tex = layer.tex || [1, 1], move = layer.move || [0, 0], depth = layer.depth || [0, 0];
    var op = layer.op || [1, 1], dur = layer.dur || 10, shift = dur * (phase || 0), css = [];
    // Translations en % de l'image : un déplacement d'une boîte vaut 1 / tex.
    var mx = num(move[0] / tex[0] * 100), my = num(move[1] / tex[1] * 100);
    // Un déplacement signé (vers le haut, vers la gauche) : le départ est son opposé, calculé, jamais préfixé d'un « - ».
    var from = 'translate3d(' + num(-mx) + '%,' + num(-my) + '%,0)', to = 'translate3d(' + mx + '%,' + my + '%,0)';
    css.push(
      pre + '{left:' + pct(b[0]) + ';top:' + pct(b[1]) + ';width:' + pct(b[2]) + ';height:' + pct(b[3]) + ';' +
        (layer.blend ? 'mix-blend-mode:' + layer.blend + ';' : '') + '}',
      pre + ' .slp-s{transform:translate3d(calc(var(--slp-p,0) * ' + pct(depth[0]) + '),calc(var(--slp-p,0) * ' + pct(depth[1]) + '),0)}',
      pre + ' .slp-t{left:' + pct((1 - tex[0]) / 2) + ';top:' + pct((1 - tex[1]) / 2) + ';width:' + pct(tex[0]) + ';height:' + pct(tex[1]) + '}'
    );
    var copies = layer.motion === 'flow' ? Math.max(1, layer.copies || 1) : 1;
    var at = function (j) { return pre + ' .slp-t' + (copies > 1 ? '.slp-c' + j : ''); };
    if (layer.motion === 'drift') {
      css.push(
        at(0) + '{opacity:' + num(op[1]) + ';' + anim('slp-d-' + key, dur, dur / 2 + shift, 'ease-in-out', true) + '}',
        '@keyframes slp-d-' + key + '{from{transform:' + from + ';opacity:' + num(op[0]) + '}to{transform:' + to + ';opacity:' + num(op[1]) + '}}'
      );
    } else if (layer.motion === 'flow') {
      for (var j = 0; j < copies; j++) {
        // Chaque copie part à un autre moment du cycle ; la première est déjà à mi-chemin.
        css.push(at(j) + '{opacity:' + (j ? 0 : num(op[1])) + ';' + anim('slp-f-' + key, dur, dur * (0.5 + j / copies) + shift, 'linear', false) + '}');
      }
      css.push('@keyframes slp-f-' + key + '{0%{transform:' + from + ';opacity:0}' +
        '18%{opacity:' + num(op[1]) + '}50%{opacity:' + num((op[0] + op[1]) / 2) + '}82%{opacity:' + num(op[1]) + '}' +
        '100%{transform:' + to + ';opacity:0}}');
    } else {
      css.push(
        at(0) + '{opacity:' + num((op[0] + op[1]) / 2) + ';' + anim('slp-p-' + key, dur, dur / 2 + shift, 'ease-in-out', true) + '}',
        '@keyframes slp-p-' + key + '{from{opacity:' + num(op[0]) + '}to{opacity:' + num(op[1]) + '}}'
      );
    }
    return css.join('\n');
  }

  function keyOf(index, sceneName, i) { return index + '-' + sceneName.replace(/[^a-z0-9]/gi, '') + '-' + i; }

  function buildCss(config) {
    var css = [
      /* Scène calée sur le cadre réellement affiché de chaque image (voir place()). */
      '.slp-host{position:relative}',
      '.slp-host--clip{overflow:hidden}',
      '.slp-stage{position:absolute;z-index:0;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .8s ease;contain:layout paint}',
      '.symbol-living .slp-stage{opacity:1}',
      '.slp-stage--masked{-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}',
      '.slp-scene{position:absolute;left:0;top:0;width:100%;height:100%}',
      '.slp-l,.slp-s{position:absolute}',
      '.slp-s{left:0;top:0;width:100%;height:100%}',
      '.slp-l{overflow:hidden}',
      '.slp-t{position:absolute;display:block;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;object-fit:fill;-webkit-user-select:none;user-select:none}',

      /* Profondeur au défilement (héros) : peinture et calques descendent ensemble (même transform). */
      '.symbol-living--depth .symbol-hero-figure{transform:translate3d(0,var(--slp-y,0px),0)}',
      '.symbol-living--running.symbol-living--depth .symbol-hero-figure{will-change:transform}',
      '.symbol-living--settling .symbol-hero-figure,.symbol-living--settling .slp-s{transition:transform .45s ease}',

      /* Commande de pause / reprise : la même sur chaque groupe d'images, sous la navbar sur le héros. */
      '.slp-toggle{position:absolute;z-index:3;top:.75rem;right:.75rem;' +
        'box-sizing:border-box;width:44px;height:44px;min-width:44px;min-height:44px;margin:0;padding:0;display:inline-flex;align-items:center;justify-content:center;' +
        'border:1px solid rgba(243,234,216,.4);border-radius:999px;background:rgba(10,5,20,.6);color:#f3ead8;font:inherit;line-height:1;cursor:pointer;opacity:0;pointer-events:auto;' +
        'transition:opacity .4s ease,border-color .2s ease,background-color .2s ease;-webkit-tap-highlight-color:transparent}',
      '.slp-toggle--hero{top:6.5rem;top:min(6.5rem,calc(100% - 3.25rem));right:1rem;right:max(1rem,env(safe-area-inset-right))}',
      '.slp-toggle.slp-toggle--on{opacity:1}',
      '.slp-toggle[hidden]{display:none}',
      '.slp-toggle:hover{border-color:rgba(243,234,216,.75);background:rgba(10,5,20,.78)}',
      '.slp-toggle:focus-visible{outline:2px solid #e8cf9a;outline-offset:3px}',
      '.slp-toggle svg{display:block;width:18px;height:18px;pointer-events:none}',
      '.slp-toggle .slp-i-play,.slp-toggle[aria-pressed="true"] .slp-i-pause{display:none}',
      '.slp-toggle[aria-pressed="true"] .slp-i-play{display:block}',
      '.slp-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',

      /* États de chaque surface : priment sur les règles d'animation par calque, plus spécifiques. */
      '.symbol-living--paused .slp-t{animation-play-state:paused!important}',
      '.symbol-living--reduced .slp-t{animation:none!important}',
      '.symbol-living--reduced .slp-stage,.symbol-living--reduced .symbol-hero-figure,.symbol-living--reduced .slp-s{transition:none}',
      '@media print{.slp-stage,.slp-toggle{display:none!important}}'
    ];
    config.surfaces.forEach(function (surface, index) {
      Object.keys(surface.scenes).forEach(function (name) {
        surface.scenes[name].layers.forEach(function (layer, i) { css.push(layerCss(keyOf(index, name, i), layer, surface.phase)); });
      });
    });
    return css.join('\n');
  }

  function injectStyle(config) {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    var withNonce = document.querySelector('script[nonce],style[nonce]');
    if (withNonce && withNonce.nonce) st.nonce = withNonce.nonce;
    st.textContent = buildCss(config);
    (document.head || document.documentElement).appendChild(st);
  }

  // Résout une fois l'image chargée ET décodée (une image en lazy attend son chargement) ; rejette si elle manque.
  // Une image déjà terminée sans pixels (cassée) ne recevra plus d'événement : elle rejette tout de suite.
  function ready(img) {
    var loaded = img.complete
      ? (img.naturalWidth ? Promise.resolve() : Promise.reject(new Error('image cassée')))
      : new Promise(function (resolve, reject) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', reject, { once: true });
      });
    return loaded.then(function () {
      if (typeof img.decode !== 'function') return img;
      return img.decode().then(function () { return img; }, function (err) {
        if (img.complete && img.naturalWidth) return img; // decode() peut rejeter sur une image déjà affichée
        throw err;
      });
    }).then(function () {
      if (!img.naturalWidth) throw new Error('image vide');
      return img;
    });
  }

  // Une texture par fichier, chargée une fois et clonée pour chaque calque qui l'emploie.
  var textures = {};
  function texture(src) {
    if (!textures[src]) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.alt = '';
      im.decoding = 'async';
      if ('fetchPriority' in im) im.fetchPriority = 'low';
      im.draggable = false;
      im.setAttribute('aria-hidden', 'true');
      im.src = src;
      textures[src] = ready(im);
    }
    return textures[src];
  }

  // Décalage object-position (%, px ou mots-clés) dans l'espace libre.
  function offset(tok, free) {
    if (/%$/.test(tok)) return free * parseFloat(tok) / 100;
    if (/px$/.test(tok)) return parseFloat(tok);
    if (tok === 'left' || tok === 'top') return 0;
    if (tok === 'right' || tok === 'bottom') return free;
    return free / 2;
  }

  function sceneOf(surface, src) {
    for (var name in surface.scenes) if ((src || '').indexOf(surface.scenes[name].match) !== -1) return name;
    return null;
  }

  var config = readConfig();
  if (!config || !config.surfaces) return;
  var reducedMq = mql(MQ_REDUCED);
  var state = {
    user: false,
    hidden: document.visibilityState === 'hidden',
    reduced: !!(reducedMq && reducedMq.matches)
  };
  var surfaces = [], toggles = {};

  function syncToggles() {
    Object.keys(toggles).forEach(function (name) {
      var btn = toggles[name];
      btn.setAttribute('aria-pressed', state.user ? 'true' : 'false');
      btn.hidden = state.reduced;
    });
  }

  function syncAll() {
    surfaces.forEach(function (s) { s.sync(); });
    syncToggles();
  }

  // La même commande sur chaque groupe d'images : héros, illustration latérale, scènes.
  function ensureToggle(name) {
    if (toggles[name] || !config.toggles || !config.toggles[name]) return;
    var spec = config.toggles[name];
    var host = document.querySelector(spec.host);
    if (!host) return;
    var btn = el('button', 'slp-toggle slp-toggle--' + name);
    btn.type = 'button';
    btn.setAttribute('data-living-toggle', name);
    btn.innerHTML = ICONS + '<span class="slp-sr"></span>';
    btn.lastChild.textContent = config.label || 'Pause';
    btn.addEventListener('click', function () { state.user = !state.user; syncAll(); });
    var after = spec.after ? document.querySelector(spec.after) : null;
    if (after && after.parentNode === host) host.insertBefore(btn, after.nextSibling);
    else host.appendChild(btn);
    if (getComputedStyle(host).position === 'static') host.classList.add('slp-host');
    toggles[name] = btn;
  }

  // Une seule boucle d'images : au plus une rAF par événement, pour les surfaces qui le demandent.
  var scheduled = false;
  function queue(surface, what) {
    surface.pending |= what;
    if (!scheduled) { scheduled = true; requestAnimationFrame(frame); }
  }
  function frame() {
    scheduled = false;
    surfaces.forEach(function (s) {
      var what = s.pending;
      s.pending = 0;
      if (what & 1) s.place();
      if (what & 2 && s.mode === 'running') s.depth();
    });
  }

  function listen() {
    document.addEventListener('visibilitychange', function () {
      state.hidden = document.visibilityState === 'hidden';
      syncAll();
    });
    onChange(reducedMq, function (e) { state.reduced = e.matches; syncAll(); });
    // Défilement passif : seul le héros en marche a de la profondeur à suivre.
    window.addEventListener('scroll', function () {
      surfaces.forEach(function (s) { if (s.depthOn && s.mode === 'running') queue(s, 2); });
    }, { passive: true });
  }

  function teardown(node) {
    var nodes = node.querySelectorAll('.slp-stage');
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
    node.classList.remove('symbol-living', 'symbol-living--running', 'symbol-living--paused', 'symbol-living--reduced',
      'symbol-living--depth', 'symbol-living--settling');
    node.style.removeProperty('--slp-y');
    node.style.removeProperty('--slp-p');
    node.removeAttribute('data-living-scene');
    node.removeAttribute('data-living-motion-state');
    node.removeAttribute('data-living-motion-reasons');
    node.setAttribute('data-living', 'off');
  }

  function mount(cfg, index, node, img, loaded) {
    injectStyle(config);

    var host = cfg.figure ? node.querySelector(cfg.figure) : node;
    if (!host || !host.contains(img)) host = node;
    if (getComputedStyle(host).position === 'static') host.classList.add('slp-host');
    if (cfg.clip) host.classList.add('slp-host--clip');
    var depthOn = Boolean(cfg.depth) && host !== node; // la profondeur déplace le figure : peinture et calques restent alignés

    var stage = el('div', 'slp-stage' + (cfg.mask ? ' slp-stage--masked' : ''));
    stage.setAttribute('aria-hidden', 'true');
    var scenes = {};
    Object.keys(cfg.scenes).forEach(function (name) {
      var wrap = el('div', 'slp-scene');
      wrap.style.display = 'none';
      cfg.scenes[name].layers.forEach(function (layer, i) {
        var box = el('div', 'slp-l slp-l-' + keyOf(index, name, i));
        box.setAttribute('data-living-channel', layer.channel);
        var s = el('div', 'slp-s');
        var copies = layer.motion === 'flow' ? Math.max(1, layer.copies || 1) : 1;
        for (var j = 0; j < copies; j++) {
          // La texture décodée est clonée : même fichier, déjà en cache, pour chaque copie et chaque image.
          var t = loaded[layer.src].cloneNode(false);
          t.className = 'slp-t' + (copies > 1 ? ' slp-c' + j : '');
          s.appendChild(t);
        }
        box.appendChild(s);
        wrap.appendChild(box);
      });
      scenes[name] = wrap;
      stage.appendChild(wrap);
    });

    var r0 = node.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var s = {
      pending: 0, mode: null, depthOn: depthOn,
      offscreen: r0.bottom <= 0 || r0.top >= vh || !r0.width,
      still: false, scene: null, lastY: 0, lastP: 0, settleTimer: 0
    };

    function setDepth(y, p) {
      if (y === s.lastY && p === s.lastP) return;
      s.lastY = y;
      s.lastP = p;
      node.style.setProperty('--slp-y', y + 'px');
      node.style.setProperty('--slp-p', String(p));
    }
    function settle() {
      if (state.reduced) return;
      node.classList.add('symbol-living--settling');
      clearTimeout(s.settleTimer);
      s.settleTimer = setTimeout(function () { node.classList.remove('symbol-living--settling'); }, 450);
    }
    // Une lecture, une écriture : appelée au plus une fois par image, seulement en marche.
    s.depth = function () {
      if (!depthOn) return;
      var r = node.getBoundingClientRect();
      var d = Math.min(Math.max(-r.top, 0), r.height);
      var dpr = window.devicePixelRatio || 1;
      setDepth(Math.round(d * cfg.depth * dpr) / dpr, r.height ? num(d / r.height) : 0);
    };
    s.sync = function () {
      var reasons = [];
      if (state.user) reasons.push('user');
      if (state.hidden) reasons.push('hidden');
      if (s.offscreen) reasons.push('offscreen');
      s.mode = state.reduced ? 'reduced' : (reasons.length ? 'paused' : 'running');
      ['running', 'paused', 'reduced'].forEach(function (m) {
        node.classList.toggle('symbol-living--' + m, m === s.mode);
      });
      node.setAttribute('data-living-motion-state', s.mode);
      node.setAttribute('data-living-motion-reasons', reasons.join(' '));
      if (!depthOn) return;
      // Pause et mouvement réduit ramènent la profondeur au départ ; hors écran ou onglet caché, elle reste figée.
      var nowStill = state.user || state.reduced;
      if (nowStill) {
        if (s.lastY || s.lastP) { settle(); setDepth(0, 0); }
      } else if (s.mode === 'running') {
        if (s.still) settle();
        queue(s, 2);
      }
      s.still = nowStill;
    };
    // Aligne la scène sur le cadre réellement peint de la source affichée (contain, cover…, object-position).
    s.place = function () {
      var name = sceneOf(cfg, img.currentSrc || img.src);
      if (!name) { stage.style.display = 'none'; return; }
      stage.style.display = '';
      if (name !== s.scene) {
        if (s.scene) scenes[s.scene].style.display = 'none';
        s.scene = name;
        scenes[name].style.display = '';
        node.setAttribute('data-living-scene', name);
      }
      var ir = img.getBoundingClientRect();
      if (!ir.width || !ir.height) return;
      var hr = host.getBoundingClientRect();
      var cs = getComputedStyle(img);
      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return;
      var sx = ir.width / nw, sy = ir.height / nh;
      var fit = cs.objectFit, cw = ir.width, ch = ir.height, k;
      if (fit === 'contain' || fit === 'cover' || fit === 'none' || fit === 'scale-down') {
        k = fit === 'cover' ? Math.max(sx, sy) : fit === 'none' ? 1 : Math.min(sx, sy);
        if (fit === 'scale-down') k = Math.min(k, 1);
        cw = nw * k;
        ch = nh * k;
      }
      var p = (cs.objectPosition || '50% 50%').split(/\s+/);
      var st = stage.style;
      st.left = (ir.left - hr.left - host.clientLeft + offset(p[0], ir.width - cw)) + 'px';
      st.top = (ir.top - hr.top - host.clientTop + offset(p[1] || '50%', ir.height - ch)) + 'px';
      st.width = cw + 'px';
      st.height = ch + 'px';
      // L'illustration détourée sert de masque : les calques ne débordent jamais de ses contours fondus.
      if (cfg.mask) {
        var url = 'url("' + (img.currentSrc || img.src).replace(/"/g, '%22') + '")';
        if (st.getPropertyValue('mask-image') !== url) { st.setProperty('-webkit-mask-image', url); st.setProperty('mask-image', url); }
      }
    };

    if (depthOn) node.classList.add('symbol-living--depth');
    s.place();
    host.appendChild(stage);

    // Si le <style> injecté est bloqué (CSP…), on se retire plutôt que d'afficher des calques bruts :
    // ni la surface ni sa commande n'existent encore, teardown() ne laisse rien derrière lui.
    if (getComputedStyle(stage).position !== 'absolute') throw new Error('styles non appliqués');
    surfaces.push(s);
    ensureToggle(cfg.toggle);
    s.sync();
    s.place();

    // Chaque image ne s'anime que lorsqu'elle est elle-même à l'écran.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        s.offscreen = !entries[entries.length - 1].isIntersecting;
        s.sync();
      }).observe(node);
    }
    var relayout = function () { queue(s, 3); };
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(relayout);
      ro.observe(img);
      ro.observe(host);
    } else {
      window.addEventListener('resize', relayout);
    }
    img.addEventListener('load', relayout); // changement de source (<source media>, srcset) : autre scène

    void stage.offsetWidth; // fige l'état initial (opacité 0) avant le fondu d'apparition
    node.classList.add('symbol-living');
    node.setAttribute('data-living', 'ready');
    syncToggles();
    if (toggles[cfg.toggle]) toggles[cfg.toggle].classList.add('slp-toggle--on');
  }

  // Charge une surface : son image affichée, puis ses deux textures ; en cas d'échec, l'image reste seule.
  function start(cfg, index, node) {
    if (node.hasAttribute('data-living')) return; // idempotent
    var img = node.querySelector(cfg.img);
    if (!img) return;
    node.setAttribute('data-living', 'pending');
    ready(img)
      .then(function () {
        if (!sceneOf(cfg, img.currentSrc || img.src)) throw new Error('peinture inconnue');
        var srcs = [];
        Object.keys(cfg.scenes).forEach(function (name) {
          cfg.scenes[name].layers.forEach(function (layer) { if (srcs.indexOf(layer.src) === -1) srcs.push(layer.src); });
        });
        return Promise.all(srcs.map(texture)).then(function (images) {
          var loaded = {};
          srcs.forEach(function (src, i) { loaded[src] = images[i]; });
          return loaded;
        });
      })
      .then(function (loaded) { mount(cfg, index, node, img, loaded); })
      .catch(function () { teardown(node); });
  }

  function init() {
    listen();
    config.surfaces.forEach(function (cfg, index) {
      var node = document.querySelector(cfg.selector);
      if (!node) return;
      if (cfg.eager || !('IntersectionObserver' in window)) { start(cfg, index, node); return; }
      // Les images plus bas (vignettes en lazy, illustration latérale des grands écrans) démarrent à l'approche.
      // Une image non affichée (display:none) n'approche jamais : ni ses calques ni elle ne sont chargés.
      var near = new IntersectionObserver(function (entries) {
        if (!entries[entries.length - 1].isIntersecting) return;
        near.disconnect();
        start(cfg, index, node);
      }, { rootMargin: '200px 0px' });
      near.observe(node);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
