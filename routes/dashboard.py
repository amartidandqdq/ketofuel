# POURQUOI: Dashboard aggregate endpoints — weekly summary, body comp, achievements, timing, snapshot, export.

import csv
import io
import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from keto_data import PROTEIN_PER_KG_LEAN
from routes.tracking import _validate_date
from storage import Storage

router = APIRouter(prefix="/api")
db = Storage()


@router.get("/weekly-summary")
async def weekly_summary():
    """Weekly averages and compliance stats."""
    today = date.today()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(7)]
    bulk = db.get_bulk_daily_stats(dates)
    profile = db.get_profile()
    carb_limit = profile.get("net_carb_limit", 20)

    total_cal, total_net, days_with_meals, days_compliant = 0, 0, 0, 0
    for d in dates:
        s = bulk.get(d, {})
        if s.get("meal_count", 0) > 0:
            days_with_meals += 1
            total_cal += s.get("calories", 0) or 0
            net = max(0, (s.get("carbs_g", 0) or 0) - (s.get("fiber_g", 0) or 0))
            total_net += net
            if net <= carb_limit:
                days_compliant += 1

    weights = db.get_weights(30)
    week_weights = [w for w in weights if w["date"] >= dates[-1]]
    weight_change = round(week_weights[-1]["weight_kg"] - week_weights[0]["weight_kg"], 2) if len(week_weights) >= 2 else None

    avg_cal = round(total_cal / days_with_meals) if days_with_meals else 0
    avg_net = round(total_net / days_with_meals, 1) if days_with_meals else 0

    return {"avg_calories": avg_cal, "avg_net_carbs": avg_net,
            "days_with_meals": days_with_meals, "days_compliant": days_compliant,
            "compliance_pct": round(days_compliant / max(1, days_with_meals) * 100),
            "weight_change_kg": weight_change, "period": f"{dates[-1]} to {dates[0]}"}


@router.get("/body-composition")
async def body_composition():
    """Estimate body fat % and lean mass using Deurenberg (BMI-based) formula."""
    profile = db.get_profile()
    weight = profile.get("current_weight_kg", 0)
    height = profile.get("height_cm", 0)
    age = profile.get("age", 30)
    sex = profile.get("sex", "male")

    if not weight or not height:
        return JSONResponse(status_code=400, content={"error": "Set height and weight in Settings."})

    bmi = weight / ((height / 100) ** 2)
    bf_pct = round((1.20 * bmi + 0.23 * age - 5.4) if sex == "female" else (1.20 * bmi + 0.23 * age - 16.2), 1)
    bf_pct = max(3, min(60, bf_pct))

    fat_mass = round(weight * bf_pct / 100, 1)
    lean_mass = round(weight - fat_mass, 1)

    history = []
    for w in db.get_weights(30)[-14:]:
        w_bmi = w["weight_kg"] / ((height / 100) ** 2)
        w_bf = round((1.20 * w_bmi + 0.23 * age - 5.4) if sex == "female" else (1.20 * w_bmi + 0.23 * age - 16.2), 1)
        w_bf = max(3, min(60, w_bf))
        history.append({"date": w["date"], "weight_kg": w["weight_kg"], "bf_pct": w_bf,
                        "fat_kg": round(w["weight_kg"] * w_bf / 100, 1),
                        "lean_kg": round(w["weight_kg"] * (1 - w_bf / 100), 1)})

    return {"bmi": round(bmi, 1), "body_fat_pct": bf_pct, "fat_mass_kg": fat_mass,
            "lean_mass_kg": lean_mass, "method": "Deurenberg (BMI-based estimate)", "history": history}


@router.get("/protein-status")
async def protein_status():
    """Check protein adequacy for muscle preservation based on lean mass and activity level."""
    profile = db.get_profile()
    weight = profile.get("current_weight_kg", 0)
    height = profile.get("height_cm", 0)
    age = profile.get("age", 30)
    sex = profile.get("sex", "male")
    activity = profile.get("activity_level", 1.375)

    if not weight or not height:
        return JSONResponse(status_code=400, content={"error": "Set height and weight in Settings."})

    # Lean mass via Deurenberg (same formula as body-composition endpoint)
    bmi = weight / ((height / 100) ** 2)
    bf_pct = (1.20 * bmi + 0.23 * age - 5.4) if sex == "female" else (1.20 * bmi + 0.23 * age - 16.2)
    bf_pct = max(3, min(60, bf_pct))
    lean_mass = round(weight * (1 - bf_pct / 100), 1)

    # POURQUOI: Closest activity level match — avoids requiring exact float match
    closest_activity = min(PROTEIN_PER_KG_LEAN.keys(), key=lambda k: abs(k - activity))
    g_per_kg = PROTEIN_PER_KG_LEAN[closest_activity]
    protein_target_g = round(lean_mass * g_per_kg, 1)

    # Today's intake
    today = date.today().isoformat()
    stats = db.get_daily_stats(today)
    protein_consumed_g = round(stats.get("protein_g", 0), 1)
    pct = round(protein_consumed_g / protein_target_g * 100) if protein_target_g > 0 else 0

    alert = None
    if stats.get("meal_count", 0) > 0 and pct < 80:
        deficit_g = round(protein_target_g - protein_consumed_g, 1)
        alert = f"Low protein: {protein_consumed_g}g of {protein_target_g}g target ({pct}%). You need {deficit_g}g more to preserve muscle mass."

    return {
        "lean_mass_kg": lean_mass, "g_per_kg_lean": g_per_kg,
        "protein_target_g": protein_target_g, "protein_consumed_g": protein_consumed_g,
        "pct": pct, "alert": alert,
    }


@router.get("/achievements")
async def get_achievements():
    """Check achievement badges based on user activity."""
    meals_data = db.get_meals()
    all_meals = meals_data["meals"] if isinstance(meals_data, dict) else meals_data
    weights = db.get_weights(100)
    streak_data = db.get_streak()

    total_meals = len(all_meals)
    total_weights = len(weights)
    current_streak = streak_data.get("current_streak", 0)
    longest_streak = streak_data.get("longest_streak", 0)
    weight_lost = round(weights[0]["weight_kg"] - weights[-1]["weight_kg"], 1) if len(weights) >= 2 else 0

    checks = [
        (total_meals >= 1, "first_meal", "First Bite", "Logged your first meal", "\U0001f37d\ufe0f"),
        (total_meals >= 10, "ten_meals", "Dedicated Eater", "10 meals logged", "\U0001f51f"),
        (total_meals >= 50, "fifty_meals", "Meal Master", "50 meals logged", "\U0001f468\u200d\U0001f373"),
        (total_meals >= 100, "century", "Century Club", "100 meals logged", "\U0001f4af"),
        (total_weights >= 1, "first_weigh", "Scale Starter", "First weigh-in", "\u2696\ufe0f"),
        (total_weights >= 14, "two_weeks", "Consistent Tracker", "14 weigh-ins", "\U0001f4ca"),
        (current_streak >= 3, "streak_3", "3-Day Streak", "3 consecutive compliant days", "\U0001f525"),
        (current_streak >= 7, "streak_7", "Week Warrior", "7-day compliance streak", "\u26a1"),
        (current_streak >= 14, "streak_14", "Fat Adapted", "14-day streak", "\U0001f3c6"),
        (current_streak >= 30, "streak_30", "Keto Legend", "30-day unbroken streak", "\U0001f451"),
        (longest_streak >= 7, "longest_7", "Comeback King", "Achieved a 7+ day streak", "\U0001f4aa"),
        (weight_lost >= 1, "lost_1kg", "First Kilo Down", "Lost 1 kg", "\U0001f4c9"),
        (weight_lost >= 5, "lost_5kg", "5 kg Gone", "Lost 5 kg total", "\U0001f3af"),
        (weight_lost >= 10, "lost_10kg", "10 kg Crushed", "Lost 10 kg total", "\U0001f3c5"),
        (weight_lost >= 20, "lost_20kg", "Transformation", "Lost 20 kg", "\U0001f31f"),
    ]

    badges = [{"id": bid, "name": n, "desc": d, "icon": ic, "earned": e} for e, bid, n, d, ic in checks]
    return {"badges": badges, "stats": {"total_meals": total_meals, "total_weights": total_weights,
            "current_streak": current_streak, "longest_streak": longest_streak, "weight_lost_kg": weight_lost}}


@router.get("/meal-timing")
async def meal_timing(target_date: str = None):
    if not target_date:
        target_date = date.today().isoformat()
    meals_resp = db.get_meals(target_date)
    meals = meals_resp["meals"] if isinstance(meals_resp, dict) else meals_resp
    timings = []
    for m in meals:
        logged = m.get("logged_at", "")
        if logged:
            try:
                dt = datetime.fromisoformat(logged)
                timings.append({"hour": dt.hour, "minute": dt.minute, "meal_name": m.get("meal_name", "Meal"), "calories": m.get("calories", 0)})
            except (ValueError, TypeError):
                pass
    return {"date": target_date, "timings": timings}


@router.get("/daily-snapshot")
async def daily_snapshot(target_date: str):
    if not _validate_date(target_date):
        return JSONResponse(status_code=400, content={"error": "Invalid date"})
    stats = db.get_daily_stats(target_date)
    meals_resp = db.get_meals(target_date)
    meals = meals_resp["meals"] if isinstance(meals_resp, dict) else meals_resp
    return {"date": target_date, "stats": stats, "meals": meals, "daily_log": db.get_daily_log(target_date)}


@router.get("/compliance-streaks")
async def compliance_streaks():
    """Net carb compliance data for the last 14 days for streak visualization."""
    streak = db.get_streak()
    today = date.today()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(14)]
    bulk = db.get_bulk_daily_stats(dates)
    profile = db.get_profile()
    carb_limit = profile.get("net_carb_limit", 20)

    days = []
    for d in reversed(dates):
        s = bulk.get(d, {})
        mc = s.get("meal_count", 0)
        net = max(0, (s.get("carbs_g", 0) or 0) - (s.get("fiber_g", 0) or 0))
        days.append({"date": d, "compliant": mc > 0 and net <= carb_limit, "net_carbs": round(net, 1), "has_meals": mc > 0})

    return {"days": days, "current_streak": streak["current_streak"],
            "longest_streak": streak["longest_streak"], "carb_limit": carb_limit}


@router.get("/macro-trends")
async def macro_trends(days: int = 7):
    """Rolling macro averages and daily breakdown for trend charts."""
    today = date.today()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(days)]
    bulk = db.get_bulk_daily_stats(dates)
    profile = db.get_profile()
    carb_limit = profile.get("net_carb_limit", 20)

    trend = []
    for d in reversed(dates):
        s = bulk.get(d, {})
        net = max(0, (s.get("carbs_g", 0) or 0) - (s.get("fiber_g", 0) or 0))
        trend.append({"date": d, "calories": round(s.get("calories", 0) or 0),
                       "protein_g": round(s.get("protein_g", 0) or 0, 1),
                       "fat_g": round(s.get("fat_g", 0) or 0, 1),
                       "net_carbs_g": round(net, 1), "meal_count": s.get("meal_count", 0)})

    with_meals = [t for t in trend if t["meal_count"] > 0]
    n = len(with_meals) or 1
    avg = {"calories": round(sum(t["calories"] for t in with_meals) / n),
           "protein_g": round(sum(t["protein_g"] for t in with_meals) / n, 1),
           "fat_g": round(sum(t["fat_g"] for t in with_meals) / n, 1),
           "net_carbs_g": round(sum(t["net_carbs_g"] for t in with_meals) / n, 1)}

    return {"trend": trend, "averages": avg, "carb_limit": carb_limit, "days": days}


@router.get("/export")
async def export_csv():
    data = db.export_all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["--- MEALS ---"])
    writer.writerow(["date", "meal_name", "meal_description", "calories", "protein_g", "fat_g", "carbs_g", "fiber_g", "logged_at"])
    for m in data["meals"]:
        writer.writerow([m.get(k, "") for k in ["date", "meal_name", "meal_description", "calories", "protein_g", "fat_g", "carbs_g", "fiber_g", "logged_at"]])
    writer.writerow([])
    writer.writerow(["--- WEIGHT ---"])
    writer.writerow(["date", "weight_kg", "notes", "logged_at"])
    for w in data["weights"]:
        writer.writerow([w.get(k, "") for k in ["date", "weight_kg", "notes", "logged_at"]])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="ketofuel-export-{date.today().isoformat()}.csv"'})
