/**
 * Language Dropdown Toggle
 * Handles the opening/closing of the language selection dropdown
 */
(() => {
  document.addEventListener('DOMContentLoaded', function() {
    async function injectSiteVersion() {
      try {
        const footer = document.querySelector('footer');
        if (!footer) return;

        const footerBar = footer.querySelector('div.text-center.pt-8.border-t');
        if (!footerBar) return;

        if (footerBar.querySelector('[data-site-version]')) return;

        const res = await fetch('/version.txt', { cache: 'no-store' });
        if (!res.ok) return;

        const version = (await res.text()).trim();
        if (!version) return;

        const target = footerBar.querySelector('span');
        if (!target) return;

        const versionEl = document.createElement('span');
        versionEl.dataset.siteVersion = '';
        versionEl.textContent = ` · v${version}`;
        versionEl.style.fontFamily =
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
        versionEl.style.opacity = '0.85';
        target.appendChild(versionEl);
      } catch {
        // Best-effort: version should never block page rendering.
      }
    }

    injectSiteVersion();

    const dropdownButton = document.getElementById('languageDropdownButton');
    const dropdownMenu = document.getElementById('languageDropdownMenu');
    const dropdownChevron = document.getElementById('dropdownChevron');

    if (!dropdownButton || !dropdownMenu) return;

    /**
     * Opens the dropdown menu
     */
    function openDropdown() {
      dropdownMenu.classList.remove('hidden');
      dropdownButton.setAttribute('aria-expanded', 'true');
      if (dropdownChevron) {
        dropdownChevron.style.transform = 'rotate(180deg)';
      }
    }

    /**
     * Closes the dropdown menu
     */
    function closeDropdown() {
      dropdownMenu.classList.add('hidden');
      dropdownButton.setAttribute('aria-expanded', 'false');
      if (dropdownChevron) {
        dropdownChevron.style.transform = 'rotate(0deg)';
      }
    }

    /**
     * Toggle dropdown on button click
     */
    dropdownButton.addEventListener('click', function(e) {
      e.stopPropagation();
      const isExpanded = dropdownButton.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    /**
     * Close dropdown when clicking outside
     */
    document.addEventListener('click', function(e) {
      // Only close if click is outside both button and menu
      if (!dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
        closeDropdown();
      }
    });

    /**
     * Close dropdown on ESC key
     */
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeDropdown();
      }
    });

    /**
     * Re-initialize Lucide icons after DOM changes
     * This ensures the chevron-down and check icons render properly
     */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      // Wait a bit for the script to load if needed
      setTimeout(() => {
        lucide.createIcons();
      }, 50);
    }
  });
})();
