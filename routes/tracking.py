# POURQUOI: Daily logs (water, electrolytes), exercise, streak.

from datetime import date

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from keto_data import EXERCISE_IMPACTS, DAILY_EXERCISE_BONUS_CAP
from models import DailyLog, Exercise, ExerciseLogRequest
from storage import Storage

router = APIRouter(prefix="/api")
db = Storage()


def _validate_date(d: str) -> str:
    """Validate and normalize a date string to YYYY-MM-DD."""
    try:
        return date.fromisoformat(d).isoformat()
    except (ValueError, TypeError):
        return None


def _patch_daily_log(target_date: str, **updates) -> dict:
    """Read-modify-write helper for daily log updates. Preserves all existing fields."""
    daily_log = db.get_daily_log(target_date)
    daily_log.update(updates)
    daily_log["date"] = target_date
    exercises = daily_log.get("exercises", [])
    if exercises and isinstance(exercises[0], dict):
        daily_log["exercises"] = [Exercise(**e) for e in exercises]
    db.update_daily_log(DailyLog(**daily_log))
    return daily_log


@router.get("/daily-log")
async def get_daily_log(target_date: str = None):
    if not target_date:
        target_date = date.today().isoformat()
    elif not _validate_date(target_date):
        return JSONResponse(status_code=400, content={"error": "Invalid date format. Use YYYY-MM-DD."})
    return db.get_daily_log(target_date)


@router.post("/daily-log")
async def update_daily_log(entry: DailyLog):
    return db.update_daily_log(entry)


@router.post("/daily-log/water")
async def add_water(target_date: str = None):
    if not target_date:
        target_date = date.today().isoformat()
    elif not _validate_date(target_date):
        return JSONResponse(status_code=400, content={"error": "Invalid date format. Use YYYY-MM-DD."})
    return db.add_water(target_date)


@router.delete("/daily-log/water")
async def remove_water(target_date: str = None):
    if not target_date:
        target_date = date.today().isoformat()
    elif not _validate_date(target_date):
        return JSONResponse(status_code=400, content={"error": "Invalid date format. Use YYYY-MM-DD."})
    return db.remove_water(target_date)


@router.get("/exercise-types")
async def get_exercise_types():
    return {"types": EXERCISE_IMPACTS}


@router.post("/log-exercise")
async def log_exercise(data: ExerciseLogRequest):
    exercise_type = data.type
    if exercise_type not in EXERCISE_IMPACTS:
        return JSONResponse(status_code=400, content={"error": f"Unknown exercise type: {exercise_type}"})

    impact = EXERCISE_IMPACTS[exercise_type]
    today = date.today().isoformat()
    daily_log = db.get_daily_log(today)
    exercises = daily_log.get("exercises", [])

    max_daily = impact.get("max_daily")
    if max_daily:
        count_today = sum(1 for e in exercises if e.get("type") == exercise_type)
        if count_today >= max_daily:
            return JSONResponse(status_code=400, content={"error": f"Max {max_daily} {impact['name']} per day (400mg caffeine limit)."})

    raw_bonus = sum(e.get("bonus_days", 0) for e in exercises) + impact["bonus"]
    if raw_bonus > DAILY_EXERCISE_BONUS_CAP:
        return JSONResponse(status_code=400, content={
            "error": f"Daily exercise bonus cap reached ({DAILY_EXERCISE_BONUS_CAP} days). Additional exercises won't accelerate ketosis further today."})

    exercises.append({"type": exercise_type, "name": impact["name"], "icon": impact["icon"],
                      "minutes": impact["minutes"], "bonus_days": impact["bonus"]})
    _patch_daily_log(today, exercises=exercises)

    total_bonus = min(sum(e["bonus_days"] for e in exercises), DAILY_EXERCISE_BONUS_CAP)
    return {"status": "ok", "exercise": impact, "today_total_bonus": round(total_bonus, 1),
            "daily_cap": DAILY_EXERCISE_BONUS_CAP, "exercises": exercises}


@router.delete("/log-exercise")
async def clear_exercises(index: int = -1):
    """Remove a specific exercise (by index) or all exercises for today."""
    today = date.today().isoformat()
    exercises = db.get_daily_log(today).get("exercises", [])
    if 0 <= index < len(exercises):
        exercises.pop(index)
    else:
        exercises = []
    _patch_daily_log(today, exercises=exercises)
    total_bonus = sum(e.get("bonus_days", 0) for e in exercises)
    return {"status": "ok", "today_total_bonus": round(total_bonus, 1), "exercises": exercises}


@router.get("/streak")
async def get_streak():
    return db.get_streak()
