import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, date, timedelta
from config import DATA_DIR
from errors import E
from logger import dlog
from models import UserProfile, MealLog, WeightEntry, DailyLog, GroceryList

_log = logging.getLogger(__name__)


def _path(filename: str) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    return os.path.join(DATA_DIR, filename)


def _read_json(filename: str, default=None):
    path = _path(filename)
    if not os.path.exists(path):
        return default if default is not None else {}
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        # POURQUOI: STORAGE_002 — corrupt file backed up to .corrupt; app uses default to stay alive
        dlog.error("storage", E["STORAGE_002"]["msg"], {
            "code": "STORAGE_002", "action": f"read {filename}",
            "fix": E["STORAGE_002"]["fix"], "error": str(e), "path": path,
        })
        backup = path + ".corrupt"
        try:
            os.replace(path, backup)
        except OSError as oe:
            dlog.warn("storage", "Could not move corrupt file aside", {
                "code": "STORAGE_001", "fix": E["STORAGE_001"]["fix"], "error": str(oe),
            })
        return default if default is not None else {}
    except OSError as e:
        dlog.error("storage", E["STORAGE_001"]["msg"], {
            "code": "STORAGE_001", "action": f"read {filename}",
            "fix": E["STORAGE_001"]["fix"], "error": str(e), "path": path,
        })
        return default if default is not None else {}


def _write_json(filename: str, data):
    # POURQUOI: Atomic write — temp file + os.replace prevents data corruption on crash
    path = _path(filename)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, default=str)
        os.replace(tmp, path)
    except BaseException as e:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        dlog.error("storage", E["STORAGE_003"]["msg"], {
            "code": "STORAGE_003", "action": f"write {filename}",
            "fix": E["STORAGE_003"]["fix"], "error": str(e), "path": path,
        })
        raise


class Storage:
    def get_profile(self) -> dict:
        data = _read_json("profile.json", {})
        profile = UserProfile(**data) if data else UserProfile()
        return profile.model_dump()

    def save_profile(self, profile: UserProfile):
        _write_json("profile.json", profile.model_dump())

    def get_api_key(self) -> str:
        profile = _read_json("profile.json", {})
        return profile.get("api_key", "")

    # Meal logging
    def log_meal(self, meal: MealLog) -> dict:
        meals = _read_json("meals.json", [])
        entry = meal.model_dump()
        entry["id"] = str(uuid.uuid4())[:12]
        entry["logged_at"] = datetime.now().isoformat()
        meals.append(entry)
        _write_json("meals.json", meals)
        return entry

    def get_meals(self, target_date: str = None, limit: int = 0, offset: int = 0):
        meals = _read_json("meals.json", [])
        if target_date:
            meals = [m for m in meals if m.get("date") == target_date]
        meals = sorted(meals, key=lambda m: m.get("logged_at", ""), reverse=True)
        total = len(meals)
        if limit > 0:
            meals = meals[offset:offset + limit]
        return {"meals": meals, "total": total, "offset": offset, "limit": limit}

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
        meals = self.get_meals(target_date)["meals"]
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

    def get_bulk_daily_stats(self, dates: list[str]) -> dict[str, dict]:
        """Get daily stats for multiple dates with a single file read."""
        all_meals = _read_json("meals.json", [])
        profile = self.get_profile()
        cal_target = profile.get("calorie_target", 2000)
        protein_target = round(cal_target * profile.get("protein_ratio", 25) / 100 / 4, 1)
        fat_target = round(cal_target * profile.get("fat_ratio", 70) / 100 / 9, 1)
        carbs_target = round(cal_target * profile.get("carb_ratio", 5) / 100 / 4, 1)

        # Group meals by date
        date_set = set(dates)
        meals_by_date = {}
        for m in all_meals:
            d = m.get("date", "")
            if d in date_set:
                meals_by_date.setdefault(d, []).append(m)

        result = {}
        for d in dates:
            day_meals = meals_by_date.get(d, [])
            totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0, "fiber_g": 0, "meal_count": len(day_meals)}
            for m in day_meals:
                for key in ["calories", "protein_g", "fat_g", "carbs_g", "fiber_g"]:
                    totals[key] += m.get(key) or 0
            totals["calorie_target"] = cal_target
            totals["protein_target_g"] = protein_target
            totals["fat_target_g"] = fat_target
            totals["carbs_target_g"] = carbs_target
            totals["date"] = d
            result[d] = totals
        return result

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

    # Daily logs (water, electrolytes, symptoms)
    def get_daily_log(self, target_date: str) -> dict:
        logs = _read_json("daily_logs.json", {})
        return logs.get(target_date, {"date": target_date, "water_glasses": 0, "sodium_mg": 0, "potassium_mg": 0, "magnesium_mg": 0, "symptoms": []})

    def update_daily_log(self, log: DailyLog) -> dict:
        logs = _read_json("daily_logs.json", {})
        logs[log.date] = log.model_dump()
        _write_json("daily_logs.json", logs)
        return logs[log.date]

    def add_water(self, target_date: str) -> dict:
        logs = _read_json("daily_logs.json", {})
        if target_date not in logs:
            logs[target_date] = {"date": target_date, "water_glasses": 0, "sodium_mg": 0, "potassium_mg": 0, "magnesium_mg": 0, "symptoms": []}
        logs[target_date]["water_glasses"] = logs[target_date].get("water_glasses", 0) + 1
        _write_json("daily_logs.json", logs)
        return logs[target_date]

    def remove_water(self, target_date: str) -> dict:
        logs = _read_json("daily_logs.json", {})
        if target_date in logs and logs[target_date].get("water_glasses", 0) > 0:
            logs[target_date]["water_glasses"] -= 1
            _write_json("daily_logs.json", logs)
        return logs.get(target_date, {"water_glasses": 0})

    # Streak calculation
    def get_streak(self) -> dict:
        profile = self.get_profile()
        carb_limit = profile.get("net_carb_limit", 20)
        streak = 0
        longest = 0
        current = 0
        d = date.today()
        # Bulk-load all 90 days of stats in 1 file read
        dates = [(d - timedelta(days=i)).isoformat() for i in range(90)]
        bulk_stats = self.get_bulk_daily_stats(dates)
        for i, check in enumerate(dates):
            stats = bulk_stats.get(check, {})
            net = max(0, (stats.get("carbs_g", 0) or 0) - (stats.get("fiber_g", 0) or 0))
            if stats.get("meal_count", 0) > 0 and net <= carb_limit:
                current += 1
                if i == streak:  # still consecutive from today
                    streak = current
            else:
                if stats.get("meal_count", 0) > 0:  # only break if they actually logged meals
                    longest = max(longest, current)
                    current = 0
                elif i == streak:
                    streak = current  # skip days with no meals logged
        longest = max(longest, current)
        return {"current_streak": streak, "longest_streak": longest, "carb_limit": carb_limit}

    # Grocery lists
    def save_grocery_list(self, grocery: GroceryList) -> dict:
        lists = _read_json("grocery_lists.json", [])
        entry = grocery.model_dump()
        entry["id"] = str(uuid.uuid4())[:12]
        entry["saved_at"] = datetime.now().isoformat()
        lists.append(entry)
        _write_json("grocery_lists.json", lists)
        return entry

    def get_grocery_lists(self, limit: int = 10) -> list:
        lists = _read_json("grocery_lists.json", [])
        return sorted(lists, key=lambda g: g.get("saved_at", ""), reverse=True)[:limit]

    # Saved meals / favorites
    def get_favorites(self, limit: int = 20) -> list:
        meals = _read_json("meals.json", [])
        # Count frequency of each meal description, return most common
        freq = {}
        for m in meals:
            key = m.get("meal_name") or m.get("meal_description", "")[:50]
            if not key:
                continue
            if key not in freq:
                freq[key] = {
                    "meal_name": m.get("meal_name", ""),
                    "meal_description": m.get("meal_description", ""),
                    "calories": m.get("calories"),
                    "protein_g": m.get("protein_g"),
                    "fat_g": m.get("fat_g"),
                    "carbs_g": m.get("carbs_g"),
                    "fiber_g": m.get("fiber_g"),
                    "count": 0,
                }
            freq[key]["count"] += 1
        favorites = sorted(freq.values(), key=lambda x: x["count"], reverse=True)
        return favorites[:limit]

    # Saved plans
    def save_plan(self, plan: dict) -> dict:
        plans = _read_json("plans.json", [])
        plan["id"] = str(uuid.uuid4())[:12]
        plan["saved_at"] = datetime.now().isoformat()
        plans.append(plan)
        _write_json("plans.json", plans)
        return plan

    def get_plans(self, limit: int = 10) -> list:
        plans = _read_json("plans.json", [])
        return sorted(plans, key=lambda p: p.get("saved_at", ""), reverse=True)[:limit]

    def get_all_daily_logs(self) -> dict:
        return _read_json("daily_logs.json", {})

    def count_meals(self) -> int:
        return len(_read_json("meals.json", []))

    def export_all(self) -> dict:
        return {
            "meals": sorted(_read_json("meals.json", []), key=lambda x: x.get("date", "")),
            "weights": sorted(_read_json("weights.json", []), key=lambda x: x.get("date", "")),
        }
