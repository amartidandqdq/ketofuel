# POURQUOI: Weight tracking, AI insight, deficit/TDEE calculation.

import logging
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ai_client import AIClient
from models import WeightEntry
from storage import Storage

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
ai = AIClient()
db = Storage()


@router.post("/weight")
async def log_weight(entry: WeightEntry):
    return db.log_weight(entry)


@router.get("/weight")
async def get_weights(limit: int = 30):
    return db.get_weights(limit)


@router.delete("/weight/{target_date}")
async def delete_weight(target_date: str):
    if db.delete_weight(target_date):
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Weight entry not found"})


@router.get("/weight/insight")
async def weight_insight():
    try:
        profile = db.get_profile()
        weights = db.get_weights(30)
        result = await ai.get_weight_insight(profile, weights)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Weight insight failed")
        return JSONResponse(status_code=500, content={"error": "AI service error. Please try again."})


@router.get("/deficit")
async def calculate_deficit():
    """Calculate TDEE, recommended deficit, and weight loss timeline."""
    profile = db.get_profile()
    weight = profile.get("current_weight_kg", 0)
    target = profile.get("target_weight_kg", 0)
    height = profile.get("height_cm", 0)
    sex = profile.get("sex", "male")
    age = profile.get("age", 30)
    activity = profile.get("activity_level", 1.375)

    if not weight or not height:
        return JSONResponse(status_code=400, content={"error": "Set your height and current weight in Settings first."})

    # Mifflin-St Jeor equation
    if sex == "female":
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    tdee = round(bmr * activity)

    cal_target = profile.get("calorie_target", 2000)
    daily_deficit = tdee - cal_target
    weekly_deficit = daily_deficit * 7
    weekly_kg_loss = round(weekly_deficit / 7700, 2)

    to_lose = round(weight - target, 1) if target and target < weight else 0
    weeks_to_goal = round(to_lose / weekly_kg_loss, 1) if weekly_kg_loss > 0 and to_lose > 0 else None

    weights = db.get_weights(30)
    actual_weekly = None
    if len(weights) >= 2:
        first, last = weights[0], weights[-1]
        d1 = datetime.fromisoformat(first["date"])
        d2 = datetime.fromisoformat(last["date"])
        days = (d2 - d1).days
        if days > 0:
            actual_weekly = round((first["weight_kg"] - last["weight_kg"]) / (days / 7), 2)

    recommendations = []
    for rate_label, weekly_kg in [("Conservative (0.25 kg/wk)", 0.25), ("Moderate (0.5 kg/wk)", 0.5), ("Aggressive (0.75 kg/wk)", 0.75)]:
        daily_deficit_needed = round(weekly_kg * 7700 / 7)
        rec_cal = tdee - daily_deficit_needed
        rec_weeks = round(to_lose / weekly_kg, 1) if to_lose > 0 else None
        if rec_cal >= 1200:
            recommendations.append({"label": rate_label, "calories": rec_cal,
                                    "daily_deficit": daily_deficit_needed, "weekly_loss_kg": weekly_kg,
                                    "weeks_to_goal": rec_weeks})

    return {
        "tdee_estimate": tdee, "calorie_target": cal_target, "daily_deficit": daily_deficit,
        "weekly_kg_loss_projected": weekly_kg_loss, "actual_weekly_kg_lost": actual_weekly,
        "current_weight_kg": weight, "target_weight_kg": target, "to_lose_kg": to_lose,
        "weeks_to_goal": weeks_to_goal, "recommendations": recommendations,
        "note": "TDEE estimated via Mifflin-St Jeor. Pick a plan below to auto-set your calorie target.",
    }
