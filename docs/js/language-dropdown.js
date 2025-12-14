/**
 * Language Dropdown Toggle
 * Handles the opening/closing of the language selection dropdown
 */
(() => {
  document.addEventListener('DOMContentLoaded', function() {
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
