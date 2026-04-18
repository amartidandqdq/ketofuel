# POURQUOI: Ketosis state endpoint — diet-specific timelines, fasting/exercise acceleration.

from datetime import date, datetime, timedelta

from fastapi import APIRouter

from keto_data import (KETOSIS_TIMELINES, KETOSIS_ACCELERATORS, SPEED_TIPS,
                       _DIET_TIMELINE_MAP, _NON_KETO_DIETS, DAILY_EXERCISE_BONUS_CAP)
from storage import Storage

router = APIRouter(prefix="/api")
db = Storage()


@router.get("/ketosis")
async def ketosis_state():
    """Estimate ketosis state based on diet type, start date, and recent carb intake."""
    profile = db.get_profile()
    diet_type = profile.get("diet_type", "keto_omad")
    start_str = profile.get("keto_start_date", "")
    carb_limit = profile.get("net_carb_limit", 20)

    if diet_type in _NON_KETO_DIETS:
        return {"phase": "not_applicable", "phase_name": "Not Applicable", "icon": "\U0001f957",
                "message": "Ketosis tracking is for keto-based diets. Switch to a keto diet in Settings to enable.",
                "day": 0, "progress": 0, "days_compliant": 0, "phases": []}

    if not start_str:
        return {"phase": "not_started", "phase_name": "Not Started", "icon": "\U0001f35e",
                "message": "Set your keto start date in Settings to track ketosis.",
                "day": 0, "progress": 0, "days_compliant": 0, "phases": []}

    # Diet-specific timeline
    timeline_key = _DIET_TIMELINE_MAP.get(diet_type, "standard_keto")
    timeline = KETOSIS_TIMELINES[timeline_key]
    thresholds = list(timeline["thresholds"])
    phases = timeline["phases"]
    phase_tips = timeline["tips"]
    adapted_day = timeline["adapted_day"]

    # Fasting protocol accelerates ketosis
    fasting_hours = profile.get("fasting_goal_hours", 0)
    fasting_bonus = ""
    if fasting_hours >= 20:
        thresholds = [max(1, round(t * 0.7)) for t in thresholds]
        adapted_day = max(2, round(adapted_day * 0.7))
        fasting_bonus = f"Your {fasting_hours}h fasting window accelerates ketosis by ~30%. You enter mild ketosis every day during the fast."
    elif fasting_hours >= 16:
        thresholds = [max(1, round(t * 0.85)) for t in thresholds]
        adapted_day = max(3, round(adapted_day * 0.85))
        fasting_bonus = f"Your {fasting_hours}h fasting window accelerates ketosis by ~15%."

    start = datetime.fromisoformat(start_str).date()
    today = date.today()
    day_num = (today - start).days

    # Check recent net carb compliance (bulk load)
    check_days = max(1, min(day_num, 14))
    dates = [(today - timedelta(days=i)).isoformat() for i in range(check_days)]
    bulk_stats = db.get_bulk_daily_stats(dates)
    days_compliant, days_over = 0, 0
    recent_carbs = []
    for d in dates:
        stats = bulk_stats.get(d, {})
        net = max(0, (stats.get("carbs_g", 0) or 0) - (stats.get("fiber_g", 0) or 0))
        meal_count = stats.get("meal_count", 0)
        recent_carbs.append({"date": d, "net_carbs": round(net, 1), "meal_count": meal_count})
        if net <= carb_limit and meal_count > 0:
            days_compliant += 1
        elif net > carb_limit:
            days_over += 1

    # Consecutive compliant (skip no-meal days)
    consecutive_compliant = 0
    for entry in recent_carbs:
        if entry["meal_count"] == 0:
            continue
        if entry["net_carbs"] <= carb_limit:
            consecutive_compliant += 1
        else:
            break

    # Exercise bonus (single file read, capped per day)
    all_daily_logs = db.get_all_daily_logs()
    exercise_bonus = 0
    for d in dates:
        day_bonus = sum(ex.get("bonus_days", 0) for ex in all_daily_logs.get(d, {}).get("exercises", []))
        exercise_bonus += min(day_bonus, DAILY_EXERCISE_BONUS_CAP)
    exercise_bonus = round(exercise_bonus, 1)

    # Phase determination (exercise reduces target, doesn't skip phases)
    effective_day = consecutive_compliant if days_over > 0 else day_num
    if effective_day <= thresholds[0]:
        phase_idx = 0
    elif effective_day <= thresholds[1]:
        phase_idx = 1
    elif effective_day <= thresholds[2]:
        phase_idx = 2
    elif effective_day <= thresholds[3]:
        phase_idx = 3
    else:
        phase_idx = 4

    current = phases[phase_idx]
    adapted_day_adjusted = max(2, round(adapted_day - exercise_bonus, 1))
    progress = min(100, round((effective_day / adapted_day_adjusted) * 100))

    raw_tip = phase_tips.get(current["id"], "")
    tip = raw_tip.replace("{}", str(carb_limit)) if "{}" in raw_tip else raw_tip

    warning = None
    if days_over > 0 and day_num > thresholds[0]:
        warning = f"You went over {carb_limit}g net carbs recently. This may delay or reset ketosis. Consecutive compliant days: {consecutive_compliant}."

    days_remaining = max(0, round(adapted_day_adjusted - effective_day, 1))

    return {
        "phase": current["id"], "phase_name": current["name"],
        "icon": current["icon"], "desc": current["desc"],
        "day": day_num, "effective_day": effective_day,
        "progress": progress, "adapted_day": adapted_day_adjusted,
        "days_remaining": days_remaining,
        "days_compliant": days_compliant, "consecutive_compliant": consecutive_compliant,
        "tip": tip, "warning": warning,
        "recent_carbs": recent_carbs[:7], "phases": phases, "current_phase_idx": phase_idx,
        "speed_tips": SPEED_TIPS.get(timeline_key, SPEED_TIPS["standard_keto"]),
        "accelerators": KETOSIS_ACCELERATORS,
        "fasting_bonus": fasting_bonus, "exercise_bonus_days": exercise_bonus,
    }
