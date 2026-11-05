import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app


class TestReportEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_invalid_lists(self):
        res = self.client.post("/api/ai/generate-report", json={
            "donations": "not a list",
            "expenses": []
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")

    @patch("app.generate_ai_response")
    def test_successful_report_generation(self, mock_ai):
        mock_ai_json = {
            "executive_summary": "The campaign has received 0.001 ETH with 0.0002 ETH spent and 0.0008 ETH remaining.",
            "campaign_overview": "Education for All is managed transparently on Ethereum Sepolia.",
            "donation_summary": "One verified on-chain donation of 0.001 ETH was recorded.",
            "expense_summary": "One expense of 0.0002 ETH was approved with ETH transferred, and one expense of 0.0001 ETH was rejected.",
            "fund_utilization": "Fund utilization stands at approximately 20.0%, reflecting disciplined capital deployment.",
            "remaining_balance": "The smart contract maintains a liquid reserve of 0.0008 ETH ready for allocation.",
            "transaction_overview": "All ledger records are cryptographically verified via Sepolia event logs.",
            "financial_observations": "Zero pending claims remain. Test ETH has no real monetary value."
        }
        mock_ai.return_value = json.dumps(mock_ai_json)

        payload = {
            "campaign_name": "Education for All",
            "contract_address": "0xd27935e718a7bf17cbcbe28c4391380fb9e95cc4",
            "network": "Ethereum Sepolia (Chain ID 11155111)",
            "total_donations": "0.001 ETH",
            "total_expenses": "0.0002 ETH",
            "pending_expenses": "0 ETH",
            "contract_balance": "0.0008 ETH",
            "available_balance": "0.0008 ETH",
            "fund_utilization_percent": 20.0,
            "donations": [
                {
                    "index": 0,
                    "donor": "0x1234...5678",
                    "amount": "0.001 ETH",
                    "timestamp": "11/4/2026, 8:45:00 PM"
                }
            ],
            "expenses": [
                {
                    "id": 0,
                    "recipient": "0x9876...4321",
                    "amount": "0.0002 ETH",
                    "category": "Education",
                    "description": "School textbooks and notebooks",
                    "status": "Approved (ETH Transferred)",
                    "statusCode": 1
                },
                {
                    "id": 1,
                    "recipient": "0x5555...1111",
                    "amount": "0.0001 ETH",
                    "category": "Transportation",
                    "description": "Unverified travel request",
                    "status": "Rejected (Funds Retained)",
                    "statusCode": 2
                }
            ]
        }

        res = self.client.post("/api/ai/generate-report", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        report = data["data"]
        self.assertEqual(report["campaign_name"], "Education for All")
        self.assertEqual(report["financial_summary"]["total_donations"], "0.001 ETH")
        self.assertEqual(report["financial_summary"]["total_expenses"], "0.0002 ETH")
        self.assertEqual(report["financial_summary"]["contract_balance"], "0.0008 ETH")
        self.assertEqual(report["financial_summary"]["available_balance"], "0.0008 ETH")
        self.assertEqual(report["financial_summary"]["fund_utilization_percent"], 20.0)

        # Check all 8 sections
        expected_sections = [
            "executive_summary",
            "campaign_overview",
            "donation_summary",
            "expense_summary",
            "fund_utilization",
            "remaining_balance",
            "transaction_overview",
            "financial_observations"
        ]
        for section in expected_sections:
            self.assertIn(section, report["sections"])
            self.assertTrue(len(report["sections"][section]) > 0)

        # Verify prompt instructions passed to Gemini
        prompt_arg = mock_ai.call_args[0][0]
        self.assertIn("Education for All", prompt_arg)
        self.assertIn("0.001 ETH", prompt_arg)
        self.assertIn("0.0002 ETH", prompt_arg)
        self.assertIn("0.0008 ETH", prompt_arg)
        self.assertIn("Non-Proof of Real-World Delivery", prompt_arg)
        self.assertIn("Non-Audit Disclaimer", prompt_arg)


if __name__ == "__main__":
    unittest.main()

