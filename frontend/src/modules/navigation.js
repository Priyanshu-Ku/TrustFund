/**
 * TrustFund – Navigation Module
 * ==============================
 * Handles SPA-style navigation between the four sections.
 * Sections are shown/hidden with display toggle.
 */

/**
 * Initialise navigation: attach click listeners to all [data-section] elements
 * @param {Function} onSectionChange - Callback called with the section id when navigation occurs
 */
export function initNavigation(onSectionChange) {
  // Attach click handlers to ALL elements with data-section attribute
  document.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = el.getAttribute('data-section');
      showSection(sectionId);
      if (onSectionChange) onSectionChange(sectionId);
    });
  });
}

/**
 * Show a specific section and hide all others
 * @param {string} sectionId - One of: 'home', 'donor', 'ngo', 'transparency'
 */
export function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach((section) => {
    section.style.display = 'none';
  });

  // Show the target section
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.style.display = 'block';
    // Re-trigger fade animation
    target.style.animation = 'none';
    target.offsetHeight; // Force reflow
    target.style.animation = '';
  }

  // Update active nav link
  document.querySelectorAll('#mainNav .nav-link').forEach((link) => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === sectionId) {
      link.classList.add('active');
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile nav if open
  const navCollapse = document.getElementById('navbarNav');
  if (navCollapse && navCollapse.classList.contains('show')) {
    const bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
    if (bsCollapse) bsCollapse.hide();
  }
}
