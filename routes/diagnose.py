# POURQUOI: Endpoint diagnostic auto — Claude ou non-dev appelle une seule URL pour tout comprendre.

import os
import sys
import json
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter
import config
from config import GEMINI_API_KEY, GEMINI_MODEL, APP_PORT

router = APIRouter()

LOG_FILE = Path("logs/diagnostic.log")


def _check_file(filename: str) -> dict:
    """Check if a data file exists and is valid JSON."""
    path = os.path.join(config.DATA_DIR, filename)
    if not os.path.exists(path):
        return {"exists": False, "valid": True, "size": 0, "records": 0}
    try:
        size = os.path.getsize(path)
        with open(path) as f:
            data = json.load(f)
        count = len(data) if isinstance(data, (list, dict)) else 0
        return {"exists": True, "valid": True, "size": size, "records": count}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"exists": True, "valid": False, "size": os.path.getsize(path), "records": 0}


def _recent_errors(n: int = 10) -> list:
    """Get last N error entries from diagnostic log."""
    if not LOG_FILE.exists():
        return []
    errors = []
    try:
        with open(LOG_FILE) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get("level") == "error":
                        errors.append({
                            "ts": entry.get("ts", ""),
                            "module": entry.get("module", ""),
                            "message": entry.get("message", ""),
                            "data": entry.get("data"),
                        })
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass
    return errors[-n:]


@router.get("/api/diagnose")
async def diagnose():
    issues = []

    # --- Check API key ---
    if not GEMINI_API_KEY:
        profile_path = os.path.join(config.DATA_DIR, "profile.json")
        has_key_in_profile = False
        if os.path.exists(profile_path):
            try:
                with open(profile_path) as f:
                    p = json.load(f)
                    has_key_in_profile = bool(p.get("api_key"))
            except Exception:
                pass
        if not has_key_in_profile:
            issues.append({
                "code": "AI_001",
                "severity": "warning",
                "msg": "Gemini API key not configured",
                "fix": "Add your key in Settings tab or set GEMINI_API_KEY in .env",
            })

    # --- Check data files ---
    data_files = {
        "profile.json": "Profile",
        "meals.json": "Meals",
        "weights.json": "Weights",
        "daily_logs.json": "Daily logs",
        "grocery_lists.json": "Grocery lists",
        "plans.json": "Saved plans",
    }
    files_status = {}
    for filename, label in data_files.items():
        info = _check_file(filename)
        files_status[filename] = info
        if info["exists"] and not info["valid"]:
            issues.append({
                "code": "STORAGE_002",
                "severity": "error",
                "msg": f"{label} file corrupt ({filename})",
                "fix": f"Delete data/{filename} and restart — or restore from backup",
            })

    # --- Check corrupt backups ---
    corrupt_files = list(Path(config.DATA_DIR).glob("*.corrupt")) if os.path.exists(config.DATA_DIR) else []
    if corrupt_files:
        issues.append({
            "code": "STORAGE_002",
            "severity": "info",
            "msg": f"{len(corrupt_files)} corrupt file backup(s) found",
            "fix": "Review data/*.corrupt files — delete if no longer needed",
        })

    # --- Check log file size ---
    if LOG_FILE.exists():
        log_size = LOG_FILE.stat().st_size
        if log_size > 4 * 1024 * 1024:  # >4MB (rotation at 5MB)
            issues.append({
                "code": "SYS_001",
                "severity": "info",
                "msg": f"Log file approaching rotation ({log_size // 1024 // 1024}MB / 5MB)",
                "fix": "Normal — auto-rotated at 5MB",
            })

    # --- Stats ---
    meals_info = files_status.get("meals.json", {})
    weights_info = files_status.get("weights.json", {})
    profile_info = files_status.get("profile.json", {})

    # --- Profile check ---
    profile_data = {}
    profile_path = os.path.join(config.DATA_DIR, "profile.json")
    if os.path.exists(profile_path):
        try:
            with open(profile_path) as f:
                profile_data = json.load(f)
        except Exception:
            pass

    if profile_data and not profile_data.get("height_cm"):
        issues.append({
            "code": "STORAGE_004",
            "severity": "warning",
            "msg": "Profile incomplete — height not set",
            "fix": "Go to Settings tab and enter your height for accurate BMI/TDEE",
        })

    if profile_data and not profile_data.get("current_weight_kg"):
        issues.append({
            "code": "STORAGE_004",
            "severity": "warning",
            "msg": "Profile incomplete — weight not set",
            "fix": "Go to Settings tab and enter your weight",
        })

    # --- Recent errors ---
    recent_errors = _recent_errors(5)

    status = "ok"
    if any(i["severity"] == "error" for i in issues):
        status = "error"
    elif any(i["severity"] == "warning" for i in issues):
        status = "degraded"

    return {
        "status": status,
        "version": "4.2",
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "gemini_model": GEMINI_MODEL,
        "port": APP_PORT,
        "date": date.today().isoformat(),
        "issues": issues,
        "stats": {
            "meals": meals_info.get("records", 0),
            "weights": weights_info.get("records", 0),
            "profile_set": profile_info.get("exists", False),
            "diet_type": profile_data.get("diet_type", "not set"),
            "keto_start": profile_data.get("keto_start_date", "not set"),
        },
        "files": files_status,
        "recent_errors": recent_errors,
    }
