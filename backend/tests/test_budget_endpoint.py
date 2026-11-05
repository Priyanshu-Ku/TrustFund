import unittest
import json
from decimal import Decimal
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app, ALLOWED_CATEGORIES, generate_deterministic_budget_plan

class TestBudgetPlanner(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_missing_budget(self):
        res = self.app.post("/api/ai/plan-budget", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("required", data["message"].lower())

    def test_negative_and_zero_budget(self):
        res = self.app.post("/api/ai/plan-budget", json={"total_budget_eth": "0"})
        self.assertEqual(res.status_code, 400)

        res2 = self.app.post("/api/ai/plan-budget", json={"total_budget_eth": "-5.5"})
        self.assertEqual(res2.status_code, 400)

    def test_nan_infinity_and_non_finite_budgets(self):
        """Verify NaN, Infinity, -Infinity, zero, and negative values return HTTP 400."""
        invalid_budgets = ["NaN", "nan", "Infinity", "infinity", "-Infinity", "-infinity", "0", 0, "-1", "-5.5"]
        for val in invalid_budgets:
            res = self.app.post("/api/ai/plan-budget", json={"total_budget_eth": val})
            self.assertEqual(
                res.status_code, 400,
                f"Expected HTTP 400 for invalid budget '{val}', got {res.status_code}"
            )
            data = res.get_json()
            self.assertEqual(data["status"], "error")

    def test_invalid_decimal_precision(self):
        # 19 decimal places
        res = self.app.post("/api/ai/plan-budget", json={"total_budget_eth": "1.0000000000000000001"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("18 decimal places", res.get_json()["message"])

    def test_deterministic_budget_generation(self):
        plan = generate_deterministic_budget_plan(
            campaign_name="Education for All",
            budget_dec=Decimal("10"),
            objective="Funding classroom supplies and teachers for rural students in India.",
            beneficiaries="500",
            priorities="Books, notebooks, school bags, teacher support and classroom improvements.",
            supported_categories=ALLOWED_CATEGORIES
        )
        self.assertEqual(plan["campaign_name"], "Education for All")
        pct_sum = sum(a["percentage"] for a in plan["allocations"])
        self.assertEqual(pct_sum, 100)
        for a in plan["allocations"]:
            self.assertIn(a["category"], ALLOWED_CATEGORIES)
            self.assertIn(a["priority"], ["High", "Medium", "Low"])

    def test_full_plan_endpoint_calculation_math(self):
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "10",
            "objective": "Funding classroom supplies and teachers for rural students in India.",
            "beneficiaries": "500",
            "priorities": "Books, notebooks, school bags, teacher support and classroom improvements.",
            "supported_categories": ALLOWED_CATEGORIES,
            "current_blockchain_summary": {
                "totalDonations": "0.001 ETH",
                "totalExpenses": "0.0002 ETH",
                "pendingExpenses": "0 ETH",
                "contractBalance": "0.0008 ETH",
                "availableBalance": "0.0008 ETH"
            }
        }
        res = self.app.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        plan = data["data"]
        self.assertEqual(plan["campaign_name"], "Education for All")
        self.assertEqual(plan["total_budget_eth"], "10")
        expected_wei = 10 * 10**18
        self.assertEqual(int(plan["total_budget_wei"]), expected_wei)

        allocations = plan["allocations"]
        self.assertTrue(len(allocations) > 0)

        # Verify percentages sum to exactly 100%
        pct_sum = sum(a["percentage"] for a in allocations)
        self.assertEqual(pct_sum, 100)

        # Verify Wei amounts sum to exactly total_budget_wei
        wei_sum = sum(int(a["amount_wei"]) for a in allocations)
        self.assertEqual(wei_sum, expected_wei)

        # Verify ETH amounts sum to exactly 10 ETH
        eth_sum = sum(Decimal(a["amount_eth"]) for a in allocations)
        self.assertEqual(eth_sum, Decimal("10"))

        # Verify no unauthorized categories
        for a in allocations:
            self.assertIn(a["category"], ALLOWED_CATEGORIES)
            self.assertIn(a["priority"], ["High", "Medium", "Low"])
            self.assertTrue(len(a["reason"]) > 0)

    def test_arbitrary_odd_budget_math(self):
        # 3.333333333333333333 ETH
        payload = {
            "campaign_name": "Education for All",
            "total_budget_eth": "3.333333333333333333",
            "objective": "Classroom supplies",
            "beneficiaries": "200",
            "priorities": "Stationery"
        }
        res = self.app.post("/api/ai/plan-budget", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        plan = data["data"]
        expected_wei = int(Decimal("3.333333333333333333") * (Decimal(10) ** 18))
        self.assertEqual(int(plan["total_budget_wei"]), expected_wei)

        wei_sum = sum(int(a["amount_wei"]) for a in plan["allocations"])
        self.assertEqual(wei_sum, expected_wei)

if __name__ == "__main__":
    unittest.main()

