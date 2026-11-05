/**
 * TrustFund – Main Entry Point
 * =============================
 * Initialises the application: imports styles, Bootstrap, sets up navigation,
 * and wires up all dashboard modules.
 *
 * Phase 1: Frontend only (mock data, no blockchain/AI integration).
 */

// --- Import Styles ---
import 'bootstrap/dist/css/bootstrap.min.css';
import './css/styles.css';

// --- Import Bootstrap JS (for toast, collapse, etc.) ---
import * as bootstrap from 'bootstrap';

// --- Import Modules ---
import { initNavigation } from './modules/navigation.js';
import { updateHomePage } from './modules/home.js';
import { initDonorDashboard, updateDonorDashboard } from './modules/donorDashboard.js';
import { initNgoDashboard, updateNgoDashboard } from './modules/ngoDashboard.js';
import { initTransparencyDashboard, updateTransparencyDashboard } from './modules/transparencyDashboard.js';
import { initChatbot } from './modules/chatbot.js';
import { initReportGenerator } from './modules/reportGenerator.js';
import { initBudgetPlanner, updateBudgetPlannerMetrics } from './modules/budgetPlanner.js';
import { initTheme } from './modules/themeManager.js';

// Make Bootstrap available globally (needed by toast helper and navigation)
window.bootstrap = bootstrap;

/**
 * Refresh all dashboard sections with current data.
 * Called after every donation or expense submission.
 */
function refreshAllDashboards() {
  updateHomePage();
  updateDonorDashboard();
  updateNgoDashboard();
  updateTransparencyDashboard();
  updateBudgetPlannerMetrics();
}

/**
 * Initialise the entire application
 */
function init() {
  console.log('🛡️ TrustFund – Frontend Initialised');

  // Initialise Global Light/Dark Theme
  initTheme();

  // Set up SPA-style navigation
  initNavigation((sectionId) => {
    // Refresh the target section whenever user navigates to it
    refreshAllDashboards();
  });

  // Initialise interactive forms & controls
  initDonorDashboard(refreshAllDashboards);
  initNgoDashboard(refreshAllDashboards);
  initTransparencyDashboard();
  initChatbot();
  initReportGenerator();
  initBudgetPlanner();

  // Initial render of all dashboards with seed data
  refreshAllDashboards();
}

// --- Start the app when DOM is ready ---
document.addEventListener('DOMContentLoaded', init);
