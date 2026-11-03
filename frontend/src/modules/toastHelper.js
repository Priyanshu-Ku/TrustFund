/**
 * TrustFund – Toast Helper
 * =========================
 * Shows Bootstrap toast notifications for success and error messages.
 */

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toastId = `toast-${Date.now()}`;
  const iconColor = type === 'success' ? '#10b981' : '#ef4444';
  const borderClass = type === 'success' ? 'toast-success' : 'toast-error';
  const icon = type === 'success'
    ? '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>'
    : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>';

  const toastHTML = `
    <div id="${toastId}" class="toast ${borderClass}" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000">
      <div class="toast-body d-flex align-items-center gap-2 p-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
        <span>${message}</span>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHTML);

  const toastEl = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastEl);
  bsToast.show();

  // Remove from DOM after hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}
