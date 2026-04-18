# POURQUOI: Data export/import endpoints — JSON backup/restore + compliance streaks moved here.

import json
from datetime import date

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from config import DATA_DIR
from storage import Storage, _read_json, _write_json

router = APIRouter(prefix="/api")
db = Storage()


@router.get("/export-json")
async def export_json():
    """Full JSON backup of all user data."""
    data = {
        "profile": _read_json("profile.json", {}),
        "meals": _read_json("meals.json", []),
        "weights": _read_json("weights.json", []),
        "daily_logs": _read_json("daily_logs.json", {}),
        "grocery_lists": _read_json("grocery_lists.json", []),
        "plans": _read_json("plans.json", []),
        "exported_at": date.today().isoformat(),
        "version": "1.0",
    }
    content = json.dumps(data, indent=2, default=str)
    return StreamingResponse(
        iter([content]), media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="ketofuel-backup-{date.today().isoformat()}.json"'})


@router.post("/import-json")
async def import_json(request: Request):
    """Restore user data from a JSON backup. Overwrites existing data."""
    try:
        body = await request.json()
        if not isinstance(body, dict) or "version" not in body:
            return JSONResponse(status_code=400, content={"error": "Invalid backup format"})

        # POURQUOI: Only import known keys to prevent arbitrary file writes
        allowed = {"profile": ("profile.json", dict), "meals": ("meals.json", list),
                    "weights": ("weights.json", list), "daily_logs": ("daily_logs.json", dict),
                    "grocery_lists": ("grocery_lists.json", list), "plans": ("plans.json", list)}

        # POURQUOI: Validate types before overwriting to prevent storage corruption
        errors = []
        for key, (filename, expected_type) in allowed.items():
            if key in body and not isinstance(body[key], expected_type):
                errors.append(f"{key} must be {expected_type.__name__}, got {type(body[key]).__name__}")
        if errors:
            return JSONResponse(status_code=400, content={"error": f"Invalid data types: {'; '.join(errors)}"})

        imported = []
        for key, (filename, _) in allowed.items():
            if key in body:
                _write_json(filename, body[key])
                imported.append(key)

        return {"status": "ok", "imported": imported, "count": len(imported)}
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})
