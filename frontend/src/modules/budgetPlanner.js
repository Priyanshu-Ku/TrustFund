/**
 * TrustFund – AI Campaign Budget Planning Assistant Module
 * =========================================================
 * Empowers NGO Administrators to formulate an AI-assisted, mathematically
 * verified campaign budget distribution based on strategic priorities and
 * verified smart contract state on Ethereum Sepolia.
 */

import { getSummary } from '../services/blockchain.js';
import { showToast } from './toastHelper.js';
import { animatePanelEntrance } from '../services/animationService.js';
import { formatPrecisionEth } from './reportGenerator.js';

const BACKEND_BUDGET_URL = 'http://127.0.0.1:5000/api/ai/plan-budget';

// Standard supported categories matching on-chain governance
const SUPPORTED_CATEGORIES = [
  'Education',
  'Healthcare',
  'Food',
  'Infrastructure',
  'Transportation',
  'Others'
];

// Color palette for visual distribution bar and legends
const CATEGORY_COLORS = {
  Education: '#059669',     // emerald
  Infrastructure: '#2563eb',// blue
  Food: '#d97706',          // amber
  Transportation: '#7c3aed',// purple
  Healthcare: '#dc2626',    // red/rose
  Others: '#64748b'         // slate
};

let isPlanning = false;
let currentSummary = null;

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns a styled priority badge.
 */
function getPriorityBadge(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'high') {
    return '<span class="badge badge-danger-soft px-2 py-1">High Priority</span>';
  } else if (p === 'medium') {
    return '<span class="badge badge-blue-soft px-2 py-1">Medium Priority</span>';
  }
  return '<span class="badge badge-amber-soft px-2 py-1">Low Priority</span>';
}

/**
 * Updates the on-chain metrics banner inside the Budget Planner section.
 */
export async function updateBudgetPlannerMetrics() {
  try {
    const summary = await getSummary();
    currentSummary = summary;

    const donationsEl = document.getElementById('bp-context-donations');
    const expensesEl = document.getElementById('bp-context-expenses');
    const contractBalEl = document.getElementById('bp-context-contract-balance');
    const availBalEl = document.getElementById('bp-context-available-balance');

    if (donationsEl) donationsEl.textContent = `${formatPrecisionEth(summary.totalDonations)} ETH`;
    if (expensesEl) expensesEl.textContent = `${formatPrecisionEth(summary.totalExpenses)} ETH`;
    if (contractBalEl) contractBalEl.textContent = `${formatPrecisionEth(summary.contractBalance)} ETH`;
    if (availBalEl) availBalEl.textContent = `${formatPrecisionEth(summary.availableBalance)} ETH`;
  } catch (err) {
    console.warn('Unable to refresh on-chain budget planner baseline:', err);
  }
}

/**
 * Submits the budget planning request to the backend.
 */
async function handleBudgetPlanSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (isPlanning) return;

  const campaignNameInput = document.getElementById('bpCampaignName');
  const totalBudgetInput = document.getElementById('bpTotalBudget');
  const objectiveInput = document.getElementById('bpObjective');
  const beneficiariesInput = document.getElementById('bpBeneficiaries');
  const prioritiesInput = document.getElementById('bpPriorities');
  const submitBtn = document.getElementById('btnGenerateBudgetPlan');

  const campaignName = campaignNameInput?.value?.trim() || '';
  const totalBudgetEth = totalBudgetInput?.value?.trim() || '';
  const objective = objectiveInput?.value?.trim() || '';
  const beneficiaries = beneficiariesInput?.value?.trim() || '';
  const priorities = prioritiesInput?.value?.trim() || '';

  // Validation
  if (!campaignName) {
    showToast('Please enter a campaign name.', 'error');
    campaignNameInput?.focus();
    return;
  }

  if (!totalBudgetEth) {
    showToast('Total campaign budget is required.', 'error');
    totalBudgetInput?.focus();
    return;
  }

  const budgetNum = parseFloat(totalBudgetEth);
  if (isNaN(budgetNum) || budgetNum <= 0) {
    showToast('Campaign budget must be a positive number greater than 0 ETH.', 'error');
    totalBudgetInput?.focus();
    return;
  }

  if (!objective) {
    showToast('Campaign objective is required.', 'error');
    objectiveInput?.focus();
    return;
  }

  if (!beneficiaries) {
    showToast('Please specify expected beneficiaries.', 'error');
    beneficiariesInput?.focus();
    return;
  }

  if (!priorities) {
    showToast('Please specify campaign spending priorities.', 'error');
    prioritiesInput?.focus();
    return;
  }

  // Refresh summary if not cached
  if (!currentSummary) {
    try {
      currentSummary = await getSummary();
    } catch (_) {
      // Continue even if local node is offline
    }
  }

  const payload = {
    campaign_name: campaignName,
    total_budget_eth: totalBudgetEth,
    objective: objective,
    beneficiaries: beneficiaries,
    priorities: priorities,
    supported_categories: SUPPORTED_CATEGORIES,
    current_blockchain_summary: {
      campaignTarget: '10.0 ETH',
      totalDonations: currentSummary?.totalDonations || '0 ETH',
      totalExpenses: currentSummary?.totalExpenses || '0 ETH',
      pendingExpenses: currentSummary?.pendingExpenses || '0 ETH',
      contractBalance: currentSummary?.contractBalance || '0 ETH',
      availableBalance: currentSummary?.availableBalance || '0 ETH'
    }
  };

  // UI state: loading
  isPlanning = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Synthesizing Plan...</span>
    `;
  }

  const emptyState = document.getElementById('bpEmptyState');
  const loadingState = document.getElementById('bpLoadingState');
  const planPanel = document.getElementById('bpPlanPanel');

  if (emptyState) emptyState.classList.add('d-none');
  if (planPanel) planPanel.classList.add('d-none');
  if (loadingState) {
    loadingState.classList.remove('d-none');
    loadingState.classList.add('d-flex');
  }

  try {
    const res = await fetch(BACKEND_BUDGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      throw new Error(data.message || 'Failed to generate budget plan.');
    }

    renderBudgetPlan(data.data);
    showToast('AI Campaign Budget Plan formulated successfully.', 'success');
  } catch (err) {
    console.error('Budget planning error:', err);
    showToast(`Budget Planning Error: ${err.message || 'Unable to reach backend service.'}`, 'error', 6000);
    if (emptyState) emptyState.classList.remove('d-none');
    if (planPanel) planPanel.classList.add('d-none');
  } finally {
    isPlanning = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="me-2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>Generate AI Budget Plan</span>
      `;
    }
    if (loadingState) {
      loadingState.classList.remove('d-flex');
      loadingState.classList.add('d-none');
    }
  }
}

/**
 * Renders the returned budget plan into the DOM.
 */
function renderBudgetPlan(plan) {
  const planPanel = document.getElementById('bpPlanPanel');
  const emptyState = document.getElementById('bpEmptyState');
  if (emptyState) emptyState.classList.add('d-none');
  if (!planPanel) return;

  // Header info
  const titleEl = document.getElementById('bpResultCampaignTitle');
  const budgetBadgeEl = document.getElementById('bpResultBudgetBadge');
  const genAtEl = document.getElementById('bpResultGeneratedAt');
  const summaryEl = document.getElementById('bpResultSummary');
  const totalAllocDisplay = document.getElementById('bpTotalAllocatedDisplay');

  if (titleEl) titleEl.textContent = plan.campaign_name || 'Education for All';
  if (budgetBadgeEl) budgetBadgeEl.textContent = `${plan.total_budget_eth} ETH Budget`;
  if (genAtEl) genAtEl.textContent = `Generated: ${plan.generated_at || 'Just now'}`;
  if (summaryEl) summaryEl.textContent = plan.summary || '';
  if (totalAllocDisplay) totalAllocDisplay.textContent = `Total: ${plan.total_budget_eth} ETH (100%)`;

  // Visual Multi-segment Progress Bar and Legend
  const progressBar = document.getElementById('bpProgressBar');
  const chartLegend = document.getElementById('bpChartLegend');
  if (progressBar) progressBar.innerHTML = '';
  if (chartLegend) chartLegend.innerHTML = '';

  const allocations = plan.allocations || [];

  allocations.forEach((alloc) => {
    const color = CATEGORY_COLORS[alloc.category] || '#64748b';
    const pct = alloc.percentage;

    // Bar segment
    if (progressBar) {
      const segment = document.createElement('div');
      segment.className = 'progress-bar';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${alloc.category}: ${pct}% (${alloc.amount_eth} ETH)`;
      progressBar.appendChild(segment);
    }

    // Legend badge
    if (chartLegend) {
      const item = document.createElement('div');
      item.className = 'd-flex align-items-center me-2 mb-1';
      item.innerHTML = `
        <span class="rounded-circle me-1" style="width: 8px; height: 8px; background-color: ${color}; display: inline-block;"></span>
        <span class="text-navy fw-semibold">${escapeHtml(alloc.category)}:</span>
        <span class="text-muted ms-1">${pct}% (${escapeHtml(alloc.amount_eth)} ETH)</span>
      `;
      chartLegend.appendChild(item);
    }
  });

  // Category Allocation Table
  const tbody = document.getElementById('bpTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    allocations.forEach((alloc) => {
      const color = CATEGORY_COLORS[alloc.category] || '#64748b';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <span class="rounded-circle me-2 flex-shrink-0" style="width: 9px; height: 9px; background-color: ${color}; display: inline-block;"></span>
            <span class="fw-semibold text-navy">${escapeHtml(alloc.category)}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-light border text-navy fw-bold">${alloc.percentage}%</span>
        </td>
        <td>
          <strong class="text-emerald font-monospace">${escapeHtml(alloc.amount_eth)} ETH</strong>
        </td>
        <td>
          ${getPriorityBadge(alloc.priority)}
        </td>
        <td class="text-muted-custom small" style="max-width: 280px;">
          ${escapeHtml(alloc.reason)}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Recommendations List
  const recList = document.getElementById('bpRecommendationsList');
  if (recList) {
    recList.innerHTML = '';
    (plan.recommendations || []).forEach((rec) => {
      const li = document.createElement('li');
      li.className = 'mb-1';
      li.textContent = rec;
      recList.appendChild(li);
    });
  }

  // Assumptions List
  const asmList = document.getElementById('bpAssumptionsList');
  if (asmList) {
    asmList.innerHTML = '';
    (plan.assumptions || []).forEach((asm) => {
      const li = document.createElement('li');
      li.className = 'mb-1';
      li.textContent = asm;
      asmList.appendChild(li);
    });
  }

  // Warnings List
  const warnList = document.getElementById('bpWarningsList');
  if (warnList) {
    warnList.innerHTML = '';
    (plan.warnings || []).forEach((warn) => {
      const li = document.createElement('li');
      li.className = 'mb-1';
      li.textContent = warn;
      warnList.appendChild(li);
    });
  }

  // Show result panel
  planPanel.classList.remove('d-none');
  animatePanelEntrance(planPanel);
}

/**
 * Initializes the AI Campaign Budget Planner module.
 */
export function initBudgetPlanner() {
  const form = document.getElementById('budgetPlannerForm');
  const btnGenerateAgain = document.getElementById('bpBtnGenerateAgain');
  const btnEditInputs = document.getElementById('bpBtnEditInputs');
  const btnClearPlan = document.getElementById('bpBtnClearPlan');

  if (form) {
    form.addEventListener('submit', handleBudgetPlanSubmit);
  }

  // Generate Again button
  if (btnGenerateAgain) {
    btnGenerateAgain.addEventListener('click', () => {
      handleBudgetPlanSubmit();
    });
  }

  // Edit Inputs button: scroll to form and focus budget input
  if (btnEditInputs) {
    btnEditInputs.addEventListener('click', () => {
      const formCol = document.getElementById('budgetPlannerFormCol');
      const budgetInput = document.getElementById('bpTotalBudget');
      if (formCol) {
        formCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (budgetInput) {
        budgetInput.focus();
        budgetInput.select();
      }
    });
  }

  // Clear Plan button: reset results and show empty state
  if (btnClearPlan) {
    btnClearPlan.addEventListener('click', () => {
      const planPanel = document.getElementById('bpPlanPanel');
      const emptyState = document.getElementById('bpEmptyState');
      if (planPanel) planPanel.classList.add('d-none');
      if (emptyState) emptyState.classList.remove('d-none');

      // Reset form inputs to completely empty values
      if (form) form.reset();
      const campaignNameInput = document.getElementById('bpCampaignName');
      const totalBudgetInput = document.getElementById('bpTotalBudget');
      const objectiveInput = document.getElementById('bpObjective');
      const beneficiariesInput = document.getElementById('bpBeneficiaries');
      const prioritiesInput = document.getElementById('bpPriorities');
      if (campaignNameInput) campaignNameInput.value = '';
      if (totalBudgetInput) totalBudgetInput.value = '';
      if (objectiveInput) objectiveInput.value = '';
      if (beneficiariesInput) beneficiariesInput.value = '';
      if (prioritiesInput) prioritiesInput.value = '';

      showToast('Budget plan cleared and form inputs reset.', 'info');
    });
  }

  // Load initial on-chain metrics
  updateBudgetPlannerMetrics();
}

