/**
 * TrustFund – Expense Service
 * ============================
 * Manages expense data (add, get, calculate totals).
 * In Phase 2, these functions will call Ethereum smart contracts via Ethers.js.
 */

import { initialExpenses, generateTxHash } from '../data/mockData.js';

// Private array of expenses (seeded with mock data)
let expenses = [...initialExpenses];

/**
 * Get all expenses
 * @returns {Array} Copy of the expenses array
 */
export function getExpenses() {
  return [...expenses];
}

/**
 * Add a new expense
 * @param {string} category - Expense category
 * @param {number} amount - Expense amount in ETH
 * @param {string} description - Description of the expense
 * @returns {Object} The newly created expense record
 */
export function addExpense(category, amount, description) {
  const newExpense = {
    id: expenses.length + 1,
    category,
    amount: parseFloat(amount),
    description,
    date: new Date().toISOString().split('T')[0],
    txHash: generateTxHash(),
    aiStatus: 'Normal', // Placeholder – AI analysis in Phase 2
  };
  expenses.push(newExpense);
  return newExpense;
}

/**
 * Calculate the total expenses
 * @returns {number} Sum of all expense amounts
 */
export function getTotalExpenses() {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Get the total number of expenses
 * @returns {number} Count of expenses
 */
export function getExpenseCount() {
  return expenses.length;
}

/**
 * Get expenses grouped by category (for charts)
 * @returns {Object} { categoryName: totalAmount, ... }
 */
export function getExpensesByCategory() {
  const categories = {};
  expenses.forEach((e) => {
    categories[e.category] = (categories[e.category] || 0) + e.amount;
  });
  return categories;
}
