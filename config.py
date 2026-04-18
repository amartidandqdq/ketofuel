import os
from dotenv import load_dotenv

load_dotenv()

# POURQUOI: Gemini remplace OpenAI — modèle par défaut gemini-2.0-flash (rapide, vision, JSON mode)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8086"))
DATA_DIR = os.getenv("DATA_DIR", "data")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8086,http://127.0.0.1:8086").split(",")
