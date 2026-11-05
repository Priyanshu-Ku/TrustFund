import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

# Ensure backend root is on sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app

class TestChatEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_missing_question(self):
        res = self.client.post("/api/ai/chat", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("Question is required", data["message"])

    def test_empty_question(self):
        res = self.client.post("/api/ai/chat", json={"question": "   "})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")

    def test_invalid_blockchain_context(self):
        res = self.client.post("/api/ai/chat", json={
            "question": "How much money was donated?",
            "blockchain_context": "not an object"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("must be an object", data["message"])

    @patch("app.generate_ai_response")
    def test_successful_chat(self, mock_ai):
        mock_ai.return_value = "Based on verified records, a total of 0.001 ETH has been donated."
        
        payload = {
            "question": "How much money has been donated?",
            "blockchain_context": {
                "totalDonations": "0.001 ETH",
                "totalExpensesPaid": "0.0002 ETH",
                "pendingExpenses": "0.0 ETH",
                "contractBalance": "0.0008 ETH",
                "availableBalance": "0.0008 ETH",
                "expenses": [
                    {"id": 0, "amountETH": "0.0002 ETH", "status": "Approved"},
                    {"id": 1, "amountETH": "0.0001 ETH", "status": "Rejected"}
                ]
            }
        }
        res = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["answer"], "Based on verified records, a total of 0.001 ETH has been donated.")
        
        # Verify the prompt passed to generate_ai_response
        prompt_arg = mock_ai.call_args[0][0]
        self.assertIn("0.001 ETH", prompt_arg)
        self.assertIn("How much money has been donated?", prompt_arg)
        self.assertIn("TrustFund AI Donor Assistant", prompt_arg)

    @patch("app.generate_ai_response")
    def test_precision_sanitization(self, mock_ai):
        # Test cleaning of float arithmetic overflow/underflow artifacts
        mock_ai.return_value = "The remaining contract balance is 0.0008000000000000005 ETH."

        payload = {
            "question": "What is the remaining balance?",
            "blockchain_context": {
                "contractBalance": "0.0008 ETH",
                "availableBalance": "0.0008 ETH"
            }
        }
        res = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["answer"], "The remaining contract balance is 0.0008 ETH.")

    @patch("app.generate_ai_response")
    def test_prompt_forbids_recalculation(self, mock_ai):
        mock_ai.return_value = "Verified."

        payload = {
            "question": "Calculate balance",
            "blockchain_context": {
                "contractBalance": "0.0008 ETH"
            }
        }
        self.client.post("/api/ai/chat", json=payload)
        prompt_arg = mock_ai.call_args[0][0]
        self.assertIn("DO NOT calculate, recalculate", prompt_arg)
        self.assertIn("NEVER output floating-point approximation artifacts", prompt_arg)
        self.assertIn("AUTHORITATIVE", prompt_arg)

if __name__ == "__main__":
    unittest.main()
