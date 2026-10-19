/*!
 * tiger-living-painting.js — Noctalia · pilote fiche Tigre V4 (brume, lueur de lanterne, profondeur au défilement)
 * Amélioration progressive : sans JS, image absente ou calque en échec → page d'origine intacte.
 * Calques du pilote V4, chargés relativement à ce script dans ../22c79c696a2f/assets/ : mist.webp | mist-mobile.webp, lantern-glow.webp.
 * Aucune commande de pause : le mouvement s'arrête de lui-même (mouvement réduit, onglet caché, héros hors écran).
 * Deux peintures : paysage tiger-v1 (1600×900) et portrait tiger-mobile-v4 (984×1599, téléphone en portrait).
 * La scène suit la source réellement affichée (currentSrc) et son cadrage (object-fit, object-position).
 * Contrôle : .symbol-hero[data-tiger-living="pending|ready|off"]
 *            [data-tiger-scene="landscape|portrait"]
 *            [data-tiger-motion-state="running|paused|reduced"]
 *            [data-tiger-motion-reasons="hidden offscreen"]
 */
(function () {
  'use strict';

  // Capturée immédiatement : document.currentScript n'existe que pendant l'exécution synchrone.
  var SCRIPT_URL = (function () {
    var s = document.currentScript;
    if (s && s.src) return s.src;
    s = document.querySelector('script[src*="tiger-living-painting"]');
    return s ? s.src : document.baseURI;
  })();

  /* ---- Calage, en pixels de chaque peinture source ------------------------------------------
   * Brume : deux plans par scène, chacun une fenêtre fixe à fondu gauche progressif (le tigre n'est
   *         jamais recouvert) où dérive une texture plus large. Marge par côté, (tex − w) / 2 moins
   *         les 5 % transparents de chaque bout de la texture, ≥ dérive + décalage au défilement :
   *         jamais de bord de texture visible. Le second plan est retourné et va en sens inverse.
   *         Les dérives démarrent à mi-course (vitesse maximale) : mouvement lisible dès l'arrivée.
   * Lueur : cœur centré sur le corps de la lanterne, plus un halo large et doux autour. */
  var SCENES = {
    landscape: { // Tigre x50..995, y245..750 ; lanterne x248..337, y100..228.
      re: /tiger-v1-[0-9]+w\./, w: 1600, h: 900,
      mist: [
        { x: 960, y: 390, w: 640, h: 300, tex: 1200, drift: 120, dur: 11, scroll: -64, fade: 34, op: [0.5, 0.62] },
        { x: 1000, y: 480, w: 600, h: 240, tex: 1000, drift: 85, dur: 8, scroll: 48, fade: 40, op: [0.34, 0.44], flip: true }
      ],
      glow: { cx: 292, cy: 163, size: 220 }
    },
    portrait: { // Visage x270..550, y635..925 ; vallée x550..984, y620..1100 ; lanterne x184..302, y292..466.
      re: /tiger-mobile-v4-[0-9]+w\./, w: 984, h: 1599,
      mist: [ // textures étirées en hauteur (tall) : la scène est étroite, la brume doit rester lisible
        { x: 550, y: 620, w: 434, h: 300, tex: 1000, tall: 1.5, drift: 130, dur: 7, scroll: -48, fade: 34, op: [0.58, 0.7] },
        { x: 590, y: 860, w: 394, h: 280, tex: 900, tall: 1.4, drift: 110, dur: 5.5, scroll: 40, fade: 40, op: [0.42, 0.52], flip: true }
      ],
      glow: { cx: 244, cy: 378, size: 260 }
    }
  };
  var MIST_RATIO = 533 / 1600; // hauteur / largeur des textures de brume
  var MIST_DRIFT_Y = 6;        // dérive verticale, px source
  var HALO = 1.9;              // diamètre du halo large / diamètre du cœur
  var PARALLAX = 0.5;          // la scène descend de la moitié du défilement : le contenu remonte jusqu'à la moitié de la peinture (< 1 : jamais de bande vide en haut)

  var ASSETS = { mist: '../22c79c696a2f/assets/mist.webp', mistMobile: '../22c79c696a2f/assets/mist-mobile.webp', glow: '../22c79c696a2f/assets/lantern-glow.webp' };
  var MQ_MOBILE = '(max-width: 767px)';
  var MQ_REDUCED = '(prefers-reduced-motion: reduce)';
  var STYLE_ID = 'tiger-living-painting-style';

  function num(v) { return +v.toFixed(4); }
  function pct(v, total) { return num(v / total * 100) + '%'; }
  function mask(g) { return '-webkit-mask-image:linear-gradient(' + g + ');mask-image:linear-gradient(' + g + ');'; }
  function el(tag, cls) { var n = document.createElement(tag); n.className = cls; return n; }
  function mql(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  function onChange(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function sceneOf(src) {
    for (var name in SCENES) if (SCENES[name].re.test(src || '')) return name;
    return null;
  }
  // Démarre au milieu d'un aller (vitesse maximale) : aucune phase immobile au chargement.
  function anim(name, dur) { return 'animation:' + name + ' ' + num(dur) + 's ease-in-out -' + num(dur / 2) + 's infinite alternate;'; }

  function box(sc, cx, cy, size) {
    var r = size / 2;
    return 'left:' + pct(cx - r, sc.w) + ';top:' + pct(cy - r, sc.h) + ';width:' + pct(size, sc.w) + ';height:' + pct(size, sc.h) + ';';
  }

  function sceneCss(name) {
    var sc = SCENES[name], pre = '.tlp-scene-' + name + ' ', css = [];
    sc.mist.forEach(function (m, i) {
      var key = name + i, plane = pre + '.tlp-mist-' + i;
      var texH = m.tex * MIST_RATIO * (m.tall || 1);
      var dx = num(m.drift / m.tex * 100), dy = num(MIST_DRIFT_Y / texH * 100);
      css.push(
        plane + '{left:' + pct(m.x, sc.w) + ';top:' + pct(m.y, sc.h) + ';width:' + pct(m.w, sc.w) + ';height:' + pct(m.h, sc.h) + ';' +
          mask('90deg,transparent 0,#000 ' + m.fade + '%,#000 100%') + anim('tlp-b-' + key, m.dur * 1.3) + '}',
        plane + ' .tlp-mist-s{transform:translate3d(calc(var(--tlp-p,0) * ' + pct(m.scroll, m.w) + '),0,0)' + (m.flip ? ' scaleX(-1)' : '') + '}',
        plane + ' .tlp-mist-tex{left:' + pct((m.w - m.tex) / 2, m.w) + ';top:' + pct((m.h - texH) / 2, m.h) +
          ';width:' + pct(m.tex, m.w) + ';height:' + pct(texH, m.h) + ';' + anim('tlp-d-' + key, m.dur) + '}',
        '@keyframes tlp-d-' + key + '{from{transform:translate3d(-' + dx + '%,' + dy + '%,0)}to{transform:translate3d(' + dx + '%,-' + dy + '%,0)}}',
        '@keyframes tlp-b-' + key + '{from{opacity:' + m.op[0] + '}to{opacity:' + m.op[1] + '}}'
      );
    });
    css.push(
      pre + '.tlp-glow{' + box(sc, sc.glow.cx, sc.glow.cy, sc.glow.size) + '}',
      pre + '.tlp-halo{' + box(sc, sc.glow.cx, sc.glow.cy, sc.glow.size * HALO) + '}'
    );
    return css.join('\n');
  }

  function buildCss() {
    return [
      /* Scène calée sur le cadre réellement affiché de la peinture (voir place()). */
      '.tlp-stage{position:absolute;z-index:0;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .8s ease;contain:layout paint}',
      '.tiger-living .tlp-stage{opacity:1}',
      '.tlp-stage img{display:block;position:absolute;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;object-fit:fill;-webkit-user-select:none;user-select:none}',
      '.tlp-mist{position:absolute;overflow:hidden}',
      '.tlp-mist-v{position:absolute;left:0;top:0;width:100%;height:100%;' + mask('180deg,transparent 0,#000 30%,#000 70%,transparent 100%') + '}',
      '.tlp-mist-s{position:absolute;left:0;top:0;width:100%;height:100%}',
      '.tlp-glow,.tlp-halo{position:absolute}',
      '.tlp-stage .tlp-glow-img,.tlp-stage .tlp-halo-img{left:0;top:0;width:100%;height:100%}',

      /* Lueur : cœur 2,4 s × 3,7 s (opacité effective ≈ .45–.9), halo large 3,1 s ; aucun éclat brusque. */
      '.tlp-glow{' + anim('tlp-glow-a', 2.4) + '}',
      '.tlp-stage .tlp-glow-img{' + anim('tlp-glow-b', 3.7) + '}',
      '.tlp-stage .tlp-halo-img{' + anim('tlp-halo', 3.1) + '}',
      '@keyframes tlp-glow-a{from{opacity:.55}to{opacity:1}}',
      '@keyframes tlp-glow-b{from{opacity:.82;transform:scale(.96)}to{opacity:.9;transform:scale(1.05)}}',
      '@keyframes tlp-halo{from{opacity:.22}to{opacity:.4}}',
      sceneCss('landscape'),
      sceneCss('portrait'),

      /* Profondeur au défilement : peinture et calques descendent ensemble (même transform),
       * la brume glisse en plus de son côté ; arrondi au pixel physique dans depth(). */
      '.tiger-living--depth .symbol-hero-figure{transform:translate3d(0,var(--tlp-y,0px),0)}',
      '.tiger-living--running.tiger-living--depth .symbol-hero-figure{will-change:transform}',
      '.tiger-living--settling .symbol-hero-figure,.tiger-living--settling .tlp-mist-s{transition:transform .45s ease}',

      /* États : priment sur les règles d'animation par scène, plus spécifiques. */
      '.tiger-living--paused .tlp-anim{animation-play-state:paused!important}',
      '.tiger-living--reduced .tlp-anim{animation:none!important}',
      '.tiger-living--reduced .tlp-stage,.tiger-living--reduced .symbol-hero-figure,.tiger-living--reduced .tlp-mist-s{transition:none}',
      '@media print{.tlp-stage{display:none!important}}'
    ].join('\n');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    var withNonce = document.querySelector('script[nonce],style[nonce]');
    if (withNonce && withNonce.nonce) st.nonce = withNonce.nonce;
    st.textContent = buildCss();
    (document.head || document.documentElement).appendChild(st);
  }

  // Résout une fois l'image chargée ET décodée ; rejette si elle est absente ou cassée.
  function decode(img) {
    if (typeof img.decode === 'function') {
      return img.decode().then(function () {
        if (!img.naturalWidth) throw new Error('image vide');
        return img;
      }, function (err) {
        if (img.complete && img.naturalWidth) return img; // decode() peut rejeter sur une image déjà affichée
        throw err;
      });
    }
    return new Promise(function (resolve, reject) {
      if (img.complete) { if (img.naturalWidth) resolve(img); else reject(new Error('image cassée')); return; }
      img.addEventListener('load', function () { resolve(img); }, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  }

  function loadLayer(path, cls) {
    var im = new Image();
    im.alt = '';
    im.decoding = 'async';
    if ('fetchPriority' in im) im.fetchPriority = 'low';
    im.draggable = false;
    im.setAttribute('aria-hidden', 'true');
    im.className = cls;
    im.src = new URL(path, SCRIPT_URL).href;
    return decode(im);
  }

  // Décalage object-position (%, px ou mots-clés) dans l'espace libre.
  function offset(tok, free) {
    if (/%$/.test(tok)) return free * parseFloat(tok) / 100;
    if (/px$/.test(tok)) return parseFloat(tok);
    if (tok === 'left' || tok === 'top') return 0;
    if (tok === 'right' || tok === 'bottom') return free;
    return free / 2;
  }

  function teardown(hero) {
    var nodes = hero.querySelectorAll('.tlp-stage');
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
    hero.classList.remove('tiger-living', 'tiger-living--running', 'tiger-living--paused', 'tiger-living--reduced',
      'tiger-living--depth', 'tiger-living--settling');
    hero.style.removeProperty('--tlp-y');
    hero.style.removeProperty('--tlp-p');
    hero.removeAttribute('data-tiger-scene');
    hero.removeAttribute('data-tiger-motion-state');
    hero.removeAttribute('data-tiger-motion-reasons');
    hero.setAttribute('data-tiger-living', 'off');
  }

  function mount(hero, img, layers) {
    injectStyle();

    var host = hero.querySelector('.symbol-hero-figure');
    if (!host || !host.contains(img) || getComputedStyle(host).position === 'static') host = hero;
    var depthOn = host !== hero; // la profondeur déplace le figure : peinture et calques restent alignés

    var stage = el('div', 'tlp-stage');
    stage.setAttribute('aria-hidden', 'true');
    [layers[0], layers[1]].forEach(function (tex, i) {
      var plane = el('div', 'tlp-mist tlp-mist-' + i + ' tlp-anim');
      var v = el('div', 'tlp-mist-v');
      var s = el('div', 'tlp-mist-s');
      s.appendChild(tex);
      v.appendChild(s);
      plane.appendChild(v);
      stage.appendChild(plane);
    });
    var halo = el('div', 'tlp-halo');
    halo.appendChild(layers[3]);
    var glow = el('div', 'tlp-glow tlp-anim');
    glow.appendChild(layers[2]);
    stage.appendChild(halo);
    stage.appendChild(glow);

    // La pause dépend de l'onglet, de l'intersection et de la préférence système.
    var reducedMq = mql(MQ_REDUCED);
    var hr0 = hero.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var state = {
      hidden: document.visibilityState === 'hidden',
      offscreen: hr0.bottom <= 0 || hr0.top >= vh,
      reduced: !!(reducedMq && reducedMq.matches)
    };
    var mode = null, still = false, scene = null, settleTimer = 0, lastY = 0, lastP = 0;

    function setDepth(y, p) {
      if (y === lastY && p === lastP) return;
      lastY = y;
      lastP = p;
      hero.style.setProperty('--tlp-y', y + 'px');
      hero.style.setProperty('--tlp-p', String(p));
    }

    // Retour (ou reprise) en douceur sur .45 s, sauf en mouvement réduit.
    function settle() {
      if (state.reduced) return;
      hero.classList.add('tiger-living--settling');
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { hero.classList.remove('tiger-living--settling'); }, 450);
    }

    // Une lecture, une écriture : appelée au plus une fois par image, seulement en marche.
    function depth() {
      var r = hero.getBoundingClientRect();
      var s = Math.min(Math.max(-r.top, 0), r.height);
      var dpr = window.devicePixelRatio || 1;
      setDepth(depthOn ? Math.round(s * PARALLAX * dpr) / dpr : 0, r.height ? num(s / r.height) : 0);
    }

    var PLACE = 1, DEPTH = 2, pending = 0;
    function queue(what) {
      if (!pending) requestAnimationFrame(frame);
      pending |= what;
    }
    function frame() {
      var what = pending;
      pending = 0;
      if (what & PLACE) place();
      if (what & DEPTH && mode === 'running') depth();
    }

    function sync() {
      var reasons = [];
      if (state.hidden) reasons.push('hidden');
      if (state.offscreen) reasons.push('offscreen');
      mode = state.reduced ? 'reduced' : (reasons.length ? 'paused' : 'running');
      ['running', 'paused', 'reduced'].forEach(function (m) {
        hero.classList.toggle('tiger-living--' + m, m === mode);
      });
      hero.setAttribute('data-tiger-motion-state', mode);
      hero.setAttribute('data-tiger-motion-reasons', reasons.join(' '));

      // Le mouvement réduit ramène la profondeur au départ ; hors écran ou onglet caché, elle reste figée.
      var nowStill = state.reduced;
      if (nowStill) {
        if (lastY || lastP) { settle(); setDepth(0, 0); }
      } else if (mode === 'running') {
        if (still) settle();
        queue(DEPTH);
      }
      still = nowStill;
    }

    // Aligne la scène sur le cadre réellement peint de la source affichée (contain, cover, fill…, object-position).
    function place() {
      var name = sceneOf(img.currentSrc || img.src);
      if (name && name !== scene) {
        scene = name;
        stage.className = 'tlp-stage tlp-scene-' + name;
        hero.setAttribute('data-tiger-scene', name);
      }
      var ir = img.getBoundingClientRect();
      if (!ir.width || !ir.height) return;
      var sc = SCENES[scene];
      var hr = host.getBoundingClientRect();
      var cs = getComputedStyle(img);
      var nw = img.naturalWidth || sc.w, nh = img.naturalHeight || sc.h;
      var sx = ir.width / nw, sy = ir.height / nh;
      var fit = cs.objectFit, cw = ir.width, ch = ir.height, s;
      if (fit === 'contain' || fit === 'cover' || fit === 'none' || fit === 'scale-down') {
        s = fit === 'cover' ? Math.max(sx, sy) : fit === 'none' ? 1 : Math.min(sx, sy);
        if (fit === 'scale-down') s = Math.min(s, 1);
        cw = nw * s;
        ch = nh * s;
      }
      var p = (cs.objectPosition || '50% 50%').split(/\s+/);
      var st = stage.style;
      st.left = (ir.left - hr.left - host.clientLeft + offset(p[0], ir.width - cw)) + 'px';
      st.top = (ir.top - hr.top - host.clientTop + offset(p[1] || '50%', ir.height - ch)) + 'px';
      st.width = cw + 'px';
      st.height = ch + 'px';
    }

    if (depthOn) hero.classList.add('tiger-living--depth');
    sync();
    place();
    host.appendChild(stage);

    // Si le <style> injecté est bloqué (CSP…), on se retire plutôt que d'afficher des calques bruts.
    if (getComputedStyle(stage).position !== 'absolute') throw new Error('styles non appliqués');

    place();

    document.addEventListener('visibilitychange', function () {
      state.hidden = document.visibilityState === 'hidden';
      sync();
    });
    onChange(reducedMq, function (e) { state.reduced = e.matches; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        state.offscreen = !entries[entries.length - 1].isIntersecting;
        sync();
      }).observe(hero);
    }
    // Défilement passif : au plus une rAF par événement, aucun travail hors marche (pause, réduit, hors écran, caché).
    window.addEventListener('scroll', function () { if (mode === 'running') queue(DEPTH); }, { passive: true });
    function relayout() { queue(PLACE | DEPTH); }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(relayout);
      ro.observe(img);
      ro.observe(host);
    } else {
      window.addEventListener('resize', relayout);
    }
    img.addEventListener('load', relayout); // changement de source (<source media>, srcset) : nouvelle scène

    void stage.offsetWidth; // fige l'état initial (opacité 0) avant le fondu d'apparition
    hero.classList.add('tiger-living');
    hero.setAttribute('data-tiger-living', 'ready');
  }

  function init() {
    var hero = document.querySelector('.symbol-hero');
    if (!hero || hero.hasAttribute('data-tiger-living')) return; // idempotent
    var img = hero.querySelector('.symbol-hero-media img') || hero.querySelector('img');
    if (!img) return;
    var picture = img.parentNode;
    var hint = [img.currentSrc, img.getAttribute('src'), img.getAttribute('srcset')];
    if (picture && picture.querySelectorAll) {
      var sources = picture.querySelectorAll('source');
      for (var i = 0; i < sources.length; i++) hint.push(sources[i].getAttribute('srcset'));
    }
    if (!sceneOf(hint.join(' '))) return;

    hero.setAttribute('data-tiger-living', 'pending');
    var mobile = !!(mql(MQ_MOBILE) && mql(MQ_MOBILE).matches); // une seule texture de brume, choisie au démarrage
    var mist = mobile ? ASSETS.mistMobile : ASSETS.mist;

    decode(img)
      .then(function () {
        if (!sceneOf(img.currentSrc || img.src)) throw new Error('peinture inconnue');
        return Promise.all([
          loadLayer(mist, 'tlp-mist-tex tlp-anim'),
          loadLayer(mist, 'tlp-mist-tex tlp-anim'),
          loadLayer(ASSETS.glow, 'tlp-glow-img tlp-anim'),
          loadLayer(ASSETS.glow, 'tlp-halo-img tlp-anim')
        ]);
      })
      .then(function (layers) { mount(hero, img, layers); })
      .catch(function () { teardown(hero); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
