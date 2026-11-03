/**
 * TrustFund – Home Page Module
 * =============================
 * Updates the home page campaign progress, hero banner, and statistics.
 */

import { getTotalDonated, getDonationCount } from '../services/donationService.js';
import { campaign } from '../data/mockData.js';

/**
 * Refresh the home page with current data
 */
export function updateHomePage() {
  const totalDonated = getTotalDonated();
  const donationCount = getDonationCount();
  const progressPercent = Math.min((totalDonated / campaign.goal) * 100, 100);

  // Update big hero display amount (mirroring the reference screenshot)
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
    heroUsdEl.textContent = `≈ ${usd} USD`;
  }

  // Update navbar live pool badge
  const navPoolEl = document.getElementById('nav-live-pool');
  if (navPoolEl) navPoolEl.textContent = `${totalDonated.toFixed(2)} ETH`;

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
    progressBadgeEl.textContent = `${progressPercent.toFixed(0)}% Achieved`;
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
