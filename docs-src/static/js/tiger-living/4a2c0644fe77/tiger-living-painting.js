/*!
 * tiger-living-painting.js — Noctalia · pilote fiche Tigre (brume + lueur de lanterne)
 * Amélioration progressive : sans JS, image absente ou calque en échec → page d'origine intacte.
 * Calques chargés relativement à ce script : assets/mist.webp | assets/mist-mobile.webp, assets/lantern-glow.webp.
 * Contrôle : .symbol-hero[data-tiger-living="pending|ready|off"]
 *            [data-tiger-motion-state="running|paused|reduced"]
 *            [data-tiger-motion-reasons="user hidden offscreen"]
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

  /* ---- Calage, en pixels de la source 1600×900 ------------------------------------------
   * Tigre : x50..995, y245..750 → jamais recouvert.
   * Brume : fenêtre fixe dans la vallée droite, x960..1600, y400..680. Le fondu gauche du masque
   *         (0 → 34 % de la fenêtre, soit x960 → x1178) rend la brume quasi nulle avant x1000.
   *         La texture déborde de 17,5 % de chaque côté (112 px source) et dérive de ±55 px (±90 px sur mobile) / ±4 px source.
   * Lueur : centrée sur le corps de la lanterne (x248..337, y100..228) : centre x292 y163, Ø 220. */
  var SRC_W = 1600, SRC_H = 900;
  var MIST = { x: 960, y: 400, w: 640, h: 280, overscan: 0.35, driftX: 55, driftXMobile: 90, driftY: 4, ratio: 533 / 1600 };
  var GLOW = { cx: 292, cy: 163, size: 220 };

  var ASSETS = { mist: 'assets/mist.webp', mistMobile: 'assets/mist-mobile.webp', glow: 'assets/lantern-glow.webp' };
  var MQ_MOBILE = '(max-width: 767px)';
  var MQ_REDUCED = '(prefers-reduced-motion: reduce)';
  var TIGER_RE = /tiger-v1(?![0-9])/;
  var STYLE_ID = 'tiger-living-painting-style';
  var LABEL = 'Pause de l\u2019animation du d\u00e9cor';
  var ICONS =
    '<svg class="tlp-i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>' +
    '<svg class="tlp-i-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.5v13L19 12z"/></svg>';

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

  function buildCss() {
    var texW = MIST.w * (1 + MIST.overscan);   // largeur de la texture (px source)
    var texH = texW * MIST.ratio;               // hauteur, ratio 3:1 de l'asset
    var texHPct = texH / MIST.h * 100;          // hauteur en % de la fenêtre
    var dx = num(MIST.driftX / texW * 100);     // dérive en % de la texture elle-même
    var dy = num(MIST.driftY / texH * 100);
    var dxm = num(MIST.driftXMobile / texW * 100); // mobile : scène ~6× plus petite, dérive plus ample pour rester perceptible
    var r = GLOW.size / 2;
    return [
      /* Scène calée sur le cadre réellement affiché de la peinture (voir place()). */
      '.tlp-stage{position:absolute;z-index:0;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;transition:opacity 1.6s ease;contain:layout paint}',
      '.tiger-living .tlp-stage{opacity:1}',
      '.tlp-stage img{display:block;position:absolute;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;object-fit:fill;-webkit-user-select:none;user-select:none}',

      /* Brume : fenêtre fixe + fondu horizontal > fondu vertical fixe > texture qui dérive. */
      '.tlp-mist{position:absolute;left:' + pct(MIST.x, SRC_W) + ';top:' + pct(MIST.y, SRC_H) +
        ';width:' + pct(MIST.w, SRC_W) + ';height:' + pct(MIST.h, SRC_H) + ';overflow:hidden;opacity:.25;' +
        mask('90deg,transparent 0,#000 34%,#000 100%') +
        'animation:tlp-mist-breathe 41s ease-in-out infinite alternate}',
      '.tlp-mist-v{position:absolute;left:0;top:0;width:100%;height:100%;' +
        mask('180deg,transparent 0,#000 32%,#000 66%,transparent 100%') + '}',
      '.tlp-stage .tlp-mist-tex{left:' + num(-MIST.overscan * 50) + '%;top:' + num((100 - texHPct) / 2) +
        '%;width:' + num((1 + MIST.overscan) * 100) + '%;height:' + num(texHPct) +
        '%;animation:tlp-mist-drift 18s ease-in-out infinite alternate}',

      /* Lueur : halo autour du corps de la lanterne, deux cycles désynchronisés (2,4 s et 3,7 s). */
      '.tlp-glow{position:absolute;left:' + pct(GLOW.cx - r, SRC_W) + ';top:' + pct(GLOW.cy - r, SRC_H) +
        ';width:' + pct(GLOW.size, SRC_W) + ';height:' + pct(GLOW.size, SRC_H) +
        ';opacity:.8;animation:tlp-glow-a 2.4s ease-in-out infinite alternate}',
      '.tlp-stage .tlp-glow-img{left:0;top:0;width:100%;height:100%;opacity:.5;animation:tlp-glow-b 3.7s ease-in-out infinite alternate}',

      '@keyframes tlp-mist-drift{from{transform:translate3d(-' + dx + '%,' + dy + '%,0)}to{transform:translate3d(' + dx + '%,-' + dy + '%,0)}}',
      '@keyframes tlp-mist-drift-m{from{transform:translate3d(-' + dxm + '%,' + dy + '%,0)}to{transform:translate3d(' + dxm + '%,-' + dy + '%,0)}}',
      '@keyframes tlp-mist-breathe{from{opacity:.22}to{opacity:.28}}',
      '@keyframes tlp-mist-breathe-m{from{opacity:.16}to{opacity:.2}}',
      '@keyframes tlp-glow-a{from{opacity:.4}to{opacity:1}}', // × .50–.55 → opacité effective ≈ .20–.55
      '@keyframes tlp-glow-b{from{opacity:.5;transform:scale(.97)}to{opacity:.55;transform:scale(1.03)}}',
      '@media ' + MQ_MOBILE + '{.tlp-mist{opacity:.18;animation-name:tlp-mist-breathe-m}.tlp-stage .tlp-mist-tex{animation-name:tlp-mist-drift-m;animation-duration:14s}}',

      /* Bouton pause / reprise : à droite, sous la navbar ; ajustable via --tlp-toggle-top sur .symbol-hero. */
      '.tlp-toggle{position:absolute;z-index:3;top:6.5rem;top:var(--tlp-toggle-top,min(6.5rem,calc(100% - 3.25rem)));right:1rem;right:max(1rem,env(safe-area-inset-right));' +
        'box-sizing:border-box;width:44px;height:44px;min-width:44px;min-height:44px;margin:0;padding:0;display:inline-flex;align-items:center;justify-content:center;' +
        'border:1px solid rgba(243,234,216,.4);border-radius:999px;background:rgba(10,5,20,.6);color:#f3ead8;font:inherit;line-height:1;cursor:pointer;opacity:0;' +
        'transition:opacity .4s ease,border-color .2s ease,background-color .2s ease;-webkit-tap-highlight-color:transparent}',
      '.tiger-living .tlp-toggle{opacity:1}',
      '.tlp-toggle[hidden]{display:none}',
      '.tlp-toggle:hover{border-color:rgba(243,234,216,.75);background:rgba(10,5,20,.78)}',
      '.tlp-toggle:focus-visible{outline:2px solid #e8cf9a;outline-offset:3px}',
      '.tlp-toggle svg{display:block;width:18px;height:18px;pointer-events:none}',
      '.tlp-toggle .tlp-i-play,.tlp-toggle[aria-pressed="true"] .tlp-i-pause{display:none}',
      '.tlp-toggle[aria-pressed="true"] .tlp-i-play{display:block}',
      '.tlp-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',

      /* États : à garder en dernier (même spécificité que les règles d'animation ci-dessus). */
      '.tiger-living--paused .tlp-anim{animation-play-state:paused}',
      '.tiger-living--reduced .tlp-anim{animation:none}',
      '.tiger-living--reduced .tlp-stage,.tiger-living--reduced .tlp-toggle{transition:none}',
      '@media print{.tlp-stage,.tlp-toggle{display:none!important}}'
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
      if (img.complete) { if (img.naturalWidth) resolve(img); else reject(new Error('image cass\u00e9e')); return; }
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
    var nodes = hero.querySelectorAll('.tlp-stage,.tlp-toggle');
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
    hero.classList.remove('tiger-living', 'tiger-living--running', 'tiger-living--paused', 'tiger-living--reduced');
    hero.removeAttribute('data-tiger-motion-state');
    hero.removeAttribute('data-tiger-motion-reasons');
    hero.setAttribute('data-tiger-living', 'off');
  }

  function mount(hero, img, mistImg, glowImg) {
    injectStyle();

    var host = hero.querySelector('.symbol-hero-figure');
    if (!host || !host.contains(img) || getComputedStyle(host).position === 'static') host = hero;

    var stage = el('div', 'tlp-stage');
    stage.setAttribute('aria-hidden', 'true');
    var mist = el('div', 'tlp-mist tlp-anim');
    var mistV = el('div', 'tlp-mist-v');
    var glow = el('div', 'tlp-glow tlp-anim');
    mistV.appendChild(mistImg);
    mist.appendChild(mistV);
    glow.appendChild(glowImg);
    stage.appendChild(mist);
    stage.appendChild(glow);

    var btn = el('button', 'tlp-toggle');
    btn.type = 'button';
    btn.hidden = true;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = ICONS + '<span class="tlp-sr">' + LABEL + '</span>';

    // La pause globale dépend de l'utilisateur, de l'onglet, de l'intersection et de la préférence système.
    var reducedMq = mql(MQ_REDUCED);
    var hr0 = hero.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var state = {
      user: false,
      hidden: document.visibilityState === 'hidden',
      offscreen: hr0.bottom <= 0 || hr0.top >= vh,
      reduced: !!(reducedMq && reducedMq.matches)
    };

    function sync() {
      var reasons = [];
      if (state.user) reasons.push('user');
      if (state.hidden) reasons.push('hidden');
      if (state.offscreen) reasons.push('offscreen');
      var mode = state.reduced ? 'reduced' : (reasons.length ? 'paused' : 'running');
      ['running', 'paused', 'reduced'].forEach(function (m) {
        hero.classList.toggle('tiger-living--' + m, m === mode);
      });
      hero.setAttribute('data-tiger-motion-state', mode);
      hero.setAttribute('data-tiger-motion-reasons', reasons.join(' '));
      btn.setAttribute('aria-pressed', state.user ? 'true' : 'false');
      btn.hidden = state.reduced;
    }

    // Aligne la scène sur le cadre réellement peint de l'image (contain, cover, fill…, object-position).
    function place() {
      var ir = img.getBoundingClientRect();
      if (!ir.width || !ir.height) return;
      var hr = host.getBoundingClientRect();
      var cs = getComputedStyle(img);
      var nw = img.naturalWidth || SRC_W, nh = img.naturalHeight || SRC_H;
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

    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; place(); });
    }

    sync();
    host.appendChild(stage);
    hero.appendChild(btn);

    // Si le <style> injecté est bloqué (CSP…), on se retire plutôt que d'afficher des calques bruts.
    if (getComputedStyle(stage).position !== 'absolute') throw new Error('styles non appliqu\u00e9s');

    place();

    btn.addEventListener('click', function () { state.user = !state.user; sync(); });
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
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(schedule);
      ro.observe(img);
      ro.observe(host);
    } else {
      window.addEventListener('resize', schedule);
    }
    img.addEventListener('load', schedule); // changement de candidat srcset

    void stage.offsetWidth; // fige l'état initial (opacité 0) avant le fondu d'apparition
    hero.classList.add('tiger-living');
    hero.setAttribute('data-tiger-living', 'ready');
  }

  function init() {
    var hero = document.querySelector('.symbol-hero');
    if (!hero || hero.hasAttribute('data-tiger-living')) return; // idempotent
    var img = hero.querySelector('.symbol-hero-media img') || hero.querySelector('img');
    if (!img) return;
    var hint = [img.currentSrc, img.getAttribute('src'), img.getAttribute('srcset')].join(' ');
    if (!TIGER_RE.test(hint)) return;

    hero.setAttribute('data-tiger-living', 'pending');
    var mobile = !!(mql(MQ_MOBILE) && mql(MQ_MOBILE).matches); // une seule brume, choisie au démarrage

    decode(img)
      .then(function () {
        if (!TIGER_RE.test(img.currentSrc || img.src)) throw new Error('pas la peinture tiger-v1');
        return Promise.all([
          loadLayer(mobile ? ASSETS.mistMobile : ASSETS.mist, 'tlp-mist-tex tlp-anim'),
          loadLayer(ASSETS.glow, 'tlp-glow-img tlp-anim')
        ]);
      })
      .then(function (layers) { mount(hero, img, layers[0], layers[1]); })
      .catch(function () { teardown(hero); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
