# POURQUOI: Meal CRUD, favorites, food database, grocery, saved plans.

import json
import logging
import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import MealLog, GroceryList, SavedPlan
from storage import Storage

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
db = Storage()

# Keto food database
_foods_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "keto_foods.json")
try:
    with open(_foods_path, "r") as _f:
        KETO_FOODS = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    log.warning("Failed to load keto_foods.json: %s", e)
    KETO_FOODS = []


@router.post("/meals")
async def log_meal(meal: MealLog):
    return db.log_meal(meal)


@router.get("/meals")
async def get_meals(target_date: str = None, limit: int = 0, offset: int = 0):
    return db.get_meals(target_date, limit, offset)


@router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str):
    if db.delete_meal(meal_id):
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Meal not found"})


@router.get("/foods")
async def search_foods(q: str = "", cat: str = ""):
    results = KETO_FOODS
    if q:
        q_lower = q.lower()
        results = [f for f in results if q_lower in f["name"].lower()]
    if cat:
        results = [f for f in results if f["cat"].lower() == cat.lower()]
    return {"foods": results, "categories": sorted(set(f["cat"] for f in KETO_FOODS))}


@router.get("/favorites")
async def get_favorites(limit: int = 20):
    return db.get_favorites(limit)


@router.post("/grocery")
async def save_grocery(grocery: GroceryList):
    return db.save_grocery_list(grocery)


@router.get("/grocery")
async def get_groceries(limit: int = 10):
    return db.get_grocery_lists(limit)


@router.post("/plans")
async def save_plan(plan: SavedPlan):
    return db.save_plan(plan.model_dump())


@router.get("/plans")
async def get_plans(limit: int = 10):
    return db.get_plans(limit)
