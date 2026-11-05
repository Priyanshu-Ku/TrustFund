/**
 * TrustFund – Global Theme Manager Module
 * ========================================
 * Manages Light Mode and Dark Mode toggling, localStorage persistence,
 * accessibility attributes, browser metadata, and chart re-rendering.
 *
 * Requirements:
 * - Theme values: 'light' | 'dark'
 * - Default: 'light' for first-time visitors
 * - Instant synchronization across SPA navigation
 * - Theme-color meta tag updates
 */

const STORAGE_KEY = 'theme';
const BACKWARD_COMPAT_KEY = 'trustfund-theme';

// Registered callbacks invoked when theme changes
const themeChangeListeners = [];

/**
 * Register a listener to be notified when the theme changes
 * @param {Function} callback
 */
export function onThemeChange(callback) {
  if (typeof callback === 'function') {
    themeChangeListeners.push(callback);
  }
}

/**
 * Returns current active theme: 'light' | 'dark'
 */
export function getCurrentTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Applies a theme ('light' or 'dark') and updates all UI attributes
 * @param {'light'|'dark'} theme
 */
export function setTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', normalizedTheme);

    // Update browser theme-color meta tag
    const metaThemeColor = document.getElementById('metaThemeColor');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', normalizedTheme === 'dark' ? '#07110E' : '#ffffff');
    }

    // Update toggle button accessibility labels and title
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      const isDark = normalizedTheme === 'dark';
      const label = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      toggleBtn.setAttribute('title', label);
      toggleBtn.setAttribute('aria-label', label);
    }
  }

  // Persist selection to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, normalizedTheme);
    localStorage.setItem(BACKWARD_COMPAT_KEY, normalizedTheme);
  } catch (err) {
    console.warn('Could not persist theme in localStorage:', err);
  }

  // Notify all listeners
  themeChangeListeners.forEach((fn) => {
    try {
      fn(normalizedTheme);
    } catch (e) {
      console.error('Error in theme change listener:', e);
    }
  });
}

/**
 * Toggles between light and dark modes
 * @returns {'light'|'dark'} The newly active theme
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/**
 * Initialises the theme toggle button and applies the stored theme
 */
export function initTheme() {
  // Read saved theme, defaulting to 'light'
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(BACKWARD_COMPAT_KEY) || 'light';
  } catch (e) {
    savedTheme = 'light';
  }

  // Apply initial theme
  setTheme(savedTheme);

  // Bind click event to toggle button
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  console.log(`🎨 TrustFund Global Theme initialised: [${savedTheme.toUpperCase()}]`);
}

