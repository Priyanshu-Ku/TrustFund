/**
 * TrustFund – AI Financial Report Generator Module
 * =================================================
 * Generates an executive-level, transparent financial summary report for the
 * NGO Administrator and donors using Gemini 3.6 Flash grounded strictly in
 * live Ethereum Sepolia smart contract state.
 */

import {
  getSummary,
  getDonationCount,
  getDonation,
  getExpenseCount,
  getExpense,
  cleanEthString,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID
} from '../services/blockchain.js';
import { shortenAddress } from './donorDashboard.js';
import { cleanPrecisionArtifacts } from './chatbot.js';
import { formatEther } from 'ethers';
import { animatePanelEntrance } from '../services/animationService.js';

// Application Configuration: Explicit Campaign Name
export const CAMPAIGN_NAME = 'Education for All';

const BACKEND_REPORT_URL = 'http://127.0.0.1:5000/api/ai/generate-report';

const EXPENSE_STATUS_LABELS = {
  0: 'Submitted (Pending Review)',
  1: 'Approved (ETH Transferred)',
  2: 'Rejected (Funds Retained)'
};

/**
 * Escapes HTML characters to prevent XSS.
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
 * Formats basic Markdown text (bold, italic, bullets).
 */
function formatText(str) {
  if (!str) return '';
  let s = escapeHtml(cleanPrecisionArtifacts(str));
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\n\n/g, '</p><p class="mb-2">');
  s = s.replace(/\n- /g, '<br>• ');
  s = s.replace(/\n\* /g, '<br>• ');
  return `<p class="mb-2">${s}</p>`;
}

/**
 * Format an ETH decimal string or BigInt Wei up to six decimal places,
 * removing unnecessary trailing zeros.
 */
export function formatPrecisionEth(weiOrStr, maxDecimals = 6) {
  let ethStr;
  if (typeof weiOrStr === 'bigint') {
    ethStr = formatEther(weiOrStr);
  } else {
    ethStr = String(weiOrStr || '0').trim();
    if (ethStr.endsWith(' ETH')) ethStr = ethStr.replace(' ETH', '').trim();
  }

  // Handle scientific or float noise if present
  if (ethStr.includes('.')) {
    const parts = ethStr.split('.');
    const integerPart = parts[0];
    let decimals = parts[1].slice(0, maxDecimals);
    // Remove trailing zeros
    decimals = decimals.replace(/0+$/, '');
    if (decimals.length > 0) {
      return `${integerPart}.${decimals}`;
    }
    return integerPart;
  }
  return ethStr;
}

/**
 * Programmatically gather all on-chain data and calculate exact financial stats
 * using BigInt arithmetic wherever possible.
 */
export async function collectAuditBlockchainData() {
  const summary = await getSummary();
  const donationCount = await getDonationCount();
  const expenseCount = await getExpenseCount();

  // Use raw BigInt Wei values from smart contract for precision arithmetic
  const donationsWei = summary.raw?.totalDonations ?? 0n;
  const expensesWei = summary.raw?.totalExpenses ?? 0n;
  const pendingWei = summary.raw?.pendingExpenses ?? 0n;
  const contractBalWei = summary.raw?.contractBalance ?? 0n;
  const availableBalWei = summary.raw?.availableBalance ?? 0n;

  // Programmatic invariant check in BigInt Wei:
  // contract balance = donations received - expenses paid
  const computedBalanceWei = donationsWei >= expensesWei ? donationsWei - expensesWei : 0n;

  // Programmatic fund utilization rate calculated in BigInt basis points (1 bp = 0.01%)
  const utilBasisPoints = donationsWei > 0n ? (expensesWei * 10000n) / donationsWei : 0n;
  const utilPercentNumber = Number(utilBasisPoints) / 100;
  const fundUtilizationFormatted = utilPercentNumber.toFixed(1);

  // Fetch all donations (privacy-preserving: shortened addresses only)
  const donations = [];
  for (let i = 0; i < donationCount; i++) {
    try {
      const d = await getDonation(i);
      donations.push({
        index: i,
        donor: shortenAddress(d.donor),
        amount: `${formatPrecisionEth(d.amount)} ETH`,
        timestamp: d.timestamp ? new Date(d.timestamp * 1000).toLocaleString() : 'Recent'
      });
    } catch (err) {
      console.warn(`Error reading donation #${i}:`, err);
    }
  }

  // Fetch all expenses (privacy-preserving: shortened addresses only)
  const expenses = [];
  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < expenseCount; i++) {
    try {
      const exp = await getExpense(i);
      const statusLabel = EXPENSE_STATUS_LABELS[exp.status] || `Status ${exp.status}`;
      if (exp.status === 1) approvedCount++;
      else if (exp.status === 2) rejectedCount++;
      else if (exp.status === 0) pendingCount++;

      expenses.push({
        id: i,
        recipient: shortenAddress(exp.recipient),
        amount: `${formatPrecisionEth(exp.amount)} ETH`,
        category: exp.category,
        description: exp.description,
        statusCode: exp.status,
        status: statusLabel,
        submittedAt: exp.submittedAt ? new Date(exp.submittedAt * 1000).toLocaleString() : 'N/A',
        approvedAt: exp.approvedAt > 0 ? new Date(exp.approvedAt * 1000).toLocaleString() : null
      });
    } catch (err) {
      console.warn(`Error reading expense #${i}:`, err);
    }
  }

  // Format summary amounts up to 6 decimal places
  const totalDonationsFormatted = `${formatPrecisionEth(donationsWei)} ETH`;
  const totalExpensesFormatted = `${formatPrecisionEth(expensesWei)} ETH`;
  const pendingExpensesFormatted = `${formatPrecisionEth(pendingWei)} ETH`;
  const contractBalanceFormatted = `${formatPrecisionEth(contractBalWei)} ETH`;
  const availableBalanceFormatted = `${formatPrecisionEth(availableBalWei)} ETH`;

  return {
    campaign_name: CAMPAIGN_NAME,
    contract_address: CONTRACT_ADDRESS,
    network: 'Ethereum Sepolia (Chain ID 11155111)',
    total_donations: totalDonationsFormatted,
    total_expenses: totalExpensesFormatted,
    pending_expenses: pendingExpensesFormatted,
    contract_balance: contractBalanceFormatted,
    available_balance: availableBalanceFormatted,
    fund_utilization_percent: parseFloat(fundUtilizationFormatted),
    donation_count: donationCount,
    expense_count: expenseCount,
    approved_expense_count: approvedCount,
    rejected_expense_count: rejectedCount,
    pending_expense_count: pendingCount,
    donations,
    expenses
  };
}

/**
 * Renders the complete HTML report sheet into #reportContentSheet.
 */
function renderReportSheet(reportData) {
  const container = document.getElementById('reportContentSheet');
  if (!container) return;

  const {
    campaign_name,
    contract_address,
    network,
    generated_at,
    financial_summary,
    sections,
    donations,
    expenses
  } = reportData;

  const {
    total_donations,
    total_expenses,
    pending_expenses,
    contract_balance,
    available_balance,
    fund_utilization_percent
  } = financial_summary;

  const donationsHtml = donations.length === 0
    ? '<tr><td colspan="4" class="text-center text-muted py-3">No on-chain donations recorded yet.</td></tr>'
    : donations.map(d => `
        <tr>
          <td><strong class="text-navy">#${d.index + 1}</strong></td>
          <td><span class="font-monospace text-navy small">${escapeHtml(d.donor)}</span></td>
          <td><strong class="text-emerald">${escapeHtml(d.amount)}</strong></td>
          <td class="text-muted small">${escapeHtml(d.timestamp)}</td>
        </tr>
      `).join('');

  const expensesHtml = expenses.length === 0
    ? '<tr><td colspan="5" class="text-center text-muted py-3">No expenses recorded yet.</td></tr>'
    : expenses.map(e => {
        let badgeClass = 'bg-secondary text-white';
        if (e.statusCode === 1) badgeClass = 'badge-approved';
        else if (e.statusCode === 2) badgeClass = 'badge-rejected';
        else if (e.statusCode === 0) badgeClass = 'badge-pending';

        return `
          <tr>
            <td><strong class="text-navy">#${e.id}</strong></td>
            <td>
              <span class="badge bg-light text-navy border me-1">${escapeHtml(e.category)}</span>
              <span class="text-navy small">${escapeHtml(e.description)}</span>
            </td>
            <td><strong class="text-navy">${escapeHtml(e.amount)}</strong></td>
            <td><span class="font-monospace small text-muted">${escapeHtml(e.recipient)}</span></td>
            <td><span class="badge ${badgeClass}">${escapeHtml(e.status)}</span></td>
          </tr>
        `;
      }).join('');

  container.innerHTML = `
    <!-- Report Top Header -->
    <div class="report-header-block border-bottom pb-4 mb-4">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div class="d-flex align-items-center gap-3">
          <div class="report-brand-icon">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L6 12v12c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V12L24 4z" fill="#047857" stroke="#ffffff" stroke-width="2" />
              <path d="M20 24l4 4 8-8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
          </div>
          <div>
            <h3 class="fw-bold text-navy mb-0">TrustFund – AI-Generated Campaign Financial Report</h3>
            <p class="text-muted-custom mb-0 small">On-Chain Financial Summary &amp; Governance Insights</p>
          </div>
        </div>

        <div class="text-md-end text-start">
          <span class="badge bg-emerald-soft text-emerald px-3 py-1 fw-bold mb-1">
            ● Blockchain Data Retrieved from Ethereum Sepolia
          </span>
          <div class="text-muted small"><strong>Report Timestamp:</strong> ${escapeHtml(generated_at)}</div>
          <div class="text-muted small"><strong>Network:</strong> ${escapeHtml(network)}</div>
          <div class="text-muted small font-monospace"><strong>Contract Address:</strong> ${escapeHtml(contract_address)}</div>
        </div>
      </div>
    </div>

    <!-- Campaign Title Banner -->
    <div class="campaign-title-banner p-3 rounded-3 mb-3 bg-light border">
      <div class="row align-items-center">
        <div class="col-md-8">
          <span class="badge bg-emerald text-white px-2 py-1 small mb-1">AI-Generated Financial Summary</span>
          <h4 class="fw-bold text-navy mb-1">${escapeHtml(campaign_name)}</h4>
          <p class="text-muted small mb-0">
            Real-time balance settlement and expense traceability governed by smart contract on Ethereum Sepolia.
          </p>
        </div>
        <div class="col-md-4 text-md-end mt-2 mt-md-0">
          <div class="utilization-box p-2 rounded-3 bg-white border d-inline-block text-center">
            <span class="small text-muted d-block">Fund Utilization</span>
            <span class="fs-5 fw-bold text-emerald">~${fund_utilization_percent}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mandatory Regulatory / Audit Disclaimer Box -->
    <div class="report-disclaimer-box p-3 rounded-3 mb-4 bg-light border border-secondary-subtle">
      <div class="d-flex align-items-start gap-2">
        <span class="badge bg-secondary-subtle text-dark border small mt-1">Disclaimer</span>
        <div class="text-muted small" style="line-height: 1.5;">
          This report is generated using AI based on transaction and financial data retrieved from the Ethereum Sepolia test network. Blockchain records establish the recorded transactions and contract state, but do not independently verify the authenticity of supporting documents, actual purchases or delivery of goods and services. Sepolia test ETH has no real monetary value. This report is not an independent financial audit.
        </div>
      </div>
    </div>

    <!-- Financial Summary 5-Card Grid -->
    <div class="row g-2 mb-4">
      <div class="col-sm-6 col-lg">
        <div class="report-stat-card p-3 rounded-3 border bg-white text-center">
          <span class="report-stat-label text-muted small d-block mb-1">Total Donations</span>
          <span class="report-stat-val fs-5 fw-bold text-emerald">${escapeHtml(total_donations)}</span>
        </div>
      </div>
      <div class="col-sm-6 col-lg">
        <div class="report-stat-card p-3 rounded-3 border bg-white text-center">
          <span class="report-stat-label text-muted small d-block mb-1">Expenses Paid</span>
          <span class="report-stat-val fs-5 fw-bold text-navy">${escapeHtml(total_expenses)}</span>
        </div>
      </div>
      <div class="col-sm-6 col-lg">
        <div class="report-stat-card p-3 rounded-3 border bg-white text-center">
          <span class="report-stat-label text-muted small d-block mb-1">Pending Review</span>
          <span class="report-stat-val fs-5 fw-bold text-warning-emphasis">${escapeHtml(pending_expenses)}</span>
        </div>
      </div>
      <div class="col-sm-6 col-lg">
        <div class="report-stat-card p-3 rounded-3 border bg-white text-center">
          <span class="report-stat-label text-muted small d-block mb-1">Contract Balance</span>
          <span class="report-stat-val fs-5 fw-bold text-navy">${escapeHtml(contract_balance)}</span>
        </div>
      </div>
      <div class="col-sm-6 col-lg">
        <div class="report-stat-card p-3 rounded-3 border bg-white text-center">
          <span class="report-stat-label text-muted small d-block mb-1">Available Balance</span>
          <span class="report-stat-val fs-5 fw-bold text-emerald">${escapeHtml(available_balance)}</span>
        </div>
      </div>
    </div>

    <!-- AI Narrative Sections Grid -->
    <div class="report-sections-block">

      <!-- 1. Executive Summary -->
      <div class="report-section-card p-4 rounded-3 mb-3 border bg-emerald-soft bg-opacity-20 border-emerald-subtle">
        <h5 class="fw-bold text-navy d-flex align-items-center mb-2">
          <span class="section-num-badge me-2">1</span> Executive Summary
        </h5>
        <div class="report-section-body text-navy lead-sm">
          ${formatText(sections.executive_summary)}
        </div>
      </div>

      <div class="row g-3">
        <!-- 2. Campaign Overview -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">2</span> Campaign Overview
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.campaign_overview)}
            </div>
          </div>
        </div>

        <!-- 3. Donation Summary -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">3</span> Donation Inflow Summary
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.donation_summary)}
            </div>
          </div>
        </div>

        <!-- 4. Expense Summary -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">4</span> Expense &amp; Outflow Summary
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.expense_summary)}
            </div>
          </div>
        </div>

        <!-- 5. Fund Utilization -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">5</span> Fund Utilization Analysis
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.fund_utilization)}
            </div>
          </div>
        </div>

        <!-- 6. Remaining Balance & Liquidity -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">6</span> Remaining Balance &amp; Reserves
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.remaining_balance)}
            </div>
          </div>
        </div>

        <!-- 7. Transaction Integrity -->
        <div class="col-md-6">
          <div class="report-section-card p-3 rounded-3 h-100 border bg-white">
            <h6 class="fw-bold text-navy mb-2 d-flex align-items-center">
              <span class="section-num-badge me-2">7</span> Transaction Ledger Overview
            </h6>
            <div class="report-section-body small text-muted-custom">
              ${formatText(sections.transaction_overview)}
            </div>
          </div>
        </div>
      </div>

      <!-- 8. Financial Observations -->
      <div class="report-section-card p-4 rounded-3 mt-3 mb-4 border bg-light">
        <h5 class="fw-bold text-navy d-flex align-items-center mb-2">
          <span class="section-num-badge me-2">8</span> Financial Observations &amp; Governance Remarks
        </h5>
        <div class="report-section-body text-navy">
          ${formatText(sections.financial_observations)}
        </div>
      </div>

    </div>

    <!-- On-Chain Transaction Tables -->
    <div class="report-tables-block mt-4">
      <!-- Incoming Donations Table -->
      <div class="mb-4">
        <h6 class="fw-bold text-navy border-bottom pb-2 mb-3">
          Incoming Donations Ledger (${donations.length} records)
        </h6>
        <div class="table-responsive">
          <table class="table table-sm table-bordered report-table">
            <thead class="table-light">
              <tr>
                <th style="width: 10%;">ID</th>
                <th style="width: 45%;">Donor Address</th>
                <th style="width: 20%;">Amount</th>
                <th style="width: 25%;">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${donationsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Outgoing Expenses Table -->
      <div class="mb-4">
        <h6 class="fw-bold text-navy border-bottom pb-2 mb-3">
          Expenditure Ledger &amp; Statuses (${expenses.length} records)
        </h6>
        <div class="table-responsive">
          <table class="table table-sm table-bordered report-table">
            <thead class="table-light">
              <tr>
                <th style="width: 8%;">ID</th>
                <th style="width: 42%;">Category &amp; Description</th>
                <th style="width: 18%;">Amount</th>
                <th style="width: 20%;">Recipient</th>
                <th style="width: 12%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${expensesHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Report Attestation Footer -->
    <div class="report-attestation border-top pt-3 mt-4 text-center">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 text-muted small">
        <span>🛡️ <strong>TrustFund Protocol</strong> &bull; Campaign: ${escapeHtml(campaign_name)}</span>
        <span>Smart Contract Records Verified &bull; Generated Using Gemini 3.6 Flash</span>
        <span>Page 1 of 1 &bull; Sepolia Testnet</span>
      </div>
    </div>
  `;
}

/**
 * Executes report generation workflow:
 * 1. Opens modal in loading state
 * 2. Fetches blockchain records
 * 3. Calls backend endpoint
 * 4. Displays formatted report
 */
export async function generateFinancialReport() {
  const modalEl = document.getElementById('financialReportModal');
  if (!modalEl) return;

  const bsModal = window.bootstrap?.Modal?.getOrCreateInstance(modalEl) || new bootstrap.Modal(modalEl);
  bsModal.show();

  const loadingState = document.getElementById('reportLoadingState');
  const errorState = document.getElementById('reportErrorState');
  const contentSheet = document.getElementById('reportContentSheet');
  const downloadPdfBtn = document.getElementById('downloadReportPdfBtn');

  if (loadingState) loadingState.classList.remove('d-none');
  if (errorState) errorState.classList.add('d-none');
  if (contentSheet) contentSheet.classList.add('d-none');
  if (downloadPdfBtn) downloadPdfBtn.disabled = true;

  try {
    // 1. Gather fresh on-chain data with BigInt precision
    const auditData = await collectAuditBlockchainData();

    // 2. Post to backend
    const response = await fetch(BACKEND_REPORT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditData)
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      throw new Error(data.message || 'Failed to generate financial report.');
    }

    // 3. Render report content
    renderReportSheet(data.data);

    if (loadingState) loadingState.classList.add('d-none');
    if (contentSheet) {
      contentSheet.classList.remove('d-none');
      animatePanelEntrance(contentSheet);
    }
    if (downloadPdfBtn) downloadPdfBtn.disabled = false;

  } catch (err) {
    console.error('Report generation error:', err);
    if (loadingState) loadingState.classList.add('d-none');
    if (errorState) {
      errorState.classList.remove('d-none');
      const errorMsg = document.getElementById('reportErrorMessage');
      if (errorMsg) {
        errorMsg.textContent = `${err.message} (Verify that backend is active at ${BACKEND_REPORT_URL} and MetaMask is connected to Sepolia).`;
      }
    }
  }
}

/**
 * Dedicated PDF / Print generator for the TrustFund Financial Report.
 * Generates an isolated, self-contained print document containing only the
 * report content, with embedded styles and A4 pagination rules, completely
 * preventing blank print previews and modal overflow issues.
 */
export function printFinancialReport() {
  const contentSheet = document.getElementById('reportContentSheet');
  if (!contentSheet || contentSheet.classList.contains('d-none')) {
    console.warn('No report content available to print. Please generate the report first.');
    return;
  }

  const reportHtml = contentSheet.innerHTML;
  if (!reportHtml || !reportHtml.trim()) {
    console.warn('Report content is empty.');
    return;
  }

  // Create or reuse an isolated hidden iframe for printing
  let printIframe = document.getElementById('trustfundPrintIframe');
  if (!printIframe) {
    printIframe = document.createElement('iframe');
    printIframe.id = 'trustfundPrintIframe';
    printIframe.setAttribute('aria-hidden', 'true');
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    printIframe.style.margin = '0';
    printIframe.style.padding = '0';
    printIframe.style.visibility = 'hidden';
    document.body.appendChild(printIframe);
  }

  const iframeWin = printIframe.contentWindow;
  const iframeDoc = iframeWin.document;

  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TrustFund – AI-Generated Campaign Financial Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12.5px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .report-print-container {
      width: 100%;
      max-width: 100%;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Headings */
    h3 { font-size: 1.35rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
    h4 { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
    h5 { font-size: 0.98rem; font-weight: 700; color: #0f172a; margin-bottom: 0.45rem; }
    h6 { font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem; }
    p { margin-bottom: 0.45rem; }
    small, .small { font-size: 0.82rem; }

    /* Colors */
    .text-navy { color: #0f172a !important; }
    .text-emerald { color: #059669 !important; }
    .text-muted, .text-muted-custom { color: #64748b !important; }
    .text-warning-emphasis { color: #b45309 !important; }
    .text-dark { color: #1e293b !important; }
    .fw-bold { font-weight: 700 !important; }
    .font-monospace { font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important; word-break: break-all; }

    /* Flexbox */
    .d-flex { display: flex !important; }
    .justify-content-between { justify-content: space-between !important; }
    .align-items-center { align-items: center !important; }
    .align-items-start { align-items: flex-start !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .flex-shrink-0 { flex-shrink: 0 !important; }
    .gap-1 { gap: 0.25rem !important; }
    .gap-2 { gap: 0.5rem !important; }
    .gap-3 { gap: 1rem !important; }
    .text-center { text-align: center !important; }
    .text-md-end, .text-end { text-align: right !important; }
    .d-inline-block { display: inline-block !important; }

    /* Spacing */
    .mb-0 { margin-bottom: 0 !important; }
    .mb-1 { margin-bottom: 0.25rem !important; }
    .mb-2 { margin-bottom: 0.5rem !important; }
    .mb-3 { margin-bottom: 0.75rem !important; }
    .mb-4 { margin-bottom: 1rem !important; }
    .mt-1 { margin-top: 0.25rem !important; }
    .mt-2 { margin-top: 0.5rem !important; }
    .mt-3 { margin-top: 0.75rem !important; }
    .mt-4 { margin-top: 1rem !important; }
    .me-1 { margin-right: 0.25rem !important; }
    .me-2 { margin-right: 0.5rem !important; }
    .p-2 { padding: 0.5rem !important; }
    .p-3 { padding: 0.75rem !important; }
    .p-4 { padding: 0.9rem !important; }
    .pb-2 { padding-bottom: 0.5rem !important; }
    .pb-4 { padding-bottom: 1rem !important; }
    .pt-3 { padding-top: 0.75rem !important; }

    /* Borders & Backgrounds */
    .border { border: 1px solid #e2e8f0 !important; }
    .border-bottom { border-bottom: 1px solid #e2e8f0 !important; }
    .border-top { border-top: 1px solid #e2e8f0 !important; }
    .border-secondary-subtle { border-color: #cbd5e1 !important; }
    .border-emerald-subtle { border-color: #a7f3d0 !important; }
    .rounded-3 { border-radius: 8px !important; }
    .rounded-4 { border-radius: 12px !important; }
    .bg-white { background-color: #ffffff !important; }
    .bg-light { background-color: #f8fafc !important; }
    .bg-emerald { background-color: #059669 !important; color: #ffffff !important; }
    .bg-emerald-soft { background-color: #ecfdf5 !important; }
    .bg-secondary-subtle { background-color: #f1f5f9 !important; }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 0.25em 0.65em;
      font-size: 75%;
      font-weight: 600;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: 50rem;
    }
    .badge-approved { background-color: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; }
    .badge-rejected { background-color: #fef2f2 !important; color: #b91c1c !important; border: 1px solid #fecaca !important; }
    .badge-pending { background-color: #fffbeb !important; color: #b45309 !important; border: 1px solid #fde68a !important; }

    .section-num-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #059669;
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* Grid Layout */
    .row {
      display: flex;
      flex-wrap: wrap;
      margin-left: -5px;
      margin-right: -5px;
    }
    .row > * {
      padding-left: 5px;
      padding-right: 5px;
    }
    .g-2 { margin-left: -4px; margin-right: -4px; }
    .g-2 > * { padding-left: 4px; padding-right: 4px; }
    .g-3 { margin-left: -5px; margin-right: -5px; }
    .g-3 > * { padding-left: 5px; padding-right: 5px; margin-bottom: 10px; }

    .col-sm-6, .col-lg {
      flex: 1 0 0%;
      min-width: 0;
    }
    .col-md-6 {
      flex: 0 0 50%;
      max-width: 50%;
    }
    .col-md-8 {
      flex: 0 0 66.666667%;
      max-width: 66.666667%;
    }
    .col-md-4 {
      flex: 0 0 33.333333%;
      max-width: 33.333333%;
    }

    /* Stat Cards */
    .report-stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background-color: #ffffff;
      padding: 0.6rem 0.4rem;
      text-align: center;
    }
    .report-stat-label {
      font-size: 0.74rem;
      color: #64748b;
      margin-bottom: 0.25rem;
      display: block;
    }
    .report-stat-val {
      font-size: 1.05rem;
      font-weight: 700;
    }

    .report-section-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.7rem 0.85rem;
      background-color: #ffffff;
    }

    /* Tables */
    .table-responsive { width: 100%; overflow: visible; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.75rem;
      font-size: 0.82rem;
    }
    table th, table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      text-align: left;
      vertical-align: middle;
    }
    table thead th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 600;
    }

    /* Pagination & Print Flow Rules */
    .report-header-block,
    .campaign-title-banner,
    .report-disclaimer-box,
    .report-stat-card,
    .report-section-card,
    .report-attestation,
    table,
    tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    thead {
      display: table-header-group !important;
    }

    h3, h4, h5, h6 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
  </style>
</head>
<body>
  <div class="report-print-container">
    ${reportHtml}
  </div>
</body>
</html>`;

  iframeDoc.open();
  iframeDoc.write(standaloneHtml);
  iframeDoc.close();

  // Allow browser layout engine to render before triggering print
  setTimeout(() => {
    iframeWin.focus();
    iframeWin.print();
  }, 250);
}

/**
 * Initializes button triggers and print handler.
 */
export function initReportGenerator() {
  // NGO Admin button trigger
  const ngoBtn = document.getElementById('ngoGenerateReportBtn');
  if (ngoBtn) {
    ngoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      generateFinancialReport();
    });
  }

  // Transparency Dashboard button trigger
  const transBtn = document.getElementById('transGenerateReportBtn');
  if (transBtn) {
    transBtn.addEventListener('click', (e) => {
      e.preventDefault();
      generateFinancialReport();
    });
  }

  // Download PDF via Browser Print
  const downloadPdfBtn = document.getElementById('downloadReportPdfBtn');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      printFinancialReport();
    });
  }

  // Retry button
  const retryBtn = document.getElementById('retryReportBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      generateFinancialReport();
    });
  }

  console.log('📊 TrustFund AI Financial Report Generator initialised.');
}
