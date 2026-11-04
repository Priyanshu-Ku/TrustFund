/**
 * TrustFund – Home Page Module
 * =============================
 * Updates the home page campaign progress, hero banner, and statistics.
 * Reflects live smart contract metrics on Ethereum Sepolia.
 */

import { campaign } from '../data/mockData.js';

let cachedSummary = null;
let cachedDonationCount = 0;

/**
 * Set the latest live blockchain statistics from smart contract
 * @param {Object} summary - Contract summary { totalDonations, contractBalance, etc. }
 * @param {number} count - Total on-chain donation count
 */
export function setBlockchainHomeStats(summary, count) {
  cachedSummary = summary;
  cachedDonationCount = count;
  updateHomePage();
}

/**
 * Refresh the home page with current data
 */
export function updateHomePage() {
  const totalDonated = cachedSummary
    ? parseFloat(cachedSummary.totalDonations)
    : 0;
  const donationCount = cachedDonationCount;
  const goal = campaign?.goal || 10;
  const progressPercent = Math.min((totalDonated / goal) * 100, 100);

  // Update big hero display amount
  const heroAmountEl = document.getElementById('home-hero-amount');
  if (heroAmountEl) heroAmountEl.textContent = `${totalDonated.toFixed(2)} ETH`;

  // Update hero estimated USD conversion (approx $3,380 per ETH)
  const heroUsdEl = document.getElementById('home-hero-usd');
  if (heroUsdEl) {
    const usd = (totalDonated * 3380).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
    heroUsdEl.textContent = `≈ ${usd} USD Tracked in Real-Time`;
  }

  // Update navbar live pool badge
  const navPoolEl = document.getElementById('nav-live-pool');
  if (navPoolEl) navPoolEl.textContent = `${totalDonated.toFixed(4)} ETH`;

  // Update campaign raised amount
  const raisedEl = document.getElementById('campaign-raised');
  if (raisedEl) raisedEl.textContent = `${totalDonated.toFixed(2)} ETH`;

  // Update progress bar
  const progressBar = document.getElementById('campaign-progress-bar');
  if (progressBar) {
    progressBar.style.width = `${progressPercent.toFixed(0)}%`;
    progressBar.textContent = `${progressPercent.toFixed(0)}%`;
  }

  // Update progress percentage badge
  const progressBadgeEl = document.getElementById('campaign-percent-badge');
  if (progressBadgeEl) {
    progressBadgeEl.textContent = `+${progressPercent.toFixed(0)}% Achieved`;
  }

  // Update about section stats
  const totalDonationsEl = document.getElementById('home-total-donations');
  if (totalDonationsEl) totalDonationsEl.textContent = `${totalDonated.toFixed(2)} ETH`;

  const totalCountEl = document.getElementById('home-total-count');
  if (totalCountEl) totalCountEl.textContent = donationCount;

  // Update dark reconciliation card counter
  const reconCountEl = document.getElementById('home-reconciled-count');
  if (reconCountEl) reconCountEl.textContent = donationCount;
}
