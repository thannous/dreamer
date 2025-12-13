(function () {
  const SUPPORTED = ["en", "fr", "es"];
  const currentLang = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
  const alternates = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).reduce((acc, link) => {
    const lang = (link.getAttribute("hreflang") || "").slice(0, 2).toLowerCase();
    if (!SUPPORTED.includes(lang)) return acc;
    acc[lang] = link.getAttribute("href");
    return acc;
  }, /** @type {Record<string, string>} */ ({}));

  const available = SUPPORTED.filter((code) => alternates[code]);
  if (available.length <= 1) return;

  const langSlot = findLanguageSlot();
  if (!langSlot) return;

  const menu = document.createElement("div");
  menu.className =
    "absolute right-0 mt-2 w-32 rounded-xl bg-[#140a28] border border-white/10 shadow-xl backdrop-blur-md overflow-hidden hidden";

  available
    .filter((code) => code !== currentLang)
    .forEach((code) => {
      const item = document.createElement("a");
      item.href = alternates[code];
      item.setAttribute("hreflang", code);
      item.className =
        "flex items-center gap-2 px-3 py-2 text-sm text-purple-100/80 hover:text-white hover:bg-white/5 transition-colors";
      item.textContent = code.toUpperCase();
      menu.appendChild(item);
    });

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `
    <i data-lucide="languages" class="w-4 h-4"></i>
    <span>${(currentLang || available[0]).toUpperCase()}</span>
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "relative";
  wrapper.appendChild(button);
  wrapper.appendChild(menu);

  langSlot.innerHTML = "";
  langSlot.appendChild(wrapper);

  const closeMenu = () => {
    menu.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    const isHidden = menu.classList.contains("hidden");
    if (isHidden) {
      menu.classList.remove("hidden");
      button.setAttribute("aria-expanded", "true");
    } else {
      closeMenu();
    }
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  function findLanguageSlot() {
    const nav = document.querySelector("nav");
    if (!nav) return null;
    const candidates = Array.from(
      nav.querySelectorAll("div.flex.items-center.gap-3, div.flex.gap-3.items-center, div.flex.items-center.gap-2")
    );
    return (
      candidates.find((c) => c.querySelector("a[href*='/en/'],a[href*='/fr/'],a[href*='/es/'],i[data-lucide='languages']")) ||
      candidates[candidates.length - 1] ||
      null
    );
  }
})();
