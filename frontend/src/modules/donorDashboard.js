/**
 * TrustFund – Donor Dashboard Module
 * ====================================
 * Handles MetaMask wallet connection, real on-chain donation transactions,
 * and live blockchain donation records on Ethereum Sepolia.
 *
 * Phase 4: Integrated with DonationTracker.sol on Sepolia.
 */

import { showToast } from './toastHelper.js';
import {
  connectWallet,
  getSummary,
  getDonationCount,
  getDonation,
  donate,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID
} from '../services/blockchain.js';
import { setBlockchainHomeStats } from './home.js';

// --- State Variables ---
let currentWallet = null;          // Holds { address, provider, signer, chainId } when connected
let isConnecting = false;          // Tracks in-progress connection request
let isDonating = false;            // Tracks in-progress donation transaction
let hasAttachedListeners = false;  // Prevents duplicate event listeners
let onDataChangeCallback = null;   // Callback to refresh other dashboards

// In-memory session store of transactions submitted during this user session
// Persisted to sessionStorage so page refreshes don't lose freshly confirmed tx hashes
const SESSION_TX_KEY = 'trustfund_donor_session_txs';

function getSessionReceipts() {
  try {
    const raw = sessionStorage.getItem(SESSION_TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionReceipt(receipt) {
  try {
    const list = getSessionReceipts();
    list.unshift(receipt);
    // Keep last 50 receipts
    sessionStorage.setItem(SESSION_TX_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (err) {
    console.warn('Could not save session receipt:', err);
  }
}

/**
 * Shorten an Ethereum address or hash for display (e.g. 0x1234...5678)
 * @param {string} address - Full Ethereum address or hash
 * @returns {string} Shortened string
 */
export function shortenAddress(address) {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get current connected wallet details
 * @returns {Object|null}
 */
export function getConnectedWallet() {
  return currentWallet;
}

/**
 * Update the wallet button and status cards in the Donor Dashboard
 */
export function updateWalletUI() {
  const walletBtn = document.getElementById('connectWalletBtn');
  const statusEl = document.getElementById('donor-wallet-status');
  const networkEl = document.getElementById('donor-wallet-network');
  const addressContainer = document.getElementById('donor-wallet-address-container');
  const addressEl = document.getElementById('donor-wallet-address');
  const iconBox = document.getElementById('donor-wallet-icon');
  const formWalletEl = document.getElementById('form-wallet-address');
  const formNetworkBadge = document.getElementById('form-network-badge');

  // If a connection request is currently in progress, do not overwrite the loading state
  if (isConnecting) return;

  if (currentWallet && currentWallet.address) {
    const shortAddr = shortenAddress(currentWallet.address);

    // 1. Connection status badge
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-emerald-soft">Connected</span>';
    }

    // 2. Network badge (Ethereum Sepolia)
    if (networkEl) {
      networkEl.textContent = 'Ethereum Sepolia';
      networkEl.className = 'badge badge-blue-soft';
      networkEl.classList.remove('d-none');
    }

    // 3. Shortened wallet address display
    if (addressContainer && addressEl) {
      addressEl.textContent = shortAddr;
      addressEl.title = `Connected wallet: ${currentWallet.address}`;
      addressContainer.classList.remove('d-none');
    }

    // 4. Stat icon background
    if (iconBox) {
      iconBox.style.backgroundColor = 'var(--tf-emerald-subtle)';
      iconBox.style.color = 'var(--tf-emerald)';
    }

    // 5. Connect Wallet Button display
    if (walletBtn) {
      walletBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 text-emerald"><path d="M9 12l2 2 4-4"/><rect x="2" y="6" width="20" height="14" rx="2"/></svg>
        <span>${shortAddr}</span>
      `;
      walletBtn.classList.add('wallet-connected');
      walletBtn.title = `Connected: ${currentWallet.address} (Click to disconnect)`;
    }

    // 6. Form wallet address indicator
    if (formWalletEl) {
      formWalletEl.textContent = currentWallet.address;
      formWalletEl.className = 'fw-bold font-monospace text-emerald small text-break';
    }
    if (formNetworkBadge) {
      formNetworkBadge.className = 'badge badge-emerald-soft';
      formNetworkBadge.textContent = 'Sepolia Connected';
    }
  } else {
    // Disconnected state
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-danger-soft">Not Connected</span>';
    }

    if (networkEl) {
      networkEl.classList.add('d-none');
    }

    if (addressContainer) {
      addressContainer.classList.add('d-none');
    }

    if (iconBox) {
      iconBox.style.backgroundColor = 'var(--tf-amber-subtle)';
      iconBox.style.color = 'var(--tf-amber)';
    }

    if (walletBtn) {
      walletBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 14h.01M2 10h20"/></svg>
        Connect Wallet
      `;
      walletBtn.classList.remove('wallet-connected');
      walletBtn.removeAttribute('title');
    }

    if (formWalletEl) {
      formWalletEl.textContent = 'Not connected – please connect MetaMask above';
      formWalletEl.className = 'fw-bold font-monospace text-navy small text-break';
    }
    if (formNetworkBadge) {
      formNetworkBadge.className = 'badge badge-blue-soft';
      formNetworkBadge.textContent = 'Sepolia';
    }
  }
}

/**
 * Update UI when user is on a chain other than Ethereum Sepolia
 */
function setWrongNetworkState() {
  currentWallet = null;
  const statusEl = document.getElementById('donor-wallet-status');
  const networkEl = document.getElementById('donor-wallet-network');
  const addressContainer = document.getElementById('donor-wallet-address-container');
  const iconBox = document.getElementById('donor-wallet-icon');
  const walletBtn = document.getElementById('connectWalletBtn');
  const formWalletEl = document.getElementById('form-wallet-address');
  const formNetworkBadge = document.getElementById('form-network-badge');

  if (statusEl) {
    statusEl.innerHTML = '<span class="badge badge-danger-soft">Wrong Network</span>';
  }

  if (networkEl) {
    networkEl.textContent = 'Switch to Sepolia';
    networkEl.className = 'badge badge-danger-soft';
    networkEl.classList.remove('d-none');
  }

  if (addressContainer) {
    addressContainer.classList.add('d-none');
  }

  if (iconBox) {
    iconBox.style.backgroundColor = 'var(--tf-danger-subtle)';
    iconBox.style.color = 'var(--tf-danger)';
  }

  if (walletBtn) {
    walletBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 text-danger"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      Switch to Sepolia
    `;
    walletBtn.classList.remove('wallet-connected');
    walletBtn.title = 'Please switch to Ethereum Sepolia in MetaMask';
  }

  if (formWalletEl) {
    formWalletEl.textContent = 'Wrong network – please switch MetaMask to Sepolia';
    formWalletEl.className = 'fw-bold font-monospace text-danger small text-break';
  }
  if (formNetworkBadge) {
    formNetworkBadge.className = 'badge badge-danger-soft';
    formNetworkBadge.textContent = 'Wrong Network';
  }
}

/**
 * Reset wallet state to disconnected
 */
function disconnectWallet() {
  currentWallet = null;
  updateWalletUI();
}

/**
 * Setup listeners for MetaMask events:
 * - accountsChanged: update address or clear state
 * - chainChanged: require reconnection if network moves away from Sepolia
 */
function setupMetaMaskListeners() {
  if (hasAttachedListeners || typeof window === 'undefined' || !window.ethereum) {
    return;
  }

  const handleAccountsChanged = (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
      showToast('Wallet disconnected in MetaMask.', 'info');
    } else if (currentWallet) {
      const newAddress = accounts[0];
      if (currentWallet.address.toLowerCase() !== newAddress.toLowerCase()) {
        currentWallet.address = newAddress;
        updateWalletUI();
        showToast(`Account switched to ${shortenAddress(newAddress)}`, 'success');
        loadBlockchainData();
      }
    }
  };

  const handleChainChanged = (chainIdHex) => {
    const isSepolia = chainIdHex && chainIdHex.toLowerCase() === '0xaa36a7';
    if (!isSepolia) {
      setWrongNetworkState();
      showToast('Network changed. Please switch MetaMask to Ethereum Sepolia.', 'error');
    } else {
      showToast('Network switched to Ethereum Sepolia.', 'success');
      if (currentWallet) {
        updateWalletUI();
      }
      loadBlockchainData();
    }
  };

  window.ethereum.on('accountsChanged', handleAccountsChanged);
  window.ethereum.on('accountChanged', handleAccountsChanged);
  window.ethereum.on('chainChanged', handleChainChanged);

  hasAttachedListeners = true;
}

/**
 * Handle Connect Wallet button click:
 * - Checks for MetaMask installation
 * - Shows loading spinner
 * - Calls connectWallet() from blockchain service
 * - Handles errors (network, rejected request, not installed)
 */
export async function handleConnectWallet() {
  const walletBtn = document.getElementById('connectWalletBtn');
  if (isConnecting) return;

  // If already connected, clicking again allows disconnecting
  if (currentWallet) {
    disconnectWallet();
    showToast('Wallet disconnected.', 'info');
    return;
  }

  // 1. Check if MetaMask is installed
  if (typeof window === 'undefined' || !window.ethereum) {
    showToast(
      'MetaMask is not installed. Please <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" class="text-decoration-underline fw-bold">install MetaMask</a> to continue.',
      'error',
      7000
    );
    return;
  }

  // 2. Begin connection with loading state
  try {
    isConnecting = true;
    if (walletBtn) {
      walletBtn.disabled = true;
      walletBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Connecting...
      `;
    }

    const wallet = await connectWallet();
    currentWallet = wallet;

    setupMetaMaskListeners();
    updateWalletUI();

    showToast(
      `Wallet connected: ${shortenAddress(wallet.address)} (Ethereum Sepolia)`,
      'success'
    );

    // Load actual on-chain donation records
    await loadBlockchainData();
  } catch (err) {
    console.error('MetaMask connection error:', err);
    const errMsg = err?.message || '';

    if (!window.ethereum || errMsg.includes('MetaMask is not installed')) {
      showToast(
        'MetaMask is not installed. Please <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" class="text-decoration-underline fw-bold">install MetaMask</a> to continue.',
        'error',
        7000
      );
    } else if (errMsg.includes('Ethereum Sepolia') || errMsg.includes('switch MetaMask')) {
      showToast('Please switch MetaMask to Ethereum Sepolia network.', 'error');
      setWrongNetworkState();
    } else if (err?.code === 4001 || errMsg.toLowerCase().includes('user rejected')) {
      showToast('MetaMask connection request was cancelled.', 'error');
    } else {
      showToast(errMsg || 'Failed to connect MetaMask wallet.', 'error');
    }
  } finally {
    isConnecting = false;
    if (walletBtn) {
      walletBtn.disabled = false;
      updateWalletUI();
    }
  }
}

/**
 * Handle user error messages during donation transaction
 * @param {Error} err
 */
function handleDonationError(err) {
  const errMsg = (err?.message || '').toLowerCase();
  const errCode = err?.code;

  if (
    errCode === 4001 ||
    errCode === 'ACTION_REJECTED' ||
    errMsg.includes('user rejected') ||
    errMsg.includes('denied transaction')
  ) {
    showToast('Transaction was rejected in MetaMask.', 'error');
  } else if (
    errMsg.includes('insufficient funds') ||
    errMsg.includes('exceeds balance') ||
    errCode === 'INSUFFICIENT_FUNDS'
  ) {
    showToast(
      'Insufficient Sepolia test ETH for donation + gas fee. Please acquire free test ETH from a Sepolia faucet.',
      'error',
      8000
    );
  } else if (
    errMsg.includes('network') ||
    errMsg.includes('chainid') ||
    errMsg.includes('switch metamask')
  ) {
    showToast('Please switch MetaMask to the Ethereum Sepolia network.', 'error');
    setWrongNetworkState();
  } else if (errMsg.includes('metamask is not installed')) {
    showToast(
      'MetaMask is not installed. Please <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" class="text-decoration-underline fw-bold">install MetaMask</a> to donate.',
      'error',
      7000
    );
  } else {
    showToast(
      `Transaction failed: ${err?.reason || err?.shortMessage || err?.message || 'Transaction reverted'}`,
      'error',
      6000
    );
  }
}

/**
 * Handle donation form submission:
 * - Validates input amount
 * - Checks wallet connection & Sepolia network
 * - Calls donate(amount) from blockchain service
 * - Shows loading states
 * - Stores transaction hash and links to Etherscan
 */
async function handleDonationSubmit(e) {
  e.preventDefault();

  if (isDonating) return;

  const form = document.getElementById('donationForm');
  const amountInput = document.getElementById('donationAmount');
  const submitBtn = document.getElementById('submitDonationBtn');

  // 1. Validate donation amount
  const amountVal = amountInput ? amountInput.value.trim() : '';
  const amount = parseFloat(amountVal);

  if (!amountVal || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid donation amount (minimum 0.0001 ETH).', 'error');
    if (amountInput) amountInput.focus();
    return;
  }

  // 2. Require connected wallet
  if (!currentWallet || !currentWallet.address) {
    showToast('Please connect your MetaMask wallet before donating.', 'error');
    await handleConnectWallet();
    return;
  }

  // 3. Require Ethereum Sepolia
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId.toLowerCase() !== '0xaa36a7') {
        showToast('Please switch MetaMask to Ethereum Sepolia to donate.', 'error');
        setWrongNetworkState();
        return;
      }
    } catch (networkErr) {
      console.warn('Network check error:', networkErr);
    }
  }

  // 4. Set loading state & prevent duplicate submissions
  isDonating = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      <span>Confirming in MetaMask...</span>
    `;
  }

  try {
    showToast(`Opening MetaMask to donate ${amount} ETH...`, 'info', 4000);

    // Call donate() from blockchain.js
    const result = await donate(amount);

    console.log('Donation transaction confirmed:', result);

    // Store tx hash in session store
    if (result && result.hash) {
      saveSessionReceipt({
        hash: result.hash,
        donor: currentWallet.address.toLowerCase(),
        amount: String(amount),
        timestamp: Math.floor(Date.now() / 1000)
      });
    }

    // Reset form
    if (form) {
      form.reset();
      form.classList.remove('was-validated');
    }

    const txHash = result.hash;
    const shortTx = shortenAddress(txHash);
    const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;

    showToast(
      `🎉 Donation of ${amount} ETH confirmed on Sepolia! <a href="${etherscanUrl}" target="_blank" rel="noopener noreferrer" class="text-decoration-underline fw-bold text-white">View on Etherscan (${shortTx})</a>`,
      'success',
      10000
    );

    // Refresh live blockchain data
    await loadBlockchainData();

    // Trigger global dashboard refresh callback
    if (onDataChangeCallback) {
      onDataChangeCallback();
    }
  } catch (err) {
    console.error('Donation transaction error:', err);
    handleDonationError(err);
  } finally {
    isDonating = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="me-2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        <span>Donate via MetaMask</span>
      `;
    }
  }
}

/**
 * Load and render real on-chain donation summary and history from the smart contract
 */
export async function loadBlockchainData() {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    // Read contract summary and donation count
    const [summary, count] = await Promise.all([
      getSummary(),
      getDonationCount()
    ]);

    const numTotal = parseFloat(summary.totalDonations);

    // 1. Update Donor Dashboard Stat Cards
    const totalAmountEl = document.getElementById('donor-total-amount');
    if (totalAmountEl) {
      totalAmountEl.textContent = `${numTotal.toFixed(4)} ETH`;
    }

    const totalCountEl = document.getElementById('donor-total-count');
    if (totalCountEl) {
      totalCountEl.textContent = count;
    }

    const historyCountEl = document.getElementById('donor-history-count');
    if (historyCountEl) {
      historyCountEl.textContent = `${count} on-chain records`;
    }

    // 2. Update Header Total Donated stat pill
    const navPoolEl = document.getElementById('nav-live-pool');
    if (navPoolEl) {
      navPoolEl.textContent = `${numTotal.toFixed(4)} ETH`;
    }

    // 3. Update Home Page Stats
    setBlockchainHomeStats(summary, count);

    // 4. Retrieve each on-chain donation record
    const tbody = document.getElementById('donationHistoryBody');
    const emptyState = document.getElementById('donorEmptyState');

    if (count === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('d-none');
    } else {
      if (emptyState) emptyState.classList.add('d-none');

      const sessionReceipts = getSessionReceipts();
      const donationPromises = [];
      for (let i = 0; i < count; i++) {
        donationPromises.push(getDonation(i));
      }

      const donations = await Promise.all(donationPromises);

      if (tbody) {
        // Display in reverse chronological order (newest first)
        tbody.innerHTML = donations
          .map((d, originalIndex) => ({ ...d, originalIndex }))
          .reverse()
          .map((d) => {
            const dateStr = d.timestamp
              ? new Date(d.timestamp * 1000).toLocaleString()
              : 'Recent';
            const shortDonor = shortenAddress(d.donor);
            const donorUrl = `https://sepolia.etherscan.io/address/${d.donor}`;

            // Check if this donation matches a tx submitted during the session
            const matchingSession = sessionReceipts.find(
              (s) =>
                s.donor === d.donor.toLowerCase() &&
                Math.abs(s.timestamp - d.timestamp) < 300
            );

            let recordHtml = '';
            if (matchingSession && matchingSession.hash) {
              const txUrl = `https://sepolia.etherscan.io/tx/${matchingSession.hash}`;
              recordHtml = `
                <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash font-monospace text-emerald text-decoration-none fw-bold" title="View Tx on Sepolia Etherscan: ${matchingSession.hash}">
                  ${shortenAddress(matchingSession.hash)} ↗
                </a>
              `;
            } else {
              recordHtml = `
                <a href="https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}" target="_blank" rel="noopener noreferrer" class="badge badge-emerald-soft text-decoration-none" title="Verified on Sepolia Smart Contract: ${CONTRACT_ADDRESS}">
                  On-Chain (Sepolia) ↗
                </a>
              `;
            }

            return `
              <tr>
                <td><small class="text-muted-custom">${dateStr}</small></td>
                <td>
                  <a href="${donorUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash font-monospace text-navy text-decoration-none" title="View Donor Address: ${d.donor}">
                    ${shortDonor}
                  </a>
                </td>
                <td><strong class="text-emerald">${parseFloat(d.amount).toFixed(4)} ETH</strong></td>
                <td>${recordHtml}</td>
              </tr>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.warn('Could not load on-chain donation data (wallet not connected or wrong network):', err);
  }
}

/**
 * Initialise the donor dashboard: form submission + wallet button + on-chain sync
 * @param {Function} onDataChange - Callback to refresh all dashboards after a donation
 */
export function initDonorDashboard(onDataChange) {
  onDataChangeCallback = onDataChange;

  // Donation form submission handler
  const form = document.getElementById('donationForm');
  if (form) {
    form.addEventListener('submit', handleDonationSubmit);
  }

  // Connect Wallet button handler (MetaMask)
  const walletBtn = document.getElementById('connectWalletBtn');
  if (walletBtn) {
    walletBtn.addEventListener('click', handleConnectWallet);
  }

  // Set initial disconnected UI state on load
  updateWalletUI();

  // Attempt initial read of contract summary if MetaMask is available
  loadBlockchainData();
}

/**
 * Refresh the donor dashboard UI with current data
 */
export function updateDonorDashboard() {
  updateWalletUI();
  loadBlockchainData();
}
