/**
 * TrustFund – NGO Admin Dashboard Module
 * =======================================
 * Integrates the NGO Admin Dashboard with the deployed Ethereum smart contract
 * (DonationTracker.sol) on Ethereum Sepolia.
 *
 * Implements:
 * 1. Admin authentication via contract.admin() check (isAdmin())
 * 2. Real-time financial summary via getSummary()
 * 3. On-chain expense submission via submitExpense()
 * 4. Real-time expense ledger via getExpenseCount() and getExpense(i)
 * 5. Explicit, verified expense approval & rejection with ETH disbursement
 */

import { showToast } from './toastHelper.js';
import {
  getSummary,
  getExpenseCount,
  getExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  isAdmin,
  getAdminAddress,
  isAddress,
  connectWallet,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID
} from '../services/blockchain.js';
import { shortenAddress } from './donorDashboard.js';

// --- State Variables ---
let currentIsAdmin = false;        // Holds verified on-chain admin status
let isCheckingAuth = false;        // Prevents auth race conditions
let isSubmittingExpense = false;   // Prevents duplicate expense submission
let isActionPending = false;       // Prevents concurrent approve/reject txs
let onDataChangeCallback = null;   // Global dashboard refresh callback
let cachedSummary = null;          // Last fetched summary
let expenseToApprove = null;       // Currently selected expense for approval modal
let expenseIdToReject = null;      // Currently selected expense ID for rejection modal
let hasAttachedListeners = false;  // Prevents duplicate event listeners
let isCategorizingExpense = false; // Tracks in-progress AI categorization request
let lastAiRecommendation = null;   // Holds { category, rawCategory, subcategory, reason }

/**
 * Escape HTML to prevent injection from description fields
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
 * Handle and normalize blockchain errors for helpful toast feedback
 */
function handleBlockchainError(err, defaultMessage = 'Transaction failed.') {
  console.error('Blockchain action error:', err);
  const errMsg = (err?.message || '').toLowerCase();
  const errCode = err?.code;

  if (
    errCode === 4001 ||
    errCode === 'ACTION_REJECTED' ||
    errMsg.includes('user rejected') ||
    errMsg.includes('denied transaction')
  ) {
    showToast('Transaction was cancelled in MetaMask.', 'error');
  } else if (
    errMsg.includes('insufficient available donation funds') ||
    errMsg.includes('insufficient funds')
  ) {
    showToast('Insufficient available donation funds in the smart contract.', 'error', 7000);
  } else if (
    errMsg.includes('only ngo admin') ||
    errMsg.includes('only admin')
  ) {
    showToast('Unauthorized: Only the registered NGO administrator can perform this action.', 'error', 7000);
  } else if (
    errMsg.includes('network') ||
    errMsg.includes('chainid') ||
    errMsg.includes('switch metamask')
  ) {
    showToast('Please switch MetaMask to the Ethereum Sepolia network.', 'error');
  } else if (errMsg.includes('metamask is not installed')) {
    showToast('MetaMask is not installed. Please install MetaMask to continue.', 'error', 7000);
  } else {
    const reason = err?.reason || err?.shortMessage || err?.message || defaultMessage;
    showToast(`Failed: ${reason}`, 'error', 7000);
  }
}

/**
 * Verify administrator permissions against the smart contract.
 * Updates UI alerts, admin badge, and enables/disables controls.
 */
export async function checkAdminAuthentication() {
  if (isCheckingAuth) return currentIsAdmin;
  isCheckingAuth = true;

  const adminBadge = document.getElementById('ngo-admin-badge');
  const adminStatusText = document.getElementById('ngo-admin-status-text');
  const connectBtn = document.getElementById('ngo-connect-wallet-btn');
  const notConnectedAlert = document.getElementById('ngo-not-connected-alert');
  const unauthorizedAlert = document.getElementById('ngo-unauthorized-alert');
  const connectedAddrDisplay = document.getElementById('ngo-connected-address-display');
  const submitBtn = document.getElementById('submitExpenseBtn');

  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      if (adminStatusText) adminStatusText.textContent = 'MetaMask Not Detected';
      if (adminBadge) adminBadge.className = 'badge badge-danger-soft px-3 py-2';
      if (notConnectedAlert) notConnectedAlert.classList.remove('d-none');
      if (unauthorizedAlert) unauthorizedAlert.classList.add('d-none');
      if (connectBtn) connectBtn.classList.remove('d-none');
      if (submitBtn) submitBtn.disabled = true;
      currentIsAdmin = false;
      return false;
    }

    // Check if an account is already authorized in MetaMask without prompting popup
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      // Wallet not connected
      currentIsAdmin = false;
      if (adminStatusText) adminStatusText.textContent = 'Admin Wallet Not Connected';
      if (adminBadge) adminBadge.className = 'badge badge-amber-soft px-3 py-2';
      if (notConnectedAlert) notConnectedAlert.classList.remove('d-none');
      if (unauthorizedAlert) unauthorizedAlert.classList.add('d-none');
      if (connectBtn) connectBtn.classList.remove('d-none');
      if (submitBtn) submitBtn.disabled = true;
      return false;
    }

    const currentAccount = accounts[0];

    // Verify on-chain administrator permissions
    const adminPermitted = await isAdmin();
    currentIsAdmin = adminPermitted;

    if (adminPermitted) {
      // Wallet connected AND verified as smart contract administrator
      if (adminStatusText) {
        adminStatusText.textContent = `Authorized Admin: ${shortenAddress(currentAccount)}`;
      }
      if (adminBadge) adminBadge.className = 'badge badge-emerald-soft px-3 py-2';
      if (notConnectedAlert) notConnectedAlert.classList.add('d-none');
      if (unauthorizedAlert) unauthorizedAlert.classList.add('d-none');
      if (connectBtn) connectBtn.classList.add('d-none');
      if (submitBtn) submitBtn.disabled = false;
    } else {
      // Wallet connected, but NOT the contract admin
      if (adminStatusText) adminStatusText.textContent = 'Unauthorized Account';
      if (adminBadge) adminBadge.className = 'badge badge-danger-soft px-3 py-2';
      if (notConnectedAlert) notConnectedAlert.classList.add('d-none');
      if (unauthorizedAlert) {
        unauthorizedAlert.classList.remove('d-none');
        if (connectedAddrDisplay) connectedAddrDisplay.textContent = currentAccount;
      }
      if (connectBtn) connectBtn.classList.remove('d-none');
      if (submitBtn) submitBtn.disabled = true;
    }

    return currentIsAdmin;
  } catch (err) {
    console.warn('Error verifying admin authorization:', err);
    currentIsAdmin = false;
    if (adminStatusText) adminStatusText.textContent = 'Authorization Check Failed';
    if (adminBadge) adminBadge.className = 'badge badge-danger-soft px-3 py-2';
    if (submitBtn) submitBtn.disabled = true;
    return false;
  } finally {
    isCheckingAuth = false;
  }
}

/**
 * Handle connecting wallet from the NGO dashboard
 */
async function handleConnectAdminWallet() {
  try {
    showToast('Connecting administrator MetaMask account...', 'info');
    await connectWallet();
    await checkAdminAuthentication();
    await loadNgoData();
    if (currentIsAdmin) {
      showToast('Administrator wallet authenticated on Sepolia.', 'success');
    } else {
      showToast('Connected account is not the registered NGO administrator.', 'error', 7000);
    }
  } catch (err) {
    handleBlockchainError(err, 'Failed to connect admin wallet.');
  }
}

/**
 * Handle request to switch account in MetaMask
 */
async function handleSwitchAccount() {
  if (typeof window === 'undefined' || !window.ethereum) return;
  try {
    await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }]
    });
    await checkAdminAuthentication();
    await loadNgoData();
  } catch (err) {
    console.warn('Switch account cancelled or failed:', err);
  }
}

/**
 * Load and render real on-chain financial summary and expense records from the smart contract
 */
export async function loadNgoData() {
  try {
    if (typeof window === 'undefined' || !window.ethereum) return;

    // 1. Verify administrator status
    const adminStatus = await checkAdminAuthentication();

    // 2. Fetch financial summary directly from smart contract
    const summary = await getSummary();
    cachedSummary = summary;

    const totalDonations = parseFloat(summary.totalDonations);
    const totalExpenses = parseFloat(summary.totalExpenses);
    const pendingExpenses = parseFloat(summary.pendingExpenses);
    const contractBalance = parseFloat(summary.contractBalance);
    const availableBalance = parseFloat(summary.availableBalance);

    // Update 5 Financial Summary Stat Cards
    const donEl = document.getElementById('ngo-total-donations');
    if (donEl) donEl.textContent = `${totalDonations.toFixed(4)} ETH`;

    const expEl = document.getElementById('ngo-total-expenses');
    if (expEl) expEl.textContent = `${totalExpenses.toFixed(4)} ETH`;

    const pendEl = document.getElementById('ngo-pending-expenses');
    if (pendEl) pendEl.textContent = `${pendingExpenses.toFixed(4)} ETH`;

    const balEl = document.getElementById('ngo-contract-balance');
    if (balEl) balEl.textContent = `${contractBalance.toFixed(4)} ETH`;

    const availEl = document.getElementById('ngo-available-balance');
    if (availEl) availEl.textContent = `${availableBalance.toFixed(4)} ETH`;

    const remEl = document.getElementById('ngo-remaining-balance');
    if (remEl) remEl.textContent = `${availableBalance.toFixed(4)} ETH`;

    // 3. Fetch expense count and records
    const count = await getExpenseCount();

    const historyCountEl = document.getElementById('ngo-history-count');
    if (historyCountEl) {
      historyCountEl.textContent = `${count} on-chain records`;
    }

    const tbody = document.getElementById('expenseHistoryBody');
    const emptyState = document.getElementById('ngoEmptyState');

    if (count === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
    } else {
      if (emptyState) emptyState.classList.add('d-none');

      // Fetch each expense record from smart contract
      const expensePromises = [];
      for (let i = 0; i < count; i++) {
        expensePromises.push(getExpense(i));
      }

      const expenses = await Promise.all(expensePromises);

      if (tbody) {
        // Display in reverse chronological order (newest first)
        tbody.innerHTML = expenses
          .map((e, originalIndex) => ({ ...e, id: originalIndex }))
          .reverse()
          .map((e) => {
            const dateStr = e.submittedAt
              ? new Date(e.submittedAt * 1000).toLocaleDateString()
              : 'Recent';
            const shortRecipient = shortenAddress(e.recipient);
            const recipientUrl = `https://sepolia.etherscan.io/address/${e.recipient}`;

            // Status badge mapping: 0 = Pending, 1 = Approved, 2 = Rejected
            let statusBadge = '';
            let actionHtml = '';

            if (e.status === 0) {
              statusBadge = '<span class="badge badge-amber-soft">Pending</span>';
              if (adminStatus) {
                actionHtml = `
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-emerald btn-sm py-1 px-2 btn-approve-expense"
                      data-id="${e.id}"
                      data-amount="${e.amount}"
                      data-category="${escapeHtml(e.category)}"
                      data-recipient="${e.recipient}"
                      data-description="${escapeHtml(e.description)}">
                      Approve
                    </button>
                    <button class="btn btn-outline-danger btn-sm py-1 px-2 ms-1 btn-reject-expense"
                      data-id="${e.id}">
                      Reject
                    </button>
                  </div>
                `;
              } else {
                actionHtml = '<span class="badge badge-blue-soft text-muted">Admin Only</span>';
              }
            } else if (e.status === 1) {
              statusBadge = '<span class="badge badge-emerald-soft">Approved</span>';
              actionHtml = '<span class="text-emerald small fw-semibold">✓ Paid</span>';
            } else {
              statusBadge = '<span class="badge badge-danger-soft">Rejected</span>';
              actionHtml = '<span class="text-muted small">✗ Rejected</span>';
            }

            return `
              <tr>
                <td><strong class="text-navy">#${e.id}</strong></td>
                <td><small class="text-muted-custom">${dateStr}</small></td>
                <td>
                  <span class="badge badge-blue-soft" title="${escapeHtml(e.description)}">
                    ${escapeHtml(e.category)}
                  </span>
                </td>
                <td><strong class="text-navy">${parseFloat(e.amount).toFixed(4)} ETH</strong></td>
                <td>
                  <a href="${recipientUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash font-monospace text-navy text-decoration-none" title="View Recipient: ${e.recipient}">
                    ${shortRecipient} ↗
                  </a>
                </td>
                <td>${statusBadge}</td>
                <td>${actionHtml}</td>
              </tr>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.warn('Could not load NGO blockchain data:', err);
  }
}

/**
 * Handle new expense submission
 */
async function handleExpenseSubmit(e) {
  e.preventDefault();

  if (isSubmittingExpense) return;

  const form = document.getElementById('expenseForm');
  const categorySelect = document.getElementById('expenseCategory');
  const amountInput = document.getElementById('expenseAmount');
  const recipientInput = document.getElementById('expenseRecipient');
  const descriptionInput = document.getElementById('expenseDescription');
  const submitBtn = document.getElementById('submitExpenseBtn');

  // 1. Check admin authorization
  const authorized = await checkAdminAuthentication();
  if (!authorized) {
    showToast('Unauthorized: Only the contract administrator can submit expenses.', 'error');
    return;
  }

  // 2. Validate form inputs
  const category = categorySelect ? categorySelect.value : '';
  const amountVal = amountInput ? amountInput.value.trim() : '';
  const amount = parseFloat(amountVal);
  const recipient = recipientInput ? recipientInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!category) {
    showToast('Please select an expense category.', 'error');
    if (categorySelect) categorySelect.focus();
    return;
  }

  if (!amountVal || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid expense amount greater than 0 ETH.', 'error');
    if (amountInput) amountInput.focus();
    return;
  }

  if (!recipient || !isAddress(recipient) || recipient.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    showToast('Please enter a valid Ethereum recipient address (0x...).', 'error');
    if (recipientInput) recipientInput.focus();
    return;
  }

  if (!description) {
    showToast('Please provide an expense description.', 'error');
    if (descriptionInput) descriptionInput.focus();
    return;
  }

  if (category.length > 40) {
    showToast('Expense category is too long (maximum 40 characters).', 'error');
    return;
  }

  if (description.length > 200) {
    showToast('Expense description is too long (maximum 200 characters).', 'error');
    return;
  }

  // 3. Verify available balance
  if (cachedSummary && amount > parseFloat(cachedSummary.availableBalance)) {
    showToast(
      `Expense (${amount} ETH) exceeds available balance (${parseFloat(cachedSummary.availableBalance).toFixed(4)} ETH).`,
      'error',
      7000
    );
    return;
  }

  // 4. Begin submission with loading indicator
  isSubmittingExpense = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Submitting to Sepolia...</span>
    `;
  }

  try {
    showToast(`Submitting expense for "${category}" (${amount} ETH) to blockchain...`, 'info', 5000);

    // Call submitExpense() from blockchain service
    const receipt = await submitExpense(amount, category, description, recipient);

    console.log('Expense submission confirmed on Sepolia:', receipt);

    showToast(
      `🎉 Expense of ${amount} ETH for "${category}" recorded on Sepolia (Pending Approval)!`,
      'success',
      8000
    );

    // Reset form
    if (form) {
      form.reset();
      form.classList.remove('was-validated');
    }

    // Refresh data and trigger global callbacks
    await loadNgoData();
    if (onDataChangeCallback) {
      onDataChangeCallback();
    }
  } catch (err) {
    handleBlockchainError(err, 'Failed to submit expense.');
  } finally {
    isSubmittingExpense = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="me-2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <span>Submit Expense to Blockchain</span>
      `;
    }
  }
}

/**
 * Match an AI recommended category to one of the options in the expenseCategory select
 */
function findMatchingCategory(aiCategory) {
  if (!aiCategory || typeof aiCategory !== 'string') return null;
  const select = document.getElementById('expenseCategory');
  if (!select) return null;

  const options = Array.from(select.options)
    .map((o) => o.value)
    .filter(Boolean);

  const cleaned = aiCategory.trim().toLowerCase();

  // 1. Exact case-insensitive match
  const exact = options.find((o) => o.toLowerCase() === cleaned);
  if (exact) return exact;

  // 2. Starts-with or includes match (e.g. "Education" matches "Education Supplies", or "Food" matches "Food & Nutrition")
  const prefix = options.find(
    (o) =>
      o.toLowerCase().startsWith(cleaned) ||
      cleaned.startsWith(o.toLowerCase()) ||
      o.toLowerCase().includes(cleaned)
  );
  if (prefix) return prefix;

  return null;
}

/**
 * Request AI expense category recommendation from Gemini via Flask backend
 */
async function handleAiSuggestCategory() {
  if (isCategorizingExpense) return;

  const descEl = document.getElementById('expenseDescription');
  const suggestBtn = document.getElementById('btnAiSuggestCategory');
  const panelEl = document.getElementById('aiCategorySuggestionPanel');
  const nameEl = document.getElementById('aiSuggestedCategoryName');
  const subcatEl = document.getElementById('aiSuggestedSubcategory');
  const reasonEl = document.getElementById('aiSuggestedReason');

  const description = descEl ? descEl.value.trim() : '';

  // 1. Validation: Description cannot be empty
  if (!description) {
    showToast('Please enter an expense description first before requesting AI suggestions.', 'error');
    if (descEl) descEl.focus();
    return;
  }

  // 2. Set loading state & prevent duplicate requests
  isCategorizingExpense = true;
  if (suggestBtn) {
    suggestBtn.disabled = true;
    suggestBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
      <span>Analyzing with AI...</span>
    `;
  }

  try {
    showToast('Consulting Gemini AI model for expense categorization...', 'info', 3000);

    // Call Flask backend endpoint
    const response = await fetch('http://127.0.0.1:5000/api/ai/categorize-expense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result || result.status !== 'success') {
      const errMsg = result?.message || `AI service responded with HTTP status ${response.status}.`;
      throw new Error(errMsg);
    }

    const data = result.data;
    if (!data || !data.category || !data.subcategory) {
      throw new Error('AI returned an incomplete response structure.');
    }

    // Verify category is supported by the existing expense form
    const matchedCategory = findMatchingCategory(data.category);
    if (!matchedCategory) {
      throw new Error(`AI suggested category "${data.category}", which is not supported by the expense form.`);
    }

    // Store recommendation in memory
    lastAiRecommendation = {
      category: matchedCategory,
      rawCategory: data.category,
      subcategory: data.subcategory,
      reason: data.reason || 'Categorized based on expense description context.'
    };

    // Render recommendation panel
    if (nameEl) nameEl.textContent = matchedCategory;
    if (subcatEl) subcatEl.textContent = data.subcategory;
    if (reasonEl) reasonEl.textContent = lastAiRecommendation.reason;
    if (panelEl) panelEl.classList.remove('d-none');

    showToast(
      `AI Recommendation: "${matchedCategory}" (${data.subcategory})`,
      'success'
    );
  } catch (err) {
    console.error('AI categorization error:', err);
    const errMsg = err?.message || '';

    if (
      err.name === 'TypeError' ||
      errMsg.includes('fetch') ||
      errMsg.includes('Failed to fetch') ||
      errMsg.includes('NetworkError')
    ) {
      showToast(
        'Unable to reach AI backend at http://127.0.0.1:5000. Please verify the Flask server is running.',
        'error',
        7000
      );
    } else {
      showToast(`AI Categorization Failed: ${errMsg}`, 'error', 6000);
    }
  } finally {
    isCategorizingExpense = false;
    if (suggestBtn) {
      suggestBtn.disabled = false;
      suggestBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1 text-emerald">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>Suggest Category with AI</span>
      `;
    }
  }
}

/**
 * Populate the category dropdown with the AI recommended category
 */
function handleApplyAiCategory() {
  if (!lastAiRecommendation || !lastAiRecommendation.category) return;

  const selectEl = document.getElementById('expenseCategory');
  if (selectEl) {
    selectEl.value = lastAiRecommendation.category;
    // Dispatch change event to update any listeners
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Flash visual feedback on select box
    selectEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
    selectEl.style.borderColor = 'var(--tf-emerald)';
    selectEl.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.25)';
    setTimeout(() => {
      selectEl.style.borderColor = '';
      selectEl.style.boxShadow = '';
    }, 1200);

    showToast(
      `Selected "${lastAiRecommendation.category}" (Subcategory: ${lastAiRecommendation.subcategory}). You may edit this anytime before submitting.`,
      'info',
      5000
    );
  }
}

/**
 * Dismiss the AI category suggestion panel
 */
function handleCloseAiSuggestion() {
  const panelEl = document.getElementById('aiCategorySuggestionPanel');
  if (panelEl) {
    panelEl.classList.add('d-none');
  }
}

/**
 * Open confirmation modal before approving an expense
 */
function openApproveModal(expenseData) {
  expenseToApprove = expenseData;

  const modalEl = document.getElementById('approveExpenseModal');
  const idEl = document.getElementById('modalExpenseId');
  const amountEl = document.getElementById('modalExpenseAmount');
  const catEl = document.getElementById('modalExpenseCategory');
  const recEl = document.getElementById('modalExpenseRecipient');
  const descEl = document.getElementById('modalExpenseDescription');

  if (idEl) idEl.textContent = `#${expenseData.id}`;
  if (amountEl) amountEl.textContent = `${expenseData.amount} ETH`;
  if (catEl) catEl.textContent = expenseData.category;
  if (recEl) recEl.textContent = expenseData.recipient;
  if (descEl) descEl.textContent = expenseData.description || 'No description provided';

  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Execute actual on-chain expense approval and ETH disbursement
 */
async function confirmApproveExpense() {
  if (!expenseToApprove || isActionPending) return;

  const confirmBtn = document.getElementById('confirmApproveExpenseBtn');
  const modalEl = document.getElementById('approveExpenseModal');

  isActionPending = true;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Transferring ETH on Sepolia...</span>
    `;
  }

  try {
    showToast(`Approving Expense #${expenseToApprove.id}... MetaMask will confirm transfer of ${expenseToApprove.amount} ETH.`, 'info', 6000);

    const receipt = await approveExpense(expenseToApprove.id);
    console.log('Expense approval confirmed:', receipt);

    // Close modal
    if (modalEl && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    showToast(
      `🎉 Expense #${expenseToApprove.id} approved! ${expenseToApprove.amount} ETH transferred to recipient on Sepolia.`,
      'success',
      10000
    );

    expenseToApprove = null;

    // Refresh all dashboards
    await loadNgoData();
    if (onDataChangeCallback) {
      onDataChangeCallback();
    }
  } catch (err) {
    handleBlockchainError(err, 'Failed to approve expense.');
  } finally {
    isActionPending = false;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>Approve &amp; Transfer ETH</span>';
    }
  }
}

/**
 * Open confirmation modal before rejecting an expense
 */
function openRejectModal(expenseId) {
  expenseIdToReject = expenseId;

  const modalEl = document.getElementById('rejectExpenseModal');
  const idEl = document.getElementById('modalRejectExpenseId');

  if (idEl) idEl.textContent = `#${expenseId}`;

  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Execute on-chain expense rejection and pending fund release
 */
async function confirmRejectExpense() {
  if (expenseIdToReject === null || isActionPending) return;

  const confirmBtn = document.getElementById('confirmRejectExpenseBtn');
  const modalEl = document.getElementById('rejectExpenseModal');

  isActionPending = true;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Rejecting on Sepolia...</span>
    `;
  }

  try {
    showToast(`Rejecting Expense #${expenseIdToReject} on Sepolia...`, 'info', 5000);

    const receipt = await rejectExpense(expenseIdToReject);
    console.log('Expense rejection confirmed:', receipt);

    // Close modal
    if (modalEl && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    showToast(
      `Expense #${expenseIdToReject} has been rejected. Pending funds returned to available balance.`,
      'success',
      8000
    );

    const rejectedId = expenseIdToReject;
    expenseIdToReject = null;

    // Refresh all dashboards
    await loadNgoData();
    if (onDataChangeCallback) {
      onDataChangeCallback();
    }
  } catch (err) {
    handleBlockchainError(err, 'Failed to reject expense.');
  } finally {
    isActionPending = false;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Reject Expense';
    }
  }
}

/**
 * Setup listeners for MetaMask events:
 * - accountsChanged: re-check admin permissions and update view
 * - chainChanged: re-check network
 */
function setupMetaMaskListeners() {
  if (hasAttachedListeners || typeof window === 'undefined' || !window.ethereum) {
    return;
  }

  window.ethereum.on('accountsChanged', async () => {
    await checkAdminAuthentication();
    await loadNgoData();
  });

  window.ethereum.on('chainChanged', async () => {
    await checkAdminAuthentication();
    await loadNgoData();
  });

  hasAttachedListeners = true;
}

/**
 * Initialise the NGO dashboard:
 * - Wire form submission
 * - Wire modal confirm buttons
 * - Wire approve/reject table delegation
 * - Wire connect & switch wallet buttons
 * @param {Function} onDataChange - Callback to refresh all dashboards after changes
 */
export function initNgoDashboard(onDataChange) {
  onDataChangeCallback = onDataChange;

  // 1. Expense form submission
  const form = document.getElementById('expenseForm');
  if (form) {
    form.addEventListener('submit', handleExpenseSubmit);
  }

  // 2. Connect Wallet buttons
  const connectBtn = document.getElementById('ngo-connect-wallet-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', handleConnectAdminWallet);
  }

  const promptConnectBtn = document.getElementById('ngo-prompt-connect-btn');
  if (promptConnectBtn) {
    promptConnectBtn.addEventListener('click', handleConnectAdminWallet);
  }

  // 3. Switch Account button
  const switchBtn = document.getElementById('ngo-switch-account-btn');
  if (switchBtn) {
    switchBtn.addEventListener('click', handleSwitchAccount);
  }

  // 4. Modal confirmation buttons
  const approveConfirmBtn = document.getElementById('confirmApproveExpenseBtn');
  if (approveConfirmBtn) {
    approveConfirmBtn.addEventListener('click', confirmApproveExpense);
  }

  const rejectConfirmBtn = document.getElementById('confirmRejectExpenseBtn');
  if (rejectConfirmBtn) {
    rejectConfirmBtn.addEventListener('click', confirmRejectExpense);
  }

  // 5. Table event delegation for Approve and Reject buttons
  const tbody = document.getElementById('expenseHistoryBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const approveBtn = e.target.closest('.btn-approve-expense');
      if (approveBtn) {
        const id = parseInt(approveBtn.getAttribute('data-id'), 10);
        const amount = approveBtn.getAttribute('data-amount');
        const category = approveBtn.getAttribute('data-category');
        const recipient = approveBtn.getAttribute('data-recipient');
        const description = approveBtn.getAttribute('data-description');
        openApproveModal({ id, amount, category, recipient, description });
        return;
      }

      const rejectBtn = e.target.closest('.btn-reject-expense');
      if (rejectBtn) {
        const id = parseInt(rejectBtn.getAttribute('data-id'), 10);
        openRejectModal(id);
        return;
      }
    });
  }

  // 6. AI Category Suggestion button & panel handlers
  const aiSuggestBtn = document.getElementById('btnAiSuggestCategory');
  if (aiSuggestBtn) {
    aiSuggestBtn.addEventListener('click', handleAiSuggestCategory);
  }

  const applyAiBtn = document.getElementById('btnApplyAiCategory');
  if (applyAiBtn) {
    applyAiBtn.addEventListener('click', handleApplyAiCategory);
  }

  const closeAiBtn = document.getElementById('btnCloseAiSuggestion');
  if (closeAiBtn) {
    closeAiBtn.addEventListener('click', handleCloseAiSuggestion);
  }

  // 7. Setup MetaMask event listeners
  setupMetaMaskListeners();

  // 8. Initial load
  loadNgoData();
}

/**
 * Refresh the NGO dashboard UI with current on-chain data
 */
export function updateNgoDashboard() {
  loadNgoData();
}
