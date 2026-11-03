/**
 * TrustFund – Donor Dashboard Module
 * ====================================
 * Handles the donation form, wallet connect UI, and donation history table.
 */

import { getDonations, addDonation, getTotalDonated, getDonationCount } from '../services/donationService.js';
import { formatDate } from '../data/mockData.js';
import { showToast } from './toastHelper.js';

// Track wallet connection state (UI only)
let isWalletConnected = false;

/**
 * Initialise the donor dashboard: form handler + wallet button
 * @param {Function} onDataChange - Callback to refresh all dashboards after a donation
 */
export function initDonorDashboard(onDataChange) {
  // Donation form submission
  const form = document.getElementById('donationForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Bootstrap validation
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        showToast('Please fill in all required fields correctly.', 'error');
        return;
      }

      const donor = document.getElementById('donorName').value.trim();
      const amount = parseFloat(document.getElementById('donationAmount').value);
      const message = document.getElementById('donationMessage').value.trim();

      // Additional validation
      if (amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid donation amount.', 'error');
        return;
      }

      // Add the donation
      const newDonation = addDonation(donor, amount, message);

      // Reset form
      form.reset();
      form.classList.remove('was-validated');

      // Show success message
      showToast(`Thank you, ${donor}! Your donation of ${amount.toFixed(2)} ETH has been recorded.`, 'success');

      // Refresh all dashboards
      if (onDataChange) onDataChange();
    });
  }

  // Wallet connect button (UI only – no real wallet integration)
  const walletBtn = document.getElementById('connectWalletBtn');
  if (walletBtn) {
    walletBtn.addEventListener('click', () => {
      isWalletConnected = !isWalletConnected;
      updateWalletUI(walletBtn);
      if (isWalletConnected) {
        showToast('Wallet connected successfully! (Simulated)', 'success');
      } else {
        showToast('Wallet disconnected.', 'error');
      }
    });
  }
}

/**
 * Refresh the donor dashboard UI with current data
 */
export function updateDonorDashboard() {
  const donations = getDonations();
  const totalDonated = getTotalDonated();
  const donationCount = getDonationCount();

  // Update stat cards
  const totalAmountEl = document.getElementById('donor-total-amount');
  if (totalAmountEl) totalAmountEl.textContent = `${totalDonated.toFixed(2)} ETH`;

  const totalCountEl = document.getElementById('donor-total-count');
  if (totalCountEl) totalCountEl.textContent = donationCount;

  // Update history count badge
  const historyCountEl = document.getElementById('donor-history-count');
  if (historyCountEl) historyCountEl.textContent = `${donationCount} records`;

  // Render donation history table
  const tbody = document.getElementById('donationHistoryBody');
  const emptyState = document.getElementById('donorEmptyState');

  if (tbody) {
    if (donations.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
    } else {
      if (emptyState) emptyState.classList.add('d-none');

      // Show newest donations first
      tbody.innerHTML = [...donations].reverse().map((d) => `
        <tr>
          <td>${formatDate(d.date)}</td>
          <td><strong class="text-emerald">${d.amount.toFixed(2)} ETH</strong></td>
          <td><span class="tx-hash" title="Sample demonstration hash (Not on-chain): ${d.txHash}">${d.txHash.slice(0, 10)}...${d.txHash.slice(-6)}</span></td>
          <td><span class="badge badge-blue-soft">Demonstration Record</span></td>
        </tr>
      `).join('');
    }
  }
}

/**
 * Update the wallet button appearance
 */
function updateWalletUI(btn) {
  const statusEl = document.getElementById('donor-wallet-status');

  if (isWalletConnected) {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2"><path d="M9 12l2 2 4-4"/><rect x="2" y="6" width="20" height="14" rx="2"/></svg>
      Wallet Connected
    `;
    btn.classList.add('wallet-connected');
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-emerald-soft">Connected</span>';
    }
  } else {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 14h.01M2 10h20"/></svg>
      Connect Wallet
    `;
    btn.classList.remove('wallet-connected');
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-danger-soft">Not Connected</span>';
    }
  }
}
