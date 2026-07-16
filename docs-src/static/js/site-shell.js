(() => {
  const CLARITY_PROJECT_ID = 'xnb1iax99j';
  const CLARITY_SCRIPT_ID = 'noctalia-clarity';
  const CLARITY_CONSENT_EVENT = 'noctalia:analytics-consent';
  const CONSENT_STORAGE_KEY = 'noctalia.analytics-consent.v1';
  const CONSENT_VERSION = 1;
  const CONSENT_DURATION_MS = 180 * 24 * 60 * 60 * 1000;
  const CONSENT_PANEL_ID = 'noctalia-analytics-consent';
  const CONSENT_STYLE_ID = 'noctalia-consent-style';
  const CONSENT_MANAGE_ID = 'noctalia-analytics-preferences';
  const deniedConsent = {
    ad_Storage: 'denied',
    analytics_Storage: 'denied',
  };
  const privacyPaths = {
    de: '/de/datenschutz',
    en: '/en/privacy-policy',
    es: '/es/politica-privacidad',
    fr: '/fr/politique-confidentialite',
    it: '/it/privacy-policy',
  };
  const translations = {
    de: {
      accept: 'Analyse erlauben',
      description:
        'Mit deiner Zustimmung hilft uns Microsoft Clarity mit Heatmaps und Sitzungsaufzeichnungen, die Nutzung der Website zu verstehen – ausschließlich, um Noctalia und diese Website zu verbessern. Texte und Felder werden maskiert. Keine Werbung.',
      gpc: 'Das Datenschutzsignal deines Browsers ist aktiv. Die Analyse bleibt deaktiviert.',
      manage: 'Analytics-Einstellungen',
      privacy: 'Mehr erfahren',
      reject: 'Ablehnen',
      title: 'Reichweitenmessung',
    },
    en: {
      accept: 'Allow analytics',
      description:
        'With your permission, Microsoft Clarity helps us understand website use through heatmaps and session recordings, solely to improve Noctalia and this website. Text and fields are masked. No advertising.',
      gpc: 'Your browser privacy signal is active. Analytics will remain disabled.',
      manage: 'Analytics preferences',
      privacy: 'Learn more',
      reject: 'Decline',
      title: 'Website analytics',
    },
    es: {
      accept: 'Permitir analítica',
      description:
        'Con tu permiso, Microsoft Clarity nos ayuda a entender el uso del sitio mediante mapas de calor y grabaciones de sesión, únicamente para mejorar Noctalia y este sitio. Los textos y campos se ocultan. Sin publicidad.',
      gpc: 'La señal de privacidad de tu navegador está activa. La analítica seguirá desactivada.',
      manage: 'Preferencias de analítica',
      privacy: 'Más información',
      reject: 'Rechazar',
      title: 'Analítica del sitio',
    },
    fr: {
      accept: "Accepter l'analyse",
      description:
        "Avec votre accord, Microsoft Clarity nous aide à comprendre l'utilisation du site grâce à des cartes de chaleur et des enregistrements de session, uniquement pour améliorer Noctalia et ce site. Les textes et les champs sont masqués. Aucun usage publicitaire.",
      gpc: "Le signal de confidentialité de votre navigateur est actif. L'analyse reste désactivée.",
      manage: 'Préférences analytics',
      privacy: 'En savoir plus',
      reject: 'Refuser',
      title: "Mesure d'audience",
    },
    it: {
      accept: 'Consenti analisi',
      description:
        "Con il tuo consenso, Microsoft Clarity ci aiuta a capire l'uso del sito tramite mappe di calore e registrazioni di sessione, esclusivamente per migliorare Noctalia e questo sito. Testi e campi sono mascherati. Nessuna pubblicità.",
      gpc: 'Il segnale privacy del browser è attivo. Le analisi resteranno disattivate.',
      manage: 'Preferenze analytics',
      privacy: 'Scopri di più',
      reject: 'Rifiuta',
      title: 'Analisi del sito',
    },
  };
  let analyticsConsentGranted = false;

  const getLanguage = () => {
    const language = document.documentElement.lang.toLowerCase().split('-')[0];
    return translations[language] ? language : 'en';
  };

  const isGpcEnabled = () => navigator.globalPrivacyControl === true;

  const readStoredConsent = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
      const isValid =
        stored?.version === CONSENT_VERSION &&
        ['granted', 'denied'].includes(stored.analytics) &&
        Number.isFinite(stored.expiresAt) &&
        stored.expiresAt > Date.now();

      if (isValid) {
        return stored.analytics;
      }

      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in hardened or private browser modes.
    }

    return null;
  };

  const storeConsent = (analytics) => {
    const updatedAt = Date.now();
    try {
      window.localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          version: CONSENT_VERSION,
          analytics,
          updatedAt,
          expiresAt: updatedAt + CONSENT_DURATION_MS,
        })
      );
    } catch {
      // The current page choice still applies when persistence is unavailable.
    }
  };

  const sendConsent = (analyticsStorage) => {
    if (typeof window.clarity !== 'function') {
      return;
    }

    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: analyticsStorage,
    });
  };

  const loadClarity = () => {
    const existingScript = document.getElementById(CLARITY_SCRIPT_ID);
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        sendConsent('granted');
      }
      return;
    }

    window.clarity = window.clarity || function clarityQueue() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };

    const script = document.createElement('script');
    script.id = CLARITY_SCRIPT_ID;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    script.async = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        sendConsent(analyticsConsentGranted ? 'granted' : 'denied');
      },
      { once: true }
    );
    script.addEventListener('error', () => script.remove(), { once: true });
    document.head.appendChild(script);
  };

  const updateAnalyticsConsent = (analyticsAllowed) => {
    analyticsConsentGranted = analyticsAllowed === true && !isGpcEnabled();
    if (analyticsConsentGranted) {
      loadClarity();
      return;
    }

    if (document.getElementById(CLARITY_SCRIPT_ID)) {
      window.clarity('consentv2', deniedConsent);
    }
  };

  const hideConsentPanel = () => {
    const panel = document.getElementById(CONSENT_PANEL_ID);
    if (panel) {
      panel.hidden = true;
    }
  };

  const showConsentPanel = ({ moveFocus = false } = {}) => {
    const panel = document.getElementById(CONSENT_PANEL_ID);
    if (!panel) {
      return;
    }

    panel.hidden = false;
    if (moveFocus) {
      const target = panel.querySelector(isGpcEnabled() ? '[data-consent="denied"]' : '[data-consent="granted"]');
      target?.focus();
    }
  };

  const applyConsentChoice = (analytics) => {
    const clarityWasLoaded = Boolean(document.getElementById(CLARITY_SCRIPT_ID));
    storeConsent(analytics ? 'granted' : 'denied');
    updateAnalyticsConsent(analytics);
    hideConsentPanel();

    if (!analytics && clarityWasLoaded) {
      window.setTimeout(() => window.location.reload(), 0);
    }
  };

  const addConsentStyles = () => {
    if (document.getElementById(CONSENT_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = CONSENT_STYLE_ID;
    style.textContent = `
      .noctalia-consent-panel[hidden] { display: none; }
      .noctalia-consent-panel { position: fixed; z-index: 10000; left: 50%; bottom: 1rem; width: min(42rem, calc(100% - 2rem)); transform: translateX(-50%); padding: 1.1rem; border: 1px solid rgba(253, 164, 129, 0.35); border-radius: 1rem; background: rgba(10, 5, 20, 0.98); color: #fff7f0; box-shadow: 0 1.25rem 3.5rem rgba(0, 0, 0, 0.45); }
      .noctalia-consent-panel h2 { margin: 0 0 0.45rem; color: #fff7f0; font-size: 1.15rem; line-height: 1.3; }
      .noctalia-consent-panel p { margin: 0; color: rgba(255, 247, 240, 0.82); font-size: 0.9rem; line-height: 1.55; }
      .noctalia-consent-panel a { color: #fda481; text-decoration: underline; text-underline-offset: 0.2em; }
      .noctalia-consent-gpc { margin-top: 0.55rem !important; color: #fda481 !important; }
      .noctalia-consent-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; margin-top: 1rem; }
      .noctalia-consent-actions button { min-height: 2.75rem; padding: 0.65rem 0.9rem; border: 1px solid rgba(253, 164, 129, 0.75); border-radius: 999px; background: transparent; color: #fff7f0; font: inherit; font-weight: 700; cursor: pointer; }
      .noctalia-consent-actions button:hover { background: rgba(253, 164, 129, 0.12); }
      .noctalia-consent-actions button:disabled { cursor: not-allowed; opacity: 0.45; }
      .noctalia-consent-actions button:focus-visible, .noctalia-consent-manage:focus-visible { outline: 3px solid #fff7f0; outline-offset: 3px; }
      .noctalia-consent-manage-wrap { display: flex; justify-content: center; margin-top: 1.25rem; }
      .noctalia-consent-manage { border: 0; padding: 0.35rem; background: transparent; color: rgba(255, 247, 240, 0.72); font: inherit; font-size: 0.8rem; text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; }
      .noctalia-consent-manage:hover { color: #fda481; }
      @media (max-width: 520px) { .noctalia-consent-panel { bottom: 0; width: 100%; border-right: 0; border-bottom: 0; border-left: 0; border-radius: 1rem 1rem 0 0; padding: 1rem; } .noctalia-consent-actions { grid-template-columns: 1fr; } }
      @media (prefers-reduced-motion: no-preference) { .noctalia-consent-panel { animation: noctalia-consent-in 180ms ease-out; } @keyframes noctalia-consent-in { from { opacity: 0; transform: translate(-50%, 0.75rem); } } }
    `;
    document.head.appendChild(style);
  };

  const initializeConsentUi = () => {
    if (!document.body || document.getElementById(CONSENT_PANEL_ID)) {
      return;
    }

    const language = getLanguage();
    const copy = translations[language];
    const gpcEnabled = isGpcEnabled();
    const storedConsent = readStoredConsent();
    addConsentStyles();

    const panel = document.createElement('section');
    panel.id = CONSENT_PANEL_ID;
    panel.className = 'noctalia-consent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', `${CONSENT_PANEL_ID}-title`);
    panel.setAttribute('aria-describedby', `${CONSENT_PANEL_ID}-description`);
    panel.innerHTML = `
      <h2 id="${CONSENT_PANEL_ID}-title">${copy.title}</h2>
      <p id="${CONSENT_PANEL_ID}-description">${copy.description} <a href="${privacyPaths[language]}">${copy.privacy}</a>.</p>
      ${gpcEnabled ? `<p class="noctalia-consent-gpc">${copy.gpc}</p>` : ''}
      <div class="noctalia-consent-actions">
        <button type="button" data-consent="granted"${gpcEnabled ? ' disabled aria-disabled="true"' : ''}>${copy.accept}</button>
        <button type="button" data-consent="denied">${copy.reject}</button>
      </div>
    `;
    panel.querySelector('[data-consent="granted"]').addEventListener('click', () => applyConsentChoice(true));
    panel.querySelector('[data-consent="denied"]').addEventListener('click', () => applyConsentChoice(false));
    document.body.appendChild(panel);

    const manageWrapper = document.createElement('div');
    manageWrapper.className = 'noctalia-consent-manage-wrap';
    manageWrapper.innerHTML = `<button id="${CONSENT_MANAGE_ID}" class="noctalia-consent-manage" type="button">${copy.manage}</button>`;
    const footer = document.querySelector('footer.site-footer');
    (footer || document.body).appendChild(manageWrapper);
    manageWrapper.querySelector('button').addEventListener('click', () => showConsentPanel({ moveFocus: true }));

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && readStoredConsent()) {
        hideConsentPanel();
        manageWrapper.querySelector('button').focus();
      }
    });

    if (storedConsent) {
      panel.hidden = true;
      updateAnalyticsConsent(storedConsent === 'granted');
    } else {
      updateAnalyticsConsent(false);
    }
  };

  window.addEventListener(CLARITY_CONSENT_EVENT, (event) => {
    updateAnalyticsConsent(event.detail?.analytics === true);
  });

  window.NoctaliaAnalyticsConsent = Object.freeze({
    init: initializeConsentUi,
    update: updateAnalyticsConsent,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConsentUi, { once: true });
  } else {
    initializeConsentUi();
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  if (!navbar) {
    return;
  }

  if (!document.getElementById('nav-scroll-style')) {
    const style = document.createElement('style');
    style.id = 'nav-scroll-style';
    style.textContent = `
      .nav-scroll-animate {
        transition: transform 0.3s ease, opacity 0.2s ease, background-color 0.2s ease, backdrop-filter 0.2s ease, box-shadow 0.2s ease;
        will-change: transform, opacity;
      }
      .nav-scroll-hidden {
        transform: translateY(-120%);
        opacity: 0;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  const expandedClass = navbar.dataset.expandedClass || 'py-6';
  const compactClass = navbar.dataset.compactClass || 'py-2';
  const shrinkOnScroll = Boolean(navbar.dataset.shrinkOnScroll);
  const canShrinkNavigation = window.matchMedia('(min-width: 768px)');
  const directionThreshold = 8;
  const hideOffset = 64;
  const showOffset = 8;
  let lastScrollY = window.scrollY;
  let ticking = false;

  const syncNavbar = () => {
    const currentScrollY = window.scrollY;
    const shouldShrink = shrinkOnScroll && canShrinkNavigation.matches;

    if (shouldShrink) {
      const compact = currentScrollY > 50;
      navbar.classList.toggle(compactClass, compact);
      navbar.classList.toggle(expandedClass, !compact);
    } else if (shrinkOnScroll) {
      navbar.classList.remove(compactClass);
      navbar.classList.add(expandedClass);
    }

    const delta = currentScrollY - lastScrollY;
    if (currentScrollY <= showOffset) {
      navbar.classList.remove('nav-scroll-hidden');
    } else if (Math.abs(delta) >= directionThreshold) {
      navbar.classList.toggle('nav-scroll-hidden', delta > 0 && currentScrollY > hideOffset);
      lastScrollY = currentScrollY;
    }

    ticking = false;
  };

  navbar.classList.add('nav-scroll-animate');
  syncNavbar();
  canShrinkNavigation.addEventListener('change', syncNavbar);
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(syncNavbar);
        ticking = true;
      }
    },
    { passive: true }
  );
});
