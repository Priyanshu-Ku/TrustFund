import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import errors

# Load environment variables from backend directory and current directory
dotenv_path = Path(__file__).resolve().parent.parent / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Resilient fallback models if 429 quota or 503 high-demand spike occurs
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]

if not API_KEY:
    raise ValueError("Gemini API key is missing.")

# Initialize Gemini client
client = genai.Client(api_key=API_KEY)


def generate_ai_response(prompt, config=None):
    """
    Sends a prompt to Gemini and returns its response.
    Supports structured JSON output configuration.
    Tries the configured model first, then falls back to resilient models
    if quota (429) or temporary server demand (503) occurs.
    """
    models_to_try = [MODEL] + [m for m in FALLBACK_MODELS if m != MODEL]
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
            if response and response.text:
                return response.text
        except errors.APIError as e:
            last_error = e
            # Retry on transient issues: 429 quota exhausted, 503 high demand, 500 server error, 404 deprecated
            if e.code in (429, 503, 500, 404):
                continue
            raise e
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error

    raise ValueError("Gemini returned an empty response.")
