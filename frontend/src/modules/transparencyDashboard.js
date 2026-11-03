/**
 * TrustFund – Transparency Dashboard Module
 * ===========================================
 * Shows the complete overview of all donations, expenses, chart, and AI alerts.
 */

import { getDonations, getTotalDonated, getDonationCount } from '../services/donationService.js';
import { getExpenses, getTotalExpenses, getExpenseCount } from '../services/expenseService.js';
import { drawFundChart } from '../services/chartService.js';
import { formatDate } from '../data/mockData.js';

/**
 * Refresh the transparency dashboard UI with current data
 */
export function updateTransparencyDashboard() {
  const totalDonations = getTotalDonated();
  const totalExpenses = getTotalExpenses();
  const remaining = Math.max(0, totalDonations - totalExpenses);

  // Update stat cards
  const totalDonEl = document.getElementById('trans-total-donations');
  if (totalDonEl) totalDonEl.textContent = `${totalDonations.toFixed(2)} ETH`;

  const totalExpEl = document.getElementById('trans-total-expenses');
  if (totalExpEl) totalExpEl.textContent = `${totalExpenses.toFixed(2)} ETH`;

  const remainingEl = document.getElementById('trans-remaining-balance');
  if (remainingEl) remainingEl.textContent = `${remaining.toFixed(2)} ETH`;

  // Update count badges
  const donCountEl = document.getElementById('trans-donation-count');
  if (donCountEl) donCountEl.textContent = `${getDonationCount()} records`;

  const expCountEl = document.getElementById('trans-expense-count');
  if (expCountEl) expCountEl.textContent = `${getExpenseCount()} records`;

  // Draw the fund utilization chart
  drawFundChart('fundChart', totalDonations, totalExpenses);

  // Render donation transactions table
  const donBody = document.getElementById('transDonationBody');
  if (donBody) {
    const donations = getDonations();
    donBody.innerHTML = [...donations].reverse().map((d) => `
      <tr>
        <td>${formatDate(d.date)}</td>
        <td><span class="fw-semibold text-navy">${d.donor}</span></td>
        <td><strong class="text-emerald">${d.amount.toFixed(2)} ETH</strong></td>
        <td><span class="badge badge-blue-soft">Demonstration Record</span></td>
      </tr>
    `).join('');
  }

  // Render expense transactions table
  const expBody = document.getElementById('transExpenseBody');
  if (expBody) {
    const expenses = getExpenses();
    expBody.innerHTML = [...expenses].reverse().map((e) => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td><span class="badge badge-amber-soft">${e.category}</span></td>
        <td><strong class="text-navy">${e.amount.toFixed(2)} ETH</strong></td>
        <td><span class="badge badge-blue-soft">Demonstration Record</span></td>
      </tr>
    `).join('');
  }
}
