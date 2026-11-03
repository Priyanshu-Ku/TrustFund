/**
 * TrustFund – Donation Service
 * ============================
 * Manages donation data (add, get, calculate totals).
 * In Phase 2, these functions will call Ethereum smart contracts via Ethers.js.
 */

import { initialDonations, generateTxHash, formatDate } from '../data/mockData.js';

// Private array of donations (seeded with mock data)
let donations = [...initialDonations];

/**
 * Get all donations
 * @returns {Array} Copy of the donations array
 */
export function getDonations() {
  return [...donations];
}

/**
 * Add a new donation
 * @param {string} donor - Donor's name
 * @param {number} amount - Donation amount in ETH
 * @param {string} message - Optional message
 * @returns {Object} The newly created donation record
 */
export function addDonation(donor, amount, message = '') {
  const newDonation = {
    id: donations.length + 1,
    donor,
    amount: parseFloat(amount),
    message,
    date: new Date().toISOString().split('T')[0], // Today's date
    txHash: generateTxHash(), // Simulated demonstration tx hash
    status: 'Demonstration Record',
  };
  donations.push(newDonation);
  return newDonation;
}

/**
 * Calculate the total donated amount
 * @returns {number} Sum of all donation amounts
 */
export function getTotalDonated() {
  return donations.reduce((sum, d) => sum + d.amount, 0);
}

/**
 * Get the total number of donations
 * @returns {number} Count of donations
 */
export function getDonationCount() {
  return donations.length;
}
