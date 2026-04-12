# POURQUOI: Profile + stats routes separated from main.py for <200 line rule.

from fastapi import APIRouter
from models import UserProfile
from storage import Storage

router = APIRouter(prefix="/api")
db = Storage()


@router.get("/profile")
async def get_profile():
    profile = db.get_profile()
    safe = {**profile}
    key = safe.get("api_key", "")
    safe["api_key_set"] = bool(key)
    safe["api_key_hint"] = f"...{key[-4:]}" if len(key) > 4 else ""
    del safe["api_key"]
    return safe


@router.post("/profile")
async def save_profile(profile: UserProfile):
    # Preserve existing API key when client omits it (settings form clears the field after save)
    if not profile.api_key:
        existing = db.get_profile()
        profile.api_key = existing.get("api_key", "")
    db.save_profile(profile)
    return {"status": "ok"}


@router.get("/stats")
async def get_stats(target_date: str = None):
    return db.get_daily_stats(target_date)
