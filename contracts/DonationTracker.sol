
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DonationTracker {

    // Expense status
    enum ExpenseStatus {
        Pending,
        Approved,
        Rejected
    }

    // Donation information
    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
    }

    // Expense information
    struct Expense {
        address payable recipient;
        uint256 amount;
        string category;
        string description;
        uint256 submittedAt;
        uint256 approvedAt;
        ExpenseStatus status;
    }

    // NGO administrator
    address public immutable admin;

    // Financial summaries (all amounts are in wei)
    uint256 public totalDonations;
    uint256 public totalExpenses;
    uint256 public totalPendingExpenses;

    // Transaction records
    Donation[] private donations;
    Expense[] private expenses;

    // Simple reentrancy protection
    uint256 private lock = 1;

    // Events
    event DonationReceived(
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );

    event ExpenseSubmitted(
        uint256 indexed expenseId,
        address indexed recipient,
        uint256 amount,
        string category
    );

    event ExpenseApproved(
        uint256 indexed expenseId,
        address indexed recipient,
        uint256 amount
    );

    event ExpenseRejected(
        uint256 indexed expenseId
    );

    // Access control
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only NGO admin can perform this action");
        _;
    }

    // Reentrancy protection
    modifier nonReentrant() {
        require(lock == 1, "Reentrant call detected");
        lock = 2;
        _;
        lock = 1;
    }

    // Constructor: deployer becomes admin
    constructor() {
        admin = msg.sender;
    }

    // 1. Donate ETH to the campaign
    function donate() external payable {
        require(msg.value > 0, "Donation must be greater than zero");

        donations.push(
            Donation({
                donor: msg.sender,
                amount: msg.value,
                timestamp: block.timestamp
            })
        );

        totalDonations += msg.value;

        emit DonationReceived(
            msg.sender,
            msg.value,
            block.timestamp
        );
    }

    // 2. Submit a new expense for review
    function submitExpense(
        uint256 amount,
        string calldata category,
        string calldata description,
        address payable recipient
    ) external onlyAdmin returns (uint256 expenseId) {

        require(amount > 0, "Expense must be greater than zero");
        require(recipient != address(0), "Invalid recipient address");
        require(bytes(category).length > 0, "Category is required");
        require(bytes(category).length <= 40, "Category too long");
        require(bytes(description).length > 0, "Description is required");
        require(bytes(description).length <= 200, "Description too long");

        uint256 availableBalance =
            address(this).balance - totalPendingExpenses;

        require(
            amount <= availableBalance,
            "Insufficient available donation funds"
        );

        expenseId = expenses.length;

        expenses.push(
            Expense({
                recipient: recipient,
                amount: amount,
                category: category,
                description: description,
                submittedAt: block.timestamp,
                approvedAt: 0,
                status: ExpenseStatus.Pending
            })
        );

        totalPendingExpenses += amount;

        emit ExpenseSubmitted(
            expenseId,
            recipient,
            amount,
            category
        );
    }

    // 3. Approve expense and transfer ETH
    function approveExpense(
        uint256 expenseId
    ) external onlyAdmin nonReentrant {

        require(expenseId < expenses.length, "Invalid expense ID");

        Expense storage expense = expenses[expenseId];

        require(
            expense.status == ExpenseStatus.Pending,
            "Expense is not pending"
        );

        uint256 amount = expense.amount;
        address payable recipient = expense.recipient;

        // Update state before making external transfer
        totalPendingExpenses -= amount;
        totalExpenses += amount;

        expense.status = ExpenseStatus.Approved;
        expense.approvedAt = block.timestamp;

        // Transfer approved ETH to recipient
        (bool success, ) = recipient.call{value: amount}("");

        require(success, "ETH transfer failed");

        emit ExpenseApproved(
            expenseId,
            recipient,
            amount
        );
    }

    // 4. Reject expense
    function rejectExpense(
        uint256 expenseId
    ) external onlyAdmin {

        require(expenseId < expenses.length, "Invalid expense ID");

        Expense storage expense = expenses[expenseId];

        require(
            expense.status == ExpenseStatus.Pending,
            "Expense is not pending"
        );

        expense.status = ExpenseStatus.Rejected;

        totalPendingExpenses -= expense.amount;

        emit ExpenseRejected(expenseId);
    }

    // 5. Get donation count
    function getDonationCount() external view returns (uint256) {
        return donations.length;
    }

    // 6. Get individual donation
    function getDonation(
        uint256 index
    ) external view returns (Donation memory) {

        require(index < donations.length, "Invalid donation index");

        return donations[index];
    }

    // 7. Get expense count
    function getExpenseCount() external view returns (uint256) {
        return expenses.length;
    }

    // 8. Get individual expense
    function getExpense(
        uint256 index
    ) external view returns (Expense memory) {

        require(index < expenses.length, "Invalid expense index");

        return expenses[index];
    }

    // 9. Get remaining funds available for new expenses
    function getAvailableBalance() public view returns (uint256) {
        return address(this).balance - totalPendingExpenses;
    }

    // 10. Get complete financial summary
    function getSummary()
        external
        view
        returns (
            uint256 donationsReceived,
            uint256 expensesPaid,
            uint256 pendingExpenses,
            uint256 contractBalance,
            uint256 availableBalance
        )
    {
        return (
            totalDonations,
            totalExpenses,
            totalPendingExpenses,
            address(this).balance,
            getAvailableBalance()
        );
    }
}
