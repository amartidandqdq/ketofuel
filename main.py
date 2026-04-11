import logging
from datetime import date
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
import uvicorn

from config import APP_HOST, APP_PORT
from models import UserProfile, MealPlanRequest, RecipeRequest, AnalyzeRequest, MealLog, WeightEntry
from ai_client import AIClient
from storage import Storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="NutriPlan AI", version="1.0.0")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

ai = AIClient()
db = Storage()


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/profile")
async def get_profile():
    profile = db.get_profile()
    safe = {**profile}
    key = safe.get("api_key", "")
    safe["api_key_set"] = bool(key)
    safe["api_key_hint"] = f"...{key[-4:]}" if len(key) > 4 else ""
    del safe["api_key"]
    return safe


@app.post("/api/profile")
async def save_profile(profile: UserProfile):
    db.save_profile(profile)
    return {"status": "ok"}


@app.get("/api/stats")
async def get_stats(target_date: str = None):
    return db.get_daily_stats(target_date)


# Meal plan generation
@app.post("/api/generate-plan")
async def generate_plan(req: MealPlanRequest):
    try:
        profile = db.get_profile()
        result = await ai.generate_meal_plan(profile, req.days, req.preferences or "")
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Plan generation failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Recipe suggestions
@app.post("/api/suggest-recipes")
async def suggest_recipes(req: RecipeRequest):
    try:
        profile = db.get_profile()
        result = await ai.suggest_recipes(profile, req.ingredients, req.max_recipes, req.preferences or "")
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Recipe suggestion failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Nutritional analysis
@app.post("/api/analyze")
async def analyze_meal(req: AnalyzeRequest):
    try:
        profile = db.get_profile()
        result = await ai.analyze_nutrition(profile, req.meal_description)
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        log.exception("Analysis failed")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Meal logging
@app.post("/api/meals")
async def log_meal(meal: MealLog):
    return db.log_meal(meal)


@app.get("/api/meals")
async def get_meals(target_date: str = None):
    return db.get_meals(target_date)


@app.delete("/api/meals/{meal_id}")
async def delete_meal(meal_id: str):
    if db.delete_meal(meal_id):
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Meal not found"})


# Weight tracking
@app.post("/api/weight")
async def log_weight(entry: WeightEntry):
    return db.log_weight(entry)


@app.get("/api/weight")
async def get_weights(limit: int = 30):
    return db.get_weights(limit)


@app.delete("/api/weight/{target_date}")
async def delete_weight(target_date: str):
    if db.delete_weight(target_date):
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "Weight entry not found"})


@app.get("/api/weight/insight")
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
        return JSONResponse(status_code=500, content={"error": str(e)})


# Saved plans
@app.post("/api/plans")
async def save_plan(plan: dict):
    return db.save_plan(plan)


@app.get("/api/plans")
async def get_plans(limit: int = 10):
    return db.get_plans(limit)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
