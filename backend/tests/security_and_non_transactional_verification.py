"""
TrustFund – Security and Non-Transactional Verification Suite
============================================================
Comprehensive test suite verifying:
1. Frontend non-transactional isolation (budgetPlanner.js).
2. Backend non-transactional isolation (app.py & gemini_service.py).
3. Read-only blockchain integration (no signing, no gas, no state modification).
4. Zero eth_sendTransaction / eth_sendRawTransaction generation.
5. Mathematical precision and deterministic Wei arithmetic.
6. Input validation and edge-case handling.
"""

import unittest
import json
import re
from decimal import Decimal, InvalidOperation
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app, ALLOWED_CATEGORIES, generate_deterministic_budget_plan

class SecurityAndNonTransactionalVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        cls.project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cls.frontend_bp_path = os.path.join(cls.project_root, "Frontend", "src", "modules", "budgetPlanner.js")
        cls.frontend_blockchain_path = os.path.join(cls.project_root, "Frontend", "src", "services", "blockchain.js")
        cls.backend_app_path = os.path.join(cls.project_root, "backend", "app.py")
        cls.backend_gemini_path = os.path.join(cls.project_root, "backend", "services", "gemini_service.py")

    # =========================================================================
    # 1. FRONTEND NON-TRANSACTIONAL VERIFICATION
    # =========================================================================
    def test_01_frontend_code_inspection_forbidden_methods(self):
        """Verify frontend budgetPlanner.js does not contain or call any transactional or signing methods."""
        with open(self.frontend_bp_path, "r", encoding="utf-8") as f:
            content = f.read()

        forbidden_tokens = [
            "connectWallet",
            "getSignerContract",
            "donate",
            "submitExpense",
            "approveExpense",
            "rejectExpense",
            "eth_sendTransaction",
            "eth_sendRawTransaction",
            "sendTransaction",
            "signer.sign",
            "privateKey",
            "private_key"
        ]

        for token in forbidden_tokens:
            pattern = rf"\b{re.escape(token)}\b"
            matches = re.findall(pattern, content)
            self.assertEqual(
                len(matches), 0,
                f"Security Violation: Forbidden transactional token '{token}' found in budgetPlanner.js!"
            )

    def test_02_frontend_api_endpoints_called(self):
        """Verify frontend budgetPlanner.js only contacts the designated Flask endpoint."""
        with open(self.frontend_bp_path, "r", encoding="utf-8") as f:
            content = f.read()

        url_matches = re.findall(r"fetch\s*\(\s*([^,\)]+)", content)
        self.assertEqual(len(url_matches), 1, "Expected exactly 1 fetch call in budgetPlanner.js")
        self.assertIn("BACKEND_BUDGET_URL", url_matches[0])
        self.assertIn("http://127.0.0.1:5000/api/ai/plan-budget", content)

    # =========================================================================
    # 2. BACKEND NON-TRANSACTIONAL VERIFICATION
    # =========================================================================
    def test_03_backend_has_no_wallet_or_ethereum_signing_libraries(self):
        """Verify backend does not import or use web3, eth_account, or any transaction signer."""
        for file_path in [self.backend_app_path, self.backend_gemini_path]:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            forbidden_backend_tokens = [
                "web3",
                "eth_account",
                "Account.from_key",
                "send_raw_transaction",
                "send_transaction",
                "transact",
                "build_transaction",
                "sign_transaction",
                "private_key",
                "PRIVATE_KEY"
            ]

            for token in forbidden_backend_tokens:
                pattern = rf"\b{re.escape(token)}\b"
                matches = re.findall(pattern, content)
                self.assertEqual(
                    len(matches), 0,
                    f"Security Violation: Forbidden blockchain writing token '{token}' in {os.path.basename(file_path)}!"
                )

    # =========================================================================
    # 3. BLOCKCHAIN READ-ONLY VERIFICATION
    # =========================================================================
    def test_04_blockchain_service_get_summary_is_read_only(self):
        """Verify getSummary() in blockchain.js uses getReadContract() which uses Provider, not Signer."""
        with open(self.frontend_blockchain_path, "r", encoding="utf-8") as f:
            content = f.read()

        # getSummary must call getReadContract
        get_summary_match = re.search(r"export async function getSummary\(\)\s*\{([\s\S]*?)\}", content)
        self.assertIsNotNone(get_summary_match, "getSummary function not found in blockchain.js")
        summary_body = get_summary_match.group(1)
        self.assertIn("getReadContract()", summary_body)
        self.assertNotIn("getSignerContract()", summary_body)
        self.assertNotIn("connectWallet()", summary_body)

        # getReadContract must use BrowserProvider, NOT signer
        get_read_contract_match = re.search(r"export async function getReadContract\(\)\s*\{([\s\S]*?)\}", content)
        self.assertIsNotNone(get_read_contract_match, "getReadContract function not found in blockchain.js")
        read_body = get_read_contract_match.group(1)
        self.assertIn("BrowserProvider", read_body)
        self.assertNotIn("signer", read_body.lower())

    # =========================================================================
    # 4. GEMINI API REQUEST VERIFICATION
    # =========================================================================
    def test_05_gemini_prompt_forbids_calculating_authoritative_eth_amounts(self):
        """Verify prompt explicitly forbids Gemini from calculating ETH amounts and mandates supported categories."""
        with open(self.backend_app_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("Do NOT calculate or return ETH or Wei amounts in your output", content)
        self.assertIn("Every single allocation MUST use ONLY one of the authorized categories", content)
        self.assertIn("The sum of percentages across all allocations MUST equal EXACTLY 100", content)

    # =========================================================================
    # 5. INPUT VALIDATION TESTS (REJECTION OF INVALID INPUTS)
    # =========================================================================
    def test_06_reject_empty_budget(self):
        """Verify empty budget is rejected with HTTP 400."""
        res = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": ""})
        self.assertEqual(res.status_code, 400)
        self.assertIn("required", res.get_json()["message"].lower())

    def test_07_reject_zero_and_negative_budget(self):
        """Verify zero or negative budgets are rejected with HTTP 400."""
        for val in ["0", 0, "-1", "-0.0001", "-100"]:
            res = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": val})
            self.assertEqual(res.status_code, 400, f"Expected 400 for budget {val}")
            self.assertIn("greater than zero", res.get_json()["message"].lower())

    def test_08_reject_non_numeric_budget(self):
        """Verify standard non-numeric string budget is rejected with HTTP 400."""
        for val in ["abc", "10eth", "--5", "five", "$100"]:
            res = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": val})
            self.assertEqual(res.status_code, 400, f"Expected 400 for non-numeric {val}")
            self.assertIn("valid positive number", res.get_json()["message"].lower())

    def test_09_reject_budget_exceeding_18_decimal_places(self):
        """Verify budget with more than 18 decimal places (exceeding 1 Wei precision) is rejected."""
        res = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": "0.1234567890123456789"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot exceed 18 decimal places", res.get_json()["message"].lower())

    # =========================================================================
    # 6. BUDGET ARITHMETIC & DETERMINISTIC WEI PRECISION TESTS
    # =========================================================================
    def test_10_exact_budget_arithmetic_10_eth(self):
        """Verify 10 ETH standard test scenario: sum of percentages = 100%, sum of Wei = exact 10 ETH Wei."""
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "10",
            "objective": "Funding classroom supplies and teachers for rural students in India.",
            "beneficiaries": "500",
            "priorities": "Books, notebooks, school bags, teacher support and classroom improvements."
        }
        res = self.client.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        allocations = data["allocations"]
        self.assertTrue(len(allocations) > 0)

        # 1. Percentages total 100%
        pct_sum = sum(a["percentage"] for a in allocations)
        self.assertEqual(pct_sum, 100, "Percentages must sum to exactly 100%")

        # 2. Allocation amounts total proposed budget in Wei
        expected_wei = 10 * (10 ** 18)
        wei_sum = sum(int(a["amount_wei"]) for a in allocations)
        self.assertEqual(wei_sum, expected_wei, "Calculated Wei amounts must sum to exact total budget Wei")

        # 3. Allocation amounts total proposed budget in ETH
        eth_sum = sum(Decimal(a["amount_eth"]) for a in allocations)
        self.assertEqual(eth_sum, Decimal("10"), "Calculated ETH amounts must sum to exactly 10 ETH")

        # 4. Categories must be supported categories
        for a in allocations:
            self.assertIn(a["category"], ALLOWED_CATEGORIES)
            self.assertIn(a["priority"], ["High", "Medium", "Low"])

    def test_11_exact_budget_arithmetic_fractional_odd_budgets(self):
        """Verify exact Wei arithmetic across arbitrary fractional and small budgets."""
        test_budgets = ["0.0001", "0.001", "1.234567", "3.333333333333333333", "25.5", "100.0"]

        for b_str in test_budgets:
            payload = {
                "campaign_name": "Education for All",
                "total_budget_eth": b_str,
                "objective": "Test fractional budgets",
                "beneficiaries": "100",
                "priorities": "Supplies"
            }
            res = self.client.post("/api/ai/plan-budget", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]

            allocs = data["allocations"]
            pct_sum = sum(a["percentage"] for a in allocs)
            self.assertEqual(pct_sum, 100)

            expected_wei = int(Decimal(b_str) * (Decimal(10) ** 18))
            wei_sum = sum(int(a["amount_wei"]) for a in allocs)
            self.assertEqual(wei_sum, expected_wei, f"Wei sum failed for budget {b_str}")

            eth_sum = sum(Decimal(a["amount_eth"]) for a in allocs)
            self.assertEqual(eth_sum, Decimal(b_str), f"ETH sum failed for budget {b_str}")

    # =========================================================================
    # 7. SECURITY / DISCLAIMER & SEPARATION OF BALANCES
    # =========================================================================
    def test_12_disclaimer_and_accuracy_labels_present(self):
        """Verify required accuracy disclaimer is returned in the API payload."""
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "10",
            "objective": "Classroom supplies",
            "beneficiaries": "500",
            "priorities": "Books"
        }
        res = self.client.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertIn("disclaimer", data)
        disclaimer = data["disclaimer"]
        self.assertIn("AI-generated budget recommendation", disclaimer)
        self.assertIn("subject to administrator review", disclaimer)
        self.assertIn("Sepolia test ETH has no real monetary value", disclaimer)

if __name__ == "__main__":
    unittest.main()
