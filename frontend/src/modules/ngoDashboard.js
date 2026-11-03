/**
 * TrustFund – NGO Dashboard Module
 * ==================================
 * Handles the expense submission form and expense history table.
 */

import { getExpenses, addExpense, getTotalExpenses, getExpenseCount } from '../services/expenseService.js';
import { getTotalDonated } from '../services/donationService.js';
import { formatDate } from '../data/mockData.js';
import { showToast } from './toastHelper.js';

/**
 * Initialise the NGO dashboard: expense form handler
 * @param {Function} onDataChange - Callback to refresh all dashboards after an expense
 */
export function initNgoDashboard(onDataChange) {
  const form = document.getElementById('expenseForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Bootstrap validation
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        showToast('Please fill in all required fields correctly.', 'error');
        return;
      }

      const category = document.getElementById('expenseCategory').value;
      const amount = parseFloat(document.getElementById('expenseAmount').value);
      const description = document.getElementById('expenseDescription').value.trim();

      // Additional validation
      if (amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid expense amount.', 'error');
        return;
      }

      // Check if expense exceeds remaining balance
      const remaining = getTotalDonated() - getTotalExpenses();
      if (amount > remaining) {
        showToast(`Expense exceeds remaining balance (${remaining.toFixed(2)} ETH available).`, 'error');
        return;
      }

      // Add the expense
      addExpense(category, amount, description);

      // Reset form
      form.reset();
      form.classList.remove('was-validated');

      // Show success message
      showToast(`Expense of ${amount.toFixed(2)} ETH for "${category}" recorded successfully.`, 'success');

      // Refresh all dashboards
      if (onDataChange) onDataChange();
    });
  }
}

/**
 * Refresh the NGO dashboard UI with current data
 */
export function updateNgoDashboard() {
  const expenses = getExpenses();
  const totalDonations = getTotalDonated();
  const totalExpenses = getTotalExpenses();
  const remaining = Math.max(0, totalDonations - totalExpenses);

  // Update stat cards
  const totalDonEl = document.getElementById('ngo-total-donations');
  if (totalDonEl) totalDonEl.textContent = `${totalDonations.toFixed(2)} ETH`;

  const totalExpEl = document.getElementById('ngo-total-expenses');
  if (totalExpEl) totalExpEl.textContent = `${totalExpenses.toFixed(2)} ETH`;

  const remainingEl = document.getElementById('ngo-remaining-balance');
  if (remainingEl) remainingEl.textContent = `${remaining.toFixed(2)} ETH`;

  // Update history count badge
  const historyCountEl = document.getElementById('ngo-history-count');
  if (historyCountEl) historyCountEl.textContent = `${getExpenseCount()} records`;

  // Render expense history table
  const tbody = document.getElementById('expenseHistoryBody');
  const emptyState = document.getElementById('ngoEmptyState');

  if (tbody) {
    if (expenses.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
    } else {
      if (emptyState) emptyState.classList.add('d-none');

      tbody.innerHTML = [...expenses].reverse().map((e) => `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td><span class="badge badge-amber-soft">${e.category}</span></td>
          <td><strong class="text-navy">${e.amount.toFixed(2)} ETH</strong></td>
          <td><span class="tx-hash" title="Sample demonstration hash (Not on-chain): ${e.txHash}">${e.txHash.slice(0, 10)}...${e.txHash.slice(-6)}</span></td>
          <td>
            <span class="badge badge-amber-soft">
              AI Preview – Model Not Connected
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
}
