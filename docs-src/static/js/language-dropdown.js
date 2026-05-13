/**
 * Language Dropdown Toggle
 * Handles the opening/closing of the language selection dropdown.
 */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const dropdownButton = document.getElementById('languageDropdownButton');
    const dropdownMenu = document.getElementById('languageDropdownMenu');
    const dropdownChevron = document.getElementById('dropdownChevron');

    if (!dropdownButton || !dropdownMenu) return;

    dropdownButton.setAttribute('aria-controls', 'languageDropdownMenu');

    function getCurrentLanguage() {
      const langAttr = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      if (langAttr) return langAttr.split('-')[0];

      const match = window.location.pathname.match(/^\/(en|fr|es|de|it)(\/|$)/i);
      return match ? match[1].toLowerCase() : '';
    }

    function getMenuItems() {
      return Array.from(dropdownMenu.querySelectorAll('[role="menuitem"]'));
    }

    function syncLanguageMenuA11y() {
      const currentLanguage = getCurrentLanguage();

      getMenuItems().forEach((item) => {
        item.removeAttribute('aria-current');

        const itemLanguage = (item.getAttribute('hreflang') || '').toLowerCase().split('-')[0] || '';
        const href = (item.getAttribute('href') || '').toLowerCase();
        const isCurrent =
          Boolean(currentLanguage) &&
          ((itemLanguage && itemLanguage === currentLanguage) ||
            (!itemLanguage && new RegExp(`(^|/)${currentLanguage}(/|$)`).test(href)));

        if (isCurrent) item.setAttribute('aria-current', 'page');

        item.querySelectorAll('[data-lucide="check"]').forEach((checkIcon) => {
          checkIcon.setAttribute('aria-hidden', 'true');
          checkIcon.setAttribute('focusable', 'false');
        });
      });
    }

    function focusMenuItem(index) {
      const items = getMenuItems();
      if (!items.length) return;
      const nextIndex = ((index % items.length) + items.length) % items.length;
      items[nextIndex].focus();
    }

    function openDropdown() {
      dropdownMenu.classList.remove('hidden');
      dropdownButton.setAttribute('aria-expanded', 'true');
      if (dropdownChevron) {
        dropdownChevron.style.transform = 'rotate(180deg)';
      }
    }

    function closeDropdown() {
      dropdownMenu.classList.add('hidden');
      dropdownButton.setAttribute('aria-expanded', 'false');
      if (dropdownChevron) {
        dropdownChevron.style.transform = 'rotate(0deg)';
      }
    }

    dropdownButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isExpanded = dropdownButton.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        closeDropdown();
      } else {
        syncLanguageMenuA11y();
        openDropdown();
      }
    });

    dropdownButton.addEventListener('keydown', (event) => {
      const isExpanded = dropdownButton.getAttribute('aria-expanded') === 'true';

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!isExpanded) {
          syncLanguageMenuA11y();
          openDropdown();
        }
        focusMenuItem(0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!isExpanded) {
          syncLanguageMenuA11y();
          openDropdown();
        }
        focusMenuItem(-1);
      }
    });

    dropdownMenu.addEventListener('keydown', (event) => {
      const items = getMenuItems();
      if (!items.length) return;

      const activeIndex = items.indexOf(document.activeElement);

      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeDropdown();
        dropdownButton.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusMenuItem(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusMenuItem(activeIndex - 1);
      }
    });

    document.addEventListener('click', (event) => {
      if (!dropdownButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
        closeDropdown();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (
        (event.key === 'Escape' || event.key === 'Esc') &&
        dropdownButton.getAttribute('aria-expanded') === 'true'
      ) {
        closeDropdown();
        dropdownButton.focus();
      }
    });
  });
})();
