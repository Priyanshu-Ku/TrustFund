import unittest
from decimal import Decimal
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app, ALLOWED_CATEGORIES

class FullVerificationTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_case_1_official_test_scenario(self):
        # Campaign: Education for All
        # Budget: 10 ETH
        # Objective: Funding classroom supplies and teachers for rural students in India.
        # Beneficiaries: 500
        # Priorities: Books, notebooks, school bags, teacher support and classroom improvements.
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "10",
            "objective": "Funding classroom supplies and teachers for rural students in India.",
            "beneficiaries": "500",
            "priorities": "Books, notebooks, school bags, teacher support and classroom improvements.",
            "supported_categories": ALLOWED_CATEGORIES,
            "current_blockchain_summary": {
                "campaignTarget": "10.0 ETH",
                "totalDonations": "0.001 ETH",
                "totalExpenses": "0.0002 ETH",
                "pendingExpenses": "0 ETH",
                "contractBalance": "0.0008 ETH",
                "availableBalance": "0.0008 ETH"
            }
        }
        res = self.client.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        # Verify AI returns supported categories
        for alloc in data["allocations"]:
            self.assertIn(alloc["category"], ALLOWED_CATEGORIES)
            self.assertIn(alloc["priority"], ["High", "Medium", "Low"])
            self.assertTrue(len(alloc["reason"]) > 0)

        # Verify allocation percentages total 100%
        total_pct = sum(a["percentage"] for a in data["allocations"])
        self.assertEqual(total_pct, 100)

        # Verify calculated allocation amounts total exactly 10 ETH
        total_eth = sum(Decimal(a["amount_eth"]) for a in data["allocations"])
        self.assertEqual(total_eth, Decimal("10"))

        # Verify Wei match
        total_wei = sum(int(a["amount_wei"]) for a in data["allocations"])
        self.assertEqual(total_wei, 10 * 10**18)

        print("\n=== Test Scenario: 10 ETH Budget ===")
        print(f"Campaign: {data['campaign_name']}")
        print(f"Summary: {data['summary']}")
        for a in data["allocations"]:
            print(f"- {a['category']}: {a['percentage']}% ({a['amount_eth']} ETH, {a['amount_wei']} Wei) [{a['priority']}] -> {a['reason']}")

    def test_case_2_changing_campaign_budget(self):
        # Changing campaign budget to 15.75 ETH
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "15.75",
            "objective": "Classroom upgrades",
            "beneficiaries": "600",
            "priorities": "Infrastructure & Books",
            "supported_categories": ALLOWED_CATEGORIES
        }
        res = self.client.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        # Total eth should equal exactly 15.75
        total_eth = sum(Decimal(a["amount_eth"]) for a in data["allocations"])
        self.assertEqual(total_eth, Decimal("15.75"))

        expected_wei = int(Decimal("15.75") * Decimal(10**18))
        total_wei = sum(int(a["amount_wei"]) for a in data["allocations"])
        self.assertEqual(total_wei, expected_wei)

        print("\n=== Changed Budget: 15.75 ETH ===")
        for a in data["allocations"]:
            print(f"- {a['category']}: {a['percentage']}% ({a['amount_eth']} ETH)")

    def test_case_3_empty_and_negative_budgets(self):
        res_empty = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": ""})
        self.assertEqual(res_empty.status_code, 400)

        res_neg = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": "-2"})
        self.assertEqual(res_neg.status_code, 400)

        res_zero = self.client.post("/api/ai/plan-budget", json={"total_budget_eth": "0"})
        self.assertEqual(res_zero.status_code, 400)

if __name__ == "__main__":
    unittest.main()

