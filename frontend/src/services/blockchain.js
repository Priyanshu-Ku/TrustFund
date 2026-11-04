import {
    BrowserProvider,
    Contract,
    parseEther,
    formatEther,
    isAddress
} from "ethers";

import contractArtifact from "../contracts/DonationTracker.json";

export { isAddress };

// TrustFund smart contract configuration
export const CONTRACT_ADDRESS =
    "0xd27935e718a7bf17cbcbe28c4391380fb9e95cc4";

export const SEPOLIA_CHAIN_ID = 11155111;

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

// Support both a raw ABI array and a complete Remix artifact
const CONTRACT_ABI = Array.isArray(contractArtifact)
    ? contractArtifact
    : contractArtifact.abi;

if (!CONTRACT_ABI) {
    throw new Error("DonationTracker ABI not found.");
}

// Check MetaMask availability
function getEthereum() {
    if (!window.ethereum) {
        throw new Error(
            "MetaMask is not installed. Please install MetaMask."
        );
    }

    return window.ethereum;
}

// Ensure the wallet is connected to Sepolia
async function checkNetwork(ethereum) {
    const chainId = await ethereum.request({
        method: "eth_chainId"
    });

    if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID_HEX) {
        throw new Error(
            "Please switch MetaMask to Ethereum Sepolia."
        );
    }
}

// Connect MetaMask
export async function connectWallet() {
    const ethereum = getEthereum();

    const accounts = await ethereum.request({
        method: "eth_requestAccounts"
    });

    if (!accounts || accounts.length === 0) {
        throw new Error("No wallet account found.");
    }

    await checkNetwork(ethereum);

    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    return {
        address,
        provider,
        signer,
        chainId: SEPOLIA_CHAIN_ID
    };
}

// Get contract with wallet signing permission
export async function getSignerContract() {
    const wallet = await connectWallet();

    const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        wallet.signer
    );

    return {
        ...wallet,
        contract
    };
}

// Read-only contract connection
export async function getReadContract() {
    const ethereum = getEthereum();

    await checkNetwork(ethereum);

    const provider = new BrowserProvider(ethereum);

    return new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
    );
}

// Get financial summary
export async function getSummary() {
    const contract = await getReadContract();

    const result = await contract.getSummary();

    return {
        totalDonations: formatEther(result[0]),
        totalExpenses: formatEther(result[1]),
        pendingExpenses: formatEther(result[2]),
        contractBalance: formatEther(result[3]),
        availableBalance: formatEther(result[4])
    };
}

// Make an ETH donation
export async function donate(amountEth) {
    const { contract } = await getSignerContract();

    const amount = parseEther(String(amountEth));

    if (amount <= 0n) {
        throw new Error("Donation must be greater than zero.");
    }

    const transaction = await contract.donate({
        value: amount
    });

    const receipt = await transaction.wait();

    return {
        hash: transaction.hash,
        receipt
    };
}

// Get total donation count
export async function getDonationCount() {
    const contract = await getReadContract();

    const count = await contract.getDonationCount();

    return Number(count);
}

// Retrieve an individual donation
export async function getDonation(index) {
    const contract = await getReadContract();

    const donation = await contract.getDonation(index);

    return {
        donor: donation.donor,
        amount: formatEther(donation.amount),
        timestamp: Number(donation.timestamp)
    };
}

// Submit expense (NGO administrator)
export async function submitExpense(
    amountEth,
    category,
    description,
    recipient
) {
    const { contract } = await getSignerContract();

    const amount = parseEther(String(amountEth));

    if (amount <= 0n) {
        throw new Error("Expense must be greater than zero.");
    }

    const transaction = await contract.submitExpense(
        amount,
        category,
        description,
        recipient
    );

    return await transaction.wait();
}

// Approve expense
export async function approveExpense(expenseId) {
    const { contract } = await getSignerContract();

    const transaction = await contract.approveExpense(expenseId);

    return await transaction.wait();
}

// Reject expense
export async function rejectExpense(expenseId) {
    const { contract } = await getSignerContract();

    const transaction = await contract.rejectExpense(expenseId);

    return await transaction.wait();
}

// Get expense count
export async function getExpenseCount() {
    const contract = await getReadContract();

    const count = await contract.getExpenseCount();

    return Number(count);
}

// Retrieve an expense record
export async function getExpense(index) {
    const contract = await getReadContract();

    const expense = await contract.getExpense(index);

    return {
        recipient: expense.recipient,
        amount: formatEther(expense.amount),
        category: expense.category,
        description: expense.description,
        submittedAt: Number(expense.submittedAt),
        approvedAt: Number(expense.approvedAt),
        status: Number(expense.status)
    };
}

// Check whether connected wallet is NGO administrator
export async function isAdmin() {
    const { address, contract } = await getSignerContract();

    const adminAddress = await contract.admin();

    return address.toLowerCase() === adminAddress.toLowerCase();
}

// Get registered NGO administrator address
export async function getAdminAddress() {
    const contract = await getReadContract();
    return await contract.admin();
}


// Contract deployment block on Ethereum Sepolia
export const DEPLOYMENT_BLOCK = 12061871;

// Retrieve DonationReceived event logs with actual transaction hashes
export async function getDonationEvents(fromBlock = DEPLOYMENT_BLOCK) {
    try {
        const contract = await getReadContract();
        const filter = contract.filters.DonationReceived();
        return await contract.queryFilter(filter, fromBlock);
    } catch (err) {
        console.warn('Could not query DonationReceived events:', err);
        return [];
    }
}

// Retrieve ExpenseSubmitted event logs with actual transaction hashes
export async function getExpenseEvents(fromBlock = DEPLOYMENT_BLOCK) {
    try {
        const contract = await getReadContract();
        const filter = contract.filters.ExpenseSubmitted();
        return await contract.queryFilter(filter, fromBlock);
    } catch (err) {
        console.warn('Could not query ExpenseSubmitted events:', err);
        return [];
    }
}
