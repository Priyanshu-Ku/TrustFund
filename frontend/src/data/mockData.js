/**
 * TrustFund – Mock Data
 * ====================
 * Simulated donation and expense data for Phase 1 development.
 * In Phase 2, this will be replaced by data from Ethereum smart contracts.
 */

// --- Helper: Generate a fake transaction hash ---
export function generateTxHash() {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// --- Helper: Format a date to a readable string ---
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// --- Initial Sample Donations (Demonstration Data) ---
export const initialDonations = [
  {
    id: 1,
    donor: 'Aarav Sharma',
    amount: 0.5,
    message: 'For the children\'s education fund',
    date: '2026-10-15',
    txHash: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'Demonstration Record',
  },
  {
    id: 2,
    donor: 'Priya Patel',
    amount: 1.0,
    message: 'Happy to support this cause!',
    date: '2026-10-20',
    txHash: '0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    status: 'Demonstration Record',
  },
  {
    id: 3,
    donor: 'Rahul Gupta',
    amount: 0.25,
    message: '',
    date: '2026-10-28',
    txHash: '0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
    status: 'Demonstration Record',
  },
  {
    id: 4,
    donor: 'Sneha Reddy',
    amount: 0.75,
    message: 'Education changes lives',
    date: '2026-11-01',
    txHash: '0x4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    status: 'Demonstration Record',
  },
];

// --- Initial Sample Expenses (Demonstration Data) ---
export const initialExpenses = [
  {
    id: 1,
    category: 'Education Supplies',
    amount: 0.3,
    description: 'Textbooks and notebooks for 50 students',
    date: '2026-10-22',
    txHash: '0xaa1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789',
    aiStatus: 'AI Preview – Model Not Connected',
  },
  {
    id: 2,
    category: 'Teacher Salaries',
    amount: 0.5,
    description: 'Monthly salary for 3 teachers – October 2026',
    date: '2026-10-30',
    txHash: '0xbb2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789ab',
    aiStatus: 'AI Preview – Model Not Connected',
  },
  {
    id: 3,
    category: 'Infrastructure',
    amount: 0.2,
    description: 'Classroom roof repair at village school',
    date: '2026-11-02',
    txHash: '0xcc3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcd',
    aiStatus: 'AI Preview – Model Not Connected',
  },
];

// --- Campaign Data ---
export const campaign = {
  name: 'Education for All',
  goal: 10, // ETH
};
