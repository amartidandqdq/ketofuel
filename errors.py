# POURQUOI: Catalogue centralise de codes d'erreur — grep-friendly, fix inclus.
# Usage: from errors import E; dlog.error("module", E["AI_001"]["msg"], {"fix": E["AI_001"]["fix"]})

E = {
    # --- AI / Gemini ---
    "AI_001": {
        "msg": "Gemini API key missing or invalid",
        "fix": "Add GEMINI_API_KEY in Settings tab or .env file",
    },
    "AI_002": {
        "msg": "Gemini API timeout (>30s)",
        "fix": "Retry the request or check https://status.cloud.google.com",
    },
    "AI_003": {
        "msg": "Gemini response parse failed",
        "fix": "AI returned non-JSON — check prompt format in ai_client.py",
    },
    "AI_004": {
        "msg": "Gemini rate limit exceeded",
        "fix": "Wait 60s or upgrade Gemini API quota",
    },
    "AI_005": {
        "msg": "Gemini vision/label scan failed",
        "fix": "Check image format (JPEG/PNG) and size (<10MB)",
    },

    # --- Storage ---
    "STORAGE_001": {
        "msg": "JSON file read failed",
        "fix": "Check file permissions in data/ directory",
    },
    "STORAGE_002": {
        "msg": "JSON parse error (corrupt file)",
        "fix": "Corrupt file auto-backed up to .corrupt — app uses defaults",
    },
    "STORAGE_003": {
        "msg": "JSON write failed (disk full or permissions)",
        "fix": "Check disk space and data/ directory permissions",
    },
    "STORAGE_004": {
        "msg": "Profile not found or incomplete",
        "fix": "Go to Settings tab and save your profile",
    },

    # --- Validation ---
    "VALID_001": {
        "msg": "Invalid date format",
        "fix": "Use YYYY-MM-DD format (e.g. 2026-04-15)",
    },
    "VALID_002": {
        "msg": "Required field missing or empty",
        "fix": "Check request body — required fields listed in API docs",
    },
    "VALID_003": {
        "msg": "Value out of allowed range",
        "fix": "Check min/max constraints in models.py Field() definitions",
    },

    # --- Exercise ---
    "EXERCISE_001": {
        "msg": "Unknown exercise type",
        "fix": "Use one of: walk_30, hiit, weight_train, swim, fat_fast, espresso",
    },
    "EXERCISE_002": {
        "msg": "Per-type daily cap reached",
        "fix": "Max reached for this exercise today — try a different type",
    },
    "EXERCISE_003": {
        "msg": "Daily bonus cap reached (3.0/day)",
        "fix": "Total exercise bonus for today is at maximum",
    },

    # --- External APIs ---
    "EXT_001": {
        "msg": "Open Food Facts API unreachable",
        "fix": "Check internet connection or try again later",
    },
    "EXT_002": {
        "msg": "Barcode not found in Open Food Facts",
        "fix": "Product not in database — enter nutrition manually",
    },
    "EXT_003": {
        "msg": "Invalid barcode format",
        "fix": "Barcode must be numeric (EAN-8 or EAN-13)",
    },

    # --- Data import/export ---
    "DATA_001": {
        "msg": "Import file invalid format",
        "fix": "File must be valid JSON with 'meals' and/or 'weights' arrays",
    },
    "DATA_002": {
        "msg": "Export failed",
        "fix": "Check data/ directory exists and has content",
    },

    # --- System ---
    "SYS_001": {
        "msg": "Rate limit exceeded",
        "fix": "Too many requests — wait 60s before retrying",
    },
    "SYS_002": {
        "msg": "Server startup failed",
        "fix": "Check port 8086 is free and dependencies are installed",
    },
}


def get_error(code: str, **kwargs) -> dict:
    """Get error dict by code, with optional format kwargs for msg."""
    err = E.get(code, {"msg": f"Unknown error: {code}", "fix": "Check logs"})
    return {
        "code": code,
        "msg": err["msg"].format(**kwargs) if kwargs else err["msg"],
        "fix": err["fix"].format(**kwargs) if kwargs else err["fix"],
    }
