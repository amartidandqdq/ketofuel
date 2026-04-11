import json
import os
import uuid
from datetime import datetime, date
from config import DATA_DIR
from models import UserProfile, MealLog, WeightEntry


def _path(filename: str) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    return os.path.join(DATA_DIR, filename)


def _read_json(filename: str, default=None):
    path = _path(filename)
    if not os.path.exists(path):
        return default if default is not None else {}
    with open(path, "r") as f:
        return json.load(f)


def _write_json(filename: str, data):
    with open(_path(filename), "w") as f:
        json.dump(data, f, indent=2, default=str)


class Storage:
    def get_profile(self) -> dict:
        data = _read_json("profile.json", {})
        profile = UserProfile(**data) if data else UserProfile()
        return profile.model_dump()

    def save_profile(self, profile: UserProfile):
        existing = _read_json("profile.json", {})
        update = profile.model_dump()
        if not update.get("api_key") and existing.get("api_key"):
            update["api_key"] = existing["api_key"]
        _write_json("profile.json", update)

    def get_api_key(self) -> str:
        profile = _read_json("profile.json", {})
        return profile.get("api_key", "")

    # Meal logging
    def log_meal(self, meal: MealLog) -> dict:
        meals = _read_json("meals.json", [])
        entry = meal.model_dump()
        entry["id"] = str(uuid.uuid4())[:8]
        entry["logged_at"] = datetime.now().isoformat()
        meals.append(entry)
        _write_json("meals.json", meals)
        return entry

    def get_meals(self, target_date: str = None) -> list:
        meals = _read_json("meals.json", [])
        if target_date:
            meals = [m for m in meals if m.get("date") == target_date]
        return sorted(meals, key=lambda m: m.get("logged_at", ""), reverse=True)

    def delete_meal(self, meal_id: str) -> bool:
        meals = _read_json("meals.json", [])
        filtered = [m for m in meals if m.get("id") != meal_id]
        if len(filtered) == len(meals):
            return False
        _write_json("meals.json", filtered)
        return True

    def get_daily_stats(self, target_date: str = None) -> dict:
        if not target_date:
            target_date = date.today().isoformat()
        meals = self.get_meals(target_date)
        totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "meal_count": len(meals)}
        for m in meals:
            for key in ["calories", "protein_g", "fat_g", "carbs_g", "fiber_g"]:
                totals[key] += m.get(key) or 0
        profile = self.get_profile()
        cal_target = profile.get("calorie_target", 2000)
        totals["calorie_target"] = cal_target
        totals["protein_target_g"] = round(cal_target * profile.get("protein_ratio", 25) / 100 / 4, 1)
        totals["fat_target_g"] = round(cal_target * profile.get("fat_ratio", 70) / 100 / 9, 1)
        totals["carbs_target_g"] = round(cal_target * profile.get("carb_ratio", 5) / 100 / 4, 1)
        totals["date"] = target_date
        return totals

    # Weight tracking
    def log_weight(self, entry: WeightEntry) -> dict:
        weights = _read_json("weights.json", [])
        # Replace if same date exists
        weights = [w for w in weights if w.get("date") != entry.date]
        data = entry.model_dump()
        data["logged_at"] = datetime.now().isoformat()
        weights.append(data)
        weights.sort(key=lambda w: w.get("date", ""))
        _write_json("weights.json", weights)
        return data

    def get_weights(self, limit: int = 30) -> list:
        weights = _read_json("weights.json", [])
        weights.sort(key=lambda w: w.get("date", ""))
        return weights[-limit:]

    def delete_weight(self, target_date: str) -> bool:
        weights = _read_json("weights.json", [])
        filtered = [w for w in weights if w.get("date") != target_date]
        if len(filtered) == len(weights):
            return False
        _write_json("weights.json", filtered)
        return True

    # Saved plans
    def save_plan(self, plan: dict) -> dict:
        plans = _read_json("plans.json", [])
        plan["id"] = str(uuid.uuid4())[:8]
        plan["saved_at"] = datetime.now().isoformat()
        plans.append(plan)
        _write_json("plans.json", plans)
        return plan

    def get_plans(self, limit: int = 10) -> list:
        plans = _read_json("plans.json", [])
        return sorted(plans, key=lambda p: p.get("saved_at", ""), reverse=True)[:limit]
