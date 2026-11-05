
import os
from dotenv import load_dotenv
from google import genai
from google.genai import errors

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

if not API_KEY:
    raise SystemExit("GEMINI_API_KEY missing from .env")

print(f"Selected model: {MODEL}")

client = genai.Client(api_key=API_KEY)

try:
    print("Sending request using generate_content...")

    response = client.models.generate_content(
        model=MODEL,
        contents="Reply with exactly: TRUSTFUND_AI_CONNECTED"
    )

    print("\nGemini response:")
    print(response.text)
    print("\nSUCCESS: Gemini API is working!")

except errors.APIError as error:
    print("\nGemini API error")
    print("HTTP status:", error.code)
    print("Details:", error.message)

except Exception as error:
    print("\nUnexpected error:", repr(error))

finally:
    client.close()
