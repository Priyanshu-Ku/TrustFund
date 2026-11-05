/**
 * TrustFund – AI Donor Chatbot Module
 * =====================================
 * Implements real-time Q&A assistant powered by Gemini 3.6 Flash.
 * Queries live on-chain data from Ethereum Sepolia smart contract
 * and provides verified, transparent answers to donors.
 */

import {
  getSummary,
  getDonationCount,
  getDonation,
  getExpenseCount,
  getExpense,
  cleanEthString,
  formatEthWei,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID
} from '../services/blockchain.js';
import { shortenAddress } from './donorDashboard.js';

const EXPENSE_STATUS_LABELS = {
  0: 'Pending (Under Review)',
  1: 'Approved (Funds Disbursed)',
  2: 'Rejected (Funds Returned)'
};

const BACKEND_CHAT_URL = 'http://127.0.0.1:5000/api/ai/chat';

/**
 * Fetch a fresh snapshot of on-chain state to send as ground truth to Gemini.
 */
export async function fetchBlockchainContext() {
  try {
    const summary = await getSummary();
    const donationCount = await getDonationCount();
    const expenseCount = await getExpenseCount();

    // Fetch up to 15 recent donations
    const recentDonations = [];
    const donationLimit = Math.min(donationCount, 15);
    const donationStart = Math.max(0, donationCount - donationLimit);
    for (let i = donationStart; i < donationCount; i++) {
      try {
        const d = await getDonation(i);
        recentDonations.push({
          index: i,
          donor: shortenAddress(d.donor),
          amountETH: `${cleanEthString(d.amount)} ETH`,
          timestamp: d.timestamp ? new Date(d.timestamp * 1000).toLocaleString() : 'N/A'
        });
      } catch (e) {
        console.warn(`Could not fetch donation record #${i}:`, e);
      }
    }

    // Fetch up to 15 recent expenses
    const recentExpenses = [];
    const expenseLimit = Math.min(expenseCount, 15);
    const expenseStart = Math.max(0, expenseCount - expenseLimit);
    for (let i = expenseStart; i < expenseCount; i++) {
      try {
        const exp = await getExpense(i);
        recentExpenses.push({
          id: i,
          recipient: shortenAddress(exp.recipient),
          amountETH: `${cleanEthString(exp.amount)} ETH`,
          category: exp.category,
          description: exp.description,
          statusCode: exp.status,
          status: EXPENSE_STATUS_LABELS[exp.status] || `Status ${exp.status}`,
          submittedAt: exp.submittedAt ? new Date(exp.submittedAt * 1000).toLocaleString() : 'N/A',
          approvedAt: exp.approvedAt > 0 ? new Date(exp.approvedAt * 1000).toLocaleString() : null
        });
      } catch (e) {
        console.warn(`Could not fetch expense record #${i}:`, e);
      }
    }

    // Preformatted, authoritative values with unnecessary trailing zeros stripped
    const formattedTotalDonations = `${cleanEthString(summary.totalDonations)} ETH`;
    const formattedTotalExpenses = `${cleanEthString(summary.totalExpenses)} ETH`;
    const formattedPendingExpenses = `${cleanEthString(summary.pendingExpenses)} ETH`;
    const formattedContractBalance = `${cleanEthString(summary.contractBalance)} ETH`;
    const formattedAvailableBalance = `${cleanEthString(summary.availableBalance)} ETH`;

    return {
      network: 'Ethereum Sepolia (Chain ID 11155111)',
      contractAddress: CONTRACT_ADDRESS,
      totalDonations: formattedTotalDonations,
      totalExpensesPaid: formattedTotalExpenses,
      pendingExpenses: formattedPendingExpenses,
      contractBalance: formattedContractBalance,
      availableBalance: formattedAvailableBalance,
      authoritativeNotice: 'All financial figures are preformatted authoritative on-chain values calculated with BigInt Wei precision. Do not recalculate, recompute, or estimate.',
      totalDonationCount: donationCount,
      totalExpenseCount: expenseCount,
      recentDonations,
      expenses: recentExpenses
    };
  } catch (err) {
    console.warn('Failed to retrieve full live blockchain context:', err);
    return {
      network: 'Ethereum Sepolia',
      contractAddress: CONTRACT_ADDRESS,
      warning: 'Live contract read failed or wallet is not connected. General contract details only.',
      error: err.message
    };
  }
}

/**
 * Cleans floating-point arithmetic artifacts and trailing zeros from AI text.
 * e.g. "0.0008000000000000005 ETH" -> "0.0008 ETH"
 */
export function cleanPrecisionArtifacts(text) {
  if (!text || typeof text !== 'string') return '';
  // Fix float precision overflow artifacts e.g. 0.0008000000000000005 -> 0.0008
  let cleaned = text.replace(/(\d+\.\d*?[1-9])0{5,}\d+/g, '$1');
  // Fix float precision underflow artifacts e.g. 0.0007999999999999999 -> 0.0008
  cleaned = cleaned.replace(/\d+\.\d*?(?:09{5,}\d*|9{5,}\d*)/g, (match) => {
    const val = parseFloat(match);
    if (!isNaN(val)) {
      return cleanEthString(val.toFixed(8));
    }
    return match;
  });
  return cleaned;
}

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Lightweight safe Markdown-to-HTML formatter for chat responses.
 */
function formatMarkdown(text) {
  if (!text) return '';

  let html = escapeHTML(text);

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bullet points
  const lines = html.split('\n');
  let inList = false;
  const processedLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul class="chatbot-list mb-2 ps-3">');
        inList = true;
      }
      processedLines.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }

  if (inList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('<br>');
  // Clean up excessive <br> around lists
  html = html.replace(/<br><ul/g, '<ul').replace(/<\/ul><br>/g, '</ul>');

  return html;
}

/**
 * Appends a message bubble into the chat messages container.
 */
function appendMessage(sender, text, isHtml = false) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message chat-message-${sender} mb-3 d-flex flex-column ${
    sender === 'user' ? 'align-items-end' : 'align-items-start'
  }`;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${sender}`;

  if (isHtml) {
    bubble.innerHTML = text;
  } else {
    bubble.innerHTML = formatMarkdown(text);
  }

  msgDiv.appendChild(bubble);

  // Add small timestamp
  const timeDiv = document.createElement('span');
  timeDiv.className = 'chat-time text-muted small mt-1';
  timeDiv.style.fontSize = '0.68rem';
  timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  msgDiv.appendChild(timeDiv);

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * Shows an animated typing indicator bubble.
 */
function showTypingIndicator() {
  const container = document.getElementById('chatbotMessages');
  if (!container) return null;

  const indicatorId = 'typingIndicator_' + Date.now();
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message chat-message-assistant mb-3 d-flex flex-column align-items-start';
  msgDiv.id = indicatorId;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-assistant typing-bubble d-flex align-items-center gap-1 py-2 px-3';
  bubble.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  return indicatorId;
}

/**
 * Removes the typing indicator bubble.
 */
function removeTypingIndicator(indicatorId) {
  if (!indicatorId) return;
  const el = document.getElementById(indicatorId);
  if (el) el.remove();
}

/**
 * Sends a question to the Flask backend with fresh blockchain context.
 */
export async function sendChatMessage(question) {
  if (!question || !question.trim()) return;

  const cleanQuestion = question.trim();
  appendMessage('user', cleanQuestion, false);

  // Clear suggestions after first interaction
  const suggestionsBox = document.getElementById('chatbotSuggestions');
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
  }

  const indicatorId = showTypingIndicator();

  try {
    // 1. Fetch fresh on-chain data
    const blockchainContext = await fetchBlockchainContext();

    // 2. Post to Flask AI endpoint
    const response = await fetch(BACKEND_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: cleanQuestion,
        blockchain_context: blockchainContext
      })
    });

    const data = await response.json();
    removeTypingIndicator(indicatorId);

    if (!response.ok || data.status !== 'success') {
      const errorMsg = data.message || 'Error communicating with TrustFund AI.';
      appendMessage('assistant', `⚠️ **AI Service Notice**: ${errorMsg}`);
      return;
    }

    const cleanedAnswer = cleanPrecisionArtifacts(data.answer);
    appendMessage('assistant', cleanedAnswer, false);
  } catch (err) {
    removeTypingIndicator(indicatorId);
    console.error('Chat error:', err);
    appendMessage(
      'assistant',
      `⚠️ **Unable to connect to TrustFund AI Backend** at \`${BACKEND_CHAT_URL}\`.\n\nPlease verify that the Python Flask server is running (\`python backend/app.py\`).`
    );
  }
}

/**
 * Initialize chatbot event listeners and controls.
 */
export function initChatbot() {
  const toggleBtn = document.getElementById('chatbotToggleBtn');
  const panel = document.getElementById('chatbotPanel');
  const closeBtn = document.getElementById('chatbotCloseBtn');
  const clearBtn = document.getElementById('chatbotClearBtn');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const suggestions = document.querySelectorAll('.btn-suggestion-pill');

  if (!toggleBtn || !panel) {
    console.warn('Chatbot elements not found in DOM.');
    return;
  }

  // Toggle Chatbot Panel
  const toggleChat = () => {
    const isHidden = panel.classList.contains('d-none');
    if (isHidden) {
      panel.classList.remove('d-none');
      toggleBtn.classList.add('active');
      const openIcon = toggleBtn.querySelector('.chatbot-toggle-icon');
      const closeIcon = toggleBtn.querySelector('.chatbot-toggle-close');
      if (openIcon) openIcon.classList.add('d-none');
      if (closeIcon) closeIcon.classList.remove('d-none');
      setTimeout(() => {
        if (input) input.focus();
      }, 150);
    } else {
      panel.classList.add('d-none');
      toggleBtn.classList.remove('active');
      const openIcon = toggleBtn.querySelector('.chatbot-toggle-icon');
      const closeIcon = toggleBtn.querySelector('.chatbot-toggle-close');
      if (openIcon) openIcon.classList.remove('d-none');
      if (closeIcon) closeIcon.classList.add('d-none');
    }
  };

  toggleBtn.addEventListener('click', toggleChat);

  if (closeBtn) {
    closeBtn.addEventListener('click', toggleChat);
  }

  // Clear chat history
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const container = document.getElementById('chatbotMessages');
      if (container) {
        container.innerHTML = `
          <div class="chat-message chat-message-assistant mb-3 d-flex flex-column align-items-start">
            <div class="chat-bubble chat-bubble-assistant">
              <p class="mb-2">
                👋 <strong>TrustFund AI Assistant Ready!</strong>
              </p>
              <p class="mb-0 small text-muted-custom">
                Chat history cleared. Powered by <strong>Gemini 3.6 Flash</strong> and live Ethereum Sepolia records. Ask me anything!
              </p>
            </div>
          </div>
          <div class="chatbot-suggestions mb-2" id="chatbotSuggestions">
            <span class="small text-muted d-block mb-1 fw-semibold">Suggested Questions:</span>
            <div class="d-flex flex-wrap gap-1">
              <button class="btn btn-suggestion-pill btn-sm" data-question="How much money has been donated?">
                How much money has been donated?
              </button>
              <button class="btn btn-suggestion-pill btn-sm" data-question="How much money has been spent?">
                How much money has been spent?
              </button>
              <button class="btn btn-suggestion-pill btn-sm" data-question="Which expenses were rejected?">
                Which expenses were rejected?
              </button>
              <button class="btn btn-suggestion-pill btn-sm" data-question="What is the remaining balance?">
                What is the remaining balance?
              </button>
            </div>
          </div>
        `;
        // Reattach suggestion pill listeners
        attachSuggestionListeners();
      }
    });
  }

  // Suggestion pill click handlers
  function attachSuggestionListeners() {
    document.querySelectorAll('.btn-suggestion-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const question = pill.getAttribute('data-question');
        if (question) {
          sendChatMessage(question);
        }
      });
    });
  }
  attachSuggestionListeners();

  // Form submission
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value;
      if (text && text.trim()) {
        input.value = '';
        sendChatMessage(text);
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('d-none')) {
      toggleChat();
    }
  });

  console.log('🤖 TrustFund AI Donor Chatbot initialised.');
}

