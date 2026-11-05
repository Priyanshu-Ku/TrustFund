/**
 * TrustFund – Home Page Module
 * =============================
 * Updates the home page campaign progress, hero banner, and statistics.
 * Reflects live smart contract metrics on Ethereum Sepolia.
 */

import { campaign } from '../data/mockData.js';
import { getSummary, getDonationCount, getExpenseCount, cleanEthString } from '../services/blockchain.js';
import { animateProgressBar } from '../services/animationService.js';
import { playHomeAnimations } from '../utils/homeAnimations.js';

let cachedSummary = null;
let cachedDonationCount = 0;
let cachedExpenseCount = 0;
let isFetching = false;
let hasPlayedInitialAnimation = false;

/**
 * Set the latest live blockchain statistics from smart contract
 * @param {Object} summary - Contract summary { totalDonations, totalExpenses, etc. }
 * @param {number} [donationCount] - Total on-chain donation count
 * @param {number} [expenseCount] - Total on-chain expense count
 */
export function setBlockchainHomeStats(summary, donationCount, expenseCount) {
  cachedSummary = summary;
  if (donationCount !== undefined) cachedDonationCount = donationCount;
  if (expenseCount !== undefined) cachedExpenseCount = expenseCount;
  renderHomeStats();
}

/**
 * Fetch and update home page stats directly from Sepolia smart contract
 */
export async function updateHomePage() {
  if (cachedSummary) {
    renderHomeStats();
  }

  if (isFetching) return;
  isFetching = true;

  try {
    const [summary, dCount, eCount] = await Promise.all([
      getSummary(),
      getDonationCount(),
      getExpenseCount(),
    ]);
    cachedSummary = summary;
    cachedDonationCount = dCount;
    cachedExpenseCount = eCount;
    renderHomeStats();
  } catch (err) {
    console.warn('Could not auto-fetch blockchain metrics for Home page:', err);
    if (!cachedSummary) renderHomeStats();
  } finally {
    isFetching = false;
  }
}

/**
 * Render the home page elements with authoritative blockchain figures
 */
function renderHomeStats() {
  const totalDonated = cachedSummary
    ? parseFloat(cachedSummary.totalDonations) || 0
    : 0;
  const totalExpenses = cachedSummary
    ? parseFloat(cachedSummary.totalExpenses) || 0
    : 0;
  const donationCount = cachedDonationCount || 0;
  const expenseCount = cachedExpenseCount || 0;
  const totalRecords = donationCount + expenseCount;
  const goal = campaign?.goal || 10;

  // Calculate actual progress based on total donations / target goal (10 ETH)
  // For 0.001 ETH and 10 ETH target: (0.001 / 10) * 100 = 0.01%
  const progressPercent = goal > 0 ? (totalDonated / goal) * 100 : 0;

  // Format ETH string consistently across all home elements and navbar
  const ethStr = cleanEthString(totalDonated.toFixed(4));
  const displayEth = `${ethStr} ETH`;

  // 1. Update big hero display amount (matches navbar exactly)
  const heroAmountEl = document.getElementById('home-hero-amount');
  if (heroAmountEl) heroAmountEl.textContent = displayEth;

  // 2. Update hero estimated USD conversion (approx $3,380 per ETH)
  const heroUsdEl = document.getElementById('home-hero-usd');
  if (heroUsdEl) {
    const usd = (totalDonated * 3380).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
    heroUsdEl.textContent = `≈ ${usd} USD Tracked in Real-Time`;
  }

  // 3. Update navbar live pool badge (matches hero amount exactly)
  const navPoolEl = document.getElementById('nav-live-pool');
  if (navPoolEl) navPoolEl.textContent = displayEth;

  // 4. Update campaign raised amount (matches hero amount exactly)
  const raisedEl = document.getElementById('campaign-raised');
  if (raisedEl) raisedEl.textContent = displayEth;

  // 5. Update progress percentage badge and funded label
  let pctLabel = '0%';
  if (progressPercent >= 1) {
    pctLabel = progressPercent % 1 === 0 ? `${progressPercent.toFixed(0)}%` : `${progressPercent.toFixed(1)}%`;
  } else if (progressPercent > 0) {
    pctLabel = `${progressPercent.toFixed(2)}%`;
  }

  const progressBadgeEl = document.getElementById('campaign-percent-badge');
  if (progressBadgeEl) {
    progressBadgeEl.textContent = progressPercent > 0 ? `+${pctLabel} Achieved` : '0% Achieved';
  }

  const fundedLabelEl = document.getElementById('campaign-percent-label');
  if (fundedLabelEl) {
    fundedLabelEl.textContent = `${pctLabel} Funded`;
  }

  // 6. Animate progress bar width smoothly
  const progressBar = document.getElementById('campaign-progress-bar');
  if (progressBar) {
    // For very small non-zero amounts like 0.01%, ensure a minimum 1% visible track sliver
    const visualWidth = progressPercent > 0 ? Math.max(progressPercent, 1) : 0;
    animateProgressBar(progressBar, visualWidth);
    progressBar.setAttribute('aria-valuenow', progressPercent.toFixed(2));
  }

  // 7. On-Chain Ledger Card (Confirmed Transactions)
  const reconCountEl = document.getElementById('home-reconciled-count');
  if (reconCountEl) {
    reconCountEl.textContent = totalRecords;
  }

  // 8. Fund Utilization Card (Allocation Status)
  // Total Donations: 0.001 ETH, Expenses Paid: 0.0002 ETH -> 20%
  let utilizationPercent = 0;
  if (totalDonated > 0) {
    utilizationPercent = (totalExpenses / totalDonated) * 100;
  }
  utilizationPercent = Math.max(0, Math.min(100, utilizationPercent));

  const utilFormatted = utilizationPercent % 1 === 0
    ? utilizationPercent.toFixed(0)
    : utilizationPercent.toFixed(1);

  const utilBadgeEl = document.getElementById('home-utilization-badge');
  if (utilBadgeEl) {
    utilBadgeEl.textContent = `${utilFormatted}% Utilized`;
    utilBadgeEl.className = utilizationPercent > 75
      ? 'badge badge-amber-soft'
      : 'badge badge-emerald-soft';
  }

  const totalDonationsEl = document.getElementById('home-total-donations');
  if (totalDonationsEl) {
    totalDonationsEl.textContent = displayEth;
  }

  const utilLabelEl = document.getElementById('home-utilization-label');
  if (utilLabelEl) {
    const expensesStr = cleanEthString(totalExpenses.toFixed(4));
    if (totalDonated > 0) {
      utilLabelEl.textContent = `${expensesStr} ETH disbursed of ${displayEth} capital`;
    } else {
      utilLabelEl.textContent = '0.00 ETH disbursed (awaiting initial donations)';
    }
  }

  const utilProgressEl = document.getElementById('home-utilization-progress');
  if (utilProgressEl) {
    utilProgressEl.setAttribute('aria-valuenow', utilizationPercent.toFixed(1));
    const segments = utilProgressEl.querySelectorAll('.seg');
    // 5 segments, each represents 20%
    const activeSegments = Math.min(5, Math.max(0, Math.round(utilizationPercent / 20)));
    segments.forEach((seg, idx) => {
      seg.className = 'seg';
      if (idx < activeSegments) {
        seg.classList.add(utilizationPercent > 75 ? 'active-amber' : 'active-emerald');
      }
    });
  }

  // 9. AI Assistance Card (Accurate counts, singular/plural grammar, dynamic status)
  const totalCountEl = document.getElementById('home-total-count');
  if (totalCountEl) {
    totalCountEl.textContent = totalRecords;
  }

  const countUnitEl = document.getElementById('home-total-count-unit');
  if (countUnitEl) {
    countUnitEl.textContent = totalRecords === 1 ? 'on-chain record' : 'on-chain records';
  }

  const aiStatusEl = document.getElementById('home-ai-status-text');
  if (aiStatusEl) {
    if (totalRecords > 0) {
      aiStatusEl.textContent = `✓ Real-time audit intelligence & donor chat online (${totalRecords} record${totalRecords === 1 ? '' : 's'} verified)`;
    } else {
      aiStatusEl.textContent = '✓ AI models stand by for incoming Sepolia transactions';
    }
  }

  const aiProgressEl = document.getElementById('home-ai-progress');
  if (aiProgressEl) {
    const aiSegments = aiProgressEl.querySelectorAll('.seg');
    aiSegments.forEach((seg, idx) => {
      seg.className = 'seg';
      if (idx < 4) {
        seg.classList.add('active-emerald');
      }
    });
  }

  // 10. Trigger initial home animations once DOM data is populated
  if (!hasPlayedInitialAnimation) {
    const homeSection = document.getElementById('section-home');
    if (homeSection && homeSection.style.display !== 'none') {
      hasPlayedInitialAnimation = true;
      playHomeAnimations();
    }
  }
}
