import unittest
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app

class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "success")

    def test_categorize_expense_validation(self):
        res = self.client.post("/api/ai/categorize-expense", json={})
        self.assertEqual(res.status_code, 400)

    def test_chat_validation(self):
        res = self.client.post("/api/ai/chat", json={})
        self.assertEqual(res.status_code, 400)

    def test_report_endpoint_deterministic_fallback(self):
        payload = {
            "campaign_name": "Education for All",
            "contract_address": "0xd27935e718a7bf17cbcbe28c4391380fb9e95cc4",
            "network": "Ethereum Sepolia",
            "total_donations": "0.001 ETH",
            "total_expenses": "0.0002 ETH",
            "pending_expenses": "0 ETH",
            "contract_balance": "0.0008 ETH",
            "available_balance": "0.0008 ETH",
            "fund_utilization_percent": 20.0,
            "donations": [{"id": 0, "amount": "0.001 ETH", "donor": "0x123"}],
            "expenses": [{"id": 0, "category": "Education", "amount": "0.0002 ETH", "status": 1}]
        }
        res = self.client.post("/api/ai/generate-report", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("sections", data["data"])

    def test_budget_planner_endpoint(self):
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
        self.assertEqual(data["total_budget_eth"], "10")
        self.assertEqual(len(data["allocations"]), 5)

if __name__ == "__main__":
    unittest.main()

